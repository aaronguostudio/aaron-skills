// End to end (npm run test:e2e): the real CLI drives a headless Chromium through the fixture
// app on 127.0.0.1, and the walkthrough renderer's own validator checks the folder it writes.
// Needs `npm ci` here (Playwright; its Chromium comes from the machine's cache), ffprobe, and
// npx (for bun).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { launchArgs } from '../scripts/cli.mjs'
import { saveState, sessionPaths } from '../scripts/session.mjs'
import { FIXTURE_LOGIN, startFixture } from './fixture/server.mjs'

const TILE = resolve(import.meta.dirname, '..')
const CLI = join(TILE, 'scripts', 'cli.mjs')
const PROJECT = join(TILE, 'test', 'fixture')
const RENDERER = resolve(TILE, '..', 'walkthrough', 'render-walkthrough.ts')

let app
let root

// Async on purpose: the fixture server runs in this process and must keep answering.
function run(command, args, env = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { env: { ...process.env, ...env } })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    const timer = setTimeout(() => child.kill('SIGKILL'), 120_000)
    child.on('error', fail)
    child.on('close', (code) => {
      clearTimeout(timer)
      done({ code, output })
    })
  })
}

const runCapture = (args) =>
  run(process.execPath, [CLI, '--project', PROJECT, ...args], { DEMO_CAPTURE_HOME: root, DEMO_CAPTURE_FIXTURE_URL: app.url })
const renderDryRun = (dir) => run(resolve(TILE, '..', 'remotion/node_modules/.bin/bun'), [RENDERER, dir, '--dry-run'])
// Inside the capture folder, a run folder belongs under the project's runs.
const outDir = (name) => join(root, 'fixture-app', 'runs', name)
// What the fixture received since `before` (a requests().length), as { method, path, body }.
const receivedFrom = (before) => app.requests().slice(before).map(({ method, path, body }) => ({ method, path, body }))
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

// The requests the fixture received since `snapshot` (a hostCounts() snapshot), by Host header. The
// fixture counts what reached it, so this is what got past the browser's own DNS rules. These
// deltas rely on the tests in this file running one at a time (node:test's default within a file).
function receivedSince(snapshot) {
  const seen = {}
  for (const [host, count] of Object.entries(app.hostCounts()))
    if (count > (snapshot[host] ?? 0)) seen[host] = count - (snapshot[host] ?? 0)
  return seen
}

// The redirect walks end their one step when the hop has ended (about 100 ms here), not when the
// wait's 10 s timeout runs out. The guard's verdict wins over the walk's own error, so a timeout
// would not change the capture's failure; it would only show as a slow step, which this catches.
async function assertLeaveEndedOnTheHop(dir) {
  const leave = (await readJson(join(dir, 'steps.json'))).find((step) => step.id === 'leave')
  assert.ok(leave.endMs - leave.startMs < 5000, `the leave step took ${leave.endMs - leave.startMs} ms`)
}

// The renderer's own validator refuses a capture that did not pass: exit 3, and it says why.
async function assertRendererRefuses(dir) {
  const rendered = await renderDryRun(dir)
  assert.equal(rendered.code, 3, rendered.output)
  assert.match(rendered.output, /only a passed walk gets a video/)
}

// The test signs in by itself: a local fixture with test values. A real project's sign-in is
// always done by a person, in the window the engine opens.
async function seedSession() {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${app.url}/login`)
    await page.getByLabel('User').fill(FIXTURE_LOGIN.username)
    await page.getByLabel('Password').fill(FIXTURE_LOGIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`${app.url}/home`)
    await saveState(context, sessionPaths(root, 'fixture-app', 'local').state)
  } finally {
    await browser.close()
  }
}

before(async () => {
  app = await startFixture()
  root = await mkdtemp(join(tmpdir(), 'demo-capture-e2e-'))
  await seedSession()
})

after(async () => {
  await app?.close()
  if (root) await rm(root, { recursive: true, force: true })
})

test('a read-only tour passes on the saved session, re-saves it, and passes the renderer validator', async () => {
  const { dir, state } = sessionPaths(root, 'fixture-app', 'local')
  const savedBefore = (await stat(state)).mtimeMs
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'tour', '--out', outDir('tour')])
  assert.equal(result.code, 0, result.output)
  // The tour's home page had its quirks on: the image its CSP blocks never left the browser, and
  // neither it nor the data: and blob: requests tripped the guard.
  assert.deepEqual(receivedFrom(before).filter((request) => request.path === '/logo.svg'), [])
  assert.match(result.output, /Captured: /)
  const capture = await readJson(join(outDir('tour'), 'capture.json'))
  assert.equal(capture.status, 'passed')
  assert.equal(capture.walk, 'tour')
  assert.equal(capture.env, 'local')
  assert.equal(capture.appRevision, 'fixture-1')
  assert.equal(capture.subtitle, 'Search, open the details, read them')
  assert.deepEqual(capture.viewport, { w: 1440, h: 900 })
  const steps = await readJson(join(outDir('tour'), 'steps.json'))
  assert.deepEqual(steps.map((step) => step.id), ['search', 'open', 'details'])
  assert.equal(steps[1].clicks.length, 1)
  assert.ok((await stat(state)).mtimeMs > savedBefore, 'the session is saved again after the run')
  assert.equal((await stat(state)).mode & 0o777, 0o600)
  assert.equal((await stat(dir)).mode & 0o777, 0o700)
  assert.equal((await stat(outDir('tour'))).mode & 0o777, 0o700)
  assert.equal((await stat(join(outDir('tour'), 'capture.json'))).mode & 0o777, 0o600)
  const rendered = await renderDryRun(outDir('tour'))
  assert.equal(rendered.code, 0, rendered.output)
  const plan = JSON.parse(rendered.output)
  assert.equal(plan.dryRun, true)
  assert.equal(plan.steps, 3)
  assert.ok(capture.sync && Number.isFinite(plan.calibrationMs), 'a real recording must find its declared sync marker')
  await assert.rejects(stat(join(outDir('tour'), 'chapters.txt')), { code: 'ENOENT' }, 'dry-run creates no delivery files')
})

test('a read-only walk that posts fails at that step, and the renderer refuses the folder', async () => {
  const result = await runCapture(['--env', 'local', '--walk', 'posts-while-read-only', '--out', outDir('posts')])
  assert.equal(result.code, 1, result.output)
  assert.match(result.output, /FAILED: .*\n {2}at step "add": POST 127\.0\.0\.1\/items was refused: this walk is read-only\./)
  const capture = await readJson(join(outDir('posts'), 'capture.json'))
  assert.equal(capture.status, 'failed')
  assert.equal(capture.failedStep, 'add')
  assert.equal(capture.failure, 'POST 127.0.0.1/items was refused: this walk is read-only.')
  await assertRendererRefuses(outDir('posts'))
})

test('a read the project lists as writing is refused', async () => {
  const result = await runCapture(['--env', 'local', '--walk', 'forbidden-read', '--out', outDir('recount')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('recount'), 'capture.json'))
  assert.equal(capture.failedStep, 'recount')
  assert.equal(capture.failure, 'GET 127.0.0.1/items was refused: the project lists it as a read that writes.')
})

test('a request to an unlisted host fails the run before the first step', async () => {
  const result = await runCapture(['--env', 'local', '--walk', 'outside-host', '--out', outDir('outside')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('outside'), 'capture.json'))
  assert.equal(capture.failedStep, null)
  assert.equal(capture.failure, "GET localhost/logo.svg was refused: localhost is not in this environment's hosts.")
})

test('--learn-hosts lets the unlisted host through, names it, and never yields a video', async () => {
  const result = await runCapture(['--env', 'local', '--walk', 'outside-host', '--learn-hosts', '--out', outDir('learn')])
  assert.equal(result.code, 0, result.output)
  assert.match(result.output, /Learning run \(no video\): /)
  assert.match(result.output, /Hosts the walk used that are not in environments\.local\.hosts:\n {2}localhost\n/)
  const capture = await readJson(join(outDir('learn'), 'capture.json'))
  assert.equal(capture.status, 'failed')
  assert.equal(capture.failure, 'Learning run, no video.')
  await assertRendererRefuses(outDir('learn'))
})

test('a walk that declares writes may post', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'adds-item', '--out', outDir('adds')])
  assert.equal(result.code, 0, result.output)
  assert.equal((await readJson(join(outDir('adds'), 'capture.json'))).status, 'passed')
  // The post really reached the app.
  assert.deepEqual(receivedFrom(before).filter((request) => request.method === 'POST'), [{ method: 'POST', path: '/items', body: '' }])
})

// The redirect tests. A route handler sees only the first URL of a request, so a hop of a redirect
// is judged from the context's request events, and the browser's own DNS rules (launchArgs) stand
// behind that: the hop is on the wire already when the event fires. The fixture counts requests by
// their Host header, so these tests settle what each layer really does, not what it should do.
//
// Observed here (Chromium 1234 from Playwright 1.62.1, macOS, headless): with the rules on, a
// redirect to localhost or to an IP literal ([::1]) never reaches the server. Neither is exempt
// from `MAP * ~NOTFOUND` (the browser's own error is net::ERR_NAME_NOT_RESOLVED, asserted below
// for the literal), and listing one brings it back: EXCLUDE localhost and EXCLUDE ::1, asserted
// below. That is why a listed IP literal has to be excluded by name. With no rules
// (--learn-hosts) both reach the server.

test('a redirect to an unlisted host fails with the host lock sentence, and never reaches that host', async () => {
  const snapshot = app.hostCounts()
  const result = await runCapture(['--env', 'local', '--walk', 'redirects-to-localhost', '--out', outDir('redirect')])
  assert.equal(result.code, 1, result.output)
  const sentence = "GET localhost/logo.svg was refused: localhost is not in this environment's hosts."
  assert.match(result.output, /FAILED: .*\n {2}at step "leave": GET localhost\/logo\.svg was refused: localhost is not in this environment's hosts\./)
  const capture = await readJson(join(outDir('redirect'), 'capture.json'))
  assert.equal(capture.status, 'failed')
  assert.equal(capture.failedStep, 'leave')
  assert.equal(capture.failure, sentence)
  assert.doesNotMatch(capture.failure, /ERR_|Timeout/)
  await assertLeaveEndedOnTheHop(outDir('redirect'))
  const seen = receivedSince(snapshot)
  assert.ok(seen[`127.0.0.1:${app.port}`] >= 1, 'the link that redirects was reached')
  assert.equal(seen[`localhost:${app.port}`], undefined, `a request with Host localhost reached the server: ${JSON.stringify(seen)}`)
  await assertRendererRefuses(outDir('redirect'))
})

test('--learn-hosts follows the redirect, names localhost, and the request then does reach the server', async () => {
  const snapshot = app.hostCounts()
  const result = await runCapture(['--env', 'local', '--walk', 'redirects-to-localhost', '--learn-hosts', '--out', outDir('redirect-learn')])
  assert.equal(result.code, 0, result.output)
  assert.match(result.output, /Hosts the walk used that are not in environments\.local\.hosts:\n {2}localhost\n/)
  const capture = await readJson(join(outDir('redirect-learn'), 'capture.json'))
  assert.equal(capture.failure, 'Learning run, no video.')
  await assertLeaveEndedOnTheHop(outDir('redirect-learn'))
  // The contrast with the test above: without the rules the same hop gets through.
  assert.ok(receivedSince(snapshot)[`localhost:${app.port}`] >= 1, 'a learning run lets the redirect through')
  await assertRendererRefuses(outDir('redirect-learn'))
})

test('a redirect to an IP literal that is not listed is refused the same way: the rules cover IP literals', async (t) => {
  if (!app.ipv6) return t.skip('this machine does not answer on [::1]')
  const snapshot = app.hostCounts()
  const result = await runCapture(['--env', 'local', '--walk', 'redirects-to-loopback6', '--out', outDir('literal')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('literal'), 'capture.json'))
  assert.equal(capture.failedStep, 'leave')
  assert.equal(capture.failure, "GET [::1]/logo.svg was refused: [::1] is not in this environment's hosts.")
  await assertLeaveEndedOnTheHop(outDir('literal'))
  const seen = receivedSince(snapshot)
  assert.equal(seen[`[::1]:${app.port}`], undefined, `a request with Host [::1] reached the server: ${JSON.stringify(seen)}`)
  const learn = await runCapture(['--env', 'local', '--walk', 'redirects-to-loopback6', '--learn-hosts', '--out', outDir('literal-learn')])
  assert.equal(learn.code, 0, learn.output)
  assert.match(learn.output, /Hosts the walk used that are not in environments\.local\.hosts:\n {2}\[::1\]\n/)
  await assertLeaveEndedOnTheHop(outDir('literal-learn'))
  // The server does answer on [::1]; only the rules kept the first run from it.
  assert.ok(receivedSince(snapshot)[`[::1]:${app.port}`] >= 1, 'a learning run reaches [::1]')
})

// A real browser started with the rules launchArgs writes for `hosts`, sent to `url`: 'loaded', or
// the first line of why it was not.
async function visitWithRules(hosts, url) {
  const browser = await chromium.launch({ args: launchArgs({ hosts, learning: false }) })
  try {
    const page = await browser.newPage()
    const response = await page.goto(url)
    return response?.ok() ? 'loaded' : `status ${response?.status()}`
  } catch (error) {
    return String(error.message).split('\n')[0]
  } finally {
    await browser.close()
  }
}

test('launchArgs excludes a listed IPv6 literal by its bare address, not by its brackets', async (t) => {
  if (!app.ipv6) return t.skip('this machine does not answer on [::1]')
  const url = `http://[::1]:${app.port}/logo.svg`
  assert.equal(await visitWithRules(['[::1]'], url), 'loaded')
  assert.match(await visitWithRules(['127.0.0.1'], url), /net::ERR_NAME_NOT_RESOLVED/)
})

// A dev-server adapter will list localhost: the rules must let that name through, and only when it
// is listed.
test('launchArgs lets a listed localhost through, and an unlisted one stays refused', async () => {
  const snapshot = app.hostCounts()
  assert.equal(await visitWithRules(['localhost'], `http://localhost:${app.port}/`), 'loaded')
  assert.ok(receivedSince(snapshot)[`localhost:${app.port}`] >= 1, 'the listed localhost reached the server')
  const refusedSnapshot = app.hostCounts()
  assert.match(await visitWithRules(['127.0.0.1'], `http://localhost:${app.port}/`), /net::ERR_NAME_NOT_RESOLVED/)
  assert.equal(receivedSince(refusedSnapshot)[`localhost:${app.port}`], undefined)
})

test('readOnlyAllowed lets a listed non-read through, only with a body that matches', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'sends-beacons', '--out', outDir('beacons')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('beacons'), 'capture.json'))
  // The beacon the page posts on load matches the rule, so the run got to its first step.
  assert.equal(capture.failedStep, 'odd')
  // The rule matched the URL, so the refusal names it and says that the body is what did not match.
  assert.equal(capture.failure, 'POST 127.0.0.1/beacon was refused: this walk is read-only (readOnlyAllowed[0] matches this URL but not its body).')
  // The server got the load beacon with its body, and not the odd one.
  assert.deepEqual(receivedFrom(before).filter((request) => request.path === '/beacon'), [
    { method: 'POST', path: '/beacon', body: '{"page":"home"}' }
  ])
  await assertRendererRefuses(outDir('beacons'))
})

test('a body pattern that matches the empty string still refuses a request with no body', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'sends-empty-ping', '--out', outDir('ping')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('ping'), 'capture.json'))
  assert.equal(capture.failedStep, 'ping')
  assert.equal(
    capture.failure,
    'POST 127.0.0.1/ping was refused: this walk is read-only (readOnlyAllowed[1] has a body pattern, and this request has no readable body).'
  )
  assert.deepEqual(receivedFrom(before).filter((request) => request.path === '/ping'), [], 'the ping never reached the server')
})

test('--learn-hosts lists the non-read the config does not allow, and says what to do about it', async () => {
  const result = await runCapture(['--env', 'local', '--walk', 'sends-beacons', '--learn-hosts', '--out', outDir('learn-beacons')])
  assert.equal(result.code, 0, result.output)
  // Listed with what a whole-URL rule has to match, the rule that came close, and none of the body.
  assert.ok(
    result.output.includes(
      `Requests refused because the walk is read-only:\n  POST ${app.url}/beacon (with a body) (readOnlyAllowed[0] matches this URL but not its body)\n`
    ),
    result.output
  )
  assert.doesNotMatch(result.output, /extra/)
  assert.match(result.output, /readOnlyAllowed, once a person approves it\./)
})

// A 307 makes the browser send the same method and body to the new URL before the guard hears of it.
test('a post that a redirect sends on to a URL no rule allows fails the run, and the failure says it was sent', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'sends-redirected-post', '--out', outDir('redirected')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('redirected'), 'capture.json'))
  assert.equal(capture.failedStep, 'redirect')
  assert.equal(capture.failure, 'POST 127.0.0.1/items was sent by a redirect the guard cannot stop: this walk is read-only.')
  // It was sent: the server has the POST, with its body.
  const posts = receivedFrom(before).filter((request) => request.method === 'POST' && request.path !== '/beacon')
  assert.deepEqual(posts, [
    { method: 'POST', path: '/bounce-post', body: '{"page":"home"}' },
    { method: 'POST', path: '/items', body: '{"page":"home"}' }
  ])
})

test('a post that a redirect sends to an unlisted host is refused by the browser, and reaches nothing', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'sends-redirected-post-by-name', '--out', outDir('redirected-by-name')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('redirected-by-name'), 'capture.json'))
  assert.equal(capture.failedStep, 'redirect')
  assert.equal(capture.failure, "POST localhost/items was refused: localhost is not in this environment's hosts.")
  assert.deepEqual(app.requests().slice(before).filter((request) => request.host.startsWith('localhost')), [])
})

test('--learn-hosts lists the host a redirected post reached as unlisted, not refused, and fails the run', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'sends-redirected-post-by-name', '--learn-hosts', '--out', outDir('redirected-learn')])
  assert.equal(result.code, 1, result.output)
  assert.match(result.output, /Hosts the walk used that are not in environments\.local\.hosts:\n {2}localhost\n/)
  assert.doesNotMatch(result.output, /Requests refused/)
  assert.match(
    result.output,
    /The walk stopped early, so these lists may be incomplete: POST localhost\/items was sent by a redirect the guard cannot stop: localhost is not in this environment's hosts\./
  )
  // It was sent for real, with its body: the learning run could not stop it.
  const reached = app.requests().slice(before).filter((request) => request.host.startsWith('localhost'))
  assert.deepEqual(reached.map(({ method, path, body }) => ({ method, path, body })), [{ method: 'POST', path: '/items', body: '{"page":"home"}' }])
})

// A shared worker's requests reach neither the route guard nor the request events (the final review
// proved a POST from one got through), so the engine blocks shared workers in every page.
test('a page that starts a shared worker fails the run, and the worker neither starts nor sends anything', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'starts-shared-worker', '--out', outDir('shared')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('shared'), 'capture.json'))
  assert.equal(capture.failedStep, 'share')
  assert.equal(capture.failure, 'The page started a shared worker, whose requests the guard cannot see.')
  const received = receivedFrom(before)
  assert.deepEqual(received.filter((request) => request.method === 'POST' && request.path === '/items'), [])
  assert.deepEqual(received.filter((request) => request.path === '/shared-worker.js'), [])
  await assertRendererRefuses(outDir('shared'))
})

// A walk's own page.route runs before the engine's context.route. The guard cannot stop what such a
// route sends, but it hears that a request it never judged finished, and the run fails.
test('a walk that answers its own route fails the run, which says the request went out without the guard', async () => {
  const before = app.requests().length
  const result = await runCapture(['--env', 'local', '--walk', 'answers-its-own-route', '--out', outDir('own-route')])
  assert.equal(result.code, 1, result.output)
  const capture = await readJson(join(outDir('own-route'), 'capture.json'))
  assert.equal(capture.failedStep, 'post')
  assert.equal(capture.failure, 'A request went out without the guard: the walk handled it with its own route (POST 127.0.0.1/items).')
  // It did go out: this is a tripwire, not a block.
  assert.deepEqual(receivedFrom(before).filter((request) => request.method === 'POST'), [{ method: 'POST', path: '/items', body: '' }])
})
