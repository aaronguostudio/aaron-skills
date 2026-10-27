import { useLayoutEffect, useRef } from "react";

export function IntroVideo({ open, onClose, language, media }) {
  const dialog = useRef(null);
  const player = useRef(null);
  useLayoutEffect(() => {
    if (!open || !media?.video) return;
    const element = dialog.current;
    const scrollPosition = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    for (const video of document.querySelectorAll(".showcase-screen video")) video.pause();
    return () => {
      player.current?.pause();
      element.close();
      document.body.style.overflow = previousOverflow;
      window.scrollTo({ top: scrollPosition, behavior: "instant" });
    };
  }, [open, media?.video]);
  if (!media?.video) return null;
  return (
    <dialog className="intro-dialog" ref={dialog} aria-labelledby="intro-title" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="intro-sheet">
        <header><div><p className="eyebrow">AARON SKILLS / INTRODUCTION</p><h2 id="intro-title">{language === "zh" ? "Aaron Skills 是什么？" : "What is Aaron Skills?"}</h2></div><button className="intro-close" onClick={onClose} aria-label={language === "zh" ? "关闭介绍视频" : "Close introduction"}>×</button></header>
        {open && <video ref={player} controls playsInline preload="none" crossOrigin="anonymous" poster={media.poster} width="1600" height="900" aria-label={language === "zh" ? "Aaron Skills 英文介绍" : "Aaron Skills introduction in English"}>
          <source src={media.video} type="video/mp4" />
          {media.captions && <track kind="captions" src={media.captions} srcLang="en" label="English" />}
        </video>}
        <p className="intro-scope">{language === "zh" ? "v1.0.0 包含 Shape、Build、Verify、Capture、Film、Deliver、Share，按需使用。" : "v1.0.0 includes Shape, Build, Verify, Capture, Film, Deliver and Share. Use what you need."}</p>
        {media.transcript && <details><summary>{language === "zh" ? "阅读文字版介绍" : "Read the introduction"}</summary><p lang="en">{media.transcript}</p></details>}
      </div>
    </dialog>
  );
}
