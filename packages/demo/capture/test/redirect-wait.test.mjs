import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { clickAndFollowRedirect, UNOBSERVED_REDIRECT_DNS_FAILURE } from './fixture/demo-capture/walks/lib/follow-redirect.mjs'

function fixture() {
  const events = new EventEmitter()
  const waiting = []
  const page = {
    waitForEvent(event, { predicate, timeout }) {
      assert.equal(timeout, 10_000)
      waiting.push(event)
      return new Promise(resolve => events.on(event, request => { if (predicate(request)) resolve(request) }))
    }
  }
  const click = emit => ({ click: async () => {
    assert.deepEqual(waiting, ['requestfinished', 'requestfailed'])
    emit(events)
  } })
  return { page, click }
}

const request = ({ hop = true, path = '/bounce-post-localhost', error = null } = {}) => ({
  redirectedFrom: () => hop ? {} : null,
  url: () => 'http://127.0.0.1:1234' + path,
  failure: () => error ? { errorText: error } : null
})

test('redirect waits observe a finished or refused hop even before click returns', async () => {
  for (const event of ['requestfinished', 'requestfailed']) {
    const { page, click } = fixture()
    await clickAndFollowRedirect(page, click(events => events.emit(event, request())), {})
  }
})

test('a DNS refusal without a visible target request still fails the walk explicitly', async () => {
  const { page, click } = fixture()
  await assert.rejects(clickAndFollowRedirect(page, click(events => events.emit('requestfailed',
    request({ hop: false, error: 'net::ERR_NAME_NOT_RESOLVED' }))), {}),
  { message: UNOBSERVED_REDIRECT_DNS_FAILURE })
})

test('an unrelated failed request cannot complete the redirect wait', async () => {
  const { page, click } = fixture()
  await clickAndFollowRedirect(page, click(events => {
    events.emit('requestfailed', request({ hop: false, path: '/unrelated', error: 'net::ERR_NAME_NOT_RESOLVED' }))
    events.emit('requestfinished', request())
  }), {})
})
