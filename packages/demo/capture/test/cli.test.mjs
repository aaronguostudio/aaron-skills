import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CaptureRefusal } from '../scripts/guards.mjs'
import { sessionPaths } from '../scripts/session.mjs'
import { isEntryPoint, launchArgs, loadChromium, main } from '../scripts/cli.mjs'

const PROJECT = join(import.meta.dirname, 'fixture')

// Every temporary folder a test makes comes from here and is removed when the file is done.
const made = []
function scratch(prefix) {
  const folder = mkdtempSync(join(tmpdir(), prefix))
  made.push(folder)
  return folder
}
after(() => {
  for (const folder of made) rmSync(folder, { recursive: true, force: true })
})

// The fixture's walks, read from its folder so that adding a walk there changes no number here.
const WALK_NAMES = readdirSync(join(PROJECT, 'demo-capture', 'walks'))
  .filter((file) => file.endsWith('.mjs'))
  .map((file) => file.slice(0, -'.mjs'.length))
// --list pads every walk name to the longest one (at least 4 wide), then adds two spaces.
const NAME_WIDTH = Math.max(4, ...WALK_NAMES.map((name) => name.length))
const gap = (name) => NAME_WIDTH - name.length + 2

// Runs main() with its output captured; none of these reach a browser.
async function cli(args) {
  const lines = []
  const root = scratch('demo-capture-cli-')
  const code = await main(args, { root, log: (line) => lines.push(line), error: (line) => lines.push(line) })
  return { code, output: lines.join('\n') }
}

test('--list shows the walks, the environments and the params without opening a browser', async () => {
  assert.ok(WALK_NAMES.length >= 2, 'the plural below needs at least two fixture walks')
  const { code, output } = await cli(['--project', PROJECT, '--list'])
  assert.equal(code, 0, output)
  assert.match(output, new RegExp(`^fixture-app: ${WALK_NAMES.length} walks \\(--walk\\)`))
  assert.match(output, new RegExp(`\\n {2}tour {${gap('tour')}}read-only {2}Fixture tour\\n`))
  assert.match(output, new RegExp(`\\n {2}adds-item {${gap('adds-item')}}writes {5}Add an item\\n`))
  assert.match(output, /\n {2}live {2}https:\/\/app\.example\.com {2}production: every run needs --prod-go-ahead/)
  assert.match(output, /\n {2}heading {2}default "Details"/)
})

test('--help prints the usage; a bad argument prints it with the reason and exits 2', async () => {
  const help = await cli(['--help'])
  assert.equal(help.code, 0)
  assert.match(help.output, /--learn-hosts/)
  const bad = await cli(['--env'])
  assert.equal(bad.code, 2)
  assert.match(bad.output, /^demo-capture: --env needs a value\n\ndemo-capture: record/)
})

test('every refusal exits 2 with one plain sentence, before any browser opens', async () => {
  const base = scratch('demo-capture-repo-')
  mkdirSync(join(base, 'repo', '.git'), { recursive: true })
  const notEmpty = join(base, 'used')
  mkdirSync(notEmpty)
  writeFileSync(join(notEmpty, 'capture.json'), '{}')
  const cases = [
    [['--project', join(base, 'nowhere'), '--list'], /has no demo-capture\/config\.mjs/],
    [['--project', PROJECT, '--env', 'uat', '--walk', 'tour'], /unknown --env "uat"; this project declares local, stage, live/],
    [['--project', PROJECT, '--env', 'local', '--walk', 'missing'], /unknown walk "missing"/],
    [['--project', PROJECT, '--env', 'local', '--walk', '../config'], /walk names are lowercase/],
    [['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--set', 'colour=red'], /unknown param "colour"; this project takes heading/],
    [['--project', PROJECT, '--env', 'live', '--walk', 'tour'], /live is a production environment: it needs --prod-go-ahead/],
    [['--project', PROJECT, '--env', 'stage', '--walk', 'adds-item'], /This walk writes, and stage needs a go-ahead/],
    [['--project', PROJECT, '--env', 'local', '--walk', 'adds-item', '--learn-hosts'], /--learn-hosts runs read-only walks only/],
    [['--project', PROJECT, '--env', 'live', '--walk', 'tour', '--prod-go-ahead', '--learn-hosts'], /--learn-hosts is refused on live/],
    // A learning run that can never happen is refused for that, before any go-ahead is asked for.
    [['--project', PROJECT, '--env', 'live', '--walk', 'tour', '--learn-hosts'], /--learn-hosts is refused on live/],
    [['--project', PROJECT, '--env', 'stage', '--walk', 'adds-item', '--learn-hosts'], /--learn-hosts runs read-only walks only/],
    [['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--out', join(base, 'repo', 'run')], /The run folder .* is inside the git working tree/],
    [['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--out', notEmpty], /is not empty; pick another --out/]
  ]
  for (const [args, pattern] of cases) {
    const { code, output } = await cli(args)
    assert.equal(code, 2, `${args.join(' ')}\n${output}`)
    assert.match(output, pattern)
    assert.match(output, /^demo-capture: /)
  }
})

test('the session folder must be outside every repo too', async () => {
  const base = scratch('demo-capture-repo-')
  mkdirSync(join(base, '.git'))
  const lines = []
  const code = await main(['--project', PROJECT, '--env', 'local', '--walk', 'tour'], {
    root: join(base, 'sessions'),
    log: (line) => lines.push(line),
    error: (line) => lines.push(line)
  })
  assert.equal(code, 2)
  assert.match(lines.join('\n'), /The session folder .* is inside the git working tree/)
})

test('isEntryPoint compares the script and the module through symlinks', () => {
  assert.equal(isEntryPoint(import.meta.url, process.argv[1]), true)
  assert.equal(isEntryPoint(import.meta.url, ''), false)
  assert.equal(isEntryPoint(import.meta.url, '/no/such/file.mjs'), false)
  // The case this exists for: node was started through a link to the script.
  const folder = scratch('demo-capture-link-')
  const link = join(folder, 'linked.mjs')
  symlinkSync(fileURLToPath(import.meta.url), link)
  assert.equal(isEntryPoint(import.meta.url, link), true)
})

test('launchArgs leaves only the environment\'s own names resolvable, and nothing blocked while learning', () => {
  assert.deepEqual(launchArgs({ hosts: ['app.example.com', 'api.example.net'], learning: false }), [
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE app.example.com , EXCLUDE api.example.net'
  ])
  assert.deepEqual(launchArgs({ hosts: ['app.example.com', 'api.example.net'], learning: true }), [])
  assert.deepEqual(launchArgs({ hosts: [], learning: false }), ['--host-resolver-rules=MAP * ~NOTFOUND'])
})

test('launchArgs names a host:port entry by its host, a host listed twice once, in the order first listed', () => {
  assert.deepEqual(
    launchArgs({
      hosts: ['b.example.com:8443', 'a.example.com', 'b.example.com', 'A.Example.com.', 'a.example.com:9000'],
      learning: false
    }),
    ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE b.example.com , EXCLUDE a.example.com']
  )
  assert.deepEqual(launchArgs({ hosts: ['[::1]:4100', 'localhost:4100'], learning: false }), [
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE ::1 , EXCLUDE localhost'
  ])
})

test('launchArgs refuses an entry that is not a host name, so no rule is built from it', () => {
  for (const entry of ['app.example.com , MAP * evil.example.net', 'a b', '', 'app.example.com:99999x', 'app.example.com:70000', 'app.example.com:0', 5, null]) {
    assert.throws(
      () => launchArgs({ hosts: ['app.example.com', entry], learning: false }),
      (error) => {
        assert.ok(error instanceof CaptureRefusal, String(entry))
        assert.doesNotMatch(error.message, /evil/)
        return true
      },
      String(entry)
    )
  }
})

test('a missing dependency says to run npm ci, and keeps the first line of the import error only', async () => {
  const importer = async () => {
    throw new Error("Cannot find package 'playwright' imported from /x/cli.mjs\n    at somewhere (/x/y.mjs:1:1)")
  }
  await assert.rejects(loadChromium(importer), (error) => {
    assert.ok(error instanceof CaptureRefusal)
    assert.match(
      error.message,
      /^The engine's dependency is missing: run npm ci in \S+ \(Cannot find package 'playwright' imported from \/x\/cli\.mjs\)$/
    )
    return true
  })
  const chromium = { launch() {} }
  assert.equal(await loadChromium(async () => ({ chromium })), chromium)
})

// A chromium that cannot start, handed to main() so that no real browser is involved.
const broken = {
  async launch() {
    throw new Error("browserType.launch: Executable doesn't exist at /cache/chromium-1234\nLooks like Playwright was just installed")
  }
}
const NOT_STARTED = /^demo-capture: The browser did not start \(browserType\.launch: Executable doesn't exist at \/cache\/chromium-1234\)\. Run the demo-tools macOS installer to install this Playwright version's Chromium\.$/

test('sign-in with a browser that will not start exits 2 with one sentence and releases the lock', async () => {
  const root = scratch('demo-capture-cli-')
  const lines = []
  const code = await main(['sign-in', '--project', PROJECT, '--env', 'local'], {
    root,
    chromium: broken,
    log: (line) => lines.push(line),
    error: (line) => lines.push(line)
  })
  assert.equal(code, 2, lines.join('\n'))
  assert.equal(lines.length, 1)
  assert.match(lines[0], NOT_STARTED)
  assert.equal(existsSync(sessionPaths(root, 'fixture-app', 'local').lock), false)
})

// main() with a saved session for the fixture's local environment, so a run goes straight to
// recording, and a browser that will not start: the run gets as far as the browser, and no further.
async function runToTheBrowser(root, extraArgs = []) {
  const session = sessionPaths(root, 'fixture-app', 'local')
  mkdirSync(session.dir, { recursive: true })
  writeFileSync(session.state, '{}')
  const lines = []
  const code = await main(['--project', PROJECT, '--env', 'local', '--walk', 'outside-host', ...extraArgs], {
    root,
    chromium: broken,
    log: (line) => lines.push(line),
    error: (line) => lines.push(line)
  })
  return { code, lines, session }
}

test('a recording with a browser that will not start exits 2 with the same sentence, and releases the lock', async () => {
  const root = scratch('demo-capture-cli-')
  const { code, lines, session } = await runToTheBrowser(root)
  assert.equal(code, 2, lines.join('\n'))
  assert.equal(lines.length, 2)
  // The run folder is named as soon as it is made, so a run that dies later still says where it is.
  assert.match(lines[0], /^Run folder: .*\/fixture-app\/runs\/\d{8}-\d{6}-outside-host$/)
  assert.match(lines[1], NOT_STARTED)
  assert.equal(existsSync(session.lock), false)
  // A refusal leaves no empty run folder behind.
  assert.deepEqual(readdirSync(join(root, 'fixture-app', 'runs')), [])
})

test('a refusal removes the run folder it made, but never one that was there before or one that holds something', async () => {
  const outside = scratch('demo-capture-out-')
  const made = join(outside, 'new-run')
  const madeRun = await runToTheBrowser(scratch('demo-capture-cli-'), ['--out', made])
  assert.equal(madeRun.code, 2, madeRun.lines.join('\n'))
  assert.equal(madeRun.lines[0], `Run folder: ${made}`)
  assert.equal(existsSync(made), false)
  const existing = join(outside, 'existing-run')
  mkdirSync(existing)
  const existingRun = await runToTheBrowser(scratch('demo-capture-cli-'), ['--out', existing])
  assert.equal(existingRun.code, 2, existingRun.lines.join('\n'))
  assert.equal(existsSync(existing), true)
})

test('an --out in the capture folder must be under the project\'s runs folder, and an --out that is a file is refused', async () => {
  const root = scratch('demo-capture-cli-')
  const link = join(scratch('demo-capture-link-'), 'root')
  symlinkSync(root, link)
  // Another environment's session folder, another project's runs, the capture folder's own files.
  for (const out of [join(root, 'fixture-app', 'stage'), join(root, 'other-app', 'runs', 'x'), join(root, 'loose'), join(link, 'fixture-app', 'live')]) {
    const lines = []
    const code = await main(['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--out', out], {
      root,
      chromium: broken,
      log: (line) => lines.push(line),
      error: (line) => lines.push(line)
    })
    assert.equal(code, 2, out)
    assert.match(
      lines.join('\n'),
      /^demo-capture: The run folder .* is in the capture folder .*, where a run folder belongs under .*\/fixture-app\/runs; pick another --out$/,
      out
    )
    assert.deepEqual(readdirSync(root), [], `nothing was created for ${out}`)
  }
  // Under the project's runs folder it is fine, and the run goes on to the browser.
  const fine = await runToTheBrowser(root, ['--out', join(root, 'fixture-app', 'runs', 'mine')])
  assert.equal(fine.code, 2)
  assert.match(fine.lines.at(-1), NOT_STARTED)
  // A file is not a folder: said plainly, not as an error code.
  const file = join(scratch('demo-capture-out-'), 'capture.json')
  writeFileSync(file, '{}')
  const lines = []
  const code = await main(['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--out', file], {
    root: scratch('demo-capture-cli-'),
    log: (line) => lines.push(line),
    error: (line) => lines.push(line)
  })
  assert.equal(code, 2)
  assert.deepEqual(lines, [`demo-capture: ${file} is a file, not a folder; pick another --out`])
})

test('--out may not be, hold or sit inside the session folder, and nothing is created', async () => {
  const root = scratch('demo-capture-cli-')
  const session = sessionPaths(root, 'fixture-app', 'local')
  // Recovering from a signed-out run empties the run folder: it must never be where the session is kept.
  // A symlink to the root is another spelling of the same folders.
  const link = join(scratch('demo-capture-link-'), 'root')
  symlinkSync(root, link)
  for (const out of [session.dir, join(root, 'fixture-app'), join(session.dir, 'runs'), join(link, 'fixture-app', 'local')]) {
    const lines = []
    const code = await main(['--project', PROJECT, '--env', 'local', '--walk', 'tour', '--out', out], {
      root,
      chromium: broken, // a run that got this far must not find a real browser
      log: (line) => lines.push(line),
      error: (line) => lines.push(line)
    })
    assert.equal(code, 2, out)
    assert.match(lines.join('\n'), /^demo-capture: The run folder .* overlaps the session folder .*; pick another --out$/, out)
    assert.deepEqual(readdirSync(root), [], `nothing was created for ${out}`)
  }
})

test('the sign-in window opens with exactly the options signIn gives it, and no resolver rules', async () => {
  const launches = []
  const chromium = {
    async launch(options) {
      launches.push(options)
      throw new Error('stop here')
    }
  }
  const code = await main(['sign-in', '--project', PROJECT, '--env', 'local'], {
    root: scratch('demo-capture-cli-'),
    chromium,
    log: () => {},
    error: () => {}
  })
  assert.equal(code, 2)
  assert.deepEqual(launches, [{ headless: false }])
})
