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
    const relative = ['/', '/covers', '/covers/', '/layouts', '/layouts/', '/releases', '/releases/', '/presentation', '/presentation/'].includes(pathname) ? 'index.html' : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    const contentType=mime[path.extname(file)] || 'application/octet-stream';
    const range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),body.length-1):body.length-1;response.writeHead(206,{'Content-Type':contentType,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`,'Content-Length':end-start+1}).end(body.subarray(start,end+1));}
    else response.writeHead(200, { 'Content-Type':contentType,'Content-Length':body.length,'Accept-Ranges':'bytes' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
let checks = 0;
try {
  browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const width of [390, 768, 1440]) {
    for (const route of ['/', '/covers', '/layouts', '/presentation', '/releases']) {
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
          if (['/presentation','/covers','/layouts'].includes(route)) {
            assert.ok(await page.locator('.ps-workspace').isVisible(), `${route} shows the presentation workspace`);
            assert.ok(await page.getByRole('navigation', { name: language === 'zh' ? '主导航' : 'Main navigation' }).getByRole('link', { name: language === 'zh' ? '视频呈现' : 'Video presentation' }).isVisible());
            if(width===390) {assert.ok(await page.locator('.ps-cover-strip').isVisible(), 'mobile cover choices visible'); assert.ok(await page.locator('.ps-layout-strip').isVisible(), 'mobile layout choices visible');}
          }
          if (route === '/releases') {
            assert.equal(await page.locator('.release-entry').count(), 6);
            assert.equal(await page.locator('.release-entry').first().locator('.release-version').innerText(), 'v1.0.1');
            assert.equal(await page.locator('.release-entry').first().locator('h2').innerText(), language === 'zh' ? '更可靠的检查' : 'More dependable reviews');
            assert.ok((await page.locator('.release-entry').first().locator('a').getAttribute('href')).endsWith('/tag/v1.0.1'));
          }
          if (route === '/') {
            const navigation = page.getByRole('navigation', { name: language === 'zh' ? '主导航' : 'Main navigation' });
            assert.equal(await navigation.locator('a[href$="#skills"]').count(), 1);
            assert.equal(await navigation.locator('a[href$="#workflow"]').count(), 0);
            assert.ok(await page.locator('#workflow').count(), 'legacy workflow anchor remains available');
            const graph = page.locator('.workflow-graph');
            assert.equal(await graph.getAttribute('data-reduced-motion'), 'true');
            assert.equal(await graph.locator('.workflow-node').count(), 5);
            assert.equal(await graph.getByRole('button').count(), 0, 'reduced motion needs no replay control');
            assert.ok(await graph.evaluate(element => [...element.querySelectorAll('.workflow-node')].every(node => getComputedStyle(node).opacity === '1')), 'reduced motion shows the complete diagram');
            const tabs = page.getByRole('tab');
            assert.equal(await tabs.count(), 5);
            for (let index = 0; index < 5; index++) {
              await tabs.nth(index).click();
              assert.equal(await tabs.nth(index).getAttribute('aria-selected'), 'true');
              assert.ok(await page.getByRole('tabpanel').isVisible());
              const links = page.getByRole('tabpanel').locator('a[href*="/skills/"]');
              assert.equal(await links.count(), index >= 3 ? 2 : 1, 'each capability links to its skills');
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `capability ${index} ${width}px ${language}: overflow`);
            }
            await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
            await tabs.nth(4).click();
            await page.getByRole('button', { name: language === 'zh' ? '复制示例更新' : 'Copy example update' }).click();
            assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('.handoff-message').innerText());
            // A new visitor can finish and reset the illustrative receipt flow.
            await tabs.nth(1).click();
            const artifact = page.locator('.receipt-sketch');
            await artifact.getByRole('button', { name: language === 'zh' ? '请求补交收据' : 'Request receipt' }).click();
            await artifact.getByRole('button', { name: language === 'zh' ? '添加示例收据' : 'Add sample receipt' }).click();
            assert.equal(await artifact.getByRole('status').innerText(), language === 'zh' ? '可以继续审核' : 'Ready for review');
            assert.ok((await artifact.innerText()).includes('$84.00'));
            assert.ok((await artifact.innerText()).includes('EXP–024'));
            await artifact.getByRole('button', { name: language === 'zh' ? '重置示例' : 'Reset example' }).click();
            assert.equal(await artifact.getByRole('status').innerText(), language === 'zh' ? '缺少收据' : 'Receipt missing');
            // Roving keyboard focus selects the next capability and deep links survive reload.
            await tabs.nth(1).focus();
            await tabs.nth(1).press('ArrowRight');
            assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');
            await page.reload({ waitUntil: 'networkidle' });
            assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');
            // Existing released skills remain reachable inside Demonstrate.
            await tabs.nth(3).click();
            await page.getByRole('button', { name: language === 'zh' ? '了解 Film ↗' : 'Explore Film ↗', exact: true }).click();
            const dialog = page.getByRole('dialog', { name: 'Film', exact: true });
            assert.ok(await dialog.isVisible());
            await dialog.getByRole('button', { name: language === 'zh' ? '关闭详情' : 'Close details' }).click();
            assert.equal(await dialog.isVisible(), false);
          }
          assert.deepEqual(errors, [], `${route} ${width}px ${language}: browser errors`);
          console.log(`PASS ${width}px ${route} ${language}`);
          checks++;
        }
      } finally { await page.close(); }
    }
  }
  // Preview, choose and hand off without leaving the workspace; old links remain usable.
  {
    const page = await browser.newPage({viewport:{width:1200,height:900}});
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await page.goto(origin + '/presentation', {waitUntil:'networkidle'});
    assert.equal(await page.locator('.ps-actions').evaluate(el=>getComputedStyle(el).position),'sticky');
    assert.equal(await page.locator('.ps-preview').evaluate(el=>getComputedStyle(el).position),'sticky');
    assert.equal(await page.locator('.ps-cover-strip .ps-cover-option').count(),9);
    await page.getByRole('button',{name:'Show all covers'}).click();
    assert.equal(await page.locator('.ps-cover-strip .ps-cover-option').count(),33);
    assert.equal(await page.locator('.ps-cover-strip').evaluate(el=>getComputedStyle(el).display),'grid');
    assert.equal(await page.locator('.ps-layout-strip').evaluate(el=>getComputedStyle(el).display),'grid');
    assert.equal(await page.locator('.ps-switch').count(),0, 'the preview does not require a cover/video switch');
    await page.locator('.ps-cover-option').nth(1).click();
    assert.equal(new URL(page.url()).searchParams.get('cover'),'cobalt-signal');
    assert.equal(await page.locator('.ps-canvas').getAttribute('data-phase'),'cover');
    await page.locator('.ps-layout-item').last().click();
    assert.equal(new URL(page.url()).searchParams.get('layout'), 'plain-transcript');
    assert.equal(await page.locator('.ps-canvas').getAttribute('data-phase'),'cover', 'changing layout restarts at the chosen cover');
    await page.waitForFunction(()=>document.querySelector('.ps-canvas')?.dataset.phase==='video',null,{timeout:8000});
    assert.equal(await page.locator('.ps-film-recording').count(),1, 'preview uses the real sample recording');
    assert.equal(await page.locator('[data-annotation-style]').count(),1, 'preview uses Film annotation');
    await page.locator('.ps-fields').getByLabel('Demo title',{exact:true}).fill('Quarterly review');
    await page.locator('.ps-fields').getByLabel('Background',{exact:true}).fill('#ffffff');
    assert.equal(await page.getByRole('button',{name:'Download configuration'}).isEnabled(),false,'unreadable colors cannot be downloaded');
    await page.locator('.ps-fields').getByLabel('Background',{exact:true}).fill('#14263a');
    assert.equal(await page.locator('.ps-canvas').getAttribute('data-phase'),'cover');
    assert.equal(await page.locator('.ps-film-frame [data-cover-preset]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(20, 38, 58)');
    await page.locator('.ps-cover-option').nth(2).click();
    await page.locator('.ps-cover-option').nth(1).click();
    assert.equal(await page.locator('.ps-fields').getByLabel('Background',{exact:true}).inputValue(),'#14263a','color edits survive comparison during the session');
    assert.equal(await page.locator('.ps-fields').getByLabel('Demo title',{exact:true}).inputValue(),'Quarterly review');
    await page.locator('.ps-fields').getByLabel('Company name',{exact:true}).fill('North Star');
    await page.locator('.ps-fields input[type=file]').setInputFiles({name:'brand.webp',mimeType:'image/webp',buffer:await readFile(new URL('../public/art/demo-capture.webp', import.meta.url))});
    assert.equal(await page.getByRole('button',{name:'Download configuration'}).isEnabled(),false);
    await page.getByLabel('This logo represents my company').check();
    assert.equal(await page.getByRole('button',{name:'Download configuration'}).isEnabled(),true);
    assert.equal(await page.locator('.ps-film-frame img').count()>0,true);
    await page.getByRole('button',{name:'Copy brief',exact:true}).click();
    const brief=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(brief.includes('Quarterly review') && brief.includes('plain-transcript') && brief.includes('cobalt-signal') && brief.includes('#14263a') && brief.includes('brand.webp') && brief.includes('North Star'));
    assert.ok(!brief.includes('no opening cover'));
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download configuration'}).click();
    const download=await downloadPromise;
    const config=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(config.layout.preset,'plain-transcript');assert.equal(config.cover.preset,'cobalt-signal');assert.equal(config.cover.colors.background,'#14263a');assert.equal(config.intro.enabled,true);assert.equal(config.title,'Quarterly review');assert.equal(config.brand.name,'North Star');assert.equal(config.brand.logo,'brand.webp');assert.equal(config.brand.logoProvenance.verified,true);
    await page.getByRole('button',{name:'No cover',exact:true}).click();
    assert.equal(await page.locator('[data-annotation-style]').count(),1);
    const nonePromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download configuration'}).click();
    const none=JSON.parse(await readFile(await (await nonePromise).path(),'utf8'));assert.equal(none.intro.enabled,false);assert.equal(none.cover,undefined);
    await page.reload({waitUntil:'networkidle'});
    assert.ok((await page.locator('.ps-summary').innerText()).includes('No cover'));
    await page.goto(origin + '/covers?style=cobalt-signal', {waitUntil:'networkidle'});
    assert.ok(await page.locator('#cover-editor-title').isVisible());
    await page.goto(origin + '/layouts?style=studio-sand', {waitUntil:'networkidle'});
    assert.equal(await page.locator('.ps-layout-item').nth(1).getAttribute('aria-pressed'),'true');
    await page.close();
    console.log('PASS workspace choices, configuration, reload and legacy links');
  }
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + '/?lang=zh', { waitUntil: 'networkidle' });
      const completed = () => [...document.querySelectorAll('.workflow-node')].every(node => getComputedStyle(node).opacity === '1') && [...document.querySelectorAll('.graph-route')].every(path => path.getAttribute('stroke-dasharray') === '1 1');
      await page.waitForFunction(completed, null, { timeout: 6000 });
      const replay = page.getByRole('button', { name: '重播动画', exact: true });
      await replay.click();
      await page.waitForFunction(() => [...document.querySelectorAll('.workflow-node')].some(node => Number(getComputedStyle(node).opacity) < 0.9));
      await page.waitForFunction(completed, null, { timeout: 6000 });
      await replay.click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('.workflow-graph').dataset.reducedMotion === 'true');
      await page.waitForFunction(completed);
      assert.equal(await replay.count(), 0, 'changing the system preference stops the sequence');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px motion completion, replay and live reduced-motion preference`);
    } finally { await page.close(); }
  }
  console.log(`Local Chromium: ${checks} route/language/viewport checks passed. Physical devices, Windows and Linux require separate acceptance.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
