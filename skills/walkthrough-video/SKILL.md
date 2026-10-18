---
name: walkthrough-video
description: Render an existing passed application capture into a guided MP4 with captions, highlights, chapters, and optional narration. Use for demo rendering and caption, highlight, or narration revisions; reuse the capture for presentation-only changes.
---
# Walkthrough video

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), FFmpeg, and the installed Bun and Remotion runtime. Generated provider narration needs a user-owned account; silent and imported-audio rendering do not.

Use `aaron-demo render <run-folder> --stills`. If the CLI is missing, follow the repository installation guide; copying this instruction folder alone does not install the renderer.

Read `aaron-demo docs capture-contract` for input details and `aaron-demo docs guided-demo` for review criteria. Render only `capture.json` with `status: passed`. If the input failed, report the failed step; use demo-capture to repair and record again when available.

Rendering is silent by default. When narration is requested, use `--narrate` for concise lines or `--script <run-folder>/narration.json` for a supplied conversational script. Read `aaron-demo docs narration` for user-owned key and voice configuration. Confirm any missing voice or spending authorization before a provider call; never use an author's personal voice or account by default.

For branded packaging, read `aaron-demo docs video-presentation`. Choose `--template minimal|professional|showcase` or an external `--presentation` configuration and add `--cover` for PNG/WebP share images. Keep the app viewport intact and brand within the caption band. Use a separate output directory per variation. For supplied narration use `--audio <external-manifest.json>`; do not request a provider account for an import. Qwen TTS is a reserved interface, not a working backend. Never silently substitute a voice/provider. Review imported/generated audio as well as the picture.

Reuse the passed capture for caption, highlight, narration, script, or language-only revisions, including fixes found during the first visual review. Use `aaron-demo inspect <run>` to read saved evidence/geometry. For caption/highlight edits, read `aaron-demo docs presentation-revisions`, create a derivative with `aaron-demo revise <run> <patch.json> --out <new-run>`, then render it. Prefer saved `focusTargets` over another UI visit to measure boxes. Do not replay business writes to change presentation metadata. Preserve the original capture and every prior take; rerun capture only when the UI evidence or actions need to change. User scripts and output stay outside Git repositories.

Inspect every held-frame still and the end of every wait. Captions must match visible evidence; reject loading, error, obscured, or unintended personal-data frames. Report the MP4, chapters, and any remaining limitations. Quality changes belong in the common renderer so later videos inherit them.

Use paste-ready-update for an optional update page if installed. The user sends or publishes the result unless they explicitly authorize delivery.
