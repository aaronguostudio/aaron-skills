import {test, expect} from 'bun:test';
import {validateCallouts, validateCalloutTiming} from '../remotion/src/projects/walkthrough-video/callouts';
const steps=[{id:'review'}], viewport={w:1440,h:900};
const valid=()=>({version:1,callouts:[{step:'review',startMs:1000,endMs:9000,box:{x:200,y:500,w:1000,h:200},title:'Migration rehearsal',description:'Local synthetic data',source:'synthetic report',metrics:[{value:'304',label:'invoice drafts',atMs:4000},{value:'42',label:'people',atMs:5500}]}]});
test('accepts explicit evidence and step-relative placement',()=>expect(()=>validateCallouts(valid(),steps,viewport)).not.toThrow());
test('refuses unknown steps, missing source, out of bounds and out of order metrics',()=>{
 for(const mutate of [(v:any)=>v.callouts[0].step='missing',(v:any)=>v.callouts[0].source='',(v:any)=>v.callouts[0].box.x=1000,(v:any)=>v.callouts[0].metrics[1].atMs=3000]){const v=valid();mutate(v);expect(()=>validateCallouts(v,steps,viewport)).toThrow();}
});
test('refuses overlapping callouts and intervals outside rendered step',()=>{
 const v=valid();v.callouts.push({...v.callouts[0]});expect(()=>validateCallouts(v,steps,viewport)).toThrow();
 expect(()=>validateCalloutTiming(valid() as any,steps,{fps:30,segments:[{step:0,fromFrame:0,frames:240}]})).toThrow();
});
