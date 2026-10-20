export function coverConfiguration({preset,fields,colors,logoName}) {
  const brand={};
  if(fields.brandName)brand.name=fields.brandName;
  if(logoName)brand.logo=logoName;
  return {version:1,title:fields.title,...(fields.subtitle?{subtitle:fields.subtitle}:{}),...(Object.keys(brand).length?{brand}:{}),cover:{preset:preset.id,...(fields.presenter?{presenter:fields.presenter}:{}),...(fields.date?{date:fields.date}:{}),colors:{...colors}}};
}
export function coverBrief({preset,fields,colors,logoName,language="en"}) {
  const zh=language==="zh";
  const labels=zh?{title:"标题",subtitle:"副标题",brandName:"品牌",presenter:"演讲者",date:"日期"}:{title:"Title",subtitle:"Subtitle",brandName:"Brand",presenter:"Presenter",date:"Date"};
  return [zh?`请使用「${preset.title.zh}」（${preset.id}）封面风格制作我的 presentation。`:`Use the ${preset.title.en} cover style (${preset.id}) for my presentation.`,...Object.entries(labels).filter(([key])=>fields[key]).map(([key,label])=>`${label}: ${fields[key]}`),`${zh?"配色":"Colors"}: ${Object.entries(colors).map(([key,value])=>`${key} ${value}`).join(", ")}.`,...(logoName?[zh?`Logo: ${logoName}（文件将随需求提供）。`:`Logo: ${logoName} (I will supply the file alongside this brief).`]:[]),zh?"请根据我的内容替换封面文字，保留这个风格并沿用到视频开场。":"Adapt the cover to my content, retain this style, and reuse it for the video opening."].join("\n");
}
