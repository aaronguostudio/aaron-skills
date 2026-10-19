// Public, app-neutral evidence/focus helpers. No navigation, clicks or business writes.
import { checks } from './checks.mjs'

const NAME = /^[A-Za-z0-9_-]+$/
export function entries(targets) {
  if (!targets || Array.isArray(targets) || typeof targets !== 'object' || !Object.keys(targets).length)
    throw new Error('Evidence targets must be a nonempty object keyed by target name')
  const result = Object.entries(targets)
  if (result.some(([name]) => !NAME.test(name))) throw new Error('Target names use letters, digits, - and _ only')
  return result
}
export async function boxesFor(locator, viewport, name = 'target') {
  if (!locator || typeof locator.count !== 'function') throw new Error('Each focus target must be a Playwright locator')
  const count = await locator.count()
  if (!count) throw new Error(`Focus target "${name}" matched no elements`)
  const boxes = []
  // A multi-match locator means ALL its elements, not the first matching card.
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i)
    const context = `Focus target "${name}" matched ${count} element(s); element ${i + 1}`
    if (!await item.isVisible()) throw new Error(`${context} is hidden. Every focus target must be visible; scope the locator to the intended group`)
    const b = await item.boundingBox()
    if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)
      || b.width <= 0 || b.height <= 0 || b.x < 0 || b.y < 0
      || b.x + b.width > viewport.width || b.y + b.height > viewport.height)
      throw new Error(`${context} has box ${JSON.stringify(b)} outside viewport ${viewport.width}x${viewport.height}. Every focus target must fit entirely inside the viewport; scope duplicate links/controls or reveal the intended group first`)
    boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height })
  }
  return boxes
}
export function union(boxes) {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y))
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y }
}
export async function verifyEvidence(evidence) {
  const targets = Object.create(null), assertions = Object.create(null)
  // Validate the entire declaration before running any checks.
  for (const [name, spec] of entries(evidence)) {
    if (!spec || Array.isArray(spec) || typeof spec !== 'object') throw new Error(`Invalid evidence ${name}`)
    const kinds = Object.keys(spec).filter(k => Object.hasOwn(checks, k))
    if (kinds.length !== 1 || Object.keys(spec).some(k => !['at', 'target', ...kinds].includes(k)) || !spec.at)
      throw new Error(`Evidence ${name} needs at, exactly one of text/integer/dollarMinor/count, and optional target`)
    const kind = kinds[0]
    targets[name] = spec.target || spec.at
    assertions[name] = { kind, expected: spec[kind] }
  }
  for (const [name, spec] of entries(evidence)) await checks[assertions[name].kind](spec.at, assertions[name].expected)
  return { targets, assertions }
}
