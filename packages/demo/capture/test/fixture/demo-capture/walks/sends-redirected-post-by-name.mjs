// As sends-redirected-post, but the 307 goes to another name for this machine, which the config does
// not list: the browser's own resolver refuses it unless the run is learning hosts.
export default {
  title: 'Page that sends a post that is redirected to another host',
  writes: false,
  startPath: '/home?beacon=1',
  async run({ page, rec }) {
    await rec.step('redirect', 'Send a post that is redirected', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Send redirected post by name' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was sent', 'action', async () => {})
  }
}
