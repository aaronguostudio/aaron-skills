import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CaptureRefusal,
  assertLearnable,
  assertProdGoAhead,
  assertTypable,
  assertWriteGoAhead,
  parseArgs,
  parseSet,
  usageText
} from '../scripts/guards.mjs'

const refuses = (fn, pattern) => assert.throws(fn, (e) => e instanceof CaptureRefusal && pattern.test(e.message))

const dev = { name: 'dev', production: false, writeGoAhead: false, hosts: ['app.example.com'] }
const stage = { name: 'stage', production: false, writeGoAhead: true, hosts: ['stage.example.com'] }
const live = { name: 'live', production: true, writeGoAhead: true, hosts: ['example.com'] }
const reads = { writes: false }
const writes = { writes: true }

test('a run needs --env and --walk; --list, --help and sign-in need less', () => {
  refuses(() => parseArgs(['--walk', 'tour']), /--env is required and has no default/)
  refuses(() => parseArgs(['--env', 'dev']), /--walk is required/)
  refuses(() => parseArgs(['--env']), /--env needs a value/)
  refuses(() => parseArgs(['--env', '--walk', 'tour']), /--env needs a value/)
  refuses(() => parseArgs(['--fast']), /unknown argument: --fast/)
  assert.equal(parseArgs(['--list']).command, 'list')
  assert.equal(parseArgs(['--project', '/p', '--list']).project, '/p')
  assert.equal(parseArgs(['--help']).command, 'help')
  assert.equal(parseArgs(['-h']).command, 'help')
  const run = parseArgs(['--project', '/p', '--env', 'dev', '--walk', 'tour', '--out', '/o', '--headed', '--learn-hosts'])
  assert.deepEqual(
    { ...run, set: undefined },
    {
      command: 'run',
      project: '/p',
      env: 'dev',
      walk: 'tour',
      out: '/o',
      set: undefined,
      headed: true,
      learnHosts: true,
      prodGoAhead: false,
      writeGoAhead: false
    }
  )
  assert.equal(parseArgs(['--env', 'live', '--walk', 'w', '--prod-go-ahead']).prodGoAhead, true)
  assert.equal(parseArgs(['--env', 'stage', '--walk', 'w', '--write-go-ahead']).writeGoAhead, true)
})

test('sign-in is a subcommand: it needs --env and takes no --walk or --list', () => {
  const args = parseArgs(['sign-in', '--project', '/p', '--env', 'dev'])
  assert.equal(args.command, 'sign-in')
  assert.equal(args.env, 'dev')
  refuses(() => parseArgs(['sign-in', '--project', '/p']), /--env is required/)
  refuses(() => parseArgs(['sign-in', '--env', 'dev', '--walk', 'tour']), /sign-in takes no --walk/)
  refuses(() => parseArgs(['sign-in', '--list']), /sign-in does not take --list/)
  assert.equal(parseArgs(['--env', 'dev', '--walk', 'sign-in']).command, 'run')
})

test('--set takes key=value, splits at the first =, and refuses a key given twice', () => {
  assert.deepEqual(parseSet('centre=Main'), { centre: 'Main' })
  assert.deepEqual(parseSet('query=a=b'), { query: 'a=b' })
  assert.deepEqual(parseSet('note='), { note: '' })
  assert.deepEqual(parseSet('b=2', { a: '1' }), { a: '1', b: '2' })
  refuses(() => parseSet('centre'), /--set takes key=value, not "centre"/)
  refuses(() => parseSet('=Main'), /--set takes key=value/)
  refuses(() => parseSet('1st=x'), /must start with a letter/)
  refuses(() => parseSet('a b=x'), /must start with a letter/)
  refuses(() => parseSet('centre=B', { centre: 'A' }), /--set centre is given twice/)
  assert.deepEqual(parseArgs(['--env', 'dev', '--walk', 'w', '--set', 'a=1', '--set', 'b=2']).set, { a: '1', b: '2' })
  refuses(() => parseArgs(['--env', 'dev', '--walk', 'w', '--set', 'a=1', '--set', 'a=2']), /given twice/)
})

test('the usage names every flag', () => {
  for (const flag of ['--project', '--env', '--walk', '--set', '--out', '--headed', '--learn-hosts', '--prod-go-ahead', '--write-go-ahead', 'sign-in', '--list'])
    assert.ok(usageText().includes(flag), flag)
  // --help and -h have a line of their own, as every other flag does.
  assert.match(usageText(), /\n {2}--help, -h {8}print this text\n/)
})

test('a value flag given twice is refused, so the last one never quietly wins', () => {
  for (const flag of ['--project', '--env', '--walk', '--out'])
    refuses(() => parseArgs(['--env', 'dev', '--walk', 'w', flag, 'a', flag, 'b']), new RegExp(`^${flag} is given twice$`))
  refuses(() => parseArgs(['--env', 'dev', '--env', 'live', '--walk', 'w']), /--env is given twice/)
  refuses(() => parseArgs(['sign-in', '--env', 'dev', '--env', 'live']), /--env is given twice/)
  // The same value twice is still twice; --set has its own rule (a key given twice).
  refuses(() => parseArgs(['--env', 'dev', '--env', 'dev', '--walk', 'w']), /--env is given twice/)
  assert.deepEqual(parseArgs(['--env', 'dev', '--walk', 'w', '--set', 'a=1', '--set', 'b=2']).set, { a: '1', b: '2' })
})

test('production needs --prod-go-ahead on every run; other environments do not', () => {
  refuses(() => assertProdGoAhead(live, false), /live is a production environment: it needs --prod-go-ahead/)
  assert.doesNotThrow(() => assertProdGoAhead(live, true))
  assert.doesNotThrow(() => assertProdGoAhead(dev, false))
  assert.doesNotThrow(() => assertProdGoAhead(stage, false))
})

test('a write walk needs --write-go-ahead where the environment asks for one', () => {
  refuses(() => assertWriteGoAhead(stage, writes, false), /This walk writes, and stage needs a go-ahead/)
  assert.doesNotThrow(() => assertWriteGoAhead(stage, writes, true))
  assert.doesNotThrow(() => assertWriteGoAhead(stage, reads, false))
  assert.doesNotThrow(() => assertWriteGoAhead(dev, writes, false))
  // Production's own --prod-go-ahead covers its write walks.
  assert.doesNotThrow(() => assertWriteGoAhead(live, writes, false))
})

test('--learn-hosts is for read-only walks outside production', () => {
  refuses(() => assertLearnable(dev, writes), /read-only walks only/)
  refuses(() => assertLearnable(live, reads), /refused on live, a production environment/)
  assert.doesNotThrow(() => assertLearnable(dev, reads))
})

test('typing into a password field is refused, in any case', () => {
  refuses(() => assertTypable('password'), /password field is refused/)
  refuses(() => assertTypable('PASSWORD'), /password field is refused/)
  for (const type of ['text', 'search', 'email', '', undefined]) assert.doesNotThrow(() => assertTypable(type))
})

test('a CaptureRefusal is named, and carries the step it stopped, which is null when unknown', () => {
  const plain = new CaptureRefusal('Stopped.')
  assert.equal(plain.name, 'CaptureRefusal')
  assert.equal(plain.message, 'Stopped.')
  assert.equal(plain.step, null)
  assert.equal(new CaptureRefusal('Stopped.', { step: 'open' }).step, 'open')
  assert.ok(plain instanceof Error)
})
