// The caption band, the annotation panel and the brand mark they share, free of
// Remotion. Only the logo needs a player: Remotion resolves it through staticFile
// and <Img>, while the website's preview passes a plain <img>, the same split
// CoverDesign already uses for its artwork. Keeping these three here lets the
// site build without Remotion in its module graph.
//
// Presentation.tsx re-exports all three bound to Remotion, so the composition and
// the existing tests import them from there unchanged.
import React, {type CSSProperties, type ReactNode} from 'react';
import type {Presentation} from './model';
import {logoFor, paletteFor} from './theme';
import {annotationPages, annotationTextArea, resolveLayout, type Box} from './layout';

export const FONT = "-apple-system, 'Helvetica Neue', Arial, sans-serif";

// Receives the logo path recorded in the presentation, not a resolved URL: only
// the caller knows whether that path needs staticFile.
export type RenderLogo = (logo: string, style: CSSProperties) => ReactNode;
const plainLogo: RenderLogo = (logo, style) => <img src={logo} style={style} />;

export const PresentationLogo: React.FC<{p: Presentation; size: number; background?:string; previewSrc?:string; renderLogo?:RenderLogo}> = ({p, size,background,previewSrc,renderLogo}) => {
  const logo=logoFor(p,p.brand.logoBackground??background??paletteFor(p,'body').background);
  const style:CSSProperties={width: 'auto', height: size, maxWidth: size * 4, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0};
  if(logo)return <span style={{display:'inline-flex',alignItems:'center',flexShrink:0,background:p.brand.logoBackground,padding:p.brand.logoBackground?size*.12:0,borderRadius:size*.1}}>{previewSrc?<img src={previewSrc} style={style}/>:(renderLogo??plainLogo)(logo,style)}</span>;
  if(p.version===2)return p.brand.fallback==='monogram'?<span style={{fontSize:size*.7,lineHeight:1,fontWeight:700}}>{Array.from(p.brand.name)[0]?.toUpperCase()}</span>:null;
  // Version 1 has no explicit monogram choice. Show only a supplied logo/name.
  return null;
};

export const PresentationCaption: React.FC<{p:Presentation; top:number; width:number; caption:string; position:string; narrated:boolean; renderLogo?:RenderLogo}> = ({p,top,width,caption,position,narrated,renderLogo}) => {
  const s=width/1440, minimal=p.template==='minimal';
  const palette=paletteFor(p,'body'),color=palette.foreground;
  const mark=(p.brand.name.trim()||logoFor(p,palette.background))?<div style={{color,display:'flex',alignItems:'center',gap:12*s}}><PresentationLogo p={p} size={38*s} background={palette.background} renderLogo={renderLogo}/>{!p.brand.logoContainsName?<span style={{fontSize:16*s,maxWidth:180*s}}>{p.brand.name}</span>:null}</div>:null;
  return <div style={{position:'absolute',top,left:0,width,height:96,fontFamily:FONT,background:palette.background,color,display:'flex',alignItems:'center',gap:24*s,padding:`0 ${32*s}px`,boxSizing:'border-box',borderTop:`2px solid ${p.brand.accent}`}}>
    {p.body.logoPosition==='left'?mark:null}
    <span style={{fontSize:20*s,opacity:.55,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <span style={{fontSize:32*s,lineHeight:1.18,flex:1}}>{caption}</span>
    {p.body.logoPosition==='right'?mark:null}
    {narrated?<span style={{fontSize:12*s,opacity:.55}}>AI NARRATION</span>:null}
  </div>;
};

export const PresentationAnnotation:React.FC<{p:Presentation;box:Box;caption:string;transcript?:string;position:string;progress:number;narrated:boolean;previewLogoSrc?:string;renderLogo?:RenderLogo}> = ({p,box,caption,transcript,position,progress,narrated,previewLogoSrc,renderLogo})=>{
  const palette=paletteFor(p,'body'),layout=p.layout?resolveLayout(p.layout):undefined,full=layout?.annotationMode==='transcript';
  const pad=20,{pages,size}=annotationPages(p,box,caption,transcript);
  const area=annotationTextArea(p,box,caption,transcript);
  const headerHeight=p.brand.logoBackground?52:40,logoSize=Math.min(40,(box.w-100)/4);
  const index=Math.min(pages.length-1,Math.max(0,Math.floor(progress*pages.length)));
  const hasMark=!!logoFor(p,p.brand.logoBackground??palette.background)||p.brand.fallback==='monogram';
  const mark=p.body.logoPosition!=='none'?<div style={{display:'flex',alignItems:'center',gap:10,order:p.body.logoPosition==='left'?-1:1,maxWidth:box.w-100}}><PresentationLogo p={p} size={logoSize} background={palette.background} previewSrc={previewLogoSrc} renderLogo={renderLogo}/>{!p.brand.logoContainsName&&(!hasMark||box.w>=340)?<span style={{fontSize:box.w<340?12:14,overflowWrap:'anywhere',maxWidth:box.w-100}}>{p.brand.name}</span>:null}</div>:null;
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
