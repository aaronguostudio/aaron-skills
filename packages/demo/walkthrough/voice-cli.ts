#!/usr/bin/env bun
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {existsSync,writeFileSync,unlinkSync,linkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname,extname,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {PROVIDERS,profilePath,readConfig,privateJson,saveProfile,saveKey,externalPath,validateProfile,type VoiceProfile} from './voice-config';
import {GOOGLE_MODEL,GOOGLE_VOICES,listElevenVoices,providerKey,speechProvider,type Voice} from './voice-providers';
import {loadVoiceProfile,ffprobeMs} from './narration';
import {installLocal,localDirectory,localProfile,localVoices} from './kokoro-local';
import {privateDirectory,privatePath} from '../capture/scripts/platform.mjs';

const HELP=`Usage: aaron-demo voice setup | list | voices | use <name> | doctor | test | install-local

setup: guided first-use setup (no JSON editing), or provide --provider, --name, --voice.
  Providers: elevenlabs, google (Gemini API), custom (OpenAI-compatible), kokoro (free local).
  --model ID --endpoint URL --key-env NAME --no-key --local-dir PATH --language en-us|en-gb
  --default chooses this profile for narration; --replace explicitly updates an existing name.
voices: --provider elevenlabs|google|kokoro [--search TEXT] [--profile NAME]
  Lists ElevenLabs account voices by name/ID; no speech is generated.
test: --profile NAME --text "A short sample." --out /external/sample.mp3
  Explicitly generates a short sample using the selected account (may consume quota).
install-local: --python /path/to/python3.12 [--local-dir PATH] --yes
  Optional isolated Kokoro install; downloads ~143 MB of checked models plus Python packages.
  No API key, cloud synthesis or subscription. Local acceptance currently covers English on macOS arm64.
All commands accept --profiles /external/voice-profiles.json; keys are never command-line flags.
Silent rendering and --audio imports require no account. See aaron-demo docs narration.`;
type Options=Record<string,string|boolean>;
export function parseVoiceArgs(args:string[]):{action:string;options:Options;positionals:string[]}{
  const values=new Set(['provider','name','voice','model','endpoint','key-env','local-dir','python','language','search','out','text','profile','profiles']);
  const flags=new Set(['yes','replace','default','no-key']); const options:Options={},positionals:string[]=[];let action='';
  for(let i=0;i<args.length;i++){
    const value=args[i];if(value.startsWith('--')){const key=value.slice(2);if(Object.hasOwn(options,key))throw Error(`Duplicate option: --${key}`);
      if(flags.has(key))options[key]=true;else if(values.has(key)){const next=args[++i];if(!next||next.startsWith('--'))throw Error(`--${key} needs a value`);options[key]=next;}else throw Error(`Unknown voice option: --${key}`);
    }else if(!action)action=value;else positionals.push(value);
  }
  return {action:action||'help',options,positionals};
}
export type VoiceIO={interactive:boolean;ask:(label:string,secret?:boolean)=>Promise<string>;log:(text:string)=>void};
const clean=(value:string)=>value.replace(/[\x00-\x1f\x7f-\x9f]/g,' ');
function printVoices(voices:Voice[],io:VoiceIO){voices.forEach((v,i)=>io.log(`${i+1}. ${clean(v.name)} — ${clean(v.id)}${v.description?` (${clean(v.description)})`:''}`));}
const text=(o:Options,key:string,fallback='')=>typeof o[key]==='string'?o[key] as string:fallback;

async function setup(o:Options,io:VoiceIO):Promise<void>{
  let provider=text(o,'provider');
  if(!provider){if(!io.interactive)throw Error('Run voice setup in a terminal or supply --provider elevenlabs|google|custom|kokoro. No ElevenLabs account is required.');
    io.log('How would you like to add narration?\n1. My ElevenLabs account\n2. My Google Gemini API account\n3. My company speech endpoint\n4. Free local Kokoro (English; optional download)\n5. Import existing audio\n6. Continue without narration');
    const choice=await io.ask('Choose 1–6: ');if(choice==='5'){io.log('Ask Film to prepare your existing clips for --audio; no account or voice profile is needed. See aaron-demo docs narration.');return;}if(choice==='6'){io.log('Continue with render without --narrate. Your script can still be drafted.');return;}
    provider=PROVIDERS[Number(choice)-1]??'';
  }
  if(!PROVIDERS.includes(provider as any))throw Error('Choose elevenlabs, google, custom or kokoro');
  let name=text(o,'name');if(!name)name=io.interactive?(await io.ask(`Profile name [my-${provider}]: `))||`my-${provider}`:`my-${provider}`;
  const config=readConfig();if(Object.hasOwn(config.profiles,name)&&!o.replace)throw Error(`Profile ${name} already exists; choose a new --name or explicitly use --replace`);
  let p:VoiceProfile={provider,voice_id:text(o,'voice'),model_id:text(o,'model',provider==='elevenlabs'?'eleven_multilingual_v2':provider==='google'?GOOGLE_MODEL:''),output_format:'mp3_44100_192',voice_settings:provider==='elevenlabs'?{stability:0.5,similarity_boost:0.75,use_speaker_boost:true}:{speed:1}};
  let enteredKey='';
  if(provider==='kokoro'){
    const directory=text(o,'local-dir',localDirectory());
    try{p={...localProfile(directory),voice_id:p.voice_id||'af_sarah'};}catch(error){
      if(!io.interactive)throw error;
      io.log('Kokoro needs Python 3.10–3.13, ~143 MB of model downloads and optional Python packages. Synthesis then runs locally without an account.');
      if((await io.ask('Install it in a separate environment now? [y/N]: ')).toLowerCase()!=='y')throw error;
      const python=text(o,'python')||(await io.ask('Python 3.10–3.13 executable [python3]: '))||'python3';await installLocal(directory,python);p={...localProfile(directory),voice_id:p.voice_id||'af_sarah'};
    }
    p.language=text(o,'language','en-us');if(!['en-us','en-gb'].includes(p.language))throw Error('The bundled Kokoro route currently validates English only: en-us or en-gb');
    if(!text(o,'voice'))p.voice_id=p.language==='en-gb'?'bf_emma':'af_sarah';
  }else{
    if(provider==='custom'){
      p.endpoint=text(o,'endpoint')||(io.interactive?await io.ask('Full OpenAI-compatible speech URL (for example https://speech.example/v1/audio/speech): '):'');
      p.model_id=p.model_id||(io.interactive?await io.ask('Model name supplied by your company: '):'');
    }
    const variable=text(o,'key-env',provider==='elevenlabs'?'ELEVENLABS_API_KEY':provider==='google'?'GEMINI_API_KEY':'AARON_DEMO_TTS_API_KEY');
    if(!o['no-key']){
      p.api_key_env=variable;
      if(!process.env[variable]?.trim()&&io.interactive){
        io.log(provider==='elevenlabs'?'Get your API key at https://elevenlabs.io/app/settings/api-keys. Your plan must permit this voice through the API.':provider==='google'?'Get a Gemini API key at https://aistudio.google.com/apikey. Model access, billing and quotas depend on your account.':'Use the key issued for this company speech endpoint.');
        enteredKey=await io.ask(`API key (hidden; saved privately on this machine; blank configures ${variable} for later): `,true);
      }
    }else if(provider!=='custom')throw Error('--no-key is only for a company/local endpoint that needs no authentication');
    else p.auth='none';
  }
  if(!p.voice_id&&provider==='elevenlabs'){
    let voices:Voice[]=[];
    try{voices=await listElevenVoices(enteredKey||providerKey(p),text(o,'search'));}catch(error){
      io.log(error instanceof Error?error.message:'Unable to list voices');
      if(!io.interactive)throw Error('Set ELEVENLABS_API_KEY to list account voices, or supply --voice. Google, free local and imported audio are also available.');
    }
    printVoices(voices,io);
    if(io.interactive){const selected=await io.ask(voices.length?'Choose a voice by number, exact name or ID: ':'Voice ID (or leave blank and choose another route with voice setup): ');p.voice_id=voices[Number(selected)-1]?.id||voices.find(v=>v.name===selected||v.id===selected)?.id||selected;}
  }else if(!text(o,'voice')&&io.interactive){
    const voices=provider==='google'?GOOGLE_VOICES:provider==='kokoro'?localVoices(p).filter(id=>p.language==='en-gb'?/^[b][fm]_/.test(id):/^[a][fm]_/.test(id)).map(id=>({id,name:id})):[];
    printVoices(voices,io);const selected=await io.ask(provider==='custom'?'Company voice ID/name: ':`Choose a voice by number/name [${p.voice_id||'Kore'}]: `);
    p.voice_id=voices[Number(selected)-1]?.id||selected||p.voice_id||'Kore';
  }
  if(!p.voice_id&&provider==='google')p.voice_id='Kore';
  validateProfile(p);
  if(enteredKey)p.credential_id=await saveKey(enteredKey);
  await saveProfile(name,p,{replace:!!o.replace,makeDefault:!!o.default});
  io.log(`Saved ${name} (${provider}, ${p.voice_id}). ${readConfig().default_profile===name?'It is the default narrator.':`Select it with --voice-profile ${name}, or voice use ${name}.`} No speech was generated.`);
  io.log(`Try: aaron-demo voice test --profile ${name} --text "A quick tour of the workflow." --out /external/sample.mp3`);
}

export async function voiceMain(args:string[],io:VoiceIO):Promise<number>{
  try{
    if(args.includes('--help')||args.includes('-h')||!args.length){io.log(HELP);return 0;}
    const {action,options:o,positionals}=parseVoiceArgs(args);
    if(o.profiles){externalPath(text(o,'profiles'));process.env.AARON_DEMO_VOICE_PROFILES=text(o,'profiles');}
    if(positionals.length&&(action!=='use'||positionals.length!==1))throw Error('Unexpected voice arguments');
    if(action==='setup')await setup(o,io);
    else if(action==='list'){
      const config=readConfig();for(const [name,p] of Object.entries(config.profiles))io.log(`${name===config.default_profile?'*':' '} ${clean(name)}: ${clean(p.provider??'unknown')} / ${clean(p.voice_id)}`);
      if(!Object.keys(config.profiles).length)io.log('No narrator configured. Run aaron-demo voice setup; choose an existing account, a company endpoint or free local Kokoro.');
    }else if(action==='use'){
      const config=readConfig(),name=positionals[0];if(!name||!Object.hasOwn(config.profiles,name))throw Error('Choose an existing profile from voice list');validateProfile(config.profiles[name]);config.default_profile=name;await privateJson(profilePath(),config);io.log(`Default narrator: ${clean(name)}`);
    }else if(action==='voices'){
      const provider=text(o,'provider')||(text(o,'profile')?loadVoiceProfile(text(o,'profile')).provider:'');
      if(provider==='google')printVoices(GOOGLE_VOICES,io);
      else if(provider==='elevenlabs'){
        const p=text(o,'profile')?loadVoiceProfile(text(o,'profile')):{provider:'elevenlabs',voice_id:'pending',model_id:'pending',output_format:'mp3',voice_settings:{}};
        if(p.provider!=='elevenlabs')throw Error('The selected profile belongs to another provider; its key was not read or sent');
        printVoices(await listElevenVoices(providerKey(p),text(o,'search')),io);
      }else if(provider==='kokoro'){
        const p=text(o,'profile')?loadVoiceProfile(text(o,'profile')):localProfile(text(o,'local-dir',localDirectory()));
        if(p.provider!=='kokoro')throw Error('Choose a Kokoro profile for local voice discovery');
        printVoices(localVoices(p).map(id=>({id,name:id})),io);
      }
      else throw Error('Choose --provider elevenlabs|google|kokoro. Company voice IDs are supplied by the endpoint owner.');
    }else if(action==='install-local'){
      if(!o.yes&&(!io.interactive||(await io.ask('Download ~143 MB of models plus optional Python packages into a separate environment? [y/N]: ')).toLowerCase()!=='y'))throw Error('No download started. Use --yes when you choose to install local Kokoro.');
      await installLocal(text(o,'local-dir',localDirectory()),text(o,'python',process.env.AARON_DEMO_PYTHON||'python3'));io.log('Kokoro installed. Run voice setup --provider kokoro to choose and save a narrator.');
    }else if(action==='doctor'){
      const p=loadVoiceProfile(text(o,'profile')||undefined);validateProfile(p);
      if(p.provider==='kokoro'){execFileSync(p.python!,['-c','import kokoro_onnx, soundfile'],{stdio:'pipe',timeout:30000});if(!localVoices(p).includes(p.voice_id))throw Error('Configured local voice is unavailable');}
      else providerKey(p);
      io.log(`PASS ${clean(p.name)}: ${p.provider} configuration${p.provider==='kokoro'?' and local dependencies':''}. No speech generated; cloud access/quota requires voice test.`);
    }else if(action==='test'){
      const out=text(o,'out'),line=text(o,'text');externalPath(out);
      if(extname(out).toLowerCase()!=='.mp3'||existsSync(out))throw Error('Choose a new external --out path ending in .mp3');
      if(!line.trim()||line.length>1000)throw Error('Provide --text with 1–1000 characters for a short sample');
      const p=loadVoiceProfile(text(o,'profile')||undefined),adapter=speechProvider(p.provider!,()=>providerKey(p),p);
      if(!existsSync(dirname(out)))await privateDirectory(dirname(out));
      const pending=out+'.'+randomUUID()+'.tmp';externalPath(pending);
      try{writeFileSync(pending,await adapter.synthesizeMp3({text:line,voice:p.voice_id,model:p.model_id,outputFormat:p.output_format,settings:p.voice_settings,language:p.language}),{flag:'wx',mode:0o600});const ms=ffprobeMs(pending);await privatePath(pending);linkSync(pending,out);io.log(`Sample: ${out} (${ms} ms). Listen before rendering a full video.`);}finally{if(existsSync(pending))unlinkSync(pending);}
    }else if(action==='help')io.log(HELP);else throw Error('Unknown voice command. Run aaron-demo voice --help');
    return 0;
  }catch(error){io.log(error instanceof Error?error.message:'Voice command failed');return 2;}
}
if(import.meta.main){
  let muted=false;const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding as BufferEncoding);done();}});
  const terminal=!!process.stdin.isTTY;const rl=terminal?createInterface({input:process.stdin,output,terminal:true}):undefined;
  const io:VoiceIO={interactive:terminal,log:line=>console.log(line),ask:async(label,secret=false)=>{if(!rl)throw Error('Interactive setup requires a terminal; use documented flags instead');process.stdout.write(label);muted=secret;try{return (await rl.question('')).trim();}finally{muted=false;if(secret)process.stdout.write('\n');}}};
  try{process.exitCode=await voiceMain(process.argv.slice(2),io);}finally{rl?.close();}
}
