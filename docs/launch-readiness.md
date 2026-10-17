# v0.1.0 launch readiness

Historical v0.1.0 scope. For the current checkout’s platform support, see
[compatibility](compatibility.md) and [verification](verification.md).

The goal is a reviewable first open-source release candidate, not an unlimited
feature or compatibility project. Publication is a separate final action after
reviewing the candidate. Keep the original development history private.

## Phase 1 scope

- Demo only: capture, guided silent video, screenshots, presentation revisions,
  and a local update page. Optional user-owned ElevenLabs narration remains
  available; normal validation never calls a paid provider.
- macOS with Python 3.11+, Node 22+, FFmpeg and Git. Test on the available macOS
  arm64 machine and disclose that Intel and a second clean machine are untested.
- Codex and Claude Code local registration and one realistic public-fixture
  workflow per host. Record actual host/model versions and limitations.
- A single repository with shared runtime and standard SKILL.md entry points.

## Acceptance gates

1. The seven confirmed release-review findings are fixed with focused regression
   checks: render validation entry points, vulnerable dependencies, publication
   privacy, private capture files, non-billing dry-run, host installation, and
   bundled documentation closure.
2. One documented installation prompt handles prerequisites, target-host
   registration, PATH guidance, doctor and public smoke. Existing unrelated
   skills/configuration are preserved. Repair, rollback and uninstall have clear
   behavior. System/package-manager changes remain explicit.
3. A single maintainer check command runs deterministic tests and structural
   checks. CI uses that command; paid model evaluations remain opt-in.
4. A fresh exported installation in an isolated home/path containing spaces
   passes doctor and real capture -> MP4 -> screenshot/update-page smoke. Both
   supported hosts discover the installed skills and complete the fixture task.
   Verify presentation revisions without replaying business writes.
5. A separate explicit source export contains the public implementation, tests,
   examples and docs, but no internal provenance, personal paths, private logs,
   generated recordings or original Git history. Scan its files and intended
   public history for secrets and private identifiers. Preserve accurate license
   attribution and branding.
6. README, compatibility, security reporting, contribution instructions, notices,
   changelog and release notes agree with observed evidence. No unsupported
   platform or general model-quality claims.

## Stopping rule

Stop when these gates pass and the local candidate is ready for the owner's
publication review. Record the candidate revision and evidence. Do not keep
adding features, polishing unrelated code or repeating successful evaluations.
Allow one initial task and one targeted retry per supported host; persistent
authentication or external-service blockers are reported explicitly. External
human acceptance is a documented follow-up, not an excuse for endless retries.

## Phase 2 / excluded

DeepSeek, GLM, MiniMax and other model/provider combinations; Grok, Qwen,
OpenCode, Gemini, Cursor and other additional harness certifications; Linux,
Windows/WSL; hosted SaaS or one-click cloud deployment; new image/asset skills;
plugin marketplaces; live paid narration certification; broad refactors and
repeated performance comparisons.

## Local acceptance record

The v0.1.0 candidate has completed the local scope above. See verification.md
for measured checks and explicit limitations, and releasing.md for the remaining
owner review/publication steps. Remote CI and private vulnerability reporting
activation are verified only after authorized publication. No additional Phase 2
work is required to finish this local candidate.
