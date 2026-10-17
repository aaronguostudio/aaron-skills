# Optional narration

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
