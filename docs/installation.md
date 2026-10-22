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
| Cursor skills (`--agent cursor`) | `~/.cursor/skills` | `%USERPROFILE%\.cursor\skills` |

Use `--agent cursor` to register in Cursor's user skills directory, or add
`--skills-dir "/path/to/application/.cursor/skills"` for one project's registration.
`--agent both` retains its existing meaning: Codex and Claude Code. Add Cursor
by rerunning setup with the same runtime/bin paths and `--agent cursor`; existing
managed registrations are retained. See [Cursor's skill directories](https://cursor.com/docs/skills).
Registration is not certification of model routing; verify discovery in a fresh
Cursor session and complete a local workflow.

Node manager entry points (including npm symlinks) keep their dispatch names.
Run setup from the directory where your manager selects Node 22+; `doctor` checks
the saved npm entry point as well as Node. If a manager cannot run `npm ci`, repair
that manager/project selection before retrying; do not replace its symlink with
the dispatcher binary.

Add the printed command directory to your user PATH yourself if needed. Start a
new agent session to refresh discovery. Ask it to list Demo Capture, Walkthrough
Video and Paste Ready Update, then invoke one by name. `doctor` checks runtime
and registrations, not native model routing or host behavior.

`aaron-demo doctor` verifies installed files, tools and browser readiness.
`aaron-demo smoke` runs only a public loopback application and prints an MP4,
held-frame stills, update page and JSON report. Inspect the page and frames.
For your own app, use `aaron-demo docs project-adapters`.

If setup reports **runtime installed and activated, but smoke failed**, installation
is retained and the command remains available. The workflow has not passed validation.
Inspect the smoke output and retry the printed command; reinstalling is not the first
recovery step. A sync-marker failure distinguishes a probe/tool failure from a
missing recorded transition. Preserve the failed capture for diagnosis; retrying a
new capture does not establish the cause, and an unverified calibration offset can
misalign every highlight.

Capture, silent rendering, imported audio and script `--dry-run` need no narration
account. Run `aaron-demo voice setup` for guided account/voice selection, a company endpoint
or optional free local Kokoro. No JSON editing is required; see [narration](narration.md).

## Headless Ubuntu / CI

Smoke and normal recording run Chromium headless, but a first capture without a
saved session opens a headed browser for sign-in. `--headed` also needs a display.
A passing smoke check therefore does not verify display availability. `doctor`
warns when Linux has neither `DISPLAY` nor `WAYLAND_DISPLAY`; that warning does
not fail the headless runtime checks.

On a container or CI runner without a desktop, install `xvfb` and `xauth` through
your system package process, then wrap capture in a virtual display:

```sh
xvfb-run -a -s "-screen 0 1920x1080x24" aaron-demo capture --project /path/to/app --env local --walk tour
```

This works for local adapters that need no human login and for environments with
a valid saved session. Xvfb supplies a display, not an unattended login method.
For interactive authentication, use a desktop or arrange a secure way to view and
control the browser in the same runtime environment. Keep session state private.
Chromium still needs its system libraries and sandbox permissions. Reinstall the
browser only when the error says its executable is missing; other launch errors
need diagnosis from their reported cause.

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

### Coexist with another Demo installation

Choose **all three** independently: runtime root, host skills directory and command
bin directory. A different `--root` alone still collides with the default skill IDs
and `aaron-demo` command. For a durable local Cursor project install on POSIX:

```sh
python3 scripts/install.py --agent cursor --root ~/.local/share/aaron-skills-public/demo --skills-dir "/path/to/application/.cursor/skills" --bin-dir ~/.local/share/aaron-skills-public/bin --smoke
~/.local/share/aaron-skills-public/bin/aaron-demo doctor
```

Replace `/path/to/application` with the actual project path; keep it quoted.
On Windows use `python`, durable directories under `%LOCALAPPDATA%` and the generated
`aaron-demo.cmd`. Use the isolated command's absolute path in the agent session; do
not change the existing installation's launcher or global PATH. Check which skills
Cursor discovers if another user/project installation has the same invocation IDs;
avoid loading competing copies into the same session. Arbitrary storage folders do
not become host discovery paths. The runtime remains local even when skills sync
to a cloud host; that host still needs its own runtime and browser.

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
