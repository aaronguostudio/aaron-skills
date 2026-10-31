import {useEffect, useMemo, useState} from 'react';
import layouts from './video-layouts.json';
import covers from './covers.json';
import {getCoverPreset} from '../../packages/demo/covers/catalog';
import {FilmPreview} from './FilmPreview';
import {contrastRatio} from '../../packages/demo/remotion/src/projects/walkthrough-video/presentation/theme';
import {studioBrief,studioConfig} from './presentation-studio.mjs';
import './presentation-studio.css';

const families=[...new Map(covers.map(c=>[c.family,c.familyTitle])).entries()];
const text={
 en:{eyebrow:'Video presentation',title:'Make the presentation yours.',intro:'Pick a cover, choose a video layout, and watch them together.',cover:'Opening cover',layout:'Video layout',noCover:'No cover',all:'All styles',category:'Cover styles',filters:'Search and filter',moreCovers:'Show all covers',fewerCovers:'Show fewer covers',search:'Search covers',empty:'No matching covers.',details:'Your presentation',titleField:'Demo title',subtitle:'Subtitle',brand:'Company name',presenter:'Presenter',date:'Date',colors:'Cover colors',background:'Background',foreground:'Text',accent:'Accent',secondary:'Secondary',contrast:'Increase the contrast between cover background and text before downloading.',sample:'The cover uses sample wording until you enter your own.',view:'Live combination preview',coverPhase:'Opening cover',videoPhase:'Video layout',play:'Play combination',replay:'Replay combination',wait:'Choose a cover or choose no cover to preview the combination.',summary:'Your choices',unselected:'Not chosen',copy:'Copy brief',copied:'Copied',download:'Download configuration',needChoice:'Choose a cover or no cover to download a configuration.',fallback:'Select and copy the brief below',advanced:'Advanced cover editor (opens separately; details are not transferred)',note:'A real recording of fictional Forma, shown with Film’s layout and your cover. Preview is silent; your final video is rendered separately with your recording.',status:'Your brief was copied.',failure:'The sample could not load.',logo:'Logo',removeLogo:'Remove logo',logoConfirm:'This logo represents my company',logoHelp:'Your logo stays in this browser. Supply the logo file with the downloaded configuration.',logoNeeded:'Confirm that the uploaded logo represents your company to include it in the configuration.'},
 zh:{eyebrow:'视频呈现',title:'让每一帧，贴合你的故事。',intro:'先选封面，再选视频版式，直接预览两者的组合。',cover:'开场封面',layout:'视频版式',noCover:'不使用封面',all:'全部风格',category:'封面分类',filters:'搜索与筛选',moreCovers:'显示全部封面',fewerCovers:'收起封面',search:'搜索封面',empty:'没有找到匹配的封面。',details:'你的演示',titleField:'演示标题',subtitle:'副标题',brand:'公司名称',presenter:'演讲者',date:'日期',colors:'封面颜色',background:'背景',foreground:'文字',accent:'强调色',secondary:'辅助色',contrast:'请增大封面背景与文字的对比度，然后再下载配置。',sample:'填写内容前，封面使用示例文字。',view:'组合实时预览',coverPhase:'开场封面',videoPhase:'视频正文',play:'播放组合',replay:'重新播放',wait:'请选择封面，或选择不使用封面，然后预览组合。',summary:'你的选择',unselected:'尚未选择',copy:'复制给 Agent',copied:'已复制',download:'下载配置',needChoice:'选择封面或不使用封面后，即可下载配置。',fallback:'请选择并复制下方说明',advanced:'高级封面编辑器（单独打开，不会带入当前填写内容）',note:'使用虚构 Forma 的真实录屏，结合 Film 版式和你选择的封面。预览无声音；最终视频需用你自己的录屏单独渲染。',status:'选择说明已复制。',failure:'示例暂时无法加载。',logo:'Logo',removeLogo:'移除 Logo',logoConfirm:'这个 Logo 代表我的公司',logoHelp:'Logo 仅保存在当前浏览器中；使用下载的配置时，请一并提供 Logo 文件。',logoNeeded:'请确认上传的 Logo 代表你的公司，然后再下载配置。'}
};
function readInitial(){const p=new URLSearchParams(window.location.search);const legacy=window.location.pathname.replace(/\/$/,'');return {layout:p.get('layout')??(legacy==='/layouts'?p.get('style'):null),cover:p.get('cover')??(legacy==='/covers'?p.get('style'):null)};}
const defaults={title:'',subtitle:'',brandName:'',presenter:'',date:''};
const COVER_MS=3000;
export function PresentationStudio({language}){
 const t=text[language],initial=useMemo(readInitial,[]);
 const [layoutId,setLayoutId]=useState(()=>layouts.find(x=>x.id===initial.layout)?.id??layouts[0].id);
 const [coverId,setCoverId]=useState(()=>initial.cover==='none'||covers.some(x=>x.id===initial.cover)?initial.cover:null);
 const [colors,setColors]=useState(()=>initial.cover&&initial.cover!=='none'&&covers.some(x=>x.id===initial.cover)?{...getCoverPreset(initial.cover).colors}:null);
 const [savedColors,setSavedColors]=useState({});
 const [phase,setPhase]=useState(()=>initial.cover&&covers.some(x=>x.id===initial.cover)?'cover':'video');
 const [playing,setPlaying]=useState(false),[hasPlayed,setHasPlayed]=useState(false),[run,setRun]=useState(0),[failed,setFailed]=useState(false),[logo,setLogo]=useState(null),[logoConfirmed,setLogoConfirmed]=useState(false);
 const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[fields,setFields]=useState(defaults),[showFilters,setShowFilters]=useState(false),[showAll,setShowAll]=useState(false),[copyStatus,setCopyStatus]=useState('');
 const layout=layouts.find(x=>x.id===layoutId),cover=coverId==='none'?{none:true}:coverId?{preset:getCoverPreset(coverId),colors}:null;
 const chosenCover=cover?.preset;
 const visible=covers.filter(c=>(filter==='all'||c.family===filter)&&`${c.id} ${c.title.en} ${c.title.zh} ${c.familyTitle.en} ${c.familyTitle.zh}`.toLowerCase().includes(search.trim().toLowerCase()));
 const shownCovers=showAll||search||filter!=='all'?visible:visible.slice(0,8).concat(visible.slice(8).filter(c=>c.id===coverId));
 const brief=studioBrief({layout,cover,fields,language,logoName:logo?.name});
 const insufficient=Boolean(chosenCover&&colors&&contrastRatio(colors.background,colors.foreground)<4.5);
 useEffect(()=>{setCopyStatus('');},[layoutId,coverId,fields,colors,language,logo]);
 useEffect(()=>{if(!playing||phase!=='cover')return;const timer=setTimeout(()=>setPhase('video'),COVER_MS);return()=>clearTimeout(timer);},[playing,phase,coverId,layoutId]);
 useEffect(()=>()=>{if(logo)URL.revokeObjectURL(logo.url);},[logo]);
 function updateUrl(key,value){const url=new URL(window.location.href);url.searchParams.set(key,value);url.searchParams.delete('style');url.searchParams.delete('browse');window.history.replaceState(null,'',url);}
 function begin(hasCover){setFailed(false);setRun(v=>v+1);setHasPlayed(true);setPhase(hasCover?'cover':'video');setPlaying(true);}
 function pickLayout(id){setLayoutId(id);updateUrl('layout',id);begin(Boolean(coverId&&coverId!=='none'));}
 function pickCover(id){setCoverId(id);setColors(id==='none'?null:{...(savedColors[id]??getCoverPreset(id).colors)});updateUrl('cover',id);begin(id!=='none');}
 function editField(key,value){setPlaying(false);setPhase(chosenCover?'cover':'video');setFields(v=>({...v,[key]:value}));}
 function editColor(key,value){setPlaying(false);setPhase(chosenCover?'cover':'video');const next={...colors,[key]:value};setColors(next);setSavedColors(v=>({...v,[coverId]:next}));}
 async function copy(){try{await navigator.clipboard.writeText(brief);setCopyStatus('copied');}catch{setCopyStatus('fallback');}}
 function download(){const config=studioConfig({layout,cover,fields,logo:logo&&logoConfirmed?logo:null});const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='presentation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="presentation-studio wrap">
  <header className="ps-heading"><div><p className="ps-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1></div><p>{t.intro}</p></header>
  <div className="ps-workspace">
   <section className="ps-preview" aria-label={t.view}>
    <div className="ps-preview-bar"><div><span>{t.view}</span><strong>{phase==='cover'&&chosenCover?t.coverPhase:t.videoPhase}</strong></div>{cover&&<button className="ps-replay" onClick={()=>begin(Boolean(chosenCover))}>{hasPlayed?t.replay:t.play}</button>}</div>
    <div className="ps-canvas" data-phase={phase}>
     <FilmPreview key={run} layout={layout} cover={cover} fields={fields} logo={logo} language={language} phase={phase} playing={playing} onEnd={()=>setPlaying(false)} onError={()=>{setFailed(true);setPlaying(false);}}/>

    </div>
    {!cover&&<p className="ps-preview-note">{t.wait}</p>}{chosenCover&&phase==='cover'&&!fields.title&&<p className="ps-preview-note">{t.sample}</p>}
    {failed&&<p className="ps-warning" role="status">{t.failure}</p>}<p className="ps-evidence-note">{t.note}</p>
   </section>
   <aside className="ps-selector" aria-label={language==='zh'?'选择封面和版式':'Choose your presentation'}>
    <div className="ps-selector-scroll">
     <section className="ps-brand-editor" aria-labelledby="ps-brand-title"><h2 id="ps-brand-title">{t.details}</h2><div className="ps-fields">{[['title',t.titleField,100],['brandName',t.brand,40]].map(([key,label,max])=><label key={key}>{label}<input value={fields[key]} maxLength={max} onChange={e=>editField(key,e.target.value)}/></label>)}<label>{t.logo}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];setLogoConfirmed(false);setLogo(file&&["image/png","image/jpeg","image/webp"].includes(file.type)?{name:file.name,url:URL.createObjectURL(file)}:null);}}/></label>{logo&&<div className="ps-logo-options"><span>{logo.name}</span><button type="button" onClick={()=>{setLogo(null);setLogoConfirmed(false);}}>{t.removeLogo}</button><label><input type="checkbox" checked={logoConfirmed} onChange={e=>setLogoConfirmed(e.target.checked)}/>{t.logoConfirm}</label><p>{t.logoHelp}</p></div>}{chosenCover&&<fieldset className="ps-colors"><legend>{t.colors}</legend>{Object.keys(colors??{}).map(key=><label key={key}>{t[key]}<input type="color" value={colors[key]} onChange={e=>editColor(key,e.target.value)}/></label>)}</fieldset>}{insufficient&&<p className="ps-warning" role="status">{t.contrast}</p>}<details className="ps-more-details"><summary>{language==='zh'?'更多内容':'More details'}</summary>{[['subtitle',t.subtitle,160],['presenter',t.presenter,80],['date',t.date,48]].map(([key,label,max])=><label key={key}>{label}<input value={fields[key]} maxLength={max} onChange={e=>editField(key,e.target.value)}/></label>)}</details></div><p className="ps-mobile-note">{t.note}</p></section>
     <section className="ps-option-group" id="covers" aria-labelledby="ps-cover-title"><div className="ps-option-heading"><span>1</span><h2 id="ps-cover-title">{t.cover}</h2></div>
      <button className="ps-filter-toggle" aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}>{t.filters}{(search||filter!=='all')?` · ${visible.length}`:''} <span aria-hidden="true">{showFilters?'−':'+'}</span></button>{showFilters&&<div className="ps-cover-controls"><label><span>{t.search}</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label><span>{t.category}</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t.all}</option>{families.map(([id,title])=><option key={id} value={id}>{title[language]}</option>)}</select></label></div>}
      <div className="ps-option-strip ps-cover-strip" role="group" aria-label={t.cover}><button className="ps-cover-option ps-none" aria-pressed={coverId==='none'} onClick={()=>pickCover('none')}><span>{t.noCover}</span></button>{shownCovers.map(c=><button className="ps-cover-option" key={c.id} aria-pressed={coverId===c.id} onClick={()=>pickCover(c.id)}><img src={c.thumbnail} width={c.width} height={c.height} alt="" loading="lazy"/><span>{c.title[language]}</span></button>)}</div>{!visible.length&&<p className="ps-empty">{t.empty}</p>}{!search&&filter==='all'&&visible.length>8&&<button className="ps-show-all" aria-expanded={showAll} onClick={()=>setShowAll(!showAll)}>{showAll?t.fewerCovers:t.moreCovers} {showAll?'−':'+'}</button>}

     </section>
     <section className="ps-option-group" aria-labelledby="ps-layout-title"><div className="ps-option-heading"><span>2</span><h2 id="ps-layout-title">{t.layout}</h2></div><div className="ps-option-strip ps-layout-strip" role="group" aria-label={t.layout}>{layouts.map(x=><button key={x.id} className="ps-layout-item" aria-pressed={layoutId===x.id} onClick={()=>pickLayout(x.id)}><img src={x.stills[0]} width={x.width} height={x.height} alt=""/><span><strong>{x.name}</strong><small>{x.description[language]}</small></span></button>)}</div></section>
    </div>
    <div className="ps-actions"><div className="ps-summary"><span>{t.summary}</span><p>{t.cover}: <strong>{chosenCover?.title[language]??(cover?.none?t.noCover:t.unselected)}</strong><br/>{t.layout}: <strong>{layout.name}</strong></p></div><div className="ps-buttons"><button className="ps-primary" onClick={copy}>{copyStatus==='copied'?t.copied:t.copy}</button><button className="ps-secondary" disabled={!cover||insufficient||(logo&&!logoConfirmed)} onClick={download}>{t.download}</button></div>{!cover&&<p className="ps-help">{t.needChoice}</p>}{insufficient&&<p className="ps-warning" role="status">{t.contrast}</p>}{logo&&!logoConfirmed&&<p className="ps-help">{t.logoNeeded}</p>}{copyStatus==='fallback'&&<label className="ps-fallback">{t.fallback}<textarea readOnly value={brief} rows={7} onFocus={e=>e.target.select()}/></label>}<span className="ps-sr" role="status">{copyStatus==='copied'?t.status:''}</span></div>
   </aside>
  </div>
 </div>;
}
