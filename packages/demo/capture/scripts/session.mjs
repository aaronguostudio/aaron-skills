// A project's signed-in browser state: where it lives, how a person signs in, and how a run
// reuses it, re-saves it and recovers when it is signed out. The state is Playwright's
// storageState. It never enters a repo or a run folder, and it is never printed.
import { chmod, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { CaptureRefusal } from './guards.mjs'

export const SIGN_IN_TIMEOUT_MS = 10 * 60_000
// Signed in means: on the app's own origin, and isSignedOut has said false for this long. A
// redirect chain passes through signed-in-looking URLs for a moment.
export const SIGNED_IN_STABLE_MS = 3000
// How long the sign-in page may take to load: a freshly deployed app can be slow to answer its
// first request after a cold start, and a recording gives its start page as long.
export const SIGN_IN_PAGE_TIMEOUT_MS = 90_000

export class SignedOut extends Error {
  constructor() {
    super('Sign-in needed: the saved session is signed out.')
    this.name = 'SignedOut'
  }
}

// ~/.demo-capture, or DEMO_CAPTURE_HOME when a test points it at a temporary folder.
export function captureRoot({ env = process.env, home = homedir() } = {}) {
  return env.DEMO_CAPTURE_HOME ? resolve(env.DEMO_CAPTURE_HOME) : join(home, '.demo-capture')
}

export function sessionPaths(root, name, envName) {
  const dir = join(root, name, envName)
  return { dir, state: join(dir, 'state.json'), lock: join(dir, 'lock') }
}

const pad = (n) => String(n).padStart(2, '0')

export function defaultRunDir(root, name, walk, now = new Date()) {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return join(root, name, 'runs', `${date}-${time}-${walk}`)
}

// mkdir's mode is masked by the umask and ignored for a folder that exists, so chmod as well.
export async function ensurePrivateDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmod(dir, 0o700)
}

export async function hasState(statePath) {
  try {
    return (await stat(statePath)).isFile()
  } catch {
    return false
  }
}

// The temporary file has one fixed name (the run lock allows a single writer), so a leftover
// from a crashed save is replaced by the next save and removed by deleteState. It holds live
// cookies, so it is never kept under a name nobody will look for.
const tempPathOf = (statePath) => `${statePath}.tmp`

// Written to a private temporary file, then renamed: the state is never readable by others,
// not even for a moment, and a crashed process never leaves half a file. There is no fsync
// before the rename, so a power loss can still lose the new state; the next run signs in again.
export async function saveState(context, statePath) {
  await ensurePrivateDir(dirname(statePath))
  const state = await context.storageState({ indexedDB: true })
  const temp = tempPathOf(statePath)
  // writeFile's mode applies only when it creates the file, so start from no file at all.
  await rm(temp, { force: true })
  await writeFile(temp, JSON.stringify(state), { mode: 0o600 })
  await chmod(temp, 0o600)
  await rename(temp, statePath)
}

export async function deleteState(statePath) {
  await rm(tempPathOf(statePath), { force: true })
  await rm(statePath, { force: true })
}

export function isSignedInAt(url, { origin, isSignedOut }) {
  try {
    return new URL(url).origin === origin && !isSignedOut(url)
  } catch {
    return false
  }
}

// Polls the sign-in window until the person is signed in (see SIGNED_IN_STABLE_MS).
export async function waitUntilSignedIn(
  page,
  {
    origin,
    isSignedOut,
    timeoutMs = SIGN_IN_TIMEOUT_MS,
    stableMs = SIGNED_IN_STABLE_MS,
    pollMs = 250,
    now = Date.now,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms))
  }
) {
  const deadline = now() + timeoutMs
  let since = null
  for (;;) {
    if (page.isClosed())
      throw new CaptureRefusal('The sign-in window was closed before signing in finished. Run sign-in again.')
    const at = now()
    if (isSignedInAt(page.url(), { origin, isSignedOut })) {
      since ??= at
      if (at - since >= stableMs) return
    } else {
      since = null
    }
    if (at >= deadline)
      throw new CaptureRefusal(
        `Nobody finished signing in within ${Math.round(timeoutMs / 60_000)} minutes. Run sign-in again when you are ready.`
      )
    await sleep(pollMs)
  }
}

// A visible browser at the sign-in page; the person signs in. Nothing is typed for them.
export async function signIn({ browserType, baseUrl, signInPath, isSignedOut, statePath, log = console.log, wait = waitUntilSignedIn }) {
  const browser = await browserType.launch({ headless: false })
  try {
    const context = await browser.newContext({ viewport: null })
    const page = await context.newPage()
    try {
      await page.goto(`${baseUrl}${signInPath}`, { timeout: SIGN_IN_PAGE_TIMEOUT_MS })
    } catch (error) {
      throw new CaptureRefusal(`The sign-in page did not load (${String(error?.message ?? error).split('\n')[0]}).`)
    }
    log(
      `A browser window is open at ${baseUrl}${signInPath}. Sign in there yourself; nothing is typed for you. Waiting up to ${SIGN_IN_TIMEOUT_MS / 60_000} minutes.`
    )
    await wait(page, { origin: new URL(baseUrl).origin, isSignedOut })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await saveState(context, statePath)
    log('Signed in. The session is saved for the next runs.')
  } finally {
    await browser.close()
  }
}

// A signed-out attempt is thrown away, and with it what its guard found ({ signedOut, violations },
// as record() returns it): that is said rather than lost.
const alsoFound = ({ violations = [] }) => (violations.length ? ` Its guard also found: ${violations.join(' ')}` : '')

// One run: sign in first when there is no state; record; when the recording found the session
// signed out, delete the state, start the run folder afresh, sign in and record once more. A
// second signed-out stops. There is no loop.
export async function runWithSession({ stateExists, promptSignIn, record, dropState, resetRunDir, log = console.log }) {
  if (!(await stateExists())) await promptSignIn()
  const first = await record()
  if (!first.signedOut) return first
  log(`Sign-in needed: the saved session is signed out. Opening the sign-in window again.${alsoFound(first)}`)
  await dropState()
  await resetRunDir()
  await promptSignIn()
  const second = await record()
  if (second.signedOut)
    throw new CaptureRefusal(`Still signed out after signing in again. Check the account, then run sign-in.${alsoFound(second)}`)
  return second
}
