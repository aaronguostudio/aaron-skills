import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import fsPromises, { readFile, stat } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { CaptureRefusal, acquireRunLock, assertOutsideRepos, enclosingRepo } from '../scripts/guards.mjs'

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

const refuses = (fn, pattern) => assert.throws(fn, (e) => e instanceof CaptureRefusal && pattern.test(e.message))
const rejects = (promise, pattern) =>
  assert.rejects(promise, (e) => e instanceof CaptureRefusal && pattern.test(e.message))

test('a folder inside a git working tree is refused, found through symlinks and from paths that do not exist yet', () => {
  const base = realpathSync(tempDir('repo-check-'))
  mkdirSync(join(base, 'repo', '.git'), { recursive: true })
  mkdirSync(join(base, 'worktree'))
  writeFileSync(join(base, 'worktree', '.git'), 'gitdir: /elsewhere\n')
  mkdirSync(join(base, 'plain'))
  symlinkSync(join(base, 'repo'), join(base, 'link'))
  assert.equal(enclosingRepo(join(base, 'repo', 'a', 'b')), join(base, 'repo'))
  assert.equal(enclosingRepo(join(base, 'worktree', 'runs', 'x')), join(base, 'worktree'))
  assert.equal(enclosingRepo(join(base, 'link', 'run')), join(base, 'repo'))
  assert.equal(enclosingRepo(join(base, 'plain', 'run')), null)
  refuses(() => assertOutsideRepos(join(base, 'repo', 'run'), 'The run folder'), /The run folder .* is inside the git working tree/)
  assert.doesNotThrow(() => assertOutsideRepos(join(base, 'plain', 'run'), 'The run folder'))
})

test('the repo is found above an existing folder, however deep, and the nearest one wins', () => {
  const base = realpathSync(tempDir('repo-deep-'))
  mkdirSync(join(base, 'repo', '.git'), { recursive: true })
  mkdirSync(join(base, 'repo', 'runs', 'one'), { recursive: true })
  mkdirSync(join(base, 'repo', 'inner', '.git'), { recursive: true })
  mkdirSync(join(base, 'repo', 'inner', 'runs'))
  assert.equal(enclosingRepo(join(base, 'repo', 'runs', 'one')), join(base, 'repo'))
  assert.equal(enclosingRepo(join(base, 'repo', 'runs', 'one', 'new')), join(base, 'repo'))
  assert.equal(enclosingRepo(join(base, 'repo', 'inner', 'runs', 'new')), join(base, 'repo', 'inner'))
})

test('the run lock admits one run, refuses a live holder, and takes over from a dead one', async () => {
  const dir = tempDir('lock-')
  const lock = join(dir, 'session', 'lock')
  const release = await acquireRunLock(lock, { pid: 111, isAlive: () => true })
  assert.equal(await readFile(lock, 'utf8'), '111')
  assert.equal((await stat(lock)).mode & 0o777, 0o600)
  assert.equal((await stat(dirname(lock))).mode & 0o777, 0o700)
  await rejects(acquireRunLock(lock, { pid: 222, isAlive: (pid) => pid === 111 }), /Another run \(pid 111\) is using this session/)
  // The refusal names the lock file, so a leftover lock (a recycled pid after a reboot) can be found.
  await assert.rejects(
    acquireRunLock(lock, { pid: 222, isAlive: (pid) => pid === 111 }),
    (e) => e instanceof CaptureRefusal && e.message.includes(lock)
  )
  const takeover = await acquireRunLock(lock, { pid: 333, isAlive: () => false })
  assert.equal(await readFile(lock, 'utf8'), '333')
  await takeover()
  await assert.rejects(stat(lock), { code: 'ENOENT' })
  await release()
  // A lock file without a pid in it is stale.
  writeFileSync(lock, '')
  const again = await acquireRunLock(lock, { pid: 444, isAlive: () => true })
  assert.equal(await readFile(lock, 'utf8'), '444')
  await again()
})

test('the run lock treats a process it may not signal as alive', async () => {
  const dir = tempDir('lock-')
  const lock = join(dir, 'lock')
  // pid 1 always exists and belongs to root: signalling it fails with EPERM.
  writeFileSync(lock, '1')
  await rejects(acquireRunLock(lock), /Another run \(pid 1\)/)
  writeFileSync(lock, String(process.pid))
  await rejects(acquireRunLock(lock), /Another run/)
  // No process has this pid (macOS and Linux stop well below it), so the lock is stale.
  writeFileSync(lock, '9999999')
  const release = await acquireRunLock(lock)
  assert.equal(await readFile(lock, 'utf8'), String(process.pid))
  await release()
})

test('the last attempt gives up without deleting a lock another run has just taken', async () => {
  const dir = tempDir('lock-')
  const lock = join(dir, 'lock')
  writeFileSync(lock, '555')
  // A seam, not a timing trick: right after the stale lock is removed, a competing run takes the
  // lock, which is what the second write then finds. node:test runs each file in its own process.
  const realRm = fsPromises.rm
  let removals = 0
  fsPromises.rm = async (...args) => {
    await realRm(...args)
    if (++removals === 1) writeFileSync(lock, '999')
  }
  syncBuiltinESMExports()
  try {
    await rejects(acquireRunLock(lock, { pid: 222, isAlive: () => false }), /Could not take the run lock/)
  } finally {
    fsPromises.rm = realRm
    syncBuiltinESMExports()
  }
  assert.equal(removals, 1)
  assert.equal(readFileSync(lock, 'utf8'), '999')
})

test('the run lock folder and file are private whatever the umask says', async () => {
  const lock = join(tempDir('lock-'), 'project', 'env', 'lock')
  const before = process.umask(0)
  let release
  try {
    release = await acquireRunLock(lock, { pid: 111, isAlive: () => true })
  } finally {
    process.umask(before)
  }
  assert.equal((await stat(lock)).mode & 0o777, 0o600)
  assert.equal((await stat(dirname(lock))).mode & 0o777, 0o700)
  // The folders made on the way are private too.
  assert.equal((await stat(dirname(dirname(lock)))).mode & 0o777, 0o700)
  await release()
})

test('a lock file that cannot be written, for a reason other than already existing, is reported as it is', async () => {
  const lock = join(tempDir('lock-'), 'lock')
  const realWrite = fsPromises.writeFile
  let writes = 0
  // A seam: the disk refuses the write. Such a failure is not a stale lock to take over.
  fsPromises.writeFile = async () => {
    writes++
    throw Object.assign(new Error('read-only file system'), { code: 'EROFS' })
  }
  syncBuiltinESMExports()
  try {
    await assert.rejects(
      acquireRunLock(lock, { pid: 222, isAlive: () => false }),
      (e) => !(e instanceof CaptureRefusal) && e.code === 'EROFS'
    )
  } finally {
    fsPromises.writeFile = realWrite
    syncBuiltinESMExports()
  }
  assert.equal(writes, 1)
})
