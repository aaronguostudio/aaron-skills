// Installed-only acceptance: fictional fixture, local audio, and mocked ElevenLabs.
// No account credentials or real provider requests. This is not voice-quality acceptance.
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const release=resolve(process.argv[2]??'');
const config=JSON.parse(readFileSync(join(release,'installed.json'),'utf8'));
process.env.PATH=[...Object.values(config.tools).map(p=>dirname(p)),process.env.PATH].join(process.platform==='win32'?';':':');
const root=mkdtempSync(join(tmpdir(),'aaron-presentation-acceptance-'));
const run=join(root,'capture');mkdirSync(run);
const {makeFixture}=await import(pathToFileURL(join(release,'packages/demo/walkthrough/make-fixture.ts')).href);
const {main}=await import(pathToFileURL(join(release,'packages/demo/walkthrough/render-walkthrough.ts')).href);
const {main:coverMain}=await import(pathToFileURL(join(release,'packages/demo/walkthrough/render-cover.ts')).href);
makeFixture(run);
const python=join(release,'.venv',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python3');
execFileSync(python,['-c','import math,struct,sys,wave; w=wave.open(sys.argv[1],"wb"); w.setparams((1,2,44100,0,"NONE","not compressed")); w.writeframes(b"".join(struct.pack("<h",int(4000*math.sin(i*2*math.pi*440/44100))) for i in range(22050))); w.close()',join(root,'tone.wav')]);
execFileSync(config.tools.ffmpeg,['-v','error','-i',join(root,'tone.wav'),'-c:a','libmp3lame',join(root,'tone.mp3')]);
const steps=JSON.parse(readFileSync(join(run,'steps.json'),'utf8'));
const audio=join(root,'audio.json');
writeFileSync(audio,JSON.stringify({version:1,aiGenerated:false,clips:[{at:steps[0].id,file:'tone.wav',text:'Fixture tone for plumbing verification only.'}]}));
copyFileSync(join(run,steps[0].shot),join(root,'logo.png'));
const presentation=join(root,'presentation.json');
writeFileSync(presentation,JSON.stringify({version:1,brand:{name:'Fictional fixture',logo:'logo.png'}}));
const evidence=[];
// Reproduce the newcomer title in a real browser/font environment. Height-only
// checks miss a word broken in the middle even when the title stays in bounds.
const {fitCoverText}=await import(pathToFileURL(join(release,'packages/demo/remotion/src/cover-library/CoverDesign.tsx')).href);
const {chromium}=await import(pathToFileURL(join(release,'packages/demo/capture/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch();
try {
  const page=await browser.newPage();
  const result=await page.evaluate(fitter=>{
    const fit=new Function(`return (${fitter})`)();
    const font="Georgia, 'Times New Roman', 'Noto Serif CJK SC', serif";
    const size=fit('First walkthrough',[0,0,660,378],font,138,1.02,-.035);
    const element=document.createElement('div');
    element.style.cssText=`width:660px;font:700 ${size}px ${font};line-height:1.02;letter-spacing:-.035em;white-space:pre-wrap;overflow-wrap:anywhere`;
    element.textContent='First walkthrough';document.body.appendChild(element);
    const word=document.createRange();word.setStart(element.firstChild,6);word.setEnd(element.firstChild,17);
    return {wordLines:word.getClientRects().length,height:element.getBoundingClientRect().height};
  },fitCoverText.toString());
  if(result.wordLines!==1||result.height>378)throw Error('Newcomer cover title breaks a word or exceeds its title box');
  evidence.push({newcomerTitleWholeWord:true,realBrowserFont:true});
} finally {await browser.close();}
for(const template of ['minimal','professional','showcase']){
  const out=join(root,template,'walkthrough.mp4');
  const status=await main([run,'--template',template,'--cover','--out',out,...(template==='professional'?['--audio',audio,'--presentation',presentation]:[])]);
  if(status) throw Error(`Installed ${template} render failed`);
  const probe=JSON.parse(execFileSync(config.tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',out],{encoding:'utf8'}));
  if(!probe.streams.some(s=>s.codec_name==='h264')) throw Error('Missing H.264 video');
  if((template!=='minimal')!==probe.streams.some(s=>s.codec_type==='audio')) throw Error('Unexpected audio-stream presence');
  execFileSync(config.tools.ffmpeg,['-v','error','-i',out,'-f','null','-']);
  execFileSync(python,['-c','from PIL import Image; import sys; i=Image.open(sys.argv[1]); assert i.format=="WEBP"; assert i.width>0; i.verify()',join(root,template,'cover.webp')]);
  evidence.push({template,fullDecode:true,coverWebp:true,seconds:Number(probe.format.duration)});
}
// Covers must also work before an application has been captured. Exercise both
// native graphics and bundled alpha artwork through the installed public API.
for(const preset of ['cobalt-signal','chrome-loop']){
  const file=join(root,`cover-${preset}.json`),png=join(root,`cover-${preset}`,'cover.png');
  writeFileSync(file,JSON.stringify({version:1,title:'A clearer workflow',subtitle:'A fictional cover acceptance example',brand:{name:'Fictional fixture',logo:'logo.png'},cover:{preset,presenter:'Fixture Presenter',date:'Fixture date',colors:{background:'#E7F0FF',foreground:'#15324B'}}}));
  if(await coverMain(['--presentation',file,'--out',png]))throw Error(`Installed cover ${preset} failed`);
  execFileSync(python,['-c','from PIL import Image;import sys; p=Image.open(sys.argv[1]);w=Image.open(sys.argv[2]);assert p.size==w.size==(1600,900);assert p.format=="PNG" and w.format=="WEBP";assert p.convert("RGB").getpixel((0,0))==(231,240,255)',png,png.replace(/\.png$/,'.webp')]);
  evidence.push({preset,standaloneCover:true,width:1600,height:900,customBackground:true});
}
const profiles=join(root,'voices.json');
writeFileSync(profiles,JSON.stringify({default_profile:'fixture',profiles:{fixture:{provider:'elevenlabs',voice_id:'fixture-voice',model_id:'fixture-model',output_format:'mp3_44100_192',voice_settings:{stability:.5}}}}));
process.env.AARON_DEMO_VOICE_PROFILES=profiles;
process.env.ELEVENLABS_API_KEY='fixture-only-key';
// Profiles were resolved during module load; specify their path before importing in a fresh process.
const child=join(root,'mock-provider.mjs');
writeFileSync(child,`import {readFileSync} from 'node:fs';
import {main} from ${JSON.stringify(pathToFileURL(join(release,'packages/demo/walkthrough/render-walkthrough.ts')).href)};
let requests=0;const bytes=readFileSync(${JSON.stringify(join(root,'tone.mp3'))});
globalThis.fetch=Object.assign(async(url,init)=>{if(!String(url).startsWith('https://api.elevenlabs.io/v1/text-to-speech/fixture-voice?'))throw Error('Unexpected request');requests++;return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg'}});},{preconnect:()=>{}});
const run=${JSON.stringify(run)};
if(await main([run,'--template','minimal','--narrate','--out',${JSON.stringify(join(root,'mock-elevenlabs/walkthrough.mp4'))}]))throw Error('Mock provider render failed');
if(requests!==${steps.length})throw Error('Not all fixture lines synthesized');
if(await main([run,'--template','minimal','--narrate','--dry-run']))throw Error('Dry run failed');
if(requests!==${steps.length})throw Error('Dry run synthesized audio');
console.log('MOCK_ELEVENLABS_PASSED '+requests);`);
const output=execFileSync(process.execPath,[child],{encoding:'utf8',env:process.env});
if(!output.includes('MOCK_ELEVENLABS_PASSED'))throw Error('Mock provider acceptance missing');
const report={passed:true,scope:'Installed fictional fixture; three video templates/covers, two standalone library covers, imported tone, mocked ElevenLabs; no live provider/voice-quality acceptance',root,evidence};
writeFileSync(join(root,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
