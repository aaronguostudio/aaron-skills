// The config allows a ping with a body pattern that matches the empty string. This walk posts one with
// no body at all: the browser cannot report a body for it, so the rule must not match.
export default {
  title: 'Page that sends an empty ping',
  writes: false,
  startPath: '/home?beacon=1',
  async run({ page, rec }) {
    await rec.step('ping', 'Send a ping with no body', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Send empty ping' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was sent', 'action', async () => {})
  }
}
