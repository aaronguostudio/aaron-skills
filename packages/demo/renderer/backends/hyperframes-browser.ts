// Only this bridge knows HyperFrames' browser API. The authored scene remains
// seekable by frame number for another backend without changing its components.
import {frameSource} from '../src/browser';

declare global {
  interface Window {
    __hyperframes:{registerFrameSource:(source:{
      element:Element;
      ready:Promise<void>;
      render:(time:number,signal:AbortSignal)=>Promise<void>;
    })=>()=>void};
  }
}

window.__hyperframes.registerFrameSource({
  element:frameSource.element,
  ready:frameSource.ready,
  render:async(time,signal)=>{
    if(signal.aborted)throw signal.reason;
    await frameSource.render(Math.round(time*frameSource.config.fps));
  },
});
