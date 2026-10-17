// Mutation check for the pure modules: breaks one branch at a time and runs the test file that
// must catch it. A mutant that survives is a branch no test proves. Every file is restored after
// each mutant, also when the check is interrupted.
//
//   node test/mutation-check.mjs          (npm run mutation-check)
//
// Only one check runs at a time per checkout (test/.mutation-check.lock, which git ignores): two at
// once would restore each other's mutated files and leave the source broken. The lock is in the
// checkout, not the temporary folder, because two shells can have different temporary folders.
//
// Before any mutant runs, each one is checked to apply once and to leave source that parses (a
// mutant that does not parse would be "caught" by the load error and prove nothing), and every
// test file the mutants name is run once on the unmutated tree (a red environment would otherwise
// count as a kill). That run's length sets the time a mutant gets: three times as long, never less
// than 15 s. A mutant that runs out of time is a failure of the check, unless it is marked
// `endless: true` because it makes a loop that never ends, and the timeout is how it is caught.
//
// MUTANTS is exported for tools that read the list; importing this file runs nothing.
//
// Left out on purpose, because no test can tell them apart from the original (each was run to
// confirm that every test file still passes):
//   host = parsed.hostname.toLowerCase()    URL already lowercases host names.
//   writeFile's { mode: 0o600 } alone       the chmod after it gives 0600; only the instant between
//                                           the two differs, which no test can see. The pair (mode
//                                           and chmod together) is one mutant, and chmod alone is
//                                           another, killed under a umask that strips the mode.
//   if (!config.revision) return 'unknown'  the try/catch below it answers the same.
//   `?? []` after config.readOnlyAllowed    checkedPolicy defaults a missing list the same way.
//   "g" and "y" in wholeOf's stripped flags  each call builds a new RegExp and tests it once, from the
//                                           start, so neither flag can show.
//   let connect = false in handleWebSocket  the catch sets it to false as well.
//   if (up === probe) return null           in enclosingRepo's walk up to an existing folder: the
//                                           root always exists on POSIX, so the walk never gets
//                                           that far. (The same test with !== is a mutant.)
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TILE = resolve(import.meta.dirname, '..')
const MIN_MUTANT_TIMEOUT_MS = 15_000
const BASELINE_TIMEOUT_MS = 180_000
// `endless: true` marks a mutant that makes a loop that never ends: the test file never finishes,
// and the timeout is what catches it. On any other mutant a timeout is a failure of the check.
const m = (module, find, replace, testFile, { endless = false } = {}) => ({
  file: `scripts/${module}.mjs`,
  find,
  replace,
  test: `test/${testFile}.mjs`,
  endless
})

export const MUTANTS = [
  // project.mjs: config, environment, rule and walk validation; loading; params; environments; --list
  m('project', "const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)", "const isObject = (v) => typeof v === 'object' && !Array.isArray(v)", 'project.test'),
  m('project', "const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)", "const isObject = (v) => v !== null && typeof v === 'object'", 'project.test'),
  m('project', "const isText = (v) => typeof v === 'string' && v.trim() !== ''", "const isText = (v) => typeof v === 'string' && v !== ''", 'project.test'),
  m('project', "const isText = (v) => typeof v === 'string' && v.trim() !== ''", "const isText = (v) => v.trim() !== ''", 'project.test'),
  m('project', 'const optional = (v, check) => v === undefined || check(v)', 'const optional = (v, check) => check(v)', 'project.test'),
  m('project', ".split('\\n')[0]", '', 'project.test'),
  m('project', '  } catch {\n    return null\n  }', '  } catch (error) {\n    throw error\n  }', 'project.test'),
  m('project', "if (!isObject(config)) return ['config.mjs must export default an object']", 'if (false) return []', 'project.test'),
  m('project', 'if (config.contract !== CONTRACT)', 'if (false)', 'project.test'),
  m('project', "typeof config.name !== 'string' || !NAME.test(config.name)", "typeof config.name !== 'string'", 'project.test'),
  m('project', 'Object.keys(config.environments).length === 0', 'false', 'project.test'),
  m('project', "!NAME.test(name) || name === 'runs'", '!NAME.test(name)', 'project.test'),
  m('project', 'export const NAME = /^[a-z0-9-]+$/', 'export const NAME = /^[a-z0-9-]+/', 'project.test'),
  m('project', 'export const NAME = /^[a-z0-9-]+$/', 'export const NAME = /[a-z0-9-]+$/', 'project.test'),
  m('project', 'export const NAME = /^[a-z0-9-]+$/', 'export const NAME = /^[a-z0-9-]*$/', 'project.test'),
  m('project', 'const PARAM = /^[A-Za-z][A-Za-z0-9_-]*$/', 'const PARAM = /^[A-Za-z][A-Za-z0-9_-]*/', 'project.test'),
  m('project', 'const PARAM = /^[A-Za-z][A-Za-z0-9_-]*$/', 'const PARAM = /[A-Za-z][A-Za-z0-9_-]*$/', 'project.test'),
  m('project', 'if (!isObject(env)) return', 'if (false) return', 'project.test'),
  m('project', 'problems.push(...unknownFields(env, ENV_FIELDS, `${at}: `))', '', 'project.test'),
  m('project', 'if (!url) problems.push(', 'if (false) problems.push(', 'project.test'),
  m('project', "url.protocol === 'http:' || url.protocol === 'https:' ? url : null", 'url', 'project.test'),
  m('project', "typeof value !== 'string' || /\\s/.test(value)", "typeof value !== 'string'", 'project.test'),
  m('project', "typeof value !== 'string' || /\\s/.test(value)", '/\\s/.test(value)', 'project.test'),
  m('project', 'if (url && (url.username || url.password || /[?#]/.test(env.url)))', 'if (false)', 'project.test'),
  m('project', 'if (url && (url.username', 'if ((url.username', 'project.test'),
  m('project', 'url.username || url.password ||', 'url.password ||', 'project.test'),
  m('project', 'url.username || url.password ||', 'url.username ||', 'project.test'),
  m('project', '/[?#]/.test(env.url)', '/#/.test(env.url)', 'project.test'),
  m('project', '/[?#]/.test(env.url)', '/[?]/.test(env.url)', 'project.test'),
  m('project', 'if (!isBoolean(env.production))', 'if (false)', 'project.test'),
  m('project', 'if (!optional(env.writeGoAhead, isBoolean))', 'if (false)', 'project.test'),
  m('project', 'env.hosts.length === 0', 'false', 'project.test'),
  m('project', "typeof host !== 'string' || !HOST.test(host)", "typeof host !== 'string'", 'project.test'),
  m('project', String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, String.raw`const HOST = /^[a-z0-9._-]+$/`, 'project.test'),
  m('project', String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/`, 'project.test'),
  m('project', String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, String.raw`const HOST = /[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, 'project.test'),
  m('project', String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*/`, 'project.test'),
  m('project', String.raw`const HOST = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/`, String.raw`const HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/`, 'project.test'),
  m('project', 'else if (url && !env.hosts.includes(url.hostname))', 'else if (false)', 'project.test'),
  m('project', "const problems = unknownFields(config, CONFIG_FIELDS, '')", 'const problems = []', 'project.test'),
  m('project', "!config.signInPath.startsWith('/')", 'false', 'project.test'),
  m('project', "typeof config.signInPath !== 'string' || !config", '!config', 'project.test'),
  m('project', "if (typeof config.signInPath === 'string' && OTHER_HOST_PATH.test(config.signInPath))", 'if (false)', 'project.test'),
  m('project', 'if (!isFunction(config.isSignedOut))', 'if (false)', 'project.test'),
  m('project', 'if (!isObject(config.params))', 'if (false)', 'project.test'),
  m('project', 'if (config.params !== undefined) {', 'if (true) {', 'project.test'),
  m('project', 'if (!PARAM.test(key))', 'if (false)', 'project.test'),
  m('project', 'if (!isObject(param) || typeof param.default', 'if (typeof param.default', 'project.test'),
  m('project', "typeof param.default !== 'string' || !isText(param.describe)", "typeof param.default !== 'string'", 'project.test'),
  m('project', 'if (!Array.isArray(rules)) return', 'if (false) return', 'project.test'),
  m('project', 'if (!isObject(rule)) return', 'if (false) return', 'project.test'),
  m('project', 'if (!isText(rule.method))', 'if (false)', 'project.test'),
  m('project', 'else if (!HTTP_METHODS.has(rule.method.toUpperCase()))', 'else if (false)', 'project.test'),
  m('project', 'HTTP_METHODS.has(rule.method.toUpperCase())', 'HTTP_METHODS.has(rule.method)', 'project.test'),
  m('project', "'PATCH', 'DELETE'])", "'PATCH'])", 'project.test'),
  m('project', 'if (!(rule.url instanceof RegExp))', 'if (false)', 'project.test'),
  m('project', 'const problems = unknownFields(rule, fields, `${at}: `)', 'const problems = []', 'project.test'),
  m('project', 'if (!optional(config.sameTabLinks, isBoolean))', 'if (false)', 'project.test'),
  m('project', 'if (!optional(config[hook], isFunction))', 'if (false)', 'project.test'),
  m('project', "if (!isObject(walk)) return ['it must export default an object']", 'if (false) return []', 'project.test'),
  m('project', "const problems = unknownFields(walk, WALK_FIELDS, '')", 'const problems = []', 'project.test'),
  m('project', 'if (!isText(walk.title))', 'if (false)', 'project.test'),
  m('project', 'if (!optional(walk.description, isText))', 'if (false)', 'project.test'),
  m('project', 'if (!optional(walk.writes, isBoolean))', 'if (false)', 'project.test'),
  m('project', "(v) => typeof v === 'string' && v.startsWith('/')", "(v) => typeof v === 'string'", 'project.test'),
  m('project', "if (typeof walk.startPath === 'string' && OTHER_HOST_PATH.test(walk.startPath))", 'if (false)', 'project.test'),
  m('project', String.raw`const OTHER_HOST_PATH = /^\/[/\\]/`, String.raw`const OTHER_HOST_PATH = /^\/\//`, 'project.test'),
  m('project', String.raw`const OTHER_HOST_PATH = /^\/[/\\]/`, String.raw`const OTHER_HOST_PATH = /^\/\\/`, 'project.test'),
  m('project', String.raw`const OTHER_HOST_PATH = /^\/[/\\]/`, String.raw`const OTHER_HOST_PATH = /\/[/\\]/`, 'project.test'),
  m('project', 'if (!isFunction(walk.run))', 'if (false)', 'project.test'),
  m('project', 'if (!existsSync(file))\n    throw new CaptureRefusal(`${resolve(projectDir)} has no', 'if (false)\n    throw new CaptureRefusal(`${resolve(projectDir)} has no', 'project.test'),
  m('project', 'if (problems.length) throw new CaptureRefusal(`demo-capture/config.mjs is not valid', 'if (false) throw new CaptureRefusal(`demo-capture/config.mjs is not valid', 'project.test'),
  m('project', 'if (!existsSync(dir)) return []', 'if (false) return []', 'project.test'),
  m('project', ".filter((file) => file.endsWith('.mjs'))", '', 'project.test'),
  m('project', "    .map((file) => file.slice(0, -'.mjs'.length))\n", '', 'project.test'),
  m('project', '    .sort()\n', '    .reverse()\n', 'project.test'),
  m('project', "if (typeof name !== 'string' || !NAME.test(name))", "if (typeof name !== 'string')", 'project.test'),
  m('project', "if (typeof name !== 'string' || !NAME.test(name))", 'if (!NAME.test(name))', 'project.test'),
  m('project', 'if (!existsSync(file)) throw new CaptureRefusal(`unknown walk', 'if (false) throw new CaptureRefusal(`unknown walk', 'project.test'),
  m('project', 'if (!isObject(walk)) problems.push(WALKS_HOLD_WALKS)', 'if (false) problems.push(WALKS_HOLD_WALKS)', 'project.test'),
  m('project', 'if (!isObject(walk)) problems.push(WALKS_HOLD_WALKS)', 'problems.push(WALKS_HOLD_WALKS)', 'project.test'),
  m('project', 'a subfolder such as walks/lib/\'', "a subfolder'", 'project.test'),
  m('project', 'if (problems.length) throw new CaptureRefusal(`walks/${name}.mjs is not a valid walk', 'if (false) throw new CaptureRefusal(`walks/${name}.mjs is not a valid walk', 'project.test'),
  m('project', 'if (!NAME.test(name))\n      throw new CaptureRefusal(', 'if (false)\n      throw new CaptureRefusal(', 'project.test'),
  m('project', 'dashes. ${WALKS_HOLD_WALKS}', 'dashes.', 'project.test'),
  m('project', 'return Object.freeze({\n    name,\n    title: walk.title,', 'return ({\n    name,\n    title: walk.title,', 'project.test'),
  m('project', 'writes: walk.writes === true', 'writes: walk.writes !== false', 'project.test'),
  m('project', "startPath: walk.startPath ?? '/'", 'startPath: walk.startPath', 'project.test'),
  m('project', 'if (!Object.hasOwn(declared, key)) {', 'if (false) {', 'project.test'),
  m('project', 'export function resolveParams(declared = {}, set = {})', 'export function resolveParams(declared, set = {})', 'project.test'),
  m('project', 'export function resolveParams(declared = {}, set = {})', 'export function resolveParams(declared = {}, set)', 'project.test'),
  m('project', '  return Object.freeze(\n    Object.fromEntries(', '  return (\n    Object.fromEntries(', 'project.test'),
  m('project', 'Object.hasOwn(set, key) ? set[key] : param.default', 'param.default', 'project.test'),
  m('project', "known.length ? known.join(', ') : 'no params'", "known.join(', ')", 'project.test'),
  m('project', 'if (!name) throw new CaptureRefusal(`--env is required', 'if (false) throw new CaptureRefusal(`--env is required', 'project.test'),
  m('project', 'if (!Object.hasOwn(config.environments, name))', 'if (!(name in config.environments))', 'project.test'),
  m('project', '  return Object.freeze({\n    name,\n    url: env.url,', '  return ({\n    name,\n    url: env.url,', 'project.test'),
  m('project', 'hosts: Object.freeze([...env.hosts])', 'hosts: [...env.hosts]', 'project.test'),
  m('project', "baseUrl: env.url.replace(/\\/+$/, '')", 'baseUrl: env.url', 'project.test'),
  m('project', 'writeGoAhead: env.production || env.writeGoAhead === true', 'writeGoAhead: env.writeGoAhead === true', 'project.test'),
  m('project', 'timeoutMs = 10000', 'timeoutMs = 1', 'project.test'),
  m('project', 'withTimeout(config.revision({ baseUrl }), timeoutMs, undefined)', 'config.revision({ baseUrl })', 'project.test'),
  m('project', '.finally(() => clearTimeout(timer))', '', 'project.test'),
  m('project', "return isText(value) ? value.trim() : 'unknown'", 'return String(value).trim()', 'project.test'),
  m('project', "  } catch {\n    return 'unknown'\n  }", '  } catch (error) {\n    throw error\n  }', 'project.test'),
  m('project', "${walk.writes ? 'writes   ' : 'read-only'}", "${'read-only'}", 'project.test'),
  m('project', 'if (walk.description) lines.push(', 'if (false) lines.push(', 'project.test'),
  m('project', 'const gate = env.production', 'const gate = false', 'project.test'),
  m('project', 'Math.max(4, ...walks.map', 'Math.max(0, ...walks.map', 'project.test'),
  m('project', ': env.writeGoAhead\n', ': false\n', 'project.test'),
  m('project', 'if (params.length) {', 'if (false) {', 'project.test'),
  m('project', 'Object.entries(config.params ?? {})', 'Object.entries(config.params)', 'project.test'),
  m('project', "walks.length === 1 ? '' : 's'", "'s'", 'project.test'),

  // guards.mjs: arguments, gates, the network policy, the outside-repo check and the run lock
  m('guards', "this.name = 'CaptureRefusal'", "this.name = ''", 'guards-args.test'),
  m('guards', 'constructor(message, { step = null } = {})', 'constructor(message, { step } = {})', 'guards-args.test'),
  m('guards', 'this.step = step', 'this.step = null', 'guards-args.test'),
  m('guards', 'if (eq <= 0) throw', 'if (eq < 0) throw', 'guards-args.test'),
  m('guards', 'if (!SET_KEY.test(key))', 'if (false)', 'guards-args.test'),
  m('guards', 'if (Object.hasOwn(existing, key)) throw', 'if (false) throw', 'guards-args.test'),
  m('guards', '[key]: value.slice(eq + 1)', "[key]: value.split('=').pop()", 'guards-args.test'),
  m('guards', "if (value === undefined || value.startsWith('--')) throw", 'if (value === undefined) throw', 'guards-args.test'),
  m('guards', "if (rest[0] === 'sign-in') {", 'if (false) {', 'guards-args.test'),
  m('guards', "if (help) return { ...out, command: 'help' }", "if (false) return { ...out, command: 'help' }", 'guards-args.test'),
  m('guards', "if (out.command === 'sign-in') throw new CaptureRefusal('sign-in does not take --list')", "if (false) throw new CaptureRefusal('sign-in does not take --list')", 'guards-args.test'),
  m('guards', "if (!out.env) throw new CaptureRefusal('--env is required", "if (false) throw new CaptureRefusal('--env is required", 'guards-args.test'),
  m('guards', "if (out.walk) throw new CaptureRefusal('sign-in takes no --walk", "if (false) throw new CaptureRefusal('sign-in takes no --walk", 'guards-args.test'),
  m('guards', "if (!out.walk) throw new CaptureRefusal('--walk is required", "if (false) throw new CaptureRefusal('--walk is required", 'guards-args.test'),
  m('guards', 'else throw new CaptureRefusal(`unknown argument: ${a}`)', 'else {}', 'guards-args.test'),
  m('guards', 'if (env.production && !prodGoAhead)', 'if (false)', 'guards-args.test'),
  m('guards', 'if (walk.writes && env.writeGoAhead && !env.production && !writeGoAhead)', 'if (walk.writes && env.writeGoAhead && !writeGoAhead)', 'guards-args.test'),
  m('guards', 'if (walk.writes && env.writeGoAhead && !env.production && !writeGoAhead)', 'if (env.writeGoAhead && !env.production && !writeGoAhead)', 'guards-args.test'),
  m('guards', "if (walk.writes) throw new CaptureRefusal('--learn-hosts runs read-only", "if (false) throw new CaptureRefusal('--learn-hosts runs read-only", 'guards-args.test'),
  m('guards', 'if (env.production)\n    throw new CaptureRefusal(`--learn-hosts is refused', 'if (false)\n    throw new CaptureRefusal(`--learn-hosts is refused', 'guards-args.test'),
  m('guards', "String(inputType ?? '').toLowerCase() === 'password'", "String(inputType ?? '') === 'password'", 'guards-args.test'),
  m('guards', 'else if (out[a.slice(2)] !== undefined) throw new CaptureRefusal(`${a} is given twice`)', 'else if (false) throw new CaptureRefusal(`${a} is given twice`)', 'guards-args.test'),
  m('guards', "  --help, -h        print this text\n", '', 'guards-args.test'),
  m('guards', "const READS = new Set(['GET', 'HEAD', 'OPTIONS'])", "const READS = new Set(['GET'])", 'guards-network.test'),
  m('guards', '${parsed.hostname}${parsed.pathname}`', '${parsed.hostname}${parsed.pathname}${parsed.search}`', 'guards-network.test'),
  m('guards', 'return `${method.toUpperCase()} ${parsed.hostname}${parsed.pathname}`', 'return `${method} ${parsed.hostname}${parsed.pathname}`', 'guards-network.test'),
  m('guards', 'return `${method.toUpperCase()} ${parsed.hostname}${parsed.pathname}`', 'return `${method.toUpperCase()} ${parsed.host}${parsed.pathname}`', 'guards-network.test'),
  m('guards', 'if (rule.method.toUpperCase() !== method.toUpperCase()) return false', '', 'guards-network.test'),
  m('guards', 'rule.method.toUpperCase() !== method.toUpperCase()', 'rule.method !== method.toUpperCase()', 'project.test'),
  m('guards', 'rule.method.toUpperCase() !== method.toUpperCase()', 'rule.method.toUpperCase() !== method', 'guards-network.test'),
  m('guards', 'if (!found(rule.url, url)) return false', '', 'guards-network.test'),
  m('guards', 'if (!found(rule.url, url)) return false', 'if (!rule.url.test(url)) return false', 'guards-network.test'),
  m('guards', "return typeof body === 'string' && found(rule.body, body)", 'return true', 'guards-network.test'),
  m('guards', "return typeof body === 'string' && found(rule.body, body)", "return found(rule.body, String(body ?? ''))", 'guards-network.test'),
  m('guards', "return typeof body === 'string' && found(rule.body, body)", 'return found(rule.body, body)', 'guards-network.test'),
  m('guards', 'if (rule.body === undefined) return true\n', '', 'guards-network.test'),

  // guards.mjs, an allowed rule matches the whole URL and the whole body; a forbidden rule is searched for
  m('guards', 'const found = whole ? (pattern, text) => wholeOf(pattern).test(text) : (pattern, text) => text.search(pattern) >= 0', 'const found = (pattern, text) => text.search(pattern) >= 0', 'guards-network.test'),
  m('guards', 'const found = whole ? (pattern, text) => wholeOf(pattern).test(text) : (pattern, text) => text.search(pattern) >= 0', 'const found = (pattern, text) => wholeOf(pattern).test(text)', 'guards-network.test'),
  m('guards', 'const found = whole ? ', 'const found = !whole ? ', 'guards-network.test'),
  m('guards', '`^(?:${pattern.source})$`', '`(?:${pattern.source})$`', 'guards-network.test'),
  m('guards', '`^(?:${pattern.source})$`', '`^(?:${pattern.source})`', 'guards-network.test'),
  m('guards', '`^(?:${pattern.source})$`', '`^${pattern.source}$`', 'guards-network.test'),
  m('guards', "pattern.flags.replace(/[gmy]/g, '')", "pattern.flags.replace(/[gy]/g, '')", 'guards-network.test'),
  m('guards', "pattern.flags.replace(/[gmy]/g, '')", "''", 'guards-network.test'),
  m('guards', '!allowed.some((rule) => matchesRule(rule, request, { whole: true }))', '!allowed.some((rule) => matchesRule(rule, request))', 'guards-network.test'),
  m('guards', 'forbidden.some((rule) => matchesRule(rule, request)))', 'forbidden.some((rule) => matchesRule(rule, request, { whole: true })))', 'guards-network.test'),

  // guards.mjs, host:port matching and the host entries a policy may hold
  m('guards', 'entry.host === host && (entry.port === null || entry.port === port)', 'entry.host === host', 'guards-network.test'),
  m('guards', 'entry.host === host && (entry.port === null || entry.port === port)', 'entry.host === host && entry.port === port', 'guards-network.test'),
  m('guards', 'entry.host === host && (entry.port === null || entry.port === port)', 'entry.host === host && entry.port === null', 'guards-network.test'),
  m('guards', 'port = parsed.port || NETWORK_PORTS.get(parsed.protocol)', 'port = parsed.port', 'guards-network.test'),
  m('guards', "const named = entries.some((entry) => entry.host === host) ? `${host}:${port}` : host", 'const named = host', 'guards-network.test'),
  m('guards', "const named = entries.some((entry) => entry.host === host) ? `${host}:${port}` : host", 'const named = `${host}:${port}`', 'guards-network.test'),
  m('guards', 'const entries = hosts.map(parseHostEntry).filter(Boolean)', 'const entries = hosts.map(parseHostEntry)', 'guards-network.test'),
  m('guards', "if (typeof entry !== 'string') return null", 'if (false) return null', 'guards-network.test'),
  m('guards', 'entry.trim().toLowerCase()', 'entry.toLowerCase()', 'guards-network.test'),
  m('guards', 'entry.trim().toLowerCase()', 'entry.trim()', 'guards-network.test'),
  m('guards', String.raw`.replace(/\.(:[0-9]+)?$/, '$1')`, '', 'guards-network.test'),
  m('guards', String.raw`.replace(/\.(:[0-9]+)?$/, '$1')`, String.raw`.replace(/\.(:[0-9]+)?$/, '')`, 'guards-network.test'),
  m('guards', 'if (!match) return null', 'if (false) return null', 'guards-network.test'),
  m('guards', 'if (match[2] === undefined) return { host: match[1], port: null }', 'if (false) return { host: match[1], port: null }', 'guards-network.test'),
  m('guards', 'port >= 1 && port <= 65535 ?', 'port <= 65535 ?', 'guards-network.test'),
  m('guards', 'port >= 1 && port <= 65535 ?', 'port >= 1 ?', 'guards-network.test'),
  m('guards', 'port >= 1 && port <= 65535 ?', 'port > 1 && port <= 65535 ?', 'guards-network.test'),
  m('guards', 'port >= 1 && port <= 65535 ?', 'port >= 1 && port < 65535 ?', 'guards-network.test'),
  m('guards', 'port: String(port) }', 'port: match[2] }', 'guards-network.test'),
  m('guards', String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, String.raw`const HOST_ENTRY = /^([a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, 'guards-network.test'),
  m('guards', String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, String.raw`const HOST_ENTRY = /^(\[[0-9a-f.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, 'guards-network.test'),
  m('guards', String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)$/`, 'guards-network.test'),
  m('guards', String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, String.raw`const HOST_ENTRY = /(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, 'guards-network.test'),
  m('guards', String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?$/`, String.raw`const HOST_ENTRY = /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::([0-9]{1,5}))?/`, 'guards-network.test'),

  // guards.mjs, schemes: a page the browser builds itself, a network scheme and its default port
  m('guards', "const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:'])", "const LOCAL_SCHEMES = new Set(['data:', 'blob:'])", 'guards-network.test'),
  m('guards', "const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:'])", "const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:', 'file:'])", 'guards-network.test'),
  m('guards', "if (LOCAL_SCHEMES.has(parsed.protocol)) return { action: 'continue', kind: 'local' }", "if (false) return { action: 'continue', kind: 'local' }", 'guards-network.test'),
  m('guards', 'if (!NETWORK_PORTS.has(parsed.protocol))', 'if (false)', 'guards-network.test'),
  m('guards', "['http:', '80']", "['http:', '81']", 'guards-network.test'),
  m('guards', "['https:', '443']", "['https:', '444']", 'guards-network.test'),
  m('guards', "['ws:', '80']", "['ws:', '81']", 'guards-network.test'),
  m('guards', "['wss:', '443']", "['wss:', '444']", 'guards-network.test'),
  m('guards', "return { action: 'abort', kind: 'unreadable'", "return { action: 'continue', kind: 'unreadable'", 'guards-network.test'),

  // guards.mjs, the verdicts of classifyRequest
  m('guards', 'if (readOnly && forbidden.some(', 'if (forbidden.some(', 'guards-network.test'),
  m('guards', 'if (readOnly && forbidden.some((rule) => matchesRule(rule, request)))', 'if (false)', 'guards-network.test'),
  m('guards', 'if (readOnly && !isRead && !allowed.some(', 'if (!isRead && !allowed.some(', 'guards-network.test'),
  m('guards', 'if (readOnly && !isRead &&', 'if (readOnly && false &&', 'guards-network.test'),
  m('guards', ' && !allowed.some((rule) => matchesRule(rule, request, { whole: true })))', ')', 'guards-network.test'),
  m('guards', 'if (!listed) {', 'if (false) {', 'guards-network.test'),
  m('guards', 'if (learning) {', 'if (false) {', 'guards-network.test'),
  m('guards', "if (!isRead)\n        return { action: 'abort', kind: 'unlisted'", "if (false)\n        return { action: 'abort', kind: 'unlisted'", 'guards-network.test'),
  m('guards', "return { action: 'continue', kind: 'unlisted', host, listed, where }", "return { action: 'continue', kind: 'listed', host, listed, where }", 'guards-network.test'),
  m('guards', "return { action: 'abort', kind: 'host'", "return { action: 'continue', kind: 'host'", 'guards-network.test'),
  m('guards', "return { action: 'continue', kind: 'listed', host, listed, where }\n}", "return { action: 'abort', kind: 'listed', host, listed, where }\n}", 'guards-network.test'),

  // guards.mjs, checkedPolicy: a policy that cannot be trusted is refused, never guarded with
  m('guards', "if (policy === null || typeof policy !== 'object' || Array.isArray(policy))", "if (typeof policy !== 'object' || Array.isArray(policy))", 'guards-network.test'),
  m('guards', "if (policy === null || typeof policy !== 'object' || Array.isArray(policy))", 'if (policy === null || Array.isArray(policy))', 'guards-network.test'),
  m('guards', "if (policy === null || typeof policy !== 'object' || Array.isArray(policy))", "if (policy === null || typeof policy !== 'object')", 'guards-network.test'),
  m('guards', 'readOnly, learning = false } = policy', 'readOnly, learning } = policy', 'guards-network.test'),
  m('guards', 'const forbidden = policy.forbidden ?? []', 'const forbidden = policy.forbidden', 'guards-network.test'),
  m('guards', 'const allowed = policy.allowed ?? []', 'const allowed = policy.allowed', 'guards-network.test'),
  m('guards', 'if (!Array.isArray(hosts)) throw', 'if (false) throw', 'guards-network.test'),
  m('guards', 'if (parsed === null) throw', 'if (false) throw', 'guards-network.test'),
  m('guards', 'return parsed.port === null ? parsed.host : `${parsed.host}:${parsed.port}`', 'return parsed.host', 'guards-network.test'),
  m('guards', "if (typeof readOnly !== 'boolean') throw", 'if (false) throw', 'guards-network.test'),
  m('guards', "if (typeof learning !== 'boolean') throw", 'if (false) throw', 'guards-network.test'),
  m('guards', 'if (learning && !readOnly)', 'if (false)', 'guards-network.test'),
  m('guards', 'if (!Array.isArray(forbidden)) throw', 'if (false) throw', 'guards-network.test'),
  m('guards', 'if (!Array.isArray(allowed)) throw', 'if (false) throw', 'guards-network.test'),
  m('guards', 'hosts: Object.freeze(normalised),', 'hosts,', 'guards-network.test'),
  m('guards', 'this.policy = checkedPolicy(policy)', 'this.policy = policy', 'guards-network.test'),

  // guards.mjs, RunGuard: check, fail and learned
  m('guards', 'if (this.policy.learning && verdict.listed === false) this.unlisted.add(verdict.host)', '', 'guards-network.test'),
  m('guards', "if (verdict.action === 'abort') {\n      if (this.policy.learning)", "if (false) {\n      if (this.policy.learning)", 'guards-network.test'),
  m('guards', 'if (this.policy.learning) this.refused.add(verdict.shown ?? verdict.where)', 'if (false) this.refused.add(verdict.shown ?? verdict.where)', 'guards-network.test'),
  m('guards', '      step = this.currentStep()\n', '      step = null\n', 'guards-network.test'),
  m('guards', '    } catch {\n      // The step name is only a label; the violation matters more than where it happened.\n    }', '    } finally {\n    }', 'guards-network.test'),
  m('guards', 'throw new CaptureRefusal(first.reason, { step: first.step })', 'throw new CaptureRefusal(first.reason)', 'guards-network.test'),
  m('guards', 'const first = this.violations[0]', 'const first = this.violations.at(-1)', 'guards-network.test'),
  m('guards', 'unlisted: [...this.unlisted].sort()', 'unlisted: [...this.unlisted]', 'guards-network.test'),
  m('guards', 'refused: [...this.refused].sort()', 'refused: [...this.refused]', 'guards-network.test'),

  // guards.mjs, handleRoute: a request is always answered, and one the guard cannot judge is aborted
  m('guards', 'let send = false', 'let send = true', 'guards-network.test'),
  m('guards', "body: request.postData() }) === 'continue'", "body: request.postData() }) !== 'continue'", 'guards-network.test'),
  m('guards', 'body: request.postData() })', "body: '' })", 'guards-network.test'),
  m('guards', 'body: request.postData() })', "body: request.postData() ?? '' })", 'guards-network.test'),
  m('guards', '      this.fail(\n        `guard error on ${nameOf(() => {\n          const request = route.request()\n          return describeRequest(request.method(), request.url())\n        })}`\n      )\n', '', 'guards-network.test'),
  m('guards', "await (send ? route.continue() : route.abort('blockedbyclient'))", 'await route.continue()', 'guards-network.test'),
  m('guards', "await (send ? route.continue() : route.abort('blockedbyclient'))", "await route.abort('blockedbyclient')", 'guards-network.test'),
  m('guards', "route.abort('blockedbyclient'))", "route.abort('failed'))", 'guards-network.test'),
  m('guards', '    } catch {\n      // The page may already be gone; there is nothing left to answer.\n    }', '    } finally {\n    }', 'guards-network.test'),
  m('guards', "return '(unknown request)'", "return ''", 'guards-network.test'),
  m('guards', "  } catch {\n    return '(unknown request)'\n  }", '  } finally {\n  }', 'guards-network.test'),

  // guards.mjs, handleWebSocket: a socket is connected or closed, and one the guard cannot judge is closed
  m('guards', "connect = this.check({ method: 'GET', url: ws.url() }) === 'continue'", 'connect = true', 'guards-network.test'),
  m('guards', "connect = this.check({ method: 'GET', url: ws.url() })", "connect = this.check({ method: 'POST', url: ws.url() })", 'guards-network.test'),
  m('guards', '      if (connect) ws.connectToServer()\n', '', 'guards-network.test'),
  m('guards', '    } catch {\n      connect = false\n', '    } catch {\n', 'guards-network.test'),
  m('guards', "      this.fail(`guard error on ${nameOf(() => describeRequest('GET', ws.url()))}`)\n", '', 'guards-network.test'),
  m('guards', '    if (connect) return\n', '', 'guards-network.test'),
  m('guards', 'Promise.resolve(ws.close()).catch(() => {})', 'Promise.resolve(ws.close())', 'guards-network.test'),
  m('guards', '    } catch {\n      // Already closed.\n    }', '    } finally {\n    }', 'guards-network.test'),

  // guards.mjs, handleRedirectHop: a hop is judged like any request; a first request is left to handleRoute
  m('guards', 'if (!request.redirectedFrom()) return', 'if (false) return', 'guards-network.test'),
  m('guards', 'this.judgeHop({ method: request.method(), url: request.url(), body })', 'this.check({ method: request.method(), url: request.url(), body })', 'guards-network.test'),

  // guards.mjs, judgeHop: a hop was sent before the guard saw it, so it is never "refused" unless the browser refused it
  m('guards', 'classifyRequest(hop, { ...this.policy, readOnly: false, forbidden: [], allowed: [] })', 'classifyRequest(hop, this.policy)', 'guards-network.test'),
  m('guards', "if (lock.kind === 'local') return", 'if (false) return', 'guards-network.test'),
  m('guards', 'this.unlisted.add(lock.host)', '', 'guards-network.test'),
  m('guards', "      if (lock.action === 'abort') {\n        this.fail(", "      if (false) {\n        this.fail(", 'guards-network.test'),
  m('guards', '${lock.named} is not in this environment', '${lock.host} is not in this environment', 'guards-network.test'),
  m('guards', "kind: 'unlisted', host, listed, named, where", "kind: 'unlisted', host, listed, where", 'guards-network.test'),
  m('guards', "} else if (lock.action === 'abort') {", '} else if (false) {', 'guards-network.test'),
  m('guards', 'if (this.policy.learning) this.refused.add(lock.where)\n      else this.fail(lock.reason)', 'this.fail(lock.reason)', 'guards-network.test'),
  m('guards', 'if (this.policy.learning) this.refused.add(lock.where)\n      else this.fail(lock.reason)', 'this.refused.add(lock.where)', 'guards-network.test'),
  m('guards', 'if (!this.policy.readOnly) return', '', 'guards-network.test'),
  m('guards', 'if (this.policy.forbidden.some((rule) => matchesRule(rule, hop)))', 'if (false)', 'guards-network.test'),
  m('guards', 'if (this.policy.forbidden.some((rule) => matchesRule(rule, hop)))', 'if (this.policy.forbidden.some((rule) => matchesRule(rule, hop, { whole: true })))', 'guards-network.test'),
  m('guards', 'else if (!READS.has(hop.method.toUpperCase()) && ', 'else if (', 'guards-network.test'),
  m('guards', '!this.policy.allowed.some((rule) => matchesRule(rule, hop, { whole: true }))', '!this.policy.allowed.some((rule) => matchesRule(rule, hop))', 'guards-network.test'),
  m('guards', "const SENT_BY_REDIRECT = 'was sent by a redirect the guard cannot stop'", "const SENT_BY_REDIRECT = 'was refused'", 'guards-network.test'),
  m('guards', '${lock.where} ${SENT_BY_REDIRECT}: this walk is read-only.', '${lock.where} ${SENT_BY_REDIRECT}: the project lists it as a read that writes.', 'guards-network.test'),
  m('guards', '${lock.where} ${SENT_BY_REDIRECT}: the project lists it as a read that writes.', '${lock.where} ${SENT_BY_REDIRECT}: this walk is read-only.', 'guards-network.test'),
  m('guards', "const body = typeof request.postData === 'function' ? request.postData() : null", "const body = ''", 'guards-network.test'),
  m('guards', "const body = typeof request.postData === 'function' ? request.postData() : null", 'const body = null', 'guards-network.test'),
  m('guards', "request.postData() : null", "request.postData() : ''", 'guards-network.test'),
  m('guards', "request.postData() : null", "request.postData() ?? '' : null", 'guards-network.test'),
  m('guards', "typeof request.postData === 'function' ? request.postData()", 'true ? request.postData()', 'guards-network.test'),
  m('guards', '      this.judgeHop({ method: request.method(), url: request.url(), body })\n    } catch {\n      this.fail(`guard error on ${nameOf(() => describeRequest(request.method(), request.url()))}`)\n', '      this.judgeHop({ method: request.method(), url: request.url(), body })\n    } catch {\n', 'guards-network.test'),

  // guards.mjs, the final review's fixes: what a refusal and a learning run say of a non-read (the
  // allowed rule that came close; the scheme, port and query names), every host a learning run
  // tried, frozen copies of the policy, and the tripwire for a request the route guard never judged
  m('guards', '.filter(Boolean)\n      .map((part)', '.map((part)', 'guards-network.test'),
  m('guards', "(part.includes('=') ? `${part.slice(0, part.indexOf('='))}=…` : '…')", 'part', 'guards-network.test'),
  m('guards', "(part.includes('=') ? `${part.slice(0, part.indexOf('='))}=…` : '…')", "`${part.slice(0, part.indexOf('='))}=…`", 'guards-network.test'),
  m('guards', "const query = names.length ? `?${names.join('&')}` : ''", "const query = `?${names.join('&')}`", 'guards-network.test'),
  m('guards', 'return `${method.toUpperCase()} ${parsed.protocol}//${parsed.host}${parsed.pathname}${query}', 'return `${method} ${parsed.protocol}//${parsed.host}${parsed.pathname}${query}', 'guards-network.test'),
  m('guards', '${parsed.protocol}//${parsed.host}${parsed.pathname}${query}', '${parsed.protocol}//${parsed.hostname}${parsed.pathname}${query}', 'guards-network.test'),
  m('guards', "(${typeof body === 'string' ? 'with a body' : 'no body'})", "(${body ? 'with a body' : 'no body'})", 'guards-network.test'),
  m('guards', "    return `${method.toUpperCase()} (unreadable URL)`\n  }\n}\n\n// `pattern`", "    return ''\n  }\n}\n\n// `pattern`", 'guards-network.test'),
  m('guards', 'rule.method.toUpperCase() === request.method.toUpperCase() && test(rule)', 'test(rule)', 'guards-network.test'),
  m('guards', 'rule.method.toUpperCase() === request.method.toUpperCase() && test(rule)', 'rule.method === request.method && test(rule)', 'guards-network.test'),
  m('guards', 'const whole = index((rule) => wholeOf(rule.url).test(request.url))', 'const whole = index((rule) => rule.url.test(request.url))', 'guards-network.test'),
  m('guards', '  if (whole >= 0)\n', '  if (false)\n', 'guards-network.test'),
  m('guards', '  if (whole >= 0)\n', '  if (whole > 0)\n', 'guards-network.test'),
  m('guards', "return typeof request.body === 'string'\n", 'return true\n', 'guards-network.test'),
  m('guards', "return typeof request.body === 'string'\n", 'return false\n', 'guards-network.test'),
  m('guards', 'const part = index((rule) => request.url.search(rule.url) >= 0)', 'const part = -1', 'guards-network.test'),
  m('guards', 'return part >= 0 ? ', 'return part > 0 ? ', 'guards-network.test'),
  m('guards', 'this walk is read-only${hint}.`', 'this walk is read-only.`', 'guards-network.test'),
  m('guards', 'shown: shown(hint)', 'shown: shown()', 'guards-network.test'),
  m('guards', 'const shown = (hint = \'\') => (isRead ? where : `${describeNonRead(request)}${hint}`)', 'const shown = () => where', 'guards-network.test'),
  m('guards', '(isRead ? where : `${describeNonRead(request)}${hint}`)', '(`${describeNonRead(request)}${hint}`)', 'guards-network.test'),
  m('guards', "kind: 'forbidden', host, listed, where", "kind: 'forbidden', host, where", 'guards-network.test'),
  m('guards', "kind: 'write', host, listed, where", "kind: 'write', host, where", 'guards-network.test'),
  m('guards', "return { action: 'continue', kind: 'unlisted', host, listed, where }", "return { action: 'continue', kind: 'unlisted', host, where }", 'guards-network.test'),
  m('guards', "return { action: 'continue', kind: 'listed', host, listed, where }", "return { action: 'continue', kind: 'listed', host, listed: false, where }", 'guards-network.test'),
  m('guards', 'this.policy.learning && verdict.listed === false', 'verdict.listed === false', 'guards-network.test'),
  m('guards', 'this.policy.learning && verdict.listed === false', "verdict.kind === 'unlisted'", 'guards-network.test'),
  m('guards', 'this.refused.add(verdict.shown ?? verdict.where)', 'this.refused.add(verdict.where)', 'guards-network.test'),
  m('guards', 'this.refused.add(verdict.shown ?? verdict.where)', 'this.refused.add(verdict.shown)', 'guards-network.test'),
  m('guards', '  return Object.freeze({\n    ...policy,', '  return ({\n    ...policy,', 'guards-network.test'),
  m('guards', 'hosts: Object.freeze(normalised),', 'hosts: normalised,', 'guards-network.test'),
  m('guards', 'forbidden: Object.freeze([...forbidden]),', 'forbidden: [...forbidden],', 'guards-network.test'),
  m('guards', 'forbidden: Object.freeze([...forbidden]),', 'forbidden: Object.freeze(forbidden),', 'guards-network.test'),
  m('guards', 'forbidden: Object.freeze([...forbidden]),', 'forbidden,', 'guards-network.test'),
  m('guards', 'allowed: Object.freeze([...allowed])', 'allowed: [...allowed]', 'guards-network.test'),
  m('guards', 'allowed: Object.freeze([...allowed])', 'allowed: Object.freeze(allowed)', 'guards-network.test'),
  m('guards', 'allowed: Object.freeze([...allowed])', 'allowed', 'guards-network.test'),
  m('guards', '      this.judged.add(request)\n', '', 'guards-network.test'),
  m('guards', 'if (request.redirectedFrom() || this.judged.has(request)) return', 'if (this.judged.has(request)) return', 'guards-network.test'),
  m('guards', 'if (request.redirectedFrom() || this.judged.has(request)) return', 'if (request.redirectedFrom()) return', 'guards-network.test'),
  m('guards', '      this.fail(`${UNGUARDED} (${describeRequest(request.method(), request.url())}).`)\n', '', 'guards-network.test'),
  m('guards', "const UNGUARDED = 'A request went out without the guard: the walk handled it with its own route'", "const UNGUARDED = 'A request was refused'", 'guards-network.test'),
  m('guards', '      if (request.redirectedFrom() || this.judged.has(request)) return\n      this.fail(`${UNGUARDED} (${describeRequest(request.method(), request.url())}).`)\n    } catch {\n      this.fail(`guard error on ${nameOf(() => describeRequest(request.method(), request.url()))}`)\n', '      if (request.redirectedFrom() || this.judged.has(request)) return\n      this.fail(`${UNGUARDED} (${describeRequest(request.method(), request.url())}).`)\n    } catch {\n', 'guards-network.test'),

  // guards.mjs, the outside-repo check and the run lock
  m('guards', 'while (!existsSync(probe)) {', 'while (false) {', 'guards-files.test'),
  m('guards', 'if (up === probe) return null', 'if (up !== probe) return null', 'guards-files.test'),
  m('guards', 'for (let dir = realpathSync(probe); ; dir = dirname(dir))', 'for (let dir = probe; ; dir = dirname(dir))', 'guards-files.test'),
  m('guards', 'if (dirname(dir) === dir) return null', 'if (dirname(dir) === dir) return dir', 'guards-files.test'),
  m('guards', 'if (dirname(dir) === dir) return null', 'if (dirname(dir) !== dir) return null', 'guards-files.test'),
  m('guards', '    if (dirname(dir) === dir) return null\n', '', 'guards-files.test', { endless: true }),
  m('guards', "if (existsSync(join(dir, '.git'))) return dir", 'if (false) return dir', 'guards-files.test'),
  m('guards', 'if (repo)\n    throw new CaptureRefusal(', 'if (false)\n    throw new CaptureRefusal(', 'guards-files.test'),
  m('guards', "return error.code === 'EPERM'", 'return false', 'guards-files.test'),
  m('guards', 'process.kill(pid, 0)\n    return true', 'process.kill(pid, 0)\n    return false', 'guards-files.test'),
  m('guards', '  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 })\n', '', 'guards-files.test'),
  m('guards', '{ recursive: true, mode: 0o700 })', '{ recursive: true })', 'guards-files.test'),
  m('guards', 'attempt < 2; attempt++', 'attempt < 1; attempt++', 'guards-files.test'),
  m('guards', "flag: 'wx'", "flag: 'w'", 'guards-files.test'),
  m('guards', "{ flag: 'wx', mode: 0o600 }", "{ flag: 'wx' }", 'guards-files.test'),
  m('guards', "if (error.code !== 'EEXIST') throw error", 'if (false) throw error', 'guards-files.test'),
  m('guards', 'if (Number.isInteger(holder) && holder > 0 && isAlive(holder))', 'if (Number.isInteger(holder) && holder > 0)', 'guards-files.test'),
  m('guards', 'holder > 0 && isAlive(holder)', 'holder >= 0 && isAlive(holder)', 'guards-files.test'),
  m('guards', 'delete the lock file ${lockPath} if no run is going', 'delete the lock file if no run is going', 'guards-files.test'),
  m('guards', 'if (attempt === 1) break', 'if (false) break', 'guards-files.test'),
  m('guards', 'if (attempt === 1) break', 'if (attempt === 0) break', 'guards-files.test'),
  m('guards', '      await rm(lockPath, { force: true })', '', 'guards-files.test'),
  m('guards', 'return () => rm(lockPath, { force: true })', 'return async () => {}', 'guards-files.test'),

  // session.mjs: paths, private files, the sign-in wait, sign-in and recovery
  m('session', "env.DEMO_CAPTURE_HOME ? resolve(env.DEMO_CAPTURE_HOME) : join(home, '.demo-capture')", "join(home, '.demo-capture')", 'session.test'),
  m('session', 'resolve(env.DEMO_CAPTURE_HOME)', 'env.DEMO_CAPTURE_HOME', 'session.test'),
  m('session', '${pad(now.getMinutes())}${pad(now.getSeconds())}', '${pad(now.getMinutes())}', 'session.test'),
  m('session', 'pad(now.getMonth() + 1)', 'pad(now.getMonth())', 'session.test'),
  m('session', 'await chmod(dir, 0o700)', '', 'session.test'),
  m('session', 'return (await stat(statePath)).isFile()', 'return true', 'session.test'),
  m('session', 'return (await stat(statePath)).isFile()\n  } catch {\n    return false', 'return (await stat(statePath)).isFile()\n  } catch {\n    return true', 'session.test'),
  m('session', 'await mkdir(dir, { recursive: true, mode: 0o700 })', 'await mkdir(dir, { recursive: true })', 'session.test'),
  m('session', '`${statePath}.tmp`', '`${statePath}.temp`', 'session.test'),
  m('session', 'await rm(temp, { force: true })\n', '', 'session.test'),
  m('session', 'await chmod(temp, 0o600)\n', '', 'session.test'),
  m('session', 'await writeFile(temp, JSON.stringify(state), { mode: 0o600 })\n  await chmod(temp, 0o600)', 'await writeFile(temp, JSON.stringify(state))', 'session.test'),
  m('session', 'context.storageState({ indexedDB: true })', 'context.storageState()', 'session.test'),
  m('session', 'await rename(temp, statePath)', '', 'session.test'),
  m('session', '  await ensurePrivateDir(dirname(statePath))\n', '', 'session.test'),
  m('session', 'await rm(tempPathOf(statePath), { force: true })', '', 'session.test'),
  m('session', '  await rm(statePath, { force: true })\n', '', 'session.test'),
  m('session', 'return new URL(url).origin === origin && !isSignedOut(url)', 'return !isSignedOut(url)', 'session.test'),
  m('session', 'return new URL(url).origin === origin && !isSignedOut(url)', 'return new URL(url).origin === origin', 'session.test'),
  m('session', 'return new URL(url).origin === origin && !isSignedOut(url)\n  } catch {\n    return false', 'return new URL(url).origin === origin && !isSignedOut(url)\n  } catch {\n    return true', 'session.test'),
  m('session', 'if (page.isClosed())', 'if (false)', 'session.test'),
  m('session', '} else {\n      since = null\n    }', '} else {\n    }', 'session.test'),
  m('session', 'if (at - since >= stableMs) return', 'if (at - since >= 0) return', 'session.test'),
  m('session', 'since ??= at', 'since = at', 'session.test'),
  m('session', 'if (at >= deadline)', 'if (false)', 'session.test', { endless: true }),
  m('session', '    now = Date.now,\n', '    now = () => 0,\n', 'session.test'),
  m('session', 'sleep = (ms) => new Promise((done) => setTimeout(done, ms))', 'sleep = () => Promise.resolve()', 'session.test'),
  m('session', 'pollMs = 250,', 'pollMs = 1,', 'session.test'),
  m('session', 'browserType.launch({ headless: false })', 'browserType.launch({ headless: true })', 'session.test'),
  m('session', 'browser.newContext({ viewport: null })', 'browser.newContext({})', 'session.test'),
  m('session', 'await page.goto(`${baseUrl}${signInPath}`, { timeout', 'await page.goto(baseUrl, { timeout', 'session.test'),
  m('session', ".catch(() => undefined)", '', 'session.test'),
  m('session', 'origin: new URL(baseUrl).origin', 'origin: baseUrl', 'session.test'),
  m('session', '    await saveState(context, statePath)\n', '', 'session.test'),
  m('session', 'await browser.close()', '', 'session.test'),
  m('session', 'if (!(await stateExists())) await promptSignIn()', 'await stateExists()', 'session.test'),
  m('session', 'if (!first.signedOut) return first', 'return first', 'session.test'),
  m('session', '  await dropState()\n', '', 'session.test'),
  m('session', '  await resetRunDir()\n', '', 'session.test'),
  m('session', 'if (second.signedOut)\n    throw', 'if (false)\n    throw', 'session.test'),
  // session.mjs, the final review's fixes: the sign-in page's timeout and refusal, and what a
  // signed-out attempt's guard found
  m('session', '`${baseUrl}${signInPath}`, { timeout: SIGN_IN_PAGE_TIMEOUT_MS }', '`${baseUrl}${signInPath}`, {}', 'session.test'),
  m('session', 'export const SIGN_IN_PAGE_TIMEOUT_MS = 90_000', 'export const SIGN_IN_PAGE_TIMEOUT_MS = 30_000', 'session.test'),
  m('session', 'throw new CaptureRefusal(`The sign-in page did not load (', 'throw error\n      throw new CaptureRefusal(`The sign-in page did not load (', 'session.test'),
  m('session', "did not load (${String(error?.message ?? error).split('\\n')[0]})", 'did not load (${String(error?.message ?? error)})', 'session.test'),
  m('session', "(violations.length ? ` Its guard also found: ${violations.join(' ')}` : '')", "('')", 'session.test'),
  m('session', "(violations.length ? ` Its guard also found: ${violations.join(' ')}` : '')", "(` Its guard also found: ${violations.join(' ')}`)", 'session.test'),
  m('session', "${violations.join(' ')}", "${violations.join('')}", 'session.test'),
  m('session', 'const alsoFound = ({ violations = [] })', 'const alsoFound = ({ violations })', 'session.test'),
  m('session', 'Opening the sign-in window again.${alsoFound(first)}`', 'Opening the sign-in window again.`', 'session.test'),
  m('session', 'then run sign-in.${alsoFound(second)}`', 'then run sign-in.`', 'session.test'),

  // readOnlyAllowed: the optional contract field for non-reads that change no data. project.mjs checks
  // its rules, cli.mjs hands them to the guard and names the field in the learning report, and
  // guards.mjs applies them (its body-pattern branches are with matchesRule and the two hand-offs above).
  m('project', "  'readOnlyAllowed',\n", '', 'project.test'),
  m('project', "problems.push(...ruleProblems(config.readOnlyAllowed, 'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true }))", '', 'project.test'),
  m('project', "ruleProblems(config.readOnlyAllowed, 'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true })", "ruleProblems(config.readOnlyForbidden, 'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true })", 'project.test'),
  m('project', "ruleProblems(config.readOnlyAllowed, 'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true })", "ruleProblems(config.readOnlyAllowed, 'readOnlyForbidden', ALLOWED_RULE_FIELDS, { allowed: true })", 'project.test'),
  m('project', "'readOnlyAllowed', ALLOWED_RULE_FIELDS, { allowed: true }))", "'readOnlyAllowed', FORBIDDEN_RULE_FIELDS, { allowed: true }))", 'project.test'),
  m('project', "ALLOWED_RULE_FIELDS, { allowed: true }))", 'ALLOWED_RULE_FIELDS))', 'project.test'),
  m('project', "'readOnlyForbidden', FORBIDDEN_RULE_FIELDS))", "'readOnlyForbidden', FORBIDDEN_RULE_FIELDS, { allowed: true }))", 'project.test'),
  m('project', '{ allowed = false } = {}', '{ allowed = true } = {}', 'project.test'),
  m('project', "${allowed ? ', body?' : ''}", "${''}", 'project.test'),
  m('project', "${allowed ? ', body?' : ''}", "${', body?'}", 'project.test'),
  m('project', 'else if (allowed && READS.has(rule.method.toUpperCase()))', 'else if (false)', 'project.test'),
  m('project', 'else if (allowed && READS.has(rule.method.toUpperCase()))', 'else if (READS.has(rule.method.toUpperCase()))', 'project.test'),
  m('project', 'else if (allowed && READS.has(rule.method.toUpperCase()))', 'else if (allowed && READS.has(rule.method))', 'project.test'),
  m('project', 'else if (rule.url.sticky)', 'else if (false)', 'project.test'),
  m('project', 'else if (rule.body?.sticky)', 'else if (false)', 'project.test'),
  m('project', "'readOnlyForbidden', FORBIDDEN_RULE_FIELDS))", "'readOnlyForbidden', ALLOWED_RULE_FIELDS))", 'project.test'),
  m('project', "const ALLOWED_RULE_FIELDS = new Set(['method', 'url', 'body'])", "const ALLOWED_RULE_FIELDS = new Set(['method', 'url'])", 'project.test'),
  m('project', 'if (rule.body !== undefined && !(rule.body instanceof RegExp))', 'if (false)', 'project.test'),
  m('project', 'if (rule.body !== undefined && !(rule.body instanceof RegExp))', 'if (!(rule.body instanceof RegExp))', 'project.test'),
  m('cli', 'allowed: config.readOnlyAllowed ?? [],', '', 'cli-record.test'),
  m('cli', 'allowed: config.readOnlyAllowed ?? [],', 'allowed: config.readOnlyForbidden ?? [],', 'cli-record.test'),
  m('cli', "          'A non-read that changes no data may go in readOnlyAllowed, once a person approves it. ' +\n", '', 'cli-record.test'),
  m('cli', "          'A read listed in readOnlyForbidden stays refused.'", "          ''", 'cli-record.test'),
  m('guards', 'if (readOnly && forbidden.some((rule) => matchesRule(rule, request)))', 'if (readOnly && forbidden.some((rule) => matchesRule(rule, request)) && !allowed.some((rule) => matchesRule(rule, request, { whole: true })))', 'guards-network.test'),
  m('guards', ' && !allowed.some((rule) => matchesRule(rule, request, { whole: true })))', ' && !allowed.some((rule) => matchesRule({ ...rule, method: request.method }, request, { whole: true })))', 'guards-network.test'),
  m('guards', 'const listed = entries.some((entry) => entry.host === host && (entry.port === null || entry.port === port))', 'const listed = allowed.some((rule) => matchesRule(rule, request, { whole: true })) || entries.some((entry) => entry.host === host && (entry.port === null || entry.port === port))', 'guards-network.test'),
  m('guards', 'body: request.postData() })', "body: request.postData() ?? '' })", 'capture.e2e')
]

// `node --test <file>` in a process group of its own, so a timeout or an interrupt ends the test
// process that node --test started as well, and nothing is left running behind a mutant.
// Resolves to { code, timedOut, errored, output }; `errored` means the run did not end the way a
// passing or failing test does (it could not start, or something other than us killed it).
function runTestFile(tile, testFile, timeoutMs, onStop) {
  // Run from inside a test, node --test would take this one for a part of its parent's run and
  // report nothing, so the variable that says so is left out.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done) => {
    const child = spawn(process.execPath, ['--test', join(tile, testFile)], {
      cwd: tile,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    const keep = (chunk) => {
      output = (output + chunk).slice(-8000)
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    let stopped = false
    const stop = () => {
      stopped = true
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // The group is already gone.
      }
    }
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, timeoutMs)
    onStop(stop)
    child.on('error', (error) => {
      clearTimeout(timer)
      onStop(null)
      done({ code: null, timedOut: false, errored: true, output: String(error) })
    })
    child.on('exit', () => {
      // Whatever the test left running in the group goes with it.
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // Nothing is left.
      }
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      onStop(null)
      // A signal we did not send (a timeout and an interrupt are ours) is not a test failing.
      const errored = code === null && !stopped
      done({ code, timedOut, errored, output: errored ? `${output}\nended by ${signal}` : output })
    })
  })
}

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

// The lock file is in the checkout it protects, so it is the same file for every shell that can
// reach those files, whatever its temporary folder. Git ignores it (see the tile's .gitignore).
export const checkLockPath = (tile = TILE) => join(tile, 'test', '.mutation-check.lock')

// Two checks at once would each mutate the same files and restore what the other had already
// mutated, leaving the source broken. A check starts only while it holds this lock. Returns the
// function that releases it, which removes the lock only while it still holds this pid. As with the
// engine's run lock, two checks that start at the same instant against a stale lock can both
// proceed; the lock is meant for two checks started by a person or a script a moment apart.
export function acquireCheckLock(lockPath = checkLockPath(), { pid = process.pid, isAlive = pidAlive } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, String(pid), { flag: 'wx', mode: 0o600 })
      return () => {
        try {
          if (readFileSync(lockPath, 'utf8') === String(pid)) rmSync(lockPath, { force: true })
        } catch {
          // Already gone.
        }
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      let text = ''
      try {
        text = readFileSync(lockPath, 'utf8')
      } catch {
        // It went away between the write and the read; the next attempt takes it.
      }
      const holder = Number(text.trim())
      if (Number.isInteger(holder) && holder > 0 && isAlive(holder))
        throw new Error(
          `Another mutation check (pid ${holder}) is using these files; wait for it to finish, or delete the lock file ${lockPath} if no check is running.`
        )
      // The last attempt never removes the file: it may be another check's fresh lock.
      if (attempt === 1) break
      rmSync(lockPath, { force: true })
    }
  }
  throw new Error('Could not take the mutation-check lock; try again.')
}

const occurrences = (text, find) => text.split(find).length - 1
const labelOf = (mutant, i) => `#${String(i + 1).padStart(3)} ${mutant.file}: ${mutant.find.split('\n')[0].trim().slice(0, 72)}`
const seconds = (ms) => (ms / 1000).toFixed(1)

// Runs every mutant and returns the exit code: 0 when all were caught, 1 otherwise.
// `tile` is the folder the mutants' files and test files are under; the options exist for the tests of
// this runner, which run it over a small folder of their own.
export async function runMutationCheck(
  mutants = MUTANTS,
  { tile = TILE, lockPath = checkLockPath(tile), log = console.log, minTimeoutMs = MIN_MUTANT_TIMEOUT_MS } = {}
) {
  let release
  try {
    release = acquireCheckLock(lockPath)
  } catch (error) {
    log(error.message)
    return 1
  }
  let stopping = false
  let stopCurrent = null
  let applied = null
  const onStop = (stop) => {
    stopCurrent = stop
  }
  // An interrupt ends the running test, lets the file be restored, and stops the loop.
  const interrupt = () => {
    stopping = true
    stopCurrent?.()
  }
  // A last resort for an exit nobody planned: the running test ends, a file is never left mutated,
  // and the lock is never left held.
  const atExit = () => {
    stopCurrent?.()
    if (applied) writeFileSync(applied.path, applied.original)
    release()
  }
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const signal of signals) process.on(signal, interrupt)
  process.on('exit', atExit)
  try {
    return await check(mutants, log, { tile, minTimeoutMs, onStop, isStopping: () => stopping, setApplied: (value) => (applied = value) })
  } finally {
    for (const signal of signals) process.off(signal, interrupt)
    process.off('exit', atExit)
    release()
  }
}

async function check(mutants, log, { tile, minTimeoutMs, onStop, isStopping, setApplied }) {
  const started = Date.now()

  // 1. Every text to break occurs exactly once and the mutated source still parses, before any
  // time is spent on tests.
  const unapplied = []
  const scratch = mkdtempSync(join(tmpdir(), 'mutation-check-'))
  try {
    for (const [i, mutant] of mutants.entries()) {
      const original = readFileSync(join(tile, mutant.file), 'utf8')
      const count = occurrences(original, mutant.find)
      if (count !== 1) {
        unapplied.push(`${labelOf(mutant, i)}\n      the text to break occurs ${count} times, not once`)
        continue
      }
      const parsed = join(scratch, 'mutant.mjs')
      writeFileSync(parsed, original.split(mutant.find).join(mutant.replace))
      const parse = spawnSync(process.execPath, ['--check', parsed], { encoding: 'utf8' })
      if (parse.status !== 0)
        unapplied.push(`${labelOf(mutant, i)}\n      the mutated source does not parse: ${(parse.stderr ?? String(parse.error)).split('\n').find((line) => /Error/.test(line))}`)
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  if (unapplied.length) {
    log(unapplied.join('\n'))
    log(`${unapplied.length} of ${mutants.length} mutants did not apply; nothing was run.`)
    return 1
  }

  // 2. Every test file the mutants name passes on the unmutated tree. How long it took sets the
  // time a mutant gets: three times as long, and never less than 15 s.
  const caps = new Map()
  for (const testFile of new Set(mutants.map((mutant) => mutant.test))) {
    const at = Date.now()
    const result = await runTestFile(tile, testFile, BASELINE_TIMEOUT_MS, onStop)
    if (isStopping()) {
      log('Interrupted; every file is restored.')
      return 1
    }
    if (result.errored || result.code !== 0) {
      log(
        `${testFile} fails on the unmutated tree${result.timedOut ? ` (it did not finish in ${BASELINE_TIMEOUT_MS / 1000} s)` : ''}, so no mutant can be judged by it. Fix it first.\n${result.output}`
      )
      return 1
    }
    const took = Date.now() - at
    caps.set(testFile, Math.max(minTimeoutMs, 3 * took))
    log(`baseline ${testFile} passes unmutated (${seconds(took)} s; a mutant gets ${seconds(caps.get(testFile))} s)`)
  }

  // 3. Every mutant makes its test file fail. A run that ends any other way is not a kill: a timeout
  // proves something only for a mutant marked endless, which is meant to make a loop that never ends.
  let failures = 0
  for (const [i, mutant] of mutants.entries()) {
    const path = join(tile, mutant.file)
    const original = readFileSync(path, 'utf8')
    setApplied({ path, original })
    writeFileSync(path, original.split(mutant.find).join(mutant.replace))
    let result
    try {
      result = await runTestFile(tile, mutant.test, caps.get(mutant.test), onStop)
    } finally {
      writeFileSync(path, original)
      setApplied(null)
    }
    if (isStopping()) break
    let verdict
    if (result.errored) verdict = 'ERRORED '
    else if (result.timedOut) verdict = mutant.endless ? 'killed (timed out)' : 'TIMED OUT'
    else verdict = result.code !== 0 ? 'killed  ' : 'SURVIVED'
    log(`${verdict} ${labelOf(mutant, i)}`)
    if (result.errored) log(`      ${result.output.trim().split('\n').at(-1)}`)
    if (verdict === 'TIMED OUT') log(`      the test file did not finish in ${seconds(caps.get(mutant.test))} s`)
    if (!verdict.startsWith('killed')) failures++
  }
  log(`Took ${seconds(Date.now() - started)} s.`)
  log(
    isStopping()
      ? 'Interrupted; every file is restored.'
      : failures
        ? `${failures} of ${mutants.length} mutants survived, timed out, errored or did not apply.`
        : `All ${mutants.length} mutants were caught.`
  )
  return failures || isStopping() ? 1 : 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))
  process.exitCode = await runMutationCheck()
