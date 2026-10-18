# Video presentation templates

Use a passed capture once, then render its packaging without visiting the app again.
The default command keeps the existing plain/silent style. These options are opt-in:

```sh
aaron-demo render <passed-run> --template minimal --cover --stills --out <delivery>/minimal/walkthrough.mp4
aaron-demo render <passed-run> --template professional --cover --stills --out <delivery>/professional/walkthrough.mp4
aaron-demo render <passed-run> --template showcase --cover --stills --out <delivery>/showcase/walkthrough.mp4
```

| Template | Opening and closing | Recording |
| --- | --- | --- |
| `minimal` | Warm light background, editorial type, short cards; no sound by default | Light caption band, no logo by default |
| `professional` | Dark brand color, fine grid, restrained reveal, soft synthesized sting | Dark caption band and stable brand mark |
| `showcase` | Gradient atmosphere, orbital linework, larger type, brighter synthesized sting | Dark caption band and stable brand mark |

The two built-in stings are generated locally using the bundled standard-library
sound generator; no provider, download or account is involved. No narration is the
default. A sting is separate from narration and can be disabled. There is no default
background music. The actual recording stays at its original viewport and position:
branding lives in the existing caption band, preserving evidence/highlight geometry.

`--cover` exports an independent `cover.png` and compressed `cover.webp` next to the
MP4. It uses the same identity and title as the opening, even if the opening card is
disabled. It does not use an incidental loading frame as the share image.

## Your configuration

Keep customer branding, sounds, configuration and output outside Git. Use an external
JSON file and assets relative to its directory:

```json
{
  "version": 1,
  "template": "professional",
  "title": "A useful workflow",
  "subtitle": "From the first action to the finished result.",
  "brand": {
    "name": "Demo",
    "tagline": "Show what changed.",
    "primary": "#153F3B",
    "accent": "#A7F3CE",
    "logo": "assets/logo.png"
  },
  "intro": {"enabled": true, "durationMs": 3000, "soundPreset": "soft", "volume": 0.35},
  "outro": {
    "enabled": true,
    "durationMs": 2400,
    "title": "Thanks for watching.",
    "subtitle": "Explore the workflow at your own pace.",
    "url": "example.org"
  },
  "body": {"logoPosition": "right", "highlightColor": "#E3A900"}
}
```

```sh
aaron-demo render <passed-run> --presentation <external-directory>/presentation.json --cover --stills
```

Omit fields to use the selected template's defaults. `--template` can override the
file's template; explicit settings in the file remain overrides. Unknown fields fail
validation. Text lengths and color formats are checked. A missing logo uses a neutral
mark; raster logos support PNG, JPEG and WebP. Existing SVG-part profiles remain
available through legacy `--brand`; do not combine that flag with a presentation.

`intro.soundPreset` accepts `none`, `soft` or `bright`. To use your own sound, set
`intro.sound` to a relative WAV/MP3/M4A file. That file overrides the generated sting.
`intro.volume` is 0–1. Set `soundPreset: "none"` and omit `sound` for no sting. Card
durations are 500–15000 milliseconds; disable either card with `enabled: false`.
Body `logoPosition` is `left`, `right` or `none`, always inside the caption band.

Assets are copied to capture-local hash-named files before rendering. The MP4 and
cover images have no dependency on the original configuration or logo path. The
resolved configuration and capture/video hashes are recorded in `render-manifest.json`
beside the output. Keep that generated record outside Git too. Use a separate output
directory per variation to preserve its MP4, cover, chapters, stills and manifest.

## Voice selection and revisions

See [narration](narration.md) for the imported-audio manifest and ElevenLabs setup.

- `--voice-provider none`: no narration/account. Optional intro sound remains separate.
- `--audio <external-manifest.json>`: import local clips and measure their duration;
  no provider credentials or network calls.
- `--narrate` or `--voice-provider elevenlabs`: use the user's configured account and
  voice. Preview plans and validation do not call the provider.
- `qwen`: reserved provider interface, not an installed/validated backend. Requesting
  it fails explicitly before reading credentials or making a request. Audio generated
  by an independently installed local TTS can already be used through `--audio`.

Presentation-only changes reuse the capture. Re-rendering the same capture also
reuses unchanged narration cache entries, keyed by provider, model, voice, output
format, settings and text. Intro/outro timing expands when needed for a spoken line;
an audio clip targeting a disabled card is refused. No voice or cloud fallback is
chosen automatically. Imported audio is labeled as AI narration only when its manifest
explicitly says `aiGenerated: true`.

Use `--dry-run` to validate the plan without writing assets/covers, reading credentials
or making provider calls. Imported clips may be read/probed to report their duration;
AI narration timing stays pending until synthesis. `aaron-demo render --help` lists
the flags. Review the cover, beginning/end, every held frame, wait endings and actual
audio before sharing. A visual template cannot repair wrong or missing UI evidence.
