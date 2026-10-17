// Contract-1 evidence semantics. The final renderer validates these independently
// of its Python launcher; saved receipts describe checks, not a signed attestation.
const finite = value => typeof value === 'number' && Number.isFinite(value)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value, expected) => object(value) && Object.keys(value).sort().join(',') === [...expected].sort().join(',')
const kinds = new Set(['text', 'integer', 'dollarMinor', 'count'])

function rectangle(value, viewport) {
  const box = Array.isArray(value) && value.length === 4
    ? Object.fromEntries(['x', 'y', 'w', 'h'].map((key, i) => [key, value[i]])) : value
  if (!keys(box, ['x', 'y', 'w', 'h']) || !Object.values(box).every(finite)) return null
  return box.x >= 0 && box.y >= 0 && box.w > 0 && box.h > 0
    && box.x + box.w <= viewport.w && box.y + box.h <= viewport.h ? box : null
}

export function validateEvidence(step, viewport) {
  if (step.evidence === undefined || step.evidence === null) return [] // Legacy contract 1.
  const errors = []
  const fail = message => errors.push(`Step ${step.id}: ${message}`)
  if (!object(step.evidence) || !Object.keys(step.evidence).length) {
    fail('evidence declaration must be a nonempty object'); return errors
  }
  if (!object(step.targets) || !Array.isArray(step.focus)) {
    fail('checked evidence needs saved targets and a focus list'); return errors
  }
  const interval = value => finite(value.fromMs) && finite(value.toMs)
    && step.startMs <= value.fromMs && value.fromMs <= value.toMs && value.toMs <= step.endMs
  for (const focus of step.focus) {
    if (!keys(focus, ['box', 'fromMs', 'toMs']) || !interval(focus) || !rectangle(focus.box, viewport))
      fail('invalid evidence focus geometry or interval')
  }
  for (const [name, receipt] of Object.entries(step.evidence)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name) || !keys(receipt, ['kind', 'expected']) || !kinds.has(receipt.kind)
      || (receipt.kind === 'text' ? typeof receipt.expected !== 'string'
        : !Number.isSafeInteger(receipt.expected) || receipt.expected < 0)) {
      fail('invalid evidence receipt'); continue
    }
    const target = Object.hasOwn(step.targets, name) ? step.targets[name] : null
    if (!keys(target, ['boxes', 'fromMs', 'toMs']) || !interval(target)
      || !Array.isArray(target.boxes) || !target.boxes.length) {
      fail(`invalid saved target ${name}`); continue
    }
    for (const value of target.boxes) {
      const r = rectangle(value, viewport)
      if (!r) { fail(`invalid box for target ${name}`); continue }
      if (!step.focus.some(focus => {
        const b = object(focus) ? rectangle(focus.box, viewport) : null
        return b && focus.fromMs <= target.fromMs && focus.toMs >= target.toMs
          && b.x <= r.x + 1e-6 && b.y <= r.y + 1e-6
          && b.x + b.w + 1e-6 >= r.x + r.w && b.y + b.h + 1e-6 >= r.y + r.h
      })) fail(`highlight omits checked evidence target ${name}; revise saved focus, no recapture needed`)
    }
  }
  return errors
}
