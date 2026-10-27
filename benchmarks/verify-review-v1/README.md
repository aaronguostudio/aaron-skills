# Verify review v1

This authored synthetic casepack covers a changed UI, a clean narrow label change, a repair and recheck, and a non-code report review. All names and data are fictional. The task is each test/fixtures case’s brief.md. Keep rubric.json hidden from executors. Supply only one frozen skill version per isolated workspace.

Prepare browser evidence outside Git with Node and an installed Playwright module: `node prepare-evidence.js <playwright-module> <fixture-copy-root>` (a copy of `test/fixtures`). For repair-app, run `node render.mjs` before review to create original buggy outputs. Save input and skill hashes, freeze the rubric before running, and retain failed takes. Never commit generated evidence or raw run artifacts.

This case is registered in `benchmarks/public-cases.json`; its reviewed authored files are allowlisted in `bundles/source.json`. See [results](results.md), [aggregate judgments](aggregate.json) and [fingerprints](fingerprints.json). The negative import fixture intentionally lives under `test/fixtures`; it is test input, not executable product runtime.

The preparation helper refuses fixture roots inside Git, including resolved symlink destinations and worktree marker files. Generated evidence belongs only in external copied fixtures.
