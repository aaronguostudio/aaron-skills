import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CaptureRefusal, RunGuard, classifyRequest, describeNonRead, describeRequest, matchesRule, parseHostEntry } from '../scripts/guards.mjs'

const policy = (extra = {}) => ({ hosts: ['app.example.com', 'cdn.example.com'], readOnly: true, ...extra })
const get = (url) => ({ method: 'GET', url })

test('describeRequest names the method, host and path, never the query', () => {
  assert.equal(describeRequest('post', 'https://app.example.com/items?token=abc'), 'POST app.example.com/items')
  assert.equal(describeRequest('GET', 'not a url'), 'GET (unreadable URL)')
})

test('a rule matches on method and URL, and on the body when it has one', () => {
  const rule = { method: 'GET', url: /\/items\?mode=recount/ }
  assert.equal(matchesRule(rule, get('https://app.example.com/items?mode=recount')), true)
  assert.equal(matchesRule(rule, { method: 'get', url: 'https://app.example.com/items?mode=recount' }), true)
  assert.equal(matchesRule(rule, { method: 'POST', url: 'https://app.example.com/items?mode=recount' }), false)
  assert.equal(matchesRule(rule, get('https://app.example.com/items')), false)
  // A global flag does not make matching depend on the previous call.
  const global = { method: 'GET', url: /recount/g }
  assert.equal(matchesRule(global, get('https://a.example.com/recount')), true)
  assert.equal(matchesRule(global, get('https://a.example.com/recount')), true)
  const withBody = { method: 'POST', url: /\/brief$/, body: /^\{"date":"[\d-]+"\}$/ }
  assert.equal(matchesRule(withBody, { method: 'POST', url: 'https://a.example.com/brief', body: '{"date":"2026-10-05"}' }), true)
  assert.equal(matchesRule(withBody, { method: 'POST', url: 'https://a.example.com/brief', body: '{"date":"2026-10-05","refresh":true}' }), false)
  assert.equal(matchesRule(withBody, { method: 'POST', url: 'https://a.example.com/brief' }), false)
})

test('the host lock refuses every host outside the list, and lets listed hosts through', () => {
  assert.equal(classifyRequest(get('https://app.example.com/home'), policy()).action, 'continue')
  assert.equal(classifyRequest(get('https://APP.example.com/home'), policy()).action, 'continue')
  assert.equal(classifyRequest(get('wss://cdn.example.com/live'), policy()).action, 'continue')
  const outside = classifyRequest(get('https://tracker.example.net/pixel?id=1'), policy())
  assert.equal(outside.action, 'abort')
  assert.equal(outside.kind, 'host')
  assert.equal(outside.reason, "GET tracker.example.net/pixel was refused: tracker.example.net is not in this environment's hosts.")
  // The lock also holds for a walk that writes.
  assert.equal(classifyRequest(get('https://tracker.example.net/'), policy({ readOnly: false })).action, 'abort')
})

test('pages the browser makes itself are not network requests', () => {
  for (const url of ['data:image/png;base64,AAAA', 'blob:https://app.example.com/1', 'about:blank'])
    assert.equal(classifyRequest(get(url), policy()).action, 'continue')
  const unreadable = classifyRequest(get('not a url'), policy())
  assert.equal(unreadable.action, 'abort')
  assert.equal(unreadable.reason, 'A request with an unreadable URL was refused.')
})

test('a read-only walk refuses every non-read; HEAD and OPTIONS are reads', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const verdict = classifyRequest({ method, url: 'https://app.example.com/items' }, policy())
    assert.equal(verdict.action, 'abort', method)
    assert.equal(verdict.kind, 'write')
    assert.equal(verdict.reason, `${method} app.example.com/items was refused: this walk is read-only.`)
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS'])
    assert.equal(classifyRequest({ method, url: 'https://app.example.com/items' }, policy()).action, 'continue', method)
  assert.equal(classifyRequest({ method: 'POST', url: 'https://app.example.com/items' }, policy({ readOnly: false })).action, 'continue')
})

test('a read the project lists as writing is refused in a read-only walk only', () => {
  const forbidden = [{ method: 'GET', url: /\/items\?mode=recount/ }]
  const verdict = classifyRequest(get('https://app.example.com/items?mode=recount'), policy({ forbidden }))
  assert.equal(verdict.action, 'abort')
  assert.equal(verdict.kind, 'forbidden')
  assert.equal(verdict.reason, 'GET app.example.com/items was refused: the project lists it as a read that writes.')
  assert.equal(classifyRequest(get('https://app.example.com/items?mode=recount'), policy({ forbidden, readOnly: false })).action, 'continue')
})

test('an allowed non-read passes in a read-only walk, but never on an unlisted host and never when forbidden', () => {
  const allowed = [{ method: 'POST', url: /https:\/\/[a-z.]+\/session\/token/ }]
  assert.equal(classifyRequest({ method: 'POST', url: 'https://app.example.com/session/token' }, policy({ allowed })).action, 'continue')
  assert.equal(classifyRequest({ method: 'POST', url: 'https://other.example.net/session/token' }, policy({ allowed })).kind, 'host')
  const forbidden = [{ method: 'POST', url: /\/session\/token$/ }]
  assert.equal(classifyRequest({ method: 'POST', url: 'https://app.example.com/session/token' }, policy({ allowed, forbidden })).kind, 'forbidden')
})

test('while learning, unlisted hosts pass and are named, and non-reads are still refused', () => {
  const learning = policy({ learning: true })
  const verdict = classifyRequest(get('https://fonts.example.org/a.woff2'), learning)
  assert.deepEqual([verdict.action, verdict.kind, verdict.host], ['continue', 'unlisted', 'fonts.example.org'])
  assert.equal(classifyRequest({ method: 'POST', url: 'https://beacon.example.org/b' }, learning).action, 'abort')
})

// A route as Playwright hands it to a context.route handler.
function fakeRoute(method, url, body = null) {
  const calls = []
  return {
    calls,
    request: () => ({ method: () => method, url: () => url, postData: () => body }),
    abort: async (code) => calls.push(`abort ${code}`),
    continue: async () => calls.push('continue')
  }
}

test('RunGuard aborts a refused request at once and fails the run at the next check, naming the step', async () => {
  let step = 'add'
  const guard = new RunGuard(policy(), { currentStep: () => step })
  const ok = fakeRoute('GET', 'https://app.example.com/list')
  await guard.handleRoute(ok)
  assert.deepEqual(ok.calls, ['continue'])
  assert.doesNotThrow(() => guard.assertClean())
  const bad = fakeRoute('POST', 'https://app.example.com/items', '{"name":"x"}')
  await guard.handleRoute(bad)
  assert.deepEqual(bad.calls, ['abort blockedbyclient'])
  step = 'after'
  assert.throws(
    () => guard.assertClean(),
    (e) => e instanceof CaptureRefusal && e.step === 'add' && /POST app\.example\.com\/items was refused: this walk is read-only\./.test(e.message)
  )
})

test('RunGuard hands the request body to the rules', async () => {
  const allowed = [{ method: 'POST', url: /https:\/\/app\.example\.com\/brief/, body: /^\{"date":"[\d-]+"\}$/ }]
  const guard = new RunGuard(policy({ allowed }))
  const plain = fakeRoute('POST', 'https://app.example.com/brief', '{"date":"2026-10-05"}')
  await guard.handleRoute(plain)
  assert.deepEqual(plain.calls, ['continue'])
  const refresh = fakeRoute('POST', 'https://app.example.com/brief', '{"date":"2026-10-05","refresh":true}')
  await guard.handleRoute(refresh)
  assert.deepEqual(refresh.calls, ['abort blockedbyclient'])
})

test('RunGuard closes a WebSocket to an unlisted host and connects a listed one', () => {
  const guard = new RunGuard(policy())
  const calls = []
  const ws = (url) => ({ url: () => url, close: () => calls.push(`close ${url}`), connectToServer: () => calls.push(`connect ${url}`) })
  guard.handleWebSocket(ws('wss://app.example.com/hub'))
  guard.handleWebSocket(ws('wss://push.example.net/hub'))
  assert.deepEqual(calls, ['connect wss://app.example.com/hub', 'close wss://push.example.net/hub'])
  assert.throws(() => guard.assertClean(), /push\.example\.net is not in this environment's hosts/)
})

test('a learning RunGuard never fails: it lists unlisted hosts and refused requests', async () => {
  const guard = new RunGuard(policy({ learning: true }))
  // Three unlisted hosts and two refused requests, each fed out of sorted order, so that only
  // learned()'s own sorting can produce the order asserted below. fonts is seen twice: one entry.
  // A refused non-read is listed with its scheme, port and query names, so a rule can be written
  // for its whole URL, and its host (beacon) is listed although only a refused request reached it.
  await guard.handleRoute(fakeRoute('GET', 'https://zeta.example.org/z.woff2'))
  await guard.handleRoute(fakeRoute('GET', 'https://fonts.example.org/a.woff2'))
  await guard.handleRoute(fakeRoute('GET', 'https://fonts.example.org/b.woff2'))
  await guard.handleRoute(fakeRoute('GET', 'https://cdn.example.com/app.js'))
  const post = fakeRoute('POST', 'https://beacon.example.org/b?id=7')
  await guard.handleRoute(post)
  assert.deepEqual(post.calls, ['abort blockedbyclient'])
  const del = fakeRoute('DELETE', 'https://app.example.com/session?id=7')
  await guard.handleRoute(del)
  assert.deepEqual(del.calls, ['abort blockedbyclient'])
  assert.doesNotThrow(() => guard.assertClean())
  assert.deepEqual(guard.learned(), {
    unlisted: ['beacon.example.org', 'fonts.example.org', 'zeta.example.org'],
    refused: ['DELETE https://app.example.com/session?id=… (no body)', 'POST https://beacon.example.org/b?id=… (no body)']
  })
})

test('RunGuard.fail records a reason against the current step', () => {
  const guard = new RunGuard(policy(), { currentStep: () => 'open' })
  guard.fail('The walk opened a second tab.')
  assert.throws(() => guard.assertClean(), (e) => e.step === 'open' && e.message === 'The walk opened a second tab.')
})

// ---- Fix round 1: redirect hops, ports, a checked policy, no unanswered request, schemes ----

// A request as Playwright hands it to context.on('request'): redirectedFrom() is the request that
// redirected to it, and null for a first request.
const hop = (method, url, { from = {}, body = null } = {}) => ({
  method: () => method,
  url: () => url,
  redirectedFrom: () => from,
  postData: () => body
})

// An unhandled rejection only surfaces after the microtasks drain, so wait one macrotask.
async function withoutUnhandledRejections(run) {
  const seen = []
  const listener = (reason) => seen.push(reason)
  process.on('unhandledRejection', listener)
  try {
    await run()
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    process.off('unhandledRejection', listener)
  }
  assert.deepEqual(seen, [])
}

test('a redirect hop to an unlisted host fails the run, naming the step it happened in', () => {
  let step = 'open'
  const guard = new RunGuard(policy(), { currentStep: () => step })
  guard.handleRedirectHop(hop('GET', 'https://app.example.com/home'))
  assert.doesNotThrow(() => guard.assertClean())
  step = 'sign-in'
  guard.handleRedirectHop(hop('GET', 'https://tracker.example.net/pixel?id=1'))
  assert.throws(
    () => guard.assertClean(),
    (e) =>
      e instanceof CaptureRefusal &&
      e.step === 'sign-in' &&
      e.message === "GET tracker.example.net/pixel was refused: tracker.example.net is not in this environment's hosts."
  )
})

test('a redirect hop to a read the project lists as writing, or a non-read, fails the run', () => {
  const forbidden = [{ method: 'GET', url: /\/items\?mode=recount/ }]
  const toForbidden = new RunGuard(policy({ forbidden }))
  toForbidden.handleRedirectHop(hop('GET', 'https://app.example.com/items?mode=recount'))
  assert.throws(() => toForbidden.assertClean(), /GET app\.example\.com\/items was sent by a redirect the guard cannot stop: the project lists it as a read that writes\./)
  const toWrite = new RunGuard(policy())
  toWrite.handleRedirectHop(hop('POST', 'https://app.example.com/items'))
  assert.throws(() => toWrite.assertClean(), /POST app\.example\.com\/items was sent by a redirect the guard cannot stop: this walk is read-only\./)
})

test('a request that is not a redirect hop is left to the route handler', () => {
  const guard = new RunGuard(policy())
  guard.handleRedirectHop(hop('GET', 'https://tracker.example.net/', { from: null }))
  assert.doesNotThrow(() => guard.assertClean())
})

test('a redirect hop hands its body to the rules', () => {
  const allowed = [{ method: 'POST', url: /https:\/\/app\.example\.com\/brief/, body: /^\{"date":"[\d-]+"\}$/ }]
  const plain = new RunGuard(policy({ allowed }))
  plain.handleRedirectHop(hop('POST', 'https://app.example.com/brief', { body: '{"date":"2026-10-05"}' }))
  assert.doesNotThrow(() => plain.assertClean())
  const refresh = new RunGuard(policy({ allowed }))
  refresh.handleRedirectHop(hop('POST', 'https://app.example.com/brief', { body: '{"date":"2026-10-05","refresh":true}' }))
  assert.throws(() => refresh.assertClean(), /POST app\.example\.com\/brief was sent by a redirect the guard cannot stop: this walk is read-only\./)
})

test('while learning, a redirect hop to an unlisted host is listed and the run does not fail', () => {
  const guard = new RunGuard(policy({ learning: true }))
  guard.handleRedirectHop(hop('GET', 'https://fonts.example.org/a.woff2'))
  assert.doesNotThrow(() => guard.assertClean())
  assert.deepEqual(guard.learned(), { unlisted: ['fonts.example.org'], refused: [] })
})

test('a redirect hop the guard cannot read fails the run instead of throwing', () => {
  const guard = new RunGuard(policy())
  const broken = { method: () => 'GET', url: () => 'https://app.example.com/x?token=abc', redirectedFrom: () => ({}), postData: () => { throw new Error('no body') } }
  assert.doesNotThrow(() => guard.handleRedirectHop(broken))
  assert.throws(() => guard.assertClean(), (e) => e.message === 'guard error on GET app.example.com/x')
})

test('a hosts entry with a port matches that exact host and port, and one without matches any port', () => {
  const local = policy({ hosts: ['127.0.0.1:4100'] })
  assert.equal(classifyRequest(get('http://127.0.0.1:4100/x'), local).action, 'continue')
  const other = classifyRequest(get('http://127.0.0.1:4200/x'), local)
  assert.equal(other.action, 'abort')
  assert.equal(other.kind, 'host')
  assert.equal(other.reason, "GET 127.0.0.1/x was refused: 127.0.0.1:4200 is not in this environment's hosts.")
  // No explicit port in the URL means the scheme's default, which a port-less URL reports as ''.
  assert.equal(classifyRequest(get('http://127.0.0.1/x'), local).action, 'abort')
  assert.equal(classifyRequest(get('https://app.example.com:8443/x'), policy()).action, 'continue')
  assert.equal(classifyRequest(get('wss://cdn.example.com:9443/live'), policy()).action, 'continue')
})

test('a hosts entry naming a default port matches a URL that leaves the port out', () => {
  const secure = policy({ hosts: ['app.example.com:443', 'plain.example.com:80'] })
  for (const url of ['https://app.example.com/x', 'https://app.example.com:443/x', 'wss://app.example.com/live', 'http://plain.example.com/x', 'ws://plain.example.com/live'])
    assert.equal(classifyRequest(get(url), secure).action, 'continue', url)
  for (const url of ['http://app.example.com/x', 'ws://app.example.com/live', 'https://plain.example.com/x', 'https://app.example.com:8443/x'])
    assert.equal(classifyRequest(get(url), secure).action, 'abort', url)
})

test('while learning, another port of a port-restricted host is unlisted and the listed port is listed', () => {
  const learning = policy({ hosts: ['127.0.0.1:4100'], learning: true })
  const verdict = classifyRequest(get('http://127.0.0.1:4200/x'), learning)
  assert.deepEqual([verdict.action, verdict.kind, verdict.host], ['continue', 'unlisted', '127.0.0.1'])
  assert.equal(classifyRequest(get('http://127.0.0.1:4100/x'), learning).kind, 'listed')
})

test('the host list is lower-cased, trimmed and stripped of a trailing dot', async () => {
  const guard = new RunGuard(policy({ hosts: ['  APP.Example.com.  ', 'Cdn.Example.com.:8443'] }))
  for (const url of ['https://app.example.com/a', 'https://cdn.example.com:8443/b']) {
    const route = fakeRoute('GET', url)
    await guard.handleRoute(route)
    assert.deepEqual(route.calls, ['continue'], url)
  }
  const wrongPort = fakeRoute('GET', 'https://cdn.example.com:9443/b')
  await guard.handleRoute(wrongPort)
  assert.deepEqual(wrongPort.calls, ['abort blockedbyclient'])
  assert.deepEqual(classifyRequest(get('https://app.example.com/'), policy({ hosts: [' APP.Example.com. '] })).action, 'continue')
})

test('RunGuard refuses a policy that is not usable, rather than guarding with it', () => {
  const refused = (extra, pattern) =>
    assert.throws(() => new RunGuard(policy(extra)), (e) => e instanceof CaptureRefusal && pattern.test(e.message), JSON.stringify(extra))
  for (const hosts of [undefined, null, 'app.example.com', {}, [''], ['  '], ['.'], [42], [null], ['app.example.com', ''], ['bad host'], ['https://app.example.com'], ['app.example.com/path'], ['user@app.example.com'], ['*.example.com'], ['app.example.com:0'], ['app.example.com:65536'], ['app.example.com:'], [':8443'], ['app..example.com']])
    refused({ hosts }, /hosts/)
  for (const readOnly of [undefined, null, 'true', 1, 0, {}]) refused({ readOnly }, /readOnly/)
  for (const learning of [null, 'yes', 1, 0, {}]) refused({ learning }, /learning/)
  refused({ readOnly: false, learning: true }, /read-only|readOnly/)
  refused({ forbidden: 'oops' }, /forbidden/)
  refused({ allowed: {} }, /allowed/)
  // Whatever is not an object of fields, an array included, is "missing", with its own sentence.
  for (const nothing of [undefined, null, 'policy', 42, [], ['app.example.com']])
    assert.throws(
      () => new RunGuard(nothing),
      (e) => e instanceof CaptureRefusal && e.message === 'The network policy is missing.',
      String(nothing)
    )
})

test('RunGuard accepts a usable policy, including the defaults and an empty host list', () => {
  assert.doesNotThrow(() => new RunGuard({ hosts: ['app.example.com'], readOnly: true }))
  assert.doesNotThrow(() => new RunGuard({ hosts: ['app.example.com', '127.0.0.1:4100', '[::1]:4100', 'localhost'], readOnly: false, learning: false }))
  assert.doesNotThrow(() => new RunGuard({ hosts: [], readOnly: true, learning: true }))
})

test('a policy changed after the guard was built does not change the guard', async () => {
  const given = policy()
  const guard = new RunGuard(given)
  given.readOnly = false
  given.hosts.push('tracker.example.net')
  const post = fakeRoute('POST', 'https://app.example.com/items')
  await guard.handleRoute(post)
  assert.deepEqual(post.calls, ['abort blockedbyclient'])
  const tracker = fakeRoute('GET', 'https://tracker.example.net/')
  await guard.handleRoute(tracker)
  assert.deepEqual(tracker.calls, ['abort blockedbyclient'])
})

test('a check that throws still aborts the route and fails the run, without the query or body', async () => {
  const unreadableBody = fakeRoute('POST', 'https://app.example.com/items?token=abc')
  unreadableBody.request = () => ({ method: () => 'POST', url: () => 'https://app.example.com/items?token=abc', postData: () => { throw new Error('no body') } })
  const guard = new RunGuard(policy())
  await guard.handleRoute(unreadableBody)
  assert.deepEqual(unreadableBody.calls, ['abort blockedbyclient'])
  assert.throws(() => guard.assertClean(), (e) => e instanceof CaptureRefusal && e.message === 'guard error on POST app.example.com/items')

  const stubbed = new RunGuard(policy(), { currentStep: () => 'open' })
  stubbed.check = () => { throw new Error('boom') }
  const route = fakeRoute('GET', 'https://app.example.com/list')
  await stubbed.handleRoute(route)
  assert.deepEqual(route.calls, ['abort blockedbyclient'])
  assert.throws(() => stubbed.assertClean(), (e) => e.step === 'open' && e.message === 'guard error on GET app.example.com/list')

  const odd = new RunGuard(policy())
  const unknown = fakeRoute(undefined, 'https://app.example.com/list')
  await odd.handleRoute(unknown)
  assert.deepEqual(unknown.calls, ['abort blockedbyclient'])
  assert.throws(() => odd.assertClean(), (e) => e.message === 'guard error on (unknown request)')
})

test('a guard error fails a learning run too: the guard could not judge the request', async () => {
  const guard = new RunGuard(policy({ learning: true }))
  guard.check = () => { throw new Error('boom') }
  const route = fakeRoute('GET', 'https://fonts.example.org/a.woff2')
  await guard.handleRoute(route)
  assert.deepEqual(route.calls, ['abort blockedbyclient'])
  assert.throws(() => guard.assertClean(), /guard error on GET fonts\.example\.org\/a\.woff2/)
})

test('a route or socket that cannot be answered neither rejects nor leaves an unhandled rejection', async () => {
  await withoutUnhandledRejections(async () => {
    const guard = new RunGuard(policy())
    const gone = (method, url, over = {}) => ({ ...fakeRoute(method, url), abort: async () => { throw new Error('page closed') }, continue: async () => { throw new Error('page closed') }, ...over })
    await guard.handleRoute(gone('POST', 'https://app.example.com/items'))
    await guard.handleRoute(gone('GET', 'https://app.example.com/list'))
    await guard.handleRoute(gone('POST', 'https://app.example.com/items', { abort: () => { throw new Error('sync') } }))
    await guard.handleRoute(gone('GET', 'https://app.example.com/list', { continue: () => { throw new Error('sync') } }))
    guard.handleWebSocket({ url: () => 'wss://push.example.net/hub', close: async () => { throw new Error('closed') }, connectToServer: () => {} })
    guard.handleWebSocket({ url: () => 'wss://push.example.net/hub', close: () => { throw new Error('sync') }, connectToServer: () => {} })
  })
})

test('RunGuard closes a WebSocket it cannot judge or connect, and fails the run', () => {
  const calls = []
  const socket = (over) => ({ url: () => 'wss://app.example.com/hub', close: () => calls.push('close'), connectToServer: () => calls.push('connect'), ...over })
  const unreadable = new RunGuard(policy())
  unreadable.handleWebSocket(socket({ url: () => { throw new Error('no url') } }))
  assert.deepEqual(calls, ['close'])
  assert.throws(() => unreadable.assertClean(), (e) => e.message === 'guard error on (unknown request)')
  calls.length = 0
  const unconnectable = new RunGuard(policy())
  unconnectable.handleWebSocket(socket({ connectToServer: () => { throw new Error('refused') } }))
  assert.deepEqual(calls, ['close'])
  assert.throws(() => unconnectable.assertClean(), (e) => e.message === 'guard error on GET app.example.com/hub')
})

test('a currentStep that throws does not stop a violation being recorded', () => {
  const guard = new RunGuard(policy(), { currentStep: () => { throw new Error('no step') } })
  guard.fail('The walk opened a second tab.')
  assert.throws(() => guard.assertClean(), (e) => e.step === null && e.message === 'The walk opened a second tab.')
})

test('only data, blob and about pages are local; every other scheme is refused, naming only the scheme', () => {
  for (const url of ['data:text/html,hi', 'blob:https://app.example.com/1', 'about:blank'])
    assert.equal(classifyRequest(get(url), policy()).kind, 'local', url)
  const ftp = classifyRequest(get('ftp://user:secret@files.example.net/a.txt?token=abc#frag'), policy())
  assert.deepEqual([ftp.action, ftp.kind], ['abort', 'scheme'])
  assert.equal(ftp.reason, 'A request with the ftp: scheme was refused.')
  for (const url of ['file:///tmp/a.html', 'javascript:alert(1)', 'chrome-extension://abc/page.html', 'filesystem:https://app.example.com/temporary/a']) {
    for (const readOnly of [true, false]) {
      const verdict = classifyRequest(get(url), policy({ readOnly }))
      assert.equal(verdict.action, 'abort', url)
      assert.equal(verdict.kind, 'scheme', url)
      assert.match(verdict.reason, /^A request with the [a-z-]+: scheme was refused\.$/, url)
    }
  }
})

test('a refused scheme is aborted and fails the run, and while learning it is listed as refused', async () => {
  const guard = new RunGuard(policy())
  const route = fakeRoute('GET', 'ftp://files.example.net/a.txt?token=abc')
  await guard.handleRoute(route)
  assert.deepEqual(route.calls, ['abort blockedbyclient'])
  assert.throws(() => guard.assertClean(), (e) => e.message === 'A request with the ftp: scheme was refused.')
  const learning = new RunGuard(policy({ learning: true }))
  await learning.handleRoute(fakeRoute('GET', 'ftp://files.example.net/a.txt'))
  assert.doesNotThrow(() => learning.assertClean())
  assert.deepEqual(learning.learned(), { unlisted: [], refused: ['(ftp: URL)'] })
})

test('refusal text carries the method, host and path, and nothing else of the URL', () => {
  assert.equal(describeRequest('GET', 'https://user:secret@app.example.com/a?token=abc#frag'), 'GET app.example.com/a')
  const verdict = classifyRequest(get('https://user:secret@tracker.example.net/a?token=abc#frag'), policy())
  assert.equal(verdict.reason, "GET tracker.example.net/a was refused: tracker.example.net is not in this environment's hosts.")
})

test('while learning, an allowed non-read to an unlisted host is listed as unlisted and not sent', async () => {
  const allowed = [{ method: 'POST', url: /https:\/\/[a-z.]+\/session\/token/ }]
  const learning = policy({ learning: true, allowed })
  const verdict = classifyRequest({ method: 'POST', url: 'https://other.example.org/session/token' }, learning)
  assert.deepEqual([verdict.action, verdict.kind, verdict.host], ['abort', 'unlisted', 'other.example.org'])
  // On a listed host the same request is still allowed.
  assert.equal(classifyRequest({ method: 'POST', url: 'https://app.example.com/session/token' }, learning).action, 'continue')
  const guard = new RunGuard(learning)
  const route = fakeRoute('POST', 'https://other.example.org/session/token')
  await guard.handleRoute(route)
  assert.deepEqual(route.calls, ['abort blockedbyclient'])
  assert.doesNotThrow(() => guard.assertClean())
  assert.deepEqual(guard.learned(), { unlisted: ['other.example.org'], refused: ['POST https://other.example.org/session/token (no body)'] })
})

// ---- Mutation check: branches no test pinned until a mutant survived ----

test('a hosts entry the guard cannot read matches nothing, and does not stop the readable ones matching', () => {
  const mixed = policy({ hosts: ['bad host', null, 'app.example.com'] })
  assert.equal(classifyRequest(get('https://app.example.com/x'), mixed).action, 'continue')
  assert.equal(classifyRequest(get('https://tracker.example.net/x'), mixed).kind, 'host')
  assert.equal(classifyRequest(get('https://app.example.com/x'), policy({ hosts: ['bad host'] })).kind, 'host')
})

test('ports 1 to 65535 are valid in a hosts entry, written with or without leading zeros', () => {
  assert.deepEqual(parseHostEntry('app.example.com:1'), { host: 'app.example.com', port: '1' })
  assert.deepEqual(parseHostEntry('app.example.com:65535'), { host: 'app.example.com', port: '65535' })
  assert.deepEqual(parseHostEntry('app.example.com:08443'), { host: 'app.example.com', port: '8443' })
  assert.equal(parseHostEntry('app.example.com:0'), null)
  assert.equal(parseHostEntry('app.example.com:65536'), null)
  // The written form and the URL's form meet at the same port.
  const edges = policy({ hosts: ['a.example.com:1', 'b.example.com:65535', 'c.example.com:08443'] })
  for (const url of ['http://a.example.com:1/x', 'http://b.example.com:65535/x', 'https://c.example.com:8443/x'])
    assert.equal(classifyRequest(get(url), edges).action, 'continue', url)
  for (const url of ['http://a.example.com:2/x', 'http://b.example.com:65534/x', 'https://c.example.com:844/x'])
    assert.equal(classifyRequest(get(url), edges).action, 'abort', url)
})

test('a run fails with the first violation, although later ones are recorded as well', () => {
  let step = 'open'
  const guard = new RunGuard(policy(), { currentStep: () => step })
  guard.fail('The walk opened a second tab.')
  step = 'save'
  guard.fail('The walk opened a third tab.')
  assert.equal(guard.violations.length, 2)
  assert.throws(
    () => guard.assertClean(),
    (e) => e instanceof CaptureRefusal && e.step === 'open' && e.message === 'The walk opened a second tab.'
  )
})

test('a redirect hop whose request cannot report a body is still judged', () => {
  const noBody = (url) => ({ method: () => 'GET', url: () => url, redirectedFrom: () => ({}) })
  const guard = new RunGuard(policy())
  guard.handleRedirectHop(noBody('https://app.example.com/home'))
  assert.doesNotThrow(() => guard.assertClean())
  guard.handleRedirectHop(noBody('https://tracker.example.net/pixel'))
  assert.throws(
    () => guard.assertClean(),
    (e) => e.message === "GET tracker.example.net/pixel was refused: tracker.example.net is not in this environment's hosts."
  )
})

// ---- A body pattern needs a body that was read ----
//
// Playwright reports a request with no body, and one whose body it cannot read, the same way:
// postData() is null. A rule with a body pattern must never match either, whatever the pattern:
// "^$" and ".*" match the empty string, and would otherwise let an unreadable body through.

const BEACON = 'https://app.example.com/beacon'
// Patterns that match the empty string, and so match a body that was never read if it becomes ''.
const MATCHES_EMPTY = [/^$/, /.*/, /^/]

test('a rule with a body pattern never matches a request without a readable body', () => {
  for (const body of MATCHES_EMPTY) {
    const rule = { method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body }
    assert.equal(matchesRule(rule, { method: 'POST', url: BEACON }), false, `${body} against a missing body`)
    assert.equal(matchesRule(rule, { method: 'POST', url: BEACON, body: undefined }), false, `${body} against undefined`)
    assert.equal(matchesRule(rule, { method: 'POST', url: BEACON, body: null }), false, `${body} against null`)
    // The guard refuses it as a write: the rule did not allow it.
    for (const given of [undefined, null]) {
      const verdict = classifyRequest({ method: 'POST', url: BEACON, body: given }, policy({ allowed: [rule] }))
      assert.deepEqual([verdict.action, verdict.kind], ['abort', 'write'], `${body} against ${given}`)
    }
  }
})

test('a rule without a body pattern still matches a request without a body', () => {
  const rule = { method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }
  assert.equal(matchesRule(rule, { method: 'POST', url: BEACON }), true)
  assert.equal(matchesRule(rule, { method: 'POST', url: BEACON, body: null }), true)
  assert.equal(classifyRequest({ method: 'POST', url: BEACON, body: null }, policy({ allowed: [rule] })).action, 'continue')
})

test('an empty string is a body that was read, and a body pattern is tried on it', () => {
  assert.equal(matchesRule({ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body: /^$/ }, { method: 'POST', url: BEACON, body: '' }), true)
  assert.equal(matchesRule({ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body: /^\{/ }, { method: 'POST', url: BEACON, body: '' }), false)
})

test('a body pattern is tried on a body that was read, even a permissive one', () => {
  for (const body of MATCHES_EMPTY)
    assert.equal(matchesRule({ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body }, { method: 'POST', url: BEACON, body: '{"page":"home"}' }), body.source !== '^$', String(body))
})

test('RunGuard aborts a route whose body is null when the rule has a body pattern', async () => {
  for (const body of MATCHES_EMPTY) {
    const guard = new RunGuard(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body }] }))
    const route = fakeRoute('POST', BEACON, null)
    await guard.handleRoute(route)
    assert.deepEqual(route.calls, ['abort blockedbyclient'], String(body))
    // The rule matches the whole URL, so the refusal says that its body pattern is what failed.
    assert.throws(
      () => guard.assertClean(),
      (e) =>
        e.message ===
        'POST app.example.com/beacon was refused: this walk is read-only (readOnlyAllowed[0] has a body pattern, and this request has no readable body).'
    )
  }
  // The same request goes through a rule that has no body pattern, and a read body goes through a permissive one.
  const bodiless = new RunGuard(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }] }))
  const open = fakeRoute('POST', BEACON, null)
  await bodiless.handleRoute(open)
  assert.deepEqual(open.calls, ['continue'])
  const permissive = new RunGuard(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body: /.*/ }] }))
  const read = fakeRoute('POST', BEACON, '{"page":"home"}')
  await permissive.handleRoute(read)
  assert.deepEqual(read.calls, ['continue'])
})

test('a redirect hop without a readable body fails the run when the rule has a body pattern', () => {
  const noPostData = (url) => ({ method: () => 'POST', url: () => url, redirectedFrom: () => ({}) })
  for (const body of MATCHES_EMPTY) {
    const rules = policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body }] })
    const withNull = new RunGuard(rules)
    withNull.handleRedirectHop(hop('POST', BEACON, { body: null }))
    assert.throws(() => withNull.assertClean(), /POST app\.example\.com\/beacon was sent by a redirect the guard cannot stop: this walk is read-only\./, `${body} with a null body`)
    const without = new RunGuard(rules)
    without.handleRedirectHop(noPostData(BEACON))
    assert.throws(() => without.assertClean(), /POST app\.example\.com\/beacon was sent by a redirect the guard cannot stop: this walk is read-only\./, `${body} without postData`)
  }
  // A rule without a body pattern lets the same hop through, and a read body goes through a permissive pattern.
  const bodiless = new RunGuard(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }] }))
  bodiless.handleRedirectHop(hop('POST', BEACON, { body: null }))
  bodiless.handleRedirectHop(noPostData(BEACON))
  assert.doesNotThrow(() => bodiless.assertClean())
  const permissive = new RunGuard(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/, body: /.*/ }] }))
  permissive.handleRedirectHop(hop('POST', BEACON, { body: '{"page":"home"}' }))
  assert.doesNotThrow(() => permissive.assertClean())
})

// ---- readOnlyAllowed: what an allowed rule can and cannot do ----

const post = (url, body) => ({ method: 'POST', url, body })

test('an allowed rule allows its own method only, in any letter case', () => {
  const allowed = [{ method: 'post', url: /https:\/\/app\.example\.com\/beacon/ }]
  assert.equal(classifyRequest(post(BEACON), policy({ allowed })).action, 'continue')
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const verdict = classifyRequest({ method, url: BEACON }, policy({ allowed }))
    assert.deepEqual([verdict.action, verdict.kind], ['abort', 'write'], method)
  }
})

test('an allowed rule is no way past the host lock, however its pattern matches', async () => {
  const loose = [{ method: 'POST', url: /.*/ }]
  for (const url of [
    'https://tracker.example.net/beacon',
    'https://app.example.com@tracker.example.net/beacon',
    'https://app.example.com.tracker.example.net/beacon',
    'https://tracker.example.net/beacon?next=https://app.example.com/beacon'
  ]) {
    const verdict = classifyRequest(post(url), policy({ allowed: loose }))
    assert.deepEqual([verdict.action, verdict.kind], ['abort', 'host'], url)
    const guard = new RunGuard(policy({ allowed: loose }))
    const route = fakeRoute('POST', url)
    await guard.handleRoute(route)
    assert.deepEqual(route.calls, ['abort blockedbyclient'], url)
    const hopped = new RunGuard(policy({ allowed: loose }))
    hopped.handleRedirectHop(hop('POST', url))
    assert.throws(() => hopped.assertClean(), /is not in this environment's hosts\./, url)
  }
  // Learning lists the host and still sends nothing to it.
  const learning = classifyRequest(post('https://tracker.example.net/beacon'), policy({ allowed: loose, learning: true }))
  assert.deepEqual([learning.action, learning.kind, learning.host], ['abort', 'unlisted', 'tracker.example.net'])
  // A WebSocket opens with a GET. A project cannot write an allowed GET rule (a read needs none), so
  // the policy is built by hand: even then the socket to an unlisted host stays closed.
  const sockets = new RunGuard(policy({ allowed: [{ method: 'GET', url: /.*/ }] }))
  const calls = []
  const ws = (url) => ({ url: () => url, close: () => calls.push(`close ${url}`), connectToServer: () => calls.push(`connect ${url}`) })
  sockets.handleWebSocket(ws('wss://tracker.example.net/hub'))
  sockets.handleWebSocket(ws('wss://app.example.com/hub'))
  assert.deepEqual(calls, ['close wss://tracker.example.net/hub', 'connect wss://app.example.com/hub'])
  assert.throws(() => sockets.assertClean(), /GET tracker\.example\.net\/hub was refused: tracker\.example\.net is not in this environment's hosts\./)
})

test('a forbidden rule wins over an allowed one, for a request, a route and a redirect hop', async () => {
  const allowed = [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }]
  const forbidden = [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }]
  const verdict = classifyRequest(post(BEACON), policy({ allowed, forbidden }))
  assert.deepEqual([verdict.action, verdict.kind], ['abort', 'forbidden'])
  const guard = new RunGuard(policy({ allowed, forbidden }))
  const route = fakeRoute('POST', BEACON)
  await guard.handleRoute(route)
  assert.deepEqual(route.calls, ['abort blockedbyclient'])
  assert.throws(() => guard.assertClean(), /POST app\.example\.com\/beacon was refused: the project lists it as a read that writes\./)
  const hopped = new RunGuard(policy({ allowed, forbidden }))
  hopped.handleRedirectHop(hop('POST', BEACON))
  assert.throws(() => hopped.assertClean(), /the project lists it as a read that writes\./)
  // A read the project both allows and forbids is forbidden too: the forbidden list is checked first.
  const read = [{ method: 'GET', url: /\/recount$/ }]
  const forbiddenRead = classifyRequest(get('https://app.example.com/recount'), policy({ allowed: read, forbidden: read }))
  assert.deepEqual([forbiddenRead.action, forbiddenRead.kind], ['abort', 'forbidden'])
})

test('allowed rules change nothing for a walk that declares writes, and a forbidden rule still does not apply', () => {
  const allowed = [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }]
  const writes = policy({ readOnly: false, allowed })
  assert.equal(classifyRequest(post('https://app.example.com/items'), writes).action, 'continue')
  assert.equal(classifyRequest(post(BEACON), writes).action, 'continue')
  assert.equal(classifyRequest(post('https://tracker.example.net/beacon'), writes).kind, 'host')
  // Without the read-only flag the rules are not consulted, so a listed host is the only gate.
  const forbidden = [{ method: 'POST', url: /https:\/\/app\.example\.com\/beacon/ }]
  assert.equal(classifyRequest(post(BEACON), policy({ readOnly: false, allowed, forbidden })).action, 'continue')
})

// ---- An allowed rule matches the whole URL and the whole body ----
//
// A forbidden rule that is too broad only refuses too much, so it is searched for in the URL. An
// allowed rule that is too broad lets too much through, so its url and body must each match from the
// first character to the last. The pattern is wrapped as ^(?:pattern)$ and the g, m and y flags are
// dropped: "m" would let ^ and $ match at any line of the text.

const WHOLE = { whole: true }
const at = (url, body) => ({ method: 'POST', url, body })
const DATE_BODY = '{"date":"2026-10-05"}'

test('a whole-URL rule matches the entire URL, and a search rule matches a part of it', () => {
  const url = 'https://app.example.com/session/token'
  const request = at(url)
  const pattern = (source, flags) => ({ method: 'POST', url: new RegExp(source, flags) })
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/token'), request, WHOLE), true)
  assert.equal(matchesRule(pattern('/session/token$'), request), true, 'search finds a part')
  assert.equal(matchesRule(pattern('/session/token$'), request, WHOLE), false)
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/tok'), request, WHOLE), false)
  assert.equal(matchesRule(pattern('app\\.example\\.com/session/token'), request, WHOLE), false)
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/token/revoke-all'), at(`${url}/revoke-all?x=1`), WHOLE), false)
  // The query is part of the URL: a rule for the bare path does not allow a request with a query.
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/token'), at(`${url}?next=1`), WHOLE), false)
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/token\\?next=\\d'), at(`${url}?next=1`), WHOLE), true)
  // An alternation is whole as a group: each branch must match the entire URL.
  const either = pattern('https://app\\.example\\.com/a|https://app\\.example\\.com/b')
  assert.equal(matchesRule(either, at('https://app.example.com/a'), WHOLE), true)
  assert.equal(matchesRule(either, at('https://app.example.com/b'), WHOLE), true)
  assert.equal(matchesRule(either, at('https://app.example.com/a/more'), WHOLE), false)
  assert.equal(matchesRule(either, at('https://app.example.com/more/b'), WHOLE), false)
  // The i flag is kept, and the others the pattern has with it.
  assert.equal(matchesRule(pattern('https://APP\\.example\\.com/Session/Token', 'i'), request, WHOLE), true)
  assert.equal(matchesRule(pattern('https://APP\\.example\\.com/Session/Token'), request, WHOLE), false)
  // The lower-case method still has to match.
  assert.equal(matchesRule(pattern('https://app\\.example\\.com/session/token'), { method: 'PUT', url }, WHOLE), false)
})

test('an allowed rule url that is only a part of the URL allows nothing', () => {
  const rule = (url) => policy({ allowed: [{ method: 'POST', url }] })
  const verdict = (url, rules) => classifyRequest(post(url), rules)
  // ".../delete?next=/session/token" ends in the rule's text, but is another endpoint.
  assert.equal(verdict('https://app.example.com/delete?next=/session/token', rule(/\/session\/token$/)).kind, 'write')
  // "/session/token/revoke-all" starts with the rule's text, but is another endpoint.
  assert.equal(verdict('https://app.example.com/session/token/revoke-all', rule(/\/session\/token/)).kind, 'write')
  // "." is one character, not any URL.
  assert.equal(verdict('https://app.example.com/session/token', rule(/./)).kind, 'write')
  assert.equal(matchesRule({ method: 'POST', url: /./ }, at('x'), WHOLE), true, 'a one-character URL')
  assert.equal(matchesRule({ method: 'POST', url: /./ }, at('xy'), WHOLE), false)
  // The exact URL, query included, is allowed; the same pattern does not allow another query.
  const exact = rule(/https:\/\/app\.example\.com\/brief\?date=\d{8}&lang=en/)
  assert.equal(verdict('https://app.example.com/brief?date=20261005&lang=en', exact).action, 'continue')
  assert.equal(verdict('https://app.example.com/brief?date=20261005&lang=en&refresh=1', exact).kind, 'write')
  assert.equal(verdict('https://app.example.com/brief?date=20261005', exact).kind, 'write')
  // A readOnlyForbidden rule is still searched for in the URL: the broad pattern refuses more, which is safe.
  const forbidden = [{ method: 'GET', url: /mode=recount/ }]
  assert.equal(classifyRequest(get('https://app.example.com/items?mode=recount&x=1'), policy({ forbidden })).kind, 'forbidden')
})

test('an allowed rule body matches the whole body, not a part of it', () => {
  const rule = (body) => ({ method: 'POST', url: /https:\/\/app\.example\.com\/brief/, body })
  const request = (body) => at('https://app.example.com/brief', body)
  const verdict = (body, pattern) => classifyRequest(request(body), policy({ allowed: [rule(pattern)] })).action
  // The exact body is allowed.
  assert.equal(verdict(DATE_BODY, /\{"date":"[\d-]+"\}/), 'continue')
  assert.equal(verdict(DATE_BODY, /^\{"date":"[\d-]+"\}$/), 'continue')
  assert.equal(verdict(DATE_BODY, /\{"date":"2026-10-05"\}/), 'continue')
  // A pattern with no anchors finds part of a bigger body, which must be refused.
  assert.equal(verdict('{"date":"2026-10-05","refresh":true}', /"date":"[\d-]+"/), 'abort')
  assert.equal(verdict('{"date":"2026-10-05","refresh":true}', /\{"date":"[\d-]+"/), 'abort')
  // Only the start is anchored.
  assert.equal(verdict('{"token":"a","revoke":true}', /^\{"token"/), 'abort')
  assert.equal(verdict('{"token":"a"}', /^\{"token"/), 'abort')
  // Only the end is anchored.
  assert.equal(verdict('{"token":"a","revoke":true}', /"revoke":true\}$/), 'abort')
  // The m flag lets ^ and $ match at any line: the pattern matches the last line of a bigger body.
  assert.equal(verdict('{"a":1}\n{"date":"2026-10-05"}', /^\{"date":"[\d-]+"\}$/m), 'abort')
  assert.equal(verdict('{"date":"2026-10-05"}\nrefresh', /^\{"date":"[\d-]+"\}$/m), 'abort')
  assert.equal(verdict(DATE_BODY, /^\{"date":"[\d-]+"\}$/m), 'continue')
  // An alternation: "^A$|^B" is A, or anything that starts with B, until the pattern is whole as a group.
  assert.equal(verdict('A', /^A$|^B/), 'continue')
  assert.equal(verdict('B', /^A$|^B/), 'continue')
  assert.equal(verdict('B and more', /^A$|^B/), 'abort')
  assert.equal(verdict('A and more', /A|B/), 'abort')
  assert.equal(verdict('more B', /A|B/), 'abort')
  // The g and y flags change nothing: the same pattern gives the same answer every time.
  for (const flags of ['g', 'y', 'gy'])
    for (let round = 0; round < 3; round++) {
      assert.equal(verdict(DATE_BODY, new RegExp('\\{"date":"[\\d-]+"\\}', flags)), 'continue', flags)
      assert.equal(verdict(`${DATE_BODY} `, new RegExp('\\{"date":"[\\d-]+"\\}', flags)), 'abort', flags)
    }
  // The i flag is kept.
  assert.equal(verdict('{"DATE":"x"}', /\{"date":"x"\}/i), 'continue')
  assert.equal(verdict('{"DATE":"x"}', /\{"date":"x"\}/), 'abort')
  // A body that was not read still matches nothing, however loose the pattern.
  assert.equal(classifyRequest(request(null), policy({ allowed: [rule(/.*/)] })).action, 'abort')
})

test('matching the whole text is only for allowed rules: a forbidden rule is searched for', () => {
  const forbidden = [{ method: 'POST', url: /\/items/ }]
  assert.equal(classifyRequest(post('https://app.example.com/items/7/archive'), policy({ forbidden })).kind, 'forbidden')
  const allowed = [{ method: 'POST', url: /\/items/ }]
  assert.equal(classifyRequest(post('https://app.example.com/items/7/archive'), policy({ allowed })).kind, 'write')
})

// ---- A redirect hop is already on the wire ----
//
// A 307 or 308 makes the browser send the same method and the same body to the new URL, and it does
// so before the guard hears of the hop. The guard can record a hop, not stop it, so it never says a
// hop was "refused" when it was sent. Outside learning the browser's resolver still refuses a host
// that is not listed, and that stays "refused".

const SENT = 'was sent by a redirect the guard cannot stop'
const TOKEN_RULE = { method: 'POST', url: /https:\/\/app\.example\.com\/session\/token/ }
const hopsFor = (rules) => {
  const guard = new RunGuard(rules)
  return { guard, hop: (method, url, extra) => guard.handleRedirectHop(hop(method, url, extra)) }
}
const failureOf = (guard) => {
  try {
    guard.assertClean()
  } catch (error) {
    return error.message
  }
  return null
}

test('a non-read hop that no rule allows fails the run, and says it was sent, not refused', () => {
  const rules = policy({ allowed: [TOKEN_RULE] })
  const toItems = hopsFor(rules)
  toItems.hop('POST', 'https://app.example.com/items', { body: '{"name":"x"}' })
  assert.equal(failureOf(toItems.guard), `POST app.example.com/items ${SENT}: this walk is read-only.`)
  // A hop to a URL a rule does allow is fine, and so is one the rule's body does not mention.
  const toToken = hopsFor(rules)
  toToken.hop('POST', 'https://app.example.com/session/token')
  assert.equal(failureOf(toToken.guard), null)
  // The rule's method is part of it.
  const put = hopsFor(rules)
  put.hop('PUT', 'https://app.example.com/session/token')
  assert.equal(failureOf(put.guard), `PUT app.example.com/session/token ${SENT}: this walk is read-only.`)
  // A rule is read as for a first request: its url and body must match the whole URL and body.
  const partial = hopsFor(policy({ allowed: [{ method: 'POST', url: /https:\/\/app\.example\.com\/session\/token/ }] }))
  partial.hop('POST', 'https://app.example.com/session/token/revoke-all')
  assert.equal(failureOf(partial.guard), `POST app.example.com/session/token/revoke-all ${SENT}: this walk is read-only.`)
  // A hop of a walk that declares writes is not judged by the rules at all.
  const writes = hopsFor(policy({ readOnly: false, allowed: [TOKEN_RULE], forbidden: [{ method: 'POST', url: /items/ }] }))
  writes.hop('POST', 'https://app.example.com/items')
  assert.equal(failureOf(writes.guard), null)
})

test('a forbidden read hop fails the run with what happened, and a forbidden rule beats an allowed one', () => {
  const forbidden = [{ method: 'GET', url: /\/items\?mode=recount/ }]
  const read = hopsFor(policy({ forbidden }))
  read.hop('GET', 'https://app.example.com/items?mode=recount')
  assert.equal(failureOf(read.guard), `GET app.example.com/items ${SENT}: the project lists it as a read that writes.`)
  const both = hopsFor(policy({ forbidden: [{ method: 'POST', url: /session\/token/ }], allowed: [TOKEN_RULE] }))
  both.hop('POST', 'https://app.example.com/session/token')
  assert.equal(failureOf(both.guard), `POST app.example.com/session/token ${SENT}: the project lists it as a read that writes.`)
})

test('a non-read hop to an unlisted host is refused outside learning, whatever the rules say about the method', () => {
  // The browser's own resolver refuses an unlisted name, so here "refused" is true, and the host is
  // what the sentence names: not the read-only rule, which the request would also break.
  const expected = "POST tracker.example.net/items was refused: tracker.example.net is not in this environment's hosts."
  const plain = hopsFor(policy())
  plain.hop('POST', 'https://tracker.example.net/items')
  assert.equal(failureOf(plain.guard), expected)
  const allowed = hopsFor(policy({ allowed: [{ method: 'POST', url: /.*/ }] }))
  allowed.hop('POST', 'https://tracker.example.net/items')
  assert.equal(failureOf(allowed.guard), expected)
  const forbidden = hopsFor(policy({ forbidden: [{ method: 'POST', url: /items/ }] }))
  forbidden.hop('POST', 'https://tracker.example.net/items')
  assert.equal(failureOf(forbidden.guard), expected)
})

test('while learning, a non-read hop to an unlisted host is listed as unlisted, never as refused, and fails the run', () => {
  const sentTo = "POST tracker.example.net/items was sent by a redirect the guard cannot stop: tracker.example.net is not in this environment's hosts."
  for (const allowed of [[], [{ method: 'POST', url: /.*/ }]]) {
    const learning = hopsFor(policy({ learning: true, allowed }))
    learning.hop('POST', 'https://tracker.example.net/items', { body: '{"name":"x"}' })
    assert.deepEqual(learning.guard.learned(), { unlisted: ['tracker.example.net'], refused: [] })
    assert.equal(failureOf(learning.guard), sentTo)
  }
  // A listed host on another port is named with its port.
  const port = hopsFor(policy({ learning: true, hosts: ['app.example.com:8443'] }))
  port.hop('POST', 'https://app.example.com/items')
  assert.equal(failureOf(port.guard), "POST app.example.com/items was sent by a redirect the guard cannot stop: app.example.com:443 is not in this environment's hosts.")
  // A read hop to an unlisted host is listed too, and the run goes on.
  const read = hopsFor(policy({ learning: true }))
  read.hop('GET', 'https://tracker.example.net/pixel')
  assert.deepEqual(read.guard.learned(), { unlisted: ['tracker.example.net'], refused: [] })
  assert.equal(failureOf(read.guard), null)
  // A first request, which the guard can stop, is still listed as refused, as before, and its host
  // is listed as one the walk used.
  const first = new RunGuard(policy({ learning: true }))
  first.check({ method: 'POST', url: 'https://tracker.example.net/items' })
  assert.deepEqual(first.learned(), { unlisted: ['tracker.example.net'], refused: ['POST https://tracker.example.net/items (no body)'] })
})

test('while learning, a non-read hop to a listed host that no rule allows fails the run instead of being listed as refused', () => {
  const learning = hopsFor(policy({ learning: true, allowed: [TOKEN_RULE] }))
  learning.hop('POST', 'https://app.example.com/items')
  assert.deepEqual(learning.guard.learned(), { unlisted: [], refused: [] })
  assert.equal(failureOf(learning.guard), `POST app.example.com/items ${SENT}: this walk is read-only.`)
  const allowed = hopsFor(policy({ learning: true, allowed: [TOKEN_RULE] }))
  allowed.hop('POST', 'https://app.example.com/session/token')
  assert.equal(failureOf(allowed.guard), null)
  const forbidden = hopsFor(policy({ learning: true, forbidden: [{ method: 'GET', url: /recount/ }] }))
  forbidden.hop('GET', 'https://app.example.com/items?mode=recount')
  assert.deepEqual(forbidden.guard.learned(), { unlisted: [], refused: [] })
  assert.equal(failureOf(forbidden.guard), `GET app.example.com/items ${SENT}: the project lists it as a read that writes.`)
  // A forbidden read to an unlisted host: the host is listed, and the forbidden read is the failure.
  const both = hopsFor(policy({ learning: true, forbidden: [{ method: 'GET', url: /recount/ }] }))
  both.hop('GET', 'https://tracker.example.net/items?mode=recount')
  assert.deepEqual(both.guard.learned(), { unlisted: ['tracker.example.net'], refused: [] })
  assert.equal(failureOf(both.guard), `GET tracker.example.net/items ${SENT}: the project lists it as a read that writes.`)
})

test('a hop to a scheme the guard refuses, or to a page the browser builds, is judged on its own', () => {
  // Nothing is sent to these: the browser refuses a scheme it cannot fetch, and a data: page has no network.
  const outside = hopsFor(policy())
  outside.hop('GET', 'ftp://app.example.com/file')
  assert.equal(failureOf(outside.guard), 'A request with the ftp: scheme was refused.')
  const learning = hopsFor(policy({ learning: true }))
  learning.hop('GET', 'ftp://app.example.com/file')
  assert.deepEqual(learning.guard.learned(), { unlisted: [], refused: ['(ftp: URL)'] })
  assert.equal(failureOf(learning.guard), null)
  const local = hopsFor(policy({ allowed: [] }))
  local.hop('POST', 'data:text/plain,hello')
  assert.equal(failureOf(local.guard), null)
  assert.deepEqual(local.guard.learned(), { unlisted: [], refused: [] })
})

// ---- What a refusal says, so that a whole-URL rule can be learned ----
//
// An allowed rule matches the whole URL and the whole body, so a rule written for the path alone
// allows nothing. The refusal says which rule came close, by its index; a learning run lists each
// refused non-read with what a rule has to match (scheme, host, port, path, query names) and whether
// it has a body. Neither ever shows a query value or the body.

test('a refused non-read is described by scheme, host, path and query names, never a value or the body', () => {
  assert.equal(
    describeNonRead({ method: 'post', url: 'https://app.example.com/hub/negotiate?negotiateVersion=1', body: null }),
    'POST https://app.example.com/hub/negotiate?negotiateVersion=… (no body)'
  )
  assert.equal(
    describeNonRead({ method: 'PUT', url: 'http://127.0.0.1:4100/items?token=SECRET-VALUE&id=7#SECRET-FRAGMENT', body: '{"secret":"BODY-VALUE"}' }),
    'PUT http://127.0.0.1:4100/items?token=…&id=… (with a body)'
  )
  // A part of the query without "=" could be a value by itself, so it is left out too, and so is
  // the userinfo. An empty body is a body that was read.
  assert.equal(
    describeNonRead({ method: 'POST', url: 'https://user:SECRET-PASSWORD@app.example.com/a?SECRET-BARE&&x=', body: '' }),
    'POST https://app.example.com/a?…&x=… (with a body)'
  )
  assert.equal(describeNonRead({ method: 'POST', url: 'https://app.example.com/a?' }), 'POST https://app.example.com/a (no body)')
  assert.equal(describeNonRead({ method: 'POST', url: 'not a url' }), 'POST (unreadable URL)')
})

test('a learning list never holds a query value or a body', async () => {
  const guard = new RunGuard(policy({ learning: true }))
  await guard.handleRoute(fakeRoute('POST', 'https://app.example.com/items?token=SECRET-VALUE&session=SECRET-ID', '{"password":"SECRET-BODY"}'))
  const listed = JSON.stringify(guard.learned())
  assert.match(listed, /POST https:\/\/app\.example\.com\/items\?token=…&session=… \(with a body\)/)
  assert.doesNotMatch(listed, /SECRET/)
})

test('a refused non-read names the allowed rule that came close, and never the query or the body', () => {
  const allowed = [
    // Another method: never named.
    { method: 'PUT', url: /https:\/\/app\.example\.com\/session\/token/ },
    // Matches a part of the URL only.
    { method: 'POST', url: /\/session\/token/ },
    // Matches the whole URL, with a body pattern.
    { method: 'post', url: /https:\/\/app\.example\.com\/brief/, body: /\{"date":"[\d-]+"\}/ }
  ]
  const reason = (url, body) => classifyRequest({ method: 'POST', url, body }, policy({ allowed })).reason
  assert.equal(
    reason('https://app.example.com/session/token?token=SECRET', null),
    'POST app.example.com/session/token was refused: this walk is read-only (readOnlyAllowed[1] matches part of this URL but not all of it).'
  )
  assert.equal(
    reason('https://app.example.com/brief', '{"date":"2026-10-05","secret":"SECRET"}'),
    'POST app.example.com/brief was refused: this walk is read-only (readOnlyAllowed[2] matches this URL but not its body).'
  )
  assert.equal(
    reason('https://app.example.com/brief', null),
    'POST app.example.com/brief was refused: this walk is read-only (readOnlyAllowed[2] has a body pattern, and this request has no readable body).'
  )
  // No rule of the method comes close, or there are no rules: the sentence is as before.
  assert.equal(reason('https://app.example.com/items', null), 'POST app.example.com/items was refused: this walk is read-only.')
  assert.equal(
    classifyRequest({ method: 'PUT', url: 'https://app.example.com/items/session/token' }, policy({ allowed: allowed.slice(1) })).reason,
    'PUT app.example.com/items/session/token was refused: this walk is read-only.'
  )
})

test('the rule that matches the whole URL is named before one that matches a part of it, and the first of each kind', () => {
  const reason = (allowed, body) => classifyRequest({ method: 'POST', url: 'https://app.example.com/brief', body }, policy({ allowed })).reason
  const part = { method: 'POST', url: /\/brief/ }
  const whole = { method: 'POST', url: /https:\/\/app\.example\.com\/brief/, body: /x/ }
  assert.match(reason([part, whole], 'y'), /\(readOnlyAllowed\[1\] matches this URL but not its body\)\.$/)
  assert.match(reason([whole, part], 'y'), /\(readOnlyAllowed\[0\] matches this URL but not its body\)\.$/)
  assert.match(reason([part, part], 'y'), /\(readOnlyAllowed\[0\] matches part of this URL but not all of it\)\.$/)
  assert.match(reason([whole, { ...whole, body: /z/ }], 'y'), /\(readOnlyAllowed\[0\] matches this URL/)
})

test('a learning run lists the rule that came close with the request it refused', async () => {
  const allowed = [{ method: 'POST', url: /\/beacon/ }]
  const guard = new RunGuard(policy({ learning: true, allowed }))
  await guard.handleRoute(fakeRoute('POST', 'https://app.example.com/beacon?page=SECRET', '{}'))
  assert.deepEqual(guard.learned().refused, [
    'POST https://app.example.com/beacon?page=… (with a body) (readOnlyAllowed[0] matches part of this URL but not all of it)'
  ])
})

test('only a learning run lists the hosts the walk used; elsewhere an unlisted host fails the run', () => {
  const guard = new RunGuard(policy())
  guard.check({ method: 'POST', url: 'https://tracker.example.net/items' })
  guard.check(get('https://fonts.example.org/a.woff2'))
  assert.deepEqual(guard.learned(), { unlisted: [], refused: [] })
  assert.throws(() => guard.assertClean(), /tracker\.example\.net\/items was refused: this walk is read-only\./)
  // While learning, a host reached only by a forbidden read is listed too.
  const learning = new RunGuard(policy({ learning: true, forbidden: [{ method: 'GET', url: /recount/ }] }))
  learning.check(get('https://tracker.example.net/items?mode=recount'))
  assert.deepEqual(learning.learned(), { unlisted: ['tracker.example.net'], refused: ['GET tracker.example.net/items'] })
})

test('the guard keeps frozen copies of its lists: the caller cannot change them, and they cannot be changed', async () => {
  const forbidden = []
  const allowed = []
  const hosts = ['app.example.com']
  const guard = new RunGuard({ hosts, readOnly: true, forbidden, allowed })
  forbidden.push({ method: 'GET', url: /home/ })
  allowed.push({ method: 'POST', url: /.*/ })
  hosts.push('tracker.example.net')
  const home = fakeRoute('GET', 'https://app.example.com/home')
  await guard.handleRoute(home)
  assert.deepEqual(home.calls, ['continue'])
  const post = fakeRoute('POST', 'https://app.example.com/items')
  await guard.handleRoute(post)
  assert.deepEqual(post.calls, ['abort blockedbyclient'])
  for (const list of ['hosts', 'forbidden', 'allowed']) assert.equal(Object.isFrozen(guard.policy[list]), true, list)
  assert.equal(Object.isFrozen(guard.policy), true)
  // The caller's own lists are left as they were.
  for (const list of [hosts, forbidden, allowed]) assert.equal(Object.isFrozen(list), false)
})

// ---- A request the route guard never judged ----
//
// A walk's own page.route runs before the engine's context.route, so a walk that answers a route
// itself (route.continue) sends the request without the guard. Such a request still finishes, and
// the guard hears of that: a first request it never judged fails the run.

// A request that is the same object every time the route is asked for it, as Playwright's is.
const requestOf = (method, url, { from = null, body = null } = {}) => ({
  method: () => method,
  url: () => url,
  postData: () => body,
  redirectedFrom: () => from
})
const routeFor = (request) => {
  const calls = []
  return { calls, request: () => request, abort: async (code) => calls.push(`abort ${code}`), continue: async () => calls.push('continue') }
}
const UNGUARDED = 'A request went out without the guard: the walk handled it with its own route'

test('a request that finishes without having been judged fails the run, naming the step and the request', async () => {
  let step = 'look'
  const guard = new RunGuard(policy(), { currentStep: () => step })
  const judged = requestOf('GET', 'https://app.example.com/list?token=SECRET')
  await guard.handleRoute(routeFor(judged))
  guard.handleFinished(judged)
  assert.doesNotThrow(() => guard.assertClean())
  step = 'send'
  guard.handleFinished(requestOf('POST', 'https://app.example.com/items?token=SECRET', { body: 'SECRET' }))
  assert.throws(
    () => guard.assertClean(),
    (e) => e instanceof CaptureRefusal && e.step === 'send' && e.message === `${UNGUARDED} (POST app.example.com/items).`
  )
})

test('a redirect hop finishes unjudged by the route guard, which is how it should be', () => {
  const guard = new RunGuard(policy())
  guard.handleFinished(requestOf('GET', 'https://app.example.com/next', { from: {} }))
  assert.doesNotThrow(() => guard.assertClean())
})

test('a request the route guard refused or could not judge counts as judged', async () => {
  const guard = new RunGuard(policy({ learning: true }))
  const refused = requestOf('POST', 'https://app.example.com/items')
  await guard.handleRoute(routeFor(refused))
  const broken = { ...requestOf('POST', 'https://app.example.com/items'), postData: () => { throw new Error('no body') } }
  await guard.handleRoute(routeFor(broken))
  guard.handleFinished(refused)
  assert.deepEqual(guard.violations.map((v) => v.reason), ['guard error on POST app.example.com/items'])
  guard.handleFinished(broken)
  assert.equal(guard.violations.length, 1)
})

test('a request nobody judged fails a learning run too, and one the guard cannot read is a guard error', () => {
  const learning = new RunGuard(policy({ learning: true }))
  learning.handleFinished(requestOf('GET', 'https://fonts.example.org/a.woff2'))
  assert.throws(() => learning.assertClean(), (e) => e.message === `${UNGUARDED} (GET fonts.example.org/a.woff2).`)
  const guard = new RunGuard(policy())
  const unreadable = { method: () => 'GET', url: () => 'https://app.example.com/x?token=SECRET', redirectedFrom: () => { throw new Error('gone') } }
  assert.doesNotThrow(() => guard.handleFinished(unreadable))
  assert.throws(() => guard.assertClean(), (e) => e.message === 'guard error on GET app.example.com/x')
})
