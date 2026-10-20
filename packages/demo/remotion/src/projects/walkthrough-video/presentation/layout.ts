import type {Presentation} from './model';
import type {Timeline} from '../timeline';

export type Box={x:number;y:number;w:number;h:number};
export type ScreenLayout={screenPlacement:'top'|'bottom'|'left'|'right';annotationMode?:'caption'|'transcript';annotationRatio?:number;padding?:number;gap?:number;fit?:'contain';canvas?:{width:number;height:number}};
export type LayoutGeometry={width:number;height:number;screen:Box&{scale:number};annotation:Box;legacy:boolean};

export function validateLayout(value:unknown):asserts value is ScreenLayout|undefined {
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Layout must be an object');
  const p=value as ScreenLayout;
  if(Object.keys(p).some(k=>!['screenPlacement','annotationMode','annotationRatio','padding','gap','fit','canvas'].includes(k)))throw Error('Unknown layout field');
  if(!['top','bottom','left','right'].includes(p.screenPlacement))throw Error('screenPlacement must be top, bottom, left or right');
  if(p.annotationMode!==undefined&&!['caption','transcript'].includes(p.annotationMode))throw Error('annotationMode must be caption or transcript');
  if(p.annotationRatio!==undefined&&(!Number.isFinite(p.annotationRatio)||p.annotationRatio<.15||p.annotationRatio>.5))throw Error('annotationRatio must be between 0.15 and 0.5');
  for(const size of [p.padding,p.gap])if(size!==undefined&&(!Number.isFinite(size)||size<0||size>80))throw Error('Layout padding/gap must be between 0 and 80 pixels');
  if(p.fit!==undefined&&p.fit!=='contain')throw Error('Layout fit must be contain; cropping evidence is not supported');
  if(p.canvas!==undefined){
    if(!p.canvas||typeof p.canvas!=='object'||Array.isArray(p.canvas)||Object.keys(p.canvas).some(k=>!['width','height'].includes(k)))throw Error('Invalid layout canvas');
    for(const n of [p.canvas.width,p.canvas.height])if(!Number.isInteger(n)||n<320||n>3840||n%2!==0)throw Error('Canvas dimensions must be even integers between 320 and 3840');
  }
}

export function layoutGeometry(viewport:{w:number;h:number},p?:Presentation):LayoutGeometry {
  const l=p?.layout;
  if(!l)return {width:viewport.w,height:viewport.h+96,screen:{x:0,y:0,w:viewport.w,h:viewport.h,scale:1},annotation:{x:0,y:viewport.h,w:viewport.w,h:96},legacy:true};
  validateLayout(l);
  const horizontal=['left','right'].includes(l.screenPlacement),ratio=l.annotationRatio??(horizontal?.3:.18),padding=l.padding??0,gap=l.gap??0;
  const even=(n:number)=>Math.ceil(n/2)*2;
  const width=l.canvas?.width??even((horizontal?viewport.w/(1-ratio)+gap:viewport.w)+2*padding);
  const height=l.canvas?.height??even((horizontal?viewport.h:viewport.h/(1-ratio)+gap)+2*padding);
  const inner={x:padding,y:padding,w:width-2*padding,h:height-2*padding};
  const available=(horizontal?inner.w:inner.h)-gap,annotationSize=available*ratio,screenSize=available-annotationSize;
  const first=['top','left'].includes(l.screenPlacement);
  const region:Box=horizontal?{x:inner.x+(first?0:annotationSize+gap),y:inner.y,w:screenSize,h:inner.h}:{x:inner.x,y:inner.y+(first?0:annotationSize+gap),w:inner.w,h:screenSize};
  const annotation:Box=horizontal?{x:inner.x+(first?screenSize+gap:0),y:inner.y,w:annotationSize,h:inner.h}:{x:inner.x,y:inner.y+(first?screenSize+gap:0),w:inner.w,h:annotationSize};
  if(region.w<160||region.h<100||annotation.w<200||annotation.h<120)throw Error('Layout regions are too small; increase the canvas or annotationRatio, or reduce padding/gap');
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

export function annotationPages(p:Presentation,box:Box,caption:string,transcript?:string):{pages:string[];size:number}{
  const full=p.layout?.annotationMode==='transcript',text=full?(transcript||caption):caption;
  const height=box.h-(p.brand.logoBackground?108:96);
  let size=full?24:32;
  while(size>18&&height<size*1.4)size-=2;
  let pages=textPages(text,box.w-40,height,size);
  if(!full)while(pages.length>1&&size>18){size-=2;pages=textPages(text,box.w-40,height,size);}
  if(!full&&pages.length>1)throw Error('Caption does not fit the annotation region; enlarge it or use transcript mode');
  return {pages,size};
}
