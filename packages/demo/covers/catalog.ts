import data from './presets.json';

export type CoverColors = {background:string; foreground:string; accent:string; secondary?:string};
export type CoverSettings = {preset:string; presenter?:string; date?:string; colors?:Partial<CoverColors>; art?:string};
export type CoverPreset = {
  id:string; title:{en:string;zh:string}; family:string; familyTitle:{en:string;zh:string};
  layout:'left'|'right'|'bottom-left'|'bottom-right'|'banner-top'|'banner-bottom'|'center-top';
  colors:CoverColors; font:'sans'|'serif'; shape?:string; art?:string; preview:string;
};
export const coverPresets = data as CoverPreset[];

export function getCoverPreset(id:string):CoverPreset {
  const preset=coverPresets.find(item=>item.id===id);
  if(!preset) throw Error(`Unknown cover preset: ${id}. Run aaron-demo cover --list.`);
  return preset;
}

export function coverColors(cover:CoverSettings):CoverColors {
  return {...getCoverPreset(cover.preset).colors,...cover.colors};
}

export function validateCover(value:unknown, installed=true):asserts value is CoverSettings {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('Cover configuration must be an object');
  const cover=value as CoverSettings;
  const fields=['preset','presenter','date','colors',...(installed?['art']:[])];
  if(Object.keys(value).some(key=>!fields.includes(key))) throw Error('Unknown cover configuration field');
  if(typeof cover.preset!=='string') throw Error('Cover needs a preset ID');
  getCoverPreset(cover.preset);
  for(const [key,max] of [['presenter',80],['date',48]] as const) {
    if(cover[key]!==undefined && (typeof cover[key]!=='string' || cover[key]!.length>max)) throw Error(`Cover ${key} is invalid or too long`);
  }
  if(cover.colors!==undefined) {
    if(!cover.colors || typeof cover.colors!=='object' || Array.isArray(cover.colors) || Object.entries(cover.colors).some(([key,color])=>!['background','foreground','accent','secondary'].includes(key)||typeof color!=='string'||!/^#[a-f0-9]{6}$/i.test(color))) throw Error('Cover colors must use background/foreground/accent/secondary six-digit hex colors');
  }
  if(cover.art!==undefined && (typeof cover.art!=='string' || !/\.(png|webp)$/i.test(cover.art) || /^(\/|[a-z]+:)/i.test(cover.art) || cover.art.includes('\\') || cover.art.split('/').includes('..'))) throw Error('Cover artwork must be a local PNG or WebP asset');
}
