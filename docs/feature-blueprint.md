# Shape

Shape (`feature-blueprint`) turns a request into a useful next delivery: a focused
reply, customer confirmation, design, flow, conceptual model or execution handoff.
Start with the user's actual request. Small tasks can stay small; no packet,
ordered phases or fixed artifact count is required. The skill has no runtime or
service dependency. Standard v1.0.0 setup includes Shape alongside Build, Verify, Capture, Film,
Deliver and Share. Standalone use still needs no media runtime.

## Substantial proposal pages

Use the self-contained [template](../skills/feature-blueprint/assets/review-page.html)
for substantial web proposals. Replace the fictional workshop content while
preserving the five short sidebar/heading labels: Requirements, Operating model,
Prototype, Data model and Next steps. An explicitly requested format or another
medium can use its own conventions.

- Requirements combines the requested additions with their practical use in one list.
- Operating model explains roles, timing and follow-through in one account.
- Prototype provides a connected, inspectable design on an overview/focus canvas.
- Data model labels existing concepts, extensions, new records and calculated
  results with their relationships directly in the diagram.
- Next steps groups what can start, what needs confirmation and what is outside
  the first version. Keep longer rationale and source checks in local disclosures.

Keep the navigation sticky and highlight the current section. The dependency-free
canvas supports named frames, focus, pan, zoom and expansion; application content
and the reusable controller are separate. Preserve usable targets, control
padding, keyboard access and narrow-screen navigation. Native designs and other
requested media retain their own conventions.

Each explanation has one home. Shared demo, period/currency, access and saving
assumptions belong in a collapsed disclosure beside the canvas. Use a short basis
label or local Proposed marker where necessary; show a normal save through the
updated state. Preserve actionable errors. Do not repeat banners, default reminders
or save explanations across every frame.

## Evidence and decision status

Keep observed facts, proposals, interpretations and confirmed decisions distinct.
Inspect exact source wording before claiming one source corrects another. If two
sources repeat an ambiguous term, its plausible interpretation remains unresolved.
Keep a short quote and source location in relevant detail, and preserve that
status in dependent requirements, designs and handoffs. Source access does not
authorize implementation, contacting people or publication.

Read the actual delivery as its receiver before handoff. Remove duplicate
explanations, check the exact five labels for the proposal format, inspect the
visual at a usable scale and verify its meaningful interactions. A structure or
format check is not evidence of recipient acceptance. When browser inspection is
unavailable, finish the useful artifact and disclose that verification limit.
See the [delivery guidance](../skills/feature-blueprint/references/delivery.md),
[communication examples](../skills/feature-blueprint/references/communication.md)
and [uncertainty guidance](../skills/feature-blueprint/references/workflow.md).

## Export and use

Export the allowlisted Shape files to a new directory outside the checkout:

```sh
python3 packages/feature-blueprint/export.py --out /path/to/new-shape-export
```

Copy only the exported `skills/feature-blueprint` folder into an unused skill
location for the chosen agent and refresh its discovery. Preserve unrelated
skills and personal configuration. Invoke `$feature-blueprint`; the display name
is Shape. A browser is sufficient for the proposal template; no npm install,
external font, service or canvas library is required.

The authored [lightweight example](../examples/feature-blueprint/lightweight.md)
and [Fieldnote case](../examples/feature-blueprint/README.md) remain optional
historical references, not scripts to follow or customer approval. The old case
reader and [packet contract](../skills/feature-blueprint/references/packet.md) are
for explicit requests that need them; their schema does not govern ordinary use.

Keep client material, recordings, logs and private evaluation artifacts outside
public checkouts. Authored examples, deterministic tests, independent model
behavior and real recipient acceptance are separate evidence.
