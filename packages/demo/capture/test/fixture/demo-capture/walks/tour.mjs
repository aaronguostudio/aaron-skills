// Search, then open the details, which the app opens in a new tab (window.open): with
// sameTabLinks they open in this one. The home page has its quirks on (data:, blob:, an image its
// Content-Security-Policy blocks), none of which may fail the run.
export default {
  title: 'Fixture tour',
  description: 'Search, open the details, read them',
  writes: false,
  startPath: '/home?quirks=1',
  async run({ page, rec, params }) {
    await rec.step('search', 'Type a search', 'action', async () => {
      await rec.type(page.getByLabel('Search'), 'blue')
    })
    await rec.step('open', 'Open the details', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Open details' }))
      await page.waitForURL('**/details')
    })
    await rec.step('details', 'The details list three items', 'action', async () => {
      await page.getByRole('heading', { name: params.heading }).waitFor()
      await page.waitForTimeout(500)
    })
  }
}
