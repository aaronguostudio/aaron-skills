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

The next local review should explain Aaron Skills before showing output examples. Put a playable introduction behind a clear text button; keep the Guided Video illustration static, without a click overlay. State above the fold that Demo (Capture / Film / Share) is released, while other lifecycle capabilities are still in development. Product-demo examples lead; the public blog is a content walkthrough. Include Official Product Demo separately from the five documented narrative purposes. Compare other projects by their documented focus with primary links, without exclusivity or untested superiority claims. Current voice candidates should sound full, positive and energetic; Chris/Jessica were not accepted. Keep new voices and films local until reviewed.

The user selected Liam (generic American male voice) for the demonstration examples. The homepage introduction instead uses Aaron's existing approved personal voice and a conversational first-person welcome: the work problem he encountered, the habits he collected, and what he is building from them. Keep the existing shared runtime voice defaults and personal/provider configuration outside Git. The illustration's Guided Video play symbol is decorative; only the text introduction button opens the video.

For the personal homepage welcome, speech should begin almost immediately after playback (about 0.2 seconds). Do not add a two-second silent lead-in when there is no opening sequence. Move captions and scene timing together while retaining the selected narration take.

Keep introduction and demonstration videos free of AI Narration, Local Review, draft and other process labels by default. Add a visible label only when the user explicitly requests it. Keep provenance and review status in external QA records.

The English and Chinese GitHub READMEs should share the current Workflow Canvas
visual identity: flat white/blue workflow art, a compact text directory of the
three released skills, and the approved branded showcase covers. Keep example
counts and voice/script capabilities aligned with the released website. Retain
older published art URLs for existing links.

## Presentation cover library

On 2026-10-19 Aaron accepted the simple presentation-cover direction and requested a few dozen examples published on this website. Covers use one large image or color block, a strong title, restrained brand mark/subtitle, presenter and date. Keep them as presentation opening slides; do not turn them into website layouts with navigation, content cards or chapters. Extend the accepted geometric, photographic and sculptural styles with confident color and tactile materials. Preserve original generated PNGs and serve responsive WebP previews. The bilingual `/covers` gallery contains image samples; do not describe those images as editable slide templates or integrated runtime presets without implementing and verifying that capability.

On 2026-10-19 Aaron approved agent-led cover selection and authorized its website
and skill release. Use a thumbnail gallery with family filters/search. The
conversation is the default entry: recommend about three styles using content,
audience and supplied brand, accept a number/name or delegated choice, then
reuse the chosen configuration in the video. The web editor is optional and
provides a copyable agent brief; do not require page/form/CLI use. Keep original
PNG/WebP sample URLs. The browser may share the pure React cover view and bundled
art with Film, but must build/run without Bun, FFmpeg or Remotion execution.
