// The home page with an image from a host the config does not list.
export default {
  title: 'Page with an outside image',
  writes: false,
  startPath: '/home?outside=1',
  async run({ page, rec }) {
    await rec.step('look', 'Look at the page', 'action', async () => {
      await page.waitForTimeout(500)
    })
  }
}
