// Aaron Skills' frame contract. Animation depends on frame numbers, never a playback clock.
// Independently implemented primitives used by our existing authored compositions.
import React, {createContext, useContext} from 'react';

export type {FrameConfig} from '../contract';
export const FrameContext=createContext({frame:0, offset:0, config:{width:1440,height:996,fps:30,durationInFrames:1}});
export const useCurrentFrame=()=>useContext(FrameContext).frame;
export const useVideoConfig=()=>useContext(FrameContext).config;
export const staticFile=(file:string)=>'assets/'+file.split('/').map(encodeURIComponent).join('/');
export const AbsoluteFill:React.FC<React.HTMLAttributes<HTMLDivElement>>=({style,...props})=><div {...props} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',...style}}/>;
export const Img:React.FC<React.ImgHTMLAttributes<HTMLImageElement>>=props=><img {...props}/>;
// Audio is declared once in the exported composition document, where the backend can mix it.
export const Audio:React.FC<{src:string;volume?:number}>=()=>null;
export const Sequence:React.FC<{from?:number;durationInFrames?:number;children:React.ReactNode}>=({from=0,durationInFrames=Infinity,children})=>{
  const parent=useContext(FrameContext),frame=parent.frame-from;
  return frame<0||frame>=durationInFrames?null:<FrameContext.Provider value={{...parent,frame,offset:parent.offset+from}}>{children}</FrameContext.Provider>;
};
export const Freeze:React.FC<{frame:number;children:React.ReactNode}>=({frame,children})=>{
  const parent=useContext(FrameContext);
  return <FrameContext.Provider value={{...parent,frame}}>{children}</FrameContext.Provider>;
};
export const SourceVideo:React.FC<{src:string;trimBefore?:number;playbackRate?:number;muted?:boolean;style?:React.CSSProperties}>=({src,trimBefore=0,playbackRate=1,style})=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig();
  return <video src={src} muted playsInline preload="auto" data-source-time={(trimBefore+frame*playbackRate)/fps} style={style}/>;
};
export function interpolate(value:number,input:number[],output:number[],options:{extrapolateLeft?:string;extrapolateRight?:string;easing?:(t:number)=>number}={}) {
  if(input.length!==output.length||input.length<2)throw Error('Interpolation needs matching ranges');
  let i=0;while(i<input.length-2&&value>input[i+1])i++;
  let t=(value-input[i])/(input[i+1]-input[i]);
  if(options.extrapolateLeft==='clamp'&&value<input[0])t=0;
  if(options.extrapolateRight==='clamp'&&value>input.at(-1)!)t=1;
  return output[i]+(output[i+1]-output[i])*(options.easing?.(t)??t);
}
export const Easing={bezier:(x1:number,y1:number,x2:number,y2:number)=>(x:number)=>{
  const at=(t:number,a:number,b:number)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let lo=0,hi=1;
  for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(at(mid,x1,x2)<x)lo=mid;else hi=mid;}
  return at((lo+hi)/2,y1,y2);
}};
