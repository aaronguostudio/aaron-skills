# Stakeholder messages

Read when preparing an update, customer reply, announcement, how-to or decision
request. Write the actual message in the requested language and channel style.
Reuse established terminology, tone and supplied signature. Do not infer an
author from a username, path, example or tool identity.

## Lead with what matters to this reader

Connect the change to the reader's task, then provide the evidence and next
action they need. Include technical details when they help that reader act or
assess a consequence. A business owner may need impact and an acceptance choice;
an operator may need access and exception handling; an engineer continuing the
work may need the version, dependencies and known failure. Do not create a separate
message for every possible audience when only one was requested.

For a how-to, use the actual interface labels and a short path to the result.
For a decision, state what is settled, the choice still owned by the receiver,
the recommendation if useful and its tradeoff. For an awareness-only update,
don't add an unnecessary request for approval.

Make any requested action easy to answer or perform. Use an agreed owner or date
when supplied; do not invent a deadline, promise support, offer a meeting or
assign responsibility merely to make the message sound complete.

## Preserve applicability and uncertainty

Use the actual environment, audience/permissions and release state. If only a
local or test environment is verified, don't say users can now use the feature
in production. A feature behind a flag may be deployed without being available
to everyone. A prepared report can be ready for review while its recommendation
still needs a decision.

Keep useful limits near the claim they qualify, without turning the message into
an internal test log. State the consequence in the reader's language. Distinguish
an excluded capability from a failed one and a proposal from a promise.

## Keep the body useful on its own

Put the important result and action in the text. A screenshot can show the control;
a video can explain a sequence; neither should hide the only explanation of what
the receiver is being asked to do. Use descriptive links and captions. Avoid
unnecessary repetition between the body, release notes and attachments.

An authored fictional example, assuming the pilot is actually verified in its
test environment, could read:

> The test repair queue now keeps Pending and Oldest first when its link is
> reopened. This lets staff return to the same view without selecting the filters
> again. The link restores the view conditions; records can change over time.
> Please try the supplied test link and tell us whether it fits your morning check.
> Production rollout is still pending.

The example supplies no real URL, recipient approval or rollout date. Replace
it with the current task's actual facts; don't copy its acceptance request into
an awareness-only note.
