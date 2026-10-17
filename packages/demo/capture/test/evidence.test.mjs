import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Recorder } from '../scripts/recorder.mjs'

function locator(value, boxes, visible = true) {
  return { count: async () => boxes.length, innerText: async () => value, isVisible: async () => visible,
    nth: i => ({ isVisible: async () => visible, boundingBox: async () => boxes[i] }) }
}
const rect = (x, width = 235) => ({ x, y: 220, width, height: 94 })
async function recording(fn) {
  const runDir = await mkdtemp(join(tmpdir(), 'demo-evidence-'))
  let clock = 0, shots = 0
  const page = { viewportSize: () => ({ width: 1440, height: 900 }), screenshot: async () => Buffer.from(`shot-${++shots}`),
    waitForTimeout: async ms => { clock += ms } }
  const rec = new Recorder({ page, runDir, now: () => clock }); rec.start()
  try { await fn(rec, runDir) } finally { await rm(runDir, { recursive: true, force: true }) }
}
test('one declaration verifies every metric, groups all cards without right-hand blank space and saves immutable target geometry', async () => {
  await recording(async (rec, runDir) => {
    await rec.step('summary', 'Two invoices, $2,000.00, approved', 'action', async () => {
      await rec.show({
        count: { at: locator('2', [rect(48)]), integer: 2 },
        total: { at: locator('$2,000.00', [rect(303)]), dollarMinor: 200000 },
        status: { at: locator('Approved', [rect(558)]), text: 'Approved' },
      })
    })
    await rec.finish({ viewport: { w: 1440, h: 900 } })
    const step = JSON.parse(await readFile(join(runDir, 'steps.json')))[0]
    assert.deepEqual(step.focus[0].box, { x: 48, y: 220, w: 745, h: 94 })
    assert.deepEqual(Object.keys(step.targets), ['count', 'total', 'status'])
    assert.deepEqual(step.evidence.total, { kind: 'dollarMinor', expected: 200000 })
    assert.equal(step.focus[0].toMs, 900)
    assert.equal(await readFile(join(runDir, step.shot), 'utf8'), 'shot-2', 'kept shot is the checked result, not the step-start screenshot')
  })
})
test('a multi-match target covers every card and hidden/offscreen/empty targets are refused', async () => {
  await recording(async rec => {
    await rec.step('all', 'Show summary cards', 'action', () => rec.focus({ cards: locator('', [rect(48), rect(303), rect(558)]) }))
    assert.equal(rec.steps[0].focus[0].box.w, 745)
    for (const [id, target] of Object.entries({ hidden: locator('', [rect(48)], false), missing: locator('', []), offscreen: locator('', [rect(1300)]) })) {
      await assert.rejects(rec.step(id, 'Show target', 'action', () => rec.focus({ target })), /visible|no elements|viewport/)
    }
  })
})
test('show refuses malformed declarations and a highlight unrelated to its checked field', async () => {
  await recording(async rec => {
    await assert.rejects(rec.show({}), /outside a step/)
    for (const [id, spec] of Object.entries({ unchecked: { at: locator('2', [rect(48)]) }, ambiguous: { at: locator('2', [rect(48)]), text: '2', integer: 2 } })) {
      await assert.rejects(rec.step(id, 'Show count', 'action', () => rec.show({ count: spec })), /exactly one/)
    }
    await assert.rejects(rec.step('unrelated', 'Show count', 'action', () => rec.show({ count: { at: locator('2', [rect(48)]), integer: 2, target: locator('', [rect(303)]) } })), /outside its highlight/)
  })
})
test('valid target names are preserved even when they match JavaScript prototype keys', async () => {
  await recording(async (rec, runDir) => {
    await rec.step('named', 'Two invoices', 'action', () => rec.show(Object.fromEntries([
      ['__proto__', {at: locator('2', [rect(48)]), integer: 2}],
      ['constructor', {at: locator('$2,000.00', [rect(303)]), dollarMinor: 200000}],
    ])))
    await rec.finish({viewport:{w:1440,h:900}})
    const step=JSON.parse(await readFile(join(runDir,'steps.json')))[0]
    assert.deepEqual(Object.keys(step.targets),['__proto__','constructor'])
    assert.equal(step.focus[0].box.w,490)
  })
})
