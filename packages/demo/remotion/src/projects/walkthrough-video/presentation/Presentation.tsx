import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Presentation} from './model';
import {CoverDesign} from '../../../cover-library/CoverDesign';

const FONT = "-apple-system, 'Helvetica Neue', Arial, sans-serif";

export const PresentationLogo: React.FC<{p: Presentation; size: number}> = ({p, size}) => p.brand.logo
  ? <Img src={staticFile(p.brand.logo)} style={{width: 'auto', height: size, maxWidth: size * 4, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0}} />
  : <svg width={size} height={size} viewBox="0 0 64 64" aria-label={p.brand.name}>
      <rect width="64" height="64" rx="18" fill="currentColor" opacity="0.12" />
      <path d="M16 45 29 18h7l13 27H39l-3-7H26l-3 7Zm13-15h4l-2-5Z" fill="currentColor" />
    </svg>;

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
  const ink = minimal ? p.brand.primary : '#F4F5EF';
  const accent = minimal ? p.brand.primary : p.brand.accent;
  const title = closing ? p.outro.title : p.title;
  const subtitle = closing ? p.outro.subtitle : p.subtitle;
  if (p.cover && !closing) return <AbsoluteFill style={{opacity:exit}}>
    {!cover && p.intro.sound ? <Audio src={staticFile(p.intro.sound)} volume={p.intro.volume}/> : null}
    <CoverDesign cover={p.cover} title={title} subtitle={subtitle} brandName={p.brand.name}
      logoSrc={p.brand.logo?staticFile(p.brand.logo):undefined} artSrc={p.cover.art?staticFile(p.cover.art):undefined}
      width={width} height={height} renderImage={props=><Img {...props}/>}/>
  </AbsoluteFill>;
  return <AbsoluteFill style={{fontFamily:FONT, background:minimal?'#F1F1E9':showcase?'#101C29':p.brand.primary, color:ink, opacity:exit, overflow:'hidden'}}>
    {!cover && !closing && p.intro.sound ? <Audio src={staticFile(p.intro.sound)} volume={p.intro.volume} /> : null}
    {showcase ? <>
      <div style={{position:'absolute',width:width*.8,height:width*.8,right:-width*.22,top:-height*.48,borderRadius:'50%',background:`radial-gradient(circle at 40% 45%, ${p.brand.accent} 0%, ${p.brand.primary} 45%, transparent 68%)`,opacity:.65,transform:`translateY(${(1-ease)*24}px)`}} />
      <svg width={width} height={height} style={{position:'absolute',opacity:.22}} aria-hidden="true">
        {[0,1,2,3,4,5].map(i=><ellipse key={i} cx={width*.88} cy={height*.26} rx={width*(.23+i*.065)} ry={height*(.19+i*.055)} fill="none" stroke={p.brand.accent} strokeWidth={1} transform={`rotate(-23 ${width*.88} ${height*.26})`} />)}
      </svg>
    </> : !minimal ? <div style={{position:'absolute',inset:0,opacity:.12,backgroundImage:'linear-gradient(#ffffff30 1px, transparent 1px), linear-gradient(90deg, #ffffff30 1px, transparent 1px)',backgroundSize:`${72*s}px ${72*s}px`}} /> : null}
    <div style={{position:'absolute',left:80*s,right:80*s,top:65*s,display:'flex',alignItems:'center',gap:18*s,color:ink}}>
      <div style={{opacity:ease,transform:`translateY(${(1-ease)*12}px)`}}><PresentationLogo p={p} size={54*s}/></div>
      <div style={{fontSize:25*s,fontWeight:650,letterSpacing:-.5*s}}>{p.brand.name}</div>
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
  const color=minimal?p.brand.primary:'#F4F5EF';
  const mark=<div style={{color,display:'flex',alignItems:'center',gap:12*s}}><PresentationLogo p={p} size={38*s}/><span style={{fontSize:16*s,maxWidth:180*s}}>{p.brand.name}</span></div>;
  return <div style={{position:'absolute',top,left:0,width,height:96,fontFamily:FONT,background:minimal?'#F1F1E9':p.template==='showcase'?'#101C29':p.brand.primary,color,display:'flex',alignItems:'center',gap:24*s,padding:`0 ${32*s}px`,boxSizing:'border-box',borderTop:`2px solid ${p.brand.accent}`}}>
    {p.body.logoPosition==='left'?mark:null}
    <span style={{fontSize:20*s,opacity:.55,fontVariantNumeric:'tabular-nums'}}>{position}</span>
    <span style={{fontSize:32*s,lineHeight:1.18,flex:1}}>{caption}</span>
    {p.body.logoPosition==='right'?mark:null}
    {narrated?<span style={{fontSize:12*s,opacity:.55}}>AI NARRATION</span>:null}
  </div>;
};
