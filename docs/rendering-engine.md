# Local rendering engine

Film uses HyperFrames 0.8.223 through an Aaron Skills-owned frame contract. The
public commands (`aaron-demo render`, `--preview`, `--cover`, and `cover`) and
capture/presentation configuration remain unchanged. No Remotion package is
installed or used by this runtime. Existing MP4s and captures remain usable.

## Boundaries

The implementation has three layers:

| Layer | Ownership and entry point |
| --- | --- |
| Authored scene | `src/frame.tsx`, `src/browser.tsx` and `src/projects/` own frame math, media seeking, layouts, covers, captions, masks and timing. They do not register with a rendering provider. |
| Rendering contract | `contract.ts` defines the checked scene, request, backend and result. `composition.ts` validates evidence and prepares the timeline. `backend.ts` provides the stable `render()` entry and publishes successful output. |
| HyperFrames adapter | `backends/hyperframes.ts` builds a private local project, declares audio, uses Chromium for snapshots and invokes the pinned CLI. `backends/hyperframes-browser.ts` registers the scene with `registerFrameSource`. |

No Remotion source is included in these implementations. Existing Aaron
Skills-authored visual and timing code is retained under `src/`. HyperFrames
is the only implemented backend; this is a replaceable adapter, not a claim
that a second complete engine already exists.

The frame source owns media seeking in an isolated shadow tree. It buffers each
recording once as a local blob and waits for seeking, image decoding and fonts
before completing a requested frame. HyperFrames owns capture and encoding;
the frame source does not start a competing animation clock. Audio is declared
as timed media in the generated HTML for the backend's mix. Silent mode and
imported audio do not load narration credentials or synthesize new speech.

A future backend implements `RenderBackend.render(request, preparedScene)` and
is wired through `createRenderer()`. The common entry validates capture evidence
before calling a backend. It writes to a private staging directory on the output
filesystem and renames the completed artifact into place only after success.
A failed render cleans temporary output and preserves the previous video or PNG.
The adapter also checks the installed HyperFrames version before rendering, so
the backend identity in the result describes the selected pinned version.

This boundary keeps capture, branding, narration and sharing independent of
backend choice. There is no end-user backend selector or extra onboarding step.
A harness can invoke the
existing CLI and read `render-manifest.json`, which identifies the backend and
its exact version. This is a local integration boundary; it adds no harness dependency and does not certify a host integration.

## Operation and limits

The adapter uses the capture installation's Chromium and PATH FFmpeg. It sets
HyperFrames' documented telemetry opt-out variables for every render. It does
not invoke authentication, publishing, hosted rendering or media-generation
commands. Temporary render projects contain only referenced media and compiled
composition code, and are removed after success or failure. Their source
captures and prior outputs remain outside Git.

The backend version is pinned because frame-source APIs are evolving. Footage is
buffered once per source per browser, so memory use includes the compressed
recording. High-volume, long-form and 4K performance need separate measurement.
This migration removes Remotion's organization-size licensing gate, not other
dependency, codec, font, media or optional provider obligations. See
[third-party notices](../THIRD_PARTY_NOTICES.md).

Run the shared source gate and an isolated installation/smoke after changing
this boundary. Review actual output pixels, held frames, masks, camera moves,
audio timing, preview/export agreement and failure behavior. Earlier renderer
platform results do not establish acceptance of this backend on another OS.
