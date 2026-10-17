import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateEvidence } from '../../contracts/evidence.mjs'

const fixture = JSON.parse(readFileSync(new URL('../../../../evals/fixtures/evidence-cases.json', import.meta.url)))
for (const item of fixture.cases) test(`evidence contract: ${item.id}`, () => {
  assert.equal(validateEvidence(item.step, fixture.viewport).length === 0, item.valid)
})
