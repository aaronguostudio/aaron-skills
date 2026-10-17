// A read-only walk on a page that starts a shared worker. A shared worker's requests reach neither
// the route guard nor the request events, so the engine blocks shared workers in every page, and a
// page that tries fails the run, even when it catches the error.
export default {
  title: 'Page that starts a shared worker',
  writes: false,
  startPath: '/home?shared=1',
  async run({ page, rec }) {
    await rec.step('share', 'Start a shared worker', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Start shared worker' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was started', 'action', async () => {})
  }
}
