import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,renameSync,unlinkSync,openSync,writeSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {externalPath,privateJson,type VoiceProfile} from './voice-config';
import {privateDirectory,privatePath} from '../capture/scripts/platform.mjs';

export const localDirectory=()=>join(homedir(),'.local','share','aaron-skills','voices','kokoro-v1');
const assets=[
  {name:'kokoro-v1.0.int8.onnx',sha256:'ae315a79b623f244700e4afb9246c46a26066782e049ba174bf3ba433970ee9c'},
  {name:'voices-v1.0.bin',sha256:'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'},
];
export function localProfile(directory=localDirectory()):VoiceProfile{
  const ready=join(directory,'ready.json');externalPath(ready);
  if(!existsSync(ready))throw Error('Kokoro is not installed. Run aaron-demo voice install-local (downloads about 143 MB of models plus Python packages).');
  const files=JSON.parse(readFileSync(ready,'utf8'));
  return {provider:'kokoro',voice_id:'af_sarah',model_id:'kokoro-v1.0-int8',output_format:'mp3_44100_192',voice_settings:{speed:1},language:'en-us',python:files.python,model_path:files.model_path,voices_path:files.voices_path};
}
export function localVoices(profile:VoiceProfile):string[]{
  try{return JSON.parse(execFileSync(profile.python!,[join(import.meta.dir,'kokoro-worker.py')],{input:JSON.stringify({action:'voices',voices:profile.voices_path}),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000}));}
  catch{throw Error('Cannot read local voices; run aaron-demo voice install-local to repair its dependencies');}
}
export async function installLocal(directory:string,python:string):Promise<void>{
  externalPath(join(directory,'ready.json'));
  let version:number[];try{version=JSON.parse(execFileSync(python,['-c','import sys,json; print(json.dumps(list(sys.version_info[:2])))'],{encoding:'utf8'}));}catch{throw Error('Choose a Python 3.10–3.13 executable with --python');}
  if(version[0]!==3||version[1]<10||version[1]>13)throw Error('Kokoro requires Python 3.10–3.13; rerun voice install-local --python <compatible-python>. The main runtime is unchanged.');
  await privateDirectory(directory);
  const environment=join(directory,'venv'),executable=join(environment,process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python3');
  if(!existsSync(executable))execFileSync(python,['-m','venv',environment],{stdio:'inherit'});
  const installed=spawnSync(executable,['-m','pip','install','--disable-pip-version-check','kokoro-onnx==0.6.1','soundfile==0.13.1'],{stdio:'inherit'});
  if(installed.status!==0)throw Error('Optional Kokoro dependency installation failed; retain this directory and retry. Cloud/imported routes remain available.');
  for(const asset of assets){
    const file=join(directory,asset.name);externalPath(file);
    if(existsSync(file)&&createHash('sha256').update(readFileSync(file)).digest('hex')===asset.sha256)continue;
    const pending=file+'.'+randomUUID()+'.download';externalPath(pending);
    let fd:number|undefined;
    try{
      const response=await fetch(`https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/${asset.name}`,{signal:AbortSignal.timeout(600000)});
      if(!response.ok||!response.body)throw Error('Model download failed; retry voice install-local');
      fd=openSync(pending,'wx',0o600);const hash=createHash('sha256');let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>350*1024*1024)throw Error('Model download exceeds expected size');hash.update(chunk);writeSync(fd,chunk);}
      closeSync(fd);fd=undefined;
      if(hash.digest('hex')!==asset.sha256)throw Error('Model checksum mismatch; the incomplete download was discarded');
      await privatePath(pending);renameSync(pending,file);
    }finally{if(fd!==undefined)closeSync(fd);if(existsSync(pending))unlinkSync(pending);}
  }
  await privateJson(join(directory,'ready.json'),{python:executable,model_path:join(directory,assets[0].name),voices_path:join(directory,assets[1].name)});
}
