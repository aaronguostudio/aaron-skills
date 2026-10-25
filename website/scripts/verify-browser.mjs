#!/usr/bin/env node
// Exercise built output locally. Viewports do not certify physical devices or OSes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../packages/demo/capture/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
await stat(path.join(root, 'index.html'));
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = ['/', '/covers', '/covers/', '/layouts', '/layouts/'].includes(pathname) ? 'index.html' : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
let checks = 0;
try {
  browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const width of [390, 768, 1440]) {
    for (const route of ['/', '/covers', '/layouts']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      // Layout/navigation acceptance needs only local files. Do not repeatedly
      // fetch the published video library or third-party links during this gate.
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      try {
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        for (const language of ['en', 'zh']) {
          await page.getByRole('button', { name: language === 'zh' ? '中文' : 'EN', exact: true }).click();
          await page.waitForFunction(lang => document.documentElement.lang === lang, language === 'zh' ? 'zh-CN' : 'en');
          assert.ok(await page.locator('main').isVisible(), `${route} main visible`);
          assert.ok(await page.getByRole('navigation', { name: language === 'zh' ? '主导航' : 'Main navigation', exact: true }).isVisible());
          assert.ok(await page.getByRole('heading', { level: 1 }).isVisible(), `${route} heading visible`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${width}px ${language}: horizontal overflow`);
          assert.deepEqual(errors, [], `${route} ${width}px ${language}: browser errors`);
          console.log(`PASS ${width}px ${route} ${language}`);
          checks++;
        }
      } finally { await page.close(); }
    }
  }
  console.log(`Local Chromium: ${checks} route/language/viewport checks passed. Physical devices, Windows and Linux require separate acceptance.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
