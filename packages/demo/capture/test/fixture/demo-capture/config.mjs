// The adapter for the fixture app that test/capture.e2e.mjs serves on 127.0.0.1. Test data only;
// `stage` and `live` exist for the refusal tests and are never reached.
const url = process.env.DEMO_CAPTURE_FIXTURE_URL ?? 'http://127.0.0.1:9'

export default {
  contract: 1,
  name: 'fixture-app',
  environments: {
    local: { url, production: false, hosts: ['127.0.0.1'] },
    stage: { url: 'https://stage.example.com', production: false, hosts: ['stage.example.com'], writeGoAhead: true },
    live: { url: 'https://app.example.com', production: true, hosts: ['app.example.com'] }
  },
  signInPath: '/login',
  isSignedOut: (pageUrl) => new URL(pageUrl).pathname.startsWith('/login'),
  params: { heading: { default: 'Details', describe: 'the heading the tour expects after opening the details' } },
  readOnlyForbidden: [{ method: 'GET', url: /\/items\?mode=recount/ }],
  // An allowed rule matches the whole URL and the whole body. The beacon is allowed with the body the
  // home page sends. The ping rule is deliberately loose (its body pattern matches the empty string):
  // the engine must still refuse a ping with no body.
  readOnlyAllowed: [
    { method: 'POST', url: /http:\/\/127\.0\.0\.1:\d+\/beacon/, body: /\{"page":"[a-z]+"\}/ },
    { method: 'POST', url: /http:\/\/127\.0\.0\.1:\d+\/ping/, body: /^$/ },
    // These two answer with a 307, so the browser sends the same POST on to /items. One endpoint per rule.
    { method: 'POST', url: /http:\/\/127\.0\.0\.1:\d+\/bounce-post/, body: /\{"page":"[a-z]+"\}/ },
    { method: 'POST', url: /http:\/\/127\.0\.0\.1:\d+\/bounce-post-localhost/, body: /\{"page":"[a-z]+"\}/ }
  ],
  sameTabLinks: true,
  setup: async ({ page }) => {
    await page.getByRole('heading', { name: 'Home' }).waitFor()
  },
  beforeStep: async ({ page }) => {
    if (!page.url().startsWith(url)) throw new Error('The page left the fixture app.')
  },
  revision: async () => 'fixture-1'
}
