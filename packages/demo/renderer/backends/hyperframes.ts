// HyperFrames is an implementation detail of the local renderer contract.
import {execFileSync, spawn} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, extname, join, relative, resolve, sep} from 'node:path';
import type {Props} from '../src/projects/walkthrough-video';
import {BRAND_STING_LEAD_MS, FPS} from '../src/projects/walkthrough-video/timeline';
import type {FrameConfig, PreparedComposition, RenderBackend, RenderRequest} from '../contract';
import {privateDirectory} from '../../capture/scripts/platform.mjs';

const RUNTIME=resolve(import.meta.dir,'..');
const require=createRequire(join(RUNTIME,'package.json'));
const captureRequire=createRequire(join(RUNTIME,'../capture/package.json'));
const HYPERFRAMES={id:'hyperframes',version:'0.8.223',contract:1} as const;

function htmlEscape(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function copyAssets(run:string,workspace:string,props:Props) {
  const root=realpathSync(run),files=new Set<string>(['video.webm']);
  const visit=(value:unknown)=>{
    if(typeof value==='string'&&value&&!value.includes('\0')&&!value.includes('://')) {
      const source=resolve(root,value),rel=relative(root,source);
      if(rel&&!rel.startsWith('..')&&!rel.startsWith(sep)&&existsSync(source)) {
        // Only files referenced by the composition; never copy session state or an entire run.
        try {if(realpathSync(source)===root||!realpathSync(source).startsWith(root+sep))throw Error('Asset escapes capture');
          if(/\.(png|webp|jpe?g|svg|webm|mp4|mp3|wav|m4a|ogg)$/i.test(rel))files.add(rel);
        }catch(error){throw Error(`Invalid render asset: ${value}`,{cause:error});}
      }
    } else if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  visit(props);
  for(const file of files){
    const source=join(root,file);if(!existsSync(source))continue;
    if(!realpathSync(source).startsWith(root+sep))throw Error(`Asset escapes capture: ${file}`);
    const out=join(workspace,'assets',file);mkdirSync(dirname(out),{recursive:true});copyFileSync(source,out);
  }
}
function audioMarkup(props:Props,config:FrameConfig,run:string):string {
  const clips:{file:string;start:number;duration:number;volume:number}[]=[];
  const timeline=props.timeline;
  if(!timeline)return '';
  const sound=props.presentation?.intro.sound??props.branding?.sound;
  if(sound&&timeline.titleFrames>0){
    const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',join(run,sound)],{encoding:'utf8'}));
    if(!Number.isFinite(seconds)||seconds<=0)throw Error('Opening sound has no measurable duration');
    clips.push({file:sound,start:0,duration:Math.min(seconds,timeline.titleFrames/FPS),volume:props.presentation?.intro.volume??1});
  }
  for(const clip of props.narration??[]){
    const frame=clip.at==='intro'?(sound?Math.round(BRAND_STING_LEAD_MS*FPS/1000):0):clip.at==='outro'?timeline.titleFrames+timeline.videoFrames:timeline.segments.find(s=>s.step===clip.at)?.fromFrame;
    if(frame!==undefined)clips.push({file:clip.file,start:frame/FPS,duration:clip.ms/1000,volume:1});
  }
  return clips.map((c,i)=>`<audio id="audio-${i}" src="assets/${htmlEscape(c.file)}" data-start="${c.start}" data-duration="${Math.min(c.duration,config.durationInFrames/FPS-c.start)}" data-track-index="${i+1}" data-volume="${c.volume}"></audio>`).join('\n');
}
export function writeProject(request:RenderRequest,workspace:string,resolved:PreparedComposition) {
  const {props,config}=resolved;
  copyAssets(request.run,workspace,props);
  const {buildSync}=require('esbuild');
  buildSync({entryPoints:[join(RUNTIME,'backends/hyperframes-browser.ts')],bundle:true,platform:'browser',format:'iife',outfile:join(workspace,'scene.js'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  const json=JSON.stringify({props,config,cover:request.mode==='cover'}).replace(/</g,'\\u003c');
  writeFileSync(join(workspace,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${config.width}px;height:${config.height}px;overflow:hidden;background:#10151c}*{box-sizing:border-box}</style></head><body>
<main id="root" data-composition-id="aaron-film" data-start="0" data-duration="${config.durationInFrames/config.fps}" data-width="${config.width}" data-height="${config.height}" data-fps="${config.fps}" data-no-timeline>
<div id="aaron-scene" data-composition-id="aaron-scene" data-start="0" data-duration="${config.durationInFrames/config.fps}" data-track-index="0" data-no-timeline style="position:absolute;inset:0"></div>
${request.mode==='video'?audioMarkup(props,config,request.run):''}</main>
<script>window.__aaron=${json};</script><script src="scene.js"></script></body></html>`);
  return resolved;
}
export function browserPath():string {return captureRequire('playwright').chromium.executablePath();}
export async function snapshot(workspace:string,out:string,frame:number,config:FrameConfig) {
  const {chromium}=captureRequire('playwright');
  const server=createServer((req,res)=>{
    try {
      const file=resolve(workspace,'.'+decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname));
      if(!file.startsWith(workspace+sep)&&file!==workspace){res.writeHead(403);res.end();return;}
      const target=file===workspace?join(file,'index.html'):file.endsWith(sep+'runtime.js')?join(RUNTIME,'node_modules/hyperframes/dist/hyperframe.runtime.iife.js'):file;
      const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.webm':'video/webm','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
      // Match HyperFrames' own server: exactly one runtime, before authored JS.
      const bytes=target.endsWith('index.html')?Buffer.from(readFileSync(target,'utf8').replace('<head>','<head><script src="/runtime.js"></script>')):readFileSync(target);
      res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');
      res.setHeader('Content-Length',bytes.length);res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  let browser;
  try {
    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:1});
    // All render assets are local. Composition code cannot reach outside services.
    await page.route('**/*',(route:any)=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}/`,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof (window as any).__player?.renderSeek==='function'&&typeof (window as any).__hfWaitForSeekCompletion==='function'&&(window as any).__renderReady===true);
    // Use the runtime's clock and barrier, as video export does. A direct scene
    // seek can race the runtime's queued initial frame and export a blank title.
    await page.evaluate(async(time:number)=>{
      (window as any).__player.renderSeek(time,{exact:true});
      await (window as any).__hfWaitForSeekCompletion({videoFrames:true});
      await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));
    },Math.min(config.durationInFrames-1,Math.max(0,Math.round(frame)))/config.fps);
    if(errors.length)throw Error(errors.join('; '));
    await page.screenshot({path:out});
  }finally{if(browser)await browser.close();await new Promise<void>(done=>server.close(()=>done()));}
}
async function render(request:RenderRequest,scene:PreparedComposition) {
  const workspace=mkdtempSync(join(tmpdir(),'aaron-film-'));
  try {
    if(process.platform==='win32')await privateDirectory(workspace);
    const installed=require('hyperframes/package.json').version;
    if(installed!==HYPERFRAMES.version)throw Error(`Expected HyperFrames ${HYPERFRAMES.version}, found ${installed}`);
    const resolved=writeProject(request,workspace,scene);
    if(request.mode!=='video')await snapshot(workspace,request.out,request.frame??0,resolved.config);
    else await new Promise<void>((done,reject)=>{
      const command=join(RUNTIME,'node_modules/hyperframes/bin/hyperframes.mjs');
      let diagnostics='';
      const child=spawn('node',[command,'render',workspace,'--output',request.out,'--fps',String(FPS),'--workers','1','--crf','20','--no-best-effort','--experimental-fast-capture=false','--no-browser-gpu','--quiet'],{
        cwd:workspace,stdio:['ignore','pipe','pipe'],timeout:15*60*1000,env:{...process.env,HYPERFRAMES_BROWSER_PATH:browserPath(),HYPERFRAMES_NO_TELEMETRY:'1',DO_NOT_TRACK:'1'}});
      const collect=(data:Buffer)=>{diagnostics=(diagnostics+data.toString()).slice(-8000);};
      child.stdout.on('data',collect);child.stderr.on('data',collect);
      child.once('error',reject);child.once('close',(code,signal)=>code===0?done():reject(Error(`HyperFrames render failed (${signal??code})\n${diagnostics}`)));
    });
  }finally{rmSync(workspace,{recursive:true,force:true});}
}

export const hyperframesBackend:RenderBackend={info:HYPERFRAMES,render};
