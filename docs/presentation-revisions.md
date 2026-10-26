# Revise captions and highlights without recapturing

Optional [data masking](data-masking.md) uses this same derivative workflow.
A patch may contain a top-level `masks` array, alone or alongside `steps`.
It replaces all masks, `[]` clears them and omission preserves them. The changed
capture manifest is hashed in `revision.json`. Original media and raw shots stay
unredacted; share only reviewed rendered outputs.

When the recorded UI, actions, timings, and business assertions are still correct, change presentation metadata without visiting the app. Keep the original capture and create a separate derivative:

```sh
aaron-demo inspect <passed-run>
aaron-demo revise <passed-run> <patch.json> --out <new-run>
aaron-demo render <new-run> --stills
```

For caption/highlight edits, `patch.json` contains a `steps` object keyed by existing step IDs. Each entry may replace `caption` and either `focus` or `focusTargets`:

```json
{
  "steps": {
    "review": {
      "caption": "Review the selected invoices",
      "focus": [{"box": [120, 250, 480, 160], "fromMs": 12000, "toMs": 14000}]
    }
  }
}
```

For captures recorded with `rec.show` or `rec.focus`, prefer saved target names:

```json
{"steps":{"batch-summary":{"focusTargets":["count","total","status"]}}}
```

`inspect` prints every step's caption, named target boxes, original capture-clock intervals,
exact-check declarations and coverage problems. It opens no app/browser and remains readable
when a checked field is missing from a highlight, so that problem can be repaired offline.
`focusTargets` builds the union of **all boxes** for the chosen names at their shared recorded
interval. Unknown/duplicate names, targets from incompatible intervals and omission of a
`rec.show` checked target are refused. Explicit `focus` boxes on checked evidence groups must
also cover all declared targets for their recorded intervals. The public render command refuses
incomplete checked groups before starting Remotion. Legacy captures without target/evidence
metadata remain supported but cannot acquire those guarantees retroactively; use verified
explicit boxes for their presentation edits.

This workflow applies to fixes discovered during the **first visual review**, not just a later
user revision. There is no reason to capture a second take solely to move a highlight or edit
its caption when the evidence is correct. Update the adapter for future recordings too.

Use the step IDs and original capture-clock milliseconds in `steps.json`. The example coordinates and times must be replaced with values verified against your recording. Focus boxes use viewport pixels, fit entirely within the viewport, and remain within that step's original time range. `focus: []` removes that step's focus highlights. Click outlines continue to use the recorded click targets; this command cannot move clicks. Inspect the revised frames, especially changing UI and wait tails, to verify that highlights still point at the evidence.

The output must be a new folder outside Git, without overlap with the source. It receives independent copies of the original capture manifest, raw video and referenced screenshots, plus modified `steps.json`. `revision.json` records the patch, parent capture path, SHA-256 of all inputs and the derived steps. No browser is launched, no business write repeats, and no business assertion is rerun. This provenance is local metadata, not a cryptographic attestation. Keep the source capture; do not delete it after a revision.

A revision is not a fresh verification of application state. A caption that changes a count, amount, or business claim must remain supported by the existing recording and assertions. If the UI evidence, actions, timing, or correctness need to change, repair the walk and capture a new run. Also update the walk's captions/focus for future recordings without replaying it solely to render this revision.

Voice, script and narration-language changes can reuse a passed capture directly with the render narration options. See [narration](narration.md).
