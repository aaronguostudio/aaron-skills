import {coverColors,validateCover,type CoverSettings} from '../../../../../covers/catalog';
import {contrastRatio, paletteFor} from './theme';
import {validateLayout, type ScreenLayout} from './layout';
import {validateCamera, type CameraSettings} from './camera';
export const TEMPLATES = ['minimal', 'professional', 'showcase'] as const;
export type Template = typeof TEMPLATES[number];
export type Presentation = {
  version: 1 | 2;
  template: Template;
  title: string;
  subtitle: string;
  cover?: CoverSettings;
  theme?: {preset?: 'blue-lavender' | 'neutral'; background?: string; foreground?: string; accent?: string; highlight?: string; cursor?: string};
  layout?: ScreenLayout;
  camera?: CameraSettings;
  brand: {name: string; tagline: string; primary: string; accent: string; logo?: string;
    logoVariants?: {light?: string; dark?: string}; logoContainsName?: boolean; logoBackground?: string;
    logoProvenance?: {source: string; role: 'corporate' | 'product'; verified: boolean}; fallback?: 'omit' | 'monogram'};
  intro: {enabled: boolean; durationMs: number; sound?: string; soundPreset:'none'|'soft'|'bright'; volume: number; background?: string; foreground?: string};
  outro: {enabled: boolean; durationMs: number; title: string; subtitle: string; url: string; background?: string; foreground?: string};
  body: {logoPosition: 'left' | 'right' | 'none'; highlightColor: string; cursorColor?: string; background?: string; foreground?: string};
};

export function presentationPreset(template: Template, title: string, subtitle = ''): Presentation {
  if (!TEMPLATES.includes(template)) throw Error(`Unknown presentation template: ${template}`);
  return {
    version: 1, template, title, subtitle,
    brand: {name: '', tagline: 'A closer look.', primary: '#153F3B', accent: '#A7F3CE'},
    intro: {enabled: true, durationMs: template === 'minimal' ? 1400 : 3000, soundPreset:template==='minimal'?'none':template==='professional'?'soft':'bright', volume: 0.35},
    outro: {enabled: true, durationMs: template === 'minimal' ? 1400 : 2400, title: 'Thanks for watching.', subtitle: 'Explore the workflow at your own pace.', url: ''},
    body: {logoPosition: template === 'minimal' ? 'none' : 'right', highlightColor: '#E3A900'},
  };
}

export function validatePresentation(value: unknown, localAssets = true): asserts value is Presentation {
  const p = value as Presentation;
  const text = (s: unknown, max: number, required = false) => typeof s === 'string' && s.length <= max && (!required || !!s.trim());
  const color = (s: unknown) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  if (![1,2].includes(p?.version) || !TEMPLATES.includes(p.template)) throw Error('Presentation version/template is invalid');
  validatePresentationFields(p);
  if (p.cover !== undefined) validateCover(p.cover);
  if (!text(p.title, 100, true) || !text(p.subtitle, 160) || !text(p.brand?.name, 40, p.brand?.fallback==='monogram') || !text(p.brand?.tagline, 100)) throw Error('Presentation title/brand text is invalid or too long');
  if (!color(p.brand.primary) || !color(p.brand.accent) || !color(p.body?.highlightColor)) throw Error('Presentation colors must be six-digit hex colors');
  if (!['left', 'right', 'none'].includes(p.body.logoPosition)) throw Error('Body logoPosition must be left, right or none');
  if(p.version===2){
    validateLayout(p.layout);
    validateCamera(p.camera);
    if(p.cover){const colors=coverColors(p.cover);if(contrastRatio(colors.background,colors.foreground)<4.5)throw Error('Cover text contrast must be at least 4.5:1; adjust cover.colors');}
    if(p.theme?.preset!==undefined && !['blue-lavender','neutral'].includes(p.theme.preset))throw Error('Unknown presentation theme preset');
    for(const surface of ['intro','body','outro'] as const){
      for(const c of [p[surface].background,p[surface].foreground])if(c!==undefined&&!color(c))throw Error('Theme colors must be six-digit hex colors');
      const palette=paletteFor(p,surface);
      if(contrastRatio(palette.background,palette.foreground)<4.5)throw Error(`Presentation ${surface} text contrast must be at least 4.5:1`);
    }
    for(const [key,c] of Object.entries(p.theme??{}))if(key!=='preset'&&!color(c))throw Error('Theme colors must be six-digit hex colors');
    for(const c of [p.body.cursorColor,p.brand.logoBackground])if(c!==undefined&&!color(c))throw Error('Theme colors must be six-digit hex colors');
    const hasLogo=!!(p.brand.logo||p.brand.logoVariants?.light||p.brand.logoVariants?.dark);
    if(hasLogo){
      const source=p.brand.logoProvenance;
      if(!source || !text(source.source,512,true) || !['corporate','product'].includes(source.role) || source.verified!==true)throw Error('A logo needs verified corporate/product provenance; an avatar is not a corporate logo');
    } else if(!['omit','monogram'].includes(p.brand.fallback??''))throw Error('Unresolved logo: explicitly choose brand.fallback omit or monogram');
    if(p.brand.fallback!==undefined&&!['omit','monogram'].includes(p.brand.fallback))throw Error('Unknown logo fallback');
    if(p.brand.logoContainsName!==undefined&&typeof p.brand.logoContainsName!=='boolean')throw Error('logoContainsName must be boolean');
  }
  for (const card of [p.intro, p.outro]) {
    if (typeof card?.enabled !== 'boolean' || !Number.isFinite(card.durationMs) || card.durationMs < 500 || card.durationMs > 15000) throw Error('Card durationMs must be between 500 and 15000');
  }
  if (!Number.isFinite(p.intro.volume) || p.intro.volume < 0 || p.intro.volume > 1) throw Error('Intro volume must be between 0 and 1');
  if (!['none','soft','bright'].includes(p.intro.soundPreset)) throw Error('Unknown intro soundPreset');
  if (!text(p.outro.title, 100, true) || !text(p.outro.subtitle, 160) || !text(p.outro.url, 120)) throw Error('Outro text is invalid or too long');
  const logos=[p.brand.logo,p.brand.logoVariants?.light,p.brand.logoVariants?.dark];
  for (const asset of [...logos, p.intro.sound]) {
    if (asset !== undefined && (!text(asset, 1024, true) || (localAssets && (/^(\/|[a-z]+:)/i.test(asset) || asset.split(/[\\/]/).includes('..') || asset.includes('\\'))))) throw Error('Presentation assets must be local files, never URLs or traversal paths');
  }
  for(const logo of logos)if (logo && !/\.(png|jpe?g|webp)$/i.test(logo)) throw Error('Logo must be a PNG, JPEG or WebP image');
  if (p.intro.sound && !/\.(wav|mp3|m4a)$/i.test(p.intro.sound)) throw Error('Intro sound must be WAV, MP3 or M4A');
  if (!p.intro.enabled && p.intro.sound) throw Error('A disabled intro cannot have a sound');
}

// Shared by partial file loading and the final Remotion entry point.
export function validatePresentationFields(raw: Record<string, unknown> | Presentation): void {
  const object=(value:unknown,keys:string[],label:string)=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error(`Unknown or invalid presentation ${label} field`);
  };
  object(raw,['version','template','title','subtitle','brand','intro','outro','body','cover','theme','layout','camera'],'configuration');
  const extra=raw.version===2;
  if(!extra && (raw.theme!==undefined||raw.layout!==undefined||raw.camera!==undefined))throw Error('Theme, layout and camera require presentation version 2');
  const fields={brand:['name','tagline','primary','accent','logo',...(extra?['logoVariants','logoContainsName','logoProvenance','logoBackground','fallback']:[])],intro:['enabled','durationMs','sound','soundPreset','volume',...(extra?['background','foreground']:[])],outro:['enabled','durationMs','title','subtitle','url',...(extra?['background','foreground']:[])],body:['logoPosition','highlightColor',...(extra?['background','foreground','cursorColor']:[])]};
  for(const [key,allowed] of Object.entries(fields)){const value=(raw as Record<string,unknown>)[key];if(value!==undefined)object(value,allowed,key);}
  const brand=raw.brand as Presentation['brand']|undefined;
  if(brand?.logoVariants!==undefined)object(brand.logoVariants,['light','dark'],'logoVariants');
  if(brand?.logoProvenance!==undefined)object(brand.logoProvenance,['source','role','verified'],'logoProvenance');
  if(raw.theme!==undefined)object(raw.theme,['preset','background','foreground','accent','highlight','cursor'],'theme');
  if(raw.layout!==undefined)validateLayout(raw.layout);
}
