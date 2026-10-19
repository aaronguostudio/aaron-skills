# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Aaron Skills visual direction

On 2026-10-18 the user found the original floating ceramic islands and copper ribbons excessive and selected the second redesign mock: `exec-1fe16696-d2c1-42f2-bf16-ac2f112fb4b3.png` (Workflow Canvas). This supersedes the original 2026-10-17 art direction for the homepage. Use a white surface, near-black Inter typography, cobalt blue accents, a single flat workflow illustration, and a compact three-column Capture / Film / Share directory. Keep the page useful and restrained. Preserve the original published illustration files and URLs because README assets still depend on them; do not display them as homepage decoration. The five-stage method remains, with Understand/Build/Verify labelled as future direction. Default English with a working Chinese switch. The user approved this implementation and authorized publication on 2026-10-18.

The user accepted the implemented preview and authorized committing, merging and deploying it to Vercel, with `skills.aaronguo.com` as the intended custom domain. Production must use the connected repository's committed `main` revision through Git deployment. Keep the website independent of the Demo runtime.

The user requested lightweight image delivery and richer bilingual READMEs using
the existing website art. Preserve the accepted artwork, use responsive WebP
variants and keep README image payload small. Published illustration URLs must
remain valid when regenerating content-hashed assets.

The local naming preview uses Capture, Film and Share for the
three existing Demo skills. Keep their existing slugs, documentation paths,
artwork names and published image URLs intact. Shape (invocation ID
feature-blueprint) is a separate source-checkout preview; this naming pass does
not add it to the released Demo bundle or authorize a production release.

Website video examples should demonstrate finished narrated work. Do not feature silent cuts as showcase choices. Keep the current example layout; improve poster branding to match the restrained Aaron Skills identity. Voice exploration should use generic North American male/female voices, with local comparison before replacing the published voice.
