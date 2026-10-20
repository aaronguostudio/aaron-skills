# Choose and customize a presentation cover

Film can use any of the 32 cover styles in the [cover library](https://skills.aaronguo.com/covers).
The style IDs match the gallery names. The runtime contains clean artwork layers
and editable text layouts; the gallery's example title, brand, presenter and date
are never used as the background of a customized cover.

## Choose a style first

The default experience is agent-led. The user can ask for a video in natural
language; they do not need the gallery, an editor, a JSON file or CLI knowledge.
The agent owns configuration and rendering. The gallery is an optional visual
catalogue, useful for browsing beyond the initial recommendations. Its browser
preview can change content, upload a local logo, adjust colors and copy an agent
brief or download configuration. Local logo files stay in the browser and must
be supplied separately to the agent; the downloaded JSON references a filename.

```sh
aaron-demo cover --list
```

This lists the English/Chinese names, stable IDs, style families, default colors
and example links. Read this installed catalogue instead of guessing IDs or
requiring website access. Honor a style already selected in the conversation;
do not ask again. A gallery handoff only needs a style name or stable ID, such as
"Use Chrome Loop (`chrome-loop`) with my brand colors." The agent resolves it to
the installed catalogue; the user's chat brief remains the source for content.
Examples include `cobalt-signal`, `desert-editorial`, `chrome-loop`, `amber-glass`,
`linen-emboss` and `electric-silk`. The full list is available offline through the
CLI; rendering uses bundled artwork and never downloads the gallery images.

### Recommend before making the video

Use the existing brief, supplied logo and brand guide to judge audience, tone,
palette and title length. Ask only for missing information that would materially
change the recommendation; missing optional presenter/date/logo is not a blocker.
Do not infer brand identity from the host account or unrelated projects.

Offer about three distinct directions, with the strongest match first. For each,
show an image, its name and stable ID, and one sentence explaining its relevance
to this content. Avoid three near-identical palettes or an unexplained wall of
32 choices. The family guide below is a starting point, not an automatic scoring
system; inspect the preview and the supplied brand before deciding.

| Direction | Useful visual character | Example styles |
| --- | --- | --- |
| Graphic | Bold, direct, high contrast; product announcements and energetic brands | `cobalt-signal`, `coral-aperture` |
| Editorial | Spacious photography and restrained type; thoughtful strategy or storytelling | `desert-editorial`, `alpine-silence` |
| Sculptural | Polished objects and depth; expressive technology or product launches | `chrome-loop`, `amber-glass` |
| Material | Tactile, quiet or formal; craft, premium and design-led presentations | `linen-emboss`, `black-marble` |
| Organic | Soft natural forms; calm, human-centered or wellbeing themes | `sage-pebble`, `petal-motion` |
| Atmospheric | Light and motion; future-facing, creative or aspirational themes | `solar-horizon`, `prism-light` |
| Architecture | Structure and geometry; spatial, operational or design stories | `concrete-arch`, `blue-portal` |
| Playful | Simple expressive shapes; friendly teaching or lively updates | `red-balloon`, `soft-grid` |

When content is available, use one shared external presentation configuration
and render two or three candidate covers with `--preset <id>` into separate
directories. Review them, then show these actual branded previews in the chat.
If content is still provisional, use the gallery's sample previews, clearly
described as style samples. If remote previews are unavailable, render with the
installed assets; no website session, image-generation service or interactive
editor is needed. In a text-only host, provide names/reasons and available image
attachments or file links without claiming the user has seen the images.

For example, for a supplied brief about an approachable B2B product launch:

> I recommend Cobalt Signal (`cobalt-signal`) for a clear, bold launch; Chrome
> Loop (`chrome-loop`) for a more expressive product feel; or Linen Emboss
> (`linen-emboss`) for a quieter, tactile direction. Here are previews using
> your title and logo. Choose 1, 2 or 3, or tell me what you would change.

Accept a number, name or stable ID; the user does not need to edit the file.
If they delegate the design, choose the best fit and continue with a preview
rather than adding a confirmation gate. If they decline a cover, skip it.
If they want more options, share the [full gallery](https://skills.aaronguo.com/covers)
or another small shortlist. Keep script/capture preparation moving while an
explicit choice is pending; use the selected cover before the final video render.
Do not render several full videos just to compare covers.

After selection, write that ID into the canonical configuration's `cover.preset`
(the candidate CLI override does not edit the file). Preserve content and logo
when switching styles; try the preset palette first, then apply supplied brand
colors while checking contrast. Rewording or palette changes keep the same preset
unless the user requests a different direction. Reuse the configuration for the
independent cover and video opening, without asking for the same choice again.

## Fill in the user's content

Save `presentation.json` and any supplied logo in an external working directory:

```json
{
  "version": 1,
  "title": "A clearer customer journey",
  "subtitle": "What changed, why it matters, and what comes next",
  "brand": {"name": "Northstar", "logo": "assets/logo.png"},
  "cover": {
    "preset": "chrome-loop",
    "presenter": "Jordan Lee",
    "date": "October 2026",
    "colors": {
      "background": "#DCD2F8",
      "foreground": "#291843",
      "accent": "#FF8900"
    }
  }
}
```

Use the user's title, subtitle, brand/Logo, presenter and date. Subtitle, logo,
brand name, presenter and date can be omitted. Do not infer an author from the
host account, add Aaron Skills branding, or fill in today's date without a brief
that calls for it. A logo is a relative PNG, JPEG or WebP file inside the same
configuration directory; square and horizontal logos preserve their aspect ratio.
If the supplied logo already includes the brand wordmark, leave `brand.name`
empty unless a separate brand label is wanted, so the name does not appear twice.
Long titles and subtitles wrap and fit their designated text areas, including CJK.

Omit `colors` for the selected style's palette, or override only the colors the
user wants changed. `background` colors the canvas and native text panels;
`foreground` colors the title and text; `accent` colors native brand marks and
graphic elements. `secondary` is an optional second graphic color (used by
`racing-stripe` and `moss-contour`). Photographic, material and sculptural artwork
retains its natural colors and lighting. Changing the artwork itself is a separate
image edit; ordinary wording and palette changes require no generation provider.

## Preview a cover without recording a video

```sh
aaron-demo cover --presentation /external/project/presentation.json \
  --out /external/project/revision-1/cover.png --dry-run
aaron-demo cover --presentation /external/project/presentation.json \
  --out /external/project/revision-1/cover.png
```

The command exports a 1600×900 PNG, a compressed WebP, and `cover.manifest.json`.
It needs no capture, narration account, network artwork or paid generation call.
Open the actual PNG for review. Check wording, logo aspect ratio, contrast and
line wrapping. Use a new filename or revision directory for changes; existing
cover files are preserved. A `--preset <id>` argument overrides `cover.preset`.

## Use the same choice in a walkthrough

```sh
aaron-demo render /external/project/passed-capture \
  --presentation /external/project/presentation.json \
  --cover --stills --out /external/project/delivery/walkthrough.mp4
```

The chosen style appears on the opening card and the independent 16:9 cover.
The app viewport and checked evidence/highlight coordinates stay unchanged.
Existing `minimal`, `professional` and `showcase` choices continue to control
caption-band and closing-card packaging. The cover's colors affect its canvas
and text; use the existing `brand.primary`/`brand.accent` settings for video-body
branding when needed. `--cover-preset <id>` can select a library style directly
while reusing a capture's title. Keep each output variation and its configuration
outside Git, following [video presentation](video-presentation.md).
