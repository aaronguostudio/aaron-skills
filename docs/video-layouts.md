# Brand, theme and video-page layouts (presentation v2)

This contract is available in current source. Existing version-1 files and plain
or legacy-brand renders keep their layout and color defaults. Upgrade deliberately
by setting `version: 2`; invocation IDs and narration settings do not change.

## Choose through conversation

The agent carries the audience, accepted decisions and must-show scenes forward
from the conversation. Map each scene to a capture step/evidence ID. A completed
record does not replace the recipient's interaction. Report an unavailable state
and resolve the session or agree on a clearly identified synthetic fixture; never
invent a missing scene. This checklist grants no signing, sending or payment rights.

Resolve branding from an approved pack, official application/design-system assets,
or a confirmed visible mark, in that order. Distinguish corporate/product identity
from tenant/user avatars and recording-tool branding. Never generate a replacement
logo. Keep its original bytes, aspect ratio, source and treatment outside Git.

Recommend a layout and preview the cover **and** a content frame before the full
render. Do not require the user to author JSON. Preserve an existing style choice.

## External configuration

```json
{
  "version": 2,
  "template": "professional",
  "title": "A useful workflow",
  "subtitle": "Review the details before confirming.",
  "cover": {"preset": "blue-portal"},
  "theme": {"preset": "blue-lavender"},
  "brand": {
    "name": "Northstar",
    "logo": "assets/mark.png",
    "logoVariants": {"light": "assets/mark-white.png", "dark": "assets/mark-blue.png"},
    "logoProvenance": {"source": "Approved synthetic brand pack", "role": "corporate", "verified": true},
    "logoContainsName": false
  },
  "layout": {
    "screenPlacement": "left",
    "annotationMode": "transcript",
    "annotationRatio": 0.3,
    "padding": 24,
    "gap": 16,
    "fit": "contain",
    "canvas": {"width": 1600, "height": 1000}
  }
}
```

`screenPlacement` means the recorded application, not the transcript:

| Application screen | Annotation region |
| --- | --- |
| `top` | Bottom |
| `bottom` | Top |
| `left` | Right |
| `right` | Left |

Omit `layout` to retain the native viewport and 96px bottom band. When `layout`
is present, its `screenPlacement` is required. Defaults: caption mode, zero
padding/gap, contain fit, annotation ratio 0.18 for top/bottom or 0.3 for left/right.
Ratio is 0.15–0.5; padding/gap are 0–80 pixels. Without `canvas`, the output expands
around the native screen. With `canvas`, use even dimensions from 320–3840;
the screen scales uniformly and letterboxes. Regions that cannot fit readable text
fail with instructions to increase the canvas/panel or reduce padding.

All recorded video, screenshots, pointer positions, click outlines and multiple
focus boxes use the same capture-space transform. Evidence coordinates stay native.
No stretching, cropping, browser replays or application recoloring occurs.

`caption` shows the short step caption, shrinking to fit and refusing overflow.
`transcript` uses the complete saved/imported narration text, falling back to the
step caption when no clip applies. Long text is paginated without ellipsis. Pages
advance across the clip's measured duration (including clips spanning waits);
these are page-level cues, not invented word timestamps. Imported audio is never
resynthesized or sped up by a layout change. Language, voice and pace are independent.

## Theme precedence

V2 resolves one palette for intro, annotation and outro. Named themes are
`blue-lavender` and `neutral`. A selected cover without a named theme supplies its
foreground as the body background and its accent for highlights. Precedence is:

1. Explicit surface settings (`intro/body/outro.background/foreground`,
   `body.highlightColor/cursorColor`, explicit `cover.colors`).
2. Explicit brand `primary/accent`, then `theme.background/foreground/accent/highlight/cursor`.
3. Named theme defaults, then the selected cover palette, then neutral defaults.

A named theme also supplies compatible cover colors; explicit cover colors win.
Body/outro are not silently recolored from the old green v1 template. Text contrast
must reach 4.5:1 on each configured surface. Cursor halo/ripple and focus/click fill
inherit the same highlight family; only an explicit cursor override separates them.
Explicit surface backgrounds can intentionally differ. Legacy v1 palettes remain
unchanged; do not merely change a file's version and expect its overrides to vanish.
When a library cover is selected, its colors also control the opening card;
`intro.background/foreground` apply only to an opening without a library cover.

## Logo preflight

V2 requires provenance for a resolved logo: a nonempty source, role `corporate` or
`product`, and `verified: true`. This records the agent/user's evidence; it is not
an automatic trademark or authenticity detector. For an unresolved logo, explicitly
set `brand.fallback` to `omit` or `monogram`. The latter uses the brand's initial;
neither choice silently invents a corporate symbol. V1 keeps its existing fallback.

Raster images support PNG/JPEG/WebP, relative paths within the configuration
directory, and at most 16 megapixels. Preflight probes and decodes them, rejects
fully transparent or unreadable media, and checks a minimum visibly contrasting
pixel fraction on each used surface. This is a visibility heuristic, not semantic
brand acceptance. It cannot evaluate an arbitrary cover illustration under a logo;
review the actual cover and body. Choose `light` artwork for a dark background,
`dark` for a light one, or use `brand.logoBackground` as a deliberate contrast plate.
Preserve clear space in the supplied asset. Set `logoContainsName: true` for a
wordmark to suppress duplicate adjacent brand text on every surface.

All variants are copied as hash-named local assets. Preflight metadata records
dimensions, transparency, SHA-256 and tested surface backgrounds. The render
manifest includes the resolved per-surface palette and layout geometry. Keep
provenance, configuration, audio, captures and output outside source repositories.

## Preview and render

```sh
aaron-demo render <passed-run> --presentation <external.json> --preview --cover --out <new-preview-directory>/walkthrough.mp4
aaron-demo render <passed-run> --presentation <external.json> --audio <existing-audio.json> --cover --stills --out <new-delivery-directory>/walkthrough.mp4
```

`--preview` writes `body-preview.png` at the first held step, optional cover PNG/WebP,
chapters and `preview-manifest.json`, without an MP4 or provider synthesis. Pass
existing `--audio` to preview measured narration/transcripts. `--narrate` with preview
is refused. `--dry-run` writes nothing and reports geometry/palette/logo checks.
Use separate directories for every variation. A preview checks one content frame;
it does not replace reviewing all held frames, wait endings and audio in the film.
