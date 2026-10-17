// The home page posts an allowed beacon on load; the walk then posts one the config does not allow.
export default {
  title: 'Page that sends beacons',
  writes: false,
  startPath: '/home?beacon=1',
  async run({ page, rec }) {
    await rec.step('odd', 'Send a beacon the config does not allow', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Send odd beacon' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was sent', 'action', async () => {})
  }
}
