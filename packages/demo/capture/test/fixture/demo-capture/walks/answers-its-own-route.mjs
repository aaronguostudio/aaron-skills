// A read-only walk that answers a route itself, which a walk must never do: a page.route runs before
// the engine's context.route, so its route.continue() sends the POST without the guard. The engine
// cannot stop that, but it hears that a request it never judged finished, and fails the run.
export default {
  title: 'Walk that answers its own route',
  writes: false,
  startPath: '/home',
  async run({ page, rec }) {
    await rec.step('post', 'Press Add item past the guard', 'action', async () => {
      await page.route('**/items', (route) => route.continue())
      await rec.click(page.getByRole('button', { name: 'Add item' }))
      await page.waitForTimeout(500)
    })
    await rec.step('after', 'The engine noticed', 'action', async () => {})
  }
}
