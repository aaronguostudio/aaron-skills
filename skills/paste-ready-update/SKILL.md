---
name: paste-ready-update
description: Prepare a customer or teammate update, release note, handoff, or how-to as a copyable HTML page with screenshots. Use for paste-ready communication; record a demo only when the user requests or accepts it.
---
# Share

Invocation ID: `paste-ready-update`. The runtime and command names remain unchanged.

Runtime requirements: Requires the aaron-demo Demo bundle, a verified platform (see `aaron-demo docs compatibility`), Python 3.11+, and Pillow. The generated page is a local HTML file.

Prepare a message the user can review, paste, and send. Identify the reader, relevant change, destination, language, and signature from the brief. Ask only for missing information that affects the message.

If the brief supplies no signature, omit it. Do not infer an author from a username, filesystem path, tool name, or example. Do not add a meeting offer or other commitment the user did not request.

Inspect every screenshot before including it. Crop or annotate a copy with `aaron-demo mark <input.png> <output.png> --crop x0,y0,x1,y1 --box x0,y0,x1,y1:1` when useful. Check wording and numbers against visible evidence. Leave originals intact.

Write `message.md` next to its `shots/` folder, outside Git repositories when it contains real captures. Use this format:

```markdown
---
title: Feature update
hint: Copy the text and paste each screenshot under its step.
lang: en
video: walkthrough.mp4 | Feature walkthrough
---
Hi team,

Describe what the reader can now do and where it was verified.

## How to try it

1. Give one action using the actual UI label.

![The visible result](shots/result.png)
```

Physical line wraps within a paragraph become spaces. Use a blank line for a new paragraph; two trailing spaces or a trailing backslash for an intentional line break (for example, a supplied signature or address). The supported subset has headings, lists, quotes, inline code, links, and images; fenced code blocks are not supported.

The `video` line is optional. Build with `aaron-demo page <message.md> --out <message.html>`. If the CLI is missing, use the repository installation guide. Check the generated text, images, and video links.

For a requested new recording, use demo-capture and walkthrough-video if installed. Reuse an existing video when sufficient. Backend-only updates do not need a UI recording. Do not turn a simple text-only request into a recording task.

For Teams, copy text then paste each image under its step. For email or documents, try Copy text + screenshots; the user attaches videos separately. Open the local page for review and report its location. Do not send, post, or upload it unless explicitly authorized.
