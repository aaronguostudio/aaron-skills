# Narration setup and provider validation

Local implementation acceptance on 2026-10-21; this document does not establish a
published release or live cloud account certification. Test material used only
the public loopback installation fixture and synthetic narration.

## Result

The installed voice command can configure a narrator without user-authored JSON,
list ElevenLabs account voices by name/ID, save reusable profiles, select a default,
check configuration and generate an explicit short sample. Rendering uses the
selected ElevenLabs, Google Gemini, company endpoint or free local Kokoro profile.
Existing audio and silent rendering remain available without a cloud account.

## Evidence

| Layer | Result and boundary |
| --- | --- |
| Shared deterministic gate | Passed: TypeScript, 256 capture units, renderer/narration tests, Python tools and page tests, benchmark/Shape checks, 20 real browser integration tests. Two platform-specific Python tests were skipped on macOS. |
| Final renderer suite | 132 tests passed across eight files, including 23 new voice/onboarding/provider regressions. |
| First-use terminal | Real TTY setup selected Google with a synthetic key and a voice by number. The key was hidden in terminal output, saved separately and absent from the voice profile. No cloud request was made. |
| ElevenLabs | Mocked account-voice pagination, selection, request/cache compatibility and failure paths. No paid account generation or library/plan access certification. |
| Google Gemini | Mocked documented Interactions request, WAV response extraction, one speed conversion, missing audio and HTTP/network failure handling. No live account/quota/model-access certification. |
| Company endpoint | Exported CLI completed setup, doctor and a short MP3 sample against a real loopback HTTP service implementing the documented OpenAI-compatible contract. Explicit no-auth mode sent no ambient credential. This is contract acceptance, not certification of an unspecified company production service. |
| Kokoro | Real local installation and CPU inference on macOS arm64 using isolated Python 3.12.13, kokoro-onnx 0.6.1 and soundfile 0.13.1. Model and voice files passed pinned SHA-256 checks. A separate synthesis passed with socket connections disabled. |
| Audio sample | Real 7.207-second MP3, 44.1 kHz mono; decoded successfully, measured peak -6.7 dB. No human listening score or cross-language quality claim. |
| Export/install | Isolated exported installation passed doctor and the public capture → silent video → embedded update-page smoke flow. Installed bundle hashes are checked against the committed source manifest. |
| Narrated installed render | Existing public capture produced an 8.50-second H.264/AAC video using four real Kokoro clips and plain-caption layout. Clip durations, holds, chapters, original capture hash and all four held frames were checked. No recapture, cloud voice account, visible process label or author voice was needed. |
| Privacy and recovery | Credential separation/private permissions, existing parent-directory permissions, provider isolation, endpoint rules, no implicit fallback, incomplete-clip cleanup, retry reuse, legacy ElevenLabs cache reuse and output preservation, concurrent process updates and rejection of playlist/external-reference payloads are covered by regressions. |

Raw recordings, clips, configuration, credentials, media and detailed execution
logs are retained outside Git under a local acceptance archive. They are not part
of either public bundle manifest. This acceptance record predates publication; release and deployment status are
reported separately in the tagged release.

**Google and ElevenLabs real-account speech generation has not been verified.**

## Limits

Local Kokoro acceptance covers English (en-us/en-gb configuration; real spoken
sample uses en-us/af_sarah) on macOS arm64. Native Windows/Linux, other languages,
voice cloning and subjective voice quality have not been accepted here. Optional
installation needs a compatible Python and downloads model/dependency files; it
never replaces the main runtime or requests administrator privileges.

The company adapter requires the documented OpenAI-compatible speech request and
binary audio response. Other schemas need a bridge. Existing voice IDs remain
provider-specific; this implementation does not transfer or clone voices between
services. Cloud generation still uses the user's permitted account, quota and
terms, and can require a paid plan. No unlimited free hosted service is promised.

## Release review follow-up

The release review restricted FFmpeg to explicit WAV/MP3 demuxers and local file
protocols, and serialized configuration/credential read-modify-write operations
across CLI processes. Regression tests cover playlist rejection and concurrent
profile/key saves. Google and ElevenLabs real-account validation is still pending;
review fixes do not broaden that claim.

The first release-review gate hit existing synthetic VP8 encoding and full-art
media-probe timeouts under CPU load. Fixture generation now uses realtime VP8
encoding while retaining the sync-offset assertions; the full-art test has an
explicit 30-second media-probe allowance. No real capture or production renderer
encoding behavior was changed by these fixture adjustments.
