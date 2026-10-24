# Aaron Skills website

A local, responsive implementation of the selected Workflow Canvas homepage.
The website is independent of the Demo runtime and lives entirely in this folder.

```sh
cd website
npm ci
npm run dev -- --host 127.0.0.1 --port 4183 --strictPort
npm run build
```

The production build is `dist/client`. The bundled preview hosting adapter also
emits `dist/server` and `dist/.openai`; it does not publish anything. The
Vercel project uses `website` as its root and `dist/client` as its static
output, with build settings recorded in `vercel.json`. Production must come from a Git-triggered committed `main` revision,
following the repository deployment policy.
The Vite configuration refuses Vercel production builds without a `main` Git
commit, including accidental first-deployment classification of a feature branch.

The build emits `release.json` with Vercel's Git commit and branch, so the
production domain can be checked against the deployed revision. Local builds
use null values. Website CI builds, checks the hosting adapter and audits pinned
dependencies separately from the Demo runtime checks.

## Page behavior

- Five-stage workflow, with the first three explicitly marked as future direction.
- Three available Demo skills with native, keyboard-accessible detail dialogs.
- Working section navigation, GitHub/documentation links, and English/Chinese
  language switching. `?lang=zh` opens the Chinese page directly.
- Desktop, tablet and phone layouts; reduced-motion preferences are respected.
- Self-hosted font and illustrations. No sign-in or application backend service.

## Traffic analytics

Rybbit loads asynchronously only on `skills.aaronguo.com`; localhost and Preview
deployments do not send production analytics. The shared HTML entry covers the
homepage, `/covers` and `/layouts`, including both languages. Rybbit tracks the
initial page view, SPA navigation and outbound links without custom user IDs.

The private [Aaron Skills dashboard](https://app.rybbit.io/18081/main) belongs to
Aaron Guo Studio. Its site settings enable bot blocking and daily user ID salting;
query-string collection and session replay are disabled. The public tracking ID
in `index.html` is not an API key. No analytics credentials belong in this site.

These metrics describe website visits, sessions and approximate unique visitors.
They do not measure skill installations or usage inside an agent application.
Counts begin after the tracker is published; ad blockers may prevent collection.
See the [Rybbit tracking documentation](https://rybbit.com/docs/script).

## Design and art

The current homepage follows the approved Workflow Canvas direction: white,
ink and cobalt, a flat workflow illustration and a compact skill directory.
Earlier Orbital Workshop artwork remains available for existing README links.
The website uses responsive WebP assets and a self-hosted font; see
[image delivery and measured sizes](performance.md).

The introduction and eight narrated examples load on demand. Reviewed final
MP4, WebP and VTT exports live in the dedicated public media store; source
recordings, real scripts, personal voice profiles and QA logs stay outside Git.
The expandable fictional script example is authored specifically for public
documentation, rather than copied from a real run. The introduction and eight
application/blog examples use Aaron's approved voice with Eleven v4 and a single
pitch-preserving 1.2× delivery pass. Captions and screen timing follow each new
take; previous published asset URLs remain available.

See `design-qa.md` for visual comparison and browser verification. Local captures
and audit output remain in ignored `.artifacts/`.
