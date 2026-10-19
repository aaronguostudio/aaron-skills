// The recorder: it writes a capture folder, contract version 1
// (../../../../docs/capture-contract.md):
//
//   <run>/capture.json   version, then the manifest cli.mjs builds (walk, env, title, subtitle when
//                        the walk has a description, appRevision, startedAt, viewport, sync: the
//                        black-to-white flash), then status, and failedStep and failure when it failed
//   <run>/video.webm     the Playwright recording, exactly viewport-sized (saved by cli.mjs)
//   <run>/steps.json     ordered steps: caption, kind, times, clicks (centre + box), shot
//   <run>/shots/NN-<id>.png
//
// Times are ms from the video's first frame: start() is called right after context.newPage(),
// where Playwright starts recording. Playwright videos show no cursor, so every click is logged
// (with the clicked element's box) for the renderer to draw one. A step's shot is taken just
// before its first click, so the element to click is on it; a step with no clicks keeps the shot
// taken when it started. `wait` steps mark server work that the renderer fast-forwards.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertTypable } from './guards.mjs'
import { boxesFor, entries, union, verifyEvidence } from './evidence.mjs'

export const CONTRACT_VERSION = 1
// Even sizes, as H.264 needs. 1440 keeps desktop layouts out of their collapsed breakpoints.
export const VIEWPORT = Object.freeze({ width: 1440, height: 900 })

const round = (n) => Math.round(n)

// A step id becomes part of a file name (shots/NN-<id>.png), so it is a plain word.
const STEP_ID = /^[A-Za-z0-9_-]+$/

// The type of the field that has the focus ('' when it is not an input), looked for inside shadow
// roots too. Runs in the page.
function focusedFieldType() {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element?.tagName === 'INPUT' ? String(element.type) : ''
}

export class Recorder {
  // minClickGapMs paces the clicks, so the cursor drawn later has time to travel between them.
  constructor({ page, runDir, now = () => performance.now(), minClickGapMs = 700 }) {
    this.page = page
    this.minClickGapMs = minClickGapMs
    this.lastClickMs = -Infinity
    this.runDir = runDir
    this.now = now
    this.t0 = undefined
    this.steps = []
    this.ids = new Set()
    this.current = null
    this.inStep = false
    this.attempting = null
    this.beforeStep = async () => {}
  }

  start() {
    this.t0 = this.now()
  }

  ms() {
    if (this.t0 === undefined)
      throw new Error('Recorder.start() must run right after context.newPage()')
    return round(this.now() - this.t0)
  }

  // Runs fn as one step. A guard set with onBeforeStep runs first, so every step re-checks it. One
  // step runs at a time: a step started inside another, or before another has finished, is refused
  // before its id is used.
  async step(id, caption, kind, fn) {
    if (typeof id !== 'string' || !STEP_ID.test(id))
      throw new Error(`step ${JSON.stringify(id)}: a step id is letters, digits, - and _ only`)
    if (kind !== 'action' && kind !== 'wait')
      throw new Error(`step ${id}: kind must be action or wait`)
    if (this.inStep) throw new Error(`step ${id}: steps cannot be nested`)
    if (this.ids.has(id)) throw new Error(`step ${id}: step ids must be unique within a walk`)
    this.ids.add(id)
    this.inStep = true
    try {
      // Named before the guard runs, so a refusal is reported against the step it stopped.
      this.attempting = id
      await this.beforeStep(id)
      const index = this.steps.length + 1
      const step = { id, caption, kind, startMs: this.ms(), endMs: 0, clicks: [], shot: null }
      this.steps.push(step)
      this.current = step
      const shotPath = `shots/${String(index).padStart(2, '0')}-${id}.png`
      // Taken now and kept in memory; replaced by the pre-click shot if the step clicks anything.
      this.pending = { path: shotPath, buffer: await this.page.screenshot() }
      try {
        return await fn(this)
      } finally {
        step.endMs = Math.max(step.startMs, this.ms())
        if (!step.shot) await this.writeShot(this.pending.path, this.pending.buffer)
        this.current = null
      }
    } finally {
      this.inStep = false
    }
  }

  onBeforeStep(fn) {
    this.beforeStep = fn
  }

  async settledTargets(targets, timeoutMs = 5000) {
    const viewport = this.page.viewportSize()
    if (!viewport) throw new Error('Focus needs a fixed viewport')
    const started = this.ms()
    let previous, stableSince = started
    while (this.ms() - started <= timeoutMs) {
      const measured = Object.create(null)
      for (const [name, locator] of entries(targets)) measured[name] = await boxesFor(locator, viewport, name)
      const current = JSON.stringify(measured)
      if (current !== previous) stableSince = this.ms()
      // The renderer holds 180ms before a click. Keep that frame after the last
      // layout/scroll movement, with room for a recorded frame at 30fps.
      if (current === previous && this.ms() - stableSince >= 250) return measured
      previous = current
      await this.page.waitForTimeout(50)
    }
    throw new Error(`Targets ${Object.keys(targets).join(', ')} did not settle within ${timeoutMs}ms`)
  }

  // Reveal one control, including inside an app's own scroll container. Already
  // visible sticky controls stay put; scrolling them can move the whole page.
  async prepareControl(locator) {
    if (!this.current) throw new Error('reveal() outside a step')
    const count = await locator.count()
    if (count > 1) throw new Error(`reveal/click needs exactly one element; locator matched ${count}. Scope it to the intended control`)
    await locator.waitFor({ state: 'visible', timeout: 5000 })
    // Playwright checks intersection, including clipping by ancestor containers,
    // and skips scrolling a fully visible element. A viewport box alone cannot
    // tell whether the app's own scroller clips this target.
    await locator.scrollIntoViewIfNeeded({ timeout: 5000 })
  }

  async reveal(locator) {
    await this.prepareControl(locator)
    return (await this.settledTargets({ control: locator })).control[0]
  }

  // One settled, named target group per result step. Captured geometry is reusable offline.
  async focus(targets, { holdMs = 900 } = {}) {
    if (!this.current) throw new Error('focus() outside a step')
    if (this.current.clicks.length || this.current.targets) throw new Error('Use one focus/show group in a separate step without clicks')
    if (!Number.isFinite(holdMs) || holdMs < 1 || holdMs > 10000) throw new Error('holdMs must be between 1 and 10000')
    const measured = await this.settledTargets(targets)
    const fromMs = this.ms()
    this.pending.buffer = await this.page.screenshot()
    await this.page.waitForTimeout(holdMs)
    const toMs = this.ms()
    this.current.targets = Object.fromEntries(Object.entries(measured).map(([name, boxes]) => [name, { boxes, fromMs, toMs }]))
    this.current.focus = [{ box: union(Object.values(measured).flat()), fromMs, toMs }]
  }

  // Assertions and highlighted fields share one declaration, so checked cards are not omitted.
  async show(evidence, options) {
    if (!this.current) throw new Error('show() outside a step')
    if (this.current.clicks.length || this.current.targets) throw new Error('Use one focus/show group in a separate step without clicks')
    const { targets, assertions } = await verifyEvidence(evidence)
    await this.focus(targets, options)
    await verifyEvidence(evidence) // A delayed UI update must not turn a held claim false.
    const viewport = this.page.viewportSize()
    for (const [name, spec] of entries(evidence)) {
      if (assertions[name].kind === 'count' && assertions[name].expected === 0) continue
      for (const field of await boxesFor(spec.at, viewport)) {
        if (!this.current.targets[name].boxes.some(b => b.x <= field.x && b.y <= field.y
          && b.x + b.w >= field.x + field.w && b.y + b.h >= field.y + field.h))
          throw new Error(`Evidence ${name} is outside its highlight target; use the field or a containing card`)
      }
    }
    this.current.evidence = assertions
  }

  async writeShot(path, buffer) {
    await mkdir(join(this.runDir, 'shots'), { recursive: true })
    await writeFile(join(this.runDir, path), buffer)
    this.current.shot = path
  }

  // Click a locator, logging where it is first. Works only inside step().
  async click(locator, options = {}) {
    if (!this.current) throw new Error('click() outside a step')
    const gap = this.ms() - this.lastClickMs
    if (gap < this.minClickGapMs) await this.page.waitForTimeout(this.minClickGapMs - gap)
    await this.prepareControl(locator)
    // A trial click waits until the element can take the click (not covered by a toast or an
    // overlay) without clicking, so the shot and the logged box show it as the reader will.
    await locator.click({ ...options, trial: true })
    // A trial can itself scroll if the layout changed. Measure again only after
    // that movement has settled, then save the box and pre-click screenshot.
    const box = (await this.settledTargets({ control: locator })).control[0]
    if (!this.current.shot) await this.writeShot(this.pending.path, await this.page.screenshot())
    this.lastClickMs = this.ms()
    this.current.clicks.push({
      tMs: this.lastClickMs,
      x: round(box.x + box.w / 2),
      y: round(box.y + box.h / 2),
      box: { x: round(box.x), y: round(box.y), w: round(box.w), h: round(box.h) }
    })
    await locator.click(options)
  }

  // Click a field, then type into it at a pace a viewer can follow. Never a password field:
  // sign-in is always done by a person. The field is checked before the click, and the field that
  // has the focus after it, because the click can focus a field the locator does not name: a
  // label's, or one inside a component.
  async type(locator, text) {
    if (!this.current) throw new Error('type() outside a step')
    assertTypable(await locator.evaluate((el) => (el.tagName === 'INPUT' ? String(el.type) : '')))
    await this.click(locator)
    assertTypable(await this.page.evaluate(focusedFieldType))
    await locator.pressSequentially(text, { delay: 35 })
  }

  async finish(manifest, { status, failedStep, failure } = { status: 'passed' }) {
    const capture = {
      version: CONTRACT_VERSION,
      ...manifest,
      status,
      ...(status === 'failed'
        ? { failedStep: failedStep ?? null, failure: failure ?? 'The walk stopped.' }
        : {})
    }
    await mkdir(this.runDir, { recursive: true })
    await writeFile(join(this.runDir, 'capture.json'), JSON.stringify(capture, null, 2) + '\n')
    await writeFile(join(this.runDir, 'steps.json'), JSON.stringify(this.steps, null, 2) + '\n')
    return capture
  }
}
