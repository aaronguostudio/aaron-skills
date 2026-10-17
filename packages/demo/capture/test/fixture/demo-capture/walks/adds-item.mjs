// A walk that writes: it may POST.
export default {
  title: 'Add an item',
  description: 'Adds one item to the list',
  writes: true,
  startPath: '/home',
  async run({ page, rec }) {
    await rec.step('add', 'Press Add item', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Add item' }))
      await page.waitForTimeout(500)
    })
    await rec.step('done', 'The item is added', 'action', async () => {})
  }
}
