# Optional narration

Narration can be disabled, imported from local audio, or generated with the configured
ElevenLabs account. [Video presentation](video-presentation.md) controls templates,
logos, independent covers and intro sound separately. No narration remains the default.

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

## ElevenLabs

Silent rendering requires no API key or voice profile. Requested narration uses the user's own ElevenLabs account and a voice they have permission to use. Live provider validation incurs account usage and is separate from mocked unit tests.

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

The runtime's `SpeechProvider.synthesizeMp3(SpeechRequest)` boundary separates voice
generation from capture and presentation. The implemented backend is ElevenLabs;
its request shape/cache are covered by mocked tests, separate from real account
acceptance. Qwen TTS is reserved and explicitly unavailable in this version. It is
not downloaded, launched, or silently replaced by a cloud service. A future adapter
will normalize its audio at this boundary and must have its own platform/provider
verification. For now, independently generated Qwen audio can be imported as above.
