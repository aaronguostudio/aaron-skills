# Contributor instructions

Keep all work local unless the user explicitly authorizes publishing. Do not add a remote or push as part of tests.

## Local-first development

Run day-to-day validation on the maintainer's machine. For website changes run
`npm run verify:website` (including local responsive/browser checks); use
`npm run verify:runtime -- --python <python-with-Pillow>` for runtime changes,
plus isolated installed smoke when packaging/runtime changes. Keep output outside
Git. Run the checks again after relevant edits. See `docs/local-development.md`.

Vercel builds only the website delivery artifact. Automatic Git deployments are
limited to `main`, with unrelated changes skipped against the last successful
deployment. Keep shared cover dependencies in the deployment input list when
website imports change. Cloud previews are explicit exceptions for review.
The native three-OS matrix runs on version tags or manual dispatch; local Mac
viewports do not certify Windows/Linux. Preserve automatic public-source and
secret checks. Production remains a Git-triggered committed `main` deployment.

Benchmark boundaries are defined in `benchmarks/PRIVACY.md`. Public cases must be
registered in `benchmarks/public-cases.json` and explicitly listed in
`bundles/source.json`. Use the public blog, licensed open-source projects or entirely
synthetic applications/data. Private project benchmarks are currently disabled;
do not inspect or import a private project to populate this case library. Raw
execution/evidence must stay outside every Git checkout. Before committing, run
`python3 scripts/benchmark_privacy.py --staged`; enable the local hook with
`git config --local core.hooksPath .githooks`. Do not bypass a failed boundary check.

Keep skill entry points concise and host-neutral. Document runtime prerequisites explicitly. Platform-specific integrations are optional adapters and must not become a hidden requirement of the capture contract.

Use the explicit Demo bundle manifest when adding runtime files. Tests must load and render from an exported installation to catch missing transitive imports. Run output and user configuration stay outside source control.

Run the deterministic tests appropriate to a change, then the isolated installed smoke check when packaging or runtime changes. Treat model routing evaluations, mocked provider tests, browser tests, and visual acceptance as separate evidence. Never label an untested platform or host as supported.
