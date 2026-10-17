// The same, with the redirect aimed at [::1]: an IP literal, which is also not a listed host.
import { clickAndFollowRedirect } from './lib/follow-redirect.mjs'

export default {
  title: 'Link that redirects to an unlisted IP literal',
  writes: false,
  startPath: '/home',
  async run({ page, rec }) {
    await rec.step('leave', 'Follow the IPv6 partner link', 'action', async () => {
      await clickAndFollowRedirect(page, rec, page.getByRole('link', { name: 'Visit partner by IPv6', exact: true }))
    })
  }
}
