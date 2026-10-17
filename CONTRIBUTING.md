# Contributing

Keep skills focused and host-neutral. Runtime prerequisites must be explicit.
Use public fixtures; never commit customer adapters, recordings, browser state,
credentials or generated evaluation logs. Review scope and permissions before
recording a real application.

## Development

Requirements: the supported macOS runtime prerequisites in README.md. Install
source dependencies with `npm ci`, `npm ci --prefix packages/demo/capture`, and
`npm ci --prefix packages/demo/remotion`. Prepare a Demo installation as described
in docs/installation.md; use its Python virtual environment for Pillow tests.

Run `npm run check -- --python <installed-runtime>/current/.venv/bin/python3`.
This is the shared local/CI quality command. After runtime or packaging changes,
export/install to a new directory outside Git, then run doctor and smoke. Inspect
the generated video and page. Model evaluations are separate, explicit operations;
ordinary tests must not call paid providers.

## Changes and extensions

Keep one owning implementation per capability. Include a regression or public
fixture for behavior changes. The final renderer validates its own input; wrappers
must not be its only safety check. Python offline editing and JS rendering share
acceptance examples under evals/fixtures.

Update bundles/demo.json when adding runtime files. bundles/source.json lists
public source files, including tests and development configuration. A source
release must contain enough code to reproduce checks, not private history or logs.
Add new capabilities as packages and bundle declarations when there is an actual
use case; avoid prematurely generalizing the installer.

Submit a focused change with the problem, resulting behavior and relevant checks.
Follow SECURITY.md for sensitive findings. Keep publishing and customer delivery
out of tests; release actions require the maintainer's explicit authorization.

Public-history checks require GitHub noreply author and committer emails. Set
that identity for this repository without changing your global Git configuration.
