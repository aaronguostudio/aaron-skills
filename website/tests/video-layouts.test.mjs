import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutBrief} from '../src/layout-handoff.mjs';
const data=JSON.parse(readFileSync(new URL('../src/video-layouts.json',import.meta.url)));
const media=JSON.parse(readFileSync(new URL('../layout-media.json',import.meta.url)));
test('eight released treatments pair six covers with two explicit unframed choices',()=>{
 assert.equal(data.length,8);assert.equal(new Set(data.map(x=>x.id)).size,8);
 assert.equal(data.filter(x=>x.cover).length,6);
 assert.deepEqual(data.filter(x=>!x.cover).map(x=>x.id),['plain-caption','plain-transcript']);
 for(const item of data){
  assert.ok(item.description.en&&item.description.zh);
  assert.ok(item.width>0&&item.height>0&&item.seconds>0);
  assert.equal(item.stills.length,3);assert.equal(item.sceneTimes.length,3);
  assert.equal(item.sceneTimes[0],0);assert.ok(item.sceneTimes[1]>0&&item.sceneTimes[2]>item.sceneTimes[1]&&item.sceneTimes[2]<item.seconds);
  for(const value of [item.video,...item.stills,...(item.cover?[item.cover]:[])]){
   const url=new URL(value);assert.equal(url.protocol,'https:');assert.equal(url.host,'yhghjbt7biptwjsj.public.blob.vercel-storage.com');
   assert.equal(url.search+url.hash+url.username+url.password,'');assert.ok(url.pathname.startsWith('/layouts/v0.3.0/'));
   assert.match(media.files[value].sha256,/^[a-f0-9]{64}$/);assert.ok(media.files[value].bytes<2_000_000);
  }
  for(const language of ['en','zh']){
   const brief=layoutBrief(item,language),config=JSON.parse(brief.slice(brief.indexOf('{')));
   assert.equal(config.version,2);assert.equal(config.layout.preset,item.id);assert.equal(config.brand.fallback,'omit');
   assert.ok(!brief.includes('/Users/')&&!brief.includes('logo.png'));
  }
 }
});
