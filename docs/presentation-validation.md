# Presentation v1 — local validation

The three opt-in video packages and audio-import path were validated using the
existing public-blog recording, without replaying its UI. The plain default path
also passed an independently installed capture → render → handoff smoke check.
The existing benchmark task, rubric and stored baseline remain unchanged. These
previews are feature acceptance evidence, not a new benchmark score or improvement claim.

## Tested output

| Package | MP4 duration | Audio | WebP cover bytes |
| --- | --- | --- | --- |
| Minimal | 28.633 s | None | 28,276 |
| Professional | 31.253 s | Local synthesized opening sting | 30,296 |
| Showcase | 31.253 s | Local synthesized opening sting | 42,698 |
| Professional with imported narration | 34.603 s | Imported local system-TTS clips plus sting | 30,296 |

All four use the same raw recording, capture manifest, steps and 11 screenshots.
Source video SHA-256:
`5516b0ea94086feabe5259be188b5aff2d2c03a1a39969ea7ef46a65191583a2`.
The source is the accepted original from the existing public blog case, not a
private project. Presentation-only changes did not modify those source files.

The exported runtime content ID is `d49c3c8d4255920a`. It was tested in a new isolated
installation, on macOS arm64, with the installer-selected Node 24.18.0, Bun 1.4.3,
Python 3.14.5/Pillow 12.3.0 and FFmpeg 8.1.1. The installation was exported from the
working tree and its manifest records modified source; its bundled file hashes
match the implemented source. Raw previews, logs, configuration, QA frames and
receipts are in an external archive, ID `presentation-v1-2026-10-17`, outside Git.

## Checks performed

- Shared deterministic gate with `--skip-browser`: type checking, capture unit tests,
  renderer tests, Python tests, source/privacy/import/document checks and benchmark
  boundary tests passed. This does not claim the separate capture E2E suite ran.
- Installed doctor and the real default capture/render/message smoke passed. Its
  image assertions found the expected fictional fixture results in the rendered MP4.
- Installed feature acceptance rendered all three presets, decoded H.264 output,
  verified WebP files using the installed Pillow, and exercised an imported tone.
  An additional installed render decoded an external raster logo into the cover/video.
- Mocked ElevenLabs exercised profile loading, request generation, encoded MP3
  clips and the full render path. Unit checks verify cache reuse and that unsupported
  Qwen requests fail before credentials/requests. This is not real-account acceptance.
- All four blog MP4s fully decoded. The operator reviewed 44 held frames, 360 frames
  covering every wait's final second, and opening/closing frames. Captions, highlights
  and branding remained readable; the application viewport was not cropped or moved.
- The local comparison page loaded all four videos, and real in-app-browser actions
  advanced playback. Start/ending navigation worked after the preview server gained
  HTTP byte-range support. This was a preview-server correction, not a video edit.
- The complete HTML/media package was copied to another directory. All eight unique
  media/download references remained inside the copied package, with no external
  media, source recording, voice profiles or credentials included.
- The two sting-only samples peaked below −15 dBFS; the imported sample below
  −6 dBFS. No digital peak reached 0 dBFS. Subjective listening/style acceptance is
  pending the owner; the agent could inspect playback and audio metrics, not listen.

## Corrections and limits

The first cover export attempted FFmpeg's optional WebP encoder, which was absent
in the measured build. Its partial output was retained outside Git; accepted covers
were rerendered through the installed Pillow. The final implementation requires no
FFmpeg WebP encoder. The preview-server seek correction likewise preserved the MP4s.

No paid voice request was made. There was no dedicated ElevenLabs profile/process key
in the test environment; another project's credentials or an author's personal
voice were not used. The audible imported example was generated locally with a
macOS system voice and explicitly marked AI-generated. It tests importing audio,
not a system-TTS adapter, Qwen inference, or general voice quality.

Qwen remains a reserved interface. New preset/provider behavior has not been accepted
on native Windows/Linux or against a real ElevenLabs account in this change. The CI
matrix is wired to run installed synthetic feature checks; remote CI has not run.
Existing compatibility statements and the private-project case prohibition remain
unchanged. See [configuration](video-presentation.md) and [narration](narration.md).
