# Aaron Skills v0.4.0

Film can guide first-time narration setup without requiring a user-written JSON
file or an ElevenLabs account. `aaron-demo voice setup` offers ElevenLabs account
voices, Google Gemini, an OpenAI-compatible company endpoint, optional free local
Kokoro, imported audio and silent output. Save a named narrator, choose a default,
check configuration and generate a short explicit sample before a full render.

Existing ElevenLabs profiles, speaking-speed behavior and cached clips remain
compatible. Keys entered in the terminal are hidden and stored separately with
private file permissions. Concurrent configuration updates are serialized, and
provider audio is decoded explicitly as WAV or MP3 rather than auto-detecting
playlists. Failed generation retains completed clips and never chooses another
voice, provider or account automatically.

**Google and ElevenLabs real-account speech generation remains unverified.**
Their request, voice-list and failure contracts have mocked coverage; no paid
account access, quota, plan eligibility or subjective voice quality is certified.
The company adapter passed a loopback protocol test, not a production company
service acceptance. Kokoro passed real offline English synthesis and an installed
narrated video on macOS arm64. Native Windows/Linux Kokoro inference and other
languages are outside that acceptance scope. See [narration](narration.md) and
[validation](narration-validation.md) for setup and precise evidence.

Original skill invocation IDs, presentation approval checkpoints and capture
boundaries are preserved. Configuration, keys, models and generated media stay
outside the public release. Optional local installation downloads model files and
Python dependencies into a separate environment; see [third-party notices](../THIRD_PARTY_NOTICES.md).

---

# Aaron Skills v0.1.0

Historical v0.1.0 scope. For the current checkout’s platform support, see
[compatibility](compatibility.md) and [verification](verification.md).

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
