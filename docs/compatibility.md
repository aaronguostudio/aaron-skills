# Compatibility

v0.2.0 extends the macOS-only v0.1.0 release with Ubuntu and native Windows
runtime support and presentation-cover presets. Use v0.2.0 or current main for
these capabilities; the historical v0.1.0 tag does not contain them.

Compatibility has three separate gates: standard instructions, native discovery,
and a completed runtime workflow. None implies the others.

| Layer or platform | Current scope | Evidence and limits |
| --- | --- | --- |
| Skill format | Standard name/description and host-neutral body; optional OpenAI UI metadata | Structural checks and referenced docs closure |
| Runtime | Node 22+, Python 3.11+, FFmpeg/ffprobe; pinned Bun, Remotion and Chromium | Exported installation and deterministic tests |
| macOS arm64 | Supported | Real Apple Silicon machine: installation, capture, revision, media/page/clipboard, headed synthetic sign-in and recovery; existing macOS behavior retained |
| Ubuntu 24.04 x64 | Supported runtime target | Full workflow in Ubuntu 24.04.4 container under x64 emulation on an ARM Mac; native runner results are reported separately in CI |
| Windows 11 x64, NTFS | Supported | Real Windows 11 Home laptop, ordinary user token, stock PowerShell 5.1; full workflow, private ACLs, paths with spaces/Chinese, recovery and native launcher |
| Cursor local | Installer registration in `.cursor/skills` | Directory/launcher checks; native Cursor discovery and model-driven workflow require separate acceptance |
| Codex local / Claude Code local | Installer registration supported | Original macOS native task results below; new Windows/Linux LLM-host invocation has not been certified |
| macOS Intel | Unverified on hardware | Do not treat arm64 results as Intel certification |
| Windows ARM, older Windows, WSL, other Linux distributions/filesystems | Unverified | Windows requires x64; Linux installer targets Ubuntu 24.04; private Windows state requires enforceable NTFS ACLs |

See [verification](verification.md) for exact environments, acceptance scope and
[three-platform CI](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml).
CI uses Node 22 and Python 3.11 on macOS 15, Ubuntu 24.04 and Windows Server 2022;
a green run verifies that revision, not every OS version or host model.

Windows uses native Python/Node/Bun/Chromium, copied skill registrations and a
`.cmd` launcher. WSL, Bash, Developer Mode, symlink privileges and administrator
rights are not required for the runtime. The system prerequisites must already
be installed. POSIX installs retain their symlink registrations. See
[installation and recovery](installation.md).

Cloud sessions do not automatically inherit a local runtime or personal skill
folders. Copying SKILL.md or configuring a model API endpoint is insufficient.
The host needs local shell/filesystem access, permission to launch Chromium and
render media, and a way to inspect screenshots/frames. Adapters are trusted code.
No host-specific hooks, plugins or subagents are required by the common workflow.

Codex and Claude discover skills differently; use the appropriate installer host
option, then verify native invocation in a new session. `doctor` checks the
installation and registrations, not model decisions. DeepSeek, GLM, MiniMax and
additional harness certifications remain unverified. The initial macOS native
host tasks are historical v0.1.0 evidence, not new cross-platform model tests.

References: [Codex](https://developers.openai.com/codex/skills),
[Claude Code](https://code.claude.com/docs/en/skills), and
[Agent Skills](https://agentskills.io/specification).
