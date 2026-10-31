import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CoverDesign } from "../../packages/demo/remotion/src/cover-library/CoverDesign";
import { getCoverPreset } from "../../packages/demo/covers/catalog";
import {usePresentationChoices, PresentationHandoff} from "./PresentationChoices";
import { coverConfiguration, coverBrief } from "./cover-handoff.mjs";

const artwork = import.meta.glob("../../packages/demo/covers/art/*.webp", { eager: true, query: "?url", import: "default" });
const copy = {
  en: { eyebrow:"Your selected style", back:"← Browse all styles", heading:"Make it yours", note:"Optional details can be left empty.", preview:"Live preview · 16:9", sample:"Preview uses sample wording until you enter a title.", sampleTitle:"Your next big idea", labels:{title:"Title",subtitle:"Subtitle",brandName:"Brand",presenter:"Presenter",date:"Date"}, colors:{background:"Background",foreground:"Text",accent:"Accent",secondary:"Secondary"}, titlePlaceholder:"Your presentation title", logo:"Logo", remove:"Remove logo", art:"Artwork keeps its original material and lighting.", handoff:"Keep working with your agent", detail:"Share this selection. Your agent can make the cover and use it in your video. Supply the logo file alongside the brief.", copy:"Copy cover brief", copied:"Copied ✓", copyFailed:"Select and copy the brief below.", download:"Download configuration ↓", required:"Enter a title to download a configuration.", brief:"Brief for your agent" },
  zh: { eyebrow:"已选封面风格", back:"← 浏览全部风格", heading:"换成你的内容", note:"未提供的可选信息可以留空。", preview:"实时预览 · 16:9", sample:"填写标题前，预览使用示例文字。", sampleTitle:"让下一个想法精彩开场", labels:{title:"标题",subtitle:"副标题",brandName:"品牌名称",presenter:"Presenter / 演讲者",date:"日期"}, colors:{background:"背景",foreground:"文字",accent:"强调色",secondary:"辅助色"}, titlePlaceholder:"你的 presentation 标题", logo:"Logo", remove:"移除 Logo", art:"素材保留原有的材质、色彩与光照。", handoff:"交给 Agent 继续制作", detail:"分享这个选择，Agent 可以制作封面并沿用到视频中。Logo 文件需要随需求一并提供。", copy:"复制封面说明", copied:"已复制 ✓", copyFailed:"请选中并复制下方需求。", download:"下载配置 ↓", required:"填写标题后可以下载配置。", brief:"给 Agent 的需求" },
};
export default function CoverEditor({ presetId, active, embedded = false, language, onBack }) {
  const preset = getCoverPreset(presetId), t = copy[language];
  const choices = usePresentationChoices();
  const Heading = embedded ? "h2" : "h1";
  const [fields,setFields] = useState({title:"",subtitle:"",brandName:"",presenter:"",date:""});
  const [colors,setColors] = useState({...preset.colors});
  const [logo,setLogo] = useState(null), [scale,setScale] = useState(1), [status,setStatus] = useState("");
  const stage=useRef(null), title=useRef(null);
  useEffect(()=>{setColors({...preset.colors});},[presetId]);
  useEffect(()=>{setStatus("");},[fields,colors,logo,presetId,language]);
  useEffect(()=>{choices?.setCover({preset,fields,colors,logoName:logo?.name});},[presetId,fields,colors,logo,choices?.setCover]);
  useEffect(()=>()=>{if(logo)URL.revokeObjectURL(logo.url);},[logo]);
  useLayoutEffect(()=>{
    if(!active)return;
    const el=stage.current,resize=()=>setScale(el.clientWidth/1600);
    resize();const observer=new ResizeObserver(resize);observer.observe(el);title.current?.focus({preventScroll:true});
    if (embedded) title.current?.scrollIntoView({block:"start",behavior:"instant"});
    return()=>observer.disconnect();
  },[active,embedded]);
  const brief=coverBrief({preset,fields,colors,logoName:logo?.name,language});
  const copyBrief=async()=>{try{await navigator.clipboard.writeText(brief);setStatus("copied");}catch{setStatus("fallback");}};
  const download=()=>{
    const config=coverConfiguration({preset,fields,colors,logoName:logo?.name});
    const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)+"\n"],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="presentation.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="cover-editor" hidden={!active}>
    <div className="cover-editor-heading"><div><p className="eyebrow">{t.eyebrow}</p><Heading id="cover-editor-title" tabIndex={-1} ref={title}>{preset.title[language]}</Heading><p>{preset.familyTitle[language]} · <code>{preset.id}</code></p></div><button onClick={onBack}>{t.back}</button></div>
    <div className="cover-editor-grid"><section className="cover-editor-preview" aria-label={t.preview}><div className="cover-stage" ref={stage}><div className="cover-canvas" style={{transform:`scale(${scale})`}}><CoverDesign title={fields.title || t.sampleTitle} subtitle={fields.subtitle} brandName={fields.brandName} cover={{preset:preset.id,presenter:fields.presenter,date:fields.date,colors}} logoSrc={logo?.url} artSrc={preset.art ? artwork[`../../packages/demo/covers/${preset.art}`] : undefined} width={1600} height={900}/></div></div><p className="cover-editor-note">{t.preview}{!fields.title&&` · ${t.sample}`}</p>
      {!embedded && <div className="cover-agent-handoff"><div><h2>{t.handoff}</h2><p>{t.detail}</p></div><button className="cover-primary" onClick={copyBrief}>{status==="copied"?t.copied:t.copy}</button><span role="status" className="cover-editor-note">{status==="copied"?t.copied:status==="fallback"?t.copyFailed:""}</span>{status==="fallback"&&<textarea aria-label={t.brief} value={brief} readOnly onFocus={e=>e.target.select()}/>}</div>}
      {embedded && <PresentationHandoff language={language}/>}
    </section>
    <aside className="cover-fields"><h2>{t.heading}</h2><p className="cover-editor-note">{t.note}</p>{Object.entries(t.labels).map(([key,label])=><label key={key} htmlFor={`cover-${key}`}>{label}<input id={`cover-${key}`} value={fields[key]} placeholder={key==="title"?t.titlePlaceholder:""} maxLength={key==="title"?100:key==="subtitle"?160:key==="presenter"?80:key==="date"?48:40} onChange={e=>setFields(v=>({...v,[key]:e.target.value}))}/></label>)}
      <div className="cover-color-fields">{Object.keys(colors).map(key=><label key={key} htmlFor={`cover-color-${key}`}>{t.colors[key]}<input id={`cover-color-${key}`} type="color" value={colors[key]} onChange={e=>setColors(v=>({...v,[key]:e.target.value}))}/></label>)}</div><p className="cover-editor-note">{t.art}</p>
      <label htmlFor="cover-logo">{t.logo}<input id="cover-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file&&["image/png","image/jpeg","image/webp"].includes(file.type))setLogo({name:file.name,url:URL.createObjectURL(file)});else setLogo(null);}}/></label>
      {logo&&<div className="cover-logo-status"><span>{logo.name}</span><button onClick={()=>setLogo(null)}>{t.remove}</button></div>}
      <button className="cover-config-download" disabled={!fields.title.trim()} onClick={download}>{t.download}</button>{!fields.title.trim()&&<p className="cover-editor-note">{t.required}</p>}
    </aside></div>
  </div>;
}
