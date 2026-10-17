// The config allows a POST to a route that answers with a 307. The browser then sends the same POST to
// /items, which no rule allows, and the guard can only report it: it was sent before the guard saw it.
import { clickAndFollowRedirect } from './lib/follow-redirect.mjs'

export default {
  title: 'Page that sends a post that is redirected',
  writes: false,
  startPath: '/home?beacon=1',
  async run({ page, rec }) {
    await rec.step('redirect', 'Send a post that is redirected', 'action', async () => {
      await clickAndFollowRedirect(page, rec, page.getByRole('button', { name: 'Send redirected post', exact: true }))
    })
    await rec.step('after', 'Nothing was sent', 'action', async () => {})
  }
}
