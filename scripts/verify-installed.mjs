// Offline acceptance of an exported installation. Only the public loopback fixture
// is used; no model, real account, message delivery or voice provider is called.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const release = resolve(process.argv[2])
const config = JSON.parse(await readFile(join(release, 'installed.json'), 'utf8'))
const cli = (...args) => execFileSync(config.tools.python, [join(release, 'scripts/cli.py'), ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
process.stdout.write(cli('doctor'))
const reuse = process.argv[3] && resolve(process.argv[3])
const output = reuse ? `Report: ${join(reuse, 'smoke-report.json')}` : cli('smoke')
process.stdout.write(output)
const reportPath = output.match(/^Report: (.+)$/m)?.[1]
assert.ok(reportPath, 'smoke must report its artifact path')
const original = dirname(reportPath)
assert.equal(JSON.parse(await readFile(join(original, 'capture.json'), 'utf8')).appRevision, 'local-smoke-1', 'Acceptance uses only the public smoke fixture')
const revision = join(dirname(original), 'revision with spaces 中文')
const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
const before = await hash(join(original, 'video.webm'))
const inspected = JSON.parse(cli('inspect', original))
assert.equal(inspected.readyToRender, true)
const last = inspected.steps.at(-1)
const patch = join(original, 'patch.json')
await writeFile(patch, JSON.stringify({ steps: { [last.id]: { caption: 'Three example items are verified', focusTargets: Object.keys(last.evidence) } } }))
if (!reuse) {
  process.stdout.write(cli('revise', original, patch, '--out', revision))
  process.stdout.write(cli('render', revision, '--stills'))
}
assert.equal(before, await hash(join(original, 'video.webm')), 'original recording changed')
assert.equal(before, await hash(join(revision, 'video.webm')), 'revision must reuse the recording')
assert.equal(await hash(join(original, 'capture.json')), await hash(join(revision, 'capture.json')))
assert.equal(JSON.parse(cli('inspect', revision)).readyToRender, true)
const steps = JSON.parse(await readFile(join(revision, 'steps.json'), 'utf8'))
const message = join(revision, 'message.md')
await writeFile(message, `---\ntitle: Verified revision\nlang: en\nvideo: walkthrough.mp4 | Revised walkthrough\n---\nThe example shows three verified items.\n\n![Verified items](${steps.at(-1).shot})\n`)
process.stdout.write(cli('page', message, '--out', join(revision, 'message.html')))

process.env.PLAYWRIGHT_BROWSERS_PATH = config.playwrightBrowsers
const { chromium } = createRequire(join(release, 'packages/demo/capture/package.json'))('playwright')
const roots = { original, revision }
for (const root of Object.values(roots)) {
  execFileSync(config.tools.ffmpeg, ['-v', 'error', '-i', join(root, 'walkthrough.mp4'), '-f', 'null', '-'])
}
const server = createServer(async (request, response) => {
  try {
    const [group, ...parts] = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1).split('/')
    const root = roots[group]
    const file = root && resolve(root, ...parts)
    if (!file || !file.startsWith(root + sep)) { response.writeHead(404).end(); return }
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream')
    response.end(await readFile(file))
  } catch { response.writeHead(404).end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch()
const pages = []
try {
  const origin = `http://127.0.0.1:${server.address().port}`
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 1100 } })
  for (const [name, root] of Object.entries(roots)) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${origin}/${name}/message.html`)
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await page.locator('video').evaluate(async video => { await video.play(); video.currentTime = 0.5 })
    await page.waitForFunction(() => document.querySelector('video').currentTime > 0.5)
    await page.locator('video').evaluate(video => video.pause())
    await page.locator('#copy-text').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Text copied')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(copied, name === 'original' ? /three example items/ : /three verified items/)
    await page.locator('#copy-rich').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Text and screenshots copied')
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(item => item.types))
    assert.ok(types.includes('text/html'))
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(root, 'page-review.png'), fullPage: true })
    pages.push({ name, images: await page.locator('img').count(), clipboard: types, playback: true, errors })
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise(done => server.close(done))
}
const report = { passed: true, release, original, revision, rawRecordingHash: before, pages }
await writeFile(join(original, 'installed-acceptance.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
