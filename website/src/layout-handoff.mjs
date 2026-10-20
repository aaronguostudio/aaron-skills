export function layoutBrief(item,language='en'){
  const zh=language==='zh',plain=item.id.startsWith('plain-');
  const treatment=plain?(zh?'保留原始视频，下方显示少量字幕或 transcript；不要装饰背景，也不要强制添加开场封面。':'Keep the video unframed, with a short caption or transcript below; use no decorative backdrop or opening cover.'):(zh?'保留对应的封面和视频页风格。':'Retain the matched cover and video-page treatment.');
  return `${zh?'请用':'Use'} ${item.name} (${item.id}) ${zh?'制作我的视频。':'for my video.'} ${treatment} ${zh?'根据我的内容替换标题与讲解，并使用我提供的品牌与 Logo。':'Adapt the title and explanation to my content and use my supplied brand and logo.'}\n${JSON.stringify({version:2,brand:{fallback:'omit'},layout:{preset:item.id}},null,2)}`;
}
