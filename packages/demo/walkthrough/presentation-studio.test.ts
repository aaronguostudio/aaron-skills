import {test,expect} from 'bun:test';
import {copyFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {studioConfig} from '../../../website/src/presentation-studio.mjs';
import {getCoverPreset} from '../covers/catalog';
import {loadPresentation} from './presentation';

test('website configurations are accepted by the actual renderer for selected or absent covers',()=>{
 const dir=mkdtempSync(join(tmpdir(),'presentation-studio-'));
 try {
  const fields={title:'Team update',subtitle:'',brandName:'',presenter:'',date:''};
  for(const [id,cover] of [['plain-caption',{preset:getCoverPreset('cobalt-signal'),colors:{background:'#14263a',foreground:'#ffffff',accent:'#e8ff00'}}],['studio-cobalt',{none:true}]] as const){
   const file=join(dir,`${id}.json`);writeFileSync(file,JSON.stringify(studioConfig({layout:{id},cover,fields})));
   const p=loadPresentation(undefined,file,'Capture title','')!.presentation;
   expect(p.layout?.preset).toBe(id);expect(p.intro.enabled).toBe(!('none' in cover));
   if('preset' in cover){expect(p.cover?.preset).toBe('cobalt-signal');expect(p.cover?.colors?.background).toBe('#14263a');}
  }
  copyFileSync('website/public/art/demo-capture.webp',join(dir,'brand.webp'));
  const file=join(dir,'logo.json');writeFileSync(file,JSON.stringify(studioConfig({layout:{id:'studio-cobalt'},cover:{preset:getCoverPreset('cobalt-signal')},fields,logo:{name:'brand.webp'}})));
  const branded=loadPresentation(undefined,file,'Capture title','')!.presentation;
  expect(branded.brand.logo).toBe('brand.webp');expect(branded.brand.logoProvenance?.verified).toBe(true);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
