# Build candidate · evaluation guidance

This is a proposed evaluation method, not a completed trial or evidence of
improvement. Use a real, authorized task as the main calibration case. Keep raw
source conversations, model events, generated files and review evidence outside
every Git checkout. Follow the repository's source/data policy; a real task does
not require private customer data or permission to operate a customer system.

## Establish a case before running it

Recover the original request and the project state before the work. Record their
provenance, pinned source revision, permitted assets and reuse license. Separate
source facts from the evaluator's scoped interpretation. For a retrospective
slice of a larger request, state exactly what it includes and excludes; old
publication authorization does not apply to the replay.

Select an existing codebase with its real instructions, design patterns, chosen
workflow and test tools. If the whole original environment cannot be supplied,
state the limitation and narrow the claim. Do not fabricate a framework setup
and call it evidence of adoption by that framework's users.

Agree observable success examples with the owner before a scored run. Include
what the receiver must do, the design constraints, important failure/recovery
behavior and any compatibility/exposure expectations. These requirements go to
the executing agent too. Keep answer artifacts, accepted implementations, hidden
review probes and scoring judgments separate. A hidden expectation must not be
a new user requirement introduced after execution.

## Judge outcomes and composition

| Dimension | Evidence to inspect |
| --- | --- |
| Existing workflow | The actual diff and work record use the chosen components, tools, planning/test/review practices and applicable registration/CI rules; no competing process or unnecessary installation. |
| Intent and design | The core task works, agreed meaning is preserved, real content fits and the changed experience follows the design basis. |
| State and validation | Applicable navigation, refresh, input, access and authoritative-success behavior work across the real boundary. |
| Verification | Relevant checks were run using available tools; a meaningful failure/recovery example and affected existing behavior are covered where needed. |
| Compatibility and exposure | Relevant old contracts/paths/data still work; flags or migration/rollback choices match the task rather than being added mechanically. |
| Receiver use | A fresh receiver can run, inspect or continue the result using the delivered files and instructions with the same access. |
| Proportionality | Work, dependencies, documents and time serve the task; necessary checks are retained without inventing features or ceremony. |

When a project selects tests by changed paths, inspect selection for the full
diff and representative module-only edits. Shared-file changes can conceal a
missing mapping. Verify behavior through the existing selector rather than a
text-match requirement for a preferred configuration format. Evaluate only the
registration/discovery mechanisms the task's project actually uses.

For data-backed work, evaluate the same accepted examples across the relevant
adapters. Inspect the changed query/mapping boundary, not only a fake response.
Use repeated identifiers in different valid contexts to check complete business
keys, and independently reconcile row amounts and full-filter totals across
supplied scopes. Exercise filter combinations that must preserve independent
eligibility/access rules. These probes test the agreed contract; they must not
introduce new product policy after the run. Keep unavailable live-system checks
separate from local contract or relational evidence.

Use concrete pass/partial/fail/not-applicable observations before any score. A
material failure in the core task, authorization, data integrity or required
compatibility prevents acceptance; other strengths cannot average it away. Mark
untested boundaries as untested. Do not reward document count, test count, a
particular plan format, an installed framework name or a screenshot alone.

Some cases cannot exercise every dimension. A frontend handoff can test state,
copy consistency and design reuse without proving database migration safety,
production rollout or compatibility with a named engineering framework.

## Calibrate, distill, then rerun independently

Preserve the initial output and specific failures. Refine a reference with the
owner one issue at a time, then extract general decision guidance into Build or
its relevant reference. Keep case content and the refined implementation outside
the skill. The reference establishes a quality level, not mandatory wording,
component names or an exact file layout.

Give the next independent executor only the raw brief, pinned starting project,
permitted assets, normal project instructions and candidate skill. Do not expose
the manually refined page, prior attempts, golden implementation or review notes.
Do not repair its final output before scoring. The executor may test and revise
its own work within the declared budget; reviewer intervention is recorded as a
separate assisted result. Retain timeouts, partial artifacts and retries.

Calibration on one exposed case is development/regression evidence. Use another
unseen real task before claiming transfer, and a recipient-use probe before
claiming that the handoff works for another person.

## Compare fairly

For incremental benefit, hold the task, starting revision, project instructions,
chosen professional workflow, tools/access and budget constant. Compare baseline
against baseline plus Build, or old Build against candidate Build; state which
question is being tested. Do not give only one arm a design reference, browser,
working dependencies or an extra review agent.

Have the receiver attempt the task with equivalent access and neutrally labeled
outputs before asking for preference. Record corrections, help needed and task
completion, not only artifact polish. Report execution completion, artifact
quality, test/environment coverage, receiver performance and owner acceptance as
separate results. A timeout with a usable page is still a timed-out execution.

Small-change, unresolved-owner-choice and failure controls can supplement a real
case. They do not replace real-case calibration or establish broad superiority.
Any named-framework composition claim needs its own actual run with that system;
reading its documentation or putting its name in a fixture is insufficient.
