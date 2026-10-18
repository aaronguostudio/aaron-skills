# Fieldnote: the complete Shape reference

Fieldnote Studio and every person, meeting, requirement and answer here are
invented. No private project material was used. This is an authored worked
example, not an agent benchmark or a claim of real product acceptance.

This comprehensive case is retained as one useful response to a request with
several interacting uncertainties. It is not a required output checklist.
Compare it with the [small save-feedback request](lightweight.md), which uses a
short response instead of the packet, diagrams and full application prototype.
The local [reader](index.html) opens on that comparison. Actual design work can
remain in the agent's available native Canvas/design tool or existing project.

## Follow the case

1. Read the [request](sources/01-request.md) and
   [meeting](sources/02-meeting.md). They leave approval, editing and scope unclear.
2. Inspect [round one](sources/03-answers-round-1.md). Fictional answers replace
   the meeting's open-approval and post-submission-edit suggestions.
3. Sketch the state flow. It exposes retry, stale review and rejection-history
   questions answered in [round two](sources/04-answers-round-2.md).
4. Inspect [blueprint.json](blueprint.json), the canonical packet: seven questions,
   seven decisions/rules, four states, five transitions, four entities, ten
   acceptance scenarios and three implementation slices. Q7 is deliberately
   deferred and nonblocking; notifications are outside the pilot.
5. Render Markdown and Mermaid views using the
   [local instructions](../../docs/feature-blueprint.md). The generated handoff,
   flowchart and entity model are derived from this packet without copying a
   real transcript into the repository.
6. Open the local [interactive case](index.html) via HTTP, choose the full Fieldnote reference, then use its six views
   to trace the evidence, clarification, workflow, model, prototype and handoff.

The [model](model.mjs) owns simulated transitions. The UI reads the packet for the
case narrative, rules, acceptance and slices. The workflow graphic uses a case-specific layout and reads its states,
transitions and rule labels from the same packet, checked against model behavior
in tests.
No external libraries or generated raster assets are needed.

## Try the journey and the edges

- As Jules, save or submit REQ-104. A short purpose or invalid date range fails.
- Switch to Morgan; select Jules's request and reject it. A reason under five
  characters fails. A valid reason is kept in history.
- Return to Jules; revise the same request, adjust its fields and resubmit.
  Morgan can now approve it. Approval is terminal and reserves no stock.
- Morgan's own seeded submission has no review actions. Casey's draft is hidden
  from Jules and Morgan. Casey can see and edit that draft.
- Enable **Fail next write once**, then perform an allowed action. Nothing is
  saved; **Retry last action** retries the same simulated operation.
- Use **Simulate stale view**, attempt a write and inspect the conflict. Use
  **Refresh request** to recover. The control displays an older version; the
  model tests additionally exercise actual conflicting writes.
- **Empty scenario** resets to an empty list. **New request** creates an unsaved
  draft with version zero. The first save or submit adds its first event.
- Reload or **Reset** to restore fixtures. No request state is persisted.

The three fixture identities, role switching, latency, error injection and
browser-memory writes are simulation tools. There is no real sign-in, server
authorization, database or email. Pending buttons are disabled; a failed write
preserves the form for retry. Switching requests or roles discards unsaved form
changes in this prototype. Seeded requests intentionally have no earlier history.

## What reaches a developer

The generated handoff includes the source ledger, answers, decisions, rules,
diagrams, acceptance scenarios and slices. B1 describes server identity and
atomic storage; B2 covers the user/reviewer journey; B3 covers recovery,
accessibility checks and a flag-controlled pilot/rollback. Exact database
migrations, identity integration, real-session security tests and deployment
remain build work. An independent builder has not yet been given only this
packet; do not interpret structural readiness as that evidence.
