# Aaron Skills website

A local, responsive implementation of the selected Orbital Workshop homepage.
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
- Self-hosted font and illustrations. No sign-in, analytics or backend service.

## Design and art

`design/source-homepage.png` is the selected visual source. Seven separate
illustrations were generated using built-in ImageGen with that source attached,
then encoded as transparent WebP assets under `public/art`. The shared art
direction is warm ivory ceramic, copper/coral ribbons, pale-blue glass,
miniature architectural detail, and soft studio light. No UI screenshot is used
as the website itself; text, navigation and interactions are real HTML.

| Asset | Generation brief |
| --- | --- |
| `workshop-hero.webp` | Five floating ceramic workshop islands connected by copper ribbons, with a central camera/film/screen platform and glass/document satellites. |
| `demo-capture.webp` | Camera and tripod, glass screenshot panes, small copper lamp and plants on a ceramic plinth. |
| `walkthrough-video.webp` | Copper film reel and curling strip of walkthrough frames on an ivory oval plinth. |
| `paste-ready-update.webp` | Upright update document, screenshot panes, copper clips and small plants. |
| `workflow-understand.webp` | Quiet ivory square plinth with floating pale glass panes and cubes. |
| `workflow-build.webp` | Ivory plinth with assembled and hovering geometric ceramic blocks. |
| `workflow-verify.webp` | Ivory plinth, ceramic blocks and a pale-blue glass panel with an embedded white check. |

All generated originals are retained locally; ignored `.artifacts/source-art`
contains this project's PNG copies. Runtime web assets total about 1.2 MB.

See `design-qa.md` for visual comparison and browser verification. Local captures
and audit output remain in ignored `.artifacts/`.
