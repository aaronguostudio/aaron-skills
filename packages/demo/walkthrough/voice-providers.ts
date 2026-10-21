import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {elevenLabs,loadApiKey,type VoiceProfile} from './narration';
import {savedKey,validateEndpoint} from './voice-config';

// Providers return encoded MP3. A future local backend normalizes its WAV/PCM here,
// leaving capture, timeline and render code independent of its service or hardware.
export type SpeechRequest = {text:string; voice:string; model:string; outputFormat:string; settings:VoiceProfile['voice_settings']; language?:string};
export interface SpeechProvider {id:string; synthesizeMp3(request:SpeechRequest):Promise<Uint8Array>}

export type Voice = {id:string; name:string; description?:string};
const LIMIT=32*1024*1024;
export const GOOGLE_MODEL='gemini-3.8-flash-tts';
export const GOOGLE_VOICES:Voice[]=[{id:'Kore',name:'Kore',description:'Firm'},{id:'Puck',name:'Puck',description:'Upbeat'},{id:'Charon',name:'Charon',description:'Informative'},{id:'Aoede',name:'Aoede',description:'Breezy'},{id:'Zephyr',name:'Zephyr',description:'Bright'},{id:'Sulafat',name:'Sulafat',description:'Warm'}];

export function providerKey(p:VoiceProfile):string {
  if(p.provider==='kokoro'||(p.provider==='custom'&&p.auth==='none'))return '';
  const variable=p.api_key_env||(p.provider==='elevenlabs'?'ELEVENLABS_API_KEY':p.provider==='google'?'GEMINI_API_KEY':'AARON_DEMO_TTS_API_KEY');
  const key=process.env[variable]?.trim()||savedKey(p.credential_id); if(key)return key;
  if(p.provider==='elevenlabs'&&!p.api_key_env&&!p.credential_id)return loadApiKey([]);
  if(p.provider==='custom'&&!p.api_key_env&&!p.credential_id)return '';
  throw Error(`No key in ${variable}. Run aaron-demo voice setup, or set that variable. Free local Kokoro and imported audio need no cloud account.`);
}
export async function request(url:string,init:RequestInit,fetcher:typeof fetch=fetch):Promise<Response>{
  let r:Response;
  try{r=await fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw Error('Speech service unreachable or timed out. Script and completed clips are retained. Retry, run aaron-demo voice setup, or choose local/imported audio. No fallback was selected.');}
  if(!r.ok){const hint=[401,403].includes(r.status)?'Check the key, voice access and account permissions.':r.status===429?'Check quota/rate limits before retrying.':'Check service availability and the selected model/voice.';throw Error(`Speech service answered ${r.status}. ${hint} No response body or credentials were logged; no fallback was selected.`);}
  return r;
}
async function bytes(r:Response):Promise<Uint8Array>{
  if(Number(r.headers.get('content-length'))>LIMIT)throw Error('Speech response is too large');
  const reader=r.body?.getReader();if(!reader)throw Error('Empty speech response');
  const parts:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT)throw Error('Speech response is too large');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
  if(!size)throw Error('Empty speech response');const out=new Uint8Array(size);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;
}
async function json(r:Response):Promise<any>{try{return JSON.parse(new TextDecoder().decode(await bytes(r)));}catch{throw Error('Invalid or oversized speech JSON; no response body was logged');}}
export function normalizeMp3(data:Uint8Array,speed=1):Uint8Array{
  const dir=mkdtempSync(join(tmpdir(),'aaron-voice-'));
  try{const input=join(dir,'source.audio'),out=join(dir,'speech.mp3');writeFileSync(input,data,{mode:0o600});
    execFileSync('ffmpeg',['-v','error','-nostdin','-i',input,'-vn',...(speed===1?[]:['-af',`atempo=${speed}`]),'-ar','44100','-c:a','libmp3lame','-b:a','192k',out],{stdio:'pipe',timeout:120000});return readFileSync(out);
  }catch{throw Error('Speech response could not be decoded as audio. Check service output and FFmpeg; no invalid clip was cached.');}
  finally{rmSync(dir,{recursive:true,force:true});}
}
export async function listElevenVoices(key:string,search='',fetcher:typeof fetch=fetch):Promise<Voice[]>{
  const voices:Voice[]=[];let next='';
  for(let page=0;page<100;page++){
    const url=new URL('https://api.elevenlabs.io/v2/voices');url.searchParams.set('page_size','100');if(search)url.searchParams.set('search',search);if(next)url.searchParams.set('next_page_token',next);
    const data=await json(await request(url.href,{headers:{'xi-api-key':key}},fetcher));if(!Array.isArray(data.voices))throw Error('Voice service returned no voice list');
    for(const v of data.voices)if(typeof v.voice_id==='string'&&typeof v.name==='string')voices.push({id:v.voice_id,name:v.name,description:typeof v.category==='string'?v.category:undefined});
    if(!data.has_more)return voices;
    if(typeof data.next_page_token!=='string'||!data.next_page_token||data.next_page_token===next)throw Error('Voice pagination failed; narrow the search and retry');next=data.next_page_token;
  }throw Error('Too many voices; narrow --search and retry');
}

export function speechProvider(id:string, apiKey:()=>string, profile?:VoiceProfile, dependencies:{fetcher?:typeof fetch;normalize?:typeof normalizeMp3}={}):SpeechProvider {
  if (id === 'qwen') throw Error('Qwen TTS adapter is reserved, not implemented or validated. Use imported audio from your local TTS for now. No fallback or provider call was made.');
  const fetcher=dependencies.fetcher??fetch,normalize=dependencies.normalize??normalizeMp3;
  if(id==='google')return {id,synthesizeMp3:async r=>{
    const data=await json(await request('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey()},body:JSON.stringify({model:r.model,store:false,input:[{type:'user_input',content:[{type:'text',text:r.text}]}],response_format:{type:'audio',mime_type:'audio/wav'},generation_config:{speech_config:[{voice:r.voice}]}})},fetcher));
    const audio=data.steps?.filter((s:any)=>s.type==='model_output').flatMap((s:any)=>s.content??[]).filter((c:any)=>c.type==='audio').at(-1);
    if(!audio||typeof audio.data!=='string'||!audio.data.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(audio.data))throw Error('Google returned no encoded audio; check the TTS model and account access');
    if(audio.mime_type&&audio.mime_type!=='audio/wav')throw Error('Google returned an unexpected audio format; expected WAV');
    return normalize(Buffer.from(audio.data,'base64'),Number(r.settings.speed??1));
  }};
  if(id==='custom'){
    const endpoint=validateEndpoint(profile?.endpoint??'');return {id,synthesizeMp3:async r=>{
      const key=apiKey();const response=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'audio/mpeg',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:r.model,input:r.text,voice:r.voice,response_format:'mp3',speed:Number(r.settings.speed??1)})},fetcher);return normalize(await bytes(response));
    }};
  }
  if(id==='kokoro'){
    if(!profile?.python||!profile.model_path||!profile.voices_path)throw Error('Run aaron-demo voice install-local, then voice setup');
    return {id,synthesizeMp3:async r=>{
      let data:Uint8Array;try{data=execFileSync(profile.python!,[join(import.meta.dir,'kokoro-worker.py')],{input:JSON.stringify({text:r.text,voice:r.voice,speed:Number(r.settings.speed??1),language:profile.language??'en-us',model:profile.model_path,voices:profile.voices_path}),maxBuffer:LIMIT,timeout:180000,stdio:['pipe','pipe','pipe']});}
      catch{throw Error('Local Kokoro could not synthesize. Run aaron-demo voice doctor; check its language, model and dependencies. No cloud request or fallback was made.');}return normalize(data);
    }};
  }
  if(id!=='elevenlabs')throw Error(`Unknown speech provider: ${id}`);
  const synthesize=elevenLabs(apiKey());
  return {id, synthesizeMp3: request => synthesize(request.text, {
    voice_id:request.voice, model_id:request.model, output_format:request.outputFormat, voice_settings:request.settings,
  })};
}
