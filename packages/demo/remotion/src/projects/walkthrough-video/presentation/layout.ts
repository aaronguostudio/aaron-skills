import type {Presentation} from './model';
import type {Timeline} from '../timeline';

export type Box={x:number;y:number;w:number;h:number};
export type ScreenLayout={preset?:string;screenPlacement?:'top'|'bottom'|'left'|'right';annotationStyle?:'plain'|'compact'|'editorial'|'ribbon'|'simple';stageStyle?:'cobalt'|'sand'|'chrome'|'midnight'|'paper'|'vermilion';annotationMode?:'caption'|'transcript';annotationRatio?:number;padding?:number;gap?:number;fit?:'contain';canvas?:{width:number;height:number}};
type ResolvedLayout=ScreenLayout&{screenPlacement:'top'|'bottom'|'left'|'right'};
// Composition choices, independent of palette and cover. Explicit fields override a preset.
export const VIDEO_LAYOUTS:ReadonlyArray<{id:string;name:string;use:string;tradeoff:string;layout:ResolvedLayout}>=[
  ...(['cobalt','sand','chrome','midnight','paper','vermilion'] as const).map((style)=>({id:`studio-${style}`,name:({cobalt:'Cobalt Studio',sand:'Sand Editorial',chrome:'Chrome Atelier',midnight:'Midnight Cinema',paper:'Paper Gallery',vermilion:'Vermilion Cut'})[style],use:'A product-led demonstration with one short caption',tradeoff:'Artwork stays in the frame; transcript panels are opt-in',layout:{screenPlacement:'top' as const,annotationStyle:'ribbon' as const,annotationMode:'caption' as const,stageStyle:style,annotationRatio:.065,padding:32,gap:12,canvas:{width:1920,height:1200}}})),
  {id:'plain-caption',name:'Just the video',use:'An unframed recording with a short caption below',tradeoff:'No decorative backdrop; native recording width',layout:{screenPlacement:'top',annotationStyle:'simple',annotationMode:'caption',annotationRatio:.09,padding:0,gap:0}},
  {id:'plain-transcript',name:'Video + transcript',use:'An unframed recording with a few lines of narration below',tradeoff:'Long narration is paginated over time; no decorative backdrop',layout:{screenPlacement:'top',annotationStyle:'simple',annotationMode:'transcript',annotationRatio:.15,padding:0,gap:0}},
  {id:'screen-first',name:'Screen first',use:'Dense tables and detailed product tours',tradeoff:'Short captions only; the application gets most of the frame',layout:{screenPlacement:'top',annotationStyle:'compact',annotationRatio:.15,padding:0,gap:0,canvas:{width:1920,height:1080}}},
  {id:'guided-demo',name:'Guided demo',use:'A balanced feature walkthrough',tradeoff:'More caption space with a slightly smaller application',layout:{screenPlacement:'top',annotationRatio:.22,padding:24,gap:16,canvas:{width:1920,height:1080}}},
  {id:'lesson-notes',name:'Lesson notes',use:'Training with a visible explanation',tradeoff:'Long narration is paginated; application details are smaller',layout:{screenPlacement:'left',annotationMode:'transcript',annotationStyle:'editorial',annotationRatio:.30,padding:32,gap:24,canvas:{width:1920,height:1080}}},
  {id:'presenter-notes',name:'Presenter notes',use:'Introduce a task before viewers follow it',tradeoff:'Reading starts on the left; less space for the application',layout:{screenPlacement:'right',annotationStyle:'editorial',annotationRatio:.28,padding:32,gap:24,canvas:{width:1920,height:1080}}},
  {id:'briefing',name:'Top briefing',use:'A concise instruction above a wide application',tradeoff:'The explanation precedes the screen vertically',layout:{screenPlacement:'bottom',annotationStyle:'compact',annotationRatio:.16,padding:24,gap:16,canvas:{width:1920,height:1080}}},
  {id:'reading-room',name:'Reading room',use:'A text-led lesson with the full narration',tradeoff:'Nearly half of the width is reserved for reading',layout:{screenPlacement:'left',annotationMode:'transcript',annotationStyle:'editorial',annotationRatio:.42,padding:40,gap:32,canvas:{width:1920,height:1080}}},
  {id:'native-detail',name:'Native detail',use:'Preserve small application text at its original pixel size',tradeoff:'Canvas expands with the recording; output is not fixed to 16:9',layout:{screenPlacement:'top',annotationStyle:'compact',annotationRatio:.15,padding:0,gap:0}},
  {id:'square-lesson',name:'Square lesson',use:'A square course or team feed',tradeoff:'Suited to larger UI; dense desktop tables need fullscreen viewing',layout:{screenPlacement:'top',annotationMode:'transcript',annotationStyle:'editorial',annotationRatio:.32,padding:24,gap:20,canvas:{width:1440,height:1440}}},
];

// Ready-to-use cover/body combinations. Explicit configuration wins over these defaults.
export const VIDEO_TREATMENTS:Record<string,{cover?:{preset:string;colors:{background:string;foreground:string;accent:string}};theme:{background:string;foreground:string;accent:string};body?:{logoPosition:'none'};intro?:{enabled:false;soundPreset:'none'};outro?:{enabled:false}}>={
  ...Object.fromEntries([
    ['cobalt','cobalt-signal','#1648ED','#F5F1E9','#E8FF00'],
    ['sand','desert-editorial','#EEE7DB','#27251E','#A85136'],
    ['chrome','chrome-loop','#DDD4F3','#20142E','#E17A10'],
    ['midnight','ocean-margin','#101E2C','#F2F3EB','#C1DAE0'],
    ['paper','paper-relief','#EBE9DE','#292D24','#677E50'],
    ['vermilion','vermilion-fold','#A8402C','#FFF4E7','#F7CE5B'],
  ].map(([id,preset,background,foreground,accent])=>['studio-'+id,{cover:{preset,colors:{background,foreground,accent}},theme:{background,foreground,accent}}])),
  'plain-caption':{theme:{background:'#FFFFFF',foreground:'#20241E',accent:'#647655'},body:{logoPosition:'none'},intro:{enabled:false,soundPreset:'none'},outro:{enabled:false}},
  'plain-transcript':{theme:{background:'#FFFFFF',foreground:'#20241E',accent:'#647655'},body:{logoPosition:'none'},intro:{enabled:false,soundPreset:'none'},outro:{enabled:false}},
};

export function resolveLayout(value:ScreenLayout):ResolvedLayout {
  const preset=value.preset===undefined?undefined:VIDEO_LAYOUTS.find(p=>p.id===value.preset);
  if(value.preset!==undefined&&!preset)throw Error(`Unknown video layout preset: ${value.preset}`);
  const resolved={...preset?.layout,...value};
  if(!resolved.screenPlacement)throw Error('Layout needs a preset or screenPlacement');
  return resolved as ResolvedLayout;
}
export type LayoutGeometry={width:number;height:number;screen:Box&{scale:number};annotation:Box;legacy:boolean};

export function validateLayout(value:unknown):asserts value is ScreenLayout|undefined {
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Layout must be an object');
  if(Object.keys(value).some(k=>!['preset','screenPlacement','annotationStyle','stageStyle','annotationMode','annotationRatio','padding','gap','fit','canvas'].includes(k)))throw Error('Unknown layout field');
  const p=resolveLayout(value as ScreenLayout);
  if(!['top','bottom','left','right'].includes(p.screenPlacement))throw Error('screenPlacement must be top, bottom, left or right');
  if(p.annotationStyle!==undefined&&!['plain','compact','editorial','ribbon','simple'].includes(p.annotationStyle))throw Error('annotationStyle must be plain, compact, editorial, ribbon or simple');
  if(p.stageStyle!==undefined&&!['cobalt','sand','chrome','midnight','paper','vermilion'].includes(p.stageStyle))throw Error('Unknown stageStyle');
  if(['compact','ribbon'].includes(p.annotationStyle??'')&&['left','right'].includes(p.screenPlacement))throw Error('Compact annotations need a top or bottom screen');
  if(['compact','ribbon'].includes(p.annotationStyle??'')&&p.annotationMode==='transcript')throw Error('Compact annotations use captions; choose plain or editorial for transcripts');
  if(p.stageStyle&&(p.annotationStyle!=='ribbon'||p.screenPlacement!=='top'))throw Error('Stage layouts need a ribbon below the screen');
  if(p.annotationMode!==undefined&&!['caption','transcript'].includes(p.annotationMode))throw Error('annotationMode must be caption or transcript');
  const minRatio=['ribbon','simple'].includes(p.annotationStyle??'')?.055:.15;
  if(p.annotationRatio!==undefined&&(!Number.isFinite(p.annotationRatio)||p.annotationRatio<minRatio||p.annotationRatio>.5))throw Error(`annotationRatio must be between ${minRatio} and 0.5`);
  for(const size of [p.padding,p.gap])if(size!==undefined&&(!Number.isFinite(size)||size<0||size>80))throw Error('Layout padding/gap must be between 0 and 80 pixels');
  if(p.fit!==undefined&&p.fit!=='contain')throw Error('Layout fit must be contain; cropping evidence is not supported');
  if(p.canvas!==undefined){
    if(!p.canvas||typeof p.canvas!=='object'||Array.isArray(p.canvas)||Object.keys(p.canvas).some(k=>!['width','height'].includes(k)))throw Error('Invalid layout canvas');
    for(const n of [p.canvas.width,p.canvas.height])if(!Number.isInteger(n)||n<320||n>3840||n%2!==0)throw Error('Canvas dimensions must be even integers between 320 and 3840');
  }
}

export function layoutGeometry(viewport:{w:number;h:number},p?:Presentation):LayoutGeometry {
  if(!p?.layout)return {width:viewport.w,height:viewport.h+96,screen:{x:0,y:0,w:viewport.w,h:viewport.h,scale:1},annotation:{x:0,y:viewport.h,w:viewport.w,h:96},legacy:true};
  validateLayout(p.layout);
  const l=resolveLayout(p.layout);
  const horizontal=['left','right'].includes(l.screenPlacement),ratio=l.annotationRatio??(horizontal?.3:.18),padding=l.padding??0,gap=l.gap??0;
  const even=(n:number)=>Math.ceil(n/2)*2;
  const width=l.canvas?.width??even((horizontal?viewport.w/(1-ratio)+gap:viewport.w)+2*padding);
  const height=l.canvas?.height??even((horizontal?viewport.h:viewport.h/(1-ratio)+gap)+2*padding);
  const inner={x:padding,y:padding,w:width-2*padding,h:height-2*padding};
  const available=(horizontal?inner.w:inner.h)-gap,annotationSize=available*ratio,screenSize=available-annotationSize;
  const first=['top','left'].includes(l.screenPlacement);
  const region:Box=horizontal?{x:inner.x+(first?0:annotationSize+gap),y:inner.y,w:screenSize,h:inner.h}:{x:inner.x,y:inner.y+(first?0:annotationSize+gap),w:inner.w,h:screenSize};
  const annotation:Box=horizontal?{x:inner.x+(first?screenSize+gap:0),y:inner.y,w:annotationSize,h:inner.h}:{x:inner.x,y:inner.y+(first?screenSize+gap:0),w:inner.w,h:annotationSize};
  if(!l.canvas&&!horizontal&&first){region.h=viewport.h;annotation.y=region.y+viewport.h+gap;annotation.h=height-padding-annotation.y;}
  if(region.w<160||region.h<100||annotation.w<200||annotation.h<(['ribbon','simple'].includes(l.annotationStyle??'')?60:120))throw Error('Layout regions are too small; increase the canvas or annotationRatio, or reduce padding/gap');
  const scale=l.canvas?Math.min(region.w/viewport.w,region.h/viewport.h):1;
  const w=viewport.w*scale,h=viewport.h*scale;
  return {width,height,screen:{x:region.x+(region.w-w)/2,y:region.y+(region.h-h)/2,w,h,scale},annotation,legacy:false};
}

export const mapBox=(box:Box,screen:LayoutGeometry['screen']):Box=>({x:screen.x+box.x*screen.scale,y:screen.y+box.y*screen.scale,w:box.w*screen.scale,h:box.h*screen.scale});

export function annotationAt(timeline:Timeline,clips:{at:number|'intro'|'outro';ms:number;text?:string}[],index:number|null,frame:number,caption:string):{text:string;progress:number}{
  const stepSegments=timeline.segments.filter(s=>s.step===index);
  const start=stepSegments[0]?.fromFrame??frame;
  const last=stepSegments.at(-1),end=last?last.fromFrame+last.frames:start+1;
  const timed=clips.filter(c=>typeof c.at==='number'&&c.text).map(c=>({...c,start:timeline.segments.find(s=>s.step===c.at)?.fromFrame??Infinity}));
  const clip=timed.find(c=>c.at===index)??timed.find(c=>c.start<=frame&&frame<c.start+c.ms*timeline.fps/1000);
  const from=clip?.start??start,frames=clip?clip.ms*timeline.fps/1000:end-start;
  return {text:clip?.text??caption,progress:Math.max(0,Math.min(.999,(frame-from)/Math.max(1,frames)))};
}

// Conservative wrapping, independent of host fonts. Pages are timed proportionally,
// not word-synchronized. Never ellipsize or discard the rest of a transcript.
export function textPages(text:string,width:number,height:number,fontSize:number):string[]{
  if(!text.trim())return [''];
  const columns=Math.floor(width/(fontSize*.78)),lines=Math.floor(height/(fontSize*1.4));
  if(columns<4||lines<1)throw Error('Annotation has no readable text area; increase the panel size');
  const result:string[]=[];let page='',line=0,count=1;
  for(const word of text.trim().split(/\s+/)){
    const size=Array.from(word).reduce((n,c)=>n+(/[\u3000-\uffff]/.test(c)?1.4:1),0);
    const extra=Math.ceil(size/columns);
    const next=line+(line?1:0)+size;
    const newLines=next>columns?Math.max(1,extra):0;
    if(count+newLines>lines && page){result.push(page);page='';line=0;count=1;}
    if(size>columns*lines)throw Error('A single annotation token exceeds the panel; add spaces or enlarge the panel');
    const startsNew=line+(line?1:0)+size>columns;
    count+=startsNew?Math.max(1,extra):0;
    line=startsNew?size%columns:line+(line?1:0)+size;
    page+=(page?' ':'')+word;
  }
  if(page)result.push(page);
  return result;
}

export function annotationTextArea(p:Presentation,box:Box,caption:string,transcript?:string):{width:number;height:number;heading:boolean;headingSize:number;compact:boolean}{
  const layout=p.layout?resolveLayout(p.layout):undefined,compact=['compact','ribbon'].includes(layout?.annotationStyle??'');
  const heading=layout?.annotationStyle==='editorial'&&layout.annotationMode==='transcript'&&!!transcript&&transcript!==caption;
  const simple=layout?.annotationStyle==='simple';
  const width=box.w-(simple?(p.body.logoPosition==='none'?112:312):layout?.annotationStyle==='ribbon'?352:compact?320:40);
  let headingSize=28;
  if(heading){
    while(headingSize>18&&textPages(caption,width,84,headingSize).length>1)headingSize-=2;
    if(textPages(caption,width,84,headingSize).length>1)throw Error('Step heading does not fit; shorten the caption or enlarge the panel');
  }
  // Fixed two-line heading reservation is shared by preflight and rendered content.
  return {width,height:box.h-(simple?32:layout?.annotationStyle==='ribbon'?20:compact?40:(p.brand.logoBackground?108:96))-(heading?100:0),heading,headingSize,compact};
}

export function annotationPages(p:Presentation,box:Box,caption:string,transcript?:string):{pages:string[];size:number}{
  const layout=p.layout?resolveLayout(p.layout):undefined;
  const full=layout?.annotationMode==='transcript',text=full?(transcript||caption):caption;
  const {width,height,compact}=annotationTextArea(p,box,caption,transcript);
  let size=full?24:compact?28:32;
  while(size>18&&height<size*1.4)size-=2;
  let pages=textPages(text,width,height,size);
  if(!full)while(pages.length>1&&size>18){size-=2;pages=textPages(text,width,height,size);}
  if(!full&&pages.length>1)throw Error('Caption does not fit the annotation region; enlarge it or use transcript mode');
  return {pages,size};
}
