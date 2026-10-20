import {copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync} from 'fs';
import {createHash} from 'crypto';
import {execFileSync} from 'child_process';
import {dirname, extname, isAbsolute, join, resolve, sep} from 'path';
import {presentationPreset, validatePresentation, type Presentation, type Template} from '../remotion/src/projects/walkthrough-video/presentation/model';
import {getCoverPreset,validateCover} from '../covers/catalog';

const COVER_ROOT=resolve(import.meta.dir,'../covers');

export function loadPresentation(template: string | undefined, file: string | undefined, title: string, subtitle: string, coverPreset?:string): {presentation: Presentation; assetRoot?: string} | undefined {
  if (!template && !file && !coverPreset) return undefined;
  const raw = file ? JSON.parse(readFileSync(file, 'utf8')) : {};
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Presentation configuration must be an object');
  const preset = presentationPreset((template ?? raw.template ?? 'professional') as Template, title, subtitle);
  const known = ['version', 'template', 'title', 'subtitle', 'brand', 'intro', 'outro', 'body', 'cover'];
  if (Object.keys(raw).some(k => !known.includes(k))) throw Error('Unknown presentation configuration field');
  const fields:Record<string,string[]>={brand:['name','tagline','primary','accent','logo'],intro:['enabled','durationMs','sound','soundPreset','volume'],outro:['enabled','durationMs','title','subtitle','url'],body:['logoPosition','highlightColor']};
  for(const [key,allowed] of Object.entries(fields)) if(raw[key]!==undefined && (!raw[key] || typeof raw[key]!=='object' || Array.isArray(raw[key]) || Object.keys(raw[key]).some(k=>!allowed.includes(k)))) throw Error(`Unknown or invalid presentation ${key} field`);
  if(raw.cover!==undefined) validateCover(raw.cover,false);
  const cover=(raw.cover || coverPreset)?{...raw.cover,preset:coverPreset??raw.cover.preset}:undefined;
  const presentation: Presentation = {...preset, ...raw, template: template ?? raw.template ?? preset.template,
    ...(cover?{cover}:{}),
    brand: {...preset.brand,...(cover?{name:'',tagline:''}:{}), ...raw.brand}, intro: {...preset.intro, ...raw.intro},
    outro: {...preset.outro, ...raw.outro}, body: {...preset.body, ...raw.body}};
  validatePresentation(presentation);
  const assetRoot = file ? dirname(realpathSync(file)) : undefined;
  for (const asset of [presentation.brand.logo, presentation.intro.sound]) if (asset) {
    if (!assetRoot) throw Error('Presentation assets need an external configuration file');
    const path = realpathSync(resolve(assetRoot, asset));
    if (!(path.startsWith(assetRoot + sep)) || !existsSync(path)) throw Error('Presentation asset leaves its configuration directory');
  }
  return {presentation, assetRoot};
}

// Read/probe assets before any provider usage. A file extension alone is not media validation.
export function validatePresentationMedia(p:Presentation, root:string|undefined):void {
  const art=p.cover?getCoverPreset(p.cover.preset).art:undefined;
  for(const [kind,asset,assetRoot] of [['video',p.brand.logo,root],['audio',p.intro.sound,root],['video',art,COVER_ROOT]] as const) if(asset){
    const source=resolve(assetRoot!,asset);
    const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',source],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    if(!info.streams?.some((s:{codec_type:string;width?:number;height?:number})=>s.codec_type===kind&&(kind!=='video'||(s.width!>0&&s.height!>0)))) throw Error('Presentation logo/sound is not valid media');
    if(kind==='audio'){
      const ms=Number(info.format?.duration)*1000;
      if(!Number.isFinite(ms)||ms<=0||ms>15000) throw Error('An intro sound must be positive and at most 15 seconds');
      p.intro.durationMs=Math.max(p.intro.durationMs,ms);
    }
  }
}

export function installPresentation(p: Presentation, root: string | undefined, run: string): Presentation {
  const result = structuredClone(p);
  const install = (asset: string,assetRoot=root) => {
    if (!assetRoot || isAbsolute(asset)) throw Error('Presentation asset needs a local configuration directory');
    const source = realpathSync(resolve(assetRoot, asset));
    if (!source.startsWith(realpathSync(assetRoot) + sep)) throw Error('Presentation asset leaves its configuration directory');
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 16);
    const local = `presentation-assets/${hash}${extname(source).toLowerCase()}`;
    mkdirSync(join(run, 'presentation-assets'), {recursive: true});
    copyFileSync(source, join(run, local));
    return local;
  };
  if (result.brand.logo) result.brand.logo = install(result.brand.logo);
  if (result.cover) {
    const art=getCoverPreset(result.cover.preset).art;
    if(art) result.cover.art=install(art,COVER_ROOT);
  }
  if (result.intro.sound) result.intro.sound = install(result.intro.sound);
  else if (result.intro.enabled && result.intro.soundPreset!=='none') {
    const seconds=Math.min(2.8,result.intro.durationMs/1000);
    const generator=join(import.meta.dir,'make-brand-sound.py');
    const options=['--seconds',String(seconds),'--key',result.intro.soundPreset==='soft'?'F3':'C4','--brightness',result.intro.soundPreset==='soft'?'0.65':'0.95'];
    const hash=createHash('sha256').update(readFileSync(generator)).update(JSON.stringify(options)).digest('hex').slice(0,16);
    const local=`presentation-assets/sting-${hash}.wav`;
    mkdirSync(join(run,'presentation-assets'),{recursive:true});
    if(!existsSync(join(run,local))) execFileSync(process.platform==='win32'?'python':'python3',[generator,join(run,local),...options],{stdio:'pipe'});
    result.intro.sound=local;
  }
  validatePresentation(result);
  return result;
}
