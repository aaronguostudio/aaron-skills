# Templates and automation

Read for reusable document/slide/spreadsheet/code templates, generators and
automated workflows. Verify both the mechanism and the usefulness of what it
produces. One good sample does not establish repeatability.

## Identify the reuse promise

Use the actual input contract, expected outputs, supported environment and
failure behavior. Distinguish a reusable generator from a one-off artifact.
For a visual template, identify which content and structural choices should
remain editable and which design choices are intentionally fixed. Do not impose
a new manifest, templating engine or format merely to make verification easier.

Identify the intended subsequent-run behavior: update a current destination,
retain separate versions, or refuse a collision. Use the receiver's task and
explicit promises, not the reviewer's preferred overwrite policy. A deliberate
refusal can be correct for immutable output and inadequate for a required current
link. Where the choice is still open, disclose it before judging that behavior.

Choose a few representative variations that stress this template's actual
promises: ordinary input, relevant sparse/missing optional content and dense or
long content. Include locales, page counts or structural changes only when the
intended use calls for them. Keep examples fictional or otherwise permitted.

## Exercise the real mechanism

Instantiate the template or run the actual workflow in an isolated workspace.
Automate repeated cases and meaningful assertions where feasible, reusing the
project's test tools. Inspect output values/content as well as exit status and
file existence. A script exiting zero while writing stale output has failed its
purpose. Check for leftover placeholders and dependencies on the author's machine.

Run a relevant case again, controlling state well enough to understand the
result. Check repeatability of required properties; timestamps or generated IDs
need not be byte-identical unless that is the promise. Idempotence is required
only where the workflow promises it. Where retries can duplicate external work,
exercise them with simulations/seeded services inside the authorized boundary.

Use a second representative input at the actual destination or version scheme.
Check current values and labels, retained versions and the supported next action
after a collision. A fresh-directory example does not prove required replacement;
a successful replacement does not prove required history retention. Preserve
these distinctions in the result rather than adapting the command to hide a gap.

Use a relevant invalid or failed input when recovery is part of the workflow.
Check that the result is clearly a failure, that successful prior output and
inputs are preserved as promised, and that partial output is not presented as a
finished artifact. Do not automatically run a destructive or externally acting
workflow merely because its code is available. Test the safe boundary and state
what remains unverified.

## Inspect generated deliverables too

Render/open representative outputs using their medium's checks. A template can
populate every field and still produce clipped slides, unreadable tables, broken
formulas or unsupported conclusions. Use the presentation or document/report
reference as appropriate; use specialist spreadsheet checks when formulas and
recalculation are involved.

After fixing the template or generator, regenerate the affected cases and
inspect the new outputs. Editing just the sample output does not repair future
runs. Record environment, input cases, assertions and inspected output versions.
State whether verification covered only examples, a supported input class or a
larger contract; do not infer universal support from the sample count.
