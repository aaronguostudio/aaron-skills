import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/vercel-ignore-build.mjs', import.meta.url));

test('only main has automatic Git deployments enabled', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.deepEqual(config.git.deploymentEnabled, { '**': false, main: true });
  assert.equal(config.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');
});

test('deployment diff keeps shared inputs, accumulated changes and uncertain baselines safe', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'aaron-build-policy-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (file, body) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), body);
    git('add', '--all'); git('-c', 'user.name=Build policy fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const run = (previous, overrides = {}) => spawnSync(process.execPath, [script], {
    cwd: path.join(cwd, 'website'), encoding: 'utf8', env: { ...process.env, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: git('rev-parse', 'HEAD'), VERCEL_GIT_PREVIOUS_SHA: previous, ...overrides },
  });
  try {
    git('init', '-q');
    // Vercel runs the ignored-build command from the configured Root Directory.
    // Local Git preferences must not hide outside-root inputs or strip prefixes.
    git('config', 'diff.relative', 'true');
    let base = commit('website/src/app.jsx', 'site');
    commit('docs/example.md', 'docs');
    assert.equal(run(base).status, 0, 'documentation alone skips');
    commit('packages/demo/capture/tool.mjs', 'runtime');
    assert.equal(run(base).status, 0, 'runtime-only change skips');
    commit('packages/demo/covers/presets.json', '{}');
    commit('README.md', 'later unrelated commit');
    assert.equal(run(base).status, 1, 'earlier shared cover change still builds');
    base = git('rev-parse', 'HEAD');
    git('mv', 'website/src/app.jsx', 'docs/old-site.txt');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'move');
    assert.equal(run(base).status, 1, 'moving a site input out still builds');
    assert.equal(run('').status, 1, 'first deployment builds');
    assert.equal(run(git('rev-parse', 'HEAD')).status, 1, 'same-revision settings redeploy builds');
    assert.equal(run('a'.repeat(40)).status, 1, 'missing history builds');
    assert.equal(run(base, { VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }).status, 1, 'checkout mismatch builds');
    assert.equal(run(base, { VERCEL_ENV: 'preview' }).status, 1, 'explicit previews build');
    assert.equal(run(base, { VERCEL_GIT_COMMIT_REF: 'feature/test' }).status, 1, 'do not bypass production branch guard');
    const unrelated = git('rev-parse', 'HEAD');
    git('checkout', '--orphan', 'divergent');
    git('rm', '-rf', '.');
    commit('website/src/app.jsx', 'different history');
    assert.equal(run(unrelated).status, 1, 'divergent history builds');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
