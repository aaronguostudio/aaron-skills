# Optional narration

Narration can be generated with ElevenLabs, Google Gemini, a company speech endpoint
or optional free local Kokoro. Existing audio and silent videos require no account. [Video presentation](video-presentation.md) controls templates,
logos, independent covers and intro sound separately. No narration remains the default.

For help writing the explanation, read [narrative styles](narrative-styles.md).
The skill can draft from a brief or rough notes, map claims to recorded evidence,
and write quick demos, release updates, stakeholder walkthroughs, tutorials or
training lessons. A finished user-written script is optional; those modes guide
the host agent's writing and do not add renderer flags or choose a voice.

## First narration: no JSON editing

Tell Film what you have: an ElevenLabs account, a Google API key, a company voice,
no account, or existing audio. The agent uses `aaron-demo voice setup` to prepare
the configuration; it must not ask you to write JSON. Terminal users can run the
same command as a guided wizard. It offers every route, including local, imported
and silent output, before asking for a cloud key.

The wizard lists ElevenLabs voices accessible to your account. Choose by number,
name or ID; use `--search` for a large voice collection. A plan may restrict API
access to a voice even when it appears in the web application. See the
[ElevenLabs account voice API](https://elevenlabs.io/docs/api-reference/voices/search).
Keys can come from the process environment or hidden terminal input. A key entered
in the wizard is saved in a separate private `voice-credentials.json` beside the
profile file; POSIX permissions and Windows ACLs restrict access. Keys are never
accepted as command-line flags or printed in diagnostics. Agents should ask users
to enter secrets directly in their terminal, not paste them into chat.

```sh
aaron-demo voice setup
aaron-demo voice list
aaron-demo voice voices --provider elevenlabs --search "narrator"
aaron-demo voice use company
# Explicit short synthesis request; may consume the selected account's quota.
aaron-demo voice test --profile company --text "A quick tour of the workflow." --out /external/sample.mp3
aaron-demo render <passed-run> --narrate --voice-profile company
```

Profile names are reusable on this machine. Adding a second profile preserves the
existing default; `voice use <name>` changes it. Replacing a profile requires
`--replace`. Use `--profiles /external/voice-profiles.json` on voice commands or
`AARON_DEMO_VOICE_PROFILES` for both configuration and rendering. Configuration,
credentials, samples and local model installations stay outside Git. No key or
voice is supplied by the Aaron Skills author.

`voice doctor` checks configuration and local dependencies without speech calls.
`voice test` generates a short MP3 for listening before a full video. Account
access, quota and voice quality are separate from a configuration check. A failed
cloud call explains the next step and preserves completed work; choose another
profile explicitly if you want a different route. `render --dry-run` works without
any voice configuration and never synthesizes speech.

### Google Gemini API

Use your own Gemini API key, not a Google sign-in session. The wizard can save it
privately, or you can set `GEMINI_API_KEY` in the process environment. Select a
prebuilt voice by name; `--voice` also accepts a custom voice ID supported by your
account. This adapter uses the documented Interactions API with
`gemini-3.8-flash-tts`, explicit WAV output and `store:false`. Override `--model`
only with a compatible TTS model. It is distinct from Google Cloud TTS/Vertex
credentials, OAuth and arbitrary Google API keys. See
[Google TTS documentation](https://ai.google.dev/gemini-api/docs/speech-generation)
and [current pricing and quota terms](https://ai.google.dev/gemini-api/docs/pricing).
No unlimited free cloud service is promised.

```sh
aaron-demo voice setup --provider google --name google-narrator --voice Kore
```

### Company or self-hosted speech service

Supply the **full speech endpoint**, model name and voice name issued by the
service owner. The supported contract is an OpenAI-compatible POST with JSON
`{model, input, voice, response_format:"mp3", speed}` and a binary audio response.
Bearer authentication uses `AARON_DEMO_TTS_API_KEY`, a selected `--key-env NAME`,
or a privately saved wizard key. `--no-key` explicitly disables authentication,
including ambient keys, for a service that needs none. HTTPS is required except
for loopback HTTP. Redirects are refused so credentials cannot follow another host.
Custom URLs cannot contain credentials, query strings or fragments.

```sh
aaron-demo voice setup --provider custom --name company --endpoint https://speech.example/v1/audio/speech --model company-tts --voice company-narrator
```

An arbitrary company API needs a bridge implementing this contract. Voice cloning,
voice uploads and provider-specific account provisioning are not performed by this
command. For a company voice already in ElevenLabs, select that existing account
voice instead. Existing recordings can always use the imported-audio route below.

### Free local Kokoro (optional)

This backend uses Kokoro ONNX on CPU with prebuilt voices. No cloud account or
per-request fee is required. It is an optional download, not part of ordinary
runtime installation. Supply Python 3.10–3.13; Python 3.14 is currently unsupported
by the pinned dependency. Its virtual environment is isolated from the main Demo
runtime. The installer downloads approximately 143 MB of pinned model/voice data,
verifies SHA-256 checksums and installs `kokoro-onnx==0.6.1` and `soundfile==0.13.1`
plus their dependencies. No system packages or administrator access are requested.
Keep the model and dependency licenses with that installation.

```sh
aaron-demo voice install-local --python /path/to/python3.12 --yes
aaron-demo voice setup --provider kokoro --name local-narrator --voice af_sarah
aaron-demo voice doctor --profile local-narrator
aaron-demo voice test --profile local-narrator --text "Welcome. Let us walk through this workflow." --out /external/local-sample.mp3
```

`--local-dir /external/kokoro` selects a separate model installation for both
install and setup. The wizard also offers optional installation. Unsupported
Python versions produce a repair instruction before creating the environment.
Synthesis uses local files and does not contact a cloud speech service. The
initial acceptance scope is English (`en-us` or `en-gb`) on macOS arm64. No
Chinese, Windows/Linux acceptance or voice-cloning quality is implied by the
underlying model's wider capabilities. See
[Kokoro ONNX](https://github.com/thewh1teagle/kokoro-onnx) and the
[Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M).

## Imported audio

Use `aaron-demo render <passed-run> --audio <external-directory>/audio.json --stills`.
The manifest and its local audio files stay outside Git. Files are relative to the
manifest directory, including through symlinks; URLs/traversal are refused.

```json
{
  "version": 1,
  "aiGenerated": false,
  "clips": [
    {"at": "intro", "file": "audio/opening.wav", "text": "A quick tour of the workflow."},
    {"at": "actual-step-id", "file": "audio/step.mp3", "text": "Open the result."},
    {"at": "outro", "file": "audio/ending.wav", "text": "Thanks for watching."}
  ]
}
```

`at` must be an actual captured step ID, `intro` or `outro`, with no duplicates.
Each clip needs a transcript for review. WAV, MP3, M4A and AIFF are accepted; FFprobe
measures actual durations so holds and chapters follow the audio. Clips are copied
into the render public directory, preserving their bytes. Omitted steps remain silent.
Set `aiGenerated: true` for AI-generated audio; human recordings are not labeled AI
automatically. An import requires no voice profile, API key or cloud service.

## ElevenLabs advanced configuration

Silent rendering requires no API key or voice profile. The ElevenLabs route uses the user's own account and a voice they have permission to use. Live provider validation incurs account usage and is separate from mocked unit tests.

Configure generated narration once per owner/machine before the first provider
call. Runtime installation does not provision an account, key or voice. The default
profile file and Keychain service below are user-level, not tied to one runtime
installation: side-by-side installs can use them when intentionally selected. Use
`AARON_DEMO_VOICE_PROFILES` for an explicit external profile file; do not copy keys
into an installation or share another person's credentials. Keep script drafting
and `--dry-run` available before this setup.

Set `ELEVENLABS_API_KEY` in the process environment. It takes precedence over the optional dedicated macOS Keychain service `aaron-demo-elevenlabs`. No repository .env files or author's personal credentials are read automatically.

Set `AARON_DEMO_VOICE_PROFILES` to an absolute JSON file outside Git, or create `~/.config/aaron-skills/demo/voice-profiles.json`:

```json
{
  "default_profile": "my-voice",
  "profiles": {
    "my-voice": {
      "provider": "elevenlabs",
      "voice_id": "YOUR_VOICE_ID",
      "model_id": "eleven_multilingual_v2",
      "output_format": "mp3_44100_192",
      "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "use_speaker_boost": true}
    }
  }
}
```

Run `aaron-demo render <passed-run> --narrate --stills`, or add `--script <run>/narration.json`. Language follows the supplied text. Clips are cached in the run folder; changing only narration reuses the source capture. Default speaking speed is 1.15; `--speed` accepts 0.7 to 1.2.

`--brand demo` uses the neutral example mark. For your own brand, set `AARON_DEMO_BRAND_PROFILES` to your own JSON file; sound paths are relative to that file's directory.

`render --dry-run` creates no files and makes no provider calls. Narrated timing
is reported as pending synthesis. Presentation derivatives currently do not copy
prior narration caches; rendering one with narration may incur new usage.

## Provider interface

`SpeechProvider.synthesizeMp3(SpeechRequest)` separates speech from capture and
presentation. Every provider produces encoded MP3; Google WAV and local Kokoro WAV
are normalized with FFmpeg. Google speed is applied once with pitch-preserving
`atempo`; ElevenLabs, custom endpoints and Kokoro receive their own speed setting.
Existing ElevenLabs profiles and their default 1.15 speed remain compatible. New
Google/custom/local profiles start at 1.0; `--speed` overrides this within 0.7–1.2.

Clips are cached only after successful media probing. Provider, endpoint, voice,
model, language and delivery settings distinguish cache entries. A failed request
leaves completed clips and the source capture intact. Retry reuses completed clips;
no other service, account or voice is selected automatically. Layout-only changes
reuse the same capture and audio. A derivative capture may need a separate cache.

The custom adapter implements the protocol below; it does not adapt arbitrary
vendor schemas. Qwen is not a native backend: use a compatible company/local
endpoint or import independently generated audio. Voice IDs are provider-specific;
a reference recording requires a backend with authorized voice replication support.
