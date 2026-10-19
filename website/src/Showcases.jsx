import { useRef, useState } from "react";
import showcases from "./showcases.json";
import { ScriptExample } from "./ScriptExample";
import "./showcases.css";

const labels = {
  en: {
    eyebrow: "RELEASED TODAY / DEMONSTRATE WITH DEMO",
    title: ["Same screen.", "A different conversation."],
    intro: "These examples show the released Demo bundle: Capture records and checks a real flow, Film explains it, and Share prepares the handoff. Start with the fictional product demo; the blog shows a different, content-led use.",
    public: "Public website · No sign-in",
    synthetic: "Signed-in app · Fictional data",
    choose: "Choose a video recipe",
    recipe: "Make something like this",
    transcript: "What to look for",
    download: "Open video",
    pending: "This cut is being prepared.",
    error: "The video could not load. You can open the file directly below.",
    note: "These are starting points. Choose the visual template, explanation style and voice independently.",
    how: "Capture once. Refine the explanation.",
    steps: ["Record the flow and check its result.", "Choose a purpose, then draft around the evidence.", "Render the presentation without repeating the actions."],
    docs: "Explore the video guide ↗",
    audio: "Audio",
    template: "Template",
    style: "Explanation",
    safety: "A local synthetic app with a real session gate. Every identity, invoice and approval is fictional.",
  },
  zh: {
    eyebrow: "当前已发布 / DEMO 演示能力",
    title: ["同一份画面，", "不同的表达。"],
    intro: "下面展示的是已经发布的 Demo 能力：Capture 录下并检查真实流程，Film 制作讲解，Share 整理交付。先看虚构产品的功能演示，再看博客的内容导览。",
    public: "公开网站 · 无需登录",
    synthetic: "登录后应用 · 虚构数据",
    choose: "选择视频配方",
    recipe: "试着做一条这样的视频",
    transcript: "观看要点",
    download: "打开视频",
    pending: "这个版本正在制作中。",
    error: "视频暂时无法加载，可通过下方链接直接打开。",
    note: "这些只是起点。视觉模板、讲解风格和声音可以独立组合。",
    how: "录制一次，反复打磨表达。",
    steps: ["录下操作，并检查实际结果。", "明确讲给谁听，再根据证据起草。", "重新渲染呈现，无需重做业务操作。"],
    docs: "阅读视频指南 ↗",
    audio: "声音",
    template: "视觉模板",
    style: "讲解风格",
    safety: "本地虚构应用，包含真实会话验证。身份、发票及审批均为模拟数据。",
  },
};

function ShowcaseCase({ item, language, number }) {
  const [selected, setSelected] = useState(item.variants[0].id);
  const [failed, setFailed] = useState(false);
  const player = useRef(null);
  const text = labels[language];
  const variant = item.variants.find((cut) => cut.id === selected) || item.variants[0];
  const changeCut = (id) => {
    player.current?.pause();
    setFailed(false);
    setSelected(id);
  };
  return (
    <article className="showcase-case" id={`example-${item.id}`}>
      <header className="showcase-case-heading">
        <span className="showcase-number" aria-hidden="true">0{number}</span>
        <div>
          <p className="showcase-context">{text[item.kind]}</p>
          <h3>{item.title[language]}</h3>
          <p className="showcase-story">{item.summary[language]}</p>
        </div>
      </header>
      <div className="showcase-stage">
        <div className="showcase-screen">
          {variant.video ? (
            <video
              key={variant.id}
              ref={player}
              controls
              playsInline
              preload="none"
              poster={variant.poster}
              width="1440"
              height="996"
              crossOrigin="anonymous"
              aria-label={`${item.title[language]} — ${variant.name}`}
              onError={() => setFailed(true)}
              onPlay={(event) => {
                for (const video of document.querySelectorAll(".showcase-screen video")) {
                  if (video !== event.currentTarget) video.pause();
                }
              }}
            >
              <source src={variant.video} type="video/mp4" />
              {variant.captions && <track kind="captions" src={variant.captions} srcLang="en" label="English" />}
              <a href={variant.video}>{text.download}</a>
            </video>
          ) : <p className="showcase-pending">{text.pending}</p>}
          {failed && <p className="showcase-error" role="alert">{text.error}</p>}
          <div className="showcase-player-meta">
            <span>{variant.seconds ? `${Math.round(variant.seconds)}s` : "—"} <span aria-hidden="true">/</span> {variant.language || "English"}</span>
            {variant.video && <a href={variant.video} target="_blank" rel="noreferrer">{text.download} ↗</a>}
          </div>
        </div>
        <div className="showcase-recipes">
          <p className="eyebrow">{text.choose}</p>
          <div className="showcase-options" role="group" aria-label={`${item.title[language]}: ${text.choose}`}>
            {item.variants.map((cut, i) => (
              <button key={cut.id} onClick={() => changeCut(cut.id)} aria-pressed={variant.id === cut.id}>
                <span className="showcase-option-index">0{i + 1}</span>
                <span><strong>{cut.name}</strong><small>{cut.purpose[language]}</small></span>
                <span className="showcase-option-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <dl className="showcase-settings">
            <div><dt>{text.template}</dt><dd>{variant.template}</dd></div>
            <div><dt>{text.style}</dt><dd>{variant.style}</dd></div>
            <div><dt>{text.audio}</dt><dd>{variant.audio[language]}</dd></div>
          </dl>
          <p className="showcase-combinations">{text.note}</p>
        </div>
      </div>
      <div className="showcase-details">
        <details key={`recipe-${variant.id}`}>
          <summary>{text.recipe}<span aria-hidden="true">+</span></summary>
          <p>{variant.brief[language]}</p>
          <pre><code>{variant.command}</code></pre>
          <a href="https://github.com/aaronguostudio/aaron-skills/blob/main/docs/video-showcases.md" target="_blank" rel="noreferrer">{text.docs}</a>
        </details>
        <details key={`transcript-${variant.id}`}>
          <summary>{text.transcript}<span aria-hidden="true">+</span></summary>
          <p lang={language === "zh" ? "zh-CN" : "en"}>{item.outline[language]}</p>
        </details>
      </div>
      {item.kind === "synthetic" && <p className="showcase-fixture-note">{text.safety}</p>}
    </article>
  );
}

export function Showcases({ language, cases = showcases }) {
  const text = labels[language];
  return (
    <section className="showcases wrap" id="examples" aria-labelledby="examples-title">
      <p className="eyebrow">{text.eyebrow}</p>
      <div className="showcase-intro">
        <h2 id="examples-title">{text.title[0]}<br /><span className="accent">{text.title[1]}</span></h2>
        <p>{text.intro}</p>
      </div>
      {cases.map((item, i) => <ShowcaseCase key={item.id} item={item} language={language} number={i + 1} />)}
      <aside className="showcase-method">
        <h3>{text.how}</h3>
        <ol>{text.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </aside>
      <ScriptExample language={language} />
    </section>
  );
}
