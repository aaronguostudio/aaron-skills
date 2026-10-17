// A visible Chromium window signs into the public synthetic fixture only.
// No customer account or credentials are used. Linux CI requires Xvfb.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startFixture, FIXTURE_LOGIN } from '../packages/demo/capture/test/fixture/server.mjs'

const release = resolve(process.argv[2])
const config = JSON.parse(await readFile(join(release, 'installed.json'), 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = config.playwrightBrowsers
const { chromium } = createRequire(join(release, 'packages/demo/capture/package.json'))('playwright')
const { signIn, waitUntilSignedIn, ensurePrivateDir } = await import(pathToFileURL(join(release, 'packages/demo/capture/scripts/session.mjs')).href)
const root = await mkdtemp(join(tmpdir(), 'aaron-synthetic-sign-in-'))
const state = join(root, 'session/state.json')
const app = await startFixture()
try {
  await ensurePrivateDir(join(root, 'session'))
  await signIn({ browserType: chromium, baseUrl: app.url, signInPath: '/login',
    isSignedOut: url => new URL(url).pathname === '/login', statePath: state,
    wait: async (page, options) => {
      await page.getByLabel('User').fill(FIXTURE_LOGIN.username)
      await page.getByLabel('Password').fill(FIXTURE_LOGIN.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await waitUntilSignedIn(page, { ...options, stableMs: 500, pollMs: 50 })
    } })
  const saved = JSON.parse(await readFile(state, 'utf8'))
  assert.ok(saved.cookies.length > 0)
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ storageState: state })
    const page = await context.newPage()
    await page.goto(app.url + '/home')
    assert.equal(new URL(page.url()).pathname, '/home')
  } finally { await browser.close() }
  console.log(JSON.stringify({ passed: true, headedSyntheticSignIn: true, savedSessionReused: true }))
} finally {
  await app.close()
  await rm(root, { recursive: true, force: true })
}
