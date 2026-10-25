# Local development and release flow

Daily development, browser checks and deterministic tests run on the maintainer's
machine. Vercel builds and serves the website when an affected committed `main`
revision is released. GitHub keeps inexpensive source/privacy/secret checks;
native platform acceptance is reserved for version tags or manual dispatch.

## Website acceptance

Use Node 24 for the website, matching its deployment configuration:

```sh
npm ci --prefix website
npm ci --prefix packages/demo/capture
node packages/demo/capture/node_modules/playwright/cli.js install chromium
npm run verify:website
npm audit --prefix website --audit-level=high
```

The verification command checks deployment decisions and published asset
contracts, builds the static site and Sites export, checks worker behavior and
opens the built output in local Chromium. It checks `/`, `/covers` and `/layouts`
in English and Chinese at widths 390, 768 and 1440: 18 combinations. These are
viewport simulations, not physical-device or native Windows/Linux certification.
It checks page/navigation visibility, horizontal overflow, JavaScript errors and
failed local requests; media playback, clipboard and visual acceptance retain
their separate existing gates. The browser blocks external requests, including
published videos, so this gate uses local assets and does not call a model or
voice provider. Installing dependencies or browser binaries still needs network
access on first setup.

For interactive review run `npm run dev --prefix website -- --host 127.0.0.1`.
No Vercel preview or paid hosting is required for local work.

`website`'s `build` command now only runs Vite and prepares the delivery export.
Tests remain mandatory before release through `verify:website`; run it after the
last relevant edit. Moving tests out of the build command does not establish an
automatic release gate. The maintainer is responsible for checking the exact
reviewed revision before merging. A later edit invalidates earlier evidence.

## Runtime acceptance

Install the source dependencies described in CONTRIBUTING.md, including the
capture and Remotion packages and Python with Pillow, then run:

```sh
npm run verify:runtime -- --python <python-with-Pillow>
```

This delegates to the existing complete deterministic source check. Its browser
tests, renderer tests and synthetic provider tests remain local; it does not
perform live paid synthesis. Runtime/installer/package changes still require a
fresh exported installation outside Git, doctor and installed smoke, as described
in verification.md. Keep recordings, logs and other evidence outside the checkout.

macOS can validate its own runtime and simulate browser dimensions. Use real
Windows/Linux or the manual native CI matrix when those behaviors are affected;
do not replace native filesystem/ACL/install checks with browser viewports.

## Cloud work by exception

| Trigger | Work performed |
| --- | --- |
| Ordinary pull request or `main` push | Public-source/privacy/history and secret scanning |
| Feature branch push | No automatic Vercel preview; no full platform matrix |
| Affected `main` push | Vercel website artifact build and Git deployment |
| Unrelated `main` push | Website build skipped |
| Manual Checks workflow | Existing macOS/Ubuntu/Windows matrix |
| `v*` version tag | Existing macOS/Ubuntu/Windows matrix for release evidence |
| Manual Website workflow | Same website acceptance and dependency audit on Linux |

A full release still needs successful native matrix evidence for its exact
revision. The release-asset workflow is unchanged. Creating a tag, publishing a
release or dispatching expensive cloud verification is an explicit operation.

Automatic Vercel Git deployments are enabled only for `main` using
`git.deploymentEnabled`. An explicitly requested CLI Preview remains possible;
the ignore script allows it. Never use local production deployment, promotion or
alias swaps. Production must remain a Git-triggered deployment of committed
`main`, with provenance and the real domain verified after release.

The ignored-build script compares `VERCEL_GIT_PREVIOUS_SHA` (the last successful
deployment) with the checkout revision, rather than comparing only `HEAD^`.
Website source/public assets/build configuration and shared cover code/art are
inputs. Missing baseline/history, divergent history or checkout mismatch builds
conservatively. Explicit same-revision redeployments also build so changed
environment variables or project settings can take effect. Add new outside-root
website dependencies to that input list.
The Vercel project's Root Directory must remain `website`, with outside-root
source available for the shared imports. Inspect dashboard command overrides
before rollout; a repository config alone is not proof of effective settings.
Build-machine size and on-demand concurrency are separate project settings;
changing the Git triggers does not downgrade a Turbo machine or establish actual
billing savings.

## Rollout and rollback

Verify locally, review the diff, and use the separately authorized merge/release
flow. Repository changes do not alter the live deployment until published.
After rollout, check that a runtime/docs-only main change skips, an affected
main change builds, and a feature push creates no automatic Preview. Confirm
`release.json` and the custom domain match the expected built Git `main` revision.
A skipped unrelated commit leaves that last built revision live; it need not
equal the latest `main` tip. Confirm the live revision remains an ancestor of
`main`, and use the canceled deployment's logs to verify the skip decision.

### Reading deployment outcomes

An unrelated `main` change can appear as a canceled deployment. Its build log
must contain `Skip website: no website or shared cover input changed since the
last deployment` and must stop before dependency installation or `vercel build`.
This is an expected skip; inspect the log before treating a canceled deployment
as a build failure. Automatic source/privacy/secret checks still run on GitHub.

For an affected change, expect `Build website: site input changed:` followed by
the artifact build. Verify that deployment's Git branch/SHA and the custom
domain's `/release.json`. A branch preview must be requested explicitly.

If a site input is missed, correct the input list and commit it to `main`; edits
to the build script itself trigger a build. If automatic previews or routine
matrix runs are needed again, revert the relevant Git/config changes through
the same reviewed `main` flow. Keep local acceptance commands available.
