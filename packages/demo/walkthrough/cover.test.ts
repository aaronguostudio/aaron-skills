import {describe,expect,test} from 'bun:test';
import {createHash} from 'crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {dirname,join,resolve} from 'path';
import {coverColors,coverPresets,getCoverPreset,validateCover} from '../covers/catalog';
import {fitCoverText} from '../remotion/src/cover-library/CoverDesign';
import {installPresentation,loadPresentation,validatePresentationMedia} from './presentation';
import {main,parseCoverArgs} from './render-cover';

const temp=()=>mkdtempSync(join(tmpdir(),'cover-contract-'));
const config=(raw:unknown)=>{const p=join(temp(),'presentation.json');writeFileSync(p,JSON.stringify(raw));return p;};
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');

describe('editable cover library',()=>{
  test('all 32 unique styles carry bilingual selection metadata and usable palettes',()=>{
    expect(coverPresets.length).toBe(32);expect(new Set(coverPresets.map(p=>p.id)).size).toBe(32);
    expect(new Set(coverPresets.map(p=>p.family)).size).toBe(8);
    for(const p of coverPresets){
      expect(p.title.en&&p.title.zh&&p.familyTitle.en&&p.familyTitle.zh).toBeTruthy();
      expect(new URL(p.preview).origin).toBe('https://skills.aaronguo.com');
      validateCover({preset:p.id});
      for(const color of Object.values(coverColors({preset:p.id}))) expect(color).toMatch(/^#[a-f0-9]{6}$/i);
    }
  });
  test('custom content stays in independent fields and missing personal details stay omitted',()=>{
    const file=config({title:'A clearer customer journey',subtitle:'Changes that matter',cover:{preset:'chrome-loop',presenter:'Jordan Lee',date:'Q4 2026',colors:{background:'#e8eef8'}}});
    const p=loadPresentation(undefined,file,'Unused capture title','')!.presentation;
    expect(p.title).toBe('A clearer customer journey');expect(p.cover?.presenter).toBe('Jordan Lee');expect(p.cover?.date).toBe('Q4 2026');
    expect(p.brand.name).toBe('');expect(p.brand.logo).toBeUndefined();
    expect(coverColors(p.cover!)).toMatchObject({background:'#e8eef8',foreground:getCoverPreset('chrome-loop').colors.foreground});
    const bare=loadPresentation(undefined,config({title:'One idea',cover:{preset:'cobalt-signal'}}),'','')!.presentation;
    expect(bare.cover?.presenter).toBeUndefined();expect(bare.cover?.date).toBeUndefined();
    expect(bare.brand.name).toBe('');
  });
  test('unknown styles/fields, malformed colors and caller-supplied artwork are refused',()=>{
    for(const cover of [{preset:'unknown'},{preset:'chrome-loop',colors:{background:'red'}},{preset:'chrome-loop',colors:{madeUp:'#000000'}},{preset:'chrome-loop',presenter:[]},{preset:'chrome-loop',date:'x'.repeat(49)},{preset:'chrome-loop',art:'https://example.org/art.png'}]) {
      expect(()=>loadPresentation(undefined,config({title:'Fixture',cover}),'','')).toThrow();
    }
    for(const art of ['../escape.webp','https://example.org/art.webp','C:\\art.webp','art.svg']) expect(()=>validateCover({preset:'chrome-loop',art})).toThrow();
    expect(()=>loadPresentation(undefined,config(null),'','')).toThrow();
  });
  test('bundled art is valid media and is copied into the capture instead of referencing a website',()=>{
    for(const preset of coverPresets) {
      const loaded=loadPresentation(undefined,config({title:'Fixture',intro:{enabled:false},cover:{preset:preset.id}}),'','')!;
      validatePresentationMedia(loaded.presentation,loaded.assetRoot);
      const installed=installPresentation(loaded.presentation,loaded.assetRoot,temp());
      expect(loaded.presentation.cover?.art).toBeUndefined();
      if(preset.art) expect(installed.cover?.art).toMatch(/^presentation-assets\/[a-f0-9]+\.webp$/);
      else expect(installed.cover?.art).toBeUndefined();
    }
  },30_000); // Real ffprobe processes for the full art library can exceed 5 s under CPU load.
  test('the copied artwork remains byte-identical and independent of the configuration root',()=>{
    const loaded=loadPresentation(undefined,config({title:'Fixture',intro:{enabled:false},cover:{preset:'chrome-loop'}}),'','')!;
    const run=temp(),installed=installPresentation(loaded.presentation,loaded.assetRoot,run);
    expect(sha(join(run,installed.cover!.art!))).toBe(sha(resolve(import.meta.dir,'../covers',getCoverPreset('chrome-loop').art!)));
  });
  test('title sizing responds to long text and explicit line breaks',()=>{
    const box:[number,number,number,number]=[0,0,600,230];
    expect(fitCoverText('Short title',box,'Arial',140)).toBeGreaterThan(fitCoverText('A much longer title about making a complex customer journey understandable',box,'Arial',140));
    expect(fitCoverText('第一行\n第二行\n第三行\n第四行',box,'Arial',140)).toBeLessThan(80);
  });
  test('cover titles shrink before breaking an ordinary Latin word',()=>{
    const size=fitCoverText('First walkthrough',[0,0,660,378],'Georgia',138,1.02,-.035);
    expect(size).toBeLessThan(138);
    expect(11*size*.58-10*size*.035).toBeLessThanOrEqual(660*.97);
    expect(fitCoverText('中文标题',[0,0,150,700],'Arial',138)).toBe(138);
  });
});

describe('standalone cover command',()=>{
  test('argument mistakes fail instead of silently selecting a different operation',()=>{
    for(const args of [['--out'],['--out','one.png','--out','two.png'],['--fake','x']]) expect(()=>parseCoverArgs(args)).toThrow();
  });
  test('listing and dry-run require no provider and leave the output directory untouched',async()=>{
    const previous=globalThis.fetch,log=console.log;let calls=0;const messages:string[]=[];
    globalThis.fetch=Object.assign(async()=>{calls++;throw Error('No network expected');},{preconnect:previous.preconnect});
    console.log=(s:unknown)=>messages.push(String(s));
    try {
      expect(await main(['--list'])).toBe(0);expect(JSON.parse(messages.pop()!).length).toBe(32);
      const root=temp(),file=join(root,'presentation.json'),out=join(root,'preview','cover.png');
      writeFileSync(file,JSON.stringify({title:'Customer review',cover:{preset:'cobalt-signal',presenter:'Jordan Lee'}}));
      expect(await main(['--presentation',file,'--out',out,'--dry-run'])).toBe(0);
      expect(JSON.parse(messages.pop()!)).toMatchObject({dryRun:true,preset:'cobalt-signal',providerCalls:0});
      expect(existsSync(dirname(out))).toBe(false);expect(calls).toBe(0);
    } finally {globalThis.fetch=previous;console.log=log;}
  });
  test('a standalone cover refuses an output inside any Git checkout',async()=>{
    const root=temp();mkdirSync(join(root,'.git'));
    const file=config({title:'Fixture',cover:{preset:'cobalt-signal'}}),out=join(root,'cover.png');
    const error=console.error;console.error=()=>{};
    try {expect(await main(['--presentation',file,'--out',out])).toBe(3);expect(existsSync(out)).toBe(false);} finally {console.error=error;}
  });
  test('existing PNG and WebP exports are preserved',async()=>{
    const root=temp(),out=join(root,'cover.png'),file=config({title:'Fixture',cover:{preset:'cobalt-signal'}});
    writeFileSync(out,'previous original');
    const error=console.error;console.error=()=>{};
    try {expect(await main(['--presentation',file,'--out',out])).toBe(3);expect(readFileSync(out,'utf8')).toBe('previous original');} finally {console.error=error;}
  });
});
