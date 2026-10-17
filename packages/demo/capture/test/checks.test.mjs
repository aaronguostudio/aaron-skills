import test from 'node:test'
import assert from 'node:assert/strict'
import { checks, parseInteger, parseDollarMinor } from '../scripts/checks.mjs'
const field = (value, count = 1, visible = true) => ({ count: async () => count, isVisible: async () => visible, innerText: async () => value })
const immediate = { timeoutMs: 0 }
test('count and exact text reject 12 for 2, including combined amount text', async () => {
  await assert.rejects(checks.integer(field('12'), 2, immediate), /Expected exactly 2, got 12/)
  await assert.rejects(checks.text(field('12 invoices selected $2,000.00'), '2 invoices selected $2,000.00', immediate))
  await assert.rejects(checks.count(field('', 12), 2, immediate))
  await checks.integer(field('2'), 2, immediate)
  await checks.text(field('2 invoices selected\n $2,000.00'), '2 invoices selected $2,000.00', immediate)
  await checks.count(field('', 2), 2, immediate)
})
test('numbers must occupy the whole scoped field, and amounts use exact minor units', async () => {
  for (const value of ['2 invoices', '2 $2,000.00', '2.0', '12x', '02', '-2', 'NaN', '9007199254740992']) assert.throws(() => parseInteger(value))
  assert.equal(parseDollarMinor('$2,000.01'), 200001)
  for (const value of ['$2,00.00', '$2,000', 'CAD 2,000.00', '$2,000.00 pending', '$02.00', '$2.001']) assert.throws(() => parseDollarMinor(value))
  await checks.dollarMinor(field('$2,000.00'), 200000, immediate)
  await assert.rejects(checks.dollarMinor(field('$12,000.00'), 200000, immediate))
  await assert.rejects(checks.dollarMinor(field('$2,000.01'), 200000, immediate))
})
test('one visible field required; asynchronous settled values may retry', async () => {
  await assert.rejects(checks.text(field('2', 2), '2', immediate), /exactly one/)
  await assert.rejects(checks.text(field('2', 1, false), '2', immediate), /visible/)
  let calls = 0
  await checks.integer({ ...field(''), innerText: async () => ++calls === 1 ? 'Loading' : '2' }, 2, { timeoutMs: 1000 })
  assert.equal(calls, 2)
})
test('DOM counts refuse numeric partial-text membership instead of claiming the message number is verified', async () => {
  for (const description of [
    "getByRole('status').filter({ hasText: '2 invoices approved' }).filter({ hasText: '$2,000.00' })",
    "getByText('2 invoices approved')", "getByRole('status', { name: '2 invoices' })",
    "getByRole('row').filter({ hasText: /2 invoices/ })", 'locator(\'div:has-text("2")\')',
  ]) {
    let reads = 0
    const locator = { toString: () => description, count: async () => { reads++; return 1 } }
    await assert.rejects(async () => checks.count(locator, 1, immediate), /partial numeric text/)
    assert.equal(reads, 0)
  }
  for (const description of ["locator('tbody tr')", "getByText('INV-2041', { exact: true })",
    "getByRole('row').filter({ has: getByText('INV-2041', { exact: true }) })"]) {
    await checks.count({ ...field('', 1), toString: () => description }, 1, immediate)
  }
})
