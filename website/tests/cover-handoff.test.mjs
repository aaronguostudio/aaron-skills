import assert from "node:assert/strict";
import {test} from "node:test";
import {coverBrief,coverConfiguration} from "../src/cover-handoff.mjs";
import {readFile} from "node:fs/promises";
const presets=JSON.parse(await readFile(new URL("../../packages/demo/covers/presets.json",import.meta.url),"utf8"));
const samples=JSON.parse(await readFile(new URL("../src/covers.json",import.meta.url),"utf8"));
test("every public gallery choice resolves to the installed preset with its own palette",()=>{
 assert.deepEqual(samples.map(p=>p.id),presets.map(p=>p.id));
 for(const preset of presets){
  const config=coverConfiguration({preset,fields:{title:"A supplied title"},colors:preset.colors});
  assert.equal(config.cover.preset,preset.id);assert.deepEqual(config.cover.colors,preset.colors);assert.notEqual(config.cover.colors,preset.colors);
  assert.equal(config.brand,undefined);assert.equal(config.subtitle,undefined);assert.equal(config.cover.presenter,undefined);assert.equal(config.cover.date,undefined);
 }
});
test("agent handoff preserves actual content, logo filename and explicit custom colors",()=>{
 const preset=presets.find(p=>p.id==="chrome-loop");const fields={title:"业务流程 <A & B>",subtitle:"From idea to action",brandName:"Example",presenter:"Taylor",date:"Autumn 2026"};
 const colors={...preset.colors,background:"#E7F0FF"};
 const config=coverConfiguration({preset,fields,colors,logoName:"brand logo.png"});
 assert.equal(config.title,fields.title);assert.equal(config.brand.logo,"brand logo.png");assert.equal(config.cover.colors.background,"#E7F0FF");
 for(const language of ["en","zh"]){const brief=coverBrief({preset,fields,colors,logoName:"brand logo.png",language});for(const value of [preset.id,fields.title,fields.presenter,fields.date,"brand logo.png","#E7F0FF"])assert.ok(brief.includes(value));}
});
