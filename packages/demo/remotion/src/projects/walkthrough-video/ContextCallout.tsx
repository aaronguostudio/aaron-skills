import React from 'react';
import {interpolate} from 'remotion';
import type {ContextCallout} from './callouts';

// A compact heading grows only when the first supporting fact arrives.
export function ContextCalloutView({callout:c, ms}:{callout:ContextCallout;ms:number}) {
 const fade=(time:number,start:number,duration:number)=>interpolate(time,[start,start+duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const opacity=fade(ms,c.startMs,450)*(1-fade(ms,c.endMs-400,400));
 const growth=fade(ms,Math.max(c.startMs,c.metrics[0].atMs-650),650);
 const ease=growth*growth*(3-2*growth);
 const targetWidth=Math.max(500,c.box.w*(c.metrics.length/3));
 const width=interpolate(ease,[0,1],[Math.min(targetWidth,Math.max(500,c.box.w*.52)),targetWidth]);
 const header=c.box.h*.42; const height=interpolate(ease,[0,1],[header,c.box.h]);
 return <div style={{position:'absolute',left:c.box.x,top:c.box.y,width,height,boxSizing:'border-box',borderRadius:14,border:'1px solid rgba(143,180,214,.3)',borderLeft:'2px solid rgba(113,180,225,.72)',background:'linear-gradient(110deg,#14243b,#233755)',boxShadow:'0 14px 24px rgba(10,24,42,.24)',opacity,color:'#f6f9ff',fontFamily:'-apple-system, BlinkMacSystemFont, sans-serif',pointerEvents:'none'}}>
   <div style={{padding:'14px 24px 0',whiteSpace:'nowrap'}}><div style={{fontSize:Math.min(30,c.box.h*.15),fontWeight:700,lineHeight:1.15}}>{c.title}</div><div style={{fontSize:Math.min(17,c.box.h*.085),color:'#b7c8db',marginTop:5}}>{c.description}</div></div>
   {ease>.96&&<div style={{position:'absolute',left:24,right:24,top:header,height:1,background:'rgba(152,174,198,.25)'}}/>}
   <div style={{position:'absolute',left:24,right:24,top:header+10,bottom:12,display:'flex'}}>{c.metrics.map((m,i)=><div key={i} style={{flex:1,paddingLeft:i?20:0,borderLeft:i&&ms>=m.atMs?'1px solid rgba(152,174,198,.25)':undefined,opacity:fade(ms,m.atMs,550),transform:`translateY(${(1-fade(ms,m.atMs,550))*6}px)`}}><div style={{fontSize:Math.min(50,c.box.h*.25),fontWeight:700,lineHeight:1.05,fontVariantNumeric:'tabular-nums'}}>{m.value}</div><div style={{fontSize:Math.min(20,c.box.h*.10),color:'#c2d2e2',marginTop:6}}>{m.label}</div></div>)}</div>
 </div>;
}
