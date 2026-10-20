import {describe, expect, test} from 'bun:test';
import {createRequire} from 'node:module';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadPresentation, validatePresentationMedia, installPresentation} from './presentation';
import {main,parseArgs} from './render-walkthrough';
import {buildTimeline, calibrate} from '../remotion/src/projects/walkthrough-video/timeline';
import {fixtureSteps} from './make-fixture';
import {presentationPreset, validatePresentation} from '../remotion/src/projects/walkthrough-video/presentation/model';
import {annotationAt, layoutGeometry, mapBox, textPages} from '../remotion/src/projects/walkthrough-video/presentation/layout';
import {paletteFor, contrastRatio, logoFor} from '../remotion/src/projects/walkthrough-video/presentation/theme';
import {PresentationLogo, PresentationAnnotation} from '../remotion/src/projects/walkthrough-video/presentation/Presentation';

const load=(raw:unknown)=>{
  const file=join(mkdtempSync(join(tmpdir(),'layout-contract-')),'presentation.json');
  writeFileSync(file,JSON.stringify(raw));
  return loadPresentation(undefined,file,'A synthetic workflow','')!.presentation;
};
const v2=(patch:Record<string,unknown>={})=>load({version:2,brand:{fallback:'omit'},...patch});

describe('versioned layout and theme',()=>{
  test('v1 geometry and palette remain byte-compatible defaults',()=>{
    const p=presentationPreset('professional','Old workflow');
    expect(layoutGeometry({w:1440,h:900},p)).toEqual({width:1440,height:996,screen:{x:0,y:0,w:1440,h:900,scale:1},annotation:{x:0,y:900,w:1440,h:96},legacy:true});
    expect(paletteFor(p,'body').background).toBe('#153F3B');
    expect(()=>load({version:1,layout:{screenPlacement:'left'}})).toThrow('version 2');
  });
  test('all placements preserve native evidence and map boxes with one uniform transform',()=>{
    for(const screenPlacement of ['top','bottom','left','right']){
      const p=v2({layout:{screenPlacement,annotationRatio:.3,padding:24,gap:16,canvas:{width:1600,height:1000}}});
      const g=layoutGeometry({w:1440,h:900},p), b=mapBox({x:120,y:220,w:300,h:80},g.screen);
      expect(b.x).toBeCloseTo(g.screen.x+120*g.screen.scale);
      expect(b.y).toBeCloseTo(g.screen.y+220*g.screen.scale);
      expect(b.w/b.h).toBeCloseTo(300/80);
      expect(g.screen.w/g.screen.h).toBeCloseTo(1440/900);
      if(screenPlacement==='top')expect(g.screen.y+g.screen.h).toBeLessThanOrEqual(g.annotation.y);
      if(screenPlacement==='bottom')expect(g.annotation.y+g.annotation.h).toBeLessThanOrEqual(g.screen.y);
      if(screenPlacement==='left')expect(g.screen.x+g.screen.w).toBeLessThanOrEqual(g.annotation.x);
      if(screenPlacement==='right')expect(g.annotation.x+g.annotation.w).toBeLessThanOrEqual(g.screen.x);
    }
  });
  test('native canvas expands and fixed canvas letterboxes non-square recordings',()=>{
    const native=layoutGeometry({w:1200,h:800},v2({layout:{screenPlacement:'left'}}));
    expect(native.screen.scale).toBe(1);expect(native.screen.w).toBe(1200);
    const fixed=layoutGeometry({w:1200,h:800},v2({layout:{screenPlacement:'bottom',canvas:{width:1280,height:720}}}));
    expect(fixed.width).toBe(1280);expect(fixed.height).toBe(720);expect(fixed.screen.scale).toBeLessThan(1);
    const left=layoutGeometry({w:1440,h:900},v2({layout:{screenPlacement:'left',annotationRatio:.3,padding:24,gap:16,canvas:{width:1600,height:1000}}}));
    expect(left.screen.x).toBe(24);expect(left.screen.y).toBeCloseTo(164);
    expect(left.screen.scale).toBeCloseTo(.7466666667);expect(left.annotation.x).toBeCloseTo(1115.2);
  });
  test('final renderer validates unknown fields, unsafe dimensions and excessive panels too',()=>{
    for(const layout of [{screenPlacement:'over'}, {annotationRatio:.9}, {padding:-1}, {fit:'cover'}, {canvas:{width:1,height:720}}, {screenPlacement:'left',typo:true}]){
      expect(()=>v2({layout})).toThrow();
    }
    const p=v2();
    expect(()=>validatePresentation({...p,layout:{screenPlacement:'left',surprise:1}})).toThrow();
    expect(()=>validatePresentation({...p,unexpected:true})).toThrow();
  });
  test('cover colors inherit across body/outro; explicit surface settings take precedence',()=>{
    const p=v2({cover:{preset:'blue-portal'}});
    expect(paletteFor(p,'body')).toEqual(paletteFor(p,'outro'));
    expect(paletteFor(p,'intro').background).toBe('#ded9fa');
    expect(paletteFor(p,'body').background).not.toBe('#153F3B');
    const custom=v2({theme:{preset:'blue-lavender'},body:{background:'#FFFFFF',foreground:'#10204B'},outro:{background:'#222222',foreground:'#FFFFFF'}});
    expect(paletteFor(custom,'body').background).toBe('#FFFFFF');
    expect(paletteFor(custom,'outro').background).toBe('#222222');
    expect(paletteFor(custom,'intro').background).toBe('#173CA8');
    expect(contrastRatio('#FFFFFF','#FFFFFF')).toBe(1);
    expect(()=>v2({body:{background:'#FFFFFF',foreground:'#EEEEEE'}})).toThrow('contrast');
    expect(()=>v2({cover:{preset:'blue-portal',colors:{background:'#FFFFFF',foreground:'#FFFFFF'}}})).toThrow('contrast');
    const highlight=v2({theme:{preset:'blue-lavender'},body:{highlightColor:'#CC3455'}});
    expect(paletteFor(highlight,'body').cursor).toBe('#CC3455');
    expect(paletteFor(v2({theme:{preset:'blue-lavender',highlight:'#CC3455'}}),'body').cursor).toBe('#CC3455');
  });
  test('agent-led preview is explicit and does not request narration',()=>{
    const args=parseArgs(['/outside/capture','--preview','--cover']);
    expect(args.preview).toBe(true);expect(args.narrate).toBe(false);
  });
  test('preview refuses synthesis before reading credentials or capture files',async()=>{
    expect(await main(['/unused','--preview','--narrate'])).toBe(3);
  });
});

describe('annotation and identity',()=>{
  const require=createRequire(new URL('../remotion/package.json',import.meta.url));
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  test('long transcript pages preserve every word and unvoiced text can be shown',()=>{
    const text=Array.from({length:240},(_,i)=>`word${i}`).join(' ');
    const pages=textPages(text,340,400,24);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join(' ')).toBe(text);
    const p=v2({layout:{screenPlacement:'left',annotationMode:'transcript'}});
    const html=renderToStaticMarkup(React.createElement(PresentationAnnotation,{p,box:{x:0,y:0,w:450,h:900},caption:'Short result',transcript:'Complete imported narration',position:'1/2',progress:0,narrated:false}));
    expect(html).toContain('Complete imported narration');expect(html).not.toContain('Short result');
  });
  test('v2 never silently invents an identity and requires approved logo provenance',()=>{
    expect(()=>load({version:2,brand:{name:'Northstar'}})).toThrow('fallback');
    const p=v2();
    expect(renderToStaticMarkup(React.createElement(PresentationLogo,{p,size:40}))).toBe('');
    expect(p.brand.name).toBe('');
    expect(()=>validatePresentation({...p,brand:{...p.brand,logo:'symbol.png'}})).toThrow('provenance');
  });
  test('light/dark variants and wordmarks use the same verified identity',()=>{
    const p=v2();
    p.brand.logo='symbol.png';p.brand.logoVariants={light:'white.png',dark:'black.png'};
    p.brand.logoProvenance={source:'Synthetic design fixture',role:'corporate',verified:true};
    expect(logoFor(p,'#FFFFFF')).toBe('black.png');expect(logoFor(p,'#102040')).toBe('white.png');
    validatePresentation(p);
  });
  test('transcripts use imported clip duration across waits and do not invent word timing',()=>{
    const t=buildTimeline(calibrate(fixtureSteps,-300));
    const from=t.segments.find(s=>s.step===1)!.fromFrame;
    const clips=[{at:1,ms:20000,text:'A complete imported line spanning a wait.'}];
    const a=annotationAt(t,clips,2,from+150,'Wait');
    expect(a.text).toBe(clips[0].text);expect(a.progress).toBeCloseTo(.25);
    expect(annotationAt(t,[],2,from+150,'Wait').text).toBe('Wait');
  });
  test('logo pixels, variants and installed copies are checked before rendering',()=>{
    const root=mkdtempSync(join(tmpdir(),'logo-media-'));
    for(const [name,color] of [['white','white'],['black','black'],['empty','white@0']]){
      execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${color}:s=64x64,format=rgba`,'-frames:v','1',join(root,name+'.png')]);
    }
    const file=join(root,'presentation.json');
    const raw={version:2,theme:{preset:'blue-lavender'},intro:{soundPreset:'none'},brand:{name:'Northstar',logo:'white.png',logoProvenance:{source:'Synthetic fixture',role:'corporate',verified:true}},cover:{preset:'blue-portal'}};
    writeFileSync(file,JSON.stringify(raw));
    const bad=loadPresentation(undefined,file,'Title','')!;
    expect(()=>validatePresentationMedia(bad.presentation,root)).toThrow('contrast');
    raw.brand=Object.assign(raw.brand,{logoVariants:{light:'white.png',dark:'black.png'}});
    writeFileSync(file,JSON.stringify(raw));
    const good=loadPresentation(undefined,file,'Title','')!;
    const reports=validatePresentationMedia(good.presentation,root);
    expect(reports).toHaveLength(2);expect(reports.flatMap(r=>r.surfaces.map(s=>s.surface)).sort()).toEqual(['body','cover','intro','outro']);
    const installed=installPresentation(good.presentation,root,mkdtempSync(join(tmpdir(),'logo-installed-')));
    expect(installed.brand.logoVariants?.dark).toMatch(/^presentation-assets\//);
    expect(installed.brand.logoProvenance?.source).toBe('Synthetic fixture');
    good.presentation.brand.logo='empty.png';good.presentation.brand.logoVariants=undefined;
    expect(()=>validatePresentationMedia(good.presentation,root)).toThrow('transparent');
  });
});
