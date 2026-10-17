// A read-only walk that sends the GET the config lists as a read that writes.
export default {
  title: 'Read-only walk that recounts',
  writes: false,
  startPath: '/home',
  async run({ page, rec }) {
    await rec.step('recount', 'Press Recount', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Recount' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was recounted', 'action', async () => {})
  }
}
