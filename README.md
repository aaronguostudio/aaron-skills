# Aaron Skills

[English](README.md) | [简体中文](README.zh-CN.md)

Reusable agent skills and executable tools for solving software problems with
the care of a senior engineer—from understanding an unfamiliar project to
delivering a verified result that others can see and use.

Aaron Skills brings working methods and the tools that carry them out into one
collection. The aim is to make it easier to pick up a project, understand the
problem, make a focused change, verify the behavior, and explain the result.
Each skill captures a repeatable part of that process; related skills can work
together through shared tools and documented artifacts.

## The bigger picture

The workflow we are building toward is:

```text
Understand the project and problem
  → Plan and implement a focused change
  → Verify the actual behavior
  → Demonstrate the result
  → Deliver a clear update or handoff
```

The collection will grow around practical steps in that workflow. Skills should
help an agent decide what to do, execute it with the right tools, and leave
evidence that someone else can review. New capabilities belong here when they
solve a real, repeatable problem and can be documented and verified.

**The first available capability is Demo**, covering demonstration and
communication. Project onboarding, implementation, and broader engineering
verification are the direction for the collection; they are not yet separate
released skills here.

## Available now: Demo

Turn a working web feature into a guided video, screenshots, and a copyable
update. The Demo bundle connects three skills with a shared local toolchain:

| Skill | Role |
| --- | --- |
| [Demo Capture](skills/demo-capture/SKILL.md) | Record the real application flow and save screenshots and checked result evidence. |
| [Walkthrough Video](skills/walkthrough-video/SKILL.md) | Render a passed capture into a guided MP4; refine captions, highlights, and optional narration. |
| [Paste Ready Update](skills/paste-ready-update/SKILL.md) | Prepare a reviewable update page with text, screenshots, and an optional video. |

For example, after changing a feature in a project you have taken over, ask your
agent to show the starting state, walk through the change, check the visible
result, and prepare an update for the customer or team. Demo supplies this part
of the workflow. The following setup installs the Demo bundle; future bundles
can have their own dependencies and installation paths.

## Install

The current checkout supports **macOS arm64, Ubuntu 24.04 x64 and native
Windows 11 x64**. The existing v0.1.0 tag is macOS-only. See
[compatibility](docs/compatibility.md) for the measured scope and host limits.
Requirements: Git, Python 3.11+, Node 22+ with npm, and FFmpeg/ffprobe. The installer
adds pinned browser, video and Python dependencies. The example needs no customer
account or paid API.

```sh
git clone https://github.com/aaronguostudio/aaron-skills.git
cd aaron-skills
# macOS / Ubuntu; replace codex with claude or both if needed:
bash scripts/setup.sh --agent codex --smoke
```

On native Windows, clone the same repository, then run in ordinary PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 --agent codex --smoke
```

Windows needs no WSL or administrator token. Execution-policy bypass applies only
to that process. Prerequisites must already be installed; Ubuntu also needs
Chromium system libraries. On macOS, `--install-prerequisites` can install missing
tools through existing Homebrew. See [installation and recovery](docs/installation.md)
for platform preparation, isolated paths, upgrades, repair and uninstall.

You can instead give your local agent this prompt from the checkout:

> Read README.md and docs/installation.md. Inspect prerequisites for this platform,
> then install the Demo bundle for the agent I am using. Preserve unrelated skills
> and configuration. Run doctor and the public smoke check, open its update page
> and inspect its video frames. Report manual setup still needed. Use no customer
> application, credentials or paid narration for this installation.

Codex registers under `~/.agents/skills`; Claude Code under `~/.claude/skills`.
Windows uses the corresponding user-home folders and managed copies; POSIX uses
links. Name conflicts stop installation. Add the printed command directory to
PATH if needed and start a new agent session to refresh discovery. Smoke prints
an MP4, review stills and a local HTML update page.

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
DeepSeek, GLM, MiniMax and additional harness certifications remain unverified.
Windows/Linux runtime acceptance does not certify native LLM-host invocation.
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
solving software problems, verifying results, and communicating them clearly.

The English and Chinese READMEs cover the project overview and getting started.
Detailed technical references remain in English for now; commands, paths, and
skill identifiers are the same in both versions.

Original project code is [MIT](LICENSE). Dependencies retain their own terms;
Remotion has free-use eligibility conditions and a Company License requirement
outside those groups. See [third-party notices](THIRD_PARTY_NOTICES.md) before an
organizational rollout. Report vulnerabilities through [SECURITY.md](SECURITY.md).
