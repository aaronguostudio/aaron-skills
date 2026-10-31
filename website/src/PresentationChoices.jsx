import React, {createContext, useContext, useEffect, useState} from 'react';
import {presentationBrief} from './presentation-handoff.mjs';

const Context=createContext(null);
export const usePresentationChoices=()=>useContext(Context);
export function PresentationProvider({children}) {
 const [layout,setLayout]=useState(null),[cover,setCover]=useState(null);
 return <Context.Provider value={{layout,setLayout,cover,setCover}}>{children}</Context.Provider>;
}
export function PresentationHandoff({language}) {
 const choices=usePresentationChoices(),[status,setStatus]=useState('');
 const zh=language==='zh';
 const layout=choices?.layout,cover=choices?.cover;
 useEffect(()=>setStatus(''),[layout,cover,language]);
 if(!layout && !cover) return null;
 const brief=presentationBrief({layout,cover,language});
 async function copy(){try{await navigator.clipboard.writeText(brief);setStatus('copied');}catch{setStatus('fallback');}}
 return <section className="presentation-handoff" aria-label={zh?'你的呈现选择':'Your presentation choices'}>
   <div><h3>{zh?'你的选择':'Your choices'}</h3><p>{zh?'视频版式':'Video layout'}: <strong>{layout?.name ?? (zh?'尚未选择':'Not selected')}</strong><br/>{zh?'开场封面':'Opening cover'}: <strong>{(cover?.none ? (zh?'不要封面':'No opening cover') : cover?.preset.title[language]) ?? (zh?'尚未选择':'Not selected')}</strong></p><p>{layout&&cover?(zh?'两项选择会一起交给 Agent。':'Both choices will be included for your agent.'):(zh?'未选择的部分会留待确认。':'The unselected choice will be left for confirmation.')}</p></div>
   <button className="presentation-copy" onClick={copy}>{status==='copied'?(zh?'已复制':'Copied'):(zh?'复制选择给 Agent':'Copy choices for your agent')}</button>
   {status==='fallback'&&<label className="presentation-fallback">{zh?'请选择并复制下方说明':'Select and copy the brief below'}<textarea readOnly value={brief} rows={8} onFocus={e=>e.target.select()}/></label>}
   <span className="presentation-status" role="status">{status==='copied'?(zh?'选择说明已复制。':'Your choices have been copied.') : ''}</span>
 </section>;
}
