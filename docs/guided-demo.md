# Guided demo style

How to write a walk so the rendered video guides the eye, and how to check it. Read this before you write or change a walk, and before you deliver a walkthrough.

The renderer draws every effect below. Never build your own composition, overlay or re-timing for a capture. If an effect is missing, add it to the renderer (`packages/demo/remotion/src/projects/walkthrough-video`) so every agent and every video gets it.

## What the viewer sees

Each step makes one point: its caption, and its line when narrated. The screen shows that point while it is said.

| Step | On screen | What the walk records |
|---|---|---|
| Clicks a control | The pointer glides onto the control. An amber outline draws itself around it. The video holds while the caption is read or the line is spoken. Then the click plays, with a ripple. | Nothing extra: `rec.click` logs the control's box. |
| Shows something (a card, a row, a total, a filter) | An amber outline draws itself around the region. The pointer parks beside it. The video holds on the step's last frame. | A `focus` on that region (below). |
| Waits for the app | Fast-forwarded behind a speed badge. | A `'wait'` step that ends on the finished screen. |

A step either shows or clicks, never both, so a link that opens records takes four steps:

1. **Show** the number on the source page: a focus on it.
2. **Click** the link.
3. **Wait** while the page loads.
4. **Show** the same evidence on the result page: a focus on it, with a caption that says what matches, for example "Seven pending, as on the dashboard".

The walk format (`rec.step`, `rec.click`, where walks live, what runs before the first step) belongs to the project's capture tool: see its `--help` or its own docs.

## Recording a focus

A step's `focus` lists `{ box: { x, y, w, h }, fromMs, toMs }`: viewport CSS px and capture-clock ms, inside the step. The contract is in `docs/capture-contract.md`.

The shared recorder provides `rec.show` for checked business results and `rec.focus` for
display-only targets. Do not implement another bounding-box helper in each adapter.

```js
await rec.step('summary', 'Two invoices, $2,000.00', 'action', async () => {
  await rec.show({
    count: {at: countField, integer: 2, target: countCard},
    total: {at: totalField, dollarMinor: 200000, target: totalCard},
  })
})
```

Replace these illustrative locators with the actual app fields/cards. The shared helper checks
all declared values, highlights their whole target group and saves named geometry for offline
refinement. A multi-match target covers all matches. Use `rec.focus({heading: locator})` when
there is no business value to assert. See [project adapters](project-adapters.md#checked-evidence-and-reusable-focus)
for the API and [presentation revisions](presentation-revisions.md) for saved `focusTargets`.
Call these helpers last in a separate showing step; keep clicks in their own steps.

- **Outline the evidence the caption names:** the count, the total, the row, the filter chip. An outline around a whole page or table says nothing.
- **Include the evidence's whole element:** its badge and its number, not only the label. The pointer parks just outside the box, so a badge left outside it gets covered. A text locator finds the innermost span. Locate the row, card or pill that holds the text instead, by its test id or role, or with `.locator('..')`.
- **Use one evidence group per step.** Include all claimed fields on that screen: count, amount and status when those are the claim. For a comparison across two screens, use a step on each screen.
- **End every showing step on a result page with a focus.** Otherwise the pointer stays where the last click left it, which on the new page can be over a row's buttons.

## Pacing

- **Narrated:** the voice nearly fills the video, with one or two sentences per step. The renderer holds each step for its line plus 0.4 s, so a walk needs no long waits of its own.
- **Silent:** each step stays up for its caption's reading time.
- **Length:** one topic per walk. Let the actual feature determine the length: a two-screen interaction may need only 15–30 seconds; a larger walkthrough may need 1–3 minutes. Do not add steps or holds just to meet a duration target. To get one file, join rendered walks; each walk is one chapter.

## A held frame must be worth holding

The renderer holds a clicking step just before its click, and a showing step on its last frame. Make those frames finished:

- **Before a click:** the control is visible and settled. No spinner, skeleton or toast covers it.
- **At the end of a showing step:** the data has loaded. Never end on a blank page, a "Loading…" splash, skeleton rows, an "Empty" placeholder that is still loading, or an error. Wait for the app's finished signal in a `'wait'` step before it.
  - Check first that the new page is showing (its heading or badge), then that its rows have appeared, then that the progress bar is gone. Before the new page renders, "no progress bar" is already true.
  - When a caption states a number, have the walk read it from the page and fail if it differs.
- **The pointer:** it rests only on the control being clicked or beside the evidence. It never rests on or next to a destructive control (Reject, Delete, Approve), and never over the text being read.
- **Captions:** each claims only what its frame shows, in plain words under about 8. When a caption says two figures match, both are outlined, one on each screen.

## Check before delivering

Render with `--stills` and look at every file in `stills/`, one per step at its hold. Then watch the last second of each wait. Look for:

- a held loading, blank, skeleton or error frame;
- an outline that misses its target or circles the whole page;
- a caption the frame does not prove;
- the pointer covering the evidence or resting near a destructive control;
- data the reader should not see.

For caption/highlight problems on correct UI evidence, including the **first** visual review,
use `aaron-demo inspect <run>` and a `revise` patch, then render the derivative. Keep the original
capture. Saved target geometry avoids another app visit merely to measure boxes.

If the evidence is loading, wrong, obscured or requires different actions/timing, repair the
walk's settled condition and capture a new take. A presentation revision cannot repair that
source evidence. Never patch or cut the video to hide a business or UI problem.
