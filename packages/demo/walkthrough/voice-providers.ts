import {elevenLabs, type VoiceProfile} from './narration';

// Providers return encoded MP3. A future local backend normalizes its WAV/PCM here,
// leaving capture, timeline and render code independent of its service or hardware.
export type SpeechRequest = {text:string; voice:string; model:string; outputFormat:string; settings:VoiceProfile['voice_settings']; language?:string};
export interface SpeechProvider {id:string; synthesizeMp3(request:SpeechRequest):Promise<Uint8Array>}

export function speechProvider(id:string, apiKey:()=>string):SpeechProvider {
  if (id === 'qwen') throw Error('Qwen TTS adapter is reserved, not implemented or validated. Use imported audio from your local TTS for now. No fallback or provider call was made.');
  if (id !== 'elevenlabs') throw Error(`Unknown speech provider: ${id}`);
  const synthesize = elevenLabs(apiKey());
  return {id, synthesizeMp3: request => synthesize(request.text, {
    voice_id:request.voice, model_id:request.model, output_format:request.outputFormat, voice_settings:request.settings,
  })};
}
