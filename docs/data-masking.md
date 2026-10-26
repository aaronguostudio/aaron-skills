# Optional data masking

Use masking in Capture, Film and Share when it serves the user's audience and
data requirements. Ordinary demos do not need a privacy questionnaire or a
separate approval checkpoint.

## Decide with context

- Follow the current request and relevant project rules. Reuse decisions already
  made in this task; a later correction replaces the earlier choice. Do not save
  a permanent project preference unless requested.
- Proceed autonomously when the intent is clear or there is no concrete signal
  that masking is needed. Internal demos, declared mock/synthetic data and public
  examples normally proceed unchanged. Names, email-shaped text, financial
  amounts or a finance-industry label alone do not require masking or a question.
- Treat Dev/UAT as context, not proof of synthetic data and not a trigger to ask.
  If the user has not specified an audience or data source and nothing material
  suggests a problem, continue with the demo.
- With an explicit masking request, a project rule, or clear real customer data
  in an external/public demo, apply the known scope and make the ordinary preview.
  Mask only relevant fields; preserve values needed to explain the workflow when
  permitted. Mention the choice briefly with the preview, without a new approval
  gate. If a consequential ambiguity remains, ask one focused question and keep
  independent work moving. Do not ask again for every field or scene.
- Clearly exposed live credentials or secrets deserve targeted intervention even
  in an internal demo. Keep them out of deliverables and provider-bound scripts;
  do not echo the value in warnings. Synthetic placeholders are not live secrets.

The agent may use the brief, existing project context, observed field labels,
saved target geometry and frames already inspected for the demo. No additional
cloud detector or OCR service is required. Automatic sensitive-data detection and
moving-object tracking are not implemented; do not claim a complete scan or a
guarantee that nothing was missed.

## Revise without recording again

The installed runtime supports explicit **solid opaque rectangles** in the app
viewport. Blur, pixelation, text replacement and automatic tracking are not
available. Masking changes presentation pixels, never application values or
business assertions. Reuse the passed capture:

```sh
aaron-demo inspect <passed-run>
aaron-demo revise <passed-run> <mask-patch.json> --out <new-run>
aaron-demo render <new-run> --preview
aaron-demo render <new-run> --stills
```

Use the same presentation/audio options as the accepted film. The normal preview
is sufficient; do not add a mandatory masking approval. Inspect frames where
masks start, stop or move, and through waits, scrolling and gaps.

`mask-patch.json` is external run material:

```json
{
  "masks": [
    {"box": [120, 180, 320, 44], "fromMs": 1000, "toMs": 9000}
  ]
}
```

Coordinates are viewport CSS pixels; times use the original capture clock from
`steps.json`, including gaps. Inspect actual frames before selecting them; these
example values are not defaults. A box can also be `{ "x":120, "y":180,
"w":320, "h":44 }`. Each patch **replaces the entire mask list**; omitted `masks`
preserves it and `{"masks":[]}` removes it. Caption/focus edits may accompany
`masks` in the existing `steps` patch. `inspect` shows the active mask list. The
derivative records the input hashes and changed capture hash, retaining originals.

Masks are burned into MP4 pixels and therefore into the rendered `--stills` and
body preview, using the same transform as the app in every layout. They have no
fade-in or rounded corners. Source-clock timing covers normal playback, holds,
fast-forwarded waits and gaps, with one source-frame margin at boundaries.
Held screenshots have no reliable capture timestamp: all configured rectangles
are conservatively applied to each held screenshot. Check that these do not hide
needed evidence. For changing positions, provide verified boxes/intervals or a
larger safe region; a fixed box does not follow scrolling content by itself.

## Deliver the intended surfaces

For a masked delivery, use the new MP4, its rendered `stills/` and reviewed body
preview. Share should embed those rendered stills, not `shots/` from the capture.
Review captions, title/cover text, narration and imported audio separately for the
same requested scope before any cloud speech call or delivery. Pixel masks do
not remove words from those surfaces. Use a new output directory so older takes
cannot be mistaken for the masked version.

The original recording, capture/steps/revision manifests, evidence values and
`shots/` remain unredacted local working material, even in the derivative folder.
Do not send the capture folder as a sanitized package. Keep it outside Git with
the existing private permissions. A later request to add, resize or remove masks
reuses this evidence; it does not repeat business writes. User corrections need
no new permission to create another local derivative.
