// Explicit, step-relative editorial context. Nothing is generated from application data.
export type ContextCallout = {
  step: string; startMs: number; endMs: number;
  box: {x:number; y:number; w:number; h:number};
  title: string; description: string; source: string;
  metrics: {value:string; label:string; atMs:number}[];
};
export type ContextCallouts = {version:1; callouts:ContextCallout[]};
const str=(v:unknown,n:number)=>typeof v==='string' && v.trim().length>0 && v.length<=n;
const keys=(v:unknown, allowed:string[])=>!!v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).every(k=>allowed.includes(k));
export function validateCallouts(value:unknown, steps:{id:string}[], viewport:{w:number;h:number}): asserts value is ContextCallouts {
  if (!keys(value,['version','callouts']) || (value as ContextCallouts).version!==1 || !Array.isArray((value as ContextCallouts).callouts) || (value as ContextCallouts).callouts.length>30) throw Error('Callouts require version 1 and an array of at most 30 entries');
  const data=value as ContextCallouts;
  for(const c of data.callouts){
    if(!keys(c,['step','startMs','endMs','box','title','description','source','metrics']) || !steps.some(s=>s.id===c.step)) throw Error('Callout must name an existing step and use known fields');
    if(!str(c.title,60)||!str(c.description,100)||!str(c.source,500)) throw Error('Callout title, description and evidence source are required');
    if(!Number.isFinite(c.startMs)||!Number.isFinite(c.endMs)||c.startMs<0||c.endMs-c.startMs<1200) throw Error('Callout times must form a positive step-relative interval');
    if(!keys(c.box,['x','y','w','h']) || ![c.box.x,c.box.y,c.box.w,c.box.h].every(Number.isFinite) || c.box.w<500 || c.box.h<150 || c.box.x<0 || c.box.y<0 || c.box.x+c.box.w>viewport.w || c.box.y+c.box.h>viewport.h) throw Error('Callout box must fit inside the captured screen and be at least 500×150 pixels');
    if(!Array.isArray(c.metrics)||c.metrics.length<1||c.metrics.length>3) throw Error('Callout needs one to three metrics');
    let last=c.startMs;
    for(const m of c.metrics){if(!keys(m,['value','label','atMs'])||!str(m.value,12)||!str(m.label,24)||!Number.isFinite(m.atMs)||m.atMs<last||m.atMs<c.startMs+600||m.atMs>c.endMs-600) throw Error('Metric values and labels need ordered times within the callout');last=m.atMs;}
  }
  for(let i=0;i<data.callouts.length;i++) for(let j=i+1;j<data.callouts.length;j++){const a=data.callouts[i],b=data.callouts[j];if(a.step===b.step && a.startMs<b.endMs && b.startMs<a.endMs) throw Error('Callouts on the same step must not overlap');}
}
export function validateCalloutTiming(data:ContextCallouts, steps:{id:string}[], timeline:{segments:{step:number|null;fromFrame:number;frames:number}[];fps:number}) {
 for(const c of data.callouts){const i=steps.findIndex(s=>s.id===c.step), segments=timeline.segments.filter(s=>s.step===i); if(!segments.length)throw Error(`Callout step ${c.step} has no visible timeline`);const duration=(Math.max(...segments.map(s=>s.fromFrame+s.frames))-segments[0].fromFrame)*1000/timeline.fps;if(c.endMs>duration)throw Error(`Callout for ${c.step} exceeds the visible step duration (${Math.floor(duration)} ms)`);}
}
