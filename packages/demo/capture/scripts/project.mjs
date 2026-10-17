// A project's adapter: <project>/demo-capture/config.mjs and demo-capture/walks/*.mjs (contract
// 1). Everything is loaded and checked here, before any browser opens.
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CaptureRefusal, READS } from './guards.mjs'

export const CONTRACT = 1
export const NAME = /^[a-z0-9-]+$/
const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/
const PARAM = /^[A-Za-z][A-Za-z0-9_-]*$/
const CONFIG_FIELDS = new Set([
  'contract',
  'name',
  'environments',
  'signInPath',
  'isSignedOut',
  'params',
  'readOnlyForbidden',
  'readOnlyAllowed',
  'sameTabLinks',
  'setup',
  'beforeStep',
  'revision'
])
const ENV_FIELDS = new Set(['url', 'production', 'hosts', 'writeGoAhead'])
const WALK_FIELDS = new Set(['title', 'description', 'writes', 'startPath', 'run'])
const FORBIDDEN_RULE_FIELDS = new Set(['method', 'url'])
const ALLOWED_RULE_FIELDS = new Set(['method', 'url', 'body'])
// The guard compares methods case-insensitively, so a rule method is any letter case of these. A
// typo or a stray space would never match a request, and a read that writes would go through.
const HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'])
const WALKS_HOLD_WALKS = 'walks/ holds only walks; put shared helpers in a subfolder such as walks/lib/'
// A path whose second character is a slash or a backslash names another host: browsers read a
// backslash as a slash in an http(s) URL, so /\host is protocol-relative just like //host.
const OTHER_HOST_PATH = /^\/[/\\]/

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isText = (v) => typeof v === 'string' && v.trim() !== ''
const isBoolean = (v) => typeof v === 'boolean'
const isFunction = (v) => typeof v === 'function'
const optional = (v, check) => v === undefined || check(v)
const firstLine = (error) => String(error?.message ?? error).split('\n')[0]
const unknownFields = (value, known, where) =>
  Object.keys(value)
    .filter((key) => !known.has(key))
    .map((key) => `${where}unknown field "${key}"`)

function httpUrl(value) {
  // The URL parser trims the ends and drops tabs and newlines inside, and coerces a non-string, so
  // the value as written would reach baseUrl and --list with whatever it kept.
  if (typeof value !== 'string' || /\s/.test(value)) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

// `allowed` is true for readOnlyAllowed, whose rules may carry a body pattern and name only a method that
// can change data. The y flag is refused in any rule: a sticky pattern would match only at the start.
function ruleProblems(rules, where, fields, { allowed = false } = {}) {
  if (rules === undefined) return []
  if (!Array.isArray(rules)) return [`${where} must be a list of { method, url${allowed ? ', body?' : ''} } rules`]
  return rules.flatMap((rule, i) => {
    const at = `${where}[${i}]`
    if (!isObject(rule)) return [`${at} must be an object`]
    const problems = unknownFields(rule, fields, `${at}: `)
    if (!isText(rule.method)) problems.push(`${at}.method must be an HTTP method`)
    else if (!HTTP_METHODS.has(rule.method.toUpperCase())) problems.push(`${at}.method must be an HTTP method`)
    else if (allowed && READS.has(rule.method.toUpperCase()))
      problems.push(
        `${at}.method ${rule.method.toUpperCase()} needs no allowed rule: a read is never refused for being a read, and a readOnlyAllowed rule never lifts a readOnlyForbidden one`
      )
    if (!(rule.url instanceof RegExp)) problems.push(`${at}.url must be a regular expression`)
    else if (rule.url.sticky) problems.push(`${at}.url must not have the y (sticky) flag`)
    if (rule.body !== undefined && !(rule.body instanceof RegExp))
      problems.push(`${at}.body must be a regular expression`)
    else if (rule.body?.sticky) problems.push(`${at}.body must not have the y (sticky) flag`)
    return problems
  })
}

function environmentProblems(name, env) {
  const at = `environments.${name}`
  const problems = []
  if (!NAME.test(name) || name === 'runs')
    problems.push(`${at}: environment names are lowercase letters, digits and dashes, and not "runs"`)
  if (!isObject(env)) return [...problems, `${at} must be an object`]
  problems.push(...unknownFields(env, ENV_FIELDS, `${at}: `))
  const url = httpUrl(env.url)
  if (!url) problems.push(`${at}.url must be an http(s) URL`)
  // A bare ? or # leaves search and hash empty, so the written URL is checked for them too.
  if (url && (url.username || url.password || /[?#]/.test(env.url)))
    problems.push(`${at}.url must have no credentials, query or fragment`)
  if (!isBoolean(env.production)) problems.push(`${at}.production must be true or false`)
  if (!optional(env.writeGoAhead, isBoolean)) problems.push(`${at}.writeGoAhead must be true or false`)
  if (!Array.isArray(env.hosts) || env.hosts.length === 0) {
    problems.push(`${at}.hosts must list every host the app uses`)
  } else {
    const bad = env.hosts.filter((host) => typeof host !== 'string' || !HOST.test(host))
    if (bad.length)
      problems.push(`${at}.hosts: ${bad.map((h) => JSON.stringify(h)).join(', ')} must be lowercase host names (no scheme, port or path)`)
    else if (url && !env.hosts.includes(url.hostname))
      problems.push(`${at}.hosts must include ${url.hostname}, the environment's own host`)
  }
  return problems
}

// Every problem with a config, as plain sentences; empty when it is valid.
export function configProblems(config) {
  if (!isObject(config)) return ['config.mjs must export default an object']
  const problems = unknownFields(config, CONFIG_FIELDS, '')
  if (config.contract !== CONTRACT) problems.push(`contract must be ${CONTRACT}`)
  if (typeof config.name !== 'string' || !NAME.test(config.name))
    problems.push('name must be lowercase letters, digits and dashes')
  if (!isObject(config.environments) || Object.keys(config.environments).length === 0)
    problems.push('environments must declare at least one environment')
  else
    for (const [name, env] of Object.entries(config.environments))
      problems.push(...environmentProblems(name, env))
  if (typeof config.signInPath !== 'string' || !config.signInPath.startsWith('/'))
    problems.push('signInPath must be a path starting with /')
  if (typeof config.signInPath === 'string' && OTHER_HOST_PATH.test(config.signInPath))
    problems.push('signInPath must not start with // (that is a link to another host)')
  if (!isFunction(config.isSignedOut)) problems.push('isSignedOut must be a function of the page URL')
  if (config.params !== undefined) {
    if (!isObject(config.params)) problems.push('params must be an object')
    else
      for (const [key, param] of Object.entries(config.params)) {
        if (!PARAM.test(key)) problems.push(`params.${key}: names start with a letter and use letters, digits, - or _`)
        if (!isObject(param) || typeof param.default !== 'string' || !isText(param.describe))
          problems.push(`params.${key} must be { default: string, describe: string }`)
      }
  }
  problems.push(...ruleProblems(config.readOnlyForbidden, 'readOnlyForbidden', FORBIDDEN_RULE_FIELDS))
  problems.push(...ruleProblems(config.readOnlyAllowed, 'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true }))
  if (!optional(config.sameTabLinks, isBoolean)) problems.push('sameTabLinks must be true or false')
  for (const hook of ['setup', 'beforeStep', 'revision'])
    if (!optional(config[hook], isFunction)) problems.push(`${hook} must be a function`)
  return problems
}

export function walkProblems(walk) {
  if (!isObject(walk)) return ['it must export default an object']
  const problems = unknownFields(walk, WALK_FIELDS, '')
  if (!isText(walk.title)) problems.push('title must be a non-empty string')
  if (!optional(walk.description, isText)) problems.push('description must be a non-empty string')
  if (!optional(walk.writes, isBoolean)) problems.push('writes must be true or false')
  if (!optional(walk.startPath, (v) => typeof v === 'string' && v.startsWith('/')))
    problems.push('startPath must be a path starting with /')
  if (typeof walk.startPath === 'string' && OTHER_HOST_PATH.test(walk.startPath))
    problems.push('startPath must not start with // (that is a link to another host)')
  if (!isFunction(walk.run)) problems.push('run must be an async function')
  return problems
}

export const adapterDir = (projectDir) => join(resolve(projectDir), 'demo-capture')

async function importDefault(file, label) {
  try {
    return (await import(pathToFileURL(file).href)).default
  } catch (error) {
    throw new CaptureRefusal(`${label} did not load: ${firstLine(error)}`)
  }
}

export async function loadConfig(projectDir) {
  const file = join(adapterDir(projectDir), 'config.mjs')
  if (!existsSync(file))
    throw new CaptureRefusal(`${resolve(projectDir)} has no demo-capture/config.mjs; pass --project <a folder that has one>`)
  const config = await importDefault(file, 'demo-capture/config.mjs')
  const problems = configProblems(config)
  if (problems.length) throw new CaptureRefusal(`demo-capture/config.mjs is not valid:\n- ${problems.join('\n- ')}`)
  return config
}

export async function walkNames(projectDir) {
  const dir = join(adapterDir(projectDir), 'walks')
  if (!existsSync(dir)) return []
  return (await readdir(dir))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => file.slice(0, -'.mjs'.length))
    .sort()
}

export async function loadWalk(projectDir, name) {
  if (typeof name !== 'string' || !NAME.test(name))
    throw new CaptureRefusal(`walk names are lowercase letters, digits and dashes, not "${name}"`)
  const file = join(adapterDir(projectDir), 'walks', `${name}.mjs`)
  if (!existsSync(file)) throw new CaptureRefusal(`unknown walk "${name}"; --list shows the walks`)
  const walk = await importDefault(file, `walks/${name}.mjs`)
  const problems = walkProblems(walk)
  // A file with no default export is most likely a shared helper put where only walks go.
  if (!isObject(walk)) problems.push(WALKS_HOLD_WALKS)
  if (problems.length) throw new CaptureRefusal(`walks/${name}.mjs is not a valid walk:\n- ${problems.join('\n- ')}`)
  return Object.freeze({
    name,
    title: walk.title,
    description: walk.description,
    writes: walk.writes === true,
    startPath: walk.startPath ?? '/',
    run: walk.run
  })
}

export async function loadWalks(projectDir) {
  const walks = []
  for (const name of await walkNames(projectDir)) {
    // loadWalk refuses a name like this too, but its message is about --walk, not about the file.
    if (!NAME.test(name))
      throw new CaptureRefusal(
        `walks/${name}.mjs is not a walk: walk file names are lowercase letters, digits and dashes. ${WALKS_HOLD_WALKS}`
      )
    walks.push(await loadWalk(projectDir, name))
  }
  return walks
}

// The run's params: each declared param's default, unless --set gave it a value.
export function resolveParams(declared = {}, set = {}) {
  for (const key of Object.keys(set)) {
    if (!Object.hasOwn(declared, key)) {
      const known = Object.keys(declared)
      throw new CaptureRefusal(`unknown param "${key}"; this project takes ${known.length ? known.join(', ') : 'no params'}`)
    }
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(declared).map(([key, param]) => [key, Object.hasOwn(set, key) ? set[key] : param.default])
    )
  )
}

export function selectEnvironment(config, name) {
  const names = Object.keys(config.environments).join(', ')
  if (!name) throw new CaptureRefusal(`--env is required and has no default; this project declares ${names}`)
  if (!Object.hasOwn(config.environments, name))
    throw new CaptureRefusal(`unknown --env "${name}"; this project declares ${names}`)
  const env = config.environments[name]
  return Object.freeze({
    name,
    url: env.url,
    baseUrl: env.url.replace(/\/+$/, ''),
    production: env.production,
    hosts: Object.freeze([...env.hosts]),
    // Production always needs a go-ahead for a write walk.
    writeGoAhead: env.production || env.writeGoAhead === true
  })
}

// What `promise` settles to, or `fallback` once `ms` have passed. The timer is cleared either way,
// so a hook that answers at once does not keep the process alive for the rest of the wait.
function withTimeout(promise, ms, fallback) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, fallback)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// The adapter's revision hook, stored as capture.json appRevision; 'unknown' when it has none,
// throws, answers nothing, or has not answered within timeoutMs.
export async function appRevision(config, baseUrl, { timeoutMs = 10000 } = {}) {
  if (!config.revision) return 'unknown'
  try {
    const value = await withTimeout(config.revision({ baseUrl }), timeoutMs, undefined)
    return isText(value) ? value.trim() : 'unknown'
  } catch {
    return 'unknown'
  }
}

// What --list prints: the walks, the environments and the params.
export function describeProject(config, walks) {
  const width = Math.max(4, ...walks.map((walk) => walk.name.length))
  const lines = [`${config.name}: ${walks.length} walk${walks.length === 1 ? '' : 's'} (--walk)`]
  for (const walk of walks) {
    lines.push(`  ${walk.name.padEnd(width)}  ${walk.writes ? 'writes   ' : 'read-only'}  ${walk.title}`)
    if (walk.description) lines.push(`  ${' '.repeat(width)}             ${walk.description}`)
  }
  lines.push('', 'Environments (--env):')
  for (const [name, env] of Object.entries(config.environments)) {
    const gate = env.production
      ? '  production: every run needs --prod-go-ahead'
      : env.writeGoAhead
        ? '  write walks need --write-go-ahead'
        : ''
    lines.push(`  ${name}  ${env.url}${gate}`)
  }
  const params = Object.entries(config.params ?? {})
  if (params.length) {
    lines.push('', 'Params (--set name=value):')
    for (const [key, param] of params) lines.push(`  ${key}  default "${param.default}"  ${param.describe}`)
  }
  return lines.join('\n')
}
