// Provider-independent scene preparation and evidence validation.
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {FPS, buildTimeline, calibrate, readingMs, validateCapture} from './src/projects/walkthrough-video/timeline';
import {validateBrand} from './src/projects/walkthrough-video/brand/model';
import {validatePresentation} from './src/projects/walkthrough-video/presentation/model';
import {layoutGeometry} from './src/projects/walkthrough-video/presentation/layout';
import {validateCallouts, validateCalloutTiming} from './src/projects/walkthrough-video/callouts';
import type {PreparedComposition, RenderRequest} from './contract';

export function composition(request:RenderRequest):PreparedComposition {
  const options=request.props;
  if(options.branding)validateBrand(options.branding);
  if(options.presentation)validatePresentation(options.presentation);
  if(request.mode==='cover'&&!existsSync(join(request.run,'capture.json'))){
    if(!options.presentation?.cover)throw Error('A standalone cover needs a library preset');
    return {props:{capture:null,steps:[],timeline:null,...options},config:{width:1600,height:900,fps:FPS,durationInFrames:1}};
  }
  // Validate again at the actual render boundary. A caller cannot bypass capture checks.
  const capture=JSON.parse(readFileSync(join(request.run,'capture.json'),'utf8'));
  const raw=JSON.parse(readFileSync(join(request.run,'steps.json'),'utf8'));
  const errors=validateCapture(capture,raw);
  if(errors.length)throw Error('Capture refused: '+errors.join('; '));
  const steps=calibrate(raw,options.calibrationMs??capture.calibrationMs??0);
  const p=options.presentation;
  const timeline=buildTimeline(steps,{minStepMs:(s,i)=>options.stepMinMs?.[i]??readingMs(s.caption),titleMs:options.titleMs,endMs:options.endMs,
    ...(p?{titleBaseMs:p.intro.enabled?p.intro.durationMs:0,endBaseMs:p.outro.enabled?p.outro.durationMs:0}:{})});
  if(options.callouts){validateCallouts(options.callouts,steps,capture.viewport);validateCalloutTiming(options.callouts,steps,timeline);}
  const geometry=layoutGeometry(capture.viewport,p);
  return {props:{...options,capture,steps,timeline},config:{width:request.mode==='cover'&&p?.cover?1600:geometry.width,height:request.mode==='cover'&&p?.cover?900:geometry.height,fps:FPS,durationInFrames:timeline.durationInFrames}};
}
