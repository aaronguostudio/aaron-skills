import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {FrameContext, type FrameConfig} from './frame';
import {WalkthroughVideo, Cover, type Props} from './projects/walkthrough-video';

declare global {
  interface Window {
    __aaron:{props:Props;config:FrameConfig;cover:boolean};
    __aaronSeek:(frame:number)=>Promise<void>;
  }
}
const host=document.getElementById('aaron-scene')!;
// The scene owns media seeking. Isolate its DOM so a backend cannot also
// seek these videos using a second clock.
const shadow=host.attachShadow({mode:'open'});
const style=document.createElement('style');style.textContent='*{box-sizing:border-box}video{display:block}';shadow.append(style);
const surface=document.createElement('div');shadow.append(surface);
const root=createRoot(surface);
const {props,config,cover}=window.__aaron;
const videos=new Map<string,Promise<string>>();
async function mediaReady(video:HTMLVideoElement) {
  // A fully buffered blob is seekable even when a local asset host has no Range
  // support. Cache one copy per source instead of downloading per output frame.
  if(!video.src.startsWith('blob:')) {
    const source=video.src;
    if(!videos.has(source))videos.set(source,fetch(source).then(async response=>{
      if(!response.ok)throw Error(`Recorded video is unavailable (${response.status})`);
      return URL.createObjectURL(await response.blob());
    }));
    video.src=await videos.get(source)!;
  }
  await new Promise<void>((resolve,reject)=>{
    if(video.readyState>=2)return resolve();
    const timer=setTimeout(()=>done(Error('Video decoding timed out')),30000);
    const done=(error?:Error)=>{clearTimeout(timer);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);error?reject(error):resolve();};
    const loaded=()=>done(),failed=()=>done(Error('Cannot decode recorded video'));
    video.addEventListener('loadeddata',loaded,{once:true});video.addEventListener('error',failed,{once:true});
    if(video.error)failed();
  });
  const time=Math.max(0,Math.min(Number(video.dataset.sourceTime),Math.max(0,video.duration-0.0001)));
  if(Math.abs(video.currentTime-time)>0.00001)await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>done(Error(`Video seek timed out at ${time}`)),30000);
    const done=(error?:Error)=>{clearTimeout(timer);video.removeEventListener('seeked',seeked);video.removeEventListener('error',failed);error?reject(error):resolve();};
    const seeked=()=>done(),failed=()=>done(Error('Video seek failed'));
    video.addEventListener('seeked',seeked,{once:true});video.addEventListener('error',failed,{once:true});video.currentTime=time;
  });
}
window.__aaronSeek=async frame=>{
  frame=Math.min(config.durationInFrames-1,Math.max(0,Math.round(frame)));
  flushSync(()=>root.render(<FrameContext.Provider value={{frame,offset:0,config}}>{cover?<Cover {...props}/>:<WalkthroughVideo {...props}/>}</FrameContext.Provider>));
  await document.fonts.ready;
  await Promise.all([...surface.querySelectorAll('img')].map(img=>img.decode()));
  await Promise.all([...surface.querySelectorAll('video')].map(mediaReady));
};
export const frameSource={
  element:host,
  config,
  ready:window.__aaronSeek(0),
  render:window.__aaronSeek,
};
