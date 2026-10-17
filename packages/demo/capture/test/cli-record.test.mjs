// record() against a browser that is only a record of what it was asked to do: no Playwright, so
// these run wherever Node does. They cover what an end-to-end run cannot make happen (a recording
// that is not saved, a session that cannot be saved, a browser that will not start) and how the
// run is wired to the network guard.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { CaptureRefusal } from '../scripts/guards.mjs'
import { sessionPaths } from '../scripts/session.mjs'
import { LEARNING_FAILURE, main, record } from '../scripts/cli.mjs'

// Point the OS's preferred temp variable at this file's own directory, so cleanup
// assertions observe only this file. Windows checks TEMP before TMPDIR.
const TMP_KEY = process.platform === 'win32' ? 'TEMP' : 'TMPDIR'
const SAVED_TMPDIR = process.env[TMP_KEY]
const TMP = mkdtempSync(join(tmpdir(), 'demo-capture-record-tmp-'))
process.env[TMP_KEY] = TMP
// Every folder these tests make is under TMP, so removing it removes them all.
after(() => {
  if (SAVED_TMPDIR === undefined) delete process.env[TMP_KEY]
  else process.env[TMP_KEY] = SAVED_TMPDIR
  rmSync(TMP, { recursive: true, force: true })
})
const videoFolders = () => readdirSync(TMP).filter((name) => name.startsWith('demo-capture-video-'))

const CACHE_SENTENCE = "Run the Demo bundle installer to install this Playwright version's Chromium."

// A fake Playwright chromium. What it was asked is kept on the returned object.
//   videoSaved   false: video.saveAs writes nothing; 'throws': it rejects
//   stateError   what context.storageState rejects with
//   launchError  what chromium.launch rejects with
// A test can also set fake.duringGoto, fake.duringState and fake.duringClose (async functions) to make
// something happen while the page navigates, the session is saved, or the context closes. What the
// run installed on the context is kept: the context.route handler (fake.routeHandler; fakeRoute()
// makes a route for it), the context.routeWebSocket handler (fake.wsHandler), the handler of each
// context event (fake.handlers), the bindings (fake.bindings) and the init scripts (fake.initScripts).
// fake.order lists the context's calls in order. The page keeps its listeners: fake.emit(event, value)
// calls them, and page.listenerCount answers as Playwright's does.
function fakeChromium({ videoSaved = true, stateError, launchError } = {}) {
  const fake = {
    launches: [],
    handlers: {},
    bindings: {},
    initScripts: [],
    order: [],
    contexts: 0,
    stateSaves: 0,
    videoSaves: 0,
    browserClosed: false,
    url: 'about:blank'
  }
  const video = {
    async saveAs(path) {
      fake.videoSaves++
      if (videoSaved === 'throws') throw new Error('The video was not finished.')
      if (videoSaved) writeFileSync(path, 'video')
    }
  }
  const listeners = {}
  fake.emit = (event, value) => {
    for (const listener of [...(listeners[event] ?? [])]) listener(value)
  }
  const page = {
    on(event, listener) {
      ;(listeners[event] ??= []).push(listener)
      return page
    },
    listenerCount: (event) => (listeners[event] ?? []).length,
    async setContent() {},
    async waitForTimeout() {},
    async evaluate() {},
    async goto(url) {
      fake.url = url
      fake.visited?.(url)
      await fake.duringGoto?.(url)
    },
    async waitForLoadState() {},
    url: () => fake.url,
    // The fixture adapter's setup waits for a heading; this page has it at once.
    getByRole: () => ({ waitFor: async () => {} }),
    async screenshot() {
      return Buffer.from('shot')
    },
    video: () => video
  }
  const context = {
    async route(_matcher, handler) {
      fake.order.push('route')
      fake.routeHandler = handler
    },
    async routeWebSocket(_matcher, handler) {
      fake.order.push('routeWebSocket')
      fake.wsHandler = handler
    },
    async exposeBinding(name, handler) {
      fake.order.push(`exposeBinding ${name}`)
      fake.bindings[name] = handler
    },
    async addInitScript(script) {
      fake.order.push('addInitScript')
      fake.initScripts.push(script)
    },
    on(event, handler) {
      fake.handlers[event] = handler
    },
    async newPage() {
      fake.order.push('newPage')
      return page
    },
    async storageState() {
      fake.stateSaves++
      await fake.duringState?.()
      if (stateError) throw stateError
      return { cookies: [], origins: [] }
    },
    async close() {
      await fake.duringClose?.()
    }
  }
  const browser = {
    async newContext(options) {
      fake.contexts++
      fake.contextOptions = options
      return context
    },
    async close() {
      fake.browserClosed = true
    }
  }
  fake.page = page
  fake.chromium = {
    async launch(options) {
      fake.launches.push(options)
      if (launchError) throw launchError
      return browser
    }
  }
  return fake
}

// What the context's 'request' and 'requestfinished' events hand over; `from` is what
// redirectedFrom() answers.
const fakeRequest = (url, from = null, method = 'GET') => ({
  redirectedFrom: () => (from ? { redirect: true } : null),
  method: () => method,
  url: () => url,
  postData: () => null
})
// A route as the context hands it to the handler: what it was told to do is in `calls`. Like
// Playwright's, it hands over the same request every time.
const fakeRoute = (method, url, body = null) => {
  const calls = []
  const request = { method: () => method, url: () => url, postData: () => body, redirectedFrom: () => null }
  return {
    calls,
    request: () => request,
    abort: async (code) => calls.push(`abort ${code}`),
    continue: async () => calls.push('continue')
  }
}
// A dialog as the page's 'dialog' event hands it over: what it was told to do is in `calls`.
const fakeDialog = (type) => {
  const calls = []
  return { calls, type: () => type, accept: async () => calls.push('accept'), dismiss: async () => calls.push('dismiss') }
}
// A WebSocket as the context's routeWebSocket handler gets it.
const fakeSocket = (url) => {
  const calls = []
  return { calls, url: () => url, close: async () => calls.push('close'), connectToServer: () => calls.push('connect') }
}
const NOT_LISTED = "GET elsewhere.example.net/next was refused: elsewhere.example.net is not in this environment's hosts."
const NAME_NOT_RESOLVED = 'page.goto: net::ERR_NAME_NOT_RESOLVED at http://127.0.0.1:9/home?token=abc'

const lookStep = async ({ rec }) => {
  await rec.step('look', 'Look at the page', 'action', async () => {})
}

// The saved session each run starts from, as the file holds it, and what the fake saves again.
const SEED_STATE = { cookies: [{ name: 'session', value: 'seed', domain: '127.0.0.1', path: '/' }], origins: [] }
const SEED_TEXT = JSON.stringify(SEED_STATE)
const SAVED_TEXT = JSON.stringify({ cookies: [], origins: [] })

// One run of record() with fresh folders; `overrides` replaces any argument. `state` is the text of
// the saved session file (SEED_TEXT by default; null leaves the file out).
async function go(fake, overrides = {}) {
  const base = mkdtempSync(join(tmpdir(), 'demo-capture-record-run-'))
  const runDir = join(base, 'run')
  mkdirSync(runDir)
  const statePath = join(base, 'session', 'state.json')
  const { walk: walkOverrides, config: configOverrides, state = SEED_TEXT, ...rest } = overrides
  if (state !== null) {
    mkdirSync(join(base, 'session'))
    writeFileSync(statePath, state)
  }
  const lines = []
  const args = {
    chromium: fake.chromium,
    config: { isSignedOut: (url) => new URL(url).pathname.startsWith('/login'), ...configOverrides },
    env: { name: 'local', baseUrl: 'http://127.0.0.1:9', production: false, hosts: ['127.0.0.1'] },
    walk: { name: 'look', title: 'Look', writes: false, startPath: '/home', run: lookStep, ...walkOverrides },
    params: {},
    runDir,
    statePath,
    learnHosts: false,
    headed: false,
    log: (line) => lines.push(line),
    ...rest
  }
  const result = await record(args)
  return { result, lines, runDir, statePath }
}

const readCapture = (runDir) => JSON.parse(readFileSync(join(runDir, 'capture.json'), 'utf8'))

test('a walk that ran and whose video was saved is a passed capture, and nothing is left running', async () => {
  const fake = fakeChromium()
  const { result, runDir, statePath } = await go(fake)
  assert.equal(result.capture.status, 'passed')
  assert.equal(readCapture(runDir).status, 'passed')
  assert.ok(existsSync(join(runDir, 'video.webm')))
  assert.equal(fake.stateSaves, 1)
  assert.equal(readFileSync(statePath, 'utf8'), SAVED_TEXT, 'the session is saved again')
  assert.equal(fake.browserClosed, true)
  assert.deepEqual(videoFolders(), [])
})

test('a walk that ran but whose video was not saved is a failed capture, never a passed one', async () => {
  for (const videoSaved of [false, 'throws']) {
    const fake = fakeChromium({ videoSaved })
    const { result, runDir } = await go(fake)
    const expected = { status: 'failed', failedStep: null, failure: 'The recording was not saved.' }
    assert.equal(fake.videoSaves, 1)
    assert.equal(result.capture.status, expected.status, `videoSaved ${videoSaved}`)
    assert.equal(result.capture.failedStep, expected.failedStep)
    assert.equal(result.capture.failure, expected.failure)
    const onDisk = readCapture(runDir)
    assert.equal(onDisk.status, expected.status)
    assert.equal(onDisk.failure, expected.failure)
    assert.equal(existsSync(join(runDir, 'video.webm')), false)
  }
})

test('a missing video does not replace the reason a walk already failed', async () => {
  const fake = fakeChromium({ videoSaved: false })
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          throw new Error('The heading never appeared')
        })
      }
    }
  })
  assert.equal(result.capture.status, 'failed')
  assert.equal(result.capture.failedStep, 'look')
  assert.equal(result.capture.failure, 'The heading never appeared')
  assert.equal(fake.browserClosed, true)
  assert.deepEqual(videoFolders(), [])
})

test('a learning run keeps its own failure line, which the report reads, whatever became of the video', async () => {
  for (const videoSaved of [true, false]) {
    const { result } = await go(fakeChromium({ videoSaved }), { learnHosts: true })
    assert.equal(result.capture.failure, LEARNING_FAILURE, `videoSaved ${videoSaved}`)
    assert.equal(result.capture.failedStep, null)
  }
})

test('a run found signed out keeps nothing: no capture, no video, no session saved again', async () => {
  const fake = fakeChromium()
  const { result, runDir, statePath } = await go(fake, { walk: { startPath: '/login' } })
  assert.deepEqual(result, { signedOut: true, violations: [] })
  assert.equal(existsSync(join(runDir, 'capture.json')), false)
  assert.equal(existsSync(join(runDir, 'video.webm')), false)
  assert.equal(fake.stateSaves, 0)
  assert.equal(fake.videoSaves, 0)
  assert.equal(readFileSync(statePath, 'utf8'), SEED_TEXT, 'the session was not saved again')
  assert.equal(fake.browserClosed, true)
  assert.deepEqual(videoFolders(), [])
})

test('a session that cannot be saved again is said in one line that holds none of the error', async () => {
  const fake = fakeChromium({ stateError: new Error('cookie SESSION-SECRET-VALUE could not be written') })
  const { result, lines, statePath } = await go(fake)
  assert.deepEqual(lines, ['Could not save the session again; the next run may ask you to sign in.'])
  assert.equal(result.capture.status, 'passed', 'the walk itself did not fail')
  assert.equal(readFileSync(statePath, 'utf8'), SEED_TEXT)
})

test('a browser that will not start is a refusal naming the first line of why, and leaves no temp folder', async () => {
  const launchError = new Error(
    "browserType.launch: Executable doesn't exist at /cache/chromium-1234\n╔═══════╗\n║ Looks like Playwright was just installed or updated. ║"
  )
  const fake = fakeChromium({ launchError })
  await assert.rejects(go(fake), (error) => {
    assert.ok(error instanceof CaptureRefusal, String(error))
    assert.equal(
      error.message,
      `The browser did not start (browserType.launch: Executable doesn't exist at /cache/chromium-1234). ${CACHE_SENTENCE}`
    )
    return true
  })
  assert.equal(fake.launches.length, 1)
  assert.equal(fake.contexts, 0)
  assert.deepEqual(videoFolders(), [])
})

test('a network policy the guard refuses is refused before a temp folder or a browser exists', async () => {
  const fake = fakeChromium()
  // learning needs a read-only walk: a policy that cannot be guarded with
  await assert.rejects(go(fake, { learnHosts: true, walk: { writes: true } }), (error) => {
    assert.ok(error instanceof CaptureRefusal, String(error))
    assert.match(error.message, /read-only/)
    return true
  })
  assert.equal(fake.launches.length, 0)
  assert.deepEqual(videoFolders(), [])
})

test('the browser starts headless with every name outside the environment unresolvable, headed on request', async () => {
  const fake = fakeChromium()
  await go(fake)
  await go(fake, { headed: true })
  assert.deepEqual(fake.launches, [
    { headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'] },
    { headless: false, args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'] }
  ])
})

test('a learning run starts a browser that resolves every name, so unlisted hosts load and are listed', async () => {
  const fake = fakeChromium()
  await go(fake, { learnHosts: true })
  assert.deepEqual(fake.launches, [{ headless: true, args: [] }])
})

test('a redirect hop to an unlisted host fails the run at the step it happened in', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          assert.equal(typeof fake.handlers.request, 'function', 'the context reports requests to the guard')
          fake.handlers.request(fakeRequest('https://elsewhere.example.net/next', true))
        })
      }
    }
  })
  assert.equal(result.capture.status, 'failed')
  assert.equal(result.capture.failedStep, 'look')
  assert.equal(result.capture.failure, NOT_LISTED)
})

test('a request that is not a redirect hop is left to the route handler, and a hop to a listed host is fine', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          fake.handlers.request(fakeRequest('https://elsewhere.example.net/first'))
          fake.handlers.request(fakeRequest('http://127.0.0.1:9/next', true))
        })
      }
    }
  })
  assert.equal(result.capture.status, 'passed', result.capture.failure)
})

test('the hooks get the context the spec names, in the order the spec names', async () => {
  const fake = fakeChromium()
  const calls = []
  fake.visited = (url) => calls.push(`goto ${url}`)
  const keys = (value) => Object.keys(value).sort().join(',')
  const { result } = await go(fake, {
    params: { heading: 'Details' },
    config: {
      revision: async (context) => {
        calls.push(`revision ${keys(context)}`)
        return 'fixture-1'
      },
      setup: async (context) => {
        calls.push(`setup ${keys(context)}`)
      },
      beforeStep: async (context) => {
        calls.push(`beforeStep ${keys(context)} ${context.stepId}`)
      }
    },
    walk: {
      run: async (context) => {
        calls.push(`walk ${keys(context)}`)
        await context.rec.step('look', 'Look at the page', 'action', async () => {
          calls.push('step look')
        })
      }
    }
  })
  assert.deepEqual(calls, [
    'goto http://127.0.0.1:9/home',
    'revision baseUrl',
    'setup baseUrl,page,params',
    'walk baseUrl,checks,page,params,rec',
    'beforeStep page,params,stepId look',
    'step look'
  ])
  assert.equal(result.capture.appRevision, 'fixture-1')
})

test('a guard violation is what a failed walk reports, not the error it caused later', async () => {
  const fake = fakeChromium()
  const { result, lines, runDir } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          fake.handlers.request(fakeRequest('https://elsewhere.example.net/next?token=abc', true))
          fake.handlers.request(fakeRequest('https://later.example.net/other', true))
          throw new Error(NAME_NOT_RESOLVED)
        })
      }
    }
  })
  assert.equal(result.capture.status, 'failed')
  assert.equal(result.capture.failedStep, 'look')
  assert.equal(result.capture.failure, NOT_LISTED, 'the first violation, not the later one and not the error')
  for (const text of [readFileSync(join(runDir, 'capture.json'), 'utf8'), lines.join('\n')])
    assert.doesNotMatch(text, /token|ERR_NAME_NOT_RESOLVED/)
})

test('a second tab is what a failed walk reports, not the timeout that came after it', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          fake.handlers.page({ close: async () => {} })
          throw new Error('locator.click: Timeout 30000ms exceeded.')
        })
      }
    }
  })
  assert.equal(result.capture.status, 'failed')
  assert.equal(result.capture.failedStep, 'look')
  assert.match(result.capture.failure, /^The walk opened a second tab, and a capture records one tab\./)
})

test('a walk that fails with no guard violation keeps its own error', async () => {
  const { result } = await go(fakeChromium(), {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          throw new Error('locator.click: Timeout 30000ms exceeded.')
        })
      }
    }
  })
  assert.equal(result.capture.failure, 'locator.click: Timeout 30000ms exceeded.')
})

test('a violation that arrives after the walk, while the session is saved or the context closes, fails the capture', async () => {
  for (const moment of ['duringState', 'duringClose']) {
    const fake = fakeChromium()
    fake[moment] = async () => fake.handlers.request(fakeRequest('https://elsewhere.example.net/next', true))
    const { result, runDir } = await go(fake)
    assert.equal(result.capture.status, 'failed', moment)
    assert.equal(result.capture.failure, NOT_LISTED, moment)
    assert.equal(readCapture(runDir).status, 'failed', moment)
  }
})

test('a late violation does not replace an earlier failure, and it does replace the learning line', async () => {
  const hopLate = (fake) => async () => fake.handlers.request(fakeRequest('https://elsewhere.example.net/next', true))
  const failing = fakeChromium()
  failing.duringClose = hopLate(failing)
  const { result } = await go(failing, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          throw new Error('The heading never appeared')
        })
      }
    }
  })
  assert.equal(result.capture.failure, 'The heading never appeared')
  // A learning run's own line is what the report reads to tell a finished run from a stopped one: a
  // violation that arrives late stopped it as much as one that arrived during the walk.
  const learning = fakeChromium()
  learning.duringClose = async () => learning.handlers.page({ close: async () => {} })
  const { result: learned } = await go(learning, { learnHosts: true })
  assert.equal(learned.capture.status, 'failed')
  assert.match(learned.capture.failure, /^The walk opened a second tab, and a capture records one tab\./)
  // Without one, the learning line stays.
  const { result: quiet } = await go(fakeChromium(), { learnHosts: true })
  assert.equal(quiet.capture.failure, LEARNING_FAILURE)
})

test('the failure line keeps the first line only, with every URL in it cut down to scheme, host and path', async () => {
  const { result, lines } = await go(fakeChromium(), {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          throw new Error(
            'page.goto: net::ERR_ABORTED at https://user:pw@app.example.com:8443/home?token=abc#frag then wss://sock.example.net/s?k=v and http://[::1]:9/z?q=1 or http://%zz/p?x=1\nsecond line http://secret.example.com/?token=second'
          )
        })
      }
    }
  })
  assert.equal(
    result.capture.failure,
    'page.goto: net::ERR_ABORTED at https://app.example.com:8443/home then wss://sock.example.net/s and http://[::1]:9/z or http://(unreadable URL)'
  )
  assert.doesNotMatch(JSON.stringify(result.capture) + lines.join('\n'), /token|user|pw@|secret/)
})

// The whole command on the fixture project, a saved session and a fake browser: what record() says
// has to come out of main() as an exit code and lines on the screen.
async function runMain(fake, extraArgs = []) {
  const root = mkdtempSync(join(tmpdir(), 'demo-capture-record-main-'))
  const session = sessionPaths(root, 'fixture-app', 'local')
  mkdirSync(session.dir, { recursive: true })
  writeFileSync(session.state, '{}')
  const lines = []
  const code = await main(['--project', join(import.meta.dirname, 'fixture'), '--env', 'local', '--walk', 'outside-host', ...extraArgs], {
    root,
    chromium: fake.chromium,
    log: (line) => lines.push(line),
    error: (line) => lines.push(line)
  })
  return { code, output: lines.join('\n') }
}

test('main exits 1 and says FAILED for a walk whose video was not saved', async () => {
  const { code, output } = await runMain(fakeChromium({ videoSaved: false }))
  assert.equal(code, 1, output)
  // No "before the first step": the walk had run; only its recording was lost.
  assert.match(output, /\nFAILED: .*\n {2}The recording was not saved\.\n {2}No video should be made from this capture\./)
  assert.doesNotMatch(output, /before the first step/)
})

test('main prints the line about a session that could not be saved again, and the walk still passes', async () => {
  const fake = fakeChromium({ stateError: new Error('cookie SESSION-SECRET-VALUE could not be written') })
  const { code, output } = await runMain(fake)
  assert.equal(code, 0, output)
  assert.match(output, /^Could not save the session again; the next run may ask you to sign in\.$/m)
  assert.match(output, /\nCaptured: /)
  assert.doesNotMatch(output, /SESSION-SECRET-VALUE/)
})

test('main reports the violation, not the navigation error it caused, and prints no part of the URL query', async () => {
  const fake = fakeChromium()
  fake.duringGoto = async () => {
    fake.handlers.request(fakeRequest('https://elsewhere.example.net/next?token=abc', true))
    throw new Error(NAME_NOT_RESOLVED)
  }
  const { code, output } = await runMain(fake)
  assert.equal(code, 1, output)
  assert.match(
    output,
    /\n {2}before the first step: GET elsewhere\.example\.net\/next was refused: elsewhere\.example\.net is not in this environment's hosts\./
  )
  assert.doesNotMatch(output, /token|ERR_NAME_NOT_RESOLVED/)
})

// ---- readOnlyAllowed: the config's list reaches the guard that judges every request ----

const BEACON = 'http://127.0.0.1:9/beacon'
// An allowed rule matches the whole URL, so the pattern names the scheme, host and path; it takes any host
// here so that the host lock, not the rule, is what refuses a beacon to an unlisted one.
const allowBeacon = { method: 'POST', url: /https?:\/\/[a-z0-9.]+(?::\d+)?\/beacon/, body: /\{"page":"[a-z]+"\}/ }
const REFUSED_BEACON = 'POST 127.0.0.1/beacon was refused: this walk is read-only.'
// The same refusal when the allowed rule matched the URL: it names the rule, and that its body failed.
const REFUSED_BEACON_BODY = 'POST 127.0.0.1/beacon was refused: this walk is read-only (readOnlyAllowed[0] matches this URL but not its body).'

// Sends each [method, url, body] through the route handler the run installed, in one step, and
// returns what the browser was told for each.
async function sendThrough(config, requests, { walk } = {}) {
  const fake = fakeChromium()
  const told = []
  const { result } = await go(fake, {
    config,
    walk: {
      ...walk,
      run: async ({ rec }) => {
        await rec.step('send', 'Send requests', 'action', async () => {
          for (const [method, url, body] of requests) {
            const route = fakeRoute(method, url, body)
            await fake.routeHandler(route)
            told.push(...route.calls)
          }
        })
      }
    }
  })
  return { told, capture: result.capture }
}

test('readOnlyAllowed reaches the guard: a listed non-read is sent, one that does not match is refused', async () => {
  const config = { readOnlyAllowed: [allowBeacon] }
  const ok = await sendThrough(config, [['POST', BEACON, '{"page":"home"}']])
  assert.deepEqual(ok.told, ['continue'])
  assert.equal(ok.capture.status, 'passed')
  const odd = await sendThrough(config, [['POST', BEACON, '{"page":"home","extra":true}']])
  assert.deepEqual(odd.told, ['abort blockedbyclient'])
  assert.equal(odd.capture.failedStep, 'send')
  assert.equal(odd.capture.failure, REFUSED_BEACON_BODY)
  // The method is part of the rule: a PUT to the same URL, with the same body, is still refused.
  const put = await sendThrough(config, [['PUT', BEACON, '{"page":"home"}']])
  assert.deepEqual(put.told, ['abort blockedbyclient'])
  assert.equal(put.capture.failure, 'PUT 127.0.0.1/beacon was refused: this walk is read-only.')
})

test('without readOnlyAllowed every non-read of a read-only walk is refused', async () => {
  const none = await sendThrough({}, [['POST', BEACON, '{"page":"home"}']])
  assert.deepEqual(none.told, ['abort blockedbyclient'])
  assert.equal(none.capture.failure, REFUSED_BEACON)
  const empty = await sendThrough({ readOnlyAllowed: [] }, [['POST', BEACON, '{"page":"home"}']])
  assert.deepEqual(empty.told, ['abort blockedbyclient'])
})

test('a body pattern that matches the empty string does not allow a request without a body', async () => {
  const config = { readOnlyAllowed: [{ method: 'POST', url: /http:\/\/127\.0\.0\.1:9\/ping/, body: /^$/ }] }
  const ping = 'http://127.0.0.1:9/ping'
  const bodiless = await sendThrough(config, [['POST', ping, null]])
  assert.deepEqual(bodiless.told, ['abort blockedbyclient'])
  assert.equal(
    bodiless.capture.failure,
    'POST 127.0.0.1/ping was refused: this walk is read-only (readOnlyAllowed[0] has a body pattern, and this request has no readable body).'
  )
  // A rule without a body pattern is how a bodiless request is allowed.
  const open = await sendThrough({ readOnlyAllowed: [{ method: 'POST', url: /http:\/\/127\.0\.0\.1:9\/ping/ }] }, [['POST', ping, null]])
  assert.deepEqual(open.told, ['continue'])
})

test('readOnlyForbidden wins over readOnlyAllowed, and the host lock still applies', async () => {
  const both = await sendThrough({ readOnlyAllowed: [allowBeacon], readOnlyForbidden: [{ method: 'POST', url: /\/beacon$/ }] }, [
    ['POST', BEACON, '{"page":"home"}']
  ])
  assert.deepEqual(both.told, ['abort blockedbyclient'])
  assert.equal(both.capture.failure, 'POST 127.0.0.1/beacon was refused: the project lists it as a read that writes.')
  const elsewhere = await sendThrough({ readOnlyAllowed: [allowBeacon] }, [['POST', 'https://tracker.example.net/beacon', '{"page":"home"}']])
  assert.deepEqual(elsewhere.told, ['abort blockedbyclient'])
  assert.equal(elsewhere.capture.failure, "POST tracker.example.net/beacon was refused: tracker.example.net is not in this environment's hosts.")
})

test('readOnlyAllowed changes nothing for a walk that declares writes', async () => {
  // The allowed rule matches nothing here: a write walk is not gated by it, nor by its absence.
  const config = { readOnlyAllowed: [allowBeacon] }
  const post = await sendThrough(config, [['POST', 'http://127.0.0.1:9/items', '{"name":"x"}']], { walk: { writes: true } })
  assert.deepEqual(post.told, ['continue'])
  assert.equal(post.capture.status, 'passed')
  // The host lock is the same too: an allowed rule is no way to an unlisted host.
  const elsewhere = await sendThrough(config, [['POST', 'https://tracker.example.net/beacon', '{"page":"home"}']], { walk: { writes: true } })
  assert.deepEqual(elsewhere.told, ['abort blockedbyclient'])
})

test('a learning run lists what it refused and says what a person can do about it, only when it refused something', async () => {
  const hint =
    'A non-read that changes no data may go in readOnlyAllowed, once a person approves it. A read listed in readOnlyForbidden stays refused.'
  const refusing = fakeChromium()
  refusing.duringGoto = async () => {
    await refusing.routeHandler(fakeRoute('POST', 'http://127.0.0.1:9/items', '{}'))
    await refusing.routeHandler(fakeRoute('PUT', 'http://127.0.0.1:9/items', '{}'))
  }
  const withRefusals = await runMain(refusing, ['--learn-hosts'])
  assert.equal(withRefusals.code, 0, withRefusals.output)
  assert.match(
    withRefusals.output,
    new RegExp(
      `Requests refused because the walk is read-only:\n {2}POST http://127\\.0\\.0\\.1:9/items \\(with a body\\)\n {2}PUT http://127\\.0\\.0\\.1:9/items \\(with a body\\)\n${hint.replace(/\./g, '\\.')}\nAdd a host to the config only after a person approves it\\.`
    )
  )
  const quiet = await runMain(fakeChromium(), ['--learn-hosts'])
  assert.equal(quiet.code, 0, quiet.output)
  assert.doesNotMatch(quiet.output, /readOnlyAllowed|Requests refused/)
})

// ---- The final review: what record() installs, and how it reads what it sees ----

test('the recording context is made with exactly these options: the saved session, no service workers', async () => {
  const fake = fakeChromium()
  await go(fake)
  const options = fake.contextOptions
  assert.equal(typeof options.recordVideo?.dir, 'string')
  assert.deepEqual(
    { ...options, recordVideo: { ...options.recordVideo, dir: '(a temporary folder)' } },
    {
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: '(a temporary folder)', size: { width: 1440, height: 900 } },
      // The state file as read, so a file that is not JSON is the engine's refusal, not Playwright's.
      storageState: SEED_STATE,
      acceptDownloads: true,
      // A service worker's own fetches would bypass the network guard.
      serviceWorkers: 'block'
    }
  )
})

test('a saved session that cannot be read is a refusal that quotes none of it, before a browser starts', async () => {
  for (const state of ['{"cookies":[{"value":"SESSION-SECRET-VALUE"', '', null]) {
    const fake = fakeChromium()
    await assert.rejects(go(fake, { state }), (error) => {
      assert.ok(error instanceof CaptureRefusal, String(error))
      assert.equal(error.message, 'The saved session could not be read; run sign-in again.')
      return true
    })
    assert.equal(fake.launches.length, 0, String(state))
    assert.deepEqual(videoFolders(), [])
  }
})

test('every WebSocket goes through the guard: an unlisted one is closed and fails the run, a listed one connects', async () => {
  const fake = fakeChromium()
  const sockets = {}
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          assert.equal(typeof fake.wsHandler, 'function', 'the context routes every WebSocket')
          for (const url of ['ws://127.0.0.1:9/hub', 'wss://elsewhere.example.net/hub?token=SECRET']) {
            sockets[url] = fakeSocket(url)
            fake.wsHandler(sockets[url])
          }
        })
      }
    }
  })
  assert.deepEqual(sockets['ws://127.0.0.1:9/hub'].calls, ['connect'])
  assert.deepEqual(sockets['wss://elsewhere.example.net/hub?token=SECRET'].calls, ['close'])
  assert.equal(result.capture.failedStep, 'look')
  assert.equal(result.capture.failure, "GET elsewhere.example.net/hub was refused: elsewhere.example.net is not in this environment's hosts.")
})

const SHARED_WORKER_BINDING = '__demoCaptureSharedWorker'
const SHARED_WORKER = 'The page started a shared worker, whose requests the guard cannot see.'

// Runs the init scripts the run installed against a window of the test's own, as the browser runs
// them in every page before its own scripts, and returns that window. `report` stands in for the
// page's side of the binding.
function pageWindow(fake, report) {
  const window = { [SHARED_WORKER_BINDING]: report }
  const saved = globalThis.window
  globalThis.window = window
  try {
    for (const script of fake.initScripts) script()
  } finally {
    if (saved === undefined) delete globalThis.window
    else globalThis.window = saved
  }
  return window
}

test('a page may not start a shared worker: the engine blocks it in every page, before the first one opens', async () => {
  const fake = fakeChromium()
  let thrown
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('share', 'Start a shared worker', 'action', async () => {
          // The page's call reaches the binding the run installed, as Playwright would carry it.
          const window = pageWindow(fake, () => fake.bindings[SHARED_WORKER_BINDING]({ page: fake.page }))
          try {
            new window.SharedWorker('/shared-worker.js')
          } catch (error) {
            thrown = error
          }
        })
        await rec.step('after', 'Nothing was started', 'action', async () => {})
      }
    }
  })
  // Both are on the context before its first page, so every page and frame has them from the start.
  assert.deepEqual(fake.order.slice(0, fake.order.indexOf('newPage') + 1).filter((call) => call !== 'route' && call !== 'routeWebSocket'), [
    `exposeBinding ${SHARED_WORKER_BINDING}`,
    'addInitScript',
    'newPage'
  ])
  assert.ok(thrown instanceof DOMException, String(thrown))
  assert.equal(thrown.name, 'SecurityError')
  // A page that catches the error has still tried: the run fails, at the step where it happened.
  assert.equal(result.capture.status, 'failed')
  assert.equal(result.capture.failedStep, 'share')
  assert.equal(result.capture.failure, SHARED_WORKER)
})

test('the shared worker block is installed for a learning run and a walk that writes too', async () => {
  for (const overrides of [{ learnHosts: true }, { walk: { writes: true } }]) {
    const fake = fakeChromium()
    await go(fake, overrides)
    assert.equal(typeof fake.bindings[SHARED_WORKER_BINDING], 'function', JSON.stringify(overrides))
    let reported = false
    const window = pageWindow(fake, () => (reported = true))
    assert.throws(() => new window.SharedWorker('/x.js'), (error) => error.name === 'SecurityError')
    assert.equal(reported, true)
  }
})

test('a request that finishes without the route guard judging it fails the run: a walk answered its own route', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          assert.equal(typeof fake.handlers.requestfinished, 'function', 'the context reports finished requests to the guard')
          // One the route guard judged, and a redirect hop: both are fine.
          const routed = fakeRoute('GET', 'http://127.0.0.1:9/list')
          await fake.routeHandler(routed)
          fake.handlers.requestfinished(routed.request())
          fake.handlers.requestfinished(fakeRequest('http://127.0.0.1:9/next', true))
        })
        await rec.step('post', 'Post past the guard', 'action', async () => {
          fake.handlers.requestfinished(fakeRequest('http://127.0.0.1:9/items?token=SECRET', false, 'POST'))
        })
      }
    }
  })
  assert.equal(result.capture.failedStep, 'post')
  assert.equal(result.capture.failure, 'A request went out without the guard: the walk handled it with its own route (POST 127.0.0.1/items).')
})

test('the engine accepts a leave-this-page prompt and dismisses other dialogs, unless the walk handles dialogs itself', async () => {
  const fake = fakeChromium()
  const seen = {}
  const { result } = await go(fake, {
    walk: {
      run: async ({ page, rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          for (const type of ['beforeunload', 'confirm', 'alert']) {
            seen[`engine ${type}`] = fakeDialog(type)
            fake.emit('dialog', seen[`engine ${type}`])
          }
          // From here on the walk answers dialogs itself, and the engine leaves them to it: two
          // answers to one dialog would fail in Playwright ("already handled").
          page.on('dialog', (dialog) => dialog.accept())
          for (const type of ['confirm', 'beforeunload']) {
            seen[`walk ${type}`] = fakeDialog(type)
            fake.emit('dialog', seen[`walk ${type}`])
          }
        })
      }
    }
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(Object.fromEntries(Object.entries(seen).map(([key, dialog]) => [key, dialog.calls])), {
    'engine beforeunload': ['accept'],
    'engine confirm': ['dismiss'],
    'engine alert': ['dismiss'],
    'walk confirm': ['accept'],
    'walk beforeunload': ['accept']
  })
  assert.equal(result.capture.status, 'passed')
})

// The identity provider's page, on a host the environment may well list.
const IDP = 'https://id.example.net/authorize?client_id=app&state=SECRET'

test('a start page that lands off the app origin is signed out, whatever isSignedOut says of its path', async () => {
  const fake = fakeChromium()
  fake.duringGoto = async () => {
    fake.url = IDP
  }
  const { result } = await go(fake)
  assert.deepEqual(result, { signedOut: true, violations: [] })
  // A URL that cannot be read is off the origin too.
  const unreadable = fakeChromium()
  unreadable.duringGoto = async () => {
    unreadable.url = 'not a url'
  }
  assert.deepEqual((await go(unreadable, { config: { isSignedOut: () => false } })).result, { signedOut: true, violations: [] })
})

test('a setup that leaves the app origin is signed out too', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    config: {
      setup: async () => {
        fake.url = IDP
      }
    }
  })
  assert.deepEqual(result, { signedOut: true, violations: [] })
})

test('before a step only isSignedOut is asked: a walk may go to another listed host', async () => {
  const fake = fakeChromium()
  const { result } = await go(fake, {
    walk: {
      run: async ({ rec }) => {
        fake.url = 'https://docs.example.org/guide'
        await rec.step('look', 'Look at the guide', 'action', async () => {})
      }
    }
  })
  assert.equal(result.capture.status, 'passed', result.capture.failure)
})

test('a guard violation still comes before signed out, and an isSignedOut that throws is a walk failure', async () => {
  const fake = fakeChromium()
  fake.duringGoto = async () => {
    fake.handlers.request(fakeRequest('https://elsewhere.example.net/next', true))
    fake.url = IDP
  }
  const { result } = await go(fake)
  assert.equal(result.capture.failure, NOT_LISTED)
  const { result: broken } = await go(fakeChromium(), {
    config: {
      isSignedOut: () => {
        throw new Error('isSignedOut could not read the URL')
      }
    }
  })
  assert.equal(broken.capture.status, 'failed')
  assert.equal(broken.capture.failedStep, null)
  assert.equal(broken.capture.failure, 'isSignedOut could not read the URL')
})

test('a signed-out attempt hands over what its guard found, so the recovery can say it', async () => {
  const fake = fakeChromium()
  fake.duringClose = async () => fake.handlers.request(fakeRequest('https://elsewhere.example.net/next', true))
  const { result } = await go(fake, { walk: { startPath: '/login' } })
  assert.deepEqual(result, { signedOut: true, violations: [NOT_LISTED] })
})

test('a second tab says what to do about it, which depends on whether sameTabLinks is set', async () => {
  const secondTab = async (config) => {
    const fake = fakeChromium()
    const { result } = await go(fake, {
      config,
      walk: {
        run: async ({ rec }) => {
          await rec.step('look', 'Look at the page', 'action', async () => fake.handlers.page({ close: async () => {} }))
        }
      }
    })
    return result.capture.failure
  }
  assert.equal(
    await secondTab({}),
    'The walk opened a second tab, and a capture records one tab. Set sameTabLinks: true in the config if the app opens links in new tabs.'
  )
  assert.equal(
    await secondTab({ sameTabLinks: true }),
    'The walk opened a second tab, and a capture records one tab. sameTabLinks is set, so something it does not cover opened the tab (a form with a target, or a click with a modifier key); change the walk so it stays in one tab.'
  )
})

test('the temporary video folder is removed if the process exits during a run, and the exit hook goes with the run', async () => {
  const before = process.listeners('exit')
  const fake = fakeChromium()
  let during
  await go(fake, {
    walk: {
      run: async ({ rec }) => {
        await rec.step('look', 'Look at the page', 'action', async () => {
          const added = process.listeners('exit').filter((listener) => !before.includes(listener))
          assert.equal(added.length, 1)
          assert.equal(videoFolders().length, 1)
          added[0]() // what an exit in the middle of the run would call
          during = videoFolders()
        })
      }
    }
  })
  assert.deepEqual(during, [])
  assert.deepEqual(process.listeners('exit'), before)
  // A run that is refused leaves no hook behind either.
  await assert.rejects(go(fakeChromium({ launchError: new Error('no browser') })))
  assert.deepEqual(process.listeners('exit'), before)
})

test('a learning run lists a refused non-read with its query names, never a value', async () => {
  const fake = fakeChromium()
  fake.duringGoto = async () => {
    await fake.routeHandler(fakeRoute('POST', 'http://127.0.0.1:9/hub/negotiate?negotiateVersion=1&access_token=SECRET-TOKEN', null))
  }
  const { code, output } = await runMain(fake, ['--learn-hosts'])
  assert.equal(code, 0, output)
  assert.match(output, /\n {2}POST http:\/\/127\.0\.0\.1:9\/hub\/negotiate\?negotiateVersion=…&access_token=… \(no body\)\n/)
  assert.doesNotMatch(output, /SECRET/)
})
