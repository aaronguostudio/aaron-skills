import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { CaptureRefusal } from '../scripts/guards.mjs'
import { Recorder } from '../scripts/recorder.mjs'

// Every run folder a test makes is removed when this file's tests are done.
const made = []
async function runFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'capture-'))
  made.push(folder)
  return folder
}
after(() => {
  for (const folder of made) rmSync(folder, { recursive: true, force: true })
})

// A page and locators that only record what the recorder asks of them, on a clock the test drives.
// `focused` is the element the page's document has the focus on (page.evaluate runs a function
// against it), and a locator's `focuses` is the element its click gives the focus to.
function harness() {
  let clock = 1000
  const events = []
  let shots = 0
  const document = { activeElement: null }
  const page = {
    async waitForTimeout(ms) {
      events.push(`wait ${ms}`)
      clock += ms
    },
    async screenshot() {
      shots++
      events.push(`screenshot@${clock}`)
      return Buffer.from(`shot-${shots}`)
    },
    async evaluate(fn) {
      globalThis.document = document
      try {
        return fn()
      } finally {
        delete globalThis.document
      }
    }
  }
  const locator = (name, box, element = { tagName: 'INPUT', type: 'text' }, focuses = element) => ({
    async scrollIntoViewIfNeeded() {},
    async boundingBox() {
      return box
    },
    async evaluate(fn) {
      return fn(element)
    },
    async click(options = {}) {
      if (options.trial) return events.push(`trial ${name}@${clock}`)
      events.push(`click ${name}@${clock}`)
      document.activeElement = focuses
      clock += 100
    },
    async pressSequentially(text) {
      events.push(`type ${text}`)
    }
  })
  return { page, locator, events, tick: (ms) => (clock += ms), now: () => clock }
}

test('steps record times from the first frame, clicks with their box, and a shot before the first click', async () => {
  const h = harness()
  const runDir = await runFolder()
  const rec = new Recorder({ page: h.page, runDir, now: h.now, minClickGapMs: 0 })
  rec.start()
  h.tick(500)
  await rec.step('open', 'Open the form', 'action', async () => {
    h.tick(200)
    await rec.click(h.locator('open', { x: 10.4, y: 20.6, width: 100, height: 40 }))
  })
  await rec.step('saving', 'Wait while it saves', 'wait', async () => h.tick(3000))
  const capture = await rec.finish({ walk: 'w', env: 'dev', title: 'T', viewport: { w: 1440, h: 900 } })

  assert.equal(capture.version, 1)
  assert.equal(capture.status, 'passed')
  const steps = JSON.parse(await readFile(join(runDir, 'steps.json'), 'utf8'))
  assert.deepEqual(steps[0], {
    id: 'open',
    caption: 'Open the form',
    kind: 'action',
    startMs: 500,
    endMs: 800,
    clicks: [{ tMs: 700, x: 60, y: 41, box: { x: 10, y: 21, w: 100, h: 40 } }],
    shot: 'shots/01-open.png'
  })
  assert.equal(steps[1].startMs, 800)
  assert.equal(steps[1].endMs, 3800)
  assert.equal(steps[1].shot, 'shots/02-saving.png')
  // The kept shot is the pre-click one (the second screenshot), not the one taken at step start.
  assert.equal(await readFile(join(runDir, 'shots/01-open.png'), 'utf8'), 'shot-2')
  assert.deepEqual(h.events.slice(0, 4), ['screenshot@1500', 'trial open@1700', 'screenshot@1700', 'click open@1700'])
  assert.deepEqual((await readdir(join(runDir, 'shots'))).sort(), ['01-open.png', '02-saving.png'])
})

test('a guard runs before every step and can stop the walk', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  rec.start()
  const seen = []
  rec.onBeforeStep(async (id) => {
    seen.push(id)
    if (id === 'two') throw new Error('guard says no')
  })
  await rec.step('one', 'One', 'action', async () => {})
  await assert.rejects(rec.step('two', 'Two', 'action', async () => {}), /guard says no/)
  assert.deepEqual(seen, ['one', 'two'])
  assert.equal(rec.steps.length, 1)
  assert.equal(rec.attempting, 'two')
})

test('a failed walk records where and why, and a step that throws still closes', async () => {
  const h = harness()
  const runDir = await runFolder()
  const rec = new Recorder({ page: h.page, runDir, now: h.now })
  rec.start()
  await assert.rejects(
    rec.step('upload', 'Upload the file', 'action', async () => {
      h.tick(50)
      throw new Error('upload button missing')
    })
  )
  assert.equal(rec.steps[0].endMs, 50)
  const capture = await rec.finish(
    { walk: 'w', env: 'dev', title: 'T', viewport: { w: 1440, h: 900 } },
    { status: 'failed', failedStep: 'upload', failure: 'upload button missing' }
  )
  assert.equal(capture.failedStep, 'upload')
  assert.equal(JSON.parse(await readFile(join(runDir, 'capture.json'), 'utf8')).status, 'failed')
})

test('click and kind are refused outside the contract', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  assert.throws(() => rec.ms(), /start\(\) must run/)
  rec.start()
  await assert.rejects(rec.click(h.locator('x', { x: 0, y: 0, width: 1, height: 1 })), /outside a step/)
  await assert.rejects(rec.step('s', 'S', 'pause', async () => {}), /kind must be action or wait/)
})

test('clicks are paced so the drawn cursor has time to travel', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  rec.start()
  const box = { x: 0, y: 0, width: 10, height: 10 }
  await rec.step('two', 'Two clicks', 'action', async () => {
    await rec.click(h.locator('a', box))
    await rec.click(h.locator('b', box))
  })
  const [first, second] = rec.steps[0].clicks
  assert.ok(second.tMs - first.tMs >= 700, `clicks ${second.tMs - first.tMs} ms apart`)
})

test('a step id is used once per walk', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  rec.start()
  await rec.step('open', 'Open', 'action', async () => {})
  await assert.rejects(rec.step('open', 'Open again', 'action', async () => {}), /step open: step ids must be unique/)
  assert.equal(rec.steps.length, 1)
})

test('type clicks the field, then types at a readable pace', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now, minClickGapMs: 0 })
  rec.start()
  await rec.step('search', 'Search', 'action', async () => {
    await rec.type(h.locator('q', { x: 0, y: 0, width: 200, height: 30 }), 'blue')
  })
  assert.deepEqual(h.events.filter((e) => !e.startsWith('screenshot')), ['trial q@1000', 'click q@1000', 'type blue'])
  assert.equal(rec.steps[0].clicks.length, 1)
})

test('type refuses a password field, and works only inside a step', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  rec.start()
  const password = h.locator('pw', { x: 0, y: 0, width: 200, height: 30 }, { tagName: 'INPUT', type: 'password' })
  await assert.rejects(rec.type(password, 'x'), /outside a step/)
  await assert.rejects(
    rec.step('sign-in', 'Sign in', 'action', async () => rec.type(password, 'secret')),
    (error) => error instanceof CaptureRefusal && /password field is refused/.test(error.message)
  )
  assert.equal(h.events.some((e) => /^(trial|click|type) /.test(e)), false)
})

test('a step inside a step is refused before its id is used, and the outer step goes on', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now })
  rec.start()
  await rec.step('outer', 'Outer', 'action', async () => {
    await assert.rejects(
      rec.step('inner', 'Inner', 'action', async () => {}),
      (e) => e.message === 'step inner: steps cannot be nested'
    )
  })
  // A step started while another has not finished is nested too, however it was called.
  const first = rec.step('first', 'First', 'action', async () => h.tick(10))
  await assert.rejects(rec.step('second', 'Second', 'action', async () => {}), /step second: steps cannot be nested/)
  await first
  // Neither refused id was used up.
  await rec.step('inner', 'Inner', 'action', async () => {})
  await rec.step('second', 'Second', 'action', async () => {})
  assert.deepEqual(rec.steps.map((step) => step.id), ['outer', 'first', 'inner', 'second'])
})

test('a step id is letters, digits, - and _ only, because it becomes part of a file name', async () => {
  const h = harness()
  const runDir = await runFolder()
  const rec = new Recorder({ page: h.page, runDir, now: h.now })
  rec.start()
  for (const id of ['../escape', 'a/b', 'a\\b', 'a b', '', 'shot.png', 'café', 'a\nb', 5, undefined, null])
    await assert.rejects(
      rec.step(id, 'Caption', 'action', async () => {}),
      (e) => e.message === `step ${JSON.stringify(id)}: a step id is letters, digits, - and _ only`,
      String(id)
    )
  assert.deepEqual(rec.steps, [])
  assert.deepEqual(h.events, [], 'no screenshot was taken for a refused step')
  for (const id of ['sign-in', 'step_2', 'A1', '-']) await rec.step(id, 'Caption', 'action', async () => {})
  assert.deepEqual((await readdir(join(runDir, 'shots'))).sort(), ['01-sign-in.png', '02-step_2.png', '03-A1.png', '04--.png'])
})

test('type refuses to type when its click put the focus on a password field the locator does not name', async () => {
  const h = harness()
  const rec = new Recorder({ page: h.page, runDir: await runFolder(), now: h.now, minClickGapMs: 0 })
  rec.start()
  const password = { tagName: 'INPUT', type: 'password' }
  // getByText('Password') finds the label; clicking it focuses its password input.
  const label = h.locator('label', { x: 0, y: 0, width: 80, height: 20 }, { tagName: 'LABEL' }, password)
  await assert.rejects(
    rec.step('sign-in', 'Sign in', 'action', async () => rec.type(label, 'secret')),
    (error) => error instanceof CaptureRefusal && /password field is refused/.test(error.message)
  )
  // A field inside a component's shadow root is found too.
  const component = { tagName: 'MY-FIELD', shadowRoot: { activeElement: { tagName: 'DIV', shadowRoot: { activeElement: password } } } }
  const wrapper = h.locator('wrapper', { x: 0, y: 0, width: 80, height: 20 }, { tagName: 'MY-FIELD' }, component)
  await assert.rejects(
    rec.step('sign-in-again', 'Sign in', 'action', async () => rec.type(wrapper, 'secret')),
    (error) => error instanceof CaptureRefusal && /password field is refused/.test(error.message)
  )
  assert.equal(h.events.some((e) => e.startsWith('type ')), false)
  // A label whose click focuses a text field is typed into.
  const search = h.locator('search label', { x: 0, y: 0, width: 80, height: 20 }, { tagName: 'LABEL' }, { tagName: 'INPUT', type: 'search' })
  await rec.step('search', 'Search', 'action', async () => rec.type(search, 'blue'))
  assert.equal(h.events.at(-1), 'type blue')
})
