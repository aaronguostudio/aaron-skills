# Evaluation

Keep three evidence layers separate: deterministic behavior, agent workflow
choices, and visual/product acceptance. Do not advertise universal quality or
speed improvements from a single task.

## Deterministic checks

`npm run check` covers source structure, docs/import closure, TypeScript checking,
capture units/browser integration, renderer/timeline/narration/brand units and
Python editor/page/annotation tests. An exported installation must separately
pass doctor and real capture -> MP4 -> update-page smoke. Provider calls are
mocked in ordinary tests; paid model evaluations are opt-in.

## Agent checks

The [first-use onboarding case](https://github.com/aaronguostudio/aaron-skills/tree/main/benchmarks/onboarding-v0) runs the
documented setup and full first-artifact journey with an empty child profile in
the three-platform CI matrix. It covers silent/imported/synthetic-provider audio,
voice-name selection, cover/body previews and repeat output without resynthesis.
Its scripted results do not establish native discovery, live provider access or
human ease of use. An opt-in native-agent runner and supervised novice protocol
keep those acceptance layers separate. Raw evidence stays outside Git; new
failures become focused regressions and are rerun against the frozen protocol.

`evals/demo-cases.json` holds positive, negative and capture-reuse cases.
`scripts/evaluate.py` measures prompted routing/decisions in isolated Codex calls;
it does not establish native discovery or tool execution. Outputs stay outside
source repositories. Do not provide expected answers to the model.

For a real task, register skills through the intended host path, freeze the public
fixture brief, and let the agent capture, render and prepare a page. Then request
a caption/highlight revision and verify that it reuses the capture. Record host
and actual model, source/bundle revision, duration, manual interventions, native
skill use, outputs and limitations. Compare application write counts before and
after presentation-only revisions. See verification.md for observed launch checks.

## Comparisons

When measuring benefit, distinguish: A general agent without the Demo runtime;
B Demo tools/docs without skills; C the same tools/docs plus skills. B versus C
cannot isolate the reusable toolchain's contribution. Earlier local pilot results
were mixed and do not establish that skills always improve speed or quality.
Raw exploratory logs and recordings are not public source artifacts.

## Visual checks

Inspect every held frame and the end of every wait for settled UI, readable text,
correct captions/numbers and complete highlights. Verify MP4 playback and the
update page. Clipboard behavior depends on browser security context and needs
separate testing. Explicit masks need boundary, hold, gap and transformed-layout
checks, plus inspection of the actual rendered pixels. Automatic privacy
detection is not implemented. Decision cases for internal/mock demos should
verify that no unnecessary privacy question or masking is introduced; explicit
requests and project context should produce the requested scope without repeated
confirmation. These model decisions are separate from deterministic pixel tests.

## Boundaries

No customer system, account or paid voice provider belongs in ordinary CI.
External clean-machine and human acceptance remain distinct from testing on the
developer's machine. Record untested platforms; do not infer model/provider
support from a shared skill format.

## Proposal delivery review

Inspect the actual reading and viewing experience alongside semantic coverage.
For the default Shape proposal, check the five exact navigation/heading labels,
section contribution and repeated explanations. Inspect the working frames at a
readable scale. Shared period, permission and save/simulation assumptions need one
home, while meaningful basis labels, unresolved markers and errors remain local.
Verify claimed source corrections against the inspected words.

For independent tests, freeze the task, raw inputs, candidate and review criteria.
Keep prior outputs, manually refined exemplars and reviewer conclusions out of
the generation workspace. Preserve the unedited result and failed takes. Record
reusable templates/controllers as part of the candidate, not instruction-only
reasoning. Separate artifact availability, final messages and process exit.
A repeat on a known case does not establish transfer or recipient acceptance.
Private sources, raw runs and evaluation reports stay outside public source.
