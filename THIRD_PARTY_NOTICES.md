# Third party dependencies

Dependencies are installed from pinned manifests; their upstream licenses continue to apply. This is a dependency inventory, not a replacement for their license texts.

| Dependency | Version | Upstream terms |
| --- | --- | --- |
| Playwright | 1.62.1 | Apache 2.0, https://github.com/microsoft/playwright |
| HyperFrames CLI | 0.8.223 | Apache 2.0, https://github.com/heygen-com/hyperframes/blob/main/LICENSE |
| undici override | 7.30.1 | MIT, security patch for the CLI dependency |
| esbuild | 0.28.2 | MIT, https://github.com/evanw/esbuild |
| React and React DOM | 19.2.4 | MIT, https://github.com/facebook/react |
| Bun runtime package | 1.4.3 | See bundled upstream notices, https://github.com/oven-sh/bun |
| Pillow | 12.3.0 | HPND and included component notices, https://github.com/python-pillow/Pillow |
| Chromium and FFmpeg | Installed separately | Retain their distribution-specific notices and configuration terms. |

The Demo bundle has no Remotion dependency. HyperFrames is installed from its pinned npm lock; its Apache 2.0 license is included at `licenses/HyperFrames-Apache-2.0.txt`. Upstream dependency and bundled-vendor notices remain applicable; the root MIT license does not relicense them. Local rendering needs no HyperFrames/HeyGen account or renderer license key. Rendering uses the already installed Playwright Chromium and system FFmpeg; no second browser download is required. The adapter disables HyperFrames usage telemetry and does not invoke publishing or hosted generation commands. Silent videos require no narration provider. Optional cloud narration uses the user's account and its terms. FFmpeg build/codec and media/font rights still depend on the exact delivery; this migration does not claim universal commercial clearance.


Our frame primitives, timeline, presentation components and browser scene are
Aaron Skills code. Only `renderer/backends/` connects them to HyperFrames. Film
does not load HyperFrames Studio, catalog templates or GSAP to animate its authored
scene. This does not relicense any vendored component in the upstream CLI package.
HyperFrames' [upstream credits](https://github.com/heygen-com/hyperframes/blob/main/CREDITS.md)
list additional terms, including MPL-2.0 for mediabunny and the separate GSAP
Standard License for some catalog pieces. Adding those features or templates
requires reviewing the actual included code and media, rather than applying the
framework's Apache label to everything.

When redistributing HyperFrames or a modified copy, include Apache 2.0, preserve
applicable attribution/NOTICE material and identify modified upstream files.
Use Aaron Skills' own branding; the license grants no general upstream trademark
rights. Apache 2.0 permits commercial products and proprietary modifications;
it does not impose a team-size or customer-size fee or require publishing our
application source. Separately distributed Chromium, FFmpeg builds, codecs,
fonts, media and optional services retain their own obligations. Dependency
audits and this inventory are not a complete legal clearance of a future binary
distribution.

Optional local narration is installed separately, only when requested. It uses
`kokoro-onnx` 0.6.1 (MIT, https://github.com/thewh1teagle/kokoro-onnx),
`soundfile` 0.13.1 (BSD-3-Clause and its included libsndfile notices), and their
Python dependencies. Kokoro model/voice assets use the upstream model terms
(Apache 2.0, https://huggingface.co/hexgrad/Kokoro-82M). Model files are downloaded
from the upstream `model-files-v1.1` release and SHA-256 verified, not bundled
with Aaron Skills. Keep upstream licenses and installed dependency notices.
Google and company speech endpoints use the owner's account and service terms.
