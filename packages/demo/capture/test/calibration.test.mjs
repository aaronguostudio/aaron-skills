import assert from 'node:assert/strict'
import {test} from 'node:test'
import {calibrateRecording} from '../scripts/calibration.mjs'

function fixture() {
  let onFrame
  const paints = []
  const page = {
    screencast: { async start(options) { onFrame = options.onFrame }, async stop() { onFrame = null } },
    async waitForTimeout() {},
    async evaluate(fn, bytes) {
      if (bytes) return bytes[0]
      if (String(fn).includes("document.createElement('div')")) paints.push('black')
      else if (String(fn).includes("'#fff'")) paints.push('white')
      else paints.push('removed')
    }
  }
  return {page,paints,frame: async (value) => onFrame?.({data:Buffer.from([value])})}
}

test('a delayed first recorded frame keeps the black marker until it is received', async () => {
  const f = fixture()
  const result = calibrateRecording(f.page, () => 100, {timeoutMs:1000})
  await new Promise(done => setTimeout(done, 20))
  assert.deepEqual(f.paints, ['black'])
  await f.frame(240) // app frame is not a black calibration frame
  assert.deepEqual(f.paints, ['black'])
  await f.frame(0)
  await new Promise(done => setImmediate(done))
  assert.deepEqual(f.paints, ['black','white'])
  await f.frame(245) // near-white application content is insufficient
  assert.deepEqual(f.paints, ['black','white'])
  await f.frame(255)
  assert.deepEqual(await result, {tMs:100})
  assert.deepEqual(f.paints, ['black','white','removed'])
})

test('missing recorded frames fail calibration and remove the temporary overlay', async () => {
  const f = fixture()
  await assert.rejects(calibrateRecording(f.page, () => 100, {timeoutMs:20}), /timed out.*recorded frame/)
  assert.deepEqual(f.paints, ['black','removed'])
})
