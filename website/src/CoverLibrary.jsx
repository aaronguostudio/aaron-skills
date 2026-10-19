import { useLayoutEffect, useRef, useState } from "react";
import covers from "./covers.json";
import "./covers.css";

const families = [...new Map(covers.map(cover => [cover.family, cover.familyTitle])).entries()];
const copy = {
  en: {
    eyebrow: "THE COVER LIBRARY", title: "Make a strong first impression.",
    intro: "32 presentation covers. Bold color, striking imagery, and room for one clear idea.",
    detail: "Explore eight visual directions. Open any cover for a closer look, or download the original PNG and a lighter WebP for your next demo.",
    all: "All styles", filter: "Filter covers by style", browse: "Explore all 32 covers", preview: "Preview", close: "Close preview",
    previous: "Previous cover", next: "Next cover", png: "Original PNG", webp: "Download WebP",
    note: "Image samples with illustrative titles, presenter, and date.", count: "covers", back: "Back to Aaron Skills",
  },
  zh: {
    eyebrow: "封面图库", title: "让开场令人印象深刻。",
    intro: "32 张 presentation 封面。鲜明配色、质感主视觉，以及一个清晰的主题。",
    detail: "探索八种视觉方向。点击封面放大查看，也可以下载原始 PNG 和适合演示的轻量 WebP。",
    all: "全部风格", filter: "按风格筛选封面", browse: "浏览全部 32 张封面", preview: "预览", close: "关闭预览",
    previous: "上一张封面", next: "下一张封面", png: "原始 PNG", webp: "下载 WebP",
    note: "图片示例中的标题、演讲者和日期均为演示内容。", count: "张封面", back: "返回 Aaron Skills",
  },
};

function CoverPreview({ cover, position, total, onClose, onMove, language }) {
  const dialog = useRef(null);
  const t = copy[language];
  useLayoutEffect(() => {
    if (!cover) return;
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, [Boolean(cover)]);
  return (
    <dialog ref={dialog} className="cover-dialog" aria-labelledby="cover-preview-title"
      onCancel={onClose} onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onMove(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      {cover && <div className="cover-preview-sheet">
        <header><div><p className="eyebrow">{cover.familyTitle[language]}</p><h2 id="cover-preview-title">{cover.title[language]}</h2></div>
          <button autoFocus className="cover-close" onClick={onClose} aria-label={t.close}>×</button></header>
        <img className="cover-large" src={cover.webp} width={cover.width} height={cover.height} alt={cover.description[language]} />
        <div className="cover-preview-footer">
          <div className="cover-preview-nav"><button onClick={() => onMove(-1)} aria-label={t.previous}>←</button>
            <span aria-live="polite">{position + 1} / {total}</span><button onClick={() => onMove(1)} aria-label={t.next}>→</button></div>
          <div className="cover-downloads"><a href={cover.png} download>{t.png} <span>↓</span></a><a href={cover.webp} download>{t.webp} <span>↓</span></a></div>
        </div>
        <p className="cover-sample-note">{t.note}</p>
      </div>}
    </dialog>
  );
}

export function CoverLibrary({ language, teaser = false }) {
  const [family, setFamily] = useState("all");
  const [selected, setSelected] = useState(null);
  const Heading = teaser ? "h2" : "h1";
  const t = copy[language];
  const visible = teaser ? [covers[0], covers[4], covers[8], covers[12]] : covers.filter(cover => family === "all" || cover.family === family);
  const cover = selected === null ? null : visible[selected];
  const galleryUrl = `/covers${language === "zh" ? "?lang=zh" : ""}`;
  return (
    <section className={`cover-library wrap ${teaser ? "cover-teaser" : "cover-full"}`} id="covers" aria-labelledby="covers-title">
      {!teaser && <a className="cover-back" href={language === "zh" ? "/?lang=zh" : "/"}>← {t.back}</a>}
      <div className="cover-library-heading"><div><p className="eyebrow">{t.eyebrow}</p><Heading className="cover-title" id="covers-title">{t.title}</Heading><p className="cover-intro">{t.intro}</p></div>
        {teaser && <a className="text-link" href={galleryUrl}>{t.browse} <span aria-hidden="true">↗</span></a>}</div>
      {!teaser && <><p className="cover-description">{t.detail}</p>
        <div className="cover-filters" role="group" aria-label={t.filter}>
          {[["all", { en: t.all, zh: t.all }], ...families].map(([id, title]) => <button key={id} aria-pressed={family === id} onClick={() => { setSelected(null); setFamily(id); }}>{title[language]}</button>)}
        </div><p className="cover-count" aria-live="polite">{visible.length} {t.count}</p></>}
      <div className="cover-grid">{visible.map((item, index) => <article className="cover-item" key={item.id}>
        <button className="cover-image-button" aria-label={`${t.preview}: ${item.title[language]}`} aria-haspopup="dialog" onClick={() => setSelected(index)}>
          <img src={item.thumbnail} srcSet={`${item.thumbnail} 640w, ${item.webp} ${item.width}w`} sizes={teaser ? "(max-width: 650px) calc(100vw - 40px), (max-width: 1000px) 46vw, 23vw" : "(max-width: 650px) calc(100vw - 40px), (max-width: 1000px) 46vw, 31vw"}
            width={item.width} height={item.height} loading="lazy" decoding="async" alt={item.description[language]} />
          <span className="cover-image-action" aria-hidden="true">↗</span>
        </button>
        <div className="cover-item-caption"><h3>{item.title[language]}</h3><p>{item.familyTitle[language]}</p></div>
      </article>)}</div>
      {teaser && <a className="cover-browse-mobile text-link" href={galleryUrl}>{t.browse} <span aria-hidden="true">↗</span></a>}
      <CoverPreview cover={cover} position={selected ?? 0} total={visible.length} onClose={() => setSelected(null)} onMove={direction => setSelected(current => current === null ? null : (current + direction + visible.length) % visible.length)} language={language} />
    </section>
  );
}
