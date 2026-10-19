import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import workflowDiagram from "./assets/workflow-canvas/workflow-diagram.webp";
import workflowDiagramSmall from "./assets/workflow-canvas/workflow-diagram-768.webp";
import { Showcases } from "./Showcases";
import { IntroVideo } from "./IntroVideo";
import publishedIntroduction from "./introduction.json";
import { CoverLibrary } from "./CoverLibrary";

const REPO = "https://github.com/aaronguostudio/aaron-skills";
const copy = {
  en: {
    nav: ["Workflow", "Skills"],
    eyebrow: "METHODS FOR WORKING WITH AGENTS",
    headline: ["From unfamiliar", "project to a", "clear handoff."],
    intro: "Reusable skills and tools for working with AI agents. Start with Demo: record a real workflow, explain the checked result, and prepare a clear handoff.",
    explore: "Explore the skills",
    github: "View on GitHub",
    workflow: "A WORKING METHOD, MADE REUSABLE.",
    future: "Future direction",
    available: "Demo bundle · Available now",
    stages: ["Understand", "Build", "Verify", "Demonstrate", "Deliver"],
    bundle: "AVAILABLE TODAY / THE DEMO BUNDLE",
    skillsHeadline: ["Three skills.", "One clear handoff."],
    descriptions: [
      "Record the real flow. Save screenshots and checked results.",
      "Turn a passed capture into a guided video.",
      "Prepare a copyable update with screenshots and video.",
    ],
    built: "Built by",
    source: "Open source",
    close: "Close details",
    detailLabel: "PART OF THE DEMO BUNDLE",
    input: "Start with",
    output: "Take away",
    docs: "Read the skill",
    install: "Installation guide",
    details: [
      {
        intro:
          "Show what actually happens in the application. Walk through the important actions, check the visible result, and keep the evidence together.",
        input:
          "A working web app and a project adapter describing its URL, steps, and checks.",
        output:
          "A recorded walkthrough, screenshots, and checked result evidence for the next skill.",
      },
      {
        intro:
          "Make the result easy to follow. Add captions and highlights to a passed capture, then refine the presentation without repeating business actions.",
        input:
          "A passed Capture recording with its saved result evidence.",
        output:
          "A guided MP4 and review stills. Silent by default, with optional narration.",
      },
      {
        intro:
          "Bring the work into the conversation. Combine a clear explanation with screenshots and an optional walkthrough, ready for your review.",
        input:
          "Your update text, screenshots, and an optional walkthrough video.",
        output:
          "A local HTML update page with copyable text and screenshots. You choose when and where to share.",
      },
    ],
    skip: "Skip to content",
    locale: "Change language",
    skillAction: "Explore",
  },
  zh: {
    nav: ["工作流程", "Skills"],
    eyebrow: "与 AGENT 协作的工作方法",
    headline: ["从陌生项目，", "到清楚交付。"],
    intro: "将 AI Agent 的工作方法与执行工具连起来。目前已发布 Demo：录制真实流程，讲清检查过的结果，再整理成可交付的更新。",
    explore: "探索这些 Skills",
    github: "在 GitHub 查看",
    workflow: "把工作方法，变成可复用的能力。",
    future: "未来方向",
    available: "Demo 能力组合 · 现已可用",
    stages: ["理解项目", "实现改动", "验证行为", "演示结果", "清楚交付"],
    bundle: "当前可用：DEMO 能力组合",
    skillsHeadline: ["三个 Skills，", "串起清楚的交付。"],
    descriptions: [
      "录制真实应用流程，保存截图与经过检查的结果。",
      "将通过检查的录制，制作成有引导的演示视频。",
      "将文字、截图与视频，整理成可复制的更新说明。",
    ],
    built: "由",
    source: "开源项目",
    close: "关闭详情",
    detailLabel: "DEMO 能力组合",
    input: "从这里开始",
    output: "你会得到",
    docs: "阅读 Skill",
    install: "安装指南",
    details: [
      {
        intro:
          "展示应用里真实发生的事。走过关键操作，检查界面结果，把录制与证据保存在一起。",
        input:
          "一个可以运行的 Web 应用，以及描述地址、操作步骤和检查项的项目适配器。",
        output: "一份录制、截图与结果证据，供后续 Skill 使用。",
      },
      {
        intro:
          "让结果更容易理解。为通过检查的录制添加字幕和高亮，修改呈现时不必重复执行业务操作。",
        input: "Capture 已通过检查的录制与保存的结果证据。",
        output: "有引导的 MP4 与供审阅的静帧。默认静音，也可选配旁白。",
      },
      {
        intro:
          "把工作带入沟通。将清楚的说明、截图与可选演示组合起来，先供你审阅。",
        input: "更新说明文字、截图与可选的演示视频。",
        output:
          "本地 HTML 更新页面，可复制文字和截图。由你决定何时、向谁分享。",
      },
    ],
    skip: "跳到正文",
    locale: "切换语言",
    skillAction: "了解",
  },
};
const skills = [
  {
    name: "Capture",
    slug: "demo-capture",
  },
  {
    name: "Film",
    slug: "walkthrough-video",
  },
  {
    name: "Share",
    slug: "paste-ready-update",
  },
];
function Arrow({ size = 23, ...props }) {
  return (
    <ArrowRightIcon size={size} weight="light" aria-hidden="true" {...props} />
  );
}
function ExternalLink({ href, children, className = "", ...props }) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    >
      {children}
    </a>
  );
}
function SkillDetails({ selected, onClose, text }) {
  const dialog = useRef(null);
  useLayoutEffect(() => {
    if (selected === null) return;
    const element = dialog.current;
    const scrollPosition = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    // Keep the page still behind the native dialog, including on mobile.
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition}px`;
    body.style.width = "100%";
    element.showModal();
    return () => {
      if (element.open) element.close();
      Object.assign(body.style, previous);
      window.scrollTo({ top: scrollPosition, behavior: "instant" });
    };
  }, [selected]);
  const skill = skills[selected ?? 0];
  const detail = text.details[selected ?? 0];
  return (
    <dialog
      ref={dialog}
      className="skill-dialog"
      aria-labelledby="detail-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="detail-sheet">
        <button
          className="close-button"
          aria-label={text.close}
          onClick={onClose}
        >
          <XIcon size={24} weight="light" />
        </button>
        <p className="eyebrow">{text.detailLabel}</p>
        <h2 id="detail-title">{skill.name}</h2>
        <p className="detail-intro">{detail.intro}</p>
        <dl>
          <div>
            <dt>{text.input}</dt>
            <dd>{detail.input}</dd>
          </div>
          <div>
            <dt>{text.output}</dt>
            <dd>{detail.output}</dd>
          </div>
        </dl>
        <div className="detail-links">
          <ExternalLink
            className="button button-dark"
            href={`${REPO}/blob/main/skills/${skill.slug}/SKILL.md`}
          >
            {text.docs}
            <ArrowUpRightIcon size={19} aria-hidden="true" />
          </ExternalLink>
          <ExternalLink
            className="text-link"
            href={`${REPO}/blob/main/docs/installation.md`}
          >
            {text.install}
            <Arrow size={20} />
          </ExternalLink>
        </div>
      </div>
    </dialog>
  );
}
export function App() {
  const [language, setLanguage] = useState(() =>
    new URLSearchParams(window.location.search).get("lang") === "zh"
      ? "zh"
      : "en",
  );
  const [selected, setSelected] = useState(null);
  const [introductionOpen, setIntroductionOpen] = useState(false);
  const [review, setReview] = useState(null);
  const introduction = review?.intro ?? publishedIntroduction;
  const text = copy[language];
  useEffect(() => {
    if (!import.meta.env.DEV || !import.meta.env.AARON_SKILLS_REVIEW) return;
    const controller = new AbortController();
    fetch("/__review/catalog.json", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Review catalogue unavailable"); return response.json(); })
      .then(setReview).catch(error => { if (error.name !== "AbortError") console.warn("Local review media unavailable; showing published examples."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  useLayoutEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "instant" });
  }, []);
  function changeLanguage(next) {
    setLanguage(next);
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", "zh");
    window.history.replaceState(null, "", url);
  }
  const isCoversPage = window.location.pathname.replace(/\/$/, "") === "/covers";
  const home = isCoversPage ? (language === "zh" ? "/?lang=zh" : "/") : "";
  return (
    <div className={`site ${language === "zh" ? "is-chinese" : ""}`}>
      <a href="#main" className="skip-link">
        {text.skip}
      </a>
      <header className="site-header wrap">
        <a
          className="wordmark"
          href={home || "#"}
          aria-label={
            language === "zh" ? "Aaron Skills 首页" : "Aaron Skills home"
          }
        >
          Aaron Skills
        </a>
        <nav aria-label={language === "zh" ? "主导航" : "Main navigation"}>
          <a href={`${home}#workflow`}>{text.nav[0]}</a>
          <a href={`${home}#skills`}>{text.nav[1]}</a>
          <a href={`${home}#examples`}>{language === "zh" ? "案例" : "Examples"}</a>
          <ExternalLink href={REPO}>GitHub</ExternalLink>
          <a href={`/covers${language === "zh" ? "?lang=zh" : ""}`} aria-current={isCoversPage ? "page" : undefined}>{language === "zh" ? "封面" : "Covers"}</a>
          <div
            className="language-switch"
            role="group"
            aria-label={text.locale}
          >
            <button
              onClick={() => changeLanguage("en")}
              aria-pressed={language === "en"}
              lang="en"
            >
              EN
            </button>
            <span aria-hidden="true">/</span>
            <button
              onClick={() => changeLanguage("zh")}
              aria-pressed={language === "zh"}
              lang="zh-CN"
            >
              中文
            </button>
          </div>
        </nav>
      </header>
      <main id="main">
        {isCoversPage ? <CoverLibrary language={language} /> : <>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">{text.eyebrow}</p>
            <h1 id="hero-title">
              {text.headline.map((line, index) => (
                <span
                  key={line}
                  className={index === text.headline.length - 1 ? "accent" : ""}
                >
                  {line}
                </span>
              ))}
            </h1>
            <p className="hero-description">{text.intro}</p>
            <div className="hero-actions">
              {introduction?.video ? <button className="button button-dark" onClick={() => setIntroductionOpen(true)} aria-haspopup="dialog">
                {language === "zh" ? "先看 Aaron Skills 介绍" : "What is Aaron Skills?"}<span aria-hidden="true">▶</span>
              </button> : <a className="button button-dark" href="#skills">{text.explore}<Arrow /></a>}
              <a href="#examples" className="text-link">
                {language === "zh" ? "观看实例" : "Watch the examples"}
                <Arrow />
              </a>
            </div>
            <p className="hero-scope">{language === "zh" ? "已发布：Demo · Capture / Film / Share。其他工作流能力仍在开发。" : "Released: Demo · Capture / Film / Share. Other workflow capabilities are in development."}</p>
          </div>
          <figure className="hero-art">
            <img
              src={workflowDiagram}
              srcSet={`${workflowDiagramSmall} 768w, ${workflowDiagram} 1475w`}
              sizes="(max-width: 900px) calc(100vw - 48px), (max-width: 1440px) 48vw, 683px"
              decoding="async"
              width="1475"
              height="1066"
              alt={language === "zh"
                ? "项目通过 Capture 录制真实流程、Film 制作讲解视频、Share 整理清楚的更新说明。"
                : "A project moves through Capture to record the real flow, Film to create a guided video, and Share to prepare a clear update."}
              fetchPriority="high"
            />
          </figure>
        </section>
        <section className="skills wrap" id="skills" aria-labelledby="skills-title">
          <p className="eyebrow">{text.bundle}</p>
          <h2 className="sr-only" id="skills-title">
            {text.skillsHeadline.join(" ")}
          </h2>
          <div className="skills-grid">
            {skills.map((skill, index) => (
              <article key={skill.slug} className="skill">
                <button className="skill-button" onClick={() => setSelected(index)}
                  aria-haspopup="dialog" aria-label={`${text.skillAction} ${skill.name}`}>
                  <span className="skill-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div className="skill-content">
                    <div className="skill-heading">
                      <h3>{skill.name}</h3>
                      <Arrow className="skill-arrow" size={22} />
                    </div>
                    <p>{text.descriptions[index]}</p>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="workflow wrap" id="workflow" aria-labelledby="workflow-title">
          <h2 className="eyebrow" id="workflow-title">{text.workflow}</h2>
          <ol className="workflow-steps">
            {text.stages.map((stage, index) => (
              <li className={`workflow-step ${index < 3 ? "future" : "available"}`} key={stage}>
                <h3>{stage}</h3>
                <p className="stage-status">{index < 3 ? text.future : text.available}</p>
                {index < 4 && <Arrow className="flow-arrow" size={22} />}
              </li>
            ))}
          </ol>
        </section>
        <section className="positioning wrap" aria-labelledby="positioning-title">
          <p className="eyebrow">{language === "zh" ? "如何融入你的工作流" : "HOW IT FITS YOUR WORKFLOW"}</p>
          <h2 id="positioning-title">{language === "zh" ? "从做出来，到让人看明白。" : "Make the work reviewable."}</h2>
          <p>{language === "zh" ? "Aaron Skills 将可复用的方法与执行工具放在一起。当前已发布的重点是 Demo：真实录制、检查过的结果、可调整的讲解，以及供人审阅的交付。" : "Aaron Skills pairs reusable working methods with executable tools. The released focus is Demo: real recordings, checked results, adaptable explanations, and a handoff someone can review."}</p>
          <details><summary>{language === "zh" ? "与 gstack、Superpowers 的侧重点有什么不同？" : "How does this compare with gstack and Superpowers?"}</summary>
            <p>{language === "zh" ? "gstack 的官方介绍强调产品、工程、QA 与发布等角色式工具；Superpowers 强调从澄清、计划到测试与评审的开发方法。Aaron Skills 当前发布的 Demo 聚焦把应用结果变成可观看、可审阅、可交付的材料。范围有重叠，这是一种侧重点比较，不是功能缺失或效果优劣的断言。" : "gstack documents role-based tools spanning product, engineering, QA and release. Superpowers documents a development methodology from clarification and planning through testing and review. Aaron Skills’ released Demo bundle focuses on turning application results into watchable, reviewable handoffs. These scopes overlap; this describes documented focus, not missing capabilities or comparative performance."}</p>
            <div className="positioning-sources"><ExternalLink href="https://github.com/garrytan/gstack">gstack — official README ↗</ExternalLink><ExternalLink href="https://github.com/obra/superpowers">Superpowers — official README ↗</ExternalLink></div>
          </details>
        </section>
        <Showcases language={language} cases={review?.cases} />
        <CoverLibrary language={language} teaser />
        </>}
      </main>
      <footer className="site-footer wrap">
        <p>
          {text.built}{" "}
          <ExternalLink href="https://aaronguo.com">Aaron Guo</ExternalLink>
          {language === "zh" ? " 创作" : ""}
        </p>
        <ExternalLink href={REPO} className="footer-github">
          {text.source}
          <span aria-hidden="true">·</span>GitHub
          <Arrow size={20} />
        </ExternalLink>
      </footer>
      <IntroVideo open={introductionOpen} onClose={() => setIntroductionOpen(false)} language={language} media={introduction} />
      <SkillDetails
        selected={selected}
        onClose={() => setSelected(null)}
        text={text}
      />
    </div>
  );
}
