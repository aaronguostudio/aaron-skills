import React, {type CSSProperties, type ReactNode} from 'react';
import {coverColors,getCoverPreset,type CoverSettings} from '../../../covers/catalog';

type ImageProps={src:string;alt:string;style:CSSProperties};
type Props={cover:CoverSettings;title:string;subtitle?:string;brandName?:string;logoSrc?:string;logoBackground?:string;logoContainsName?:boolean;omitFallback?:boolean;artSrc?:string;width:number;height:number;renderImage?:(props:ImageProps)=>ReactNode};
type Box=[number,number,number,number];
const SANS="Arial, 'Helvetica Neue', 'Noto Sans CJK SC', sans-serif";
const SERIF="Georgia, 'Times New Roman', 'Noto Serif CJK SC', serif";

// Native fonts are available synchronously in both the browser and Remotion.
// Measure words rather than character count so long titles and CJK can fit.
export function fitCoverText(text:string,box:Box,family:string,max:number,lineHeight=1.04,tracking=0):number {
  if(!text) return max;
  const context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
  for(let size=max;size>=12;size-=2) {
    if(context) context.font=`700 ${size}px ${family}`;
    const measure=(word:string)=>(context?context.measureText(word).width:Array.from(word).reduce((n,c)=>n+size*(/[\u3000-\uffff]/.test(c)?1:.58),0))+Math.max(0,Array.from(word).length-1)*size*tracking;
    // Shrink to keep Latin words intact before using the emergency character
    // wrap. CJK still wraps naturally; unbounded identifiers may wrap at 12 px.
    if((text.match(/[\p{Script=Latin}\p{N}][\p{Script=Latin}\p{N}'’-]*/gu)??[]).some(word=>measure(word)>box[2]*.97)) continue;
    let lines=0;
    for(const paragraph of text.split('\n')) {
      let line='';lines++;
      for(const token of paragraph.split(/(\s+)/)) {
        const candidate=line+token;
        if(measure(candidate)>box[2]*.97) {
          if(line.trim()) {lines++;line='';}
          if(measure(token)>box[2]*.97) {
            for(const char of Array.from(token)) {
              if(measure(line+char)>box[2]*.97) {lines++;line='';}
              line+=char;
            }
          } else line=token.trimStart();
        } else line=candidate;
      }
    }
    if(lines*size*lineHeight<=box[3]) return size;
  }
  return 12;
}

function geometry(layout:string):{title:Box;subtitle:Box;brand:Box;footer:Box;date:Box;align?:'center';size:number} {
  switch(layout) {
    case 'right': return {title:[810,175,725,430],subtitle:[810,640,725,115],brand:[810,58,725,55],footer:[810,820,420,55],date:[1260,820,275,55],size:140};
    case 'bottom-left': return {title:[64,450,1020,265],subtitle:[64,745,1100,78],brand:[64,52,900,55],footer:[64,840,950,40],date:[1210,840,330,40],size:156};
    case 'bottom-right': return {title:[875,485,650,240],subtitle:[875,745,650,78],brand:[850,52,680,55],footer:[64,840,950,40],date:[1210,840,330,40],size:130};
    case 'banner-top': return {title:[60,92,1480,150],subtitle:[60,245,1480,65],brand:[60,28,1000,40],footer:[60,840,950,40],date:[1210,840,330,40],size:125};
    case 'banner-bottom': return {title:[60,710,1480,100],subtitle:[60,820,880,52],brand:[60,35,1000,45],footer:[990,820,550,30],date:[1100,860,440,30],size:115};
    case 'center-top': return {title:[60,170,1480,220],subtitle:[100,410,1400,70],brand:[60,50,1000,45],footer:[60,840,950,40],date:[1210,840,330,40],align:'center',size:130};
    default:return {title:[64,215,660,390],subtitle:[64,630,660,120],brand:[64,52,660,55],footer:[64,830,600,60],date:[1210,840,330,40],size:138};
  }
}

export function CoverDesign({cover,title,subtitle='',brandName='',logoSrc,logoBackground,logoContainsName=false,omitFallback=false,artSrc,width,height,renderImage}:Props) {
  const preset=getCoverPreset(cover.preset), colors=coverColors(cover),g=geometry(preset.layout);
  if(['chrome-loop','red-balloon'].includes(preset.id)) {g.title[2]=740;g.subtitle[2]=760;}
  if(['ceramic-ribbon','orange-stair','cobalt-coral'].includes(preset.id)) {
    for(const rect of [g.title,g.subtitle,g.brand]) {rect[0]=930;rect[2]=605;}
    g.footer=[930,820,360,55];g.date=[1300,820,235,55];
  }
  if(preset.id==='botanical-shadow') {g.footer[1]=860;g.footer[3]=30;g.date[1]=860;g.date[3]=30;}
  const stackedFooter=['desert-editorial','alpine-silence','black-marble','brushed-copper','concrete-arch','electric-silk','blue-portal'].includes(preset.id);
  if(stackedFooter) {g.footer=[64,810,600,32];g.date=[64,858,600,32];}
  const image=renderImage??((props:ImageProps)=><img {...props}/>);
  const scale=Math.min(width/1600,height/900),font=preset.font==='serif'?SERIF:SANS;
  const box=(rect:Box):CSSProperties=>({position:'absolute',left:rect[0],top:rect[1],width:rect[2],height:rect[3],boxSizing:'border-box'});
  const present=cover.presenter?`Presented by ${cover.presenter}`:'';
  const footerOnAccent=['desert-editorial','botanical-shadow'].includes(preset.id);
  const bright=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.58;};
  const footerColor=footerOnAccent?(bright(colors.accent)?'#151515':'#ffffff'):['ocean-margin','solar-horizon'].includes(preset.id)?'#ffffff':colors.foreground;
  return <div data-cover-preset={preset.id} style={{position:'relative',width,height,overflow:'hidden',background:colors.background,color:colors.foreground}}>
    <div style={{position:'absolute',width:1600,height:900,left:(width-1600*scale)/2,top:(height-900*scale)/2,transform:`scale(${scale})`,transformOrigin:'top left',fontFamily:SANS}}>
      {preset.shape==='cobalt'?<><div style={{position:'absolute',width:1040,height:1040,borderRadius:'50%',background:colors.accent,left:880,top:-530}}/><div style={{position:'absolute',width:205,height:205,background:colors.background,left:1320,top:75}}/></>:null}
      {preset.shape==='aperture'?<><div style={{position:'absolute',left:0,top:30,width:720,height:840,background:colors.accent}}/><div style={{position:'absolute',left:-420,top:60,width:810,height:810,borderRadius:'50%',background:colors.foreground}}/></>:null}
      {preset.shape==='fold'?<div style={{position:'absolute',inset:0,background:colors.accent,clipPath:'polygon(0 78%, 59% 12%, 46% 100%, 0 100%)'}}/>:null}
      {preset.shape==='column'?<div style={{position:'absolute',left:960,top:60,width:400,height:840,background:colors.accent}}/>:null}
      {preset.shape==='contour'?<svg style={{position:'absolute',inset:0}} width="1600" height="900" viewBox="0 0 1600 900" aria-hidden="true"><path d="M600 900C720 530 1180 720 1350 420Q1470 280 1600 330V900Z" fill={colors.secondary??colors.accent}/><path d="M710 900C840 600 1240 755 1400 470Q1490 365 1600 385" fill="none" stroke={colors.background} strokeWidth="2"/></svg>:null}
      {preset.shape==='stripe'?<><div style={{position:'absolute',left:1050,top:100,width:430,height:430,borderRadius:'50%',background:colors.secondary??colors.accent}}/><div style={{position:'absolute',left:820,top:-160,width:250,height:1250,transform:'rotate(-36deg)',background:colors.accent}}/></>:null}
      {footerOnAccent?<div style={{position:'absolute',left:0,top:preset.id==='desert-editorial'?720:845,width:preset.id==='desert-editorial'?675:1600,height:180,background:colors.accent}}/>:null}
      {artSrc?image({src:artSrc,alt:'',style:{position:'absolute',inset:0,width:1600,height:900,objectFit:'fill'}}):null}
      <div style={{...box(g.brand),display:'flex',alignItems:'center',gap:18,color:preset.id==='sand-courtyard'?'#f5f0e7':colors.foreground}}>
        {logoSrc?<span style={{display:'inline-flex',alignItems:'center',background:logoBackground,padding:logoBackground?6:0,borderRadius:5}}>{image({src:logoSrc,alt:brandName||'Logo',style:{width:'auto',height:48,maxWidth:190,objectFit:'contain',flexShrink:0}})}</span>:brandName&&!omitFallback?<span style={{display:'inline-block',width:18,height:18,background:colors.accent,flexShrink:0}}/>:null}
        {brandName&&!logoContainsName?<span data-cover-field="brand" style={{fontSize:fitCoverText(brandName.toUpperCase(),[0,0,g.brand[2]-210,48],SANS,24,1.2,.08),fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',overflowWrap:'anywhere'}}>{brandName}</span>:null}
      </div>
      <div style={{...box(g.title),display:'flex',alignItems:'flex-end',paddingBottom:12}}><div data-cover-field="title" style={{width:'100%',maxHeight:'100%',fontFamily:font,fontSize:fitCoverText(title,[g.title[0],g.title[1],g.title[2],g.title[3]-12],font,g.size,1.02,-.035),fontWeight:700,lineHeight:1.02,letterSpacing:'-.035em',whiteSpace:'pre-wrap',overflowWrap:'anywhere',textAlign:g.align}}>{title}</div></div>
      {subtitle?<div data-cover-field="subtitle" style={{...box(g.subtitle),fontSize:fitCoverText(subtitle,g.subtitle,SANS,34,1.2),lineHeight:1.2,whiteSpace:'pre-wrap',overflowWrap:'anywhere',textAlign:g.align}}>{subtitle}</div>:null}
      {present?<div data-cover-field="presenter" style={{...box(g.footer),fontSize:fitCoverText(present,g.footer,SANS,21,1.2),lineHeight:1.2,color:footerColor,overflowWrap:'anywhere'}}>{present}</div>:null}
      {cover.date?<div data-cover-field="date" style={{...box(g.date),fontSize:fitCoverText(cover.date,g.date,SANS,21,1.2),lineHeight:1.2,color:footerColor,textAlign:stackedFooter?'left':'right',overflowWrap:'anywhere'}}>{cover.date}</div>:null}
    </div>
  </div>;
}
