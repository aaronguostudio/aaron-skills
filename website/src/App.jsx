import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { SkillEssentials } from "./SkillEssentials";
import { WorkflowGraph } from "./WorkflowGraph";
import { LazyMotion, domAnimation, MotionConfig } from "motion/react";
import { Showcases } from "./Showcases";
import { IntroVideo } from "./IntroVideo";
import publishedIntroduction from "./introduction.json";
import { VideoLayouts } from "./VideoLayouts";
import { CoverLibrary } from "./CoverLibrary";

const REPO = "https://github.com/aaronguostudio/aaron-skills";
const copy = {
  en: {
    nav: ["Workflow", "Skills"],
    eyebrow: "METHODS FOR WORKING WITH AGENTS",
    headline: ["From intent", "to work people", "can use."],
    intro: "Shape the idea. Build it with care. Check the result. Make it clear to the next person. Reusable methods and tools for working with AI agents.",
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
      "Create guided videos and branded presentation covers.",
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
          "Choose a cover style and adapt it to your content and brand. Add captions and highlights to a passed capture, then refine the presentation without repeating business actions.",
        input:
          "A brief for a presentation cover, or a passed Capture recording with its saved result evidence.",
        output:
          "A customized PNG/WebP cover, or a guided MP4 and review stills. Silent by default; add your audio, a cloud/company voice or optional free local narration.",
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
    headline: ["让想法，", "成为可用的成果。"],
    intro: "理清想法，用心实现，检查结果，再让接收者看明白。与 AI Agent 协作的可复用方法和工具。",
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
      "制作有引导的演示视频，以及贴合品牌的演示封面。",
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
          "选择封面风格，换成你的内容和品牌。为通过检查的录制添加字幕和高亮，修改呈现时不必重复执行业务操作。",
        input: "封面内容需求，或 Capture 已通过检查的录制与结果证据。",
        output: "可定制的 PNG/WebP 封面，或有引导的 MP4 与供审阅的静帧。视频默认静音，也可导入音频、使用云端／公司声音，或按需安装免费本地配音。",
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
  const isLayoutsPage = window.location.pathname.replace(/\/$/, "") === "/layouts";
  const home = isCoversPage || isLayoutsPage ? (language === "zh" ? "/?lang=zh" : "/") : "";
  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
    <div className={`site ${language === "zh" ? "is-chinese" : ""}`}>
      <a href="#main" className="skip-link">
        {text.skip}
      </a>
      <header className="site-header">
        <div className="site-header-inner wrap">
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
            <a href={`/covers${language === "zh" ? "?lang=zh" : ""}`} aria-current={isCoversPage ? "page" : undefined}>{language === "zh" ? "封面" : "Covers"}</a>
            <a href={`/layouts${language === "zh" ? "?lang=zh" : ""}`} aria-current={isLayoutsPage ? "page" : undefined}>{language === "zh" ? "视频版式" : "Video layouts"}</a>
          </nav>
          <div className="header-tools">
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
            <ExternalLink href={REPO} className="header-github" aria-label={text.github} title={text.github}>
              {/* Classic GitHub Mark: primer/octicons v19.21.1 (MIT). */}
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
              </svg>
            </ExternalLink>
          </div>
        </div>
      </header>
      <main id="main">
        {isLayoutsPage ? <VideoLayouts language={language} /> : isCoversPage ? <CoverLibrary language={language} /> : <>
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
              <a className="button button-dark" href="#skills">{language === "zh" ? "看看这些能力" : "Explore the capabilities"}<Arrow /></a>
              {introduction?.video && <button className="hero-intro-link" onClick={() => setIntroductionOpen(true)} aria-haspopup="dialog">{language === "zh" ? "听 Aaron 介绍" : "Meet Aaron Skills"}<span aria-hidden="true">▷</span></button>}
            </div>
            <p className="hero-scope">{language === "zh" ? "v1.0.1 已发布 · 五项能力，七个 Skills" : "v1.0.1 released · Five capabilities, seven skills"}</p>
          </div>
          <WorkflowGraph language={language} />
        </section>
        <SkillEssentials language={language} onExploreDemo={setSelected} />
        <Showcases language={language} cases={review?.cases} />
        <section className="layout-teaser wrap"><p className="eyebrow">{language === "zh" ? "让产品成为主角" : "LET THE PRODUCT LEAD"}</p><h2>{language === "zh" ? "从开场，到每一帧。" : "From the opening to every frame."}</h2><p>{language === "zh" ? "6 组封面与视频页搭配，另加 2 种无装饰背景的简洁版。" : "Six cover and video treatments. Two unframed options. One clear story."}</p><a className="text-link" href={`/layouts${language === "zh" ? "?lang=zh" : ""}`}>{language === "zh" ? "探索视频版式" : "Explore the video collection"}<Arrow /></a></section>
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
    </MotionConfig>
    </LazyMotion>
  );
}
