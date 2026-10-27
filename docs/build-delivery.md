# Build · delivery within the user's workflow

Build is a local first-version candidate, with invocation ID `build-delivery`.
It helps an agent turn understood intent into a usable result within the team's
existing engineering or authoring system. Build identifies and closes applicable
delivery gaps; the chosen workflow owns implementation methods, planning, review
and release. It has no runtime, provider or framework dependency.

## Use

> Use $build-delivery to complete this work from the existing brief and designs.
> Follow our existing engineering workflow and design system. Address the relevant
> validation, testing and compatibility requirements, check the actual result in
> use and prepare it for the person taking over. Keep this work local.

Start with the [skill](../skills/build-delivery/SKILL.md). It reads only the
references relevant to the artifact. Small edits stay small; substantial work
may benefit from a representative sample, correction and continued completion.
There is no required interview, plan document, preview approval or handoff packet.

## What Build adds

Start by inspecting the project's instructions, chosen methods, nearby work,
design patterns, tests and release rules. Carry the relevant expectations into
the existing ticket, plan, tests or review; do not create a competing workflow.
Finding a named skill does not establish that an integration has been tested.
No framework installation, dependency migration or project-rule rewrite is
required by Build.

For substantial application work, the useful questions are concrete:

| Delivery concern | Expected effect on the actual work |
| --- | --- |
| Design basis | Reuse the system/components or established product patterns; resolve only the missing design needed for this task. |
| State and validation | Define relevant URL/persisted state, useful input feedback and authoritative access/integrity checks. |
| Data meaning | Preserve business rules across live/mock/fallback paths, associate records by their complete business keys and reconcile amounts within the same scope. |
| Verification | Use existing test tools and the team's TDD/review practices; prove the changed rules and consequential user path at the right boundaries. |
| Project integration | Connect new modules/tests to existing discovery, registration and CI selection; check that a later module-only edit still receives the intended checks. |
| Compatibility | Check affected existing paths, callers, configuration and data, including migration/version consequences when applicable. |
| Exposure and recovery | Use existing flags when required or justified; check both paths and identify what stopping exposure can and cannot recover. |

These are considerations selected by the task and project, not mandatory
artifacts. A compatible label change does not need a flag, new E2E suite or
design-system exercise. A missing design system does not automatically require
building one. Use a small coherent direction when needed, and leave consequential
owner choices explicit. Release preparation does not authorize deployment.

Integration checks follow the project's actual mechanisms. For path-selected CI,
a mixed change can trigger every suite through a shared file while a new module
remains unmapped. Check representative isolated edits as well as the whole diff,
then extend the existing rules only where needed. This requires no new registry,
test framework, CI platform or deployment stage.

The quality defaults connect purpose to observable behavior. For example, sharing
a filtered work queue should reopen that view for an authorized recipient. This
calls for appropriate URL state, route handling and checks, not a new sharing
service or permission bypass. A changing dataset is distinct from a saved snapshot.

For reusable templates and generators, the relevant reference now distinguishes
updating a current result, retaining issued versions and refusing a collision.
Choose from the receiver's task, document the supported repeat path and exercise
a second input at that destination. A disclosed default can resolve an open
implementation choice; no universal overwrite policy or backup service is imposed.

## Relationship to Shape and other methods

The current Shape delivery direction prepares whichever expression its receiver
needs: a message, design, workflow, conceptual model or execution brief. Build
can use any of these without requiring a structured packet or repeating settled
discovery. It continues agreed product meaning into the actual artifact and
returns newly consequential choices to the discussion.

In particular, a polished design does not settle an open rule; an interpretation
of required review must not silently become required approval. Keep the purpose,
actors, states, examples and handoff consistent when feedback changes them.

Build uses the user's engineering, design and authoring skills. Their existing
task, test-first and review sequences remain the working process. Build adds
relevant delivery expectations to that process and verifies the resulting work.
Shape is optional input. Capture, Film
and Share are optional ways to demonstrate or communicate an applicable result.
Build's own delivery may be an editable file, working application or concise note.
No mandatory sequence or integration with a third-party framework is claimed.

The separate local Deliver candidate (`deliver-work`) can prepare the audience-
appropriate message, release notes or handoff from the actual result, evidence
and limits. It may use Share for a copyable update page. It is optional; Build's
own useful next-receiver handoff does not require another skill or a release.

The separate local Verify candidate (`verify-delivery`) can revisit whether the
actual deliverable and its evidence support the intended next use, repair scoped
findings and recheck. Build retains its own ongoing checks; Verify is optional
and is not a dependency of this standalone skill.

## Portable local use

Copy the complete `skills/build-delivery` directory into an unused skill location
supported by the intended host, then refresh that host's discovery. Preserve
existing registrations. `agents/openai.yaml` supplies optional Codex UI metadata;
other hosts can use the Markdown instructions and references.

The [standalone manifest](../bundles/build-delivery.json) lists the skill and
product documentation. Build is not added to the Demo runtime installer, and
creating this source candidate does not register it in the user's global skills.
No new CLI command or automatic upgrade is supplied.

## Evidence and limits

Skill validation, document-link closure, manifest completeness and copying into
an isolated skill directory are structural checks. They cannot establish output
quality, native skill selection, compatibility with named agent frameworks or
customer acceptance. See the [evaluation guidance](build-delivery-evaluation.md)
for real-case selection, observable standards and independent comparison. It is
a test method, not evidence that these checks or a behavioral trial have passed.

The new skill and documentation do not change the released capabilities or
website. No publication, deployment, purchase or external sending is implied.
