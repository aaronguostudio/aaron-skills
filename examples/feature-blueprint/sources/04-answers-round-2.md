# S4 · Clarification round 2 · 2026-10-04

**Scripted fictional answers prompted by the first flow sketch.**

Q4. What if a click is retried or two reviewers act? Each write supplies an
operation ID and the expected record version. An exact retry by the same actor
returns the previous result once, with no duplicate event. Reuse of an operation
ID with a different payload fails. Other stale writes fail and tell the user to
refresh; they never overwrite a decision. Check identity/visibility before
returning even a cached result. Production must enforce this atomically on the
server; the prototype simulates it in browser memory.

Q5. How much history survives resubmission? Every successful save, submit, approve,
reject and revise increments the version and appends an event, including actor,
from/to state and optional rejection reason. Rejection needs 5–240 characters.
Revision clears the current reason but retains it in history. Invalid, stale
and duplicate operations add no events.

Q6. How will delivery failures be handled? A failed write leaves the previous
record unchanged. The UI shows an error and a retry action; pending actions are
disabled. The prototype simulates delay/failure; refreshing the page resets the
fixture. Durable storage, network reconciliation and actual sign-in are build work.

Q7. Email? Defer email from the pilot. Product owner must define recipients,
consent and delivery behavior before a later notification slice. In-app status
and history are sufficient for this design. This is nonblocking for the pilot.
