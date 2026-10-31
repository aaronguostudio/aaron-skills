import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presentationBrief} from '../src/presentation-handoff.mjs';
import {layoutBrief} from '../src/layout-handoff.mjs';
const layout={id:'plain-caption',name:'Just the video'};
const cover={preset:{id:'sample-cover',title:{en:'Sample cover',zh:'示例封面'}},fields:{title:'A real title',subtitle:'',brandName:'',presenter:'',date:''},colors:{background:'#123456'},logoName:'my-logo.png'};
test('plain video and a separate opening cover produce one noncontradictory handoff',()=>{
 for(const language of ['en','zh']){const text=presentationBrief({layout,cover,language});for(const word of ['plain-caption','sample-cover','A real title','#123456','my-logo.png'])assert.ok(text.includes(word));assert.ok(!text.includes('no opening cover'));}
 const text=presentationBrief({layout,cover,language:'en'});assert.match(text,/replaces the treatment’s example cover/);assert.match(layoutBrief(layout,'en'),/cover can be chosen separately/);
});
test('a single choice leaves the other for confirmation',()=>{
 assert.match(presentationBrief({layout}),/Opening cover: not selected/);
 assert.match(presentationBrief({cover}),/Video layout: not selected/);
 assert.match(presentationBrief({layout,cover:{none:true}}),/Opening cover: no opening cover/);
 assert.throws(()=>presentationBrief({}));
});
