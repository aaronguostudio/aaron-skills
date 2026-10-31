export function layoutBrief(item,language='en'){
  const zh=language==='zh',plain=item.id.startsWith('plain-');
  const treatment=plain?(zh?'正文保留原始视频，下方显示少量字幕或 transcript；不要装饰背景，封面可以另行选择。':'Keep the video body unframed, with a short caption or transcript below and no decorative backdrop. The opening cover can be chosen separately.'):(zh?'保留所选视频正文的风格；开场封面可以另行选择。':'Retain the selected video-body treatment. The opening cover can be chosen separately.');
  return `${zh?'请用':'Use'} ${item.name} (${item.id}) ${zh?'制作我的视频。':'for my video.'} ${treatment} ${zh?'根据我的内容替换标题与讲解，并使用我提供的品牌与 Logo。':'Adapt the title and explanation to my content and use my supplied brand and logo.'}\n${JSON.stringify({version:2,brand:{fallback:'omit'},layout:{preset:item.id}},null,2)}`;
}
