---
name: verify-delivery
description: Verify whether an existing website, application, presentation, document, report or reusable template is ready for its intended use. Inspect the actual deliverable against the brief, repair issues within scope, recheck and report evidence and remaining limits. Use for acceptance checks and delivery reviews.
---

# Verify

Establish what the actual deliverable supports, what needs repair and what remains
unverified for its intended next use. Inspect and exercise the work; a checklist
or the builder's assurance is not evidence. Repair findings within the authorized
scope and recheck by default. Respect an explicit findings-only or read-only
request. The core has no runtime or service dependency; use available tools and
the project's specialist methods. Neither Shape nor Build is a prerequisite.

**Anchor the check in the intended result.** Use the relevant brief, accepted
design, source material, user preferences and success examples. Establish which
artifact/version and environment will be assessed, who receives it and what they
need to do. Reuse the useful understanding already available; do not restart a
completed interview or require a universal specification. Keep confirmed behavior,
proposed choices and reviewer preferences distinct. Ask about an unresolved rule
only when it changes a consequential judgment; do not invent it to obtain a pass.

**Choose checks that can change the delivery decision.** Consider the dimensions
the task needs: meaning and completeness, correctness of facts/data, behavior and
recovery, layout and usability, repeatability and receiver access. Select checks
by the promises made and the consequence of failure. Scale effort to the change
and use the project's required gates; a small edit does not require an unrelated
audit. A polished screenshot cannot establish a saved transaction, and a successful
automation run cannot establish that a report answers its question.

Read only the applicable references:

- [Websites and applications](references/web.md): user paths, state, authoritative
  effects, automation and relevant device/access checks.
- [Presentations](references/presentations.md): rendered slides, charts, argument,
  editability and playback/export boundaries.
- [Documents and reports](references/documents-reports.md): coverage, claim/source
  consistency, calculations, conclusions and reading/editing experience.
- [Templates and automation](references/templates-automation.md): representative
  instantiation, repeat runs, input variation, failures and output inspection.

An artifact can need several references: a generated report needs content checks
as well as generator checks. Do not run every dimension merely because it exists.
For another medium, use its actual promises and available specialist verification
rather than forcing it into one of these categories.

**Inspect evidence at the boundary of the claim.** Open the actual files, render
them in a suitable viewer and exercise relevant interactions. Trace important
figures and behavior to their owning source. Use representative content and
necessary failure cases, not only the easiest sample. Prefer repeatable checks
for deterministic behavior and reusable outputs; combine them with visual and
semantic inspection. Use existing tests where they test the right promise.

For executable checks, retain the command, relevant input/revision, outcome and
material failures/skips. A build, unit suite and visual comparison support
different claims; do not collapse them into one passed label.

Reuse prior evidence when its artifact/version, environment, inputs and method
are relevant and still valid. Do not simply inherit a "passed" label, but do not
rerun unchanged checks without a reason. A changed dependency or related part may
invalidate more than the edited file. Keep check results attributable to the
version actually inspected; do not present stale evidence as a final recheck.

When a necessary tool, source or environment is unavailable, mark the affected
claim unverified and explain the practical consequence. Do not silently replace
the requested check with an easier one, or treat not applicable and not checked
as equivalent. Keep mocks, simulations, parser checks and real use distinguishable.
An alternative check adds evidence without closing the original claim. A new
baseline cannot establish historical identity or validate a missing source.

**Repair the cause and verify the result.** For a finding, identify the affected
requirement, observed behavior, expected result and useful evidence. Fix the
smallest coherent cause within scope, carrying corrections into dependent text,
charts, interactions, examples and delivery files. Do not rewrite the requirement,
loosen a test, hide a failed take or remove content merely to make a check pass.
An optional improvement should not become a release blocker by reviewer taste.
Consolidate duplicate findings and fix an evidenced bug class within scope.
Use the project's review budget; repeated nonconvergence needs reassessment,
not another unchanged full review.

Preserve an account of the original failure. Recheck the failed promise on the
final artifact and relevant neighboring behavior; rerender and reinspect affected
exports when needed. A source edit alone does not close the finding. Repeat a
repair cycle only when there is a new hypothesis or evidence; stop repeating an
unchanged failure and identify the missing decision, access or fix. Leave work
outside the authorized scope as a finding with a concrete next action.

**Give the next receiver an evidence-based conclusion.** Use the conversation or
existing project artifact; a separate report or fixed schema is optional. State
the artifact/version, intended use, meaningful checks and outcomes, fixes and
recheck results, and material gaps. Make passed checks, open issues, unverified
claims and justified exclusions distinguishable. Point to accessible evidence
and supply the files it depends on when those belong in the handoff.

If the handoff promises a rerun, regeneration or recalculation, check that promise
from the receiver's files and declared dependencies. An author's successful
command in the original workspace does not establish a reproducible handoff.

Conclude readiness for the stated next step, such as a local review, demo or
release candidate. An important failed or unverified promise prevents an
unqualified ready claim. Do not average a material failure away with a score,
or claim completeness beyond the inspected scope. Do not infer human preference
acceptance, customer signoff, publication or production state from local technical
checks; those claims need their own evidence.

Build retains responsibility for checking while making the work. Verify can
reassess it from the recipient's task without replacing specialist testing or
requiring another agent. Capture/Film/Share may use the checked result and its
limits; a successful demonstration does not itself prove the product claims.
Follow task authorization for external writes, sending and releases. Keep private
sources and raw logs, screenshots and generated evidence outside public source.
