// The rules of the demo-capture engine: arguments, the go-ahead gates, the network policy (host
// lock and read-only), the password refusal, the outside-repo check and the run lock. None needs a
// browser, and all but the run lock are synchronous, so node:test proves every refusal.
//
// A capture is a presentation tool, not a test: it drives a real app to record a walkthrough. It
// is never test evidence.
import { existsSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

// A refusal fails the run with one plain sentence. `step` names the step it stopped, when known.
export class CaptureRefusal extends Error {
  constructor(message, { step = null } = {}) {
    super(message)
    this.name = 'CaptureRefusal'
    this.step = step
  }
}

export function usageText() {
  return `demo-capture: record a scripted walkthrough of a web app into a capture folder (contract 1)

  node scripts/cli.mjs --project <dir> --list
  node scripts/cli.mjs sign-in --project <dir> --env <name>
  node scripts/cli.mjs --project <dir> --env <name> --walk <name> [--set key=value]... [--out <dir>] [--headed]

  --project         the folder that holds demo-capture/config.mjs (default: the current folder)
  --env             required, no default: an environment the project's config declares
  --walk            a file in demo-capture/walks/, without .mjs (--list shows them)
  --set key=value   a param the config declares; repeat it for several
  --out             the run folder (default ~/.demo-capture/<project>/runs/<yyyymmdd-hhmmss>-<walk>)
  --headed          show the browser while recording
  --learn-hosts     run a read-only walk that lets unlisted hosts through and lists them (no video)
  --prod-go-ahead   needed for a production environment. An agent adds it only after the
                    person's go-ahead in chat for this run.
  --write-go-ahead  needed for a walk that writes, where the environment sets writeGoAhead. An
                    agent adds it only after the person's go-ahead in chat for this run.
  --help, -h        print this text

The first run of an environment opens a browser for a person to sign in; nothing is typed for
them. The session is kept in ~/.demo-capture/<project>/<env>/, outside every repo, and reused.`
}

const VALUE_FLAGS = new Set(['--project', '--env', '--walk', '--out', '--set'])
const SET_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/

// One --set value: "key=value", split at the first "=". The value may be empty or hold "=".
export function parseSet(value, existing = {}) {
  const eq = value.indexOf('=')
  if (eq <= 0) throw new CaptureRefusal(`--set takes key=value, not "${value}"`)
  const key = value.slice(0, eq)
  if (!SET_KEY.test(key))
    throw new CaptureRefusal(`--set key "${key}" must start with a letter and use letters, digits, - or _`)
  if (Object.hasOwn(existing, key)) throw new CaptureRefusal(`--set ${key} is given twice`)
  return { ...existing, [key]: value.slice(eq + 1) }
}

// --env is required and has no default: a default turns "I meant production" into a quiet
// success somewhere else.
export function parseArgs(argv) {
  const out = {
    command: 'run',
    project: undefined,
    env: undefined,
    walk: undefined,
    out: undefined,
    set: {},
    headed: false,
    learnHosts: false,
    prodGoAhead: false,
    writeGoAhead: false
  }
  const rest = [...argv]
  if (rest[0] === 'sign-in') {
    out.command = 'sign-in'
    rest.shift()
  }
  let list = false
  let help = false
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (VALUE_FLAGS.has(a)) {
      const value = rest[++i]
      if (value === undefined || value.startsWith('--')) throw new CaptureRefusal(`${a} needs a value`)
      if (a === '--set') out.set = parseSet(value, out.set)
      // A second value would quietly win ("--env dev --env live" runs on live), so it is refused.
      else if (out[a.slice(2)] !== undefined) throw new CaptureRefusal(`${a} is given twice`)
      else out[a.slice(2)] = value
    } else if (a === '--list') list = true
    else if (a === '--help' || a === '-h') help = true
    else if (a === '--headed') out.headed = true
    else if (a === '--learn-hosts') out.learnHosts = true
    else if (a === '--prod-go-ahead') out.prodGoAhead = true
    else if (a === '--write-go-ahead') out.writeGoAhead = true
    else throw new CaptureRefusal(`unknown argument: ${a}`)
  }
  if (help) return { ...out, command: 'help' }
  if (list) {
    if (out.command === 'sign-in') throw new CaptureRefusal('sign-in does not take --list')
    return { ...out, command: 'list' }
  }
  if (!out.env) throw new CaptureRefusal('--env is required and has no default')
  if (out.command === 'sign-in') {
    if (out.walk) throw new CaptureRefusal('sign-in takes no --walk; it only signs in')
    return out
  }
  if (!out.walk) throw new CaptureRefusal('--walk is required; --list shows the walks')
  return out
}

// `env` is an environment as selectEnvironment (project.mjs) returns it.
export function assertProdGoAhead(env, prodGoAhead) {
  if (env.production && !prodGoAhead)
    throw new CaptureRefusal(
      `${env.name} is a production environment: it needs --prod-go-ahead, which an agent adds only after the person's go-ahead in chat for this run.`
    )
}

// Production already needs --prod-go-ahead for every run, which covers its write walks.
export function assertWriteGoAhead(env, walk, writeGoAhead) {
  if (walk.writes && env.writeGoAhead && !env.production && !writeGoAhead)
    throw new CaptureRefusal(
      `This walk writes, and ${env.name} needs a go-ahead for every write walk: --write-go-ahead, which an agent adds only after the person's go-ahead in chat for this run.`
    )
}

export function assertLearnable(env, walk) {
  if (walk.writes) throw new CaptureRefusal('--learn-hosts runs read-only walks only, and this walk writes.')
  if (env.production)
    throw new CaptureRefusal(`--learn-hosts is refused on ${env.name}, a production environment.`)
}

export function assertTypable(inputType) {
  if (String(inputType ?? '').toLowerCase() === 'password')
    throw new CaptureRefusal('Typing into a password field is refused: sign-in is always done by a person.')
}

// HEAD and OPTIONS cannot change data, and browsers send OPTIONS by themselves (CORS preflight).
export const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

// What a failure says of a request the guard saw only after the browser had sent it (a redirect hop).
const SENT_BY_REDIRECT = 'was sent by a redirect the guard cannot stop'

// What a failure says of a request that finished without the route guard judging it.
const UNGUARDED = 'A request went out without the guard: the walk handled it with its own route'

// Pages the browser builds itself, with no network behind them. Every scheme that is neither one
// of these nor in NETWORK_PORTS (file:, ftp: and the rest) is refused.
const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:'])

// The schemes that reach the network, and the port each uses when a URL leaves it out (a URL
// reports an empty `port` for its scheme's default).
const NETWORK_PORTS = new Map([
  ['http:', '80'],
  ['https:', '443'],
  ['ws:', '80'],
  ['wss:', '443']
])

// A `hosts` entry is "hostname" or "hostname:port" ("[::1]:4100" for IPv6). Returns
// { host, port } with the entry lower-cased, trimmed and stripped of a trailing dot (port is null
// when the entry has none), or null when the entry is not one of those.
const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/
export function parseHostEntry(entry) {
  if (typeof entry !== 'string') return null
  const match = HOST_ENTRY.exec(entry.trim().toLowerCase().replace(/\.(:[0-9]+)?$/, '$1'))
  if (!match) return null
  if (match[2] === undefined) return { host: match[1], port: null }
  const port = Number(match[2])
  return port >= 1 && port <= 65535 ? { host: match[1], port: String(port) } : null
}

// "POST api.example.com/items": the method, host and path. Never the query, the fragment, the
// userinfo or the body, which can hold ids and tokens.
export function describeRequest(method, url) {
  try {
    const parsed = new URL(url)
    return `${method.toUpperCase()} ${parsed.hostname}${parsed.pathname}`
  } catch {
    return `${method.toUpperCase()} (unreadable URL)`
  }
}

// "POST https://app.example.com/hub/negotiate?negotiateVersion=… (no body)": how a learning run lists
// a non-read it refused. A readOnlyAllowed rule must match the whole URL, so this shows what that
// takes: the scheme, the host with its port, the path and the names of the query parameters. It never
// shows a query value, a part of the query without "=" (which could be a value by itself), the
// userinfo, the fragment or the body; only whether there is a body that was read.
export function describeNonRead({ method, url, body }) {
  try {
    const parsed = new URL(url)
    const names = parsed.search
      .slice(1)
      .split('&')
      .filter(Boolean)
      .map((part) => (part.includes('=') ? `${part.slice(0, part.indexOf('='))}=…` : '…'))
    const query = names.length ? `?${names.join('&')}` : ''
    return `${method.toUpperCase()} ${parsed.protocol}//${parsed.host}${parsed.pathname}${query} (${typeof body === 'string' ? 'with a body' : 'no body'})`
  } catch {
    return `${method.toUpperCase()} (unreadable URL)`
  }
}

// `pattern` as a RegExp that matches only the whole text: ^(?:pattern)$. The g, m and y flags are
// dropped. "m" would let ^ and $ match at any line of the text, so a pattern could match one line of
// a bigger body; g and y make a RegExp remember where it stopped.
function wholeOf(pattern) {
  return new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace(/[gmy]/g, ''))
}

// A { method, url, body? } rule: the method matches exactly, `url` (a RegExp) is found in the
// full URL, and `body`, when the rule has one, is found in the request body. By default a pattern
// is found anywhere in the text, which is right for a rule that refuses (a pattern that is too
// broad only refuses too much). With `whole`, each pattern must match the entire URL or body: that
// is how a rule that allows is read, because a pattern that is too broad would allow too much.
// A rule with a body pattern needs a body that was read: a request with no body, or one the
// browser could not read (both arrive as null), never matches it, however permissive the pattern
// ("^$" and ".*" match the empty string). An empty string is a body that was read. A request
// without a body needs a rule without a body pattern.
export function matchesRule(rule, { method, url, body }, { whole = false } = {}) {
  if (rule.method.toUpperCase() !== method.toUpperCase()) return false
  const found = whole ? (pattern, text) => wholeOf(pattern).test(text) : (pattern, text) => text.search(pattern) >= 0
  if (!found(rule.url, url)) return false
  if (rule.body === undefined) return true
  return typeof body === 'string' && found(rule.body, body)
}

// Why no readOnlyAllowed rule allowed a non-read that one of them comes close to, as the end of a
// refusal: " (readOnlyAllowed[2] matches part of this URL but not all of it)". Only rules of the
// request's own method count. A rule whose url matches the whole URL is named first, since only its
// body pattern can have failed; else the first rule whose url is found in a part of the URL. Empty
// when no rule comes that close. It names a rule by its index, and never the query or the body.
function nearMiss(allowed, request) {
  const index = (test) =>
    allowed.findIndex((rule) => rule.method.toUpperCase() === request.method.toUpperCase() && test(rule))
  const whole = index((rule) => wholeOf(rule.url).test(request.url))
  if (whole >= 0)
    return typeof request.body === 'string'
      ? ` (readOnlyAllowed[${whole}] matches this URL but not its body)`
      : ` (readOnlyAllowed[${whole}] has a body pattern, and this request has no readable body)`
  const part = index((rule) => request.url.search(rule.url) >= 0)
  return part >= 0 ? ` (readOnlyAllowed[${part}] matches part of this URL but not all of it)` : ''
}

// What the network guard does with one request. `policy`:
//   hosts      the environment's hosts; any other host is refused. An entry is "hostname" or
//              "hostname:port". An entry with a port matches only that host on that port; an
//              entry without one matches the hostname on any port. A URL that leaves its port out
//              has its scheme's default (80 for http and ws, 443 for https and wss).
//   readOnly   the walk declares writes: false
//   forbidden  readOnlyForbidden rules: reads that write
//   allowed    non-read rules a read-only walk may send because they change no data. Each rule's
//              url and body must match the whole URL and the whole body (see matchesRule)
//   learning   --learn-hosts: unlisted hosts are let through and remembered. A first request that is
//              a non-read is never sent to an unlisted host, even when `allowed` lists it: the host
//              is remembered and the request is aborted. (A redirect hop that keeps the method, a
//              307 or a 308, is already on the wire when the guard sees it: see RunGuard.)
// `kind`: local (a page the browser builds itself), scheme (not http, https, ws or wss), listed,
// unlisted, host (refused: not in the list), write, forbidden, unreadable. Every verdict a learning
// run can get that has a host also says whether the host is `listed`, and an aborted one says how
// the learning run lists it, in `shown`: a non-read as describeNonRead does (with the rule that came
// close, for a write), a read as its `where`. (A `host` verdict is never a learning run's.)
export function classifyRequest(request, { hosts, readOnly, forbidden = [], allowed = [], learning = false }) {
  let host
  let port
  try {
    const parsed = new URL(request.url)
    if (LOCAL_SCHEMES.has(parsed.protocol)) return { action: 'continue', kind: 'local' }
    // The reason names the scheme only: the rest of the URL can hold ids, tokens and credentials.
    if (!NETWORK_PORTS.has(parsed.protocol))
      return {
        action: 'abort',
        kind: 'scheme',
        host: null,
        where: `(${parsed.protocol} URL)`,
        reason: `A request with the ${parsed.protocol} scheme was refused.`
      }
    host = parsed.hostname.toLowerCase()
    port = parsed.port || NETWORK_PORTS.get(parsed.protocol)
  } catch {
    return { action: 'abort', kind: 'unreadable', host: null, where: '(unreadable URL)', reason: 'A request with an unreadable URL was refused.' }
  }
  const where = describeRequest(request.method, request.url)
  const verb = request.method.toUpperCase()
  const isRead = READS.has(verb)
  const shown = (hint = '') => (isRead ? where : `${describeNonRead(request)}${hint}`)
  const entries = hosts.map(parseHostEntry).filter(Boolean)
  const listed = entries.some((entry) => entry.host === host && (entry.port === null || entry.port === port))
  // A host that is listed, but not on this port, is named with its port so the refusal is not
  // mistaken for a typo.
  const named = entries.some((entry) => entry.host === host) ? `${host}:${port}` : host
  if (readOnly && forbidden.some((rule) => matchesRule(rule, request)))
    return { action: 'abort', kind: 'forbidden', host, listed, where, shown: shown(), reason: `${where} was refused: the project lists it as a read that writes.` }
  if (readOnly && !isRead && !allowed.some((rule) => matchesRule(rule, request, { whole: true }))) {
    const hint = nearMiss(allowed, request)
    return { action: 'abort', kind: 'write', host, listed, where, shown: shown(hint), reason: `${where} was refused: this walk is read-only${hint}.` }
  }
  if (!listed) {
    if (learning) {
      // A non-read only gets here when `allowed` lists it (or, for judgeHop, whatever it lists): the
      // host is remembered, and a first request is not sent. A hop is judged by this same line, but
      // it was sent already: see judgeHop.
      if (!isRead)
        return { action: 'abort', kind: 'unlisted', host, listed, named, where, shown: shown(), reason: `${where} was refused: ${named} is not in this environment's hosts.` }
      return { action: 'continue', kind: 'unlisted', host, listed, where }
    }
    return { action: 'abort', kind: 'host', host, where, reason: `${where} was refused: ${named} is not in this environment's hosts.` }
  }
  return { action: 'continue', kind: 'listed', host, listed, where }
}

// The policy a RunGuard guards with: checked, with the host list normalised, and copied and frozen,
// lists included, so neither the caller nor anything else can change it afterwards. A policy that is
// not usable is refused rather than guarded with: a missing readOnly would read as false and let
// writes through, and a bad hosts list would guard nothing. The messages never repeat a hosts entry,
// which could hold credentials.
function checkedPolicy(policy) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy))
    throw new CaptureRefusal('The network policy is missing.')
  const { hosts, readOnly, learning = false } = policy
  const forbidden = policy.forbidden ?? []
  const allowed = policy.allowed ?? []
  if (!Array.isArray(hosts)) throw new CaptureRefusal('The network policy needs hosts: a list of host names.')
  const normalised = hosts.map((entry, index) => {
    const parsed = parseHostEntry(entry)
    if (parsed === null) throw new CaptureRefusal(`The network policy's hosts[${index}] is not a host name or host:port.`)
    return parsed.port === null ? parsed.host : `${parsed.host}:${parsed.port}`
  })
  if (typeof readOnly !== 'boolean') throw new CaptureRefusal('The network policy needs readOnly to be true or false.')
  if (typeof learning !== 'boolean') throw new CaptureRefusal('The network policy needs learning to be true or false.')
  if (learning && !readOnly)
    throw new CaptureRefusal('Learning hosts runs read-only walks only, so the network policy cannot set learning without readOnly.')
  if (!Array.isArray(forbidden)) throw new CaptureRefusal('The network policy needs forbidden to be a list of rules.')
  if (!Array.isArray(allowed)) throw new CaptureRefusal('The network policy needs allowed to be a list of rules.')
  return Object.freeze({
    ...policy,
    hosts: Object.freeze(normalised),
    readOnly,
    learning,
    forbidden: Object.freeze([...forbidden]),
    allowed: Object.freeze([...allowed])
  })
}

// The name of a request for a "guard error" message, or a stand-in when even that cannot be read.
function nameOf(read) {
  try {
    return read()
  } catch {
    return '(unknown request)'
  }
}

// Applies classifyRequest to every request and WebSocket of a recording context. A refusal is
// aborted at once and fails the run at the next check (before each step, and at the end). While
// learning, refusals are aborted and listed, and the walk goes on.
//
// The caller wires four handlers: handleRoute from context.route, handleWebSocket from
// context.routeWebSocket, handleRedirectHop from context.on('request'), and handleFinished from
// context.on('requestfinished'). A route handler sees only the first URL of a request, never the
// hops of a redirect, so handleRedirectHop judges each hop too. A hop is already on the wire when
// the 'request' event fires, so it can only be recorded, never aborted: the run fails at the next
// assertClean(), and stopping the connection itself is the job of a rule at the network layer, not
// of this class. That matters most for a non-read: a 307 or 308 makes the browser send the same
// method and body to the new URL, so a request that a rule allowed can be sent on to a URL no rule
// allows, or, in a learning run, to any host. Only the rule that allowed the first request keeps
// that from doing harm, which is why an allowed rule names one endpoint and one body (see
// matchesRule).
//
// No request or socket is left unanswered and nothing throws into the page: one the guard cannot
// judge is aborted or closed and recorded as a violation ("guard error on ..."), also while
// learning. The constructor refuses a policy it cannot trust (see checkedPolicy).
//
// handleFinished is a tripwire for a walk that answers a route itself: a walk's page.route runs
// before the engine's context.route, and its route.continue() sends the request without the guard.
// Every first request the route guard sees is remembered (by object: Playwright hands over the same
// request each time), and one that finishes without having been seen fails the run. Only finished
// requests count. A request the browser blocks before sending it (a Content-Security-Policy refusal)
// fails without ever reaching a route handler, so a failed request proves nothing.
export class RunGuard {
  constructor(policy, { currentStep = () => null } = {}) {
    this.policy = checkedPolicy(policy)
    this.currentStep = currentStep
    this.violations = []
    this.unlisted = new Set()
    this.refused = new Set()
    this.judged = new WeakSet()
  }

  check(request) {
    const verdict = classifyRequest(request, this.policy)
    // While learning, every host the walk tried is named, also one that only refused requests reached.
    if (this.policy.learning && verdict.listed === false) this.unlisted.add(verdict.host)
    if (verdict.action === 'abort') {
      if (this.policy.learning) this.refused.add(verdict.shown ?? verdict.where)
      else this.fail(verdict.reason)
    }
    return verdict.action
  }

  fail(reason) {
    let step = null
    try {
      step = this.currentStep()
    } catch {
      // The step name is only a label; the violation matters more than where it happened.
    }
    this.violations.push({ reason, step })
  }

  async handleRoute(route) {
    let send = false
    try {
      const request = route.request()
      this.judged.add(request)
      send = this.check({ method: request.method(), url: request.url(), body: request.postData() }) === 'continue'
    } catch {
      this.fail(
        `guard error on ${nameOf(() => {
          const request = route.request()
          return describeRequest(request.method(), request.url())
        })}`
      )
    }
    try {
      await (send ? route.continue() : route.abort('blockedbyclient'))
    } catch {
      // The page may already be gone; there is nothing left to answer.
    }
  }

  // A WebSocket opens with a GET (the upgrade), so it is a read.
  handleWebSocket(ws) {
    let connect = false
    try {
      connect = this.check({ method: 'GET', url: ws.url() }) === 'continue'
      if (connect) ws.connectToServer()
    } catch {
      connect = false
      this.fail(`guard error on ${nameOf(() => describeRequest('GET', ws.url()))}`)
    }
    if (connect) return
    try {
      Promise.resolve(ws.close()).catch(() => {})
    } catch {
      // Already closed.
    }
  }

  // For every request the context reports: a hop of a redirect (redirectedFrom() is set) is judged
  // and recorded; a first request was already judged by handleRoute and is left alone. It cannot
  // abort, so it returns nothing.
  handleRedirectHop(request) {
    try {
      if (!request.redirectedFrom()) return
      const body = typeof request.postData === 'function' ? request.postData() : null
      this.judgeHop({ method: request.method(), url: request.url(), body })
    } catch {
      this.fail(`guard error on ${nameOf(() => describeRequest(request.method(), request.url()))}`)
    }
  }

  // A hop is judged by the host lock first, and only then by the project's rules, and it is never
  // called "refused" when it was sent:
  //   - an unlisted host: outside learning the browser's resolver has already refused the name, so
  //     the hop is "refused". While learning the name resolved and the hop was sent: the host is
  //     listed as unlisted (not as refused), and a non-read fails the run, because it reached a host
  //     that nothing allowed. A scheme or URL the guard cannot read is refused by the browser itself.
  //   - a listed host: a forbidden request, or a non-read no allowed rule matches, was sent. The run
  //     fails with that, also while learning.
  judgeHop(hop) {
    const lock = classifyRequest(hop, { ...this.policy, readOnly: false, forbidden: [], allowed: [] })
    if (lock.kind === 'local') return
    if (lock.kind === 'unlisted') {
      this.unlisted.add(lock.host)
      if (lock.action === 'abort') {
        this.fail(`${lock.where} ${SENT_BY_REDIRECT}: ${lock.named} is not in this environment's hosts.`)
        return
      }
    } else if (lock.action === 'abort') {
      if (this.policy.learning) this.refused.add(lock.where)
      else this.fail(lock.reason)
      return
    }
    if (!this.policy.readOnly) return
    if (this.policy.forbidden.some((rule) => matchesRule(rule, hop)))
      this.fail(`${lock.where} ${SENT_BY_REDIRECT}: the project lists it as a read that writes.`)
    else if (!READS.has(hop.method.toUpperCase()) && !this.policy.allowed.some((rule) => matchesRule(rule, hop, { whole: true })))
      this.fail(`${lock.where} ${SENT_BY_REDIRECT}: this walk is read-only.`)
  }

  // For every request the context reports finished (see the class comment). A redirect hop is left
  // to handleRedirectHop, which judged it when it started.
  handleFinished(request) {
    try {
      if (request.redirectedFrom() || this.judged.has(request)) return
      this.fail(`${UNGUARDED} (${describeRequest(request.method(), request.url())}).`)
    } catch {
      this.fail(`guard error on ${nameOf(() => describeRequest(request.method(), request.url()))}`)
    }
  }

  assertClean() {
    const first = this.violations[0]
    if (first) throw new CaptureRefusal(first.reason, { step: first.step })
  }

  learned() {
    return { unlisted: [...this.unlisted].sort(), refused: [...this.refused].sort() }
  }
}

// The git working tree holding `path` (the directory with a .git entry), or null. Walks up from
// the closest existing parent, through symlinks.
export function enclosingRepo(path) {
  let probe = resolve(path)
  while (!existsSync(probe)) {
    const up = dirname(probe)
    if (up === probe) return null
    probe = up
  }
  for (let dir = realpathSync(probe); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir
    if (dirname(dir) === dir) return null
  }
}

// Run folders hold real screens and session folders hold sign-ins: neither ever enters a repo.
export function assertOutsideRepos(path, what) {
  const repo = enclosingRepo(path)
  if (repo)
    throw new CaptureRefusal(
      `${what} ${resolve(path)} is inside the git working tree ${repo}. Captures and sessions live outside every repo.`
    )
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

// One run per project and environment: a session's tokens can rotate on use, so two runs sharing
// it would sign each other out. Returns the function that releases the lock. The lock is best
// effort: two runs that start at the same instant against a stale lock can both proceed, which is
// accepted for a single-user CLI.
export async function acquireRunLock(lockPath, { pid = process.pid, isAlive = pidAlive } = {}) {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(lockPath, String(pid), { flag: 'wx', mode: 0o600 })
      return () => rm(lockPath, { force: true })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const holder = Number((await readFile(lockPath, 'utf8').catch(() => '')).trim())
      if (Number.isInteger(holder) && holder > 0 && isAlive(holder))
        throw new CaptureRefusal(
          `Another run (pid ${holder}) is using this session; wait for it to finish, or delete the lock file ${lockPath} if no run is going.`
        )
      // The last attempt never removes the file: it may be another run's fresh lock.
      if (attempt === 1) break
      await rm(lockPath, { force: true })
    }
  }
  throw new CaptureRefusal('Could not take the run lock; try again.')
}
