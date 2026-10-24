// A scripted first-use journey through exported tools, with synthetic voices.
// Raw output, screenshots and credentials are written only to the external run.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [runtimeArg,workspaceArg]=process.argv.slice(2);
if(!runtimeArg||!workspaceArg)throw Error('Supply an exported runtime and external workspace');
const runtime=resolve(runtimeArg),workspace=resolve(workspaceArg);
const configuration=JSON.parse(await readFile(join(runtime,'installed.json'),'utf8'));
const temporary=join(workspace,'tmp');await mkdir(temporary,{recursive:true});
const env={...process.env,TMPDIR:temporary,TEMP:temporary,TMP:temporary,PLAYWRIGHT_BROWSERS_PATH:configuration.playwrightBrowsers,AARON_SKILLS_NO_UPDATE:'1'};
const report:any={stages:[],scriptedPrompts:0,providerFixtureRequests:0};
const execute=promisify(execFile);
let sequence=0;
async function command(tool:string,args:string[],binary=false):Promise<any>{
  try{
    const result=await execute(tool,args,{env,encoding:binary?'buffer':'utf8',maxBuffer:16*1024*1024,timeout:240000});
    await writeFile(join(workspace,`command-${++sequence}.log`),binary?'binary response omitted':String(result.stdout)+'\n'+String(result.stderr));
    return result.stdout;
  }catch(error:any){
    await writeFile(join(workspace,`command-${++sequence}-failed.log`),String(error.stdout??'')+'\n'+String(error.stderr??''));
    throw error;
  }
}
const cli=(...args:string[])=>command(configuration.tools.python,[join(runtime,'scripts/cli.py'),...args]);
const save=()=>writeFile(join(workspace,'journey.json'),JSON.stringify(report,null,2)+'\n');
async function stage(id:string,action:()=>Promise<unknown>){
  const start=performance.now();
  try{const detail=await action();report.stages.push({id,status:'passed',seconds:(performance.now()-start)/1000,detail});}
  catch(error){report.stages.push({id,status:'failed',failureType:error instanceof Error?error.name:'Error'});throw error;}
  finally{await save();}
}
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const profilePath=env.AARON_DEMO_VOICE_PROFILES!;
const {voiceMain}=await import(pathToFileURL(join(runtime,'packages/demo/walkthrough/voice-cli.ts')).href);
const voiceLog:string[]=[];
function scriptedIO(answers:string[]){return {interactive:true,log:(line:string)=>voiceLog.push(line),ask:async(question:string)=>{
  report.scriptedPrompts++;voiceLog.push(question);check(answers.length,'Unexpected additional wizard question');return answers.shift()!;
}};}
const tone=join(workspace,'fixture-tone.wav');
await command(configuration.tools.ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=1.1','-ar','24000','-ac','1',tone]);
const wav=await readFile(tone);
let speechRequests=0;
const provider=createServer(async(request,response)=>{
  report.providerFixtureRequests++;
  for await(const ignored of request){} // consume only synthetic request text
  if(request.url?.startsWith('/voices')){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({voices:[{voice_id:'fixture-voice',name:'Fixture Narrator'}],has_more:false}));}
  else if(request.url==='/speech'){speechRequests++;response.setHeader('Content-Type','audio/wav');response.end(wav);}
  else{response.statusCode=404;response.end();}
});
await new Promise<void>(done=>provider.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${(provider.address() as any).port}`;
const originalFetch=globalThis.fetch;
let run='';
const captureFiles=['capture.json','steps.json','video.webm'];
const fingerprints=async()=>Object.fromEntries(await Promise.all(captureFiles.map(async name=>[name,createHash('sha256').update(await readFile(join(run,name))).digest('hex')])));
try{
  await stage('empty-profile',async()=>{
    check(!existsSync(profilePath),'Voice profile must start absent');
    check((await cli('voice','list')).includes('No narrator configured'),'Ambient narrator leaked into a clean profile');
    return {ambientNarrator:false,profileFilesInitiallyAbsent:true};
  });
  await stage('no-account-choices',async()=>{
    for(const answer of ['6','5'])check(await voiceMain(['setup'],scriptedIO([answer]))===0,'No-account wizard choice failed');
    check(!existsSync(profilePath),'Silent/import choices must not save a cloud account');
    check(voiceLog.some(line=>line.includes('Free local Kokoro'))&&voiceLog.some(line=>line.includes('Import existing audio')),'No-account options were not offered');
    return {silentAndImport:true,localOptionOffered:true,localModelDownload:'not-assessed'};
  });
  await stage('named-account-voice-contract',async()=>{
    const fixtureKey='fixture-'+randomUUID();
    // Only this process's provider contract calls are redirected. An unexpected
    // destination fails instead of reaching a live account.
    globalThis.fetch=(async(input:any,options:any)=>{
      const url=new URL(String(input));
      if(url.hostname!=='api.elevenlabs.io')throw Error('Unexpected provider destination');
      return originalFetch(origin+(url.pathname==='/v2/voices'?'/voices':'/speech'),options);
    }) as typeof fetch;
    check(await voiceMain(['setup','--name','account-narrator','--default'],scriptedIO(['1',fixtureKey,'Fixture Narrator']))===0,'Named account voice setup failed');
    const profiles=JSON.parse(await readFile(profilePath,'utf8'));
    check(profiles.profiles['account-narrator'].voice_id==='fixture-voice','Voice selection by name did not persist');
    check(!JSON.stringify(profiles).includes(fixtureKey)&&!voiceLog.join('\n').includes(fixtureKey),'Credential leaked into profile or output');
    check(existsSync(join(dirname(profilePath),'voice-credentials.json')),'Private credential storage was not created');
    check(await voiceMain(['test','--profile','account-narrator','--text','Synthetic onboarding sample.','--out',join(workspace,'account-sample.mp3')],scriptedIO([]))===0,'Synthetic account sample failed');
    return {selectionByName:true,sampleDecodable:true,liveAccountAccess:'not-assessed',voiceQuality:'not-assessed'};
  });
  globalThis.fetch=originalFetch;
  await stage('company-endpoint-setup',async()=>{
    await cli('voice','setup','--provider','custom','--name','company-narrator','--endpoint',origin+'/speech','--model','fixture-tts','--voice','fixture-voice','--no-key','--default');
    check((await cli('voice','doctor','--profile','company-narrator')).includes('PASS'),'Company endpoint configuration failed');
    check(Object.keys(JSON.parse(await readFile(profilePath,'utf8')).profiles).length===2,'Adding a narrator replaced the original profile');
    return {transport:'loopback HTTP',realAccount:false,profilesPreserved:true};
  });
  await stage('capture-and-silent-output',async()=>{
    const output=await cli('smoke');
    const match=output.match(/^Report: (.+)$/m);check(match,'Installed smoke did not return an evidence report');
    run=dirname(match![1].trim());
    check(JSON.parse(await readFile(join(run,'smoke-report.json'),'utf8')).passed,'Installed capture/render/page did not pass');
    report.captureFingerprint=await fingerprints();
    report.captureRun=run;
    return {realBrowserCapture:true,silentVideo:true,htmlHandoff:true};
  });
  const plain=join(workspace,'plain.json'),designed=join(workspace,'designed.json');
  const base={version:2,title:'First walkthrough',cover:{preset:'blue-portal'},brand:{fallback:'omit'},intro:{enabled:false,soundPreset:'none'},outro:{enabled:false},layout:{preset:'plain-caption'},body:{background:'#FFFFFF',foreground:'#171717',logoPosition:'none'}};
  await writeFile(plain,JSON.stringify(base));
  await writeFile(designed,JSON.stringify({...base,cover:{preset:'linen-emboss'},layout:{preset:'studio-paper'},body:{logoPosition:'none'}}));
  await stage('cover-and-body-preview',async()=>{
    const catalog=await cli('cover','--list');check(catalog.includes('blue-portal')&&catalog.includes('linen-emboss'),'Cover selection list is incomplete');
    for(const [name,file] of [['plain',plain],['designed',designed]]){
      const out=join(workspace,'previews',name,'video.mp4');
      const before=speechRequests;
      await cli('render',run,'--presentation',file,'--preview','--cover','--out',out);
      check(existsSync(join(dirname(out),'cover.png'))&&existsSync(join(dirname(out),'body-preview.png')),'Preview must include both cover and body');
      check(!existsSync(out)&&speechRequests===before,'Preview rendered a full video or synthesized speech');
    }
    return {coverAndBodySeparate:true,plainAndDesigned:true,noSynthesis:true,humanSelection:'not-assessed'};
  });
  const probe=async(file:string)=>JSON.parse(await command(configuration.tools.ffprobe,['-v','error','-show_streams','-of','json',file]));
  await stage('imported-audio-output',async()=>{
    const first=JSON.parse(await readFile(join(run,'steps.json'),'utf8'))[0].id;
    const audio=join(workspace,'imported.json');
    await writeFile(audio,JSON.stringify({version:1,aiGenerated:false,clips:[{at:first,file:'fixture-tone.wav',text:'Synthetic imported audio for the first scene.'}]}));
    const out=join(workspace,'outputs','imported','video.mp4'),before=speechRequests;
    await cli('render',run,'--presentation',plain,'--audio',audio,'--out',out,'--stills');
    check((await probe(out)).streams.some((s:any)=>s.codec_type==='audio'),'Imported audio missing from MP4');
    check(speechRequests===before,'Imported audio contacted a speech provider');
    return {audioTrack:true,providerCalls:0};
  });
  await stage('narrated-output-and-reuse',async()=>{
    const out=join(workspace,'outputs','narrated','video.mp4');
    await cli('render',run,'--presentation',designed,'--narrate','--voice-profile','company-narrator','--out',out,'--stills');
    check((await probe(out)).streams.some((s:any)=>s.codec_type==='audio'),'Narration missing from MP4');
    const before=speechRequests;
    await cli('render',run,'--presentation',plain,'--narrate','--voice-profile','company-narrator','--out',join(workspace,'outputs','reused','video.mp4'));
    check(speechRequests===before,'An unchanged narration was synthesized again');
    check(JSON.stringify(await fingerprints())===JSON.stringify(report.captureFingerprint),'Presentation revision changed original capture evidence');
    return {narratedVideo:true,cacheReuse:true,originalCaptureUnchanged:true,realVoiceQuality:'not-assessed'};
  });
}finally{
  globalThis.fetch=originalFetch;
  await new Promise<void>(done=>provider.close(()=>done()));
  await writeFile(join(workspace,'wizard.log'),voiceLog.join('\n'));
  await save();
}
