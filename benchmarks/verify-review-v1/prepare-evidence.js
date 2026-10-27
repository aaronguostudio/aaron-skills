// Run against a copied fixture tree outside Git. Outputs are raw local evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const moduleName = process.argv[2];
const suppliedRoot = process.argv[3];
if (!moduleName || !suppliedRoot) {
  throw new Error('Usage: node prepare-evidence.cjs <playwright-module> <fixture-copy-root>');
}
function entryExists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function assertOutsideGit(root) {
  const absolute = path.resolve(root);
  const resolved = fs.realpathSync(absolute);
  if (!fs.statSync(resolved).isDirectory()) throw new Error('Fixture root must be a directory');
  for (const start of new Set([absolute, resolved])) {
    let current = start;
    while (true) {
      if (entryExists(path.join(current, '.git'))) {
        throw new Error('Refusing raw evidence workspace inside a Git checkout');
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return resolved;
}
// Validate before loading Playwright, launching a browser, or writing anything.
const fixtureRoot = assertOutsideGit(suppliedRoot);
const caseRoots = {};
for (const name of ['ui-review', 'label-review']) {
  const caseRoot = assertOutsideGit(path.join(fixtureRoot, name));
  caseRoots[name] = caseRoot;
  const outputs = name === 'ui-review'
    ? ['before.png', 'accepted.png', 'after.png']
    : ['before.png', 'after.png', 'prior-evidence.json'];
  for (const output of outputs) {
    const file = path.join(caseRoot, output);
    if (entryExists(file)) {
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Refusing symlink raw evidence output');
      assertOutsideGit(path.dirname(fs.realpathSync(file)));
    }
  }
}
const { chromium } = require(moduleName);
const viewport = { width: 960, height: 720 };
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const name of ['ui-review', 'label-review']) {
      const stages = name === 'ui-review' ? ['before', 'accepted', 'after'] : ['before', 'after'];
      for (const stage of stages) {
        const page = await browser.newPage({ viewport });
        try {
          const caseRoot = caseRoots[name];
          await page.goto('file://' + path.join(caseRoot, stage, 'index.html'));
          await page.screenshot({ path: path.join(caseRoot, stage + '.png') });
          if (name !== 'label-review' || stage !== 'before') continue;
          await page.click('#save');
          const stored = await page.evaluate(() => localStorage.getItem('juniper-draft'));
          await page.reload();
          const afterReload = await page.evaluate(() => localStorage.getItem('juniper-draft'));
          const files = ['before/index.html', 'before/behavior.js'];
          const inputHashes = Object.fromEntries(files.map(file => [file, sha256(path.join(caseRoot, file))]));
          const evidence = {
            method: 'Playwright Chromium file URL; click #save; read localStorage; reload; reread',
            viewport, inputHashes, stored, afterReload,
            passed: stored === 'saved' && afterReload === 'saved',
          };
          fs.writeFileSync(path.join(caseRoot, 'prior-evidence.json'), JSON.stringify(evidence, null, 2));
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
