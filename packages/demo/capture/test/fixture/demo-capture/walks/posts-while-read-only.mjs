// A read-only walk that presses a button which POSTs: the engine must refuse it.
export default {
  title: 'Read-only walk that posts',
  writes: false,
  startPath: '/home',
  async run({ page, rec }) {
    await rec.step('add', 'Press Add item', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Add item' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'Nothing was added', 'action', async () => {})
  }
}
