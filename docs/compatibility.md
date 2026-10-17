# Compatibility

Compatibility has three separate gates: standard instructions, native discovery,
and a completed runtime workflow. None implies the others.

| Layer | v0.1.0 scope | Evidence |
| --- | --- | --- |
| Skill format | Standard name/description and host-neutral body; optional OpenAI UI metadata | Structural checks and referenced docs closure |
| Runtime | Node 22+, Python 3.11+, FFmpeg, pinned Bun/Remotion and Chromium | Deterministic tests and exported-install smoke |
| macOS arm64 | Initial supported runtime target | Available development machine; isolated fresh release |
| Codex local | Native `.agents/skills` registration | See verification.md for the measured discovery/task result |
| Claude Code local | Native `.claude/skills` registration | See verification.md for the measured discovery/task result |
| macOS Intel | Not verified on hardware | Do not treat arm64 results as Intel certification |
| Other OS/harness/model combinations | Phase 2; unverified | No support claim |

Cloud sessions do not automatically inherit a local runtime or personal skill
folders. Copying SKILL.md or configuring a model API endpoint is insufficient.
The host needs local shell/filesystem access, permission to launch Chromium and
render media, and a way to inspect screenshots/frames. Adapters are trusted code.
No host-specific hooks, plugins or subagents are required by the common workflow.

Codex and Claude discover skills differently; use the appropriate installer host
option, then verify native invocation in a new session. `doctor` checks the
installation and registrations, not model decisions. DeepSeek, GLM, MiniMax and
additional harness certifications are intentionally deferred.

References: [Codex](https://developers.openai.com/codex/skills),
[Claude Code](https://code.claude.com/docs/en/skills), and
[Agent Skills](https://agentskills.io/specification).
