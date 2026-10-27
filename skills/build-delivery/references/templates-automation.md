# Templates and generators

Read when the deliverable will generate or update other artifacts repeatedly.
Build the reusable mechanism and inspect what it produces using the medium's
relevant checks. A polished example alone does not establish the next run.

## Fit the receiver's repeated use

Use the task and existing conventions to determine what happens on a subsequent
run: update a current result, create a separate version, or refuse a collision.
A stable link used each morning can need replacement; an issued monthly pack can
need immutable versions. Preserve explicit requirements. Where the choice is
open, use a reasonable disclosed default; ask only when the consequences need
an owner decision. Neither universal overwriting nor universal refusal is a
substitute for the receiver's workflow.

Give the receiver a supported entry point with the needed input, destination and
dependencies. Make it clear which result is current, where prior versions remain
and how to retry after a failure. Do not require manual edits to generated output
to use another input. Preserve source inputs and retained versions as promised.
Avoid adding a backup service, scheduler or configuration system without a need.

## Prove the chosen behavior

Run a second representative input through the same mechanism and inspect its
values, labels and rendered result for stale content. Exercise another run at
the actual destination: replacement should update the current result, versioned
output should preserve earlier versions, and an intended collision refusal
should explain the supported next action. Verify required properties rather
than demanding byte identity for permitted timestamps or generated IDs.

For a relevant invalid input, establish the promised failure signal and what
remains usable. Do not present an old or partial result as a newly successful
run. Check last-good preservation where promised; failure recovery beyond the
implemented boundary stays explicit. A local input check does not establish
crash, disk-failure or external-side-effect guarantees.
