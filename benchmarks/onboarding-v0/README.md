# First-use onboarding, protocol 1

This case asks whether a new profile can install Aaron Skills and produce a first
artifact without the maintainer's prior context. It does not reuse the blog
benchmark's baseline or change its frozen task. All application/voice data is
synthetic; no real voice account, customer system or paid provider is used.

## Run on a clean CI worker or your own machine

After installing the documented OS prerequisites, from the checkout:

```sh
python benchmarks/onboarding-v0/run.py --workspace /external/new-onboarding-trial
```

Use a **new** path outside every Git checkout. On native Windows, for example,
use `C:\Temp\aaron-onboarding-trial-1`. No global skill registration, system
package changes or persistent environment changes are performed by the runner.
It installs through the documented setup entry point into the trial's own
runtime/bin/skills directories. Python, Node/npm, FFmpeg and browser system
libraries are prerequisites; this is not an empty operating-system image.

The runner constructs a child-only home/profile, npm cache, voice configuration
and capture state. It removes ambient provider credentials and does not copy
the developer's config, project instructions or previous sessions. The same
case runs in the macOS/Ubuntu/native-Windows CI matrix before the existing
installed-runtime acceptance checks. Unit tests for scoring/isolation run in the
shared deterministic gate. No recurring paid model or provider job is enabled.

The journey covers missing-prerequisite guidance, fresh installation, an empty
voice profile, no-account choices, selecting an account voice by name, private
key storage, an audible sample, a company endpoint, a real browser capture,
silent MP4/HTML output, a cover shortlist, plain/designed cover/body previews,
imported audio, narrated video and a second presentation without resynthesis or
recapture. Account voice responses are intercepted inside the scripted wizard;
speech bytes come from a loopback fixture and are synthetic tones.

## Evidence and regressions

`case.json`, `tasks.md` and `rubric.json` version the protocol. Every required
stage is a gate; a missing/failed stage fails the run. `report.json` records stage
durations, scripted question count, provider-fixture requests, protocol hashes,
source commit and bundle identity. Logs, profiles, synthetic credentials, media,
previews and all other raw output remain in the external trial directory.
Never auto-copy a report or failed run into public `results/`.

Existing lower-level tests remain responsible for detailed provider failures,
geometry, capture guards, revision correctness and permission contracts. Promote
newly observed failures to focused regressions, then rerun this journey against
the same protocol. Measure first-artifact time and completion by stage over
several runs; a single successful scripted run is not a usability study.

## Separate acceptance layers

1. **Scripted runtime gate:** automated in CI, real exported toolchain and media,
   synthetic accounts/provider transport. Its reports always mark native-agent
   and human acceptance `not-assessed`.
2. **Native agent:** run `native.py` explicitly with a chosen model and an empty
   profile. Only the newcomer task and installed project skills are exposed;
   scoring is independent. Authentication is supplied locally, never committed.
   This is opt-in and can consume the operator's existing agent allowance.
3. **Human novice/device session:** use a clean OS account on a Mac mini or
   Windows desktop (or a fresh VM). Give the frozen brief, observe without
   supplying terminal commands/JSON, and record completion, questions, incorrect
   turns and interventions. A Windows Server CI worker does not certify a
   Windows 11 desktop/user session.

Real ElevenLabs/Google account entitlement, private voice access, cloning/sharing,
quota, voice quality and optional local Kokoro installation require separate live
acceptance. A configured narrator or synthetic WAV is not proof of those things.
See [evaluation](../../docs/evaluation.md) and
[narration validation](../../docs/narration-validation.md).
