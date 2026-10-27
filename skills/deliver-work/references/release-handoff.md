# Release and operational handoff

Read when a task includes preparing a release or handing work to the person who
will deploy, continue or operate it. Use the project's actual process and keep
preparation, approval, execution and verified availability distinct. Do not turn
delivery of a deck, report or small change into a software release ceremony.

## Make the next action concrete

Prepare what the receiving owner needs, using existing project records where
possible. Relevant details can include the exact artifact/revision, destination,
verification evidence and open findings, required dependencies/configuration,
access, flags, data migrations, rollout checks and recovery steps. Include each
only when it changes how the receiver acts. Confirm responsibility from the task
instead of silently assigning an owner or inventing an approval.

For a document, deck or template, hand over the actual requested formats,
editable sources and supporting material needed for reuse. A local authoring path
is not an external transfer. For an application, distinguish a preview/demo from
the target environment and explain material operational limits.

## Respect release authority and provenance

Use explicit task authorization for actual external actions. A request to draft
notes or prepare a plan is not permission to merge, tag, deploy, change access or
announce. When a release is authorized, follow the repository/tool workflow and
required gates; do not add redundant approval rounds for actions already covered.
Finish the concrete reviewable preparation before requesting any missing approval.

Honor the project's production policy. Do not use local/non-main deployment,
branch promotion or alias changes to bypass a main-only Git production rule.
Under that rule, production must come from a Git-triggered deployment of the
expected committed `main` revision. Verify both deployment provenance and the
actual production domain serving that revision before calling the release complete.
If an exception is requested, obtain explicit approval of the exception and its
rollback plan before acting. A preview deployment is not production evidence.

## Prepare recovery and check the result

Use known compatible recovery/rollback steps when the release requires them.
Record whether they were tested or merely prepared. A code rollback may not undo
a data migration or external side effect; make a consequential recovery gap
visible before execution. Do not broaden authority to destructive data work or
automatically roll back a live system just because a check failed.

After an authorized action, inspect the target state: correct revision/artifact,
applicable access/flags, required smoke checks and the receiver's entry point.
If the state is uncertain, investigate before retrying. Report a failed/partial
release or inaccessible delivery plainly, preserving useful evidence and the
next action. A successful command or uploaded file alone does not establish
working availability to its intended users.

Communicate the observed state consistently in the announcement and release
notes. Keep customer acceptance separate from deployment and receipt. Schedule
follow-up or monitoring only when requested; silence is not an approval or a
reason to contact the stakeholder again.
