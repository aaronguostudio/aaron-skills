import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { CaptureRefusal, matchesRule } from '../scripts/guards.mjs'
import {
  appRevision,
  configProblems,
  describeProject,
  loadConfig,
  loadWalk,
  loadWalks,
  resolveParams,
  selectEnvironment,
  walkNames,
  walkProblems
} from '../scripts/project.mjs'

const rejects = (promise, pattern) =>
  assert.rejects(promise, (e) => e instanceof CaptureRefusal && pattern.test(e.message))

const valid = () => ({
  contract: 1,
  name: 'my-app',
  environments: {
    dev: { url: 'https://dev.example.com', production: false, hosts: ['dev.example.com', 'api-dev.example.com'] },
    prod: { url: 'https://example.com/', production: true, hosts: ['example.com'], writeGoAhead: false }
  },
  signInPath: '/login',
  isSignedOut: (url) => new URL(url).pathname.startsWith('/login'),
  params: { centre: { default: 'Main', describe: 'which site the demo uses' } },
  readOnlyForbidden: [{ method: 'GET', url: /\/items\?mode=recount/ }],
  // An allowed rule matches the whole URL, so its pattern spells the scheme, host and path.
  readOnlyAllowed: [{ method: 'POST', url: /https:\/\/dev\.example\.com\/session\/token/ }],
  sameTabLinks: true,
  setup: async () => {},
  beforeStep: async () => {},
  revision: async () => 'abc123'
})

// A config with one field changed (undefined removes it), and the problems it has.
const problemsWith = (change) => {
  const config = { ...valid(), ...change }
  for (const [key, value] of Object.entries(change)) if (value === undefined) delete config[key]
  return configProblems(config)
}
const envProblems = (env) => problemsWith({ environments: { dev: env } })
const devEnv = () => ({ url: 'https://dev.example.com', production: false, hosts: ['dev.example.com'] })

test('a complete config has no problems; the optional fields may be left out', () => {
  assert.deepEqual(configProblems(valid()), [])
  const minimal = valid()
  for (const key of ['params', 'readOnlyForbidden', 'readOnlyAllowed', 'sameTabLinks', 'setup', 'beforeStep', 'revision'])
    delete minimal[key]
  assert.deepEqual(configProblems(minimal), [])
})

test('the required fields are checked', () => {
  assert.deepEqual(configProblems(null), ['config.mjs must export default an object'])
  assert.deepEqual(configProblems([]), ['config.mjs must export default an object'])
  assert.deepEqual(problemsWith({ contract: 2 }), ['contract must be 1'])
  assert.deepEqual(problemsWith({ contract: undefined }), ['contract must be 1'])
  assert.deepEqual(problemsWith({ name: 'My App' }), ['name must be lowercase letters, digits and dashes'])
  assert.deepEqual(problemsWith({ name: undefined }), ['name must be lowercase letters, digits and dashes'])
  assert.deepEqual(problemsWith({ environments: {} }), ['environments must declare at least one environment'])
  assert.deepEqual(problemsWith({ environments: undefined }), ['environments must declare at least one environment'])
  assert.deepEqual(problemsWith({ signInPath: 'login' }), ['signInPath must be a path starting with /'])
  assert.deepEqual(problemsWith({ signInPath: undefined }), ['signInPath must be a path starting with /'])
  assert.deepEqual(problemsWith({ isSignedOut: '/login' }), ['isSignedOut must be a function of the page URL'])
})

test('an unknown field is refused, so a typo never drops a guard silently', () => {
  assert.deepEqual(problemsWith({ readOnlyForbiden: [] }), ['unknown field "readOnlyForbiden"'])
  assert.deepEqual(envProblems({ ...devEnv(), host: 'dev.example.com' }), ['environments.dev: unknown field "host"'])
})

test('each environment needs a URL, a production flag and its hosts, its own host among them', () => {
  assert.deepEqual(envProblems(devEnv()), [])
  assert.deepEqual(envProblems({ ...devEnv(), url: 'ftp://dev.example.com' }), ['environments.dev.url must be an http(s) URL'])
  assert.deepEqual(envProblems({ ...devEnv(), url: 'nope' }), ['environments.dev.url must be an http(s) URL'])
  assert.deepEqual(envProblems({ ...devEnv(), production: undefined }), ['environments.dev.production must be true or false'])
  assert.deepEqual(envProblems({ ...devEnv(), writeGoAhead: 'yes' }), ['environments.dev.writeGoAhead must be true or false'])
  assert.deepEqual(envProblems({ ...devEnv(), hosts: [] }), ['environments.dev.hosts must list every host the app uses'])
  assert.deepEqual(envProblems({ ...devEnv(), hosts: undefined }), ['environments.dev.hosts must list every host the app uses'])
  assert.deepEqual(envProblems({ ...devEnv(), hosts: ['dev.example.com', 'https://cdn.example.com'] }), [
    'environments.dev.hosts: "https://cdn.example.com" must be lowercase host names (no scheme, port or path)'
  ])
  assert.deepEqual(envProblems({ ...devEnv(), hosts: ['Dev.example.com'] }), [
    'environments.dev.hosts: "Dev.example.com" must be lowercase host names (no scheme, port or path)'
  ])
  assert.deepEqual(envProblems({ ...devEnv(), hosts: ['api.example.com'] }), [
    "environments.dev.hosts must include dev.example.com, the environment's own host"
  ])
  assert.deepEqual(problemsWith({ environments: { dev: 'https://dev.example.com' } }), ['environments.dev must be an object'])
})

// R-T5a: a host that passes here must also pass the network guard's grammar, so a bad entry fails
// before any browser opens. An empty label is refused: a double dot and a lone dot are not host
// names to the guard, and a trailing dot is one the guard would strip, which config does not do.
test('host names with an empty label are refused', () => {
  for (const host of ['a..b', 'dev.example.com.', '.'])
    assert.deepEqual(envProblems({ ...devEnv(), hosts: ['dev.example.com', host] }), [
      `environments.dev.hosts: "${host}" must be lowercase host names (no scheme, port or path)`
    ])
})

test('host names with digits, underscores and dots are accepted, each as the environment own host', () => {
  const hosts = ['127.0.0.1', 'localhost', 'api_v2.example.com']
  for (const url of ['http://127.0.0.1:4100', 'http://localhost:4100', 'http://api_v2.example.com'])
    assert.deepEqual(envProblems({ url, production: false, hosts }), [])
})

test('an environment URL is a plain http(s) address: no whitespace, credentials, query or fragment', () => {
  for (const url of [
    ' https://dev.example.com',
    'https://dev.example.com ',
    'https://dev.example.com\n',
    'https://dev.exa\tmple.com',
    ['https://dev.example.com']
  ])
    assert.deepEqual(envProblems({ ...devEnv(), url }), ['environments.dev.url must be an http(s) URL'])
  for (const url of [
    'https://u:pw@dev.example.com',
    'https://u@dev.example.com',
    'https://:pw@dev.example.com',
    'https://dev.example.com/?a=1',
    'https://dev.example.com/#top',
    'https://dev.example.com/?',
    'https://dev.example.com/#'
  ])
    assert.deepEqual(envProblems({ ...devEnv(), url }), ['environments.dev.url must have no credentials, query or fragment'])
  assert.deepEqual(envProblems({ ...devEnv(), url: 'https://dev.example.com/app/' }), [])
})

test('environment names follow the project name rule and never shadow the runs folder', () => {
  assert.deepEqual(problemsWith({ environments: { Dev: devEnv() } }), [
    'environments.Dev: environment names are lowercase letters, digits and dashes, and not "runs"'
  ])
  assert.deepEqual(problemsWith({ environments: { runs: devEnv() } }), [
    'environments.runs: environment names are lowercase letters, digits and dashes, and not "runs"'
  ])
})

test('params, rules, flags and hooks have their shapes', () => {
  assert.deepEqual(problemsWith({ params: [] }), ['params must be an object'])
  assert.deepEqual(problemsWith({ params: { centre: { default: 'Main' } } }), ['params.centre must be { default: string, describe: string }'])
  assert.deepEqual(problemsWith({ params: { centre: { default: 1, describe: 'x' } } }), ['params.centre must be { default: string, describe: string }'])
  assert.deepEqual(problemsWith({ params: { '1st': { default: '', describe: 'x' } } }), [
    'params.1st: names start with a letter and use letters, digits, - or _'
  ])
  assert.deepEqual(problemsWith({ params: { centre: null } }), ['params.centre must be { default: string, describe: string }'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: { method: 'GET' } }), ['readOnlyForbidden must be a list of { method, url } rules'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: ['GET /items'] }), ['readOnlyForbidden[0] must be an object'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: 'GET', url: '/items' }] }), ['readOnlyForbidden[0].url must be a regular expression'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: '', url: /x/ }] }), ['readOnlyForbidden[0].method must be an HTTP method'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: 'GET', url: /x/, why: 'y' }] }), ['readOnlyForbidden[0]: unknown field "why"'])
  assert.deepEqual(problemsWith({ sameTabLinks: 'yes' }), ['sameTabLinks must be true or false'])
  for (const hook of ['setup', 'beforeStep', 'revision'])
    assert.deepEqual(problemsWith({ [hook]: 'later' }), [`${hook} must be a function`])
})

test('a readOnlyForbidden method is a real HTTP method in any letter case, since the guard ignores case', () => {
  const methodProblems = (method) => problemsWith({ readOnlyForbidden: [{ method, url: /x/ }] })
  const notAMethod = ['readOnlyForbidden[0].method must be an HTTP method']
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'get', 'Post'])
    assert.deepEqual(methodProblems(method), [])
  for (const method of ['GTE', 'GET ', ' GET', 'GET /items', 5, null]) assert.deepEqual(methodProblems(method), notAMethod)
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ url: /x/ }] }), notAMethod)
  // A lower-case rule method is what the guard matches against an upper-case request; one with a
  // stray space or a typo can never match, so a read that writes would go through.
  const request = { method: 'GET', url: 'https://api.example.com/x' }
  assert.equal(matchesRule({ method: 'get', url: /x/ }, request), true)
  assert.equal(matchesRule({ method: 'GET ', url: /x/ }, request), false)
  assert.equal(matchesRule({ method: 'GTE', url: /x/ }, request), false)
})

// Browsers read a backslash as a slash in an http(s) URL, so /\host is as much a link to another
// host as //host is. Only the second character matters; later slashes and backslashes are fine.
test('signInPath cannot start with // or /\\, which is a link to another host', () => {
  const protocolRelative = ['signInPath must not start with // (that is a link to another host)']
  assert.deepEqual(problemsWith({ signInPath: '//other.example.com/login' }), protocolRelative)
  assert.deepEqual(problemsWith({ signInPath: '//' }), protocolRelative)
  assert.deepEqual(problemsWith({ signInPath: '/\\evil.example.com' }), protocolRelative)
  assert.deepEqual(problemsWith({ signInPath: '/\\' }), protocolRelative)
  assert.deepEqual(problemsWith({ signInPath: '/' }), [])
  assert.deepEqual(problemsWith({ signInPath: '/a//b' }), [])
  assert.deepEqual(problemsWith({ signInPath: '/a\\b' }), [])
})

test('a walk needs a title and a run function; the rest is optional and checked', () => {
  const run = async () => {}
  assert.deepEqual(walkProblems({ title: 'Tour', run }), [])
  assert.deepEqual(walkProblems({ title: 'Tour', description: 'Long', writes: true, startPath: '/home', run }), [])
  assert.deepEqual(walkProblems(null), ['it must export default an object'])
  assert.deepEqual(walkProblems({ run }), ['title must be a non-empty string'])
  assert.deepEqual(walkProblems({ title: ' ', run }), ['title must be a non-empty string'])
  assert.deepEqual(walkProblems({ title: 'T', description: '', run }), ['description must be a non-empty string'])
  assert.deepEqual(walkProblems({ title: 'T', writes: 'no', run }), ['writes must be true or false'])
  assert.deepEqual(walkProblems({ title: 'T', startPath: 'home', run }), ['startPath must be a path starting with /'])
  assert.deepEqual(walkProblems({ title: 'T', startPath: '//other.example.com/home', run }), [
    'startPath must not start with // (that is a link to another host)'
  ])
  assert.deepEqual(walkProblems({ title: 'T', startPath: '/\\evil.example.com', run }), [
    'startPath must not start with // (that is a link to another host)'
  ])
  assert.deepEqual(walkProblems({ title: 'T', startPath: '/\\', run }), [
    'startPath must not start with // (that is a link to another host)'
  ])
  assert.deepEqual(walkProblems({ title: 'T', startPath: '/a//b', run }), [])
  assert.deepEqual(walkProblems({ title: 'T', startPath: '/a\\b', run }), [])
  assert.deepEqual(walkProblems({ title: 'T' }), ['run must be an async function'])
  assert.deepEqual(walkProblems({ title: 'T', run, steps: [] }), ['unknown field "steps"'])
})

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

// A project folder in the temp dir, with these files under demo-capture/.
function projectWith(files) {
  const dir = tempDir('project-')
  for (const [path, text] of Object.entries(files)) {
    const full = join(dir, 'demo-capture', path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return dir
}

const CONFIG = `export default {
  contract: 1,
  name: 'my-app',
  environments: { dev: { url: 'https://dev.example.com/', production: false, hosts: ['dev.example.com'], writeGoAhead: true } },
  signInPath: '/login',
  isSignedOut: (url) => new URL(url).pathname === '/login',
  params: { centre: { default: 'Main', describe: 'which site' } },
}
`
const WALK = (fields) => `export default { ${fields}, async run() {} }\n`

test('loadConfig finds demo-capture/config.mjs and refuses a missing, broken or invalid one', async () => {
  const project = projectWith({ 'config.mjs': CONFIG })
  assert.equal((await loadConfig(project)).name, 'my-app')
  await rejects(loadConfig(tempDir('empty-')), /has no demo-capture\/config\.mjs; pass --project/)
  await rejects(loadConfig(projectWith({ 'config.mjs': 'export default {' })), /demo-capture\/config\.mjs did not load/)
  await rejects(
    loadConfig(projectWith({ 'config.mjs': 'export default { contract: 1 }' })),
    /config\.mjs is not valid:\n- name must be/
  )
})

test('a config that fails to load is refused with the first line of the error only', async () => {
  const project = projectWith({ 'config.mjs': "throw new Error('first line\\nsecond line with detail')" })
  await rejects(loadConfig(project), /^demo-capture\/config\.mjs did not load: first line$/)
})

test('walks are the .mjs files in walks/, loaded by name and checked', async () => {
  const project = projectWith({
    'config.mjs': CONFIG,
    'walks/tour.mjs': WALK("title: 'Tour', description: 'Look around'"),
    'walks/add-item.mjs': WALK("title: 'Add an item', writes: true, startPath: '/items'"),
    'walks/notes.txt': 'not a walk'
  })
  assert.deepEqual(await walkNames(project), ['add-item', 'tour'])
  const tour = await loadWalk(project, 'tour')
  assert.deepEqual({ ...tour, run: typeof tour.run }, {
    name: 'tour',
    title: 'Tour',
    description: 'Look around',
    writes: false,
    startPath: '/',
    run: 'function'
  })
  assert.ok(Object.isFrozen(tour))
  assert.equal((await loadWalk(project, 'add-item')).writes, true)
  assert.deepEqual((await loadWalks(project)).map((walk) => walk.name), ['add-item', 'tour'])
  await rejects(loadWalk(project, 'nope'), /unknown walk "nope"; --list shows the walks/)
  await rejects(loadWalk(project, '../config'), /walk names are lowercase letters, digits and dashes, not "\.\.\/config"/)
  // A name that is not text is refused as a name, not looked up as the walk "5".
  await rejects(loadWalk(project, 5), /walk names are lowercase letters, digits and dashes, not "5"/)
  assert.deepEqual(await walkNames(projectWith({ 'config.mjs': CONFIG })), [])
})

test('a broken or invalid walk is refused with its file name', async () => {
  const project = projectWith({
    'config.mjs': CONFIG,
    'walks/broken.mjs': 'export default {',
    'walks/untitled.mjs': WALK("writes: false")
  })
  await rejects(loadWalk(project, 'broken'), /walks\/broken\.mjs did not load/)
  await rejects(loadWalk(project, 'untitled'), /walks\/untitled\.mjs is not a valid walk:\n- title must be/)
})

test('shared helpers belong in a subfolder of walks/; a stray file in walks/ is refused with where to put it', async () => {
  const tour = ['walks/tour.mjs', WALK("title: 'Tour'")]
  const helper = 'export const x = 1'
  const where = /walks\/ holds only walks; put shared helpers in a subfolder such as walks\/lib\//
  const withLib = projectWith({ 'config.mjs': CONFIG, [tour[0]]: tour[1], 'walks/lib/helper.mjs': helper })
  assert.deepEqual(await walkNames(withLib), ['tour'])
  assert.deepEqual((await loadWalks(withLib)).map((walk) => walk.name), ['tour'])
  // A helper with a walk-style name and no default export.
  const unnamed = projectWith({ 'config.mjs': CONFIG, [tour[0]]: tour[1], 'walks/helpers.mjs': helper })
  await rejects(loadWalks(unnamed), /walks\/helpers\.mjs is not a valid walk:\n- it must export default an object\n- walks\//)
  await rejects(loadWalks(unnamed), where)
  // A helper whose file name could never be a walk name.
  const odd = projectWith({ 'config.mjs': CONFIG, [tour[0]]: tour[1], 'walks/_shared.mjs': helper })
  await rejects(loadWalks(odd), /walks\/_shared\.mjs is not a walk: .*lowercase letters, digits and dashes/)
  await rejects(loadWalks(odd), where)
  // A real walk with a mistake gets no hint about helpers.
  const untitled = projectWith({ 'config.mjs': CONFIG, 'walks/untitled.mjs': WALK('writes: false') })
  await assert.rejects(loadWalks(untitled), (e) => e instanceof CaptureRefusal && !where.test(e.message))
})

test('params take their defaults unless --set gives a value; an undeclared param is refused', () => {
  const declared = valid().params
  assert.deepEqual(resolveParams(declared, {}), { centre: 'Main' })
  assert.deepEqual(resolveParams(declared), { centre: 'Main' })
  assert.ok(Object.isFrozen(resolveParams(declared, {})))
  assert.deepEqual(resolveParams(declared, { centre: 'North' }), { centre: 'North' })
  assert.deepEqual(resolveParams(declared, { centre: '' }), { centre: '' })
  assert.deepEqual(resolveParams(undefined, {}), {})
  assert.throws(() => resolveParams(declared, { site: 'x' }), /unknown param "site"; this project takes centre/)
  assert.throws(() => resolveParams({}, { site: 'x' }), /unknown param "site"; this project takes no params/)
})

test('--env must name a declared environment; production always needs a write go-ahead', () => {
  const config = valid()
  assert.throws(() => selectEnvironment(config, undefined), /--env is required and has no default; this project declares dev, prod/)
  assert.throws(() => selectEnvironment(config, 'uat'), /unknown --env "uat"; this project declares dev, prod/)
  assert.throws(() => selectEnvironment(config, 'toString'), /unknown --env "toString"/)
  const dev = selectEnvironment(config, 'dev')
  assert.ok(Object.isFrozen(dev))
  assert.ok(Object.isFrozen(dev.hosts))
  assert.deepEqual({ ...dev, hosts: [...dev.hosts] }, {
    name: 'dev',
    url: 'https://dev.example.com',
    baseUrl: 'https://dev.example.com',
    production: false,
    hosts: ['dev.example.com', 'api-dev.example.com'],
    writeGoAhead: false
  })
  const prod = selectEnvironment(config, 'prod')
  assert.equal(prod.baseUrl, 'https://example.com')
  assert.equal(prod.writeGoAhead, true)
  const stage = selectEnvironment({ environments: { stage: { url: 'https://s.example.com', production: false, hosts: ['s.example.com'], writeGoAhead: true } } }, 'stage')
  assert.equal(stage.writeGoAhead, true)
})

test('the revision hook is optional and never breaks a run', async () => {
  assert.equal(await appRevision(valid(), 'https://dev.example.com'), 'abc123')
  let seen
  await appRevision({ revision: async (arg) => ((seen = arg), ' v2 ') }, 'https://dev.example.com')
  assert.deepEqual(seen, { baseUrl: 'https://dev.example.com' })
  assert.equal(await appRevision({ revision: async () => ' v2 ' }, 'x'), 'v2')
  assert.equal(await appRevision({}, 'x'), 'unknown')
  assert.equal(await appRevision({ revision: async () => '' }, 'x'), 'unknown')
  assert.equal(await appRevision({ revision: async () => 42 }, 'x'), 'unknown')
  assert.equal(await appRevision({ revision: async () => { throw new Error('offline') } }, 'x'), 'unknown')
})

test('a revision hook that never settles, or settles too late, answers unknown instead of hanging the run', async () => {
  const never = { revision: () => new Promise(() => {}) }
  assert.equal(await appRevision(never, 'x', { timeoutMs: 50 }), 'unknown')
  const late = { revision: () => new Promise((resolve) => setTimeout(resolve, 300, 'v9')) }
  assert.equal(await appRevision(late, 'x', { timeoutMs: 20 }), 'unknown')
  const quick = { revision: () => new Promise((resolve) => setTimeout(resolve, 10, 'v9')) }
  assert.equal(await appRevision(quick, 'x', { timeoutMs: 2000 }), 'v9')
  assert.equal(await appRevision(quick, 'x'), 'v9') // the default wait is longer than a hook's round trip
})

test('the revision timer is cleared, so a fast hook does not keep the process alive', async () => {
  const timers = () => process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length
  const before = timers()
  assert.equal(await appRevision({ revision: async () => 'v1' }, 'x'), 'v1')
  assert.equal(timers(), before)
  assert.equal(await appRevision({ revision: async () => { throw new Error('offline') } }, 'x'), 'unknown')
  assert.equal(timers(), before)
})

test('--list shows each walk with whether it writes, the environments with their gates, and the params', () => {
  const walks = [
    { name: 'add-item', title: 'Add an item', description: 'Adds one item to the list', writes: true },
    { name: 'tour', title: 'Tour', writes: false }
  ]
  const config = valid()
  config.environments.stage = { url: 'https://stage.example.com', production: false, hosts: ['stage.example.com'], writeGoAhead: true }
  const text = describeProject(config, walks)
  assert.match(text, /^my-app: 2 walks \(--walk\)/)
  assert.match(text, /\n {2}add-item {2}writes {5}Add an item\n {23}Adds one item to the list\n/)
  assert.match(text, /\n {2}tour {6}read-only {2}Tour\n/)
  assert.match(text, /\n {2}dev {2}https:\/\/dev\.example\.com\n/)
  assert.match(text, /\n {2}prod {2}https:\/\/example\.com\/ {2}production: every run needs --prod-go-ahead\n/)
  assert.match(text, /\n {2}stage {2}https:\/\/stage\.example\.com {2}write walks need --write-go-ahead/)
  assert.match(text, /Params \(--set name=value\):\n {2}centre {2}default "Main" {2}which site the demo uses$/)
  assert.doesNotMatch(describeProject({ ...config, params: undefined }, walks), /Params/)
  assert.match(describeProject(config, [walks[1]]), /^my-app: 1 walk \(--walk\)/)
  // The name column is at least 4 wide, so a one-letter name is padded to it.
  assert.match(describeProject(config, [{ name: 'a', title: 'T', writes: false }]), /\n {2}a {5}read-only {2}T\n/)
})

// A name is joined into paths and into folder names, and "tour/../x" starts like a name, so the
// patterns must match from the first character to the last.
test('walk, project, environment and param names must match from end to end, and not be empty', async () => {
  const project = projectWith({ 'config.mjs': CONFIG, 'walks/tour.mjs': WALK("title: 'Tour'") })
  for (const name of ['tour/../x', 'tour x', '', 'tour.mjs', 'Tour', 'tour\n'])
    await rejects(loadWalk(project, name), /walk names are lowercase letters, digits and dashes/)
  for (const name of ['a b', 'a/b', 'a.b', 'a\n', ''])
    assert.deepEqual(problemsWith({ name }), ['name must be lowercase letters, digits and dashes'], JSON.stringify(name))
  for (const name of ['dev env', 'dev/x', 'dev.x', ''])
    assert.deepEqual(
      problemsWith({ environments: { [name]: devEnv() } }),
      [`environments.${name}: environment names are lowercase letters, digits and dashes, and not "runs"`],
      JSON.stringify(name)
    )
  for (const key of ['a b', 'a/b', 'a.b', 'a\n', ''])
    assert.deepEqual(
      problemsWith({ params: { [key]: { default: '', describe: 'x' } } }),
      [`params.${key}: names start with a letter and use letters, digits, - or _`],
      JSON.stringify(key)
    )
})

test('readOnlyAllowed takes { method, url, body? } rules; a forbidden rule takes no body', () => {
  // Whole-URL patterns: a rule for the path alone would be valid too, but could never match a URL.
  const token = { method: 'POST', url: /https:\/\/dev\.example\.com\/session\/token/ }
  const brief = { method: 'POST', url: /https:\/\/dev\.example\.com\/brief\?date=\d{8}/, body: /\{"date":"[\d-]+"\}/ }
  assert.deepEqual(problemsWith({ readOnlyAllowed: [token] }), [])
  assert.deepEqual(problemsWith({ readOnlyAllowed: [brief] }), [])
  assert.equal(matchesRule(token, { method: 'POST', url: 'https://dev.example.com/session/token' }, { whole: true }), true)
  assert.equal(matchesRule(brief, { method: 'POST', url: 'https://dev.example.com/brief?date=20261005', body: '{"date":"2026-10-05"}' }, { whole: true }), true)
  assert.deepEqual(problemsWith({ readOnlyAllowed: 'POST /session/token' }), ['readOnlyAllowed must be a list of { method, url, body? } rules'])
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/, body: '{}' }] }), ['readOnlyAllowed[0].body must be a regular expression'])
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: '/x' }] }), ['readOnlyAllowed[0].url must be a regular expression'])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: 'GET', url: /x/, body: /y/ }] }), ['readOnlyForbidden[0]: unknown field "body"'])
})

test('a readOnlyAllowed rule is checked like a forbidden one: an object, a real method, a pattern, no stray field', () => {
  const allowed = (rule) => problemsWith({ readOnlyAllowed: [rule] })
  assert.deepEqual(problemsWith({ readOnlyAllowed: undefined }), [])
  assert.deepEqual(problemsWith({ readOnlyAllowed: [] }), [])
  assert.deepEqual(problemsWith({ readOnlyAllowed: { method: 'POST' } }), ['readOnlyAllowed must be a list of { method, url, body? } rules'])
  // The list of forbidden rules has no body in its message, because a forbidden rule has none.
  assert.deepEqual(problemsWith({ readOnlyForbidden: 'GET /x' }), ['readOnlyForbidden must be a list of { method, url } rules'])
  assert.deepEqual(problemsWith({ readOnlyAllowed: ['POST /x'] }), ['readOnlyAllowed[0] must be an object'])
  assert.deepEqual(problemsWith({ readOnlyAllowed: [null] }), ['readOnlyAllowed[0] must be an object'])
  assert.deepEqual(allowed({ method: 'POST', url: /x/, why: 'y' }), ['readOnlyAllowed[0]: unknown field "why"'])
  // A method is a real HTTP method in any letter case; a typo would never match, so the request
  // the project meant to allow would be refused.
  const notAMethod = ['readOnlyAllowed[0].method must be an HTTP method']
  for (const method of ['POST', 'post', 'Put', 'PATCH', 'DELETE']) assert.deepEqual(allowed({ method, url: /x/ }), [])
  for (const method of ['PSOT', 'POST ', ' POST', 'POST /x', '', 5, null]) assert.deepEqual(allowed({ method, url: /x/ }), notAMethod)
  assert.deepEqual(allowed({ url: /x/ }), notAMethod)
  assert.deepEqual(allowed({ method: 'POST' }), ['readOnlyAllowed[0].url must be a regular expression'])
  assert.deepEqual(allowed({ method: 'POST', url: /x/, body: null }), ['readOnlyAllowed[0].body must be a regular expression'])
  assert.deepEqual(allowed({ method: 'POST', url: /x/, body: undefined }), [])
  // Every problem of a rule is named, and a later rule is numbered.
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/ }, { method: 'PSOT', url: '/x', body: 'y' }] }), [
    'readOnlyAllowed[1].method must be an HTTP method',
    'readOnlyAllowed[1].url must be a regular expression',
    'readOnlyAllowed[1].body must be a regular expression'
  ])
  // A config that names both lists is checked for both.
  assert.deepEqual(
    problemsWith({ readOnlyForbidden: [{ method: 'GET', url: '/x' }], readOnlyAllowed: [{ method: 'POST', url: '/y' }] }),
    ['readOnlyForbidden[0].url must be a regular expression', 'readOnlyAllowed[0].url must be a regular expression']
  )
})

test('a readOnlyAllowed rule is for a method that can change data: a read needs no rule', () => {
  const allowed = (method) => problemsWith({ readOnlyAllowed: [{ method, url: /x/ }] })
  const needsNone = (method) => [
    `readOnlyAllowed[0].method ${method} needs no allowed rule: a read is never refused for being a read, and a readOnlyAllowed rule never lifts a readOnlyForbidden one`
  ]
  for (const [method, shown] of [['GET', 'GET'], ['get', 'GET'], ['Head', 'HEAD'], ['HEAD', 'HEAD'], ['OPTIONS', 'OPTIONS'], ['options', 'OPTIONS']])
    assert.deepEqual(allowed(method), needsNone(shown), method)
  // A typo is still "not a method", and a forbidden rule is for reads, so it may name one.
  assert.deepEqual(allowed('GTE'), ['readOnlyAllowed[0].method must be an HTTP method'])
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method, url: /x/ }] }), [])
})

test('a rule pattern with the y flag is refused, whichever list it is in, and g and m are not', () => {
  const sticky = (where, field) => [`${where}[0].${field} must not have the y (sticky) flag`]
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/y }] }), sticky('readOnlyAllowed', 'url'))
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/, body: /y/y }] }), sticky('readOnlyAllowed', 'body'))
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/gy, body: /y/gy }] }), [
    'readOnlyAllowed[0].url must not have the y (sticky) flag',
    'readOnlyAllowed[0].body must not have the y (sticky) flag'
  ])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: 'GET', url: /x/y }] }), sticky('readOnlyForbidden', 'url'))
  // The other flags are allowed: g has no effect, and m is dropped from an allowed rule, so ^ and $ mean the whole text.
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: /x/gim, body: /y/gimsu }] }), [])
  assert.deepEqual(problemsWith({ readOnlyForbidden: [{ method: 'GET', url: /x/gim }] }), [])
  // A url that is not a pattern is that problem alone: it has no flags to look at.
  assert.deepEqual(problemsWith({ readOnlyAllowed: [{ method: 'POST', url: '/x', body: '/y' }] }), [
    'readOnlyAllowed[0].url must be a regular expression',
    'readOnlyAllowed[0].body must be a regular expression'
  ])
})
