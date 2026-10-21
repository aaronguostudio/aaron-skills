import {afterEach,describe,expect,test} from 'bun:test';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync,statSync,mkdirSync,symlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {voiceMain,type VoiceIO,parseVoiceArgs} from './voice-cli';
import {readConfig,saveProfile,saveKey,credentialPath,validateEndpoint,externalPath,type VoiceProfile} from './voice-config';
import {loadVoiceProfile,narrate,ffprobeMs} from './narration';
import {GOOGLE_MODEL,speechProvider,listElevenVoices,providerKey,normalizeMp3,request} from './voice-providers';
import type {Step} from '../remotion/src/projects/walkthrough-video/timeline';

const temp=()=>mkdtempSync(join(tmpdir(),'voice-test-'));
const oldEnv={...process.env};
afterEach(()=>{for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);});
function context(answers:string[]=[]){const dir=temp();process.env.AARON_DEMO_VOICE_PROFILES=join(dir,'profiles.json');const logs:string[]=[];const prompts:Array<[string,boolean|undefined]>=[];
  const io:VoiceIO={interactive:answers.length>0,log:line=>logs.push(line),ask:async(label,secret)=>{prompts.push([label,secret]);if(!answers.length)throw Error('Unexpected prompt');return answers.shift()!;}};return {dir,io,logs,prompts};}
const profile=(provider='google',extra:Partial<VoiceProfile>={}):VoiceProfile=>({provider,voice_id:'Kore',model_id:GOOGLE_MODEL,output_format:'mp3_44100_192',voice_settings:{speed:1},...extra});
const mockFetch=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>)=>(async(input:unknown,init?:RequestInit)=>fn(String(input),init??{})) as typeof fetch;
const req={text:'A short sample.',voice:'Kore',model:GOOGLE_MODEL,outputFormat:'mp3_44100_192',settings:{speed:1.1}};

describe('first narration setup',()=>{
  test('no account user sees free, imported and silent choices without a provider request',async()=>{
    const c=context(['6']);expect(await voiceMain(['setup'],c.io)).toBe(0);expect(c.logs.join('\n')).toContain('Free local Kokoro');expect(existsSync(process.env.AARON_DEMO_VOICE_PROFILES!)).toBe(false);
  });
  test('Google can be configured without authoring JSON or making a synthesis request',async()=>{
    const c=context();expect(await voiceMain(['setup','--provider','google','--name','team','--voice','Puck'],c.io)).toBe(0);
    expect(loadVoiceProfile()).toMatchObject({name:'team',provider:'google',voice_id:'Puck',api_key_env:'GEMINI_API_KEY'});
    expect(c.logs.join('\n')).toContain('No speech was generated');
  });
  test('wizard lists account voices by name and number and keeps a hidden key out of profiles/logs',async()=>{
    const c=context(['1','team','private-test-secret','2']);delete process.env.ELEVENLABS_API_KEY;
    const previous=globalThis.fetch;let calls=0;
    globalThis.fetch=mockFetch((url,init)=>{calls++;expect(url).toContain('/v2/voices');expect((init.headers as any)['xi-api-key']).toBe('private-test-secret');return Response.json({voices:[{voice_id:'a',name:'First'},{voice_id:'b',name:'Company narrator'}],has_more:false});});
    try{expect(await voiceMain(['setup'],c.io)).toBe(0);}finally{globalThis.fetch=previous;}
    expect(calls).toBe(1);expect(loadVoiceProfile().voice_id).toBe('b');expect(c.prompts.some(([_,secret])=>secret)).toBe(true);
    expect(readFileSync(process.env.AARON_DEMO_VOICE_PROFILES!,'utf8')).not.toContain('private-test-secret');expect(c.logs.join('\n')).not.toContain('private-test-secret');
    expect(providerKey(loadVoiceProfile())).toBe('private-test-secret');
    if(process.platform!=='win32')expect(statSync(credentialPath()).mode&0o777).toBe(0o600);
  });
  test('existing default, other profiles and explicit provider settings survive new setup',async()=>{
    const c=context();await saveProfile('old',profile('elevenlabs',{model_id:'eleven_multilingual_v2',voice_id:'own-voice'}));
    expect(await voiceMain(['setup','--provider','google','--name','new'],c.io)).toBe(0);expect(readConfig().default_profile).toBe('old');expect(readConfig().profiles.old.voice_id).toBe('own-voice');
    expect(await voiceMain(['use','new'],c.io)).toBe(0);expect(loadVoiceProfile().provider).toBe('google');
    expect(await voiceMain(['setup','--provider','google','--name','old'],c.io)).toBe(2);expect(readConfig().profiles.old.provider).toBe('elevenlabs');
  });
  test('saving private configuration never changes permissions of an existing shared parent',async()=>{
    const c=context();if(process.platform!=='win32')chmodSync(c.dir,0o755);
    await saveProfile('sample',profile());await saveKey('private');
    if(process.platform!=='win32'){expect(statSync(c.dir).mode&0o777).toBe(0o755);expect(statSync(process.env.AARON_DEMO_VOICE_PROFILES!).mode&0o777).toBe(0o600);}
  });
  test('company endpoint config needs no JSON and can explicitly disable authentication',async()=>{
    const c=context();process.env.AARON_DEMO_TTS_API_KEY='unrelated-key';
    expect(await voiceMain(['setup','--provider','custom','--name','company','--endpoint','http://127.0.0.1:9800/v1/audio/speech','--voice','team-narrator','--model','company-tts','--no-key'],c.io)).toBe(0);
    const p=loadVoiceProfile();expect(p).toMatchObject({provider:'custom',auth:'none',voice_id:'team-narrator'});expect(providerKey(p)).toBe('');
  });
  test('missing local install gives an actionable account-free path without downloading implicitly',async()=>{
    const c=context();expect(await voiceMain(['setup','--provider','kokoro','--local-dir',join(c.dir,'missing')],c.io)).toBe(2);expect(c.logs.join('\n')).toContain('voice install-local');expect(existsSync(join(c.dir,'missing'))).toBe(false);
  });
  test('invalid flags, relative output and existing sample cannot trigger synthesis',async()=>{
    const c=context();expect(()=>parseVoiceArgs(['setup','--api-key','secret'])).toThrow('Unknown');expect(()=>parseVoiceArgs(['setup','--voice','a','--voice','b'])).toThrow('Duplicate');
    expect(await voiceMain(['test','--text','sample','--out','relative.mp3'],c.io)).toBe(2);const out=join(c.dir,'existing.mp3');writeFileSync(out,'original');
    expect(await voiceMain(['test','--text','sample','--out',out],c.io)).toBe(2);expect(readFileSync(out,'utf8')).toBe('original');
  });
  test('listing a different provider profile never sends its key to ElevenLabs',async()=>{
    const c=context();await saveProfile('google',profile());process.env.GEMINI_API_KEY='private';
    expect(await voiceMain(['voices','--provider','elevenlabs','--profile','google'],c.io)).toBe(2);expect(c.logs.join('\n')).toContain('key was not read or sent');
  });
});

describe('provider requests and failures',()=>{
  test('ElevenLabs account voices follow pagination, including a company voice on the next page',async()=>{
    let calls=0;const voices=await listElevenVoices('private','Company',mockFetch((url,init)=>{calls++;expect(init.redirect).toBe('error');expect(url).toContain('search=Company');return Response.json(calls===1?{voices:[],has_more:true,next_page_token:'next'}:{voices:[{name:'Company',voice_id:'company-id'}],has_more:false});}));
    expect(calls).toBe(2);expect(voices).toEqual([{id:'company-id',name:'Company',description:undefined}]);
  });
  test('Google follows the documented Interactions WAV contract with no server-side storage',async()=>{
    let normalized=false;
    const adapter=speechProvider('google',()=> 'private',profile(),{fetcher:mockFetch((url,init)=>{
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');expect((init.headers as any)['x-goog-api-key']).toBe('private');const body=JSON.parse(init.body as string);
      expect(body).toMatchObject({model:GOOGLE_MODEL,store:false,response_format:{type:'audio',mime_type:'audio/wav'},generation_config:{speech_config:[{voice:'Kore'}]}});expect(body.input[0].content[0].text).toBe(req.text);
      return Response.json({steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/wav',data:Buffer.from('wav fixture').toString('base64')}]}]});
    }),normalize:(data,speed)=>{normalized=true;expect(new TextDecoder().decode(data)).toBe('wav fixture');expect(speed).toBe(1.1);return new Uint8Array([1]);}});
    expect(await adapter.synthesizeMp3(req)).toEqual(new Uint8Array([1]));expect(normalized).toBe(true);
  });
  test('company adapter sends OpenAI-compatible fields and only its selected Bearer credential',async()=>{
    const p=profile('custom',{endpoint:'https://speech.example/v1/audio/speech'});
    const adapter=speechProvider('custom',()=> 'company-secret',p,{fetcher:mockFetch((url,init)=>{
      expect(url).toBe(p.endpoint!);expect((init.headers as any).Authorization).toBe('Bearer company-secret');expect(JSON.parse(init.body as string)).toEqual({model:req.model,input:req.text,voice:req.voice,response_format:'mp3',speed:1.1});return new Response(new Uint8Array([9]));
    }),normalize:data=>data});expect(await adapter.synthesizeMp3(req)).toEqual(new Uint8Array([9]));
  });
  test('HTTP errors give recovery steps and never print server bodies or credentials',async()=>{
    for(const status of [401,403,429,500]){
      const adapter=speechProvider('google',()=> 'private-key',profile(),{fetcher:mockFetch(()=>new Response('private-key and server internals',{status}))});
      try{await adapter.synthesizeMp3(req);throw Error('Expected refusal');}catch(error){const message=(error as Error).message;expect(message).toContain(String(status));expect(message).not.toContain('private-key');expect(message).toContain('No response body');}
    }
  });
  test('timeouts, redirects, missing audio and malformed payloads cannot silently fall back',async()=>{
    await expect(request('https://speech.example',{},mockFetch(()=>{throw Error('secret in URL');}))).rejects.toThrow('No fallback');
    for(const data of [{},{steps:[]},{steps:[{type:'model_output',content:[{type:'audio',data:'bad <> data'}]}]}]){
      await expect(speechProvider('google',()=> 'secret',profile(),{fetcher:mockFetch(()=>Response.json(data))}).synthesizeMp3(req)).rejects.toThrow('no encoded audio');
    }
  });
  test('remote cleartext and credential-bearing endpoints are refused before reading a key',()=>{
    for(const value of ['http://speech.example/v1/audio/speech','https://user:secret@speech.example/speech','https://speech.example/speech?key=secret','file:///tmp/speech'])expect(()=>validateEndpoint(value)).toThrow();
    expect(validateEndpoint('http://localhost:8000/v1/audio/speech')).toContain('localhost');
    let reads=0;expect(()=>speechProvider('custom',()=>{reads++;return 'secret';},profile('custom',{endpoint:'http://speech.example'}))).toThrow();expect(reads).toBe(0);
  });
  test('credential/config outputs stay outside Git, including symlinked parent directories',async()=>{
    const c=context();mkdirSync(join(c.dir,'repo'));mkdirSync(join(c.dir,'repo','.git'));symlinkSync(join(c.dir,'repo'),join(c.dir,'alias'),process.platform==='win32'?'junction':'dir');
    expect(()=>externalPath(join(c.dir,'alias','profile.json'))).toThrow('outside every Git');
    const id=await saveKey('private');process.env.TEST_VOICE_KEY='environment';expect(providerKey(profile('google',{api_key_env:'TEST_VOICE_KEY',credential_id:id}))).toBe('environment');
  });
});

describe('audio integrity and narration reuse',()=>{
  test('legacy ElevenLabs clips remain cached after upgrading without another provider call',async()=>{
    const dir=temp(),p=profile('elevenlabs'),line='Existing narration.';
    const hash=createHash('sha256').update(JSON.stringify(['elevenlabs',p.voice_id,p.model_id,p.output_format,p.voice_settings,line])).digest('hex').slice(0,12);
    mkdirSync(join(dir,'narration'));writeFileSync(join(dir,'narration',`01-${hash}.mp3`),'existing audio');
    const steps=[{id:'a',caption:line,kind:'action',startMs:0,endMs:1000,clicks:[],shot:null}] as Step[];
    const clips=await narrate(dir,steps,p,async()=>{throw Error('Must not spend on an unchanged cached line');},()=>1000);
    expect(clips[0].file).toBe(`narration/01-${hash}.mp3`);
  });
  test('WAV becomes decodable MP3 and invalid audio is rejected',()=>{
    const samples=2400,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(24000,24);buffer.writeUInt32LE(48000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
    for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(3000*Math.sin(2*Math.PI*440*i/24000)),44+i*2);
    const out=join(temp(),'speech.mp3');writeFileSync(out,normalizeMp3(buffer));expect(ffprobeMs(out)).toBeGreaterThan(90);expect(()=>normalizeMp3(new TextEncoder().encode('not audio'))).toThrow('could not be decoded');
  });
  test('interrupted synthesis retains completed clips and retry generates only the missing line',async()=>{
    const dir=temp(),p=profile('custom',{endpoint:'https://one.example/speech'}),steps=['one','two'].map(id=>({id,caption:id,kind:'action',startMs:0,endMs:1000,clicks:[],shot:null})) as Step[];let calls=0;
    await expect(narrate(dir,steps,p,async()=>{calls++;if(calls===2)throw Error('temporary outage');return new Uint8Array([1]);},()=>1000)).rejects.toThrow('temporary outage');
    expect(readdirSync(join(dir,'narration'))).toHaveLength(1);let retries=0;await narrate(dir,steps,p,async()=>{retries++;return new Uint8Array([1]);},()=>1000);expect(retries).toBe(1);
    await narrate(dir,[steps[0]],{...p,endpoint:'https://two.example/speech'},async()=>{retries++;return new Uint8Array([1]);},()=>1000);expect(retries).toBe(2);
  });
  test('a clip that fails media probing is never published in the cache',async()=>{
    const dir=temp(),steps=[{id:'a',caption:'sample',kind:'action',startMs:0,endMs:1000,clicks:[],shot:null}] as Step[];
    await expect(narrate(dir,steps,profile(),async()=>new Uint8Array([1]),()=>{throw Error('invalid audio');})).rejects.toThrow('invalid audio');expect(readdirSync(join(dir,'narration'))).toEqual([]);
  });
});
