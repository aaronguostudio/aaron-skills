import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CoverDesign} from '../../packages/demo/remotion/src/cover-library/CoverDesign';
import {PresentationAnnotation} from '../../packages/demo/remotion/src/projects/walkthrough-video/presentation/Presentation';
import {layoutGeometry,resolveLayout,VIDEO_TREATMENTS} from '../../packages/demo/remotion/src/projects/walkthrough-video/presentation/layout';
import {presentationPreset} from '../../packages/demo/remotion/src/projects/walkthrough-video/presentation/model';
import {inheritedPalette} from '../../packages/demo/remotion/src/projects/walkthrough-video/presentation/theme';
import {getCoverPreset} from '../../packages/demo/covers/catalog';
import layouts from './video-layouts.json';

const artwork=import.meta.glob('../../packages/demo/covers/art/*.webp',{eager:true,query:'?url',import:'default'});
const viewport={w:1440,h:900};
const sample=layouts.find(item=>item.id==='plain-caption');
const recording=sample.video;
const lines={en:['Bring the work into focus','Open a project','See what matters','Ready for a fresh pair of eyes','Keep everyone in sync','Ready for the next review','A little progress. A clearer next step.'],zh:['聚焦重要的工作','打开一个项目','查看关键内容','准备好接受审核','让团队保持同步','准备下一轮审核','迈出更清晰的下一步']};
export function FilmPreview({layout,cover,fields,logo,language,phase,playing,onTime,onEnd,onError}){
 const stage=useRef(null),video=useRef(null),[scale,setScale]=useState(1),[time,setTime]=useState(0);
 const treatment=VIDEO_TREATMENTS[layout.id]??{};
 const selectedCover=cover&&!cover.none?{preset:cover.preset.id,colors:cover.colors,...(fields.presenter?{presenter:fields.presenter}:{}),...(fields.date?{date:fields.date}:{})}:undefined;
 // Film retains a treatment's backdrop when its intro is disabled.
 const renderCover=selectedCover??treatment.cover;
 const theme=treatment.theme??{};
 const palette=inheritedPalette({theme,cover:renderCover});
 const base=presentationPreset('professional',fields.title||(language==='zh'?'让下一个想法精彩开场':'Your next big idea'),fields.subtitle||'');
 const p={...base,version:2,layout:{preset:layout.id},theme,cover:renderCover,
  brand:{...base.brand,name:fields.brandName||'',tagline:'',primary:palette.background,accent:palette.accent,...(logo?{logo:logo.name}:{fallback:'omit'})},
  intro:{...base.intro,...treatment.intro,enabled:!!selectedCover},body:{...base.body,highlightColor:palette.highlight,cursorColor:palette.cursor,...treatment.body},outro:{...base.outro,...treatment.outro}};
 const geometry=layoutGeometry(viewport,p),stageStyle=resolveLayout(p.layout).stageStyle,resolvedCover=renderCover?getCoverPreset(renderCover.preset):null;
 const art=resolvedCover?.art?artwork[`../../packages/demo/covers/${resolvedCover.art}`]:undefined;
 const index=time<2?0:time<4?1:time<6?2:time<8?3:time<10?4:time<14?5:6;
 useLayoutEffect(()=>{const el=stage.current;if(!el)return;const update=()=>setScale(el.clientWidth/geometry.width);update();const obs=new ResizeObserver(update);obs.observe(el);return()=>obs.disconnect();},[geometry.width,geometry.height,phase]);
 useEffect(()=>{if(phase==='video'&&playing&&video.current){video.current.play().catch(onError);}else video.current?.pause();},[phase,playing]);
 return <div className="ps-film-stage" ref={stage} style={{aspectRatio:`${geometry.width} / ${geometry.height}`}}><div className="ps-film-frame" style={{width:geometry.width,height:geometry.height,transform:`scale(${scale})`}}>
  {phase==='cover'&&selectedCover?<CoverDesign cover={selectedCover} title={p.title} subtitle={p.subtitle} brandName={p.brand.name} logoSrc={logo?.url} omitFallback artSrc={art} width={geometry.width} height={geometry.height}/>:<>
   <div className="ps-film-backdrop" style={{background:palette.background}}>{resolvedCover&&<CoverDesign cover={{...renderCover,presenter:undefined,date:undefined}} title="" brandName="" omitFallback artSrc={art} width={geometry.width} height={geometry.height}/>}</div>
   <div className="ps-film-recording" style={{left:geometry.screen.x,top:geometry.screen.y,width:geometry.screen.w,height:geometry.screen.h,boxShadow:stageStyle?(stageStyle==='paper'?'0 12px 45px #1d29251c':'0 20px 80px #10131f40'):'none',outline:stageStyle?'1px solid #ffffff30':'none'}}><video ref={video} src={recording} poster={sample.stills[0]} muted playsInline preload="none" onTimeUpdate={e=>{setTime(e.currentTarget.currentTime);onTime?.(e.currentTarget.currentTime);}} onEnded={onEnd} onError={onError}/></div>
   <PresentationAnnotation p={p} box={geometry.annotation} caption={lines[language][index]} transcript={lines[language][index]} position={`${index+1}/7`} progress={0} narrated={false} previewLogoSrc={logo?.url}/>
  </>}
 </div></div>;
}
