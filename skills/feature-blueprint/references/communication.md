# Communication that carries intent

Read the example relevant to the current receiver. These are authored fictional
illustrations, not tested customer conversations, required scripts or templates.
The details below are supplied for each example; do not reuse them as facts in
another project. A useful response can be much shorter than these examples.

## Follow up on a proposed solution

**Request:** "Build a maintenance dashboard. We keep chasing people for updates."

**Available context:** Team leads currently record job status in a shared list.
The request does not establish what people cannot find or whether the list is
out of date.

**Possible customer reply:**

> I understand you want people to find maintenance progress without chasing a
> teammate. The shared list already has job statuses, so I want to understand
> where it falls short. Could you walk me through the last time someone had to
> ask for an update—what did they need to know, and what happened next? That will
> help us decide what the dashboard needs to make visible.

The reply makes a provisional interpretation inspectable and asks about a real
incident. It leaves space for missing ownership, stale data or difficult access
to emerge. It does not assume that a dashboard is wrong or ask the customer to
discover technical facts already available to the agent.

## Confirm a scope and a meaningful tradeoff

**Supplied facts:** A fictional workshop organizer has confirmed a registration
page with name, session choice and an on-screen receipt. The date is fixed.
Email receipts are proposed but unapproved. The existing email service is usable;
choosing whether email is part of this delivery belongs to the organizer.

**Possible confirmation:**

> For Friday, the registration page will collect a name and session choice,
> then show a receipt on screen. I recommend keeping email receipts for a later
> delivery so we can focus this round on registration and capacity checks. The
> tradeoff is that attendees will need to keep the on-screen receipt. Is that
> enough for Friday, or does receiving an email need to be part of this release?

This preserves confirmed scope while exposing a recommendation for decision.
It does not describe email as rejected, approved or technically impossible.
The actual draft belongs in the conversation; sending it needs the task's
authorization. Do not add a confirmation gate to decisions already settled.

## Carry a correction through the whole account

**Earlier interpretation:** "The facilities team wants a phone alert for every
new room request."

**Correction:** "The desk is staffed during the day. We only need to spot requests
that are still unassigned at the morning check. No phone alerts for this pilot."

**Revised account:**

> The pilot should help the desk spot unassigned requests during its morning
> check. Show requests with no assignee in the existing queue. Phone alerts are
> outside this pilot. We still need the desk lead to decide whether a request
> deliberately placed on hold belongs in that view; that choice need not block
> a prototype that labels the unresolved treatment explicitly.

The correction changes the trigger, audience, proposed behavior and exclusions.
An old notification acceptance example or implementation task would also need
updating. Editing only the opening summary would leave a contradictory handoff.
The hypothetical prototype must not quietly settle the hold policy.

## Give the builder enough to act

**Confirmed scope from an existing planning session:** Add an inline warning to
a fictional room-booking form when a saved reservation has changed since the
form was opened. The server already rejects stale updates. The user has chosen
to retain typed values and offer a refresh; automatic merging is excluded.

**Possible execution handoff:**

> Help the person recover from a stale booking without losing their edits. Use
> the existing stale-update response to show an inline warning and a Refresh
> action. Keep the typed values visible until they choose Refresh; explain that
> refreshing replaces them with the current saved reservation. A failed stale
> update must not show success or change the saved reservation. Do not add an
> automatic merge.
>
> Check two people opening the same booking, one saving a change, then the other
> trying to save: the second person sees the warning with their edits intact.
> Refresh then shows the current saved values. Confirm the normal successful
> save still works. The agreed behavior is ready for the implementation planner;
> component placement can follow the existing form conventions.

The builder receives the purpose behind retaining values and observable behavior.
They can use an engineering workflow to choose implementation details. Shape
does not reopen the settled merge decision or invent an architecture. If the
server behavior had only been proposed, the handoff would label that dependency
instead of asserting it exists.

## Keep a clear request small

**Request:** "Replace 'Send' with 'Submit request' on this form. Nothing else."

**Response:** "Use 'Submit request' for the button label. Keep its current action."

There is no consequential ambiguity to explore. A question, diagram, framework
switch or full brief would add work without improving the next action.

## A receiver check

Before handing over substantial work, read it from the receiver's position:
can they identify the next action and its purpose, distinguish settled decisions
from proposals, and see which unanswered question actually blocks them? Use a
concrete behavior example to expose missing meaning where helpful. The check
can be a quick reread; it does not require another agent or a separate document.
