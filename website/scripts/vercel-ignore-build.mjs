#!/usr/bin/env node
// Vercel's convention is inverted: 0 skips the build, 1 builds.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const build = reason => { console.log(`Build website: ${reason}`); process.exit(1); };
const skip = reason => { console.log(`Skip website: ${reason}`); process.exit(0); };

// Explicit CLI previews remain available. Automatic branch previews are disabled
// by git.deploymentEnabled, without blocking a deliberately requested preview.
if (process.env.VERCEL_ENV !== 'production') build('explicit non-production build');
if (process.env.VERCEL_GIT_COMMIT_REF !== 'main') build('production branch guard must run');

const previous = process.env.VERCEL_GIT_PREVIOUS_SHA || '';
const current = process.env.VERCEL_GIT_COMMIT_SHA || '';
if (![previous, current].every(sha => /^[a-f0-9]{40}$/i.test(sha))) build('no trustworthy deployment baseline');
if (previous === current) build('explicit redeployment may include changed project settings');

try {
  if (git('rev-parse', 'HEAD').trim() !== current) build('checkout differs from deployment revision');
  git('merge-base', '--is-ancestor', previous, current);
  // Compare with the last successful deployment, not HEAD^: this includes all
  // skipped commits and preserves both sides of a cross-directory rename.
  const paths = git('diff', '--no-relative', '--no-renames', '--name-only', '-z', previous, current, '--').split('\0').filter(Boolean);
  const prefixes = [
    'website/src/', 'website/public/', 'website/scripts/',
    'website/worker/', 'website/.openai/', 'packages/demo/covers/',
    'packages/demo/remotion/src/cover-library/',
  ];
  const files = new Set([
    'website/package.json', 'website/package-lock.json', 'website/index.html',
    'website/vite.config.js', 'website/vite.config.mjs', 'website/vite.config.ts',
    'website/vercel.json', 'website/.npmrc', 'website/.vercelignore',
    'package.json', 'package-lock.json', '.npmrc', '.vercelignore', '.gitattributes', '.gitmodules',
  ]);
  const affected = paths.find(path => files.has(path) || prefixes.some(prefix => path.startsWith(prefix)));
  if (affected) build(`site input changed: ${affected}`);
  skip('no website or shared cover input changed since the last deployment');
} catch {
  // Missing shallow history and Git failures must never suppress a needed release.
  build('deployment comparison unavailable');
}
