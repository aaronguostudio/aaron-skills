import {createRequire} from 'node:module';
import {PresentationCaption} from '../remotion/src/projects/walkthrough-video/presentation/Presentation';
import {describe,expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import {presentationPreset,validatePresentation} from '../remotion/src/projects/walkthrough-video/presentation/model';
import {buildTimeline} from '../remotion/src/projects/walkthrough-video/timeline';
import {installPresentation,loadPresentation,validatePresentationMedia} from './presentation';
import {readImportedAudio,installImportedAudio,outsideGit} from './import-audio';
import {speechProvider} from './voice-providers';
import {narrate,cardMinMs,stepMinMs} from './narration';
import {fixtureSteps} from './make-fixture';
import {main} from './render-walkthrough';

const temp=()=>mkdtempSync(join(tmpdir(),'presentation-test-'));
const config=(raw:unknown)=>{const file=join(temp(),'presentation.json');writeFileSync(file,JSON.stringify(raw));return file;};

describe('presentation contracts',()=>{
  test('three presets retain evidence timing and default to a complete package',()=>{
    for(const name of ['minimal','professional','showcase'] as const){
      const p=presentationPreset(name,'A useful workflow'); validatePresentation(p);
      const legacy=buildTimeline(fixtureSteps);
      const themed=buildTimeline(fixtureSteps,{titleBaseMs:p.intro.durationMs,endBaseMs:p.outro.durationMs});
      expect(themed.videoFrames).toBe(legacy.videoFrames);
      expect(themed.titleFrames+themed.videoFrames+themed.endFrames).toBe(themed.durationInFrames);
    }
  });
  test('disabled packaging cards produce no invisible padding and chapters follow',()=>{
    const t=buildTimeline(fixtureSteps,{titleBaseMs:0,endBaseMs:0});
    expect(t.titleFrames).toBe(0); expect(t.endFrames).toBe(0);expect(t.segments[0].fromFrame).toBe(0);
    expect(buildTimeline(fixtureSteps).titleFrames).toBe(75);
  });
  test('unknown options and unsafe/unreadable configurations fail before rendering',()=>{
    expect(()=>loadPresentation('unavailable',undefined,'Title','')).toThrow('Unknown');
    expect(()=>loadPresentation(undefined,config({intro:{duratonMs:3000}}),'Title','')).toThrow('Unknown');
    for(const patch of [{brand:{logo:'https://example.org/logo.png'}},{brand:{logo:'../logo.png'}},{intro:{durationMs:-1}},{body:{logoPosition:'over-the-app'}},{brand:{primary:'white'}}]) expect(()=>loadPresentation('professional',config(patch),'Title','')).toThrow();
  });
  test('external assets are hash-named and portable in the render public directory',()=>{
    const path=config({brand:{logo:'logo.png'}});writeFileSync(join(path,'..','logo.png'),'fixture bytes');
    const loaded=loadPresentation('minimal',path,'Title','')!;const run=temp();
    const installed=installPresentation(loaded.presentation,loaded.assetRoot,run);
    expect(installed.brand.logo).toMatch(/^presentation-assets\/[a-f0-9]+\.png$/);
    expect(readFileSync(join(run,installed.brand.logo!),'utf8')).toBe('fixture bytes');
    expect(loaded.presentation.brand.logo).toBe('logo.png');
  });
  test('a renamed non-image fails media preflight before rendering or provider usage',()=>{
    const path=config({brand:{logo:'logo.png'}});writeFileSync(join(path,'..','logo.png'),'not an image');
    const loaded=loadPresentation('professional',path,'Title','')!;
    expect(()=>validatePresentationMedia(loaded.presentation,loaded.assetRoot)).toThrow();
  });
});

describe('imported narration',()=>{
  const make=(clips:unknown)=>{const file=config({version:1,aiGenerated:false,clips});writeFileSync(join(file,'..','voice.wav'),'audio fixture');return file;};
  test('maps named steps, preserves audio bytes and measures timing without a provider',()=>{
    const file=make([{at:'intro',file:'voice.wav',text:'An introduction.'},{at:fixtureSteps[0].id,file:'voice.wav',text:'A useful step.'}]);
    const imported=readImportedAudio(file,fixtureSteps,()=>4700);const run=temp();
    const clips=installImportedAudio(imported,run);
    expect(imported.aiGenerated).toBe(false);expect(clips.map(c=>c.at)).toEqual(['intro',0]);
    expect(readFileSync(join(run,clips[0].file),'utf8')).toBe('audio fixture');
    expect(cardMinMs(clips).titleMs).toBe(5100);
    expect(stepMinMs(fixtureSteps,clips)[0]).toBeGreaterThan(0);
    expect(clips[0]).not.toHaveProperty('source');
  });
  test('unknown/duplicate IDs, missing transcript and escaping paths cannot silently pass',()=>{
    for(const clips of [[{at:'unknown',file:'voice.wav',text:'x'}],[{at:'intro',file:'voice.wav',text:'x'},{at:'intro',file:'voice.wav',text:'x'}],[{at:'intro',file:'../voice.wav',text:'x'}],[{at:'intro',file:'voice.wav'}]]) expect(()=>readImportedAudio(make(clips),fixtureSteps,()=>1000)).toThrow();
  });
  test('new raw material cannot be written into any Git checkout',()=>{
    const root=temp();mkdirSync(join(root,'.git'));
    expect(()=>outsideGit(join(root,'ignored','new'))).toThrow('outside every Git');
  });
});

describe('provider seam',()=>{
  test('Qwen is explicit unavailable, never a silent fallback or credential read',()=>{
    let reads=0;expect(()=>speechProvider('qwen',()=>{reads++;return 'fixture';})).toThrow('not implemented');expect(reads).toBe(0);
    expect(()=>speechProvider('unknown',()=>{reads++;return 'fixture';})).toThrow('Unknown');expect(reads).toBe(0);
  });
  test('ElevenLabs request and cache work through the provider interface without a live call',async()=>{
    const previous=globalThis.fetch;let requests=0;
    globalThis.fetch=Object.assign(async(input:unknown,init?:RequestInit)=>{
      requests++;expect(String(input)).toContain('/text-to-speech/fixture-voice?output_format=mp3_44100_192');
      const body=JSON.parse(init!.body as string);expect(body.model_id).toBe('fixture-model');
      expect((init!.headers as Record<string,string>)['xi-api-key']).toBe('fixture-key');
      return new Response(new Uint8Array([1,2,3]),{status:200});
    },{preconnect:previous.preconnect});
    try{
      const adapter=speechProvider('elevenlabs',()=> 'fixture-key'); const run=temp();
      const profile={provider:'elevenlabs',voice_id:'fixture-voice',model_id:'fixture-model',output_format:'mp3_44100_192',voice_settings:{speed:1}};
      const synth=(text:string)=>adapter.synthesizeMp3({text,voice:profile.voice_id,model:profile.model_id,outputFormat:profile.output_format,settings:profile.voice_settings});
      const first=await narrate(run,fixtureSteps,profile,synth,()=>1000);
      const again=await narrate(run,fixtureSteps,profile,synth,()=>1000);
      expect(first).toEqual(again);expect(requests).toBe(fixtureSteps.length);
      const changed=await narrate(run,fixtureSteps,{...profile,output_format:'mp3_22050_32'},async()=>new Uint8Array([4]),()=>1000);
      expect(changed[0].file).not.toBe(first[0].file);
    }finally{globalThis.fetch=previous;}
  });
  test('new CLI rejects conflicting voice modes and Qwen before any synthesis',async()=>{
    expect(await main(['/unused','--voice-provider','qwen'])).toBe(3);
    expect(await main(['/unused','--voice-provider','none','--narrate'])).toBe(3);
    expect(await main(['/unused','--audio','/unused.json','--narrate'])).toBe(3);
    expect(await main(['--help'])).toBe(0);
  });
  test('themed dry-run creates no assets, covers or audio and never reads a voice profile',async()=>{
    const run=temp();mkdirSync(join(run,'shots'));
    writeFileSync(join(run,'capture.json'),JSON.stringify({version:1,walk:'fixture',env:'local',title:'Fixture',startedAt:'2026-10-17',viewport:{w:1440,h:900},status:'passed'}));
    writeFileSync(join(run,'steps.json'),JSON.stringify(fixtureSteps));writeFileSync(join(run,'video.webm'),'fixture');
    for(const step of fixtureSteps)writeFileSync(join(run,step.shot!),'fixture');
    const before=readdirSync(run,{recursive:true});
    expect(await main([run,'--template','showcase','--cover','--narrate','--voice-profile','missing-fixture','--dry-run'])).toBe(0);
    expect(readdirSync(run,{recursive:true})).toEqual(before);
  });
});

 test('caption output keeps the result and brand while making the notice explicit-only',()=>{
  const runtimeRequire=createRequire(new URL('../remotion/package.json',import.meta.url));
  const React=runtimeRequire('react');
  const {renderToStaticMarkup}=runtimeRequire('react-dom/server');
  const props={p:presentationPreset('professional','Result'),top:900,width:1440,caption:'Two invoices verified',position:'1/2'};
  const clean=renderToStaticMarkup(React.createElement(PresentationCaption,{...props,narrated:false}));
  const requested=renderToStaticMarkup(React.createElement(PresentationCaption,{...props,narrated:true}));
  expect(clean).toContain('Two invoices verified');expect(clean).toContain('Demo');
  expect(clean).not.toContain('AI NARRATION');expect(requested).toContain('AI NARRATION');
});
