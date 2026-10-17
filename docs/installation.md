# Install and recover

v0.1.0 supports local macOS installations for Codex and Claude Code. The tested
machine is Apple Silicon; Intel and a second clean machine remain unverified.
The installer rejects other operating systems.

## Standard setup

Requirements: Git, Python 3.11+, Node 22+ with npm, FFmpeg and ffprobe. From the
checkout, run `bash scripts/setup.sh --agent codex --smoke` or replace `codex`
with `claude`. Use `--agent both` to register with both hosts. The optional
`--install-prerequisites` flag authorizes installing missing prerequisites through
an existing Homebrew installation. If Homebrew is absent, setup prints the
[official installation site](https://brew.sh) and stops; it does not request sudo.

The runtime is at `~/.local/share/aaron-skills/demo`, the command at
`~/.local/bin/aaron-demo`. Host skill paths are `~/.agents/skills` for Codex and
`~/.claude/skills` for Claude Code. Setup prints PATH guidance and never edits a
shell profile or model-provider configuration. Start a new agent session. Ask it
to list Demo Capture, Walkthrough Video and Paste Ready Update, then invoke one
by name; doctor checks links and dependencies, not native host discovery.

`aaron-demo doctor` verifies installed files, tools and browser readiness.
`aaron-demo smoke` runs only a public loopback application and prints the MP4,
held-frame stills, update page and JSON report. Inspect the page and frames.
A missing application adapter is separate from installation: use
`aaron-demo docs project-adapters` for your actual app.

## Isolated setup

Choose new paths outside all source repositories. For example:

```sh
python3 scripts/install.py --agent claude --root /tmp/demo-test/runtime --skills-dir /tmp/demo-test/project/.claude/skills --bin-dir /tmp/demo-test/bin --smoke
/tmp/demo-test/bin/aaron-demo doctor
```

`--skills-dir` overrides the directory for a single host; it cannot be combined
with `--agent both`. For real use choose a durable folder. An arbitrary directory
is not automatically discoverable by a host: use a native project/user skill
path. No global host registration changes in this isolated example.

## Upgrade, repair and rollback

Run setup again with the same root. Content hashes identify releases; dependencies
are prepared before switching `current`. Registrations already managed by that
installation are retained when adding another host. Unrelated commands and
skills are preserved; rename or choose a different directory on a conflict.
Do not delete another tool's skill to resolve a conflict automatically.

Use `python3 scripts/install.py --repair` with the same path options if dependencies
are damaged. Incomplete releases remain for diagnosis and can be retried. Ready
releases are retained. For manual rollback, point `<root>/current` to a previous
ready directory under `<root>/releases`, then run doctor and smoke. Do not move a
release: its virtual environment and launcher contain machine-local paths.

## Uninstall

Run `aaron-demo uninstall`, or `python3 scripts/install.py --root <root> --uninstall`.
This removes only still-managed skill/command links. User replacements survive.
Runtime releases, browser caches, captures, sessions and user configuration are
retained. Remove the runtime folder manually only after deciding you no longer
need it; recordings normally live separately under `~/.demo-capture`.

## Boundaries

Installation downloads public dependencies and browser binaries. Silent smoke
needs no account or API key. Real sign-in and optional paid narration are explicit
later actions. Generic skill-folder installers do not install this runtime.
There is no hosted service or cloud deployment required by the Demo bundle.
