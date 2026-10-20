import {useRef, useState} from 'react';
import layouts from './video-layouts.json';
import {layoutBrief} from './layout-handoff.mjs';
import './video-layouts.css';

const copy={
  en:{eyebrow:'THE DEMO COLLECTION',title:'Let the product',italic:'steal the scene.',intro:'A strong opening. A beautiful frame. Or just the video, with a few useful words below.',select:'Visual treatment',cover:'Opening cover',body:'Video page',play:'Play the demo',scenes:['Find your focus','Review the details','Move it forward'],collection:'Eight ways to tell your story.',all:'All treatments',studio:'Designed frames',plain:'No backdrop',use:'Use this combination',copied:'Brief copied',try:'Explore Forma',note:'Silent layout previews · Forma is a fictional product. Transcript preview uses step notes; imported narration can supply the spoken text.',agent:'Choose a name here, or ask your agent to recommend three combinations for your content and brand.',plainNote:'Straight to the product. No decorative backdrop or opening cover.',close:'Close brief',fallback:'Copy this brief to your agent',image:'Open full-size image',loading:'Loading preview…'},
  zh:{eyebrow:'视频演示作品集',title:'让产品，',italic:'成为主角。',intro:'有设计感的开场和视频页，也可以只保留视频，以及下面几句有用的讲解。',select:'视觉风格',cover:'开场封面',body:'视频页面',play:'播放演示',scenes:['聚焦工作','查看细节','更新结果'],collection:'八种选择，讲清你的故事。',all:'全部组合',studio:'设计感画框',plain:'无装饰背景',use:'使用这个组合',copied:'需求已复制',try:'体验 Forma 原型',note:'静音版式预览 · Forma 为虚构产品。Transcript 示例显示步骤讲解；导入旁白后可显示对应原文。',agent:'可以在这里选择名称，也可以让 Agent 根据内容与品牌推荐三组，直接在对话中完成。',plainNote:'直接进入产品。没有装饰背景，也不强制添加开场封面。',close:'关闭需求',fallback:'复制这段需求给 Agent',image:'查看原尺寸图片',loading:'正在加载预览…'}
};

export function VideoLayouts({language}){
  const t=copy[language];
  const initial=new URLSearchParams(window.location.search).get('style');
  const [selected,setSelected]=useState(()=>layouts.find(x=>x.id===initial)?.id??layouts[0].id);
  const [scene,setScene]=useState(0),[mode,setMode]=useState('body'),[filter,setFilter]=useState('all');
  const [playing,setPlaying]=useState(false),[brief,setBrief]=useState(false),[copied,setCopied]=useState(false),[mediaError,setMediaError]=useState(false);
  const player=useRef(null),stage=useRef(null);
  const item=layouts.find(x=>x.id===selected),poster=mode==='cover'?item.cover:item.stills[scene];
  function choose(id){
    player.current?.pause();setSelected(id);setPlaying(false);setMediaError(false);setCopied(false);setBrief(false);
    if(!layouts.find(x=>x.id===id).cover)setMode('body');
    const url=new URL(window.location.href);url.searchParams.set('style',id);window.history.replaceState(null,'',url);
  }
  async function useStyle(){setBrief(true);try{await navigator.clipboard.writeText(layoutBrief(item,language));setCopied(language);}catch{setCopied(false);}}
  const visible=layouts.filter(x=>filter==='all'||(filter==='plain')===x.id.startsWith('plain-'));
  return <div className="video-collection">
    <section className="vc-intro wrap"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}<br/><em>{t.italic}</em></h1></div><p>{t.intro}</p></section>
    <section className="vc-stage" style={{'--film-ratio':mode==='cover'?1600/900:item.width/item.height}} ref={stage} aria-label={language==='zh'?'版式预览':'Treatment preview'}>
      <div className="vc-toolbar"><label><span>{t.select}</span><select aria-label={t.select} value={selected} onChange={e=>choose(e.target.value)}>{layouts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><div className="vc-tabs" role="group" aria-label={language==='zh'?'预览类型':'Preview type'}>{['cover','body'].map(value=><button key={value} disabled={value==='cover'&&!item.cover} aria-pressed={mode===value} onClick={()=>{player.current?.pause();setMode(value);setPlaying(false);setMediaError(false);}}>{t[value]}</button>)}</div></div>
      <div className="vc-film" style={{background:item.color}}>
        {playing&&mode==='body'?<video key={selected+'-'+scene} ref={player} src={item.video} poster={poster} controls playsInline autoPlay preload="metadata" aria-label={`${item.name} — ${t.scenes[scene]}`} onLoadedMetadata={e=>{e.currentTarget.currentTime=item.sceneTimes[scene];}} onError={()=>{setMediaError(true);setPlaying(false);}}/>:<img src={poster} width={mode==='cover'?1600:item.width} height={mode==='cover'?900:item.height} alt={`${item.name} — ${mode==='cover'?t.cover:t.scenes[scene]}`} fetchPriority="high"/>}
        {!playing&&mode==='body'?<button className="vc-play" onClick={()=>{setPlaying(true);setMediaError(false);}}><span aria-hidden="true">▶</span>{t.play}</button>:null}
      </div>
      <div className="vc-foot"><div role="group" aria-label={language==='zh'?'预览场景':'Preview scene'}>{t.scenes.map((name,i)=><button key={name} aria-pressed={scene===i&&mode==='body'} onClick={()=>{player.current?.pause();setScene(i);setMode('body');setPlaying(false);setMediaError(false);}}><span>0{i+1}</span><span>{name}</span></button>)}</div><a href={poster} target="_blank" rel="noreferrer">{t.image} ↗</a></div>
      {mediaError?<p role="status">{language==='zh'?'视频暂时无法播放，请重试。':'Video could not play. Please try again.'}</p>:null}
    </section>
    <section className="vc-choices wrap"><div className="vc-heading"><h2>{t.collection}</h2><div className="vc-tabs" role="group" aria-label={language==='zh'?'筛选版式':'Filter layouts'}>{['all','studio','plain'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t[value]}</button>)}</div></div>
      <div className="vc-grid">{visible.map(x=><button key={x.id} className="vc-card" aria-pressed={x.id===selected} onClick={()=>{choose(x.id);stage.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}><img src={x.stills[0]} alt="" width={x.width} height={x.height} loading="lazy"/><strong>{x.name}</strong><small>{x.description[language]}</small></button>)}</div>
      <div className="vc-handoff"><div><h3>{item.name}</h3><p>{item.cover?item.description[language]:t.plainNote}</p></div><button className="button button-dark" onClick={useStyle}>{copied===language?t.copied:t.use}<span aria-hidden="true">↗</span></button></div>
      {brief?<div className="vc-brief"><label>{t.fallback}<textarea readOnly value={layoutBrief(item,language)} rows={10} onFocus={e=>e.target.select()}/></label><button onClick={()=>setBrief(false)}>{t.close}</button></div>:null}
      <p className="vc-agent">{t.agent}</p><div className="vc-note"><p>{t.note}</p><a href="/layouts/forma/index.html" target="_blank" rel="noreferrer">{t.try} ↗</a></div>
    </section>
  </div>;
}
