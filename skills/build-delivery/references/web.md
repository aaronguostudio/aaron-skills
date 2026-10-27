# Websites and applications

Read for web/app work; apply only the standards relevant to the task. Use the
project's architecture, routes, components and engineering checks. These are
delivery defaults, not a required technology stack or permission to redesign.

## Continue the project's design and development process

Find the relevant screen, components, tokens and interaction conventions before
creating new ones. Check whether the accepted design covers the real content,
necessary states and target sizes. Resolve gaps in the changed experience using
those patterns. With no established pattern, propose a small coherent direction
through the actual task; do not create a design-system project by default.

Use the team's chosen planning, implementation, review and testing methods. Put
missing acceptance examples into its existing task or tests rather than starting
a second process. If it uses TDD, preserve that sequence. Otherwise choose checks
for the changed behavior without imposing a new methodology or test framework.
Required repository gates still apply. Missing product policy needs an owner;
discoverable component, route or test facts should be resolved from the project.

## Address meaningful destinations and views

A page or view with independent use should normally have a stable entry URL.
Represent safe state needed to share or resume that view, such as selected tab,
filters and sorting, in the URL or an appropriate saved-view mechanism. Work with
the existing router rather than introducing a second state authority.

Example: `/requests?status=pending&sort=oldest&page=2` expresses a view that a
colleague can reopen. It does not freeze the records or their order over time.
If the task requires the exact historical result, clarify whether it needs a
snapshot; do not silently add one.

Check applicable consequences:

- A direct load and refresh restore the intended view, including on the deployed
  route configuration. Navigation history returns to sensible prior views;
  avoid adding a history entry for every keystroke.
- Defaults, invalid values, changed filters and pagination resolve coherently.
  A removed record, expired view or unsupported parameter yields a useful state.
- An authorized recipient can open the destination. Authentication returns them
  to it when supported. Resolve access and tenant context against the recipient's
  actual permissions; a URL is never a grant of access. Do not put credentials,
  sensitive search text or unsaved private form content into a URL.

Not every modal, hover or temporary control state needs an address. Choose what
matters for navigation and continuation. Saved views, drafts and cross-device
resumption are separate capabilities; add them only when the task calls for them.

The [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
and [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
document browser mechanisms. Match implementation to the actual router and host.

## Complete the task and its necessary states

Follow the user from the entry point through the resulting state. Identify the
authority for success: a saved record, acknowledged job or completed transaction
rather than a click or optimistic message. Exercise that boundary when the scope
includes it; clearly distinguish a frontend prototype from a connected system.

Validate user input with useful feedback and enforce integrity/access at the
authoritative boundary using the project's existing mechanisms. Client controls
alone do not enforce permissions. Reuse established schemas and error meanings;
do not create conflicting client/server definitions. Treat route identifiers,
tenant selection and imported values as inputs, not proof of authorization.

For changed interactions, provide the relevant loading, empty, validation,
failure and success behavior. Prevent accidental duplicate work and preserve
recoverable user input when appropriate. A retry should not unknowingly duplicate
a business action. Discover existing cancellation, conflict and concurrency rules
before implementing them; do not invent policy to fill an undecided branch.

Use realistic content and applicable data scale. A list designed with three short
names may fail with long labels or many records. Search, filters, totals and
export should use consistent definitions where those features already exist or
are requested. Respect established locale, units, dates and time-zone meanings.

## Preserve data meaning across implementations

Discover the existing definitions of record identity, eligibility, balances and
scope before extending a data-backed feature. Use the complete business key for
joins, lookups and drilldowns, including contextual parts such as organization,
period or category where they belong to that identity. A convenient identifier
may repeat in another context. Include a collision example when an incomplete
key could attach another record's data.

Live, mock and fallback adapters should satisfy the same observable business
contract. Reuse shared examples across them where practical, while checking the
actual mapping or query boundary of each changed adapter. A fake client that
returns the expected rows without applying the query cannot prove its filtering
or joins. If a real service is unavailable, use the project's contract/query
checks or an appropriate local relational probe and state what that leaves
unverified; do not add a competing test framework by default.

Changing one filter or status option should preserve independent record-type,
access and scope constraints. Check a representative combination that could
broaden the result, rather than validating each control only in isolation.
For amount-bearing work, derive expected values from the agreed business rules:
reconcile rows, related transactions and full-filter totals, keeping page totals
distinct. Cover applicable signs, rounding, paid/unpaid states and alternate
scopes supplied by the project. Fixtures must reconcile too; do not hard-code
plausible balances that contradict their underlying records. Keep expected
results independent of the code being tested and use the existing test tools.

## Choose tests that prove the changed behavior

Use existing tools at the boundary that can detect the failure: unit checks for
nontrivial rules, integration checks for changed contracts/state, and an E2E path
when a consequential user task crosses components or services. Reuse coverage
that already proves the requirement. A small copy edit does not justify a new
E2E suite; a persisted workflow is not proven by a screenshot or mocked save.

For a defect, establish a failing reproduction where practical, then verify the
fix and affected existing behavior. Include a relevant failure/recovery example
when the change can lose input, duplicate an action or misreport success. Avoid
tests that only mirror the implementation or assert its preferred wording.
Separate mocked dependencies from connected-system evidence. Record unavailable
environments or unrun checks instead of treating them as passes.

## Connect additions to existing registration and CI

Inspect the mechanisms that make new modules reachable and checked. Depending
on the project, these can be route/module registration, service injection,
exports, test collection or CI path-to-suite selection. Use the existing source
of truth and ownership conventions; update only the integration points needed
for the change. Do not add a parallel registry or broaden a deployment pipeline
to replace the project's existing test workflow.

With path-based test selection, exercise the selector for the complete diff and
for representative later edits to the new modules or tests on their own. Include
supporting service and type/interface files when those are separate owners of
behavior or contracts. A shared translation/configuration change may select every
suite today and conceal an unmapped new module. Use the existing selector or
discovery check to establish the expected selection, including intentional
exclusions; do not settle for seeing a new file in the repository or manually
running its tests once. Keep mappings as narrow as the existing convention allows
without silently dropping affected checks.

## Preserve compatibility and plan exposure

For changes to an existing product, identify affected callers, stored data,
configuration and entry URLs. Preserve supported contracts or make the required
migration/version choice explicit. Check both the changed path and an affected
existing path. For schema changes, consider old and new application versions
coexisting; rolling back code does not necessarily undo written data.

Use an existing feature-flag mechanism when the project requires it or when
staged exposure, parallel behavior or a meaningful operational fallback needs it.
For a low-risk compatible change it may be unnecessary. Do not add a flag service
just to satisfy a checklist. When using a flag, establish the initial state and
intended audience, exercise enabled and disabled behavior, and check that direct
routes/API calls retain their required access controls. A hidden button is not
an authorization boundary.

For an authorized rollout, identify the existing health/business signals that
would reveal a problem, the exposure/stop condition, and the supported rollback
or forward-repair path. Preserve repository deployment and approval rules. If
rollout is outside scope, prepare only what the next operator needs and state
what remains unverified. Do not add analytics, infrastructure or production
writes solely to manufacture evidence. A flag-off path may stop new use while
leaving already-created data or jobs; make that distinction when it matters.

## Inspect the experience

Check the relevant device sizes, keyboard path, focus after navigation/errors,
readability and motion. Reuse accessible controls. Reference
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) for concrete accessibility criteria;
a few spot checks do not establish conformance.

Walk the changed scenario through UI, request, authoritative state and rendered
result where applicable. Include a useful failure case, refresh or revisit when
persistence is promised, and the normal path affected by the change. Inspect
console/network failures that affect this flow. Use local or seeded test data
and keep real business writes within the task's authorization.

Record the environment and important untested boundary. A local route check
does not prove production hosting works; passing unit tests does not establish
that a recipient can use the running application.
