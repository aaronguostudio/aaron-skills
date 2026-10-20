import {coverColors} from '../../../../../covers/catalog';
import type {Presentation} from './model';

export type Palette={background:string;foreground:string;accent:string;highlight:string;cursor:string};
export const THEMES={
  'blue-lavender':{background:'#173CA8',foreground:'#FFFFFF',accent:'#D5CEFF',highlight:'#3D63F5',cursor:'#3D63F5',coverBackground:'#E6E1FA',coverForeground:'#17234C',coverAccent:'#1749DB'},
  neutral:{background:'#172131',foreground:'#FFFFFF',accent:'#D2DCEC',highlight:'#92B9FF',cursor:'#92B9FF',coverBackground:'#F0F3F8',coverForeground:'#172131',coverAccent:'#4265B0'},
};
const luminance=(hex:string)=>{
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
export const contrastRatio=(a:string,b:string)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
export const readableInk=(background:string)=>contrastRatio(background,'#FFFFFF')>=4.5?'#FFFFFF':'#101929';
export const alphaColor=(color:string,alpha:number)=>`rgba(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(', ')}, ${alpha})`;

export function inheritedPalette(p: Pick<Presentation,'theme'|'cover'>):Palette {
  const theme=p.theme?.preset?THEMES[p.theme.preset]:undefined;
  const cover=p.cover?coverColors(p.cover):undefined;
  const background=p.theme?.background??theme?.background??cover?.foreground??THEMES.neutral.background;
  const highlight=p.theme?.highlight??theme?.highlight??cover?.accent??THEMES.neutral.highlight;
  return {background,foreground:p.theme?.foreground??theme?.foreground??readableInk(background),accent:p.theme?.accent??theme?.accent??cover?.accent??THEMES.neutral.accent,highlight,cursor:p.theme?.cursor??p.theme?.highlight??theme?.cursor??highlight};
}

export function paletteFor(p:Presentation,surface:'intro'|'body'|'outro'):Palette {
  if(surface==='intro'&&p.cover){const cover=coverColors(p.cover);return {background:cover.background,foreground:cover.foreground,accent:cover.accent,highlight:p.body.highlightColor,cursor:p.body.cursorColor??p.body.highlightColor};}
  if(p.version===1){
    const minimal=p.template==='minimal';
    return {background:minimal?'#F1F1E9':p.template==='showcase'?'#101C29':p.brand.primary,foreground:minimal?p.brand.primary:'#F4F5EF',accent:minimal?p.brand.primary:p.brand.accent,highlight:p.body.highlightColor,cursor:'#E3A900'};
  }
  const background=p[surface].background??p.brand.primary;
  return {background,foreground:p[surface].foreground??p.theme?.foreground??readableInk(background),accent:p.brand.accent,highlight:p.body.highlightColor,cursor:p.body.cursorColor??p.body.highlightColor};
}

export function logoFor(p:Presentation,background:string):string|undefined {
  const variants=p.brand.logoVariants;
  return (luminance(background)>.4?variants?.dark:variants?.light)??p.brand.logo??variants?.dark??variants?.light;
}

export function logoSurfaceBackground(p:Presentation,surface:'intro'|'body'|'outro'|'cover'):string {
  if(p.brand.logoBackground)return p.brand.logoBackground;
  if(surface==='cover'||(surface==='intro'&&p.cover))return p.cover?coverColors(p.cover).background:paletteFor(p,'intro').background;
  return paletteFor(p,surface).background;
}
