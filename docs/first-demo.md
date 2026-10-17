# First local demo

Run `aaron-demo smoke` after installation. It creates an isolated public fixture outside the repository, records its real browser UI, and prints an MP4, update page, and JSON report. It contacts no client application and requests no paid narration.

For an application, inspect `demo-capture/config.mjs` and `walks/*.mjs` in that application's repository. Use `aaron-demo capture --project <project> --list`, choose the actual environment and walk, and record. A user signs in in the visible browser when needed. Run `aaron-demo docs project-adapters` to author a new adapter.

Render a passed capture with `aaron-demo render <run> --stills`. Review every held frame and the end of each wait. Then prepare `message.md` with screenshots and an optional video line; run `aaron-demo page <message.md> --out <message.html>`. Review locally before sending.

When that first review finds a caption or highlight issue but the UI evidence/actions are
correct, keep the capture. `aaron-demo inspect <run>` reads its named target geometry and
coverage issues without opening the app. Apply a [presentation patch](presentation-revisions.md)
with `revise`, then render the derivative. Do not record another business take just to change
those fields. New adapters should use the shared `rec.show` declaration in
[project-adapters](project-adapters.md#checked-evidence-and-reusable-focus) so checked metric
cards are grouped and their geometry is saved for this review loop.

The page generator reads the video from Markdown frontmatter, not a raw HTML video tag.
Keep the referenced MP4 beside the message and put screenshots under `shots/`:

```markdown
---
title: Feature update
lang: en
video: walkthrough.mp4 | Short feature walkthrough
---
Hi team,

Here is what changed and how to try it.

![The visible result](shots/result.png)
```

Check the rendered page in a browser. Copy text and screenshots from its buttons; attach
the MP4 separately when sending the message. Use a supplied signature only.
