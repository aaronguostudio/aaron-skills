import {people, equipment, createStore, can} from './model.mjs';

const esc = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = document.querySelector('#view');
let packet;
let store = createStore(), actorId = 'jules', selectedId = 'REQ-104', selected;
let pending = false, failNext = false, feedback = '', error = false, retryable = false, lastOperation, edits = {}, reasonText = '';
const pageNames = ['overview','evidence','clarify','workflow','model','prototype','handoff'];
const tags = (values) => values.map(v => `<span class="tag">${esc(v)}</span>`).join(' ');
const head = (n, title, description) => `<div class="page-head"><div class="eyebrow">${n} / FIELDNOTE DESIGN PACKET</div><h1>${title}</h1><p class="lede">${description}</p></div>`;
const notice = (value) => `<div class="notice">${esc(value)}</div>`;
function overview() {
  return `<section class="hero"><div><div class="eyebrow">A SMALL REQUEST. A COMPLETE BLUEPRINT.</div><h1>From a conversation<br>to something<br><em>buildable.</em></h1><p class="lede">Meet Fieldnote, a fictional studio that borrows equipment. Follow one ambiguous request through questions, decisions, diagrams and a working design.</p><div class="actions"><a class="button" href="#prototype">Try the prototype <span>↗</span></a><a class="button secondary" href="#evidence">Start with the brief</a></div></div><div class="hero-art" role="img" aria-label="Notes become a shared blueprint, then an implementation handoff"><div class="orbit"></div><div class="orbit two"></div><div class="art-card">01 / THE REQUEST<i></i><i></i><i></i>“Can we borrow a kit?”</div><div class="art-center"><b>✳</b><span>BLUEPRINT</span></div><div class="art-card last">06 / THE HANDOFF<i></i><i></i>Ready to build, together.</div><span class="art-caption">EVIDENCE → DECISIONS → DESIGN</span></div></section>
  ${notice(packet.notice)}<div class="section-label"><span>ONE CASE / SIX CONNECTED VIEWS</span><span>DESIGNED, NOT DEPLOYED</span></div><div class="journey">${[
    ['evidence','01','Start with evidence','An intake, a messy meeting and a source ledger.'],
    ['clarify','02','Ask what changes the design','Two rounds. Seven questions. One deferred decision.'],
    ['workflow','03','Make the rules visible','Four states, five transitions and explicit ownership.'],
    ['model','04','Give the system a shape','Requests, people, audit events and retry records.'],
    ['prototype','05','Try the hard parts','Submit, reject, revise, approve — and recover.'],
    ['handoff','06','Leave a buildable contract','Ten acceptance scenarios across three thin slices.']
  ].map(([url,n,title,copy]) => `<a class="card" href="#${url}"><span class="number">${n} /</span><h3>${title}</h3><p>${copy}</p></a>`).join('')}</div>`;
}
function evidence() {
  return head('01','A request is a starting point.<br><em>Evidence adds the edges.</em>','Meeting suggestions and product decisions have different authority. Here the answer fixtures are deliberately authored; no real meeting or client context was read.') +
  `<div class="two-col"><div class="card"><div class="eyebrow">THE OUTCOME</div><h3>One place to ask. One clear decision.</h3><p>${esc(packet.outcome)}</p><ul>${packet.scope.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div><div class="card"><div class="eyebrow">OUTSIDE THE PILOT</div><h3>A small, honest boundary.</h3><ul>${packet.excluded.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div></div><h2 class="section-title">The source ledger</h2>${packet.sources.map(s => `<article class="card source"><div class="tiny">${esc(s.id)} / ${esc(s.date)}</div><h3>${esc(s.title)}</h3><p>${esc(s.authority)}</p><blockquote>${esc(s.excerpt)}</blockquote><a href="${esc(s.location)}" target="_blank" rel="noopener">Read authored source ↗</a></article>`).join('')}`;
}
function clarification() {
  return head('02','Questions that change<br><em>what we build.</em>','The first round fixes ownership and scope. A flow sketch exposes the next round: retries, history and recovery. Answers below are scripted fictional inputs.') + [1,2].map(round => `<div class="round-title">ROUND ${round} / ${round === 1 ? 'AUTHORITY, STATES & SCOPE' : 'RETRIES, HISTORY & RECOVERY'}</div>${packet.questions.filter(q=>q.round===round).map(q => `<details class="card question" ${['Q1','Q4'].includes(q.id)?'open':''}><summary><span class="number">${esc(q.id)}</span>${esc(q.question)} <span class="tag ${q.status==='deferred'?'warn':''}">${esc(q.status)}</span></summary><p><b>Why it matters.</b> ${esc(q.why)}</p><p><b>Options.</b> ${q.options.map(esc).join(' / ')}</p><p><b>Recommendation.</b> ${esc(q.recommendation)}</p><div class="answer"><p><b>Fictional answer.</b> ${esc(q.answer)}</p><span class="tiny">${q.sources.map(esc).join(' + ')} → ${q.decisions.map(esc).join(', ')} · ${q.blocking?'Blocking question, now resolved':'Nonblocking / outside pilot'}</span></div><p><b>Next.</b> ${esc(q.next)}</p></details>`).join('')}`).join('') + notice('Contradictions resolved: “anyone can approve” became coordinator-only review; editing after sending became a locked submission with a rejection → revision path.');
}
function flowDiagram() {
  const nodes={Draft:[65,94,'#fdfdf5'],Submitted:[365,94,'#e2e7f5'],Approved:[680,94,'#d2e5ce'],Rejected:[680,196,'#f0dec8']};
  const paths={Draft_Draft:['M110 94 V45 H177 V94',98,32],Draft_Submitted:['M215 120 H365',245,104],Submitted_Approved:['M515 120 H680',532,104],Submitted_Rejected:['M440 148 V222 H680',466,208],Rejected_Draft:['M752 250 V273 H140 V148',290,263]};
  return `<div class="flow"><svg viewBox="0 0 940 290" role="img" aria-label="${esc(packet.transitions.map(t=>`${t.actor}: ${t.action}, ${t.from} to ${t.to}`).join('. '))}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#718366"/></marker></defs>${packet.transitions.map(t=>{const [path,x,y]=paths[`${t.from}_${t.to}`];return `<path d="${path}" stroke="#718366" fill="none" stroke-width="1.5" marker-end="url(#arrow)"/><text class="edge" x="${x}" y="${y}">${esc(t.action)} / ${esc(t.id)}</text>`;}).join('')}${packet.states.map(s=>{const [x,y,color]=nodes[s.id];return `<rect x="${x}" y="${y}" width="150" height="54" rx="8" fill="${color}" stroke="#a8bb9e"/><text x="${x+75}" y="${y+32}" text-anchor="middle" fill="#2a4934">${esc(s.label)}</text>`;}).join('')}</svg></div>`;
}
function workflow() {
  return head('03','A shared picture.<br><em>With explicit rules.</em>','Approval grants permission to borrow. It does not reserve inventory. There are no hidden shortcuts from a decided request back into editing.') +
  flowDiagram() + `<div class="card">${packet.transitions.map(t=>`<div class="transition"><strong>${esc(t.from)} → ${esc(t.to)}</strong><span>${esc(t.actor)} · ${esc(t.action)}</span><span class="tiny">${esc(t.id)} / ${t.rules.map(esc).join(' ')}</span></div>`).join('')}</div><h2 class="section-title">The rules behind the arrows</h2><div class="card rule-list">${packet.rules.map(r=>`<div class="rule"><span class="tag">${esc(r.id)}</span><div><p>${esc(r.text)}</p><span class="tiny">${r.decisions.map(esc).join(', ')} → ${packet.acceptance.filter(a=>a.rules.includes(r.id)).map(a=>a.id).join(', ')}</span></div></div>`).join('')}</div>`;
}
function model() {
  return head('04','A model for the decisions.<br><em>And the decisions before them.</em>','Conceptual entities, not a database migration. The audit event preserves why a request changed; the operation record makes an exact retry safe.') + `<div class="model-grid">${packet.entities.map(e=>`<article class="card entity"><h3>${esc(e.id)}</h3><table aria-label="${esc(e.id)} fields"><tbody>${e.fields.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(f.type)}</td><td>${esc(f.key)}</td></tr>`).join('')}</tbody></table></article>`).join('')}</div><div class="relations">${packet.relationships.map(r=>`<span class="relation">${esc(r.from)} 1 → ${r.cardinality==='one-many'?'0..n':'1'} ${esc(r.to)} · ${esc(r.label)}</span>`).join('')}</div><div class="two-col"><div class="card"><h3>The invariants</h3><ul><li>Owner identity comes from the server session.</li><li>A write atomically changes one version and adds one event.</li><li>Unique (actor, operation ID) protects exact retries.</li><li>Revision clears the current reason; history survives.</li></ul></div><div class="card"><h3>The implementation gap</h3><p>Prototype fields use readable fixture IDs and browser memory. UUIDs, server timestamps, database transactions, retention and identity integration belong to the real build. Every slice says what still needs proving.</p></div></div>`;
}
function handoff() {
  return head('06','Give the next engineer<br><em>a clear place to start.</em>','A source-backed rule is useful only if someone can implement it and observe whether it works. These slices define that handoff; they do not authorize deployment.') +
  notice('Packet status: structurally ready for this fictional pilot. Q7 (email) is deferred and nonblocking. Independent builder evaluation, real backend integration and user acceptance remain unverified.') +
  packet.slices.map(s=>`<article class="card slice"><div class="tiny">${esc(s.id)} / DEPENDS ON ${s.dependsOn.map(esc).join(', ')||'NONE'}</div><h3>${esc(s.title)}</h3><p>${esc(s.outcome)}</p><p>${esc(s.notes)}</p>${tags(s.acceptance)}</article>`).join('')+
  `<h2 class="section-title">Ten observable acceptance scenarios</h2>${packet.acceptance.map(a=>`<details class="acceptance"><summary><span class="tag">${esc(a.id)}</span> ${esc(a.when)}</summary><p><b>Given</b> ${esc(a.given)}.</p><p><b>When</b> ${esc(a.when)}.</p><p><b>Then</b> ${esc(a.then)}.</p><p><b>Verify</b> ${esc(a.verify)}</p>${tags(a.rules)}</details>`).join('')}<h2 class="section-title">What this case does not prove</h2><div class="card"><ul>${packet.limits.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><a class="raw-link" href="blueprint.json" target="_blank" rel="noopener">Inspect the canonical packet ↗</a></div>`;
}
function prototype() {
  const records = store.list(actorId);
  if (!records.some(r=>r.id===selectedId)) selectedId = records[0]?.id;
  if (!selected || selected.id !== selectedId) selected = selectedId ? store.read(selectedId,actorId) : null;
  const record = selected ? {...selected,...edits} : null;
  const editable = record && can(record,actorId,'save') && !pending;
  const field = (label,name,type='text') => `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(record[name])}" ${editable?'':'disabled'}></label>`;
  return head('05','A little less imagining.<br><em>A little more trying.</em>','Start as Jules: submit a request. Switch to Morgan to reject it, then return as Jules to revise and resubmit. Try stale views and simulated failures along the way.')+
    notice('SIMULATION · All identities and requests are fictional. The role picker is not sign-in. Writes live in browser memory; reload or Reset clears them. Approval never reserves stock. Seeded requests begin with no prior events.')+
    `<section aria-label="Equipment request prototype"><div class="prototype-toolbar"><label>SIMULATED IDENTITY<select id="actor" ${pending?'disabled':''}>${Object.values(people).map(p=>`<option value="${p.id}" ${p.id===actorId?'selected':''}>${p.name} · ${p.role}</option>`).join('')}</select></label><div class="toolbar-buttons"><button id="new-request" ${pending?'disabled':''}>+ New request</button><button class="secondary" id="empty-list" ${pending?'disabled':''}>Empty scenario</button><button class="secondary" id="reset" ${pending?'disabled':''}>Reset</button></div></div><div class="workspace" aria-busy="${pending}"><aside class="request-list" aria-label="Visible requests"><h3>${records.length} VISIBLE REQUEST${records.length===1?'':'S'}</h3>${records.map(r=>`<button class="request-item ${r.id===selectedId?'selected':''}" data-request="${esc(r.id)}" aria-pressed="${r.id===selectedId}" ${pending?'disabled':''}><small>${esc(r.id)}</small><strong>${esc(r.equipment)}</strong><span class="status ${esc(r.status)}">${esc(r.status)}</span><small>${esc(people[r.ownerId].name)}</small></button>`).join('')}</aside><div class="request-detail"><div id="feedback" class="message ${error?'error':''}" role="status" aria-live="polite">${esc(feedback)}</div>${record ? `<div class="detail-heading"><div><div class="tiny">${esc(record.id)} / VERSION ${record.version}</div><h3>${esc(record.equipment)}</h3></div><span class="status ${esc(record.status)}">${esc(record.status)}</span></div>${record.rejectionReason?`<div class="notice"><b>Decision note.</b> ${esc(record.rejectionReason)}</div>`:''}<form id="request-form"><div class="form-grid"><label class="field wide">Equipment<select name="equipment" ${editable?'':'disabled'}>${equipment.map(v=>`<option ${v===record.equipment?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="field wide">Purpose <span class="tiny">10–240 characters to submit</span><textarea name="purpose" maxlength="240" ${editable?'':'disabled'}>${esc(record.purpose)}</textarea></label>${field('Start date','startDate','date')}${field('End date','endDate','date')}</div><div class="actions">${[['save','Save draft'],['submit','Submit request'],['revise','Revise request'],['approve','Approve request']].filter(([a])=>can(record,actorId,a)).map(([a,t])=>`<button type="button" data-action="${a}" ${pending?'disabled':''} class="${a==='save'?'secondary':''}">${t}</button>`).join('')}${pending?'<span class="hint">Saving simulated action…</span>':''}</div>${can(record,actorId,'reject')?`<div style="margin-top:18px"><label class="field">Rejection reason <span class="tiny">5–240 characters</span><textarea name="reason" maxlength="240" ${pending?'disabled':''}>${esc(reasonText)}</textarea></label><div class="actions"><button type="button" class="secondary" data-action="reject" ${pending?'disabled':''}>Reject request</button></div></div>`:''}</form><p class="hint">${record.status==='Approved'?'Approval is terminal in this pilot. No kit has been reserved.':record.ownerId===actorId && people[actorId].role==='coordinator' && record.status==='Submitted'?'Self-review is blocked. Another coordinator would be needed in a real system.':record.status==='Submitted' && people[actorId].role==='requester'?'Submitted requests are locked while waiting for a coordinator.':'Only actions allowed by your simulated role and the current state are shown.'}</p>${retryable?'<button class="secondary" id="retry" '+(pending?'disabled':'')+'>Retry last action</button>':''}<div class="history"><h4>REQUEST HISTORY / R5</h4>${record.history.length?record.history.slice().reverse().map(e=>`<div class="event"><b>${esc(people[e.actorId].name)}</b> · ${esc(e.action)} · ${esc(e.from)} → ${esc(e.to)}${e.reason?`<p>${esc(e.reason)}</p>`:''}<br><small>${esc(e.id)} / ${esc(e.operationId)}</small></div>`).join(''):'<p>No changes recorded in this fixture yet.</p>'}</div>`:`<div class="empty"><div class="eyebrow">A FRESH START</div><h3>No requests yet.</h3><p>Create a draft to start a new equipment request.</p><button id="empty-create">Create first request</button></div>`}</div></div><div class="lab-controls"><span class="tiny">TEST THE EDGES / R4 + R6</span><label><input id="fail-next" type="checkbox" ${failNext?'checked':''} ${pending?'disabled':''}> Fail next write once</label><button class="secondary" id="stale" ${!record||pending||record.version<1?'disabled':''}>Simulate stale view</button><button class="secondary" id="refresh" ${!record||pending?'disabled':''}>Refresh request</button><span>Test controls simulate conditions; they are not production features.</span></div></section>`;
}
function route() { return pageNames.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview'; }
function render() {
  const page = route();
  document.querySelectorAll('nav a').forEach(a=>{ a.classList.toggle('active',a.dataset.page===page); if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current'); });
  view.innerHTML = ({overview,evidence,clarify:clarification,workflow,model,prototype,handoff}[page])();
  if (page === 'prototype') bindPrototype();
}
function clearFeedback() { feedback=''; error=false; retryable=false; edits={}; reasonText=''; }
function newRequest() { clearFeedback(); selected=store.createDraft(actorId);selectedId=selected.id;render(); }
function bindPrototype() {
  document.querySelector('#actor').addEventListener('change',e=>{actorId=e.target.value;selected=null;clearFeedback();render();});
  document.querySelector('#new-request').onclick=newRequest;
  document.querySelector('#empty-create')?.addEventListener('click',newRequest);
  document.querySelector('#reset').onclick=()=>{store=createStore();selected=null;selectedId='REQ-104';clearFeedback();failNext=false;render();};
  document.querySelector('#empty-list').onclick=()=>{store=createStore({empty:true});selected=null;selectedId=null;clearFeedback();render();};
  document.querySelectorAll('[data-request]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.request;selected=null;clearFeedback();render();});
  document.querySelector('#fail-next').onchange=e=>{failNext=e.target.checked;};
  document.querySelector('#stale').onclick=()=>{selected.version-=1;feedback='An older version is now displayed. Try a write to see the conflict, then Refresh request.';error=false;render();};
  document.querySelector('#refresh').onclick=()=>{selected=store.read(selectedId,actorId);clearFeedback();feedback='Refreshed to the current simulated version.';render();};
  document.querySelector('#retry')?.addEventListener('click',()=>execute(lastOperation));
  document.querySelector('#request-form')?.addEventListener('submit',e=>e.preventDefault());
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
    const action=b.dataset.action;
    const form=new FormData(document.querySelector('#request-form'));
    const patch=['save','submit'].includes(action)?Object.fromEntries(['equipment','purpose','startDate','endDate'].map(k=>[k,String(form.get(k)??'')])):{};
    edits=patch;reasonText=String(form.get('reason')??'');
    execute({id:selectedId,actorId,action,expectedVersion:selected.version,operationId:crypto.randomUUID(),patch,reason:action==='reject'?reasonText:''});
  });
}
async function execute(operation) {
  if(pending)return;
  lastOperation=operation; pending=true; feedback='Saving simulated action…';error=false;retryable=false;
  const shouldFail=failNext;failNext=false;render();
  await new Promise(resolve=>setTimeout(resolve,450));
  try {
    if(shouldFail)throw new Error('Simulated connection failure. No record was changed.');
    const result=store.apply(operation);selected=result.record;edits={};reasonText='';
    feedback=`${result.replayed?'Exact retry replayed':'Saved'} · ${selected.status} · version ${selected.version}.`;
  }catch(e){feedback=e.message;error=true;retryable=shouldFail;}
  pending=false;render();
}
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();document.querySelector('#content').focus();});
window.addEventListener('hashchange',()=>{render();document.querySelector('#content').focus({preventScroll:true});window.scrollTo(0,0);});
try {
  const response=await fetch('./blueprint.json');
  if(!response.ok)throw new Error('Packet unavailable');
  packet=await response.json();render();
} catch {
  view.innerHTML='<div class="notice" role="alert">The design packet could not be loaded. Start the local server from the exported example directory, then reload.</div>';
}
