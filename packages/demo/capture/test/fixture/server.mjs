// The fixture app for the end-to-end test, served on 127.0.0.1: a sign-in form that takes the
// test values below, a home page and a details page. Test data only. It also counts the requests
// it receives by their Host header, so a test can tell which names the browser really reached,
// keeps a log of every request (method, host, path and body), so a test can tell what really got
// through to the server, and when the machine allows it, it answers on [::1] too (the same port),
// for the same reason.
import { createServer } from 'node:http'

export const FIXTURE_LOGIN = Object.freeze({ username: 'demo-user', password: 'fixture-password' })

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:18px system-ui,sans-serif;margin:0;padding:48px;background:#f4f6fa;color:#1f2937}
button,input{font:inherit;padding:10px 16px;margin:8px 8px 8px 0}label{display:block;margin:12px 0}</style>
</head><body><h1>${title}</h1>${body}</body></html>`

const SIGN_IN = page(
  'Sign in',
  `<form method="post" action="/login">
<label>User <input name="username" autocomplete="username"></label>
<label>Password <input name="password" type="password" autocomplete="current-password"></label>
<button type="submit">Sign in</button></form>`
)

// ?beacon=1 posts a beacon on load, and offers buttons: one posts a beacon with a body the config
// does not allow, one posts a ping with no body at all, and two post to a route that redirects with
// a 307, which the browser follows with the same method and body.
const BEACONS = `<script>fetch('/beacon', { method: 'POST', body: JSON.stringify({ page: 'home' }) })</script>
<button type="button" onclick="fetch('/beacon', { method: 'POST', body: JSON.stringify({ page: 'home', extra: true }) })">Send odd beacon</button>
<button type="button" onclick="fetch('/ping', { method: 'POST' })">Send empty ping</button>
<button type="button" onclick="fetch('/bounce-post', { method: 'POST', body: JSON.stringify({ page: 'home' }) })">Send redirected post</button>
<button type="button" onclick="fetch('/bounce-post-localhost', { method: 'POST', body: JSON.stringify({ page: 'home' }) })">Send redirected post by name</button>`

// ?shared=1 offers a button that starts a shared worker, whose script posts to /items. The page
// catches the error the engine's block throws, as an app might.
const SHARED = `<button type="button" onclick="try { new SharedWorker('/shared-worker.js').port.start() } catch (error) { document.title = error.name }">Start shared worker</button>`
const SHARED_WORKER_SCRIPT = "fetch('/items', { method: 'POST', body: 'from-shared-worker' })"

// ?quirks=1 adds what the browser handles without a request the route guard judges: a data: image,
// a blob: and a data: fetch, and an image that the page's Content-Security-Policy (img-src data:)
// blocks before it is sent. A passing walk on it shows that none of these trips the guard.
const QUIRKS = `<img alt="" width="4" height="4" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22/%3E">
<img alt="" width="4" height="4" src="/logo.svg">
<script>fetch(URL.createObjectURL(new Blob(['local']))); fetch('data:text/plain,local')</script>`

// ?outside=1 adds an image from another host (localhost), for the host lock. The two links lead
// to routes that answer with a redirect to another host, for the hops the route guard cannot see.
const home = (port, { outside, beacon, shared, quirks }) =>
  page(
    'Home',
    `<label>Search <input name="q"></label>
<button type="button" onclick="window.open('/details', '_blank', 'noopener')">Open details</button>
<button type="button" onclick="fetch('/items', { method: 'POST' })">Add item</button>
<button type="button" onclick="fetch('/items?mode=recount')">Recount</button>
<p><a href="/bounce-localhost">Visit partner</a> <a href="/bounce-loopback6">Visit partner by IPv6</a></p>
${outside ? `<img alt="Partner logo" src="http://localhost:${port}/logo.svg" width="40" height="40">` : ''}
${beacon ? BEACONS : ''}
${shared ? SHARED : ''}
${quirks ? QUIRKS : ''}`
  )

const DETAILS = page('Details', '<p>Three items are in the list.</p>')
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#2563eb"/></svg>'

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })

// Resolves once `server` listens; resolves false when this machine cannot listen there.
const listens = (server, port, host) =>
  new Promise((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(port, host, () => resolve(true))
  })

export async function startFixture() {
  const hostCounts = new Map()
  const requests = []
  const handle = async (req, res) => {
    const host = String(req.headers.host ?? '(none)').toLowerCase()
    hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1)
    const url = new URL(req.url, 'http://fixture.invalid')
    const body = await readBody(req)
    requests.push({ method: req.method, host, path: url.pathname, body })
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers })
      res.end(body)
    }
    if (url.pathname === '/logo.svg') return send(200, LOGO, { 'content-type': 'image/svg+xml' })
    if (url.pathname === '/shared-worker.js') return send(200, SHARED_WORKER_SCRIPT, { 'content-type': 'text/javascript' })
    // Answers with a redirect to the same port on another name for this machine: localhost is not
    // listed by the fixture adapter, and [::1] is an IP literal that is not listed either.
    if (url.pathname === '/bounce-localhost') return send(302, '', { location: `http://localhost:${port()}/logo.svg` })
    if (url.pathname === '/bounce-loopback6') return send(302, '', { location: `http://[::1]:${port()}/logo.svg` })
    if (url.pathname === '/login' && req.method === 'GET') return send(200, SIGN_IN)
    if (url.pathname === '/login' && req.method === 'POST') {
      const form = new URLSearchParams(body)
      const ok = form.get('username') === FIXTURE_LOGIN.username && form.get('password') === FIXTURE_LOGIN.password
      return send(303, '', ok ? { location: '/home', 'set-cookie': 'session=ok; HttpOnly; Path=/; SameSite=Lax' } : { location: '/login' })
    }
    if (!/(?:^|;\s*)session=ok(?:;|$)/.test(req.headers.cookie ?? '')) return send(302, '', { location: '/login' })
    if (url.pathname === '/home') {
      const has = (flag) => url.searchParams.has(flag)
      const quirks = has('quirks') ? { 'content-security-policy': 'img-src data:' } : {}
      return send(200, home(port(), { outside: has('outside'), beacon: has('beacon'), shared: has('shared'), quirks: has('quirks') }), quirks)
    }
    if (url.pathname === '/beacon' || url.pathname === '/ping') return send(204, '')
    // A 307 keeps the method and the body: the browser sends the same POST to the new URL. The second
    // goes to another name for this machine, which the fixture adapter does not list.
    if (url.pathname === '/bounce-post') return send(307, '', { location: '/items' })
    if (url.pathname === '/bounce-post-localhost') return send(307, '', { location: `http://localhost:${port()}/items` })
    if (url.pathname === '/details') return send(200, DETAILS)
    if (url.pathname === '/items') return send(200, '{"ok":true}', { 'content-type': 'application/json' })
    return send(404, page('Not found', ''))
  }
  const server = createServer(handle)
  const port = () => server.address().port
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  // The same port on [::1]: the port is free there unless something else took it a moment ago, in
  // which case the fixture simply does not answer on IPv6 (`ipv6` says which).
  const server6 = createServer(handle)
  const ipv6 = await listens(server6, port(), '::1')
  const servers = ipv6 ? [server, server6] : [server]
  return {
    url: `http://127.0.0.1:${port()}`,
    port: port(),
    ipv6,
    // The requests received so far, by Host header ("localhost:4100"), as a plain object copy.
    hostCounts: () => Object.fromEntries(hostCounts),
    // Every request received so far, in order, as { method, host, path, body } copies.
    requests: () => requests.map((request) => ({ ...request })),
    close: () =>
      Promise.all(
        servers.map(
          (one) =>
            new Promise((resolve) => {
              one.closeAllConnections()
              one.close(resolve)
            })
        )
      ).then(() => undefined)
  }
}
