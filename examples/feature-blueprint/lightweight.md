# Small change: make a draft save visible

Entirely fictional brief and project context, authored for this comparison.
This is a short example of an agent response, not a recorded independent model
run or a measured improvement over a baseline.

**Request:** “When I save a draft, show a quiet confirmation next to the button.
Keep me in the form.”

**Supplied project context:** The existing save action waits for acknowledgement,
disables repeated saves while pending, and keeps form values on failure. The
project already has a small inline status style and an error message. No data,
permissions or navigation change is needed. These are fictional supplied facts,
not claims about a real project's code.

## Example response

Reuse the existing save handler and inline status component. Show “Saved” beside
Save draft only after acknowledgement, without moving focus or leaving the form.
Clear that confirmation on the next edit. Keep the existing pending and error
behavior; a failed save must not show success or lose the draft.

Check with one successful save, one failed save and an edit after success. If a
user edits while saving, distinguish the saved snapshot from unsaved changes.
No clarification is needed for the supplied brief: the context already answers
where feedback goes and when success is known. The next step is to wire that
status into the existing component and verify those interactions.

---

That short response is the handoff. It does not require a separate source ledger,
ID system, flowchart, entity model, complete-case JSON or multi-page prototype.
The local comparison viewer adds a tiny before/after component so the user can
inspect this example. It is a review aid, not a mandatory skill deliverable.
An actual agent should use its available native design tool or project component
when a visual helps, keeping the user's visual direction and editable artifact.
