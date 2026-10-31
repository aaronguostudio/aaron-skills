import { coverBrief } from './cover-handoff.mjs';

// Produce one human-readable request without inventing a renderer configuration.
// The selected opening cover overrides a treatment's example cover, but the body
// remains the chosen layout. Plain layouts can also have an independent cover.
export function presentationBrief({layout, cover, language='en'}) {
  if (!layout && !cover) throw new Error('Select a layout or cover first');
  const zh=language==='zh';
  const lines=[zh?'请根据以下选择制作视频：':'Please use these choices for my video:'];
  if(layout) {
    const plain=layout.id.startsWith('plain-');
    lines.push(zh?`视频版式：${layout.name}（${layout.id}）。${plain?'正文保持原始视频，不加装饰背景。':'保留此版式的视频正文风格。'}`:`Video layout: ${layout.name} (${layout.id}). ${plain?'Keep the video body unframed without a decorative backdrop.':'Keep this treatment for the video body.'}`);
  } else lines.push(zh?'视频版式：尚未选择，请先与我确认。':'Video layout: not selected; confirm it with me.');
  if(cover?.none) {
    lines.push(zh?'开场封面：不要开场封面。':'Opening cover: no opening cover.');
  } else if(cover) {
    lines.push('',coverBrief({...cover,language}));
    if(layout) lines.push(zh?'开场使用上面选择的封面；它独立于视频正文版式，也替代版式示例中的默认封面。':'Use the selected cover above for the opening; it is independent of the video body and replaces the treatment’s example cover.');
  } else lines.push(zh?'开场封面：尚未选择，请先与我确认。':'Opening cover: not selected; confirm it with me.');
  return lines.join('\n');
}
