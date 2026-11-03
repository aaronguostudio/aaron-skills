import {test,expect} from 'bun:test';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRenderer} from '../renderer/backend';
import {composition} from '../renderer/composition';
import {writeProject,snapshot} from '../renderer/backends/hyperframes';
import {interpolate,Easing} from '../renderer/src/frame';
import {makeFixture} from './make-fixture';
import {main as renderWalkthrough} from './render-walkthrough';

test('independent frame math clamps both ends and retains eased endpoints',()=>{
  expect(interpolate(-5,[0,10],[2,12],{extrapolateLeft:'clamp'})).toBe(2);
  expect(interpolate(15,[0,10],[2,12],{extrapolateRight:'clamp'})).toBe(12);
  expect(interpolate(5,[0,10],[2,12])).toBe(7);
  expect(Easing.bezier(.16,1,.3,1)(0)).toBeCloseTo(0);
  expect(Easing.bezier(.16,1,.3,1)(1)).toBeCloseTo(1);
});

test('actual renderer refuses failed evidence independently of CLI preparation',()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-refusal-'));
  try {
    writeFileSync(join(root,'capture.json'),JSON.stringify({version:1,status:'failed',viewport:{w:1440,h:900}}));
    writeFileSync(join(root,'steps.json'),'[]');
    expect(()=>composition({run:root,props:{},out:join(root,'refused.mp4'),mode:'video'})).toThrow('Capture refused');
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('backend failures preserve an existing artifact and clean staged output',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-transaction-'));
  try {
    const run=makeFixture(join(root,'capture')),out=join(root,'previous.mp4');
    writeFileSync(out,'last successful video');
    const render=createRenderer({
      info:{id:'test-backend',version:'1',contract:1},
      render:async(request,scene)=>{
        expect(scene.props.capture?.status).toBe('passed');
        expect(scene.config.fps).toBe(30);
        expect(request.out).not.toBe(out);
        writeFileSync(request.out,'incomplete video');
        throw Error('encoding failed');
      },
    });
    await expect(render({run,props:{calibrationMs:300},out,mode:'video'})).rejects.toThrow('encoding failed');
    expect(readFileSync(out,'utf8')).toBe('last successful video');
    expect(readdirSync(root).sort()).toEqual(['capture','previous.mp4']);

    // The same boundary also publishes a successful preview and records its backend.
    const successful=createRenderer({info:{id:'test-backend',version:'2',contract:1},render:async request=>{writeFileSync(request.out,'complete preview');}});
    const result=await successful({run,props:{calibrationMs:300},out,mode:'preview'});
    expect(readFileSync(out,'utf8')).toBe('complete preview');
    expect(result.renderer).toEqual({id:'test-backend',version:'2',contract:1});
    expect(readdirSync(root).sort()).toEqual(['capture','previous.mp4']);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('failed evidence never reaches a backend or changes its destination',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-before-backend-'));
  try {
    writeFileSync(join(root,'capture.json'),JSON.stringify({version:1,status:'failed',viewport:{w:1440,h:900}}));
    writeFileSync(join(root,'steps.json'),'[]');
    const out=join(root,'previous.png');writeFileSync(out,'previous');
    let called=false;
    const render=createRenderer({info:{id:'test-backend',version:'1',contract:1},render:async()=>{called=true;}});
    await expect(render({run:root,props:{},out,mode:'preview'})).rejects.toThrow('Capture refused');
    expect(called).toBe(false);
    expect(readFileSync(out,'utf8')).toBe('previous');
    expect(readdirSync(root).sort()).toEqual(['capture.json','previous.png','steps.json']);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('real browser seeks source footage instead of exporting its black sync frame',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-media-'));
  try {
    const run=makeFixture(join(root,'capture')),project=join(root,'project');
    const {mkdirSync}=await import('node:fs');mkdirSync(project);
    const request={run,props:{calibrationMs:300},out:join(root,'body.png'),mode:'preview' as const};
    const result=writeProject(request,project,composition(request));
    // 4s is within the footage, well after the source's black synchronization flash.
    await snapshot(project,join(root,'body.png'),120,result.config);
    const venv=resolve(import.meta.dir,'../../../.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python3');
    const python=process.env.AARON_DEMO_TEST_PYTHON??(existsSync(venv)?venv:process.platform==='win32'?'python':'python3');
    const values=JSON.parse(execFileSync(python,['-c','from PIL import Image;import json,sys;i=Image.open(sys.argv[1]).convert("RGB");print(json.dumps([i.getpixel((100,300)),i.getpixel((650,300))]))',join(root,'body.png')],{encoding:'utf8'}));
    // Independent source fixture colors: pale background and gray form panel.
    expect(values[0][0]).toBeGreaterThan(230);expect(values[0][2]).toBeGreaterThan(230);
    expect(values[1][0]).toBeGreaterThan(210);expect(values[1][0]).toBeLessThan(240);
    expect(readFileSync(join(project,'index.html'),'utf8')).toContain('data-no-timeline');
  }finally{rmSync(root,{recursive:true,force:true});}
},45000);

test('snapshot waits for the runtime clock and asynchronous registered frame sources',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-clock-'));
  try {
    const project=join(root,'project');mkdirSync(project);
    writeFileSync(join(project,'index.html'),`<!doctype html><html><head><style>html,body{margin:0}</style></head><body>
<main data-composition-id="clock-test" data-start="0" data-duration="10" data-width="100" data-height="100" data-fps="30" data-no-timeline>
<div id="scene" data-composition-id="source" data-start="0" data-duration="10" data-no-timeline style="position:absolute;inset:0;background:#10151c"></div>
</main><script src="scene.js"></script></body></html>`);
    writeFileSync(join(project,'scene.js'),`
const element=document.getElementById('scene');
window.__aaronSeek=async()=>{};
window.__hyperframes.registerFrameSource({element,ready:Promise.resolve(),render:async time=>{
  await new Promise(done=>setTimeout(done,50));
  element.style.background=Math.abs(time-4)<0.0001?'#111827':'#10151c';
}});`);
    const out=join(root,'clock.png');
    await snapshot(project,out,120,{width:100,height:100,fps:30,durationInFrames:300});
    const venv=resolve(import.meta.dir,'../../../.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python3');
    const python=process.env.AARON_DEMO_TEST_PYTHON??(existsSync(venv)?venv:process.platform==='win32'?'python':'python3');
    const colors=JSON.parse(execFileSync(python,['-c','from PIL import Image;import json,sys;print(json.dumps(Image.open(sys.argv[1]).convert("RGB").getcolors(10000)))',out],{encoding:'utf8'}));
    expect(colors).toEqual([[10000,[17,24,39]]]);
  }finally{rmSync(root,{recursive:true,force:true});}
},45000);


test('HyperFrames preview renders both the representative and dense-caption frames',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aaron-render-dense-'));
  try {
    const run=makeFixture(join(root,'capture')), stepsFile=join(run,'steps.json');
    const steps=JSON.parse(readFileSync(stepsFile,'utf8'));
    steps[1].caption='Review all synthetic form fields before saving the completed example.';
    writeFileSync(stepsFile,JSON.stringify(steps));
    const tone=join(root,'tone.wav'),audio=join(root,'audio.json');
    execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y',tone]);
    writeFileSync(audio,JSON.stringify({version:1,aiGenerated:false,clips:[{at:steps[0].id,file:'tone.wav',text:'Long imported narration '.repeat(20)}]}));
    const out=join(root,'preview','walkthrough.mp4');
    // Caption mode must pick the longest visible caption, not the longer imported transcript.
    expect(await renderWalkthrough([run,'--layout','screen-first','--audio',audio,'--preview','--out',out])).toBe(0);
    const body=join(root,'preview','body-preview.png'),dense=join(root,'preview','dense-caption-preview.png');
    expect(existsSync(body)).toBe(true);expect(existsSync(dense)).toBe(true);expect(existsSync(out)).toBe(false);
    const python=process.env.AARON_DEMO_TEST_PYTHON??(process.platform==='win32'?'python':'python3');
    execFileSync(python,['-c','from PIL import Image,ImageChops;import sys;a=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB");assert a.size==b.size==(1920,1080);assert ImageChops.difference(a,b).getbbox()',body,dense]);
  }finally{rmSync(root,{recursive:true,force:true});}
},120000);
