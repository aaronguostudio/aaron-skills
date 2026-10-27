# Websites and applications

Read for application verification. Use the actual project and its chosen testing
tools. The purpose is to establish the user-visible promises at the relevant
system boundaries, not to achieve a particular test count or coverage percentage.

## Follow the user's task

Start from a realistic entry point and complete the important scenario. Check
what the user can understand and do, the resulting state and any needed recovery.
Use the accepted terminology, roles and behavior. Include consequential empty,
validation, failure or conflict cases where the changed task needs them.

Identify the authority for each success claim. A toast after clicking Save is
insufficient when the promise is persistence: inspect the accepted response and
stored state, then refresh or revisit. A queued job is not a completed job.
If a backend is simulated, verify the prototype within that boundary and leave
real integration unverified rather than treating a mock as production evidence.

For a shared view, exercise its direct URL, refresh, relevant filters/sort,
back/forward and invalid parameters. Check relevant authentication and recipient
access with seeded identities when the fixture supports them. Sharing a view is
distinct from freezing a dataset; don't require a snapshot unless promised.

## Use automation where it earns its cost

Reuse meaningful unit, integration and browser tests. For repeatable user paths,
automate the actions and observable results when suitable tools are available.
Wait for meaningful state instead of relying on arbitrary delays. Control input,
identity and fixture state so a second run can be interpreted. Test data and
cleanup must not alter real business records without authorization.

Follow the flow across UI, request, owning state and response when the claim
crosses those boundaries. A passing isolated function test is useful but does not
replace that flow. Check the affected normal path after a failure-path repair.
Add a focused regression when a repeatable behavioral defect warrants it; don't
manufacture tests for a harmless wording change or tests that only mirror code.

## Check experience and access

Inspect applicable device sizes, realistic content lengths and data scale.
Exercise the relevant keyboard/focus path, readability and accessible controls.
Check console/network failures that affect the task. Use the project's
accessibility/performance targets when supplied; don't invent a universal score
or claim conformance from a few spot checks.

For UI changes, compare the actual result with the accepted design and relevant
before state at comparable viewport, content and interaction state. Explain
meaningful deviations; screenshot similarity alone cannot establish behavior.
Inspect rendered pixels before claiming visual review; generating a screenshot
or measuring DOM geometry does not establish that it was viewed.

For code-review findings, inspect the diff and surrounding contract. Give a
concrete trigger, consequence and file/line evidence. Compare the base before
attributing an issue to this change. Keep pre-existing issues and optional polish
distinct from introduced defects; route each by its effect on the intended use.

Validate permissions at their owning boundary when access is part of the task;
hiding a button does not establish authorization. Keep security checks relevant
to the changed behavior and authorized environment rather than launching an
unrequested penetration test.

Record the actual version, environment and untested boundary. A local successful
route does not prove deployed route handling. A release-readiness check may need
deployment-specific evidence, but Verify adds no authority to deploy or promote.
