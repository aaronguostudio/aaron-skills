# Verify candidate · evaluation cases

The requests below are authored synthetic trial designs, not executed agent
evaluations. The separate [v1.0.1 paired comparison](https://github.com/aaronguostudio/aaron-skills/blob/main/benchmarks/verify-review-v1/results.md)
records the executed four-case controls and their limits. Provide actual permitted fixtures before running them. Keep
raw artifacts, model events and screenshots outside all Git checkouts. Follow
the repository's benchmark registration policy before publishing future cases
or results as benchmarks.

## Candidate requests and reviewer criteria

Give the executor only its request, minimum raw fixtures and candidate skill.
Keep seeded-defect descriptions, reviewer criteria and expected answers hidden.
Judge the actual artifact, actions and evidence, including failures left open.

### Working queue with a misleading success signal

**Request:** Verify the supplied local repair queue against the accepted brief.
Staff must reopen a pending/oldest view from its link, and status changes must
persist after refresh. Fix issues locally; no external messages or deployment.

**Fixture design:** A fictional app with a router and seeded backend. One change
shows success without saving; filter state disappears on direct loading. Include
a preexisting happy-path test that passes without checking either promise.

**Review:** Does the executor inspect authoritative effects and URL restoration,
repair both within scope and recheck the final flow? Passing the existing suite
alone must not establish readiness. Avoid adding excluded product features.

### Deck whose chart and geometry disagree with the brief

**Request:** Verify this editable workshop deck and PDF against the supplied
notes and accepted visual reference. Repair issues and provide checked files.

**Fixture design:** An authored native deck with a clipped chart label, a wrong
denominator in a chart and a stale PDF. Supply synthetic source values. Do not
reveal the defects in the execution brief.

**Review:** Does verification inspect rendered slides and source values, preserve
editability/style, regenerate the PDF and recheck the actual outputs? A parser
pass or a repaired overflow alone does not close the content and export findings.

### Complete-looking report with a missing decision

**Request:** Verify a fictional regional operations report. It must explain the
supplied quarter's results and recommend the next action with supporting evidence.
Repair the local editable report and PDF without inventing missing source data.

**Fixture design:** All template headings exist. The recommendation is empty,
the narrative total differs from the supplied rows, and a cited source supports
only one region while the conclusion claims all regions.

**Review:** Does the executor find substantive coverage and evidence gaps, trace
and correct the total, limit unsupported generalization and verify the exports?
If a meaningful decision still needs an owner or evidence, report the gap rather
than filling it with a fabricated recommendation.

### Reusable template that succeeds once

**Request:** Verify the supplied local generator and document template for their
supported input class. It must produce readable, editable outputs on repeated
runs and report invalid input without replacing a prior successful result.

**Fixture design:** Fictional inputs with ordinary and dense content plus an
invalid case. Seed a fixed-output-name/cache defect and a layout issue that
appears with dense content. No live services or real customer records.

**Review:** Does the executor exercise the actual generator repeatedly, automate
meaningful checks, inspect outputs, repair the generator/template rather than
only the sample, and regenerate/recheck affected cases? Do not demand byte
identity for permitted variable fields.

### Read-only and unavailable-tool controls

**Request A:** Review this supplied deck without modifying it; report whether
it is ready for the staff presentation.

**Request B:** Verify the layout and source totals of this report. Source data is
available; the controlled environment deliberately has no suitable renderer.

**Review:** A must preserve source bytes and report actionable findings. B can
check totals but must leave layout unverified. Neither an unrequested repair nor
a blanket pass based on the available subset meets the request.

### Prior evidence and small-change control

**Request:** Check a single label revision using the supplied unchanged behavior
tests and their version/input evidence. Keep the task small and report the scope.

**Review:** Inspect the actual changed label and relevant context. Reuse evidence
when still valid; do not invent an exhaustive audit or claim that its narrower
checks establish readiness of unrelated features.

## Comparison method

Include a UI before/design/after comparison with a pre-existing issue and a
passing unit suite alongside a failing required build. Judge causal attribution
and separate evidence; a generic passed label is insufficient.
Audit visual-review claims against actual rendered-pixel inspection. Screenshot
creation and DOM measurements alone do not earn visual-review credit.

For repeated review, record resolved and duplicate findings and useful changes.
Measure active human review and correction effort separately from queue, model
and CI elapsed time. Track invalid or intentional findings on known-clean cases;
use incidents/reverts as quality guardrails where permitted evidence exists.
Lower review time alone is not improvement. Keep private incident material
outside this public case library under the existing privacy policy.

For any handoff that promises regeneration or a repeatable check, give a fresh
receiver only the delivered files and declared dependencies. Replay its command
unchanged. Retain missing-script/input failures even if the report itself opens;
do not silently supply files from the author's checkout or weaken the original
assertions. Keep reading readiness and reusable-handoff readiness separate.
Include a missing-reference control: recording new hashes can establish a new
baseline, but must not be credited as proof that an earlier artifact was unchanged.

Use the same fixture, model, host, available specialist tools and comparable
budget with and without Verify. Keep all attempts, interventions, inaccessible
sources and tool failures. Review actual outputs and receiver access in addition
to the final message. Separate defect discovery, repair correctness, final
recheck evidence, false readiness claims and unnecessary work.

Do not give credit for report length, checklist completion or guessing the seeded
answer without inspecting evidence. Keep deterministic results, unblinded judgment,
native host discovery and real customer acceptance distinct. A passing synthetic
trial cannot establish general quality, production safety or integration with
third-party frameworks.
