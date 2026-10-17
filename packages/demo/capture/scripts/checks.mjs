// Checks for visible evidence. Numeric fields are parsed in full, never substring matched.
const normalized = (text) => String(text).replace(/\s+/gu, ' ').trim()
const integerValue = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Expected a non-negative safe integer')
  return value
}
export function parseInteger(text) {
  const value = normalized(text)
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(`Not an integer-only field: ${JSON.stringify(value)}`)
  return integerValue(Number(value))
}
// Explicit dollar display convention: $1,234.56 or $1234.56, two decimal places.
// Other currencies/locales must use checks.text with the exact visible string.
export function parseDollarMinor(text) {
  const value = normalized(text)
  if (!/^\$(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)\.\d{2}$/.test(value))
    throw new Error(`Not a dollar-only field: ${JSON.stringify(value)}`)
  return integerValue(Number(value.replace(/[$,.]/g, '')))
}
async function poll(read, expected, { timeoutMs = 5000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error('timeoutMs must be finite and non-negative')
  const deadline = Date.now() + timeoutMs
  let failure
  do {
    try {
      const actual = await read()
      if (actual === expected) return
      failure = new Error(`Expected exactly ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    } catch (error) { failure = error }
    if (Date.now() >= deadline) throw failure
    await new Promise((done) => setTimeout(done, Math.min(100, deadline - Date.now())))
  } while (true)
}
async function field(locator, parse) {
  const count = await locator.count()
  if (count !== 1) throw new Error(`Evidence field must match exactly one element, got ${count}`)
  if (!await locator.isVisible()) throw new Error('Evidence field must be visible')
  return parse(await locator.innerText({ timeout: 1000 }))
}
// A collection count cannot validate a number embedded in a partial text predicate.
// Use Playwright's public diagnostic string (pinned version covered by browser tests),
// not private Locator fields. This catches the common misuse, not arbitrary adapter JS.
export function assertCountScope(locator) {
  const description = String(locator)
  const literal = `(?:'[^']*(?:\\\\'[^']*)*'|"[^"]*(?:\\\\"[^"]*)*"|/[^\\n]+/[a-z]*)`
  const predicates = description.match(new RegExp(`hasText:\\s*${literal}`, 'g')) || []
  const textCalls = description.match(/getByText\([^)]*\)|getByRole\([^)]*\)|locator\([^)]*\)/g) || []
  const numeric = value => /[0-9]|\\d|\\p\{N/.test(value)
  const partial = predicates.some(numeric) || textCalls.some(call => numeric(call) && (
    (call.startsWith('getByText(') || call.includes('name:')) && !/exact:\s*true/.test(call)
    || /:(?:has-text|text)\(/.test(call)))
  if (partial) throw new Error('A DOM count with a partial numeric text selector does not verify that business number. Use checks.text on the whole message, integer/dollarMinor on a scoped field, or an exact text/role selector for collection membership.')
}
export const checks = Object.freeze({
  text: (locator, expected, options) => {
    if (typeof expected !== 'string') throw new Error('Expected text must be a string')
    return poll(() => field(locator, normalized), normalized(expected), options)
  },
  integer: (locator, expected, options) => poll(() => field(locator, parseInteger), integerValue(expected), options),
  dollarMinor: (locator, expectedMinor, options) => poll(() => field(locator, parseDollarMinor), integerValue(expectedMinor), options),
  count: (locator, expected, options) => {
    assertCountScope(locator)
    return poll(() => locator.count(), integerValue(expected), options)
  },
})
