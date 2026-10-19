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

## Branded video posters

After user feedback, the two stories use a matching Aaron Skills / Film editorial cover series: white, ink, cobalt and a small yellow accent. Both were created with built-in Image Gen and exported as WebP (101,832 and 89,988 bytes). The fictional invoice illustration correctly shows $1,250 + $750 = $2,000. These are independent player posters; they do not imply a change to the existing video opening cards or voice. Raw generations remain outside Git; only reviewed final WebP exports are intentionally public.

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

## Introduction and narrative comparison — initial local review

This follow-up is a local review on `codex/demo-story-and-voices`; it is not a production release. The user selected the generic Liam voice after a five-voice audition. This choice applies to the introduction and examples, not shared runtime defaults.

- The hero explains AI-agent methods and tools and labels the released Demo bundle. A text button and the Guided Video illustration open the same introduction dialog. Other lifecycle capabilities remain in development.
- The authored introduction is about 50 seconds. Its motion design uses the approved white/cobalt identity and actual recorded evidence. It is a separately authored brand film, not a claim that Film automatically creates this animation.
- The synthetic invoice case leads with six explanations: Official Product Demo, Quick Demo, Release Update, Stakeholder Walkthrough, Task Tutorial and Training Lesson. The two blog examples explain a reading journey. Each group reuses one passed native capture, without repeating business actions.
- New scripts, provider configuration, audio, captures, films and review logs remain outside Git. The dev-only catalogue is proxied from a credential-free loopback server. Production builds exclude this catalogue fetch and local artifact paths. Published media URLs retain their existing exports until a later approved release.
- Introduction, Official Product Demo and Training Lesson playback reached the end without media errors. Recipe selection updates the source and explanation; starting the second case pauses the first. Players do not autoplay and use `preload="none"`.
- Both introduction entry points work. Escape closes and removes the player, restores body scrolling and returns focus to the invoking button. The narrow EN/ZH layout and introduction dialog fit a measured 424 CSS-pixel viewport with no horizontal overflow. The browser clamped a requested 390px override to 424px, so this follow-up does not claim a fresh 390px device test. The temporary override was reset.
- Encoded review frames cover application steps, wait tails and title/end cards; the introduction has entry/midpoint/exit frames for all eight scenes. Full decoding, caption bounds, HTTP byte ranges and final audio measurements are recorded externally. Final integrated levels range from -16.46 to -15.99 LUFS, with measured true peaks at or below -1.02 dBTP. Voice preference remains human-selected; speech recognition and level checks do not establish subjective delivery quality.
- The website build, published-media metadata gate and four Sites tests pass. The tracked privacy scan includes the new introduction component; diff secret scanning passes. The original workspace's 111 protected files, including 106 benchmark files, and its staged/unstaged patches remain byte-identical.
- Removed the obsolete preload of the previous decorative hero; the current responsive WebP retains its own high fetch priority.

Evidence is under `<external-review>/demo-refresh-v3/qa/` and the corresponding external introduction review directory. Original recordings and earlier voice drafts are retained outside Git. Final publication and human review remain pending.

## Personal welcome revision

This revision supersedes the initial introduction voice and illustration interaction. The homepage introduction uses Aaron's existing approved personal voice, with a first-person conversational script about the work problem behind Aaron Skills, the methods he collected, the released Demo bundle and an invitation to explore. Its measured length is 51.968 seconds. The previous Liam introduction is retained externally. All eight application examples remain byte-identical and continue using Liam.

The Guided Video illustration is now static. Its click overlay and associated CSS were removed; the text introduction button is the sole homepage video entry. The text button opens the new personal welcome and Escape closes it. Browser playback reached the end without a media error. The existing voice profile and shared runtime defaults were not changed.

Full decoding, 25 caption cue bounds, fast-start delivery, range requests and the silent ending passed. Measured final narration is -16.17 LUFS / -4.44 dBTP, with the last 0.8 seconds at -91 dB mean. All 24 encoded scene review frames were inspected. Technical checks and the previously approved voice identity do not imply human acceptance of this new delivery.

Scripts, the personal voice configuration, audio, media and evidence remain outside Git, under `<external-review>/demo-refresh-v3/intro-aaron/`. The original benchmark and protected workspace remain byte-identical. The website build and existing Sites tests passed. This remains a local review; no commit, push, merge, media upload or production deployment was performed for this revision.

### Immediate speech opening

The personal welcome now places narration at 0.2 seconds instead of 2.2 seconds. The first audible 20ms window measures 0.24 seconds at a -40 dB RMS threshold. All 25 captions and scene cues move forward by two seconds; the same recorded narration take is retained. The previous master remains archived externally. New duration is 49.984 seconds; measured delivery is -16.18 LUFS / -4.42 dBTP, with the ending still silent. The eight demonstration exports remain unchanged. Decode, caption bounds and local playback checks pass; this is still a local review.

## Clean delivered films

The user explicitly rejected visible production-process labels. Film now defaults to no AI Narration, AI-generated, Local Review, draft or tool watermarks. The shared renderer applies this across plain, branded and presentation paths; a separate explicit narration-notice option and brand opt-in remain available. Provider metadata and QA state stay in external records. The homepage introduction's manual footer was removed, and its embedded application screenshots and clip now use clean renders as well.

All eight examples were rendered from the same passed captures using imported copies of their existing narration. Delivered AAC streams and VTT files are byte-identical to the previously accepted versions; no provider request, new business action or benchmark change was needed. Native title/body/outro review frames and all introduction scene contacts were inspected. The local catalogue points to separate clean exports, retaining previous masters externally. Player metadata names the voice without an AI-generation/review tag.

The complete deterministic repository checks, 83 walkthrough tests (including notice opt-in and actual caption-markup regression checks), website build, Sites tests, privacy scan and diff secret scan pass. The changed runtime was exported and installed into an isolated external host, and its real capture/render/page smoke passed. Review evidence is under `<external-review>/demo-refresh-v3/qa-clean/`. This remains a local review; no public upload or production deployment was performed.


## Publication of the accepted introduction and narrated cuts

The public catalogue now contains the reviewed Aaron welcome and eight clean
Liam-narrated examples, delivered from the dedicated media store. The introduction
is available in production through the text button, without the development
proxy. Its actual script and personal voice settings are not included in source.
The new expandable script is a separately authored fictional reference-library
example, with approximate beats and a brief for requesting a draft. It does not
claim to be a transcript or runnable recording adapter. Existing benchmark source
and results are unchanged.
