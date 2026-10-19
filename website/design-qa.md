# Workflow Canvas homepage — design QA

## Target and evidence

- Source visual truth: `$CODEX_HOME/generated_images/01a14aee-5bb3-7db1-8559-467fbb14b6b1/exec-1fe16696-d2c1-42f2-bf16-ac2f112fb4b3.png` — the user's selected second mock.
- Implementation: http://127.0.0.1:4207/ — local preview on `codex/workflow-homepage`.
- External evidence root: `<external-evidence>/homepage-workflow-2026-10-18/`.
- Final implementation screenshot: `homepage-final.png` under that external root.
- Full-view comparison: `comparison-final-desktop.png`; focused illustration comparison: `comparison-final-diagram.png`.
- Raw image generations and browser captures remain outside Git. The consumed assets are the two optimized WebP files under `src/assets/workflow-canvas/`.

## Matched comparison setup

Source pixels are 1487 × 1058. The final native browser capture and CSS viewport are both 1391 × 782. The source was proportionally normalized to width 1391 and clipped to the same top 782-pixel viewport; the implementation was neither stretched nor rescaled. Source and implementation are together in each comparison image, source left, implementation right. State: English homepage, top of page, no modal, no autoplay.

A separate 1440-CSS-pixel probe exposed backend screenshot-density/canvas differences; those exploratory captures were not used as the final fidelity evidence. Temporary viewport overrides were reset. Responsive checks used measured CSS widths 320, 390 and 768; their screenshot density can differ from CSS dimensions. These were browser viewport checks, not certification on physical devices.

## Comparison history and fixes

1. **Initial pass — blocked.** `comparison-initial.png`: [P2] diagram content was too short and too low; [P2] hero spacing pushed the directory divider below the intended fold; [P2] intro wrapping and primary CTA width differed.
2. **Spacing pass.** `comparison-revised.png`: tightened copy gaps and matched CTA width. The first isolated illustration still had excess top padding and a short lower document, so the image remained actionable.
3. **Final pass — passed.** Used the exact selected diagram crop as the built-in Image Gen edit reference. Corrected the role descriptions while preserving the reference geometry, removed the fake example duration, and exported a white-background diagram with minimal padding. Replaced the temporary negative placement with normal placement. Final same-viewport full and focused comparisons show the requested hierarchy, wrapping, proportions and alignment; no actionable P0/P1/P2 differences remain.

## Required fidelity surfaces

- **Fonts and typography:** bundled Inter Variable; three-line English headline, weight, line height and blue final line match the target closely. Chinese uses native CJK fallbacks, with readable wrapping checked at narrow widths. Minor optical differences in generated-image lettering are P3.
- **Spacing and layout:** slim header, open two-column hero, one diagram, primary/text CTAs, and compact three-column Skill directory. Five-stage workflow and existing examples continue below in the same restrained visual language. Narrow layouts stack cleanly without control overlap.
- **Colors and tokens:** white, near-black, cobalt and blue-gray. No decorative gradients or floating dioramas. Existing published artwork files and URLs are preserved for README references.
- **Image quality:** real generated raster diagram, not a CSS/SVG drawing. Full 1475 × 1066 WebP is 65,094 bytes; responsive 768 × 555 export is 26,142 bytes. No stretching. Main text and stage names remain legible; small illustration annotations are supported by accessible alt text and the visible Skill descriptions.
- **Copy and content:** Capture records actual app flows and checks; Film renders passed captures; Share prepares a reviewed update. Unreleased Understand/Build/Verify stages retain future labels. No new availability, usage or score claims. Bilingual descriptions, source links and four voiced video variants are featured; the two silent exports remain available at their existing URLs.
- **Icons and accessibility:** existing Phosphor icons, visible focus states, semantic links/buttons, image alt text and reduced-motion support. Native dialog keyboard dismissal returns focus to the triggering Skill button and restores page position.

## Browser checks

- All three Skill dialogs open/close and point to their original skill/install documentation.
- Primary navigation and CTA anchors reach the Skills and Examples sections.
- English/Chinese switching works and updates the document language and URL.
- Measured 320px English/Chinese, 390px Chinese and 768px English layouts have no horizontal overflow or header overlap. A 390px dialog fits within the viewport; Escape returns focus correctly.
- Both video cases render. Tutorial/Stakeholder recipe selection updates presentation, purpose and audio metadata. Actual CDN videos play with no media error; starting the second case pauses the first. Players retain `preload="none"` and no autoplay.
- Making-guide disclosure opens correctly.
- Browser warning/error logs checked: none.

## Build and boundaries

Website build, published-media metadata test and all four Sites adapter tests passed. Tracked benchmark privacy check passed. The original workspace's 111 protected files and staged/unstaged patches remain byte-identical. Existing benchmark files, hosting worker and Sites adapter sources are unchanged. After user approval, the public showcase metadata now features only the four voiced cuts, and bilingual recipe copy and the metadata gate were updated accordingly. Publication follows the repository PR and Git/main deployment checks.

## Follow-up polish

- [P3] Fine optical differences in generated illustration strokes, tiny labels and numeral spacing can be refined after user review; they do not change hierarchy or function.
- Human preference for the overall direction remains the user's decision.

## Implementation checklist

- [x] Resolve selected visual target.
- [x] Generate and optimize faithful diagram assets.
- [x] Match typography, layout and palette; compare full view and focused image regions.
- [x] Fix all P0/P1/P2 findings and repeat the comparison.
- [x] Verify responsive, bilingual, keyboard/dialog and video interactions.
- [x] Pass the relevant build/privacy checks and keep the local preview open.

final result: passed
