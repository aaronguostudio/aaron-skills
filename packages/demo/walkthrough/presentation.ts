import {copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync} from 'fs';
import {createHash} from 'crypto';
import {execFileSync} from 'child_process';
import {dirname, extname, isAbsolute, join, resolve, sep} from 'path';
import {presentationPreset, validatePresentation, validatePresentationFields, type Presentation, type Template} from '../remotion/src/projects/walkthrough-video/presentation/model';
import {contrastRatio, inheritedPalette, logoFor, logoSurfaceBackground, THEMES} from '../remotion/src/projects/walkthrough-video/presentation/theme';
import {getCoverPreset,validateCover} from '../covers/catalog';

import {VIDEO_TREATMENTS} from '../remotion/src/projects/walkthrough-video/presentation/layout';

const COVER_ROOT=resolve(import.meta.dir,'../covers');

export function loadPresentation(template: string | undefined, file: string | undefined, title: string, subtitle: string, coverPreset?:string, layoutPreset?:string): {presentation: Presentation; assetRoot?: string} | undefined {
  if (!template && !file && !coverPreset && !layoutPreset) return undefined;
  let raw = file ? JSON.parse(readFileSync(file, 'utf8')) : {};
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Presentation configuration must be an object');
  // A composition can be chosen without authoring a file. Layout is a version 2
  // field, so a version 1 configuration is refused rather than silently upgraded:
  // its colour, card and caption defaults differ.
  if(layoutPreset!==undefined){
    if(raw.version!==undefined && raw.version!==2) throw Error('A layout preset needs presentation version 2; upgrade the configuration deliberately');
    if(raw.layout?.preset!==undefined && raw.layout.preset!==layoutPreset) throw Error(`The configuration already selects layout ${raw.layout.preset}`);
    raw={...raw, version:2, layout:{...raw.layout, preset:layoutPreset}};
    // Version 2 makes an unresolved logo an explicit choice. Choosing a layout at
    // the command line supplies no brand, so record that omission rather than
    // refuse; a configuration file still has to state its own choice.
    if(!file && raw.brand?.fallback===undefined) raw={...raw, brand:{...raw.brand, fallback:'omit'}};
  }
  const treatment=raw.version===2?VIDEO_TREATMENTS[raw.layout?.preset]:undefined;
  if(treatment)raw={...raw,cover:raw.cover??(raw.theme?.preset&&treatment.cover?{preset:treatment.cover.preset}:treatment.cover),theme:{...(!raw.theme?.preset?treatment.theme:{}),...raw.theme},body:{...treatment.body,...raw.body},intro:{...treatment.intro,...raw.intro},outro:{...treatment.outro,...raw.outro}};
  const preset = presentationPreset((template ?? raw.template ?? 'professional') as Template, title, subtitle);
  validatePresentationFields(raw);
  if(raw.cover!==undefined) validateCover(raw.cover,false);
  let cover=(raw.cover || coverPreset)?{...raw.cover,preset:coverPreset??raw.cover.preset}:undefined;
  if(raw.version===2 && raw.theme?.preset && THEMES[raw.theme.preset as keyof typeof THEMES] && cover){
    const t=THEMES[raw.theme.preset as keyof typeof THEMES];
    cover={...cover,colors:{background:t.coverBackground,foreground:t.coverForeground,accent:t.coverAccent,...cover.colors}};
  }
  const palette=raw.version===2?inheritedPalette({theme:raw.theme,cover}):undefined;
  const presentation: Presentation = {...preset, ...raw, template: template ?? raw.template ?? preset.template,
    ...(cover?{cover}:{}),
    brand: {...preset.brand,...(cover||raw.version===2?{name:'',tagline:''}:{}),...(palette?{primary:palette.background,accent:palette.accent}:{}), ...raw.brand}, intro: {...preset.intro, ...raw.intro},
    outro: {...preset.outro, ...raw.outro}, body: {...preset.body,...(palette?{highlightColor:palette.highlight,cursorColor:raw.theme?.cursor??raw.body?.highlightColor??palette.cursor}:{}), ...raw.body}};
  validatePresentation(presentation);
  const assetRoot = file ? dirname(realpathSync(file)) : undefined;
  for (const asset of [presentation.brand.logo,...Object.values(presentation.brand.logoVariants??{}), presentation.intro.sound]) if (asset) {
    if (!assetRoot) throw Error('Presentation assets need an external configuration file');
    const path = realpathSync(resolve(assetRoot, asset));
    if (!(path.startsWith(assetRoot + sep)) || !existsSync(path)) throw Error('Presentation asset leaves its configuration directory');
  }
  return {presentation, assetRoot};
}

// Read/probe assets before any provider usage. A file extension alone is not media validation.
export type LogoReport={asset:string;sha256:string;width:number;height:number;hasTransparency:boolean;surfaces:{surface:string;background:string;visibleContrastFraction:number}[]};
export function validatePresentationMedia(p:Presentation, root:string|undefined):LogoReport[] {
  const reports:LogoReport[]=[];
  const art=p.cover?getCoverPreset(p.cover.preset).art:undefined;
  const logos=[...new Set([p.brand.logo,...Object.values(p.brand.logoVariants??{})].filter((s):s is string=>!!s))];
  for(const [kind,asset,assetRoot] of [...logos.map(asset=>['video',asset,root] as const),['audio',p.intro.sound,root],['video',art,COVER_ROOT]] as const) if(asset){
    const source=resolve(assetRoot!,asset);
    const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',source],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    if(!info.streams?.some((s:{codec_type:string;width?:number;height?:number})=>s.codec_type===kind&&(kind!=='video'||(s.width!>0&&s.height!>0)))) throw Error('Presentation logo/sound is not valid media');
    if(kind==='video'&&logos.includes(asset)){
      const stream=info.streams.find((s:{codec_type:string})=>s.codec_type==='video');
      if(!['png','mjpeg','webp'].includes(stream.codec_name)||Number(stream.nb_frames??1)>1)throw Error('Logo must be a still PNG, JPEG or WebP image');
      if(stream.width*stream.height>16000000)throw Error('Logo is too large; supply an image under 16 megapixels');
      const rgba=execFileSync('ffmpeg',['-v','error','-i',source,'-frames:v','1','-vf','scale=64:64','-pix_fmt','rgba','-f','rawvideo','-'],{maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
      if(rgba.length!==64*64*4)throw Error('Logo could not be decoded');
      const surfaces:LogoReport['surfaces']=[];let visible=0,transparent=0;
      for(let i=3;i<rgba.length;i+=4){if(rgba[i]>=32)visible++;if(rgba[i]<255)transparent++;}
      if(p.version===2 && !visible)throw Error('Logo is fully transparent');
      if(p.version===2)for(const surface of ['cover','intro','body','outro'] as const){
        if(surface==='body'&&p.body.logoPosition==='none')continue;
        if(surface==='intro'&&!p.intro.enabled||surface==='outro'&&!p.outro.enabled)continue;
        const background=logoSurfaceBackground(p,surface);
        if(logoFor(p,background)!==asset)continue;
        const bg=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16));let distinct=0;
        for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]>=32){
          const alpha=rgba[i+3]/255;
          const pixel='#'+[0,1,2].map(k=>Math.round(rgba[i+k]*alpha+bg[k]*(1-alpha)).toString(16).padStart(2,'0')).join('');
          if(contrastRatio(pixel,background)>=1.5)distinct++;
        }
        const fraction=visible?distinct/visible:0;
        if(fraction<.08)throw Error(`Logo has insufficient visible contrast on ${surface}; use a light/dark variant or brand.logoBackground`);
        surfaces.push({surface,background,visibleContrastFraction:fraction});
      }
      reports.push({asset,sha256:createHash('sha256').update(readFileSync(source)).digest('hex'),width:stream.width,height:stream.height,hasTransparency:transparent>0,surfaces});
    }
    if(kind==='audio'){
      const ms=Number(info.format?.duration)*1000;
      if(!Number.isFinite(ms)||ms<=0||ms>15000) throw Error('An intro sound must be positive and at most 15 seconds');
      p.intro.durationMs=Math.max(p.intro.durationMs,ms);
    }
  }
  return reports;
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
  if(result.brand.logoVariants)for(const key of ['light','dark'] as const){const asset=result.brand.logoVariants[key];if(asset)result.brand.logoVariants[key]=install(asset);}
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
