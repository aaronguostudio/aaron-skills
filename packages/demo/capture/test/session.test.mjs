import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { chmod, link, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { CaptureRefusal } from '../scripts/guards.mjs'
import {
  SIGNED_IN_STABLE_MS,
  SIGN_IN_TIMEOUT_MS,
  captureRoot,
  defaultRunDir,
  deleteState,
  ensurePrivateDir,
  hasState,
  isSignedInAt,
  runWithSession,
  saveState,
  sessionPaths,
  signIn,
  SignedOut,
  waitUntilSignedIn
} from '../scripts/session.mjs'

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

const rejects = (promise, pattern) =>
  assert.rejects(promise, (e) => e instanceof CaptureRefusal && pattern.test(e.message))
const mode = async (path) => (await stat(path)).mode & 0o777
const isSignedOut = (url) => new URL(url).pathname.startsWith('/login')
const ORIGIN = 'https://app.example.com'

test('sessions live in ~/.demo-capture/<name>/<env>/, and a test can move the root', () => {
  assert.equal(captureRoot({ env: {}, home: '/home/me' }), join('/home/me', '.demo-capture'))
  assert.equal(captureRoot({ env: { DEMO_CAPTURE_HOME: '/tmp/x/../y' }, home: '/home/me' }), '/tmp/y')
  assert.deepEqual(sessionPaths('/r', 'my-app', 'dev'), {
    dir: join('/r', 'my-app', 'dev'),
    state: join('/r', 'my-app', 'dev', 'state.json'),
    lock: join('/r', 'my-app', 'dev', 'lock')
  })
  assert.equal(
    defaultRunDir('/r', 'my-app', 'tour', new Date(2026, 9, 5, 9, 7, 3)),
    join('/r', 'my-app', 'runs', '20261005-090703-tour')
  )
  assert.equal(SIGN_IN_TIMEOUT_MS, 600_000)
  assert.equal(SIGNED_IN_STABLE_MS, 3000)
})

test('the session folder is 0700 even when it already exists', async () => {
  const dir = join(tempDir('session-'), 'my-app', 'dev')
  await mkdir(dir, { recursive: true, mode: 0o755 })
  await chmod(dir, 0o755)
  await ensurePrivateDir(dir)
  assert.equal(await mode(dir), 0o700)
})

test('saveState writes the storage state, with IndexedDB, as a 0600 file in a 0700 folder', async () => {
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  const asked = []
  const context = { storageState: async (options) => (asked.push(options), { cookies: [{ name: 's' }], origins: [] }) }
  assert.equal(await hasState(state), false)
  await saveState(context, state)
  assert.deepEqual(asked, [{ indexedDB: true }])
  assert.deepEqual(JSON.parse(await readFile(state, 'utf8')), { cookies: [{ name: 's' }], origins: [] })
  assert.equal(await mode(state), 0o600)
  assert.equal(await mode(join(state, '..')), 0o700)
  assert.equal(await hasState(state), true)
  // No temporary file is left behind.
  assert.deepEqual(await readdir(join(state, '..')), ['state.json'])
  // A second save replaces it and keeps the mode.
  await writeFile(state, '{}', { mode: 0o644 })
  await chmod(state, 0o644)
  await saveState(context, state)
  assert.equal(await mode(state), 0o600)
  await deleteState(state)
  assert.equal(await hasState(state), false)
  await deleteState(state)
})

test('hasState is true for a file only: not for a missing path, not for a folder', async () => {
  const dir = tempDir('session-')
  assert.equal(await hasState(join(dir, 'state.json')), false)
  assert.equal(await hasState(dir), false)
  await writeFile(join(dir, 'state.json'), '{}')
  assert.equal(await hasState(join(dir, 'state.json')), true)
})

test('saveState is private whatever the umask says', async () => {
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  const context = { storageState: async () => ({ cookies: [], origins: [] }) }
  const before = process.umask(0)
  try {
    await saveState(context, state)
  } finally {
    process.umask(before)
  }
  assert.equal(await mode(join(state, '..')), 0o700)
  // The folders created on the way (the project's, which also holds its runs) are private too.
  assert.equal(await mode(join(state, '..', '..')), 0o700)
  assert.equal(await mode(state), 0o600)
})

// The temporary file is created with the mode minus the umask, so it needs the chmod to end at 0600.
// The folder exists already: under this umask a folder made by saveState would not be writable.
test('saveState sets 0600 itself, whatever the umask took off the temporary file', async () => {
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  await ensurePrivateDir(join(state, '..'))
  const context = { storageState: async () => ({ cookies: [], origins: [] }) }
  const before = process.umask(0o277)
  try {
    await saveState(context, state)
  } finally {
    process.umask(before)
  }
  assert.equal(await mode(state), 0o600)
})

// An orphaned temporary file holds live cookies, so no save and no delete may leave one.
test('a stale temporary file is replaced by a fresh 0600 one, never written through', async () => {
  const root = tempDir('session-')
  const state = join(root, 'my-app', 'dev', 'state.json')
  const context = { storageState: async () => ({ cookies: [{ name: 's' }], origins: [] }) }
  await ensurePrivateDir(join(state, '..'))
  await writeFile(`${state}.tmp`, 'stale', { mode: 0o644 })
  await chmod(`${state}.tmp`, 0o644)
  // A second name for the stale file's inode: if the save wrote through it, it would change.
  const alias = join(root, 'alias')
  await link(`${state}.tmp`, alias)
  await saveState(context, state)
  assert.equal(await mode(state), 0o600)
  assert.deepEqual(JSON.parse(await readFile(state, 'utf8')), { cookies: [{ name: 's' }], origins: [] })
  assert.deepEqual(await readdir(join(state, '..')), ['state.json'])
  assert.equal(await readFile(alias, 'utf8'), 'stale')
  assert.equal(await mode(alias), 0o644)
})

test('deleteState also removes a leftover temporary file', async () => {
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  await ensurePrivateDir(join(state, '..'))
  await writeFile(state, '{}', { mode: 0o600 })
  await writeFile(`${state}.tmp`, '{}', { mode: 0o600 })
  await deleteState(state)
  assert.deepEqual(await readdir(join(state, '..')), [])
  // A crashed save leaves only the temporary file.
  await writeFile(`${state}.tmp`, '{}', { mode: 0o600 })
  await deleteState(state)
  assert.deepEqual(await readdir(join(state, '..')), [])
})

test('signed in means on the app origin and not signed out', () => {
  assert.equal(isSignedInAt('https://app.example.com/home', { origin: ORIGIN, isSignedOut }), true)
  assert.equal(isSignedInAt('https://app.example.com/login', { origin: ORIGIN, isSignedOut }), false)
  // An identity provider's page is not the app, whatever its path.
  assert.equal(isSignedInAt('https://id.example.net/authorize', { origin: ORIGIN, isSignedOut }), false)
  assert.equal(isSignedInAt('about:blank', { origin: ORIGIN, isSignedOut }), false)
  assert.equal(isSignedInAt('https://app.example.com/x', { origin: ORIGIN, isSignedOut: () => { throw new Error('bad') } }), false)
})

// A sign-in window whose URL follows a script over a clock the test drives.
function signInWindow(urlAt) {
  let clock = 0
  let closed = false
  return {
    page: { url: () => urlAt(clock), isClosed: () => closed },
    now: () => clock,
    sleep: async (ms) => {
      clock += ms
    },
    close: () => (closed = true),
    get clock() {
      return clock
    }
  }
}
const waitFor = (w, extra = {}) =>
  waitUntilSignedIn(w.page, { origin: ORIGIN, isSignedOut, now: w.now, sleep: w.sleep, ...extra })

test('sign-in waits until the app has been signed in for 3 s', async () => {
  const w = signInWindow((t) => (t < 5000 ? `${ORIGIN}/login` : `${ORIGIN}/home`))
  await waitFor(w)
  assert.equal(w.clock, 8000)
})

test('a bounce back to the sign-in page starts the 3 s again', async () => {
  const w = signInWindow((t) => (t < 1000 ? `${ORIGIN}/login` : t < 3000 ? `${ORIGIN}/home` : t < 4000 ? `${ORIGIN}/login` : `${ORIGIN}/home`))
  await waitFor(w)
  assert.equal(w.clock, 7000)
})

test('time on an identity provider does not count as signed in', async () => {
  const w = signInWindow((t) => (t < 6000 ? 'https://id.example.net/authorize' : `${ORIGIN}/home`))
  await waitFor(w)
  assert.equal(w.clock, 9000)
})

// The clock, the sleep and the poll pace each have a default that the tests above replace. This one
// leaves them: signed in from the start, it takes one real poll interval to see the stable time pass.
// isClosed ends a stuck wait with a refusal, where a stuck clock or a sleep that does not sleep would
// hang or spin.
test('with no clock or sleep given, sign-in uses the real ones and polls at its own pace', { timeout: 8000 }, async () => {
  const started = Date.now()
  const page = { url: () => `${ORIGIN}/home`, isClosed: () => Date.now() - started > 2000 }
  await waitUntilSignedIn(page, { origin: ORIGIN, isSignedOut, stableMs: 20 })
  const elapsed = Date.now() - started
  assert.ok(elapsed >= 200 && elapsed < 1500, `${elapsed} ms`)
})

test('sign-in gives up after its timeout, or when the window is closed', async () => {
  const stuck = signInWindow(() => `${ORIGIN}/login`)
  await rejects(waitFor(stuck), /Nobody finished signing in within 10 minutes/)
  assert.equal(stuck.clock, SIGN_IN_TIMEOUT_MS)
  const closed = signInWindow(() => `${ORIGIN}/login`)
  closed.close()
  await rejects(waitFor(closed), /The sign-in window was closed/)
})

// A browser type whose browser, context and page only record what they are asked.
function fakeBrowserType(savedState = { cookies: [], origins: [] }) {
  const calls = []
  const page = {
    goto: async (url) => calls.push(`goto ${url}`),
    waitForLoadState: async () => calls.push('networkidle')
  }
  const context = { newPage: async () => page, storageState: async () => savedState }
  const browser = {
    newContext: async (options) => (calls.push(`context viewport=${options.viewport}`), context),
    close: async () => calls.push('close')
  }
  return { calls, page, browserType: { launch: async (options) => (calls.push(`launch headless=${options.headless}`), browser) } }
}

test('signIn opens a visible browser at the sign-in page, waits for the person, saves the state and closes', async () => {
  const { calls, page, browserType } = fakeBrowserType()
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  const logs = []
  let waited
  await signIn({
    browserType,
    baseUrl: `${ORIGIN}/app`,
    signInPath: '/login',
    isSignedOut,
    statePath: state,
    log: (line) => logs.push(line),
    wait: async (p, options) => (waited = { p, options })
  })
  // viewport null: the person's window fits their screen; only the recording uses 1440x900.
  assert.deepEqual(calls, ['launch headless=false', 'context viewport=null', `goto ${ORIGIN}/app/login`, 'networkidle', 'close'])
  assert.equal(waited.p, page)
  assert.deepEqual(waited.options, { origin: ORIGIN, isSignedOut })
  assert.equal(await mode(state), 0o600)
  assert.match(logs[0], /Sign in there yourself; nothing is typed for you/)
})

test('signIn still saves the session when the page never goes idle', async () => {
  const { calls, page, browserType } = fakeBrowserType()
  page.waitForLoadState = async () => {
    throw new Error('Timeout 30000ms exceeded.')
  }
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  await signIn({ browserType, baseUrl: ORIGIN, signInPath: '/login', isSignedOut, statePath: state, log: () => {}, wait: async () => {} })
  assert.equal(await hasState(state), true)
  assert.equal(calls.at(-1), 'close')
})

test('signIn gives the sign-in page 90 s to load, as a run gives its start page', async () => {
  const { page, browserType } = fakeBrowserType()
  const options = []
  page.goto = async (url, given) => options.push(given)
  const state = join(tempDir('session-'), 'state.json')
  await signIn({ browserType, baseUrl: ORIGIN, signInPath: '/login', isSignedOut, statePath: state, log: () => {}, wait: async () => {} })
  assert.deepEqual(options, [{ timeout: 90_000 }])
})

test('a sign-in page that does not load is a refusal with the first line of why, and the browser is closed', async () => {
  const { calls, page, browserType } = fakeBrowserType()
  page.goto = async () => {
    throw new Error('page.goto: net::ERR_CONNECTION_REFUSED at https://app.example.com/login\nCall log:\n  - navigating to "https://app.example.com/login"')
  }
  const state = join(tempDir('session-'), 'state.json')
  const logs = []
  await assert.rejects(
    signIn({ browserType, baseUrl: ORIGIN, signInPath: '/login', isSignedOut, statePath: state, log: (line) => logs.push(line), wait: async () => {} }),
    (e) =>
      e instanceof CaptureRefusal &&
      e.message === 'The sign-in page did not load (page.goto: net::ERR_CONNECTION_REFUSED at https://app.example.com/login).'
  )
  assert.equal(calls.at(-1), 'close')
  // Nobody is told to sign in at a window that shows nothing.
  assert.deepEqual(logs, [])
  assert.equal(await hasState(state), false)
})

test('signIn closes the browser even when nobody signs in', async () => {
  const { calls, browserType } = fakeBrowserType()
  const state = join(tempDir('session-'), 'state.json')
  await rejects(
    signIn({ browserType, baseUrl: ORIGIN, signInPath: '/login', isSignedOut, statePath: state, log: () => {}, wait: async () => {
      throw new CaptureRefusal('Nobody finished signing in within 10 minutes.')
    } }),
    /Nobody finished/
  )
  assert.equal(calls.at(-1), 'close')
  assert.equal(await hasState(state), false)
})

// The steps runWithSession takes, recorded in order; `results` is what each record() returns.
function sessionSteps({ exists = true, results }) {
  const calls = []
  let n = 0
  return {
    calls,
    deps: {
      stateExists: async () => (calls.push('exists?'), exists),
      promptSignIn: async () => calls.push('sign-in'),
      record: async () => (calls.push('record'), results[n++]),
      dropState: async () => calls.push('drop-state'),
      resetRunDir: async () => calls.push('reset-run-dir'),
      log: (line) => calls.push(`log ${line}`)
    }
  }
}

test('a run with a saved state records once and signs nobody in', async () => {
  const s = sessionSteps({ results: [{ capture: 'ok' }] })
  assert.deepEqual(await runWithSession(s.deps), { capture: 'ok' })
  assert.deepEqual(s.calls, ['exists?', 'record'])
})

test('a run without a saved state signs in first', async () => {
  const s = sessionSteps({ exists: false, results: [{ capture: 'ok' }] })
  await runWithSession(s.deps)
  assert.deepEqual(s.calls, ['exists?', 'sign-in', 'record'])
})

test('signed out once: the state is deleted, the person signs in, and the walk is recorded once more', async () => {
  const s = sessionSteps({ results: [{ signedOut: true }, { capture: 'second' }] })
  assert.deepEqual(await runWithSession(s.deps), { capture: 'second' })
  assert.deepEqual(s.calls, [
    'exists?',
    'record',
    'log Sign-in needed: the saved session is signed out. Opening the sign-in window again.',
    'drop-state',
    'reset-run-dir',
    'sign-in',
    'record'
  ])
})

test('what the guard found in a signed-out attempt is said when the attempt is thrown away, not lost', async () => {
  const violations = ["GET tracker.example.net/a was refused: tracker.example.net is not in this environment's hosts.", 'The walk opened a second tab.']
  const s = sessionSteps({ results: [{ signedOut: true, violations }, { capture: 'second' }] })
  assert.deepEqual(await runWithSession(s.deps), { capture: 'second' })
  assert.equal(
    s.calls[2],
    "log Sign-in needed: the saved session is signed out. Opening the sign-in window again. Its guard also found: GET tracker.example.net/a was refused: tracker.example.net is not in this environment's hosts. The walk opened a second tab."
  )
  // An attempt whose guard found nothing says nothing more.
  const quiet = sessionSteps({ results: [{ signedOut: true, violations: [] }, { capture: 'second' }] })
  await runWithSession(quiet.deps)
  assert.equal(quiet.calls[2], 'log Sign-in needed: the saved session is signed out. Opening the sign-in window again.')
  // The second attempt's findings end the refusal that stops the run.
  const twice = sessionSteps({ results: [{ signedOut: true, violations: [] }, { signedOut: true, violations: ['The walk opened a second tab.'] }] })
  await assert.rejects(
    runWithSession(twice.deps),
    (e) =>
      e instanceof CaptureRefusal &&
      e.message === 'Still signed out after signing in again. Check the account, then run sign-in. Its guard also found: The walk opened a second tab.'
  )
})

test('signed out twice stops the run; there is no loop', async () => {
  const s = sessionSteps({ results: [{ signedOut: true }, { signedOut: true }, { capture: 'never' }] })
  await rejects(runWithSession(s.deps), /Still signed out after signing in again/)
  assert.equal(s.calls.filter((c) => c === 'record').length, 2)
  assert.equal(s.calls.filter((c) => c === 'sign-in').length, 1)
})

test('SignedOut is its own kind of error, so a run can tell it from a walk failure', () => {
  const e = new SignedOut()
  assert.ok(e instanceof Error)
  assert.ok(!(e instanceof CaptureRefusal))
  assert.equal(e.name, 'SignedOut')
  assert.match(e.message, /Sign-in needed: the saved session is signed out/)
})

test('the saved state never reaches a log line or an error message', async () => {
  const SENTINEL = 'sentinel-cookie-value-4f1d9c'
  const saved = { cookies: [{ name: 's', value: SENTINEL }], origins: [] }
  const { browserType } = fakeBrowserType(saved)
  const state = join(tempDir('session-'), 'my-app', 'dev', 'state.json')
  const lines = []
  const messages = []
  const log = (line) => lines.push(String(line))
  const attempt = { browserType, baseUrl: ORIGIN, signInPath: '/login', isSignedOut, statePath: state, log }
  // Sign-in succeeds and saves; the walk is signed out twice, so the run stops with an error.
  await assert.rejects(
    runWithSession({
      stateExists: () => hasState(state),
      promptSignIn: () => signIn({ ...attempt, wait: async () => {} }),
      record: async () => ({ signedOut: true }),
      dropState: () => deleteState(state),
      resetRunDir: async () => {},
      log
    }),
    (e) => (messages.push(e.message), e instanceof CaptureRefusal)
  )
  // Sign-in itself gives up.
  await assert.rejects(
    signIn({ ...attempt, wait: async () => { throw new CaptureRefusal('Nobody finished signing in within 10 minutes.') } }),
    (e) => (messages.push(e.message), e instanceof CaptureRefusal)
  )
  // The sentinel really went through the save, so the absence below means something.
  assert.ok((await readFile(state, 'utf8')).includes(SENTINEL))
  assert.ok(lines.length >= 4 && messages.length === 2)
  for (const text of [...lines, ...messages]) assert.ok(!text.includes(SENTINEL), text)
})
