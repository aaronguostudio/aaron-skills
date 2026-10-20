---
name: walkthrough-video
description: Choose and customize presentation covers, draft walkthrough scripts, and render passed application captures into guided MP4s with captions, highlights, chapters, and optional narration. Reuse captures for presentation revisions.
---
# Film

Invocation ID: `walkthrough-video`. The runtime and command names remain unchanged.

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), FFmpeg, and the installed Bun and Remotion runtime. Generated provider narration needs a user-owned account; silent and imported-audio rendering do not.

For a walkthrough, use `aaron-demo render <run-folder> --stills`. If the CLI is missing, follow the repository installation guide; copying this instruction folder alone does not install the renderer.

At the start of a new video or presentation-cover task, read `aaron-demo docs cover-library` and use `aaron-demo cover --list`. Work through the conversation: use the audience, content and supplied brand to recommend about three distinct cover styles, with a visible preview, name/stable ID and a short reason for each. Put the best match first. The gallery and its editor are optional browsing tools; do not require the user to open a page, fill a form or run commands. Keep an existing selection, skip covers when unwanted, and choose without another question when the user delegates design. Offer the shortlist before the final video render; script/capture preparation can continue while a choice is pending.

When the title/brand are available, make the shortlist using their content with `aaron-demo cover --presentation <external.json> --preset <id> --out <new-directory>/cover.png`, rather than asking them to imagine sample wording. Use a few gallery previews first when the brief is still provisional. Accept a reply by number, name or ID. The agent writes and preserves the external configuration, fills supplied subtitle, Logo/brand, presenter, date and colors, and omits optional details not provided. Inspect the actual PNG/WebP before delivery and keep the selected configuration for the walkthrough. Cover-only work needs no app capture or narration account. Ordinary text/Logo/palette revisions use bundled clean artwork and live text without a new image-generation call.

For video work, read `aaron-demo docs capture-contract` for input details and `aaron-demo docs guided-demo` for review criteria. Render only `capture.json` with `status: passed`. If the input failed, report the failed step; use demo-capture to repair and record again when available.

For script drafting or a requested explanation style, read `aaron-demo docs narrative-styles`. Users can give a brief, notes or a script; do not require them to write finished narration. Choose among quick demo, release update, stakeholder walkthrough, task tutorial and training lesson by viewer outcome. Keep purpose, tone, length, visual template and voice separate. Ground each line in saved evidence or supplied facts; missing footage is a capture gap, not permission to invent a result. Before recording, produce only a provisional outline with the needed evidence.

Rendering is silent by default. When narration is requested, use `--narrate` for saved narration/captions or `--script <external-script.json>` for a drafted or supplied script in any mode. Read `aaron-demo docs narration` for user-owned key and voice configuration. Confirm any missing voice or spending authorization before a provider call; never use an author's personal voice or account by default. Script drafting itself requires no voice account or provider request.

For branded packaging, read `aaron-demo docs video-presentation`. Choose `--template minimal|professional|showcase` or an external `--presentation` configuration and add `--cover` for PNG/WebP share images. Keep the app viewport intact and brand within the caption band. Use a separate output directory per variation. For supplied narration use `--audio <external-manifest.json>`; do not request a provider account for an import. Qwen TTS is a reserved interface, not a working backend. Never silently substitute a voice/provider. Review imported/generated audio as well as the picture.

Keep delivered videos and covers free of process labels such as "AI Narration", "AI-generated", "Local Review", "Draft" or tool watermarks by default. Add such text only when the user explicitly requests it; `--narration-notice` enables the narration notice. Keep provider provenance and review status in external manifests/QA notes, not burned into the film.

Reuse the passed capture for caption, highlight, narration, script, or language-only revisions, including fixes found during the first visual review. Use `aaron-demo inspect <run>` to read saved evidence/geometry. For caption/highlight edits, read `aaron-demo docs presentation-revisions`, create a derivative with `aaron-demo revise <run> <patch.json> --out <new-run>`, then render it. Prefer saved `focusTargets` over another UI visit to measure boxes. Do not replay business writes to change presentation metadata. Preserve the original capture and every prior take; rerun capture only when the UI evidence or actions need to change. User scripts and output stay outside Git repositories.

Inspect every held-frame still and the end of every wait. Captions must match visible evidence; reject loading, error, obscured, or unintended personal-data frames. Report the MP4, chapters, and any remaining limitations. Quality changes belong in the common renderer so later videos inherit them.

Use paste-ready-update for an optional update page if installed. The user sends or publishes the result unless they explicitly authorize delivery.
