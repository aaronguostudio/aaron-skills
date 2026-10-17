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
separate testing. Automatic privacy redaction is not implemented.

## Boundaries

No customer system, account or paid voice provider belongs in ordinary CI.
External clean-machine and human acceptance remain distinct from testing on the
developer's machine. Record untested platforms; do not infer model/provider
support from a shared skill format.
