# Aaron Skills

Turn a real web feature into a guided video, screenshots, and a copyable update.
The Demo bundle combines three portable agent skills with a shared local toolchain:
Demo Capture, Walkthrough Video, and Paste Ready Update.

## Install

The v0.1.0 release candidate targets **macOS and local Codex or Claude Code**.
Requirements: Git, Python 3.11+, Node 22+, and FFmpeg/ffprobe. The installer adds
pinned browser, video and Python dependencies. No customer account or paid API is
needed for the example.

From a checkout, choose your host:

```sh
bash scripts/setup.sh --agent codex --smoke
# Or:
bash scripts/setup.sh --agent claude --smoke
```

To install missing prerequisites through an existing Homebrew installation, add
`--install-prerequisites`. Setup does not install Homebrew or request administrator
access. See [installation and recovery](docs/installation.md) for isolated paths,
both-host registration, upgrades, repair and uninstall.

You can instead give your local agent this prompt from the checkout:

> Read README.md and docs/installation.md. Install the Demo bundle for the agent
> I am using. Inspect prerequisites first; you may install missing Node, Python
> and FFmpeg through an existing Homebrew installation. Preserve unrelated skills
> and configuration. Run doctor and the public smoke check, open its update page
> and inspect its video frames. Report any manual setup still needed. Use no
> customer application, credentials or paid narration for this installation.

Codex skills register under `~/.agents/skills`; Claude Code skills under
`~/.claude/skills`. Installation preserves unrelated entries and stops on name
conflicts. Add `~/.local/bin` to PATH if the printed instructions request it;
start a new agent session to refresh discovery. The smoke check prints an MP4,
review stills and a local HTML update page.

## Make a demo

Ask your agent:

> Use Demo Capture to demonstrate this feature in my local app. Show the starting
> state, the important actions and the verified result. Produce a short silent
> walkthrough and an update page for me to review. Reuse the capture for caption
> or highlight corrections. Do not send or publish anything.

An arbitrary application needs a small project adapter describing its URL and UI
steps. The agent can author it after inspecting the app. Review write operations
and production gates before recording. Sign in yourself in the visible browser;
the skill does not type credentials. See [first demo](docs/first-demo.md) and the
[adapter reference](docs/project-adapters.md).

```sh
aaron-demo capture --project /path/to/app --list
aaron-demo capture --project /path/to/app --env local --walk tour
aaron-demo render /path/to/passed-run --stills
aaron-demo inspect /path/to/passed-run
aaron-demo revise /path/to/passed-run /path/to/patch.json --out /path/to/revision
aaron-demo page /path/to/message.md --out /path/to/message.html
```

Checked result fields use exact assertions and saved named highlight geometry.
Presentation-only revisions preserve the source recording and avoid replaying
business writes. Rendering is silent by default; optional narration uses your
own ElevenLabs account. `render --dry-run` plans without creating files or
calling a provider. See [presentation revisions](docs/presentation-revisions.md)
and [narration](docs/narration.md).

## Privacy and scope

Sessions, recordings and generated pages stay outside Git. Outputs can contain
real screens; inspect them before sharing. There is no automatic personal-data
redaction. Adapters are trusted executable JavaScript, and the browser guard is
not a sandbox for malicious adapters. See [data and network behavior](docs/data-and-network-behavior.md).

The shared CLI is independent of the model. [Compatibility](docs/compatibility.md)
distinguishes format compatibility, host discovery and actual workflow testing.
DeepSeek, GLM, MiniMax, other harnesses, and Linux/Windows certification are Phase 2.
A standard SKILL.md alone does not prove the browser or renderer works on a host.

## Develop and extend

- `skills/`: focused Agent Skills entry points.
- `packages/demo/`: capture, contracts, renderer, and update-page implementation.
- `bundles/`: explicit runtime and public-source manifests.
- `examples/` and `evals/`: public fixtures and opt-in behavior evaluations.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [verification](docs/verification.md), and
[evaluation methodology](docs/evaluation.md). Deterministic tests, agent behavior
and visual acceptance are separate checks. A new capability can add a package and
bundle in this repository; there is no need for a coordinating master repository.

## Author and license

Built by **[Aaron Guo](https://aaronguo.com)**, a product builder and engineer
exploring practical AI workflows. This repository shares reusable tools for
showing what changed and communicating it clearly.

Original project code is [MIT](LICENSE). Dependencies retain their own terms;
Remotion has free-use eligibility conditions and a Company License requirement
outside those groups. See [third-party notices](THIRD_PARTY_NOTICES.md) before an
organizational rollout. Report vulnerabilities through [SECURITY.md](SECURITY.md).
