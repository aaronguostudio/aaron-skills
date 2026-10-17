# Install and recover

The current checkout supports macOS arm64, Ubuntu 24.04 x64 and native Windows 11
x64. The v0.1.0 tag remains macOS-only. See [compatibility](compatibility.md) for
measured environments and boundaries. Install as your ordinary user.

## Prerequisites

All platforms need Git, Python 3.11+, Node 22+ with npm, and FFmpeg/ffprobe on PATH.
The installer prepares pinned browser, video and Python dependencies in its own
runtime; it does not replace global packages or change model-provider settings.

- **macOS:** the optional `--install-prerequisites` flag installs missing tools
  through an existing Homebrew installation. It does not install Homebrew or
  request administrator access.
- **Ubuntu 24.04:** install Git, `python3-venv`, FFmpeg and Node 22+ beforehand.
  Do not assume the distribution's default Node meets that minimum. Chromium
  also needs system libraries. From the checkout, `npm ci --prefix packages/demo/capture`, then `node packages/demo/capture/node_modules/playwright/cli.js install-deps chromium` prepares this pinned browser's system dependencies;
  this system-package operation needs sudo. A desktop/display is required for
  interactive sign-in; CI uses Xvfb. `fonts-noto-cjk` supplies Chinese glyphs in
  rendered content. Setup reports missing prerequisites and never runs apt/sudo.
- **Windows:** use x64 Windows with a local NTFS runtime/state folder, native
  Python and Node distributions, and FFmpeg including ffprobe. Confirm `python --version`, `node --version`, `ffmpeg -version`, and `ffprobe -version` in the
  same terminal. Stock PowerShell 5.1 is sufficient. No WSL, Bash, Developer Mode
  or administrator token is needed. System package installation is manual.

## Standard setup

From the cloned checkout, choose the host (`codex`, `claude`, or `both`):

```sh
# macOS / Ubuntu
bash scripts/setup.sh --agent codex --smoke
```

```powershell
# Native Windows, ordinary PowerShell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 --agent codex --smoke
```

`Bypass` applies only to that PowerShell process; setup never changes the saved
execution policy, PATH or profiles. Organization policy can still restrict script
execution. The equivalent shared entry point is `python scripts/install.py` on
Windows or `python3 scripts/install.py` on POSIX, with the same options.

| Location | macOS / Ubuntu | Windows |
| --- | --- | --- |
| Runtime | `~/.local/share/aaron-skills/demo` | `%LOCALAPPDATA%\AaronSkills\demo` |
| Command | `~/.local/bin/aaron-demo` | `%LOCALAPPDATA%\AaronSkills\bin\aaron-demo.cmd` |
| Codex skills | `~/.agents/skills` | `%USERPROFILE%\.agents\skills` |
| Claude Code skills | `~/.claude/skills` | `%USERPROFILE%\.claude\skills` |

Add the printed command directory to your user PATH yourself if needed. Start a
new agent session to refresh discovery. Ask it to list Demo Capture, Walkthrough
Video and Paste Ready Update, then invoke one by name. `doctor` checks runtime
and registrations, not native model routing or host behavior.

`aaron-demo doctor` verifies installed files, tools and browser readiness.
`aaron-demo smoke` runs only a public loopback application and prints an MP4,
held-frame stills, update page and JSON report. Inspect the page and frames.
For your own app, use `aaron-demo docs project-adapters`.

## Isolated setup

Choose new paths outside source repositories. For example:

```sh
python3 scripts/install.py --agent claude --root /tmp/demo-test/runtime --skills-dir /tmp/demo-test/project/.claude/skills --bin-dir /tmp/demo-test/bin --smoke
/tmp/demo-test/bin/aaron-demo doctor
```

```powershell
$demoTest = Join-Path $env:LOCALAPPDATA 'Demo test'
python scripts/install.py --agent codex --root "$demoTest/runtime" --skills-dir "$demoTest/project/.agents/skills" --bin-dir "$demoTest/bin" --smoke
& "$demoTest/bin/aaron-demo.cmd" doctor
```

`--skills-dir` overrides one host directory and cannot combine with `--agent both`.
For normal use choose durable folders in a native project/user skill path.
Arbitrary directories are not automatically discoverable by a host.

## Upgrade, repair and rollback

Run setup again with the same path options. Content hashes identify releases;
dependencies are prepared before activation. POSIX activates a `current` symlink.
Windows uses `active.json`, a stable Python launcher and managed copies of the
three skills. Windows activation and registration updates roll back together on
failure; no symlink privilege is needed. Both platforms serialize installers.

Managed registrations survive adding another host. Unrelated commands/skills are
preserved; choose another directory or resolve the name conflict yourself.
Modified Windows copies are treated as user changes and block overwriting; do not
edit installed copies to maintain source changes. Update the checkout instead.

Run the shared installer with `--repair` and the same path options to prepare a
separate release before activation. Incomplete releases remain for diagnosis;
ready releases are retained. For rollback, rerun a previously verified compatible
source revision's installer with the same paths, then run doctor and smoke. Do
not move a release: virtual environments and launchers contain local paths. Do
not use the old macOS-only v0.1.0 installer to roll back Windows or Ubuntu.

## Uninstall

Run `aaron-demo uninstall`, or the shared installer with `--root <root> --uninstall`. Only still-managed registrations/launchers are removed; user
replacements survive. Runtime releases, browser caches, captures, sessions and
configuration are retained. Recordings normally live separately under
`~/.demo-capture` (also on Windows under the user home). Delete retained data only
after deciding it is no longer needed.

## Boundaries

Installation downloads public dependencies/browser binaries. Silent smoke needs
no account or API key. Real sign-in and optional paid narration are separate
later actions. Generic skill-folder installers do not install this runtime.
There is no hosted service or cloud deployment required by the Demo bundle.
