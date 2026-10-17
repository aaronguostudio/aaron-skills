import assert from 'node:assert/strict'
import cp, { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { acquireCheckLock, checkLockPath, runMutationCheck } from './mutation-check.mjs'

// Every temp folder a test makes is removed when this file's tests are done.
const tempDirs = []
const tempDir = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})
const lockIn = () => join(tempDir('check-lock-'), 'check.lock')

// Two runs at once would each mutate the same files and restore what the other had already mutated,
// so a run starts only while it holds this lock.
test('one check at a time: a live holder is refused, naming its pid and the lock file', () => {
  const lock = lockIn()
  const release = acquireCheckLock(lock, { pid: 111, isAlive: () => true })
  assert.equal(readFileSync(lock, 'utf8'), '111')
  assert.throws(
    () => acquireCheckLock(lock, { pid: 222, isAlive: (pid) => pid === 111 }),
    (e) => e.message.includes('pid 111') && e.message.includes(lock)
  )
  assert.equal(readFileSync(lock, 'utf8'), '111')
  release()
  assert.equal(existsSync(lock), false)
  const next = acquireCheckLock(lock, { pid: 222, isAlive: () => true })
  assert.equal(readFileSync(lock, 'utf8'), '222')
  next()
})

test('a lock left by a process that is gone is taken over, and an unreadable one counts as left over', () => {
  const lock = lockIn()
  writeFileSync(lock, '999')
  const release = acquireCheckLock(lock, { pid: 333, isAlive: () => false })
  assert.equal(readFileSync(lock, 'utf8'), '333')
  release()
  for (const junk of ['', 'abc', '-4', '0', '1.5']) {
    writeFileSync(lock, junk)
    const again = acquireCheckLock(lock, { pid: 444, isAlive: () => true })
    assert.equal(readFileSync(lock, 'utf8'), '444', JSON.stringify(junk))
    again()
  }
})

test('the lock is released only by its holder: a lock another check took over stays', () => {
  const lock = lockIn()
  const release = acquireCheckLock(lock, { pid: 111, isAlive: () => true })
  writeFileSync(lock, '222')
  release()
  assert.equal(readFileSync(lock, 'utf8'), '222')
  release()
  assert.equal(readFileSync(lock, 'utf8'), '222')
})

test('a lock that cannot be written for another reason than existing is reported as it is', () => {
  const missing = join(tempDir('check-lock-'), 'no', 'such', 'folder', 'check.lock')
  assert.throws(() => acquireCheckLock(missing), { code: 'ENOENT' })
})

test('the default liveness check asks the process table: this process and one it may not signal are alive, a gone one is not', () => {
  const lock = lockIn()
  const release = acquireCheckLock(lock, { pid: process.pid })
  assert.throws(() => acquireCheckLock(lock, { pid: 1 }), /Another mutation check \(pid \d+\)/)
  release()
  // pid 1 always exists and belongs to root: signalling it fails with EPERM, which means alive.
  writeFileSync(lock, '1')
  assert.throws(() => acquireCheckLock(lock), /Another mutation check \(pid 1\)/)
  // No process has this pid (macOS and Linux stop well below it).
  writeFileSync(lock, '9999999')
  acquireCheckLock(lock)()
  assert.equal(existsSync(lock), false)
})

// The lock protects the checkout's files, so it lives in the checkout: two shells can have different
// temporary folders, and a lock kept there would let a second check run over the first one's mutants.
test('the lock file is in the checkout test folder, whatever the temporary folder is', () => {
  const a = tempDir('check-tile-')
  const link = join(tempDir('check-tile-'), 'link')
  symlinkSync(a, link)
  assert.equal(checkLockPath(a), join(a, 'test', '.mutation-check.lock'))
  assert.equal(checkLockPath(), join(dirname(fileURLToPath(import.meta.url)), '.mutation-check.lock'))
  // Reached through a link it is the same file.
  mkdirSync(join(a, 'test'))
  const release = acquireCheckLock(checkLockPath(a))
  assert.equal(existsSync(checkLockPath(link)), true)
  release()
  assert.equal(existsSync(checkLockPath(a)), false)
})

test('two checks in shells with different temporary folders refuse each other', { timeout: 20000 }, async () => {
  const tile = sandbox()
  const otherTmp = tempDir('check-tmp-')
  const holder = acquireCheckLock(checkLockPath(tile))
  const here = fileURLToPath(new URL('./mutation-check.mjs', import.meta.url))
  const script = `
    import { tmpdir } from 'node:os'
    import { acquireCheckLock, checkLockPath } from ${JSON.stringify(here)}
    let outcome
    try {
      acquireCheckLock(checkLockPath(${JSON.stringify(tile)}))
      outcome = 'ran'
    } catch (error) {
      outcome = error.message
    }
    console.log(JSON.stringify({ tmp: tmpdir(), outcome }))`
  const out = await new Promise((done) => {
    let text = ''
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TMPDIR: otherTmp },
      stdio: ['ignore', 'pipe', 'inherit']
    })
    child.stdout.on('data', (chunk) => (text += chunk))
    child.on('close', () => done(JSON.parse(text)))
  })
  holder()
  assert.notEqual(out.tmp, tmpdir())
  assert.equal(out.tmp, otherTmp)
  assert.match(out.outcome, new RegExp(`^Another mutation check \\(pid ${process.pid}\\)`))
  assert.ok(out.outcome.includes(checkLockPath(tile)))
})

test('the lock file of this checkout is ignored by git, so it never shows in git status', (t) => {
  const folder = dirname(checkLockPath())
  const inside = spawnSync('git', ['-C', folder, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' })
  if (inside.status !== 0) return t.skip('not inside a git working tree')
  assert.equal(spawnSync('git', ['-C', folder, 'check-ignore', '--quiet', checkLockPath()]).status, 0)
})

test('two checks started at once: exactly one runs, the other is refused', { timeout: 20000 }, async () => {
  const lock = lockIn()
  const here = fileURLToPath(new URL('./mutation-check.mjs', import.meta.url))
  const script = `
    import { acquireCheckLock } from ${JSON.stringify(here)}
    try {
      const release = acquireCheckLock(${JSON.stringify(lock)})
      console.log('ran')
      await new Promise((done) => setTimeout(done, 700))
      release()
    } catch (error) {
      console.log('refused')
    }`
  const start = () =>
    new Promise((done) => {
      let out = ''
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] })
      child.stdout.on('data', (chunk) => (out += chunk))
      child.on('close', () => done(out.trim()))
    })
  const outcomes = await Promise.all([start(), start()])
  assert.deepEqual(outcomes.sort(), ['ran', 'refused'])
  assert.equal(existsSync(lock), false)
})

test('a run refuses while another holds the lock, and releases the lock and its signal handlers when done', async () => {
  const lock = lockIn()
  const lines = []
  const log = (line) => lines.push(line)
  const signals = () => ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit'].map((name) => process.listenerCount(name))
  const before = signals()
  const holder = acquireCheckLock(lock)
  assert.equal(await runMutationCheck([], { lockPath: lock, log }), 1)
  assert.match(lines.join('\n'), new RegExp(`Another mutation check \\(pid ${process.pid}\\)`))
  assert.equal(readFileSync(lock, 'utf8'), String(process.pid))
  holder()
  lines.length = 0
  assert.equal(await runMutationCheck([], { lockPath: lock, log }), 0)
  assert.match(lines.join('\n'), /All 0 mutants were caught\./)
  assert.equal(existsSync(lock), false)
  assert.deepEqual(signals(), before)
})

// ---- The runner over a folder of its own: one module, and one test file that passes while it says 'ok' ----

const TARGET = "export const value = 'ok'\nexport const other = 'fine'\n"
const TARGET_TEST = (before = '') => `import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import { value } from '../scripts/target.mjs'
test('value', async () => {
  ${before}
  // 'boom' ends node --test, the process the runner started, with a signal the runner did not send.
  if (value === 'boom') process.kill(process.ppid, 'SIGKILL')
  if (value === 'slow') await new Promise((done) => setTimeout(done, 30000))
  assert.equal(value, 'ok')
})
`
function sandbox({ target = TARGET, before = '' } = {}) {
  const tile = tempDir('check-tile-')
  mkdirSync(join(tile, 'scripts'))
  mkdirSync(join(tile, 'test'))
  writeFileSync(join(tile, 'scripts/target.mjs'), target)
  writeFileSync(join(tile, 'test/target.test.mjs'), TARGET_TEST(before))
  return tile
}
const mutant = (find, replace, extra = {}) => ({
  file: 'scripts/target.mjs',
  find,
  replace,
  test: 'test/target.test.mjs',
  endless: false,
  ...extra
})
const BREAK = mutant("export const value = 'ok'", "export const value = 'no'")
const KEEP = mutant("export const other = 'fine'", "export const other = 'finer'")
const ENDLESS = mutant("export const value = 'ok'", "for (;;) {}\nexport const value = 'ok'")
async function run(tile, mutants, options = {}) {
  const lines = []
  const code = await runMutationCheck(mutants, { tile, log: (line) => lines.push(line), minTimeoutMs: 700, ...options })
  return { code, lines, text: lines.join('\n') }
}
const noProcessLeft = (tile) => spawnSync('pgrep', ['-f', tile]).status === 1

test('a mutant its test catches is killed, one it does not catch survives, and the file is restored after each', async () => {
  const tile = sandbox()
  const { code, text } = await run(tile, [BREAK, KEEP])
  assert.equal(code, 1)
  assert.match(text, /^killed +#  1 scripts\/target\.mjs: export const value/m)
  assert.match(text, /^SURVIVED #  2 scripts\/target\.mjs: export const other/m)
  assert.match(text, /^1 of 2 mutants survived, timed out, errored or did not apply\.$/m)
  assert.equal(readFileSync(join(tile, 'scripts/target.mjs'), 'utf8'), TARGET)
  assert.equal(existsSync(checkLockPath(tile)), false)
  const caught = await run(sandbox(), [BREAK])
  assert.equal(caught.code, 0)
  assert.equal(caught.lines.at(-1), 'All 1 mutants were caught.')
})

test('a timeout is a kill only for a mutant marked endless; for any other it fails the check; nothing is left running', async () => {
  const [marked, unmarked] = await Promise.all([
    (async () => {
      const tile = sandbox()
      return { tile, ...(await run(tile, [{ ...ENDLESS, endless: true }])) }
    })(),
    (async () => {
      const tile = sandbox()
      return { tile, ...(await run(tile, [ENDLESS])) }
    })()
  ])
  assert.equal(marked.code, 0)
  assert.match(marked.text, /^killed \(timed out\) #  1 /m)
  assert.equal(unmarked.code, 1)
  assert.match(unmarked.text, /^TIMED OUT #  1 /m)
  assert.match(unmarked.text, /the test file did not finish in 0\.7 s/)
  assert.match(unmarked.text, /1 of 1 mutants survived, timed out, errored or did not apply\./)
  for (const { tile } of [marked, unmarked]) {
    assert.equal(readFileSync(join(tile, 'scripts/target.mjs'), 'utf8'), TARGET)
    assert.ok(noProcessLeft(tile), `a process of ${tile} is still running`)
  }
})

test('a run that ends by a signal the runner did not send is an error, never a kill', async () => {
  const { code, text } = await run(sandbox(), [mutant("export const value = 'ok'", "export const value = 'boom'")])
  assert.equal(code, 1)
  assert.match(text, /^ERRORED +#  1 /m)
  assert.match(text, /ended by SIGKILL/)
  assert.doesNotMatch(text, /^killed/m)
})

test('a mutant gets three times its test file baseline, and never less than the minimum', async () => {
  const [quick, slow] = await Promise.all([
    run(sandbox(), [KEEP]),
    run(sandbox({ before: 'await new Promise((done) => setTimeout(done, 600))' }), [KEEP])
  ])
  const line = (text) => /baseline test\/target\.test\.mjs passes unmutated \((\d+\.\d) s; a mutant gets (\d+\.\d) s\)/.exec(text)
  assert.equal(line(quick.text)[2], '0.7')
  const [, took, cap] = line(slow.text)
  assert.ok(Number(took) >= 0.6, took)
  assert.ok(Math.abs(Number(cap) - 3 * Number(took)) < 0.4, `${took} s baseline, ${cap} s cap`)
})

test('a test file that fails on the unmutated tree stops the check before any mutant', async () => {
  const tile = sandbox({ target: "export const value = 'bad'\nexport const other = 'fine'\n" })
  const { code, text } = await run(tile, [mutant("export const value = 'bad'", "export const value = 'no'")])
  assert.equal(code, 1)
  assert.match(text, /test\/target\.test\.mjs fails on the unmutated tree/)
  assert.doesNotMatch(text, /^(killed|SURVIVED)/m)
  assert.match(readFileSync(join(tile, 'scripts/target.mjs'), 'utf8'), /'bad'/)
})

test('a text that does not occur once, or leaves source that does not parse, stops the check before any test runs', async () => {
  const { code, text } = await run(sandbox(), [
    mutant('no such text', 'x'),
    mutant("export const value = 'ok'", 'export const value = ('),
    mutant('export const', 'const'),
    BREAK
  ])
  assert.equal(code, 1)
  assert.match(text, /#  1 scripts\/target\.mjs: no such text\n +the text to break occurs 0 times, not once/)
  assert.match(text, /#  2 [^\n]*\n +the mutated source does not parse: SyntaxError/)
  assert.match(text, /#  3 [^\n]*\n +the text to break occurs 2 times, not once/)
  assert.match(text, /3 of 4 mutants did not apply; nothing was run\./)
  assert.doesNotMatch(text, /baseline|killed/)
})

// An interrupt reaches the runner as a signal; emitting it here is safe because nothing else in a
// test process listens for it.
const pause = (ms) => new Promise((done) => setTimeout(done, ms))

test('an interrupt during the baseline stops the check, ends the test and starts no mutant', async () => {
  const tile = sandbox({ before: 'await new Promise((done) => setTimeout(done, 30000))' })
  const running = run(tile, [BREAK])
  await pause(300)
  process.emit('SIGINT')
  const { code, text } = await running
  assert.equal(code, 1)
  assert.match(text, /Interrupted; every file is restored\./)
  assert.doesNotMatch(text, /^(killed|SURVIVED)/m)
  assert.equal(readFileSync(join(tile, 'scripts/target.mjs'), 'utf8'), TARGET)
  assert.ok(noProcessLeft(tile), `a process of ${tile} is still running`)
})

test('an interrupt during a mutant restores the file, is not counted as a kill, and stops the loop', async () => {
  const tile = sandbox()
  const target = join(tile, 'scripts/target.mjs')
  const running = run(tile, [mutant("export const value = 'ok'", "export const value = 'slow'"), BREAK], { minTimeoutMs: 20000 })
  for (let i = 0; i < 200 && !readFileSync(target, 'utf8').includes("'slow'"); i++) await pause(25)
  assert.match(readFileSync(target, 'utf8'), /'slow'/, 'the mutant never went in')
  await pause(250)
  process.emit('SIGINT')
  const { code, text } = await running
  assert.equal(code, 1)
  assert.match(text, /Interrupted; every file is restored\./)
  assert.doesNotMatch(text, /^(killed|SURVIVED)/m)
  assert.equal(readFileSync(target, 'utf8'), TARGET)
  assert.ok(noProcessLeft(tile), `a process of ${tile} is still running`)
})

test('a run that leaves a process behind does not leave it running', async () => {
  // The test starts a process in its own group and finishes; the runner ends whatever is left.
  const tile = sandbox({
    before: "spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', process.argv[1]], { stdio: 'ignore' }).unref()"
  })
  const { code } = await run(tile, [BREAK])
  assert.equal(code, 0)
  assert.ok(noProcessLeft(tile), `a process of ${tile} is still running`)
})

test('an exit nobody planned still ends the running test, restores the file and releases the lock', async () => {
  const tile = sandbox()
  const lock = lockIn()
  const here = fileURLToPath(new URL('./mutation-check.mjs', import.meta.url))
  const script = `
    import { runMutationCheck } from ${JSON.stringify(here)}
    const slow = { file: 'scripts/target.mjs', find: "export const value = 'ok'", replace: "export const value = 'slow'", test: 'test/target.test.mjs', endless: false }
    runMutationCheck([slow], { tile: ${JSON.stringify(tile)}, lockPath: ${JSON.stringify(lock)}, log() {}, minTimeoutMs: 20000 })
    setTimeout(() => process.exit(7), 800)`
  const status = await new Promise((done) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'inherit' })
    child.on('close', done)
  })
  assert.equal(status, 7)
  assert.equal(readFileSync(join(tile, 'scripts/target.mjs'), 'utf8'), TARGET)
  assert.equal(existsSync(lock), false)
  assert.ok(noProcessLeft(tile), `a process of ${tile} is still running`)
})

test('the last attempt at the lock gives up without deleting a lock another check has just taken', () => {
  const lock = lockIn()
  writeFileSync(lock, '555')
  // A seam, not a timing trick: right after the stale lock is removed, a competing check takes the lock.
  const realRm = fs.rmSync
  let removals = 0
  fs.rmSync = (...args) => {
    realRm(...args)
    if (++removals === 1) writeFileSync(lock, '999')
  }
  syncBuiltinESMExports()
  try {
    assert.throws(() => acquireCheckLock(lock, { pid: 222, isAlive: () => false }), /Could not take the mutation-check lock/)
  } finally {
    fs.rmSync = realRm
    syncBuiltinESMExports()
  }
  assert.equal(removals, 1)
  assert.equal(readFileSync(lock, 'utf8'), '999')
})

test('a test run that cannot start is an error, never a kill; nor may it pass the baseline', async () => {
  const realSpawn = cp.spawn
  const cannotStart = () => {
    const fake = new EventEmitter()
    fake.stdout = new EventEmitter()
    fake.stderr = new EventEmitter()
    setImmediate(() => fake.emit('error', new Error('spawn node ENOENT')))
    return fake
  }
  const withSpawn = async (spawnNth, tile, mutants) => {
    let calls = 0
    cp.spawn = (...args) => (++calls === spawnNth ? cannotStart() : realSpawn(...args))
    syncBuiltinESMExports()
    try {
      return await run(tile, mutants)
    } finally {
      cp.spawn = realSpawn
      syncBuiltinESMExports()
    }
  }
  // The second run is the first mutant's; the first is the baseline.
  const mutantRun = await withSpawn(2, sandbox(), [BREAK])
  assert.equal(mutantRun.code, 1)
  assert.match(mutantRun.text, /^ERRORED +#  1 /m)
  assert.match(mutantRun.text, /spawn node ENOENT/)
  assert.doesNotMatch(mutantRun.text, /^killed/m)
  const baselineRun = await withSpawn(1, sandbox(), [BREAK])
  assert.equal(baselineRun.code, 1)
  assert.match(baselineRun.text, /fails on the unmutated tree/)
  assert.doesNotMatch(baselineRun.text, /^(killed|SURVIVED|ERRORED)/m)
})
