---
name: demo-capture
description: Record a real web application's feature walkthrough or step screenshots using a project adapter. Use for product demo recording; caption, highlight, or narration edits to an existing capture belong to walkthrough-video.
---
# Capture

Invocation ID: `demo-capture`. The runtime and command names remain unchanged.

At the start of a new task, run `aaron-demo update --background` if the CLI is available. This starts the configured version check without waiting; continue the task. Relay any update notice once, and use `aaron-demo update` for the change summary. Larger changes need the user's choice; never add `--yes` on their behalf. Updates do not authorize publishing or provider spending.

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), Node 22+, Chromium, and local filesystem access.

Use the installed `aaron-demo` CLI. If it is unavailable, explain that this skill needs the Demo runtime and follow the repository installation guide; do not invent a recording substitute. `aaron-demo docs installation` and `aaron-demo docs project-adapters` provide setup and adapter details when the CLI is installed.

1. Identify the feature, target application, environment, and intended evidence from the user's brief. Reuse `<project>/demo-capture/config.mjs` and `walks/*.mjs`. If absent, author an adapter for the actual UI using `aaron-demo docs project-adapters`; inspect labels and behavior first.
2. Run `aaron-demo capture --project <project> --list` to inspect walks and environment flags.
3. Capture with `aaron-demo capture --project <project> --env <env> --walk <walk>`. A real sign-in is done by the user in the visible browser; warn them when a sign-in window may open. Never type their credentials.
4. Inspect `capture.json`. A failed run is evidence to fix the walk, not a deliverable video. For a passed run, hand off to the companion walkthrough-video skill for its cover/body/brand selection and static-preview checkpoint before narration or full rendering. Reuse accepted presentation choices; capture success alone is not a presentation choice.

Decide masking from the user's intent and relevant project context. Proceed autonomously without extra privacy questions when no concrete signal calls for masking; internal demos and declared mock/public data normally need none. Dev/UAT or financial-looking fields alone do not trigger a question. Reuse prior choices and later corrections. For explicit masking needs, project rules or clear real-data exposure, read `aaron-demo docs data-masking` and carry the scope into Film. Ask only about a consequential ambiguity; keep live secrets out of deliverables. Masking adds no recording or publishing permission.

Read `aaron-demo docs guided-demo` before writing a walk. Separate show, click, wait, and result steps. Wait for settled UI, outline the evidence, assert any count or claim with the injected `checks` helpers (see project-adapters; exact scoped fields, never numeric substring matching), and keep captions short. Record one topic per walk. In `setup`, establish and assert the starting view rather than assuming remembered tabs/filters reset. Use `rec.click` for actions and `rec.reveal` before showing an offscreen target; scope duplicate controls to their intended region.

Carry must-show scenes from the current brief and accepted conversation into a short coverage matrix: scene, intended screen, evidence and capture step ID. A completed record does not replace the recipient's interaction or confirmation preview. Explicitly report unavailable sessions/states; resolve them or agree on a clearly identified synthetic fixture. Keep Dev/local/production, previews, prior results and new writes distinct. Record omissions as explicit exceptions in the plan and delivery report. The checklist authorizes no new business writes and does not change any capture guard.

Use the shared `rec.show` declaration for checked result fields: it verifies their values, highlights the whole group and saves named geometry. For first-pass caption/highlight refinements on correct UI evidence, use `aaron-demo inspect` and `revise` on that capture; an initial visual review is not a reason to replay the business flow. See `aaron-demo docs presentation-revisions`.

Sessions and all captured screens stay outside Git repositories. Keep host restrictions and HTTP guards enabled. Approve host/exception changes with the user before changing them. A production run requires the user's go-ahead for that run before adding `--prod-go-ahead`; write-gated non-production walks similarly require `--write-go-ahead`. Check whether the walk writes and explain it. Sign-in alone needs no recording go-ahead.

Do not send the video or publish it unless explicitly asked. Language follows the user's requested delivery language. For screenshots and a pasteable message, use paste-ready-update if installed, or report that the optional delivery companion is missing.
