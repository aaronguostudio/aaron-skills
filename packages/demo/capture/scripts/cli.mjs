// demo-capture: record a scripted walkthrough of a web app into a capture folder (contract 1) for
// the walkthrough renderer in ../walkthrough. A project joins with demo-capture/config.mjs and
// demo-capture/walks/*.mjs; nothing app-specific lives in this tile. A presentation tool, not a
// test: a walk that breaks yields status "failed", and the renderer makes no video from it.
//
//   node scripts/cli.mjs --project <dir> --list
//   node scripts/cli.mjs sign-in --project <dir> --env <name>
//   node scripts/cli.mjs --project <dir> --env <name> --walk <name>
//
// Exit codes: 0 captured (or a learning run that reached its end), 1 the walk failed, 2 refused.
import { existsSync, realpathSync, rmSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, rmdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CaptureRefusal,
  RunGuard,
  acquireRunLock,
  assertLearnable,
  assertOutsideRepos,
  assertProdGoAhead,
  assertWriteGoAhead,
  parseArgs,
  parseHostEntry,
  usageText
} from './guards.mjs'
import {
  appRevision,
  describeProject,
  loadConfig,
  loadWalk,
  loadWalks,
  resolveParams,
  selectEnvironment
} from './project.mjs'
import { Recorder, VIEWPORT } from './recorder.mjs'
import { checks } from './checks.mjs'
import {
  SignedOut,
  captureRoot,
  defaultRunDir,
  deleteState,
  ensurePrivateDir,
  hasState,
  runWithSession,
  saveState,
  sessionPaths,
  signIn
} from './session.mjs'

const TILE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const LEARNING_FAILURE = 'Learning run, no video.'
const SECOND_TAB = 'The walk opened a second tab, and a capture records one tab.'
// What to do about it, which depends on whether the config already keeps links in one tab.
const SECOND_TAB_FIX = 'Set sameTabLinks: true in the config if the app opens links in new tabs.'
const SECOND_TAB_SAME_TAB_LINKS =
  'sameTabLinks is set, so something it does not cover opened the tab (a form with a target, or a click with a modifier key); change the walk so it stays in one tab.'
const SHARED_WORKER = 'The page started a shared worker, whose requests the guard cannot see.'
const SHARED_WORKER_BINDING = '__demoCaptureSharedWorker'
const UNREADABLE_STATE = 'The saved session could not be read; run sign-in again.'

const NO_VIDEO_FAILURE = 'The recording was not saved.'

// Every http(s) or ws(s) URL in a line, cut down to scheme, host and path: the query, the fragment
// and the userinfo can hold tokens and ids. A URL that cannot be read is dropped entirely.
const URL_IN_TEXT = /(?:https?|wss?):\/\/[^\s'"<>]+/gi
function withoutUrlSecrets(text) {
  return text.replace(URL_IN_TEXT, (found) => {
    try {
      const url = new URL(found)
      return `${url.protocol}//${url.host}${url.pathname}`
    } catch {
      return `${found.slice(0, found.indexOf('://') + 3)}(unreadable URL)`
    }
  })
}

// An error as one line for the screen and for capture.json: its first line, without URL secrets.
// Cut to length last, so the limit applies to what is shown and no URL is cut in half before it is
// cut down.
const plain = (error) =>
  withoutUrlSecrets(String(error?.message ?? error).split('\n')[0])
    .replace(/\s+/g, ' ')
    .slice(0, 300)

// `path` with its symlinks resolved as far as it exists (the rest is appended as written), so two
// spellings of one folder compare equal even when the folder is not made yet.
function realPathOf(path) {
  const missing = []
  let probe = resolve(path)
  while (!existsSync(probe) && dirname(probe) !== probe) {
    missing.unshift(basename(probe))
    probe = dirname(probe)
  }
  return join(realpathSync(probe), ...missing)
}

// Whether `inner` is `outer` or somewhere under it.
function isWithin(outer, inner) {
  const path = relative(outer, inner) // '' when they are the same folder
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

// Whether this module is the script node was asked to run. Node resolves the main module through
// symlinks but leaves process.argv[1] as typed, so both are resolved before comparing.
export function isEntryPoint(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl))
  } catch {
    return false
  }
}

// Loaded only when a browser is needed, so --list and every refusal work before `npm ci`. The
// first line of the import error says what is wrong (a missing package, a broken install).
export async function loadChromium(importPlaywright = () => import('playwright')) {
  try {
    return (await importPlaywright()).chromium
  } catch (error) {
    throw new CaptureRefusal(`The engine's dependency is missing: run npm ci in ${TILE} (${plain(error)})`)
  }
}

const BROWSERS_FROM_CACHE = "Run the demo-tools macOS installer to install this Playwright version's Chromium."

// chromium.launch, where a browser that will not start is a refusal (exit 2) with one plain
// sentence, not a stack trace: the first line of why, and what not to do about it.
async function launchBrowser(chromium, options) {
  try {
    return await chromium.launch(options)
  } catch (error) {
    throw new CaptureRefusal(`The browser did not start (${plain(error)}). ${BROWSERS_FROM_CACHE}`)
  }
}

// The browser's own DNS rules: while recording, no name resolves except the environment's hosts.
// This is the backstop behind the route guard, for what the route handler never sees: the hops of
// a redirect, the sockets of workers (no test exercises the workers), and requests the browser
// makes outside any page's network, such as a favicon. A shared worker's requests are among those,
// and its fetches are not judged by method at all, so record() blocks shared workers outright (see
// blockSharedWorkers). The route guard stays the first line of defence, and the only one that
// judges a request by its method as well as its host.
// Observed in test/capture.e2e.mjs (Chromium 1234 from Playwright 1.62.1, macOS): neither localhost
// nor an IP literal is exempt from `MAP * ~NOTFOUND`. With the rules on, a redirect to localhost or
// to [::1] never reaches the server, and listing one brings it back (EXCLUDE localhost, EXCLUDE
// ::1). That is why every listed host, an IP literal included, is excluded from the rule, and why
// an IPv6 literal is excluded by its bare address. A manual probe also showed that EXCLUDE [::1]
// does not work.
// A learning run (--learn-hosts) must let unlisted hosts load, to list them, so it gets no rules.
// The names are the entries without their port, each once, in the order first listed. An entry is
// read by the guard's own parser, so what the guard lists is what the browser can resolve.
export function launchArgs({ hosts, learning }) {
  if (learning) return []
  const names = new Set()
  for (const entry of hosts) {
    const parsed = parseHostEntry(entry)
    // The entry is not repeated: a rule built from a bad one could say anything.
    if (!parsed) throw new CaptureRefusal('The environment lists a host that is not a host name, so no browser was started.')
    names.add(parsed.host.replace(/^\[(.*)\]$/, '$1'))
  }
  return [`--host-resolver-rules=${['MAP * ~NOTFOUND', ...[...names].map((name) => `EXCLUDE ${name}`)].join(' , ')}`]
}

// Runs in every page while recording when the config sets sameTabLinks: a link that would open a
// new tab (window.open, or a link with a target) opens in this tab instead.
function sameTabLinks() {
  window.open = function open(url) {
    if (url !== undefined && url !== null && String(url) !== '')
      window.location.assign(new URL(String(url), window.location.href).href)
    return window
  }
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[target]') : null
      if (link && link.target !== '_self') link.target = '_self'
    },
    true
  )
}

// Runs in every page and frame, before the page's own scripts: `new SharedWorker()` throws, and
// tells the engine through its binding. Playwright's routes and request events never see a shared
// worker's requests, so neither the host lock nor read-only could judge them (dedicated workers,
// sendBeacon and keepalive fetches are routed like any other request). A page that catches the
// error has still tried, so the run fails all the same.
function blockSharedWorkers() {
  const report = window.__demoCaptureSharedWorker
  Object.defineProperty(window, 'SharedWorker', {
    configurable: true,
    writable: true,
    value: function SharedWorker() {
      report?.()
      throw new DOMException('Shared workers are blocked while recording.', 'SecurityError')
    }
  })
}

// The saved session, read and parsed here: a file that is not JSON is a refusal that shows none of
// it (Playwright's own error would quote a piece of the file).
async function readSavedState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'))
  } catch {
    throw new CaptureRefusal(UNREADABLE_STATE)
  }
}

// Whether `url` is not on `origin`; a URL that cannot be read is not on it either.
function offOrigin(url, origin) {
  try {
    return new URL(url).origin !== origin
  } catch {
    return true
  }
}

// Records one walk. Returns { capture, learned } once capture.json and steps.json are written.
// When the session turned out to be signed out it returns { signedOut: true, violations } instead,
// with the reasons of what the guard found in that attempt: no capture.json, steps.json or video is
// written, and the session is not saved again (the caller deletes it, says the violations, and
// starts the run folder afresh); screenshots of steps that ran may still be in the run folder until
// then. Signed out means, at the start page and after setup, a page off the app's origin or one
// isSignedOut calls signed out, and before each step, one isSignedOut calls signed out. A saved
// session that cannot be read and a browser that will not start are CaptureRefusals.
export async function record({ chromium, config, env, walk, params, runDir, statePath, learnHosts, headed, log = console.log }) {
  let rec = null
  let signedOut = false
  let capture = null
  // The guard comes first: a policy it refuses leaves no temporary folder and no browser behind.
  const guard = new RunGuard(
    {
      hosts: env.hosts,
      readOnly: !walk.writes,
      forbidden: config.readOnlyForbidden ?? [],
      allowed: config.readOnlyAllowed ?? [],
      learning: learnHosts
    },
    { currentStep: () => rec?.attempting ?? null }
  )
  const storageState = await readSavedState(statePath)
  const videoDir = await mkdtemp(join(tmpdir(), 'demo-capture-video-'))
  await ensurePrivateDir(videoDir)
  // The recording is raw screens: a process that exits in the middle of the run removes it too.
  const removeVideoDir = () => rmSync(videoDir, { recursive: true, force: true })
  process.on('exit', removeVideoDir)
  let browser = null
  try {
    browser = await launchBrowser(chromium, {
      headless: !headed,
      args: launchArgs({ hosts: env.hosts, learning: learnHosts })
    })
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: videoDir, size: VIEWPORT },
      storageState,
      acceptDownloads: true,
      // A service worker's own fetches would bypass the network guard.
      serviceWorkers: 'block'
    })
    await context.route(() => true, (route) => guard.handleRoute(route))
    await context.routeWebSocket(() => true, (ws) => guard.handleWebSocket(ws))
    // A route handler sees the first URL of a request, never the hops of a redirect.
    context.on('request', (request) => {
      if (request.redirectedFrom()) guard.handleRedirectHop(request)
    })
    // A request the route handler never saw, because a walk answered its own route, still finishes.
    context.on('requestfinished', (request) => guard.handleFinished(request))
    await context.exposeBinding(SHARED_WORKER_BINDING, () => guard.fail(SHARED_WORKER))
    await context.addInitScript(blockSharedWorkers)
    if (config.sameTabLinks) await context.addInitScript(sameTabLinks)
    const page = await context.newPage()
    context.on('page', (other) => {
      if (other === page) return
      guard.fail(`${SECOND_TAB} ${config.sameTabLinks ? SECOND_TAB_SAME_TAB_LINKS : SECOND_TAB_FIX}`)
      other.close().catch(() => undefined)
    })
    // Playwright dismisses dialogs by default, and a dismissed "leave this page?" keeps the walk
    // where it is. A capture always means to go on. A walk that listens for dialogs itself answers
    // them: a dialog answered twice fails in Playwright ("already handled").
    page.on('dialog', (dialog) => {
      if (page.listenerCount('dialog') > 1) return
      ;(dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()).catch(() => undefined)
    })
    rec = new Recorder({ page, runDir })
    rec.start() // Playwright's video starts with the page.
    const manifest = {
      walk: walk.name,
      env: env.name,
      title: walk.title,
      ...(walk.description ? { subtitle: walk.description } : {}),
      appRevision: 'unknown',
      startedAt: new Date().toISOString(),
      viewport: { w: VIEWPORT.width, h: VIEWPORT.height }
    }
    let outcome = { status: 'passed' }
    // At the start, a page off the app's origin is signed out too: an identity provider's page can
    // have a path that isSignedOut does not recognise. Before a step, the walk may be elsewhere.
    const appOrigin = new URL(env.baseUrl).origin
    const assertSignedIn = ({ atStart = false } = {}) => {
      const url = page.url()
      if ((atStart && offOrigin(url, appOrigin)) || config.isSignedOut(url)) throw new SignedOut()
    }
    try {
      // A freshly deployed app can take a while to answer its first request after a cold start.
      await page.goto(`${env.baseUrl}${walk.startPath}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForLoadState('networkidle').catch(() => undefined)
      guard.assertClean()
      assertSignedIn({ atStart: true })
      manifest.appRevision = await appRevision(config, env.baseUrl)
      if (config.setup) await config.setup({ page, params, baseUrl: env.baseUrl })
      guard.assertClean()
      assertSignedIn({ atStart: true })
      // Calibrate after real navigation: Chromium may omit all about:blank/setContent
      // preroll from the recording. An overlay on the loaded app is present in the video.
      await page.evaluate(() => {
        const marker = document.createElement('div')
        marker.id = '__aaron_demo_sync__'
        marker.setAttribute('aria-hidden', 'true')
        marker.style.cssText = 'all:initial;display:block!important;position:fixed!important;inset:0!important;background:#000!important;z-index:2147483647!important;pointer-events:none!important'
        document.documentElement.appendChild(marker)
      })
      await page.waitForTimeout(700)
      const before = rec.ms()
      await page.evaluate(() => {
        const marker = document.getElementById('__aaron_demo_sync__')
        if (!marker) throw new Error('The application navigated during recording calibration')
        marker.style.setProperty('background', '#fff', 'important')
      })
      manifest.sync = { tMs: Math.round((before + rec.ms()) / 2) }
      await page.waitForTimeout(300)
      await page.evaluate(() => document.getElementById('__aaron_demo_sync__')?.remove())
      guard.assertClean()
      rec.onBeforeStep(async (stepId) => {
        guard.assertClean()
        assertSignedIn()
        if (config.beforeStep) await config.beforeStep({ page, params, stepId })
      })
      await walk.run({ page, rec, checks, params, baseUrl: env.baseUrl })
      guard.assertClean()
      if (learnHosts) outcome = { status: 'failed', failedStep: null, failure: LEARNING_FAILURE }
    } catch (error) {
      signedOut = error instanceof SignedOut
      // A violation the guard already holds is the cause, and what the walk threw after it (a
      // navigation that could not resolve, a timeout waiting for a second tab) is only the effect.
      // Its reason names no URL query, and the first one is the one that started it.
      const violation = signedOut ? undefined : guard.violations[0]
      outcome = violation
        ? { status: 'failed', failedStep: violation.step, failure: violation.reason }
        : { status: 'failed', failedStep: error?.step ?? rec.attempting ?? null, failure: plain(error) }
    } finally {
      // Tokens can rotate on use, so the state is saved again whatever the outcome, unless the
      // run found it signed out (that state is deleted). A failed save is said without its cause:
      // the error could carry a piece of the state.
      if (!signedOut)
        await saveState(context, statePath).catch(() =>
          log('Could not save the session again; the next run may ask you to sign in.')
        )
      const video = page.video()
      await context.close()
      if (video && !signedOut) await video.saveAs(join(runDir, 'video.webm')).catch(() => undefined)
    }
    if (!signedOut) {
      // The walk's last check came before the session was saved and the context closed, and a
      // request can still be judged then: a violation found since fails the capture, and stops a
      // learning run as much as one found during the walk.
      const late = guard.violations[0]
      if (late && (outcome.status === 'passed' || outcome.failure === LEARNING_FAILURE))
        outcome = { status: 'failed', failedStep: late.step, failure: late.reason }
      // A capture never says passed without its video, whatever went wrong with saving it.
      if (outcome.status === 'passed' && !existsSync(join(runDir, 'video.webm')))
        outcome = { status: 'failed', failedStep: null, failure: NO_VIDEO_FAILURE }
      capture = await rec.finish(manifest, outcome)
    }
  } finally {
    try {
      await browser?.close()
    } finally {
      process.off('exit', removeVideoDir)
      await rm(videoDir, { recursive: true, force: true })
    }
  }
  return signedOut
    ? { signedOut: true, violations: guard.violations.map((violation) => violation.reason) }
    : { capture, learned: guard.learned() }
}

function report({ capture, learned }, { runDir, env, learnHosts, log }) {
  if (learnHosts) {
    const complete = capture.failure === LEARNING_FAILURE
    log(`\nLearning run (no video): ${runDir}`)
    if (learned.unlisted.length)
      log(`Hosts the walk used that are not in environments.${env.name}.hosts:\n${learned.unlisted.map((h) => `  ${h}`).join('\n')}`)
    else log(`Every host the walk used is already in environments.${env.name}.hosts.`)
    if (learned.refused.length)
      log(
        `Requests refused because the walk is read-only:\n${learned.refused.map((r) => `  ${r}`).join('\n')}\n` +
          'A non-read that changes no data may go in readOnlyAllowed, once a person approves it. ' +
          'A read listed in readOnlyForbidden stays refused.'
      )
    log('Add a host to the config only after a person approves it.')
    if (!complete) log(`The walk stopped early, so these lists may be incomplete: ${capture.failure}`)
    return complete ? 0 : 1
  }
  if (capture.status === 'passed') {
    log(`\nCaptured: ${runDir}`)
    log('First-pass caption/highlight fixes reuse this capture: aaron-demo inspect <run>, then revise + render. Recapture only when UI evidence/actions must change.')
    return 0
  }
  log(`\nFAILED: ${runDir}`)
  // Only the recording was lost, so there is no place in the walk to name.
  if (capture.failure === NO_VIDEO_FAILURE) log(`  ${capture.failure}`)
  else log(`  ${capture.failedStep ? `at step "${capture.failedStep}"` : 'before the first step'}: ${capture.failure}`)
  log('  No video should be made from this capture.')
  return 1
}

// Returns the exit code. `chromium` stands in for Playwright's chromium (the tests hand in a fake
// one); the command line never sets it, and without it Playwright is loaded when a browser is needed.
export async function main(
  argv = process.argv.slice(2),
  { root = captureRoot(), log = console.log, error = console.error, chromium: injected } = {}
) {
  process.umask(0o077)
  let args
  try {
    args = parseArgs(argv)
  } catch (refusal) {
    if (!(refusal instanceof CaptureRefusal)) throw refusal
    error(`demo-capture: ${refusal.message}\n\n${usageText()}`)
    return 2
  }
  if (args.command === 'help') {
    log(usageText())
    return 0
  }
  try {
    const project = resolve(args.project ?? process.cwd())
    const config = await loadConfig(project)
    if (args.command === 'list') {
      log(describeProject(config, await loadWalks(project)))
      return 0
    }
    const env = selectEnvironment(config, args.env)
    const session = sessionPaths(root, config.name, env.name)
    assertOutsideRepos(session.dir, 'The session folder')
    const signInWith = (chromium) => () =>
      signIn({
        // The same refusal when the sign-in window cannot open; its launch options are signIn's own.
        browserType: { launch: (options) => launchBrowser(chromium, options) },
        baseUrl: env.baseUrl,
        signInPath: config.signInPath,
        isSignedOut: config.isSignedOut,
        statePath: session.state,
        log
      })
    if (args.command === 'sign-in') {
      const chromium = injected ?? (await loadChromium())
      await ensurePrivateDir(session.dir)
      const release = await acquireRunLock(session.lock)
      try {
        await signInWith(chromium)()
      } finally {
        await release()
      }
      return 0
    }
    const walk = await loadWalk(project, args.walk)
    const params = resolveParams(config.params, args.set)
    // A learning run that is refused anyway is refused first, so nobody is asked for a go-ahead for it.
    if (args.learnHosts) assertLearnable(env, walk)
    assertProdGoAhead(env, args.prodGoAhead)
    assertWriteGoAhead(env, walk, args.writeGoAhead)
    const runDir = resolve(args.out ?? defaultRunDir(root, config.name, walk.name))
    assertOutsideRepos(runDir, 'The run folder')
    // Recovering from a signed-out run empties the run folder, so it must never hold the session.
    const [runPath, sessionPath] = [realPathOf(runDir), realPathOf(session.dir)]
    if (isWithin(runPath, sessionPath) || isWithin(sessionPath, runPath))
      throw new CaptureRefusal(`The run folder ${runDir} overlaps the session folder ${session.dir}; pick another --out`)
    // Anywhere else in the capture folder, a run folder could be another environment's session
    // folder or another project's, so there it belongs under this project's runs.
    const runsDir = join(root, config.name, 'runs')
    if (isWithin(realPathOf(root), runPath) && !isWithin(realPathOf(runsDir), runPath))
      throw new CaptureRefusal(
        `The run folder ${runDir} is in the capture folder ${root}, where a run folder belongs under ${runsDir}; pick another --out`
      )
    if (existsSync(runDir)) {
      if (!(await stat(runDir)).isDirectory()) throw new CaptureRefusal(`${runDir} is a file, not a folder; pick another --out`)
      if ((await readdir(runDir)).length) throw new CaptureRefusal(`${runDir} is not empty; pick another --out`)
    }
    const chromium = injected ?? (await loadChromium())
    await ensurePrivateDir(session.dir)
    const release = await acquireRunLock(session.lock)
    // The first folder mkdir made, or undefined when the run folder was there already.
    let made
    try {
      made = await mkdir(runDir, { recursive: true })
      await ensurePrivateDir(runDir)
      // Said at once, so that a run that dies later still says where its folder is.
      log(`Run folder: ${runDir}`)
      if (env.production) log(`Production run on ${env.baseUrl}, with the go-ahead given for this run.`)
      const result = await runWithSession({
        stateExists: () => hasState(session.state),
        promptSignIn: signInWith(chromium),
        record: () =>
          record({
            chromium,
            config,
            env,
            walk,
            params,
            runDir,
            statePath: session.state,
            learnHosts: args.learnHosts,
            headed: args.headed,
            log
          }),
        dropState: () => deleteState(session.state),
        resetRunDir: async () => {
          await rm(runDir, { recursive: true, force: true })
          await mkdir(runDir, { recursive: true })
          await ensurePrivateDir(runDir)
        },
        log
      })
      return report(result, { runDir, env, learnHosts: args.learnHosts, log })
    } catch (refusal) {
      // A refusal (a sign-in that did not finish, a browser that did not start) leaves nothing in
      // the run folder: a folder this run made goes too, while it is empty.
      if (refusal instanceof CaptureRefusal && made !== undefined) await rmdir(runDir).catch(() => undefined)
      throw refusal
    } finally {
      await release()
    }
  } catch (refusal) {
    if (!(refusal instanceof CaptureRefusal)) throw refusal
    error(`demo-capture: ${refusal.message}`)
    return 2
  }
}

if (isEntryPoint(import.meta.url)) process.exit(await main())
