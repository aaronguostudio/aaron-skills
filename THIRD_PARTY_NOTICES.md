# Third party dependencies

Dependencies are installed from pinned manifests; their upstream licenses continue to apply. This is a dependency inventory, not a replacement for their license texts.

| Dependency | Version | Upstream terms |
| --- | --- | --- |
| Playwright | 1.62.1 | Apache 2.0, https://github.com/microsoft/playwright |
| Remotion and CLI | 4.0.536 | Remotion License, https://github.com/remotion-dev/remotion/blob/v4.0.536/LICENSE.md |
| React and React DOM | 19.2.4 | MIT, https://github.com/facebook/react |
| Bun runtime package | 1.4.3 | See bundled upstream notices, https://github.com/oven-sh/bun |
| Pillow | 12.3.0 | HPND and included component notices, https://github.com/python-pillow/Pillow |
| Chromium and FFmpeg | Installed separately | Retain their distribution-specific notices and configuration terms. |

Remotion's pinned license provides free-use eligibility for individuals, certain small companies and other stated groups; other entities require a Company License. Check the upstream terms for the intended use before organizational rollout. Silent videos require no narration provider. Optional ElevenLabs calls use the user's account and its terms.

Optional local narration is installed separately, only when requested. It uses
`kokoro-onnx` 0.6.1 (MIT, https://github.com/thewh1teagle/kokoro-onnx),
`soundfile` 0.13.1 (BSD-3-Clause and its included libsndfile notices), and their
Python dependencies. Kokoro model/voice assets use the upstream model terms
(Apache 2.0, https://huggingface.co/hexgrad/Kokoro-82M). Model files are downloaded
from the upstream `model-files-v1.1` release and SHA-256 verified, not bundled
with Aaron Skills. Keep upstream licenses and installed dependency notices.
Google and company speech endpoints use the owner's account and service terms.
