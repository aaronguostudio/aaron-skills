import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studioConfig,studioBrief} from '../src/presentation-studio.mjs';
const fields={title:'Team update',subtitle:'Progress',brandName:'Example',presenter:'A',date:'',};
const layout={id:'plain-caption',name:'Just the video'};
const cover={colors:{background:'#14263a',foreground:'#ffffff',accent:'#e8ff00'},preset:{id:'cobalt-signal',title:{en:'Cobalt Signal',zh:'钴蓝信号'},colors:{background:'#1648ed',foreground:'#f5f1e9',accent:'#e8ff00'}}};
test('the combined configuration keeps a separate cover and unframed video body',()=>{
 const config=studioConfig({layout,cover,fields});assert.equal(config.version,2);assert.equal(config.layout.preset,'plain-caption');assert.equal(config.cover.preset,'cobalt-signal');assert.equal(config.cover.colors.background,'#14263a');assert.equal(config.intro.enabled,true);assert.equal(config.title,'Team update');assert.equal(config.brand.name,'Example');
 const brief=studioBrief({layout,cover,fields,language:'en'});assert.ok(brief.includes('plain-caption')&&brief.includes('cobalt-signal')&&brief.includes('#14263a'));assert.ok(!brief.includes('no opening cover'));
});
test('no cover is explicit and an undecided cover cannot produce a configuration',()=>{
 const config=studioConfig({layout,cover:{none:true},fields});assert.equal(config.intro.enabled,false);assert.equal(config.cover,undefined);
 assert.throws(()=>studioConfig({layout,cover:null,fields}));assert.match(studioBrief({layout,cover:null,fields,language:'en'}),/not selected/);
});
test('a confirmed local brand logo is referenced in the configuration and brief',()=>{
 const logo={name:'brand.png'};
 const config=studioConfig({layout,cover,fields,logo});
 assert.equal(config.brand.logo,'brand.png');
 assert.deepEqual(config.brand.logoProvenance,{source:'User-confirmed brand logo',role:'corporate',verified:true});
 assert.match(studioBrief({layout,cover,fields,language:'en',logoName:logo.name}),/brand\.png/);
 assert.match(studioBrief({layout,cover:{none:true},fields,language:'en',logoName:logo.name}),/brand\.png/);
});
