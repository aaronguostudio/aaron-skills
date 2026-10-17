# Aaron Skills v0.1.0

A local toolkit for turning a real web feature into a guided demo and a useful
update. Three standard Agent Skills share the same capture, render and delivery
implementation:

- **Demo Capture** records a project adapter in real Chromium, with environment,
  host and HTTP guards and explicit write/production gates.
- **Walkthrough Video** makes a silent MP4 with captions, click outlines, named
  evidence highlights, chapters and review stills. Presentation corrections reuse
  a passed capture. Optional narration uses the user's own ElevenLabs account.
- **Paste Ready Update** builds a local copyable HTML message with screenshots
  and video links for the user to review and send.

The initial target is macOS with local Codex or Claude Code. Setup supports host
registration, prerequisite guidance, doctor, a public smoke check, repair and
managed-link uninstall. Run outputs stay outside Git. Automatic screen redaction
is not provided, and adapters are trusted code.

This release does not certify other operating systems, harnesses or model
providers. DeepSeek, GLM and MiniMax are Phase 2. Local acceptance evidence and
limitations are in [verification](https://github.com/aaronguostudio/aaron-skills/blob/v0.1.0/docs/verification.md).
See the [README](https://github.com/aaronguostudio/aaron-skills/tree/v0.1.0#install)
for installation, [security policy](https://github.com/aaronguostudio/aaron-skills/blob/v0.1.0/SECURITY.md)
for private reporting, and [third-party notices](https://github.com/aaronguostudio/aaron-skills/blob/v0.1.0/THIRD_PARTY_NOTICES.md)
for dependency terms.

Built by [Aaron Guo](https://aaronguo.com), a product builder and engineer
exploring practical AI workflows. Original project code is MIT; dependencies
retain their own licenses.
