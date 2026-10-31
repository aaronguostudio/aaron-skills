import {presentationBrief} from './presentation-handoff.mjs';

// The opening selection must be explicit: a layout preset may otherwise supply
// its own cover. The caller can copy a brief while a choice remains undecided.
/** @param {{layout:any, cover:any, fields:any, logo?:{name:string}|null}} options */
export function studioConfig({layout,cover,fields,logo=null}) {
 if(!layout || !cover) throw Error('Choose a layout and an opening option first');
 const result={version:2,layout:{preset:layout.id},brand:{...(logo?{logo:logo.name,logoProvenance:{source:'User-confirmed brand logo',role:'corporate',verified:true}}:{fallback:'omit'}),...(fields.brandName?{name:fields.brandName}:{})},intro:{enabled:!cover.none}};
 if(fields.title)result.title=fields.title;
 if(fields.subtitle)result.subtitle=fields.subtitle;
 if(!cover.none)result.cover={preset:cover.preset.id,...(cover.colors?{colors:{...cover.colors}}:{}),...(fields.presenter?{presenter:fields.presenter}:{}),...(fields.date?{date:fields.date}:{})};
 return result;
}
export function studioBrief({layout,cover,fields,language,logoName=undefined}) {
 const brief=presentationBrief({layout,cover:cover && !cover.none?{preset:cover.preset,fields,logoName,colors:cover.colors??cover.preset.colors}:cover,language});
 const details=!cover||cover.none ? Object.entries({title:fields.title,subtitle:fields.subtitle,brand:fields.brandName,presenter:fields.presenter,date:fields.date}).filter(([,value])=>value).map(([key,value])=>`${key}: ${value}`) : [];
 if(logoName&&(!cover||cover.none))details.push(language==='zh'?`Logo: ${logoName}（文件将随需求提供）。`:`Logo: ${logoName} (I will supply the file alongside this brief).`);
 return [brief,...details].join('\n');
}
