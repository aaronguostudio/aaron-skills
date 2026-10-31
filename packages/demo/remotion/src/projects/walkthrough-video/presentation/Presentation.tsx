import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Presentation} from './model';
import {CoverDesign} from '../../../cover-library/CoverDesign';
import {logoFor, logoSurfaceBackground, paletteFor} from './theme';
import {annotationPages, annotationTextArea, resolveLayout, type Box} from './layout';

const FONT = "-apple-system, 'Helvetica Neue', Arial, sans-serif";

export const PresentationBackdrop:React.FC<{p:Presentation}>=({p})=>{
  const {width,height}=useVideoConfig();
  if(!p.layout||!resolveLayout(p.layout).stageStyle)return null;
  return <AbsoluteFill style={{overflow:'hidden',pointerEvents:'none'}}>
    {p.cover?<CoverDesign cover={{...p.cover,presenter:undefined,date:undefined}} title="" brandName="" omitFallback artSrc={p.cover.art?staticFile(p.cover.art):undefined} width={width} height={height} renderImage={props=><Img {...props}/>}/>:null}
  </AbsoluteFill>;
};

export const PresentationLogo: React.FC<{p: Presentation; size: number; background?:string; previewSrc?:string}> = ({p, size,background,previewSrc}) => {
  const logo=logoFor(p,p.brand.logoBackground??background??paletteFor(p,'body').background);
  if(logo)return <span style={{display:'inline-flex',alignItems:'center',flexShrink:0,background:p.brand.logoBackground,padding:p.brand.logoBackground?size*.12:0,borderRadius:size*.1}}>{previewSrc?<img src={previewSrc} style={{width:'auto',height:size,maxWidth:size*4,objectFit:'contain',objectPosition:'left center',flexShrink:0}}/>:<Img src={staticFile(logo)} style={{width: 'auto', height: size, maxWidth: size * 4, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0}} />}</span>;
  if(p.version===2)return p.brand.fallback==='monogram'?<span style={{fontSize:size*.7,lineHeight:1,fontWeight:700}}>{Array.from(p.brand.name)[0]?.toUpperCase()}</span>:null;
  // Version 1 has no explicit monogram choice. Show only a supplied logo/name.
  return null;
};

export const PresentationCard: React.FC<{p: Presentation; closing?: boolean; cover?: boolean; narrated?: boolean; total?: number}> = ({p, closing = false, cover = false, narrated = false, total = 90}) => {
  const actualFrame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const s = width / 1440;
  const frame = cover ? 60 : actualFrame;
  const enter = Math.min(1, frame / 20);
  const ease = 1 - Math.pow(1 - enter, 3);
  const exit = cover || closing ? 1 : interpolate(frame, [Math.max(0,total-8), total], [1,0], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const minimal = p.template === 'minimal';
  const showcase = p.template === 'showcase';
  const palette=paletteFor(p,closing?'outro':'intro');
  const ink = palette.foreground;
  const accent = palette.accent;
  const title = closing ? p.outro.title : p.title;
  const subtitle = closing ? p.outro.subtitle : p.subtitle;
  if (p.cover && !closing) return <AbsoluteFill style={{opacity:exit}}>
    {!cover && p.intro.sound ? <Audio src={staticFile(p.intro.sound)} volume={p.intro.volume}/> : null}
    <CoverDesign cover={p.cover} title={title} subtitle={subtitle} brandName={p.brand.name}
      logoSrc={logoFor(p,logoSurfaceBackground(p,'cover'))?staticFile(logoFor(p,logoSurfaceBackground(p,'cover'))!):undefined} logoBackground={p.brand.logoBackground} logoContainsName={p.brand.logoContainsName} omitFallback={p.version!==2||p.brand.fallback!=='monogram'} artSrc={p.cover.art?staticFile(p.cover.art):undefined}
      width={width} height={height} renderImage={props=><Img {...props}/>}/>
  </AbsoluteFill>;
  return <AbsoluteFill style={{fontFamily:FONT, background:palette.background, color:ink, opacity:exit, overflow:'hidden'}}>
    {!cover && !closing && p.intro.sound ? <Audio src={staticFile(p.intro.sound)} volume={p.intro.volume} /> : null}
    {showcase ? <>
      <div style={{position:'absolute',width:width*.8,height:width*.8,right:-width*.22,top:-height*.48,borderRadius:'50%',background:`radial-gradient(circle at 40% 45%, ${p.brand.accent} 0%, ${p.brand.primary} 45%, transparent 68%)`,opacity:.65,transform:`translateY(${(1-ease)*24}px)`}} />
      <svg width={width} height={height} style={{position:'absolute',opacity:.22}} aria-hidden="true">
        {[0,1,2,3,4,5].map(i=><ellipse key={i} cx={width*.88} cy={height*.26} rx={width*(.23+i*.065)} ry={height*(.19+i*.055)} fill="none" stroke={p.brand.accent} strokeWidth={1} transform={`rotate(-23 ${width*.88} ${height*.26})`} />)}
      </svg>
    </> : !minimal ? <div style={{position:'absolute',inset:0,opacity:.12,backgroundImage:'linear-gradient(#ffffff30 1px, transparent 1px), linear-gradient(90deg, #ffffff30 1px, transparent 1px)',backgroundSize:`${72*s}px ${72*s}px`}} /> : null}
    <div style={{position:'absolute',left:80*s,right:80*s,top:65*s,display:'flex',alignItems:'center',gap:18*s,color:ink}}>
      <div style={{opacity:ease,transform:`translateY(${(1-ease)*12}px)`}}><PresentationLogo p={p} size={54*s} background={palette.background}/></div>
      {!p.brand.logoContainsName?<div style={{fontSize:25*s,fontWeight:650,letterSpacing:-.5*s}}>{p.brand.name}</div>:null}
      <div style={{marginLeft:'auto',fontSize:14*s,letterSpacing:2*s,opacity:.6}}>PRODUCT WALKTHROUGH</div>
    </div>
    <div style={{position:'absolute',left:80*s,right:80*s,bottom:(showcase?165:190)*s,opacity:ease,transform:`translateY(${(1-ease)*20}px)`}}>
      <div style={{fontSize:16*s,letterSpacing:3*s,textTransform:'uppercase',color:accent,marginBottom:28*s}}>{closing?'THE NEXT STEP':p.brand.tagline || 'A closer look'}</div>
      <div style={{fontSize:(showcase?100:minimal?84:90)*s,lineHeight:1.04,letterSpacing:-4*s,fontWeight:650,maxWidth:1120*s,overflowWrap:'break-word'}}>{title}</div>
      {subtitle ? <div style={{fontSize:29*s,lineHeight:1.4,opacity:.72,maxWidth:980*s,marginTop:32*s}}>{subtitle}</div> : null}
      <div style={{height:3*s,width:(minimal?70:140)*s,background:accent,marginTop:44*s,transform:`scaleX(${ease})`,transformOrigin:'left'}} />
    </div>
    <div style={{position:'absolute',left:80*s,right:80*s,bottom:58*s,paddingTop:22*s,borderTop:`1px solid ${minimal?'#153F3B30':'#ffffff30'}`,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:17*s,opacity:.7}}>
      <span>{closing ? p.outro.url || p.brand.tagline : narrated ? 'AI NARRATION' : ''}</span>
      <span style={{fontVariantNumeric:'tabular-nums',letterSpacing:2*s}}>{closing?'END':'01 — START HERE'}</span>
    </div>
  </AbsoluteFill>;
};

export const PresentationCaption: React.FC<{p:Presentation; top:number; width:number; caption:string; position:string; narrated:boolean}> = ({p,top,width,caption,position,narrated}) => {
  const s=width/1440, minimal=p.template==='minimal';
  const palette=paletteFor(p,'body'),color=palette.foreground;
  const mark=(p.brand.name.trim()||logoFor(p,palette.background))?<div style={{color,display:'flex',alignItems:'center',gap:12*s}}><PresentationLogo p={p} size={38*s} background={palette.background}/>{!p.brand.logoContainsName?<span style={{fontSize:16*s,maxWidth:180*s}}>{p.brand.name}</span>:null}</div>:null;
  return <div style={{position:'absolute',top,left:0,width,height:96,fontFamily:FONT,background:palette.background,color,display:'flex',alignItems:'center',gap:24*s,padding:`0 ${32*s}px`,boxSizing:'border-box',borderTop:`2px solid ${p.brand.accent}`}}>
    {p.body.logoPosition==='left'?mark:null}
    <span style={{fontSize:20*s,opacity:.55,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <span style={{fontSize:32*s,lineHeight:1.18,flex:1}}>{caption}</span>
    {p.body.logoPosition==='right'?mark:null}
    {narrated?<span style={{fontSize:12*s,opacity:.55}}>AI NARRATION</span>:null}
  </div>;
};

export const PresentationAnnotation:React.FC<{p:Presentation;box:Box;caption:string;transcript?:string;position:string;progress:number;narrated:boolean;previewLogoSrc?:string}> = ({p,box,caption,transcript,position,progress,narrated,previewLogoSrc})=>{
  const palette=paletteFor(p,'body'),layout=p.layout?resolveLayout(p.layout):undefined,full=layout?.annotationMode==='transcript';
  const pad=20,{pages,size}=annotationPages(p,box,caption,transcript);
  const area=annotationTextArea(p,box,caption,transcript);
  const headerHeight=p.brand.logoBackground?52:40,logoSize=Math.min(40,(box.w-100)/4);
  const index=Math.min(pages.length-1,Math.max(0,Math.floor(progress*pages.length)));
  const hasMark=!!logoFor(p,p.brand.logoBackground??palette.background)||p.brand.fallback==='monogram';
  const mark=p.body.logoPosition!=='none'?<div style={{display:'flex',alignItems:'center',gap:10,order:p.body.logoPosition==='left'?-1:1,maxWidth:box.w-100}}><PresentationLogo p={p} size={logoSize} background={palette.background} previewSrc={previewLogoSrc}/>{!p.brand.logoContainsName&&(!hasMark||box.w>=340)?<span style={{fontSize:box.w<340?12:14,overflowWrap:'anywhere',maxWidth:box.w-100}}>{p.brand.name}</span>:null}</div>:null;
  if(layout?.annotationStyle==='simple')return <div data-annotation-style="simple" data-annotation-mode={full?'transcript':'caption'} style={{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,padding:'16px 24px',boxSizing:'border-box',display:'flex',gap:24,alignItems:full?'flex-start':'center',background:palette.background,color:palette.foreground,fontFamily:FONT}}>
    <span style={{width:40,flexShrink:0,fontSize:13,opacity:.6,paddingTop:full?7:0,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <div style={{width:area.width,fontSize:size,lineHeight:1.4,overflowWrap:'anywhere'}}>{pages[index]}</div>
    {mark?<div style={{width:176,flexShrink:0,order:p.body.logoPosition==='left'?-1:1,display:'flex',justifyContent:'flex-end'}}>{mark}</div>:null}
    {pages.length>1?<span style={{position:'absolute',bottom:4,right:24,fontSize:11,opacity:.6}}>{index+1} / {pages.length}</span>:null}
  </div>;
  if(layout?.annotationStyle==='ribbon')return <div data-annotation-style="ribbon" style={{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,padding:'10px 16px',boxSizing:'border-box',borderRadius:4,display:'flex',alignItems:'center',gap:16,background:palette.background,color:palette.foreground,fontFamily:layout.stageStyle==='sand'||layout.stageStyle==='paper'?"Georgia, 'Times New Roman', serif":FONT}}>
    <span style={{fontFamily:FONT,fontSize:14,letterSpacing:2,opacity:.65,minWidth:55,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <span style={{display:'block',height:24,width:2,background:palette.accent,flexShrink:0}}/>
    <div style={{width:area.width,fontSize:size,lineHeight:1.35,letterSpacing:-.45,overflowWrap:'anywhere'}}>{pages[index]}</div>
    <div style={{marginLeft:'auto',width:176,flexShrink:0,display:'flex',justifyContent:'flex-end'}}>{mark}</div>
  </div>;
  if(area.compact)return <div data-annotation-style="compact" style={{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,padding:pad,boxSizing:'border-box',background:palette.background,color:palette.foreground,borderTop:`2px solid ${palette.accent}`,fontFamily:FONT,display:'flex',gap:24,alignItems:'center'}}>
    <span style={{width:56,flexShrink:0,fontSize:18,opacity:.75,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <div style={{width:area.width,height:area.height,display:'flex',alignItems:'center',fontSize:size,lineHeight:1.4,overflowWrap:'anywhere'}}>{pages[index]}</div>
    <div style={{marginLeft:p.body.logoPosition==='left'?0:'auto',width:176,flexShrink:0,order:p.body.logoPosition==='left'?-1:1,display:'flex',justifyContent:p.body.logoPosition==='left'?'flex-start':'flex-end'}}>{mark}</div>
  </div>;
  return <div data-annotation-mode={full?'transcript':'caption'} data-annotation-style={layout?.annotationStyle??'plain'} style={{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,padding:pad,boxSizing:'border-box',background:palette.background,color:palette.foreground,borderTop:`2px solid ${palette.accent}`,fontFamily:FONT}}>
    <div style={{height:headerHeight,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:14,opacity:.8}}>{position}</span>{mark}</div>
    {area.heading?<div style={{height:84,marginTop:12,marginBottom:16,fontSize:area.headingSize,lineHeight:1.4,fontWeight:650,overflowWrap:'anywhere'}}>{caption}</div>:null}
    <div style={{fontSize:size,lineHeight:1.4,marginTop:area.heading?0:12,height:area.height,display:'flex',alignItems:full?'flex-start':'center',fontWeight:layout?.annotationStyle==='editorial'&&!full?650:400,overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{pages[index]}</div>
    {pages.length>1||narrated?<div style={{position:'absolute',bottom:8,left:pad,right:pad,display:'flex',justifyContent:'space-between',fontSize:12,opacity:.75}}><span>{pages.length>1?`${index+1} / ${pages.length}`:''}</span>{narrated?<span>AI NARRATION</span>:null}</div>:null}
  </div>;
};
