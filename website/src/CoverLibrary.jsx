import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import covers from "./covers.json";
import "./covers.css";

const CoverEditor = lazy(() => import("./CoverEditor"));

const families = [...new Map(covers.map(cover => [cover.family, cover.familyTitle])).entries()];
const copy = {
  en: {
    eyebrow: "THE COVER LIBRARY", title: "Make a strong first impression.",
    intro: "32 presentation covers. Bold color, striking imagery, and room for one clear idea.",
    detail: "Choose a style here, or ask your agent to recommend three covers using your content and brand. Your agent can handle the title, logo, presenter, date and colors.",
    use: "Use this style", search: "Search cover styles", noResults: "No matching styles. Try another name or family.", agent: "Prefer to stay in the conversation?", prompt: "Recommend three covers for my video, using my content and brand style.", agentDetail: "Choose by number or name. Your agent handles the rest.", loading: "Opening your selected style…",
    all: "All styles", filter: "Filter covers by style", browse: "Explore all 32 covers", preview: "Preview", close: "Close preview",
    previous: "Previous cover", next: "Next cover", png: "Original PNG", webp: "Download WebP",
    note: "Image samples with illustrative titles, presenter, and date.", count: "covers", back: "Back to Aaron Skills",
  },
  zh: {
    eyebrow: "封面图库", title: "让开场令人印象深刻。",
    intro: "32 张 presentation 封面。鲜明配色、质感主视觉，以及一个清晰的主题。",
    detail: "在这里选择风格，也可以让 Agent 根据你的内容和品牌推荐三款封面。标题、Logo、演讲者、日期和配色，都可以交给 Agent 完成。",
    use: "使用这个风格", search: "搜索封面风格", noResults: "没有找到匹配风格，请换个名称或分类试试。", agent: "希望直接在对话里完成？", prompt: "根据我的内容和品牌风格，为这个视频推荐三款封面。", agentDetail: "回复编号或名称，剩下的交给 Agent。", loading: "正在打开选定风格…",
    all: "全部风格", filter: "按风格筛选封面", browse: "浏览全部 32 张封面", preview: "预览", close: "关闭预览",
    previous: "上一张封面", next: "下一张封面", png: "原始 PNG", webp: "下载 WebP",
    note: "图片示例中的标题、演讲者和日期均为演示内容。", count: "张封面", back: "返回 Aaron Skills",
  },
};

function CoverPreview({ cover, position, total, onClose, onMove, onUse, language }) {
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
          <div className="cover-downloads"><button className="cover-primary" onClick={() => onUse(cover.id)}>{t.use} ↗</button><a href={cover.png} download>{t.png} <span>↓</span></a><a href={cover.webp} download>{t.webp} <span>↓</span></a></div>
        </div>
        <p className="cover-sample-note">{t.note}</p>
      </div>}
    </dialog>
  );
}

export function CoverLibrary({ language, teaser = false }) {
  const [family, setFamily] = useState("all");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const initial = new URLSearchParams(window.location.search).get("style");
  const [editorPreset, setEditorPreset] = useState(covers.some(item => item.id === initial) && !teaser ? initial : null);
  const [editing, setEditing] = useState(Boolean(editorPreset));
  const galleryHeading = useRef(null);
  const selectStyle = id => {
    setSelected(null); setEditorPreset(id); setEditing(true);
    const url = new URL(window.location.href); url.searchParams.set("style", id); window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const backToGallery = () => {
    setEditing(false); const url = new URL(window.location.href); url.searchParams.delete("style"); window.history.replaceState(null, "", url);
    requestAnimationFrame(() => { galleryHeading.current?.focus(); });
  };
  const Heading = teaser ? "h2" : "h1";
  const t = copy[language];
  const visible = teaser ? [covers[0], covers[4], covers[8], covers[12]] : covers.filter(cover => (family === "all" || cover.family === family) && `${cover.id} ${cover.title.en} ${cover.title.zh} ${cover.familyTitle.en} ${cover.familyTitle.zh}`.toLowerCase().includes(search.trim().toLowerCase()));
  const cover = selected === null ? null : visible[selected];
  const galleryUrl = `/covers${language === "zh" ? "?lang=zh" : ""}`;
  return (
    <section className={`cover-library wrap ${teaser ? "cover-teaser" : "cover-full"}`} id="covers" aria-labelledby={editing ? "cover-editor-title" : "covers-title"}>
      <div hidden={editing}>
      {!teaser && <a className="cover-back" href={language === "zh" ? "/?lang=zh" : "/"}>← {t.back}</a>}
      <div className={teaser ? undefined : "cover-gallery-hero"}>
      <div className="cover-library-heading"><div><p className="eyebrow">{t.eyebrow}</p><Heading ref={galleryHeading} tabIndex={-1} className="cover-title" id="covers-title">{t.title}</Heading><p className="cover-intro">{t.intro}</p></div>
        {teaser && <a className="text-link" href={galleryUrl}>{t.browse} <span aria-hidden="true">↗</span></a>}</div>
      {!teaser && <div className="cover-agent-invite"><p>{t.agent}</p><blockquote>“{t.prompt}”</blockquote><span>{t.agentDetail}</span></div>}
      </div>
      {!teaser && <>
        <div className="cover-filters" role="group" aria-label={t.filter}>
          {[["all", { en: t.all, zh: t.all }], ...families].map(([id, title]) => <button key={id} aria-pressed={family === id} onClick={() => { setSelected(null); setFamily(id); }}>{title[language]}</button>)}
        </div><label className="cover-search"><span>{t.search}</span><input type="search" value={search} onChange={event => { setSelected(null); setSearch(event.target.value); }} /></label><p className="cover-count" aria-live="polite">{visible.length} {t.count}</p></>}
      <div className="cover-grid">{visible.map((item, index) => <article className="cover-item" key={item.id}>
        <button className="cover-image-button" aria-label={`${t.preview}: ${item.title[language]}`} aria-haspopup="dialog" onClick={() => setSelected(index)}>
          <img src={item.thumbnail} srcSet={`${item.thumbnail} 640w, ${item.webp} ${item.width}w`} sizes={teaser ? "(max-width: 650px) calc(100vw - 40px), (max-width: 1000px) 46vw, 23vw" : "(max-width: 650px) calc(100vw - 40px), (max-width: 1000px) 46vw, 31vw"}
            width={item.width} height={item.height} loading="lazy" decoding="async" alt={item.description[language]} />
          <span className="cover-image-action" aria-hidden="true">↗</span>
        </button>
        <div className="cover-item-caption"><h3>{item.title[language]}</h3><p>{item.familyTitle[language]}</p><button className="cover-use-style" onClick={() => teaser ? window.location.assign(`${galleryUrl}${language === "zh" ? "&" : "?"}style=${item.id}`) : selectStyle(item.id)}>{t.use} ↗</button></div>
      </article>)}</div>
      {!visible.length && <p className="cover-empty">{t.noResults}</p>}
      {teaser && <a className="cover-browse-mobile text-link" href={galleryUrl}>{t.browse} <span aria-hidden="true">↗</span></a>}
      </div>
      {editorPreset && <Suspense fallback={<p>{t.loading}</p>}><CoverEditor presetId={editorPreset} active={editing} language={language} onBack={backToGallery} /></Suspense>}
      <CoverPreview cover={cover} position={selected ?? 0} total={visible.length} onClose={() => setSelected(null)} onMove={direction => setSelected(current => current === null ? null : (current + direction + visible.length) % visible.length)} onUse={id => teaser ? window.location.assign(`${galleryUrl}${language === "zh" ? "&" : "?"}style=${id}`) : selectStyle(id)} language={language} />
    </section>
  );
}
