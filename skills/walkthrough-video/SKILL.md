---
name: walkthrough-video
description: Draft walkthrough scripts from a brief or existing capture, and render passed application captures into guided MP4s with captions, highlights, chapters, and optional narration. Reuse the capture for presentation-only revisions.
---
# Film

Invocation ID: `walkthrough-video`. The runtime and command names remain unchanged.

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), FFmpeg, and the installed Bun and Remotion runtime. Generated provider narration needs a user-owned account; silent and imported-audio rendering do not.

Use `aaron-demo render <run-folder> --stills`. If the CLI is missing, follow the repository installation guide; copying this instruction folder alone does not install the renderer.

Read `aaron-demo docs capture-contract` for input details and `aaron-demo docs guided-demo` for review criteria. Render only `capture.json` with `status: passed`. If the input failed, report the failed step; use demo-capture to repair and record again when available.

For script drafting or a requested explanation style, read `aaron-demo docs narrative-styles`. Users can give a brief, notes or a script; do not require them to write finished narration. Choose among quick demo, release update, stakeholder walkthrough, task tutorial and training lesson by viewer outcome. Keep purpose, tone, length, visual template and voice separate. Ground each line in saved evidence or supplied facts; missing footage is a capture gap, not permission to invent a result. Before recording, produce only a provisional outline with the needed evidence.

Rendering is silent by default. When narration is requested, use `--narrate` for saved narration/captions or `--script <external-script.json>` for a drafted or supplied script in any mode. Read `aaron-demo docs narration` for user-owned key and voice configuration. Confirm any missing voice or spending authorization before a provider call; never use an author's personal voice or account by default. Script drafting itself requires no voice account or provider request.

For branded packaging, read `aaron-demo docs video-presentation`. Choose `--template minimal|professional|showcase` or an external `--presentation` configuration and add `--cover` for PNG/WebP share images. Keep the app viewport intact and brand within the caption band. Use a separate output directory per variation. For supplied narration use `--audio <external-manifest.json>`; do not request a provider account for an import. Qwen TTS is a reserved interface, not a working backend. Never silently substitute a voice/provider. Review imported/generated audio as well as the picture.

Keep delivered videos and covers free of process labels such as "AI Narration", "AI-generated", "Local Review", "Draft" or tool watermarks by default. Add such text only when the user explicitly requests it; `--narration-notice` enables the narration notice. Keep provider provenance and review status in external manifests/QA notes, not burned into the film.

Reuse the passed capture for caption, highlight, narration, script, or language-only revisions, including fixes found during the first visual review. Use `aaron-demo inspect <run>` to read saved evidence/geometry. For caption/highlight edits, read `aaron-demo docs presentation-revisions`, create a derivative with `aaron-demo revise <run> <patch.json> --out <new-run>`, then render it. Prefer saved `focusTargets` over another UI visit to measure boxes. Do not replay business writes to change presentation metadata. Preserve the original capture and every prior take; rerun capture only when the UI evidence or actions need to change. User scripts and output stay outside Git repositories.

Inspect every held-frame still and the end of every wait. Captions must match visible evidence; reject loading, error, obscured, or unintended personal-data frames. Report the MP4, chapters, and any remaining limitations. Quality changes belong in the common renderer so later videos inherit them.

Use paste-ready-update for an optional update page if installed. The user sends or publishes the result unless they explicitly authorize delivery.
