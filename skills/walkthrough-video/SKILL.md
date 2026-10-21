---
name: walkthrough-video
description: Choose and customize presentation covers, draft walkthrough scripts, and render passed application captures into guided MP4s with captions, highlights, chapters, and optional narration. Reuse captures for presentation revisions.
---
# Film

Invocation ID: `walkthrough-video`. The runtime and command names remain unchanged.

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), FFmpeg, and the installed Bun and Remotion runtime. Generated provider narration needs a user-owned account; silent and imported-audio rendering do not.

## Confirm the presentation before production

Read `aaron-demo docs video-layouts` (the “Presentation decision and preview” workflow) before a new video. Keep cover, opening card, video-body layout and corporate identity as separate decisions. A selected cover, an old render, a template default or “make a video” does not approve a decorated body or company branding.

Carry forward explicit choices from the current brief or an approved series. For missing choices, offer a short recommendation in conversation: cover/no cover, body layout, and the actual logo/colors with their source. For internal updates and training, put **native video + bottom caption bar** (`plain-caption`) first; offer `plain-transcript` for spoken notes and a designed frame when useful. Corporate/product work needs its own confirmed identity; never borrow the author's or tool's brand. Show the real mark and palette for confirmation, including where they will appear. If unavailable, ask for the brand pack or an explicit omission; do not invent it.

Read `aaron-demo docs cover-library` and use `aaron-demo cover --list` when a cover is wanted. Offer up to three relevant styles with visible previews, stable IDs and short reasons, using the user's title/brand when available. The agent writes the external configuration; the user can reply by number/name or in plain language. No gallery visit, form or JSON authoring is required. Cover-only work needs no capture or voice account; use `aaron-demo cover --presentation <external.json> --preset <id> --out <new-directory>/cover.png`. Inspect the image and reuse bundled artwork/live text for ordinary logo, text or palette revisions without a new image-generation call.

Before new voice synthesis or full MP4 rendering, show the actual cover (if wanted) **and a representative body still** from `--preview`, with logo/colors, application scale and opening/outro choices visible or stated. Ask for one consolidated confirmation of unresolved presentation choices and wait. Continue permitted capture/script preparation while waiting. Silence is not a choice. If the user explicitly supplies the complete presentation, reuses an approved series or delegates those decisions, inspect the previews and proceed within that scope without another approval round. An audio/caption-only revision keeps accepted visuals; a cover-only change does not change the body.

Save the selected configuration, preview paths and the user's selection/delegation in the external run's presentation brief so a later agent can reuse them. Material changes to the accepted layout or brand need a new preview; technical rerenders do not. The CLI validates geometry/media but cannot establish user acceptance: the agent owns this checkpoint. For a walkthrough, render the approved configuration with `aaron-demo render <run-folder> --presentation <external.json> --stills`. If the CLI is missing, follow the installation guide; copying a skill directory does not install the renderer.

For video work, read `aaron-demo docs capture-contract` for input details and `aaron-demo docs guided-demo` for review criteria. Render only `capture.json` with `status: passed`. If the input failed, report the failed step; use demo-capture to repair and record again when available.

For script drafting or a requested explanation style, read `aaron-demo docs narrative-styles`. Users can give a brief, notes or a script; do not require them to write finished narration. Choose among quick demo, release update, stakeholder walkthrough, task tutorial and training lesson by viewer outcome. Keep purpose, tone, length, visual template and voice separate. Ground each line in saved evidence or supplied facts; missing footage is a capture gap, not permission to invent a result. Before recording, produce only a provisional outline with the needed evidence.

Rendering is silent by default. When narration is requested, use `--narrate` for saved narration/captions or `--script <external-script.json>` for a drafted or supplied script in any mode. Read `aaron-demo docs narration` for user-owned key and voice configuration. Confirm any missing voice or spending authorization before a provider call; never use an author's personal voice or account by default. Script drafting itself requires no voice account or provider request.

For branded packaging, read `aaron-demo docs video-presentation` and `aaron-demo docs video-layouts`. Resolve approved corporate/product assets from the supplied pack, owning app/design system or a confirmed visible mark; distinguish tenant/user avatars and tool branding. Never redraw a logo. Record source/role/verification outside Git. If unresolved, explain the gap and make omission or a monogram explicit. Review identity, proportions, clear space and contrast on cover, body, outro and share image; select light/dark variants and suppress duplicate brand text for a wordmark.

Choose `--template minimal|professional|showcase` or an external `--presentation` configuration and add `--cover` for PNG/WebP share images. New version-2 configurations provide a shared theme and top/bottom/left/right screen layouts with complementary caption or full-transcript panels. Keep existing version-1 choices compatible. Use `--preview --cover` for the presentation checkpoint above; omit `--cover` when no cover is wanted. Reconcile the palette across cards, annotations, focus fill and cursor; do not recolor the application. Preserve native evidence and use only uniform containment. Use a separate output directory per variation. For supplied narration use `--audio <external-manifest.json>`; do not request a provider account for an import. Qwen TTS is a reserved interface, not a working backend. Never silently substitute a voice/provider. Review imported/generated audio as well as the picture.

For a new branded video, author a version-2 configuration unless the user needs legacy behavior. A cover-only v1 file from the gallery can seed it: retain the chosen cover/content and intentional overrides, resolve logo provenance and one palette, then preview both surfaces. Do not let an unrelated template default supply the body color. Keep an existing v1 video's behavior until its presentation is deliberately revised.

Body composition is independent of cover artwork. Use `plain-caption` for an internal video's simple bottom bar, `plain-transcript` for compact spoken notes, or a confirmed `studio-*` frame for designed packaging. Six studio art directions share one geometry; they are not six layout choices. Utility layouts such as `screen-first`, `lesson-notes` and `native-detail` remain available. Compare the same settled, permitted workflow and show output dimensions/application scale. Keep the application readable and allow fullscreen inspection; empty test blocks are not design previews. Explicit layout fields can override a preset.

Keep delivered videos and covers free of process labels such as "AI Narration", "AI-generated", "Local Review", "Draft" or tool watermarks by default. Add such text only when the user explicitly requests it; `--narration-notice` enables the narration notice. Keep provider provenance and review status in external manifests/QA notes, not burned into the film.

Reuse the passed capture for caption, highlight, narration, script, or language-only revisions, including fixes found during the first visual review. Use `aaron-demo inspect <run>` to read saved evidence/geometry. For caption/highlight edits, read `aaron-demo docs presentation-revisions`, create a derivative with `aaron-demo revise <run> <patch.json> --out <new-run>`, then render it. Prefer saved `focusTargets` over another UI visit to measure boxes. Do not replay business writes to change presentation metadata. Preserve the original capture and every prior take; rerun capture only when the UI evidence or actions need to change. User scripts and output stay outside Git repositories.

Inspect every held-frame still and the end of every wait. Captions must match visible evidence; reject loading, error, obscured, or unintended personal-data frames. Report the MP4, chapters, and any remaining limitations. Quality changes belong in the common renderer so later videos inherit them.

Before delivery, reconcile every must-show scene with capture step/evidence IDs or an explicit exception. A signed-result screen is not evidence of a recipient signing journey; a confirmation preview is not submission or sealing. Do not narrate around missing footage. Layout/theme-only revisions reuse passed evidence and unchanged audio, without repeating application writes or voice synthesis.

Use paste-ready-update for an optional update page if installed. The user sends or publishes the result unless they explicitly authorize delivery.

### Plain video is a first-class choice

Offer the same simple presentation quality without decorative artwork. When the
user asks for plain/original/no-background video, use `plain-caption` (native
recording plus one short bottom caption) or `plain-transcript` (native recording
plus a compact bottom transcript band). No padding, stage art or forced opening
cover. Transcript text comes from saved/imported narration, with caption fallback
when no narration exists. Paginate long text over time; do not reserve a large
blank panel or invent spoken wording/timestamps.

For designed combinations, `studio-cobalt`, `studio-sand`, `studio-chrome`,
`studio-midnight`, `studio-paper`, `studio-vermilion` load matched cover and body
palettes automatically; explicit brand/theme/cover fields override defaults.
The gallery at https://skills.aaronguo.com/layouts shows six art directions plus
two plain choices, using a fictional product. Use the presentation checkpoint above; a matched treatment is an option, not permission to extend cover artwork into an internal video. The browser and CLI are optional, not a required user step.
