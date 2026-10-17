const app=document.querySelector('#app'),modal=document.querySelector('#modal')
let state,site='All sites',status='All statuses',selected=new Set(),banner='',latestBatch=null
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n)
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function load(){state=await(await fetch('/api/state')).json()}
async function post(path,data){const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await response.json();if(!response.ok)throw Error(body.error);return body}
const filtered=()=>state.invoices.filter(i=>(site==='All sites'||i.site===site)&&(status==='All statuses'||i.status===status))
function render(){
 const batchId=location.pathname.split('/batches/')[1]
 if(batchId){renderBatch(batchId);return}
 const rows=filtered(),total=rows.reduce((n,i)=>n+i.amount,0)
 app.innerHTML=`<div class="eyebrow">Review workspace</div><h1>Invoice review</h1><div class="muted">Code supplier invoices and approve them in a reviewed batch.</div>${banner?`<div class="banner" role="status">${banner}${latestBatch?'<button class="link" id="view-batch">View batch</button>':''}</div>`:''}<section class="metrics" aria-label="Filtered summary"><div class="metric">Matching invoices<strong>${rows.length}</strong></div><div class="metric">Matching amount<strong>${money(total)}</strong></div></section><div class="filters"><label>Site<select id="site" aria-label="Site"><option>All sites</option><option>North Workshop</option><option>South Depot</option></select></label><label>Status<select id="status" aria-label="Status"><option>All statuses</option><option>Needs review</option><option>Approved</option></select></label></div><div class="toolbar"><span id="selection-summary">${selected.size} selected</span><button class="primary" id="review" ${selected.size?'':'disabled'}>Review approval</button></div>${rows.length?`<table aria-label="Invoices"><thead><tr><th>Select</th><th>Invoice / supplier</th><th>Site</th><th>Category</th><th>Status</th><th class="money">Amount</th><th>Action</th></tr></thead><tbody>${rows.map(i=>`<tr><td><input type="checkbox" aria-label="Select ${i.id}" data-select="${i.id}" ${selected.has(i.id)?'checked':''} ${i.status==='Approved'?'disabled':''}></td><td><strong>${i.id}</strong><small>${i.vendor}</small></td><td>${i.site}</td><td>${escape(i.category)}${i.memo?`<small>${escape(i.memo)}</small>`:''}</td><td><span class="badge ${i.status==='Approved'?'approved':''}">${i.status}</span></td><td class="money">${money(i.amount)}</td><td>${i.status==='Needs review'?`<button class="link" aria-label="Edit ${i.id}" data-edit="${i.id}">Edit</button>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty"><h2>No invoices match these filters</h2><p>The approved invoices are available in the batch.</p></div>'}`
 document.querySelector('#site').value=site;document.querySelector('#status').value=status
 document.querySelector('#site').onchange=e=>{site=e.target.value;selected.clear();render()}
 document.querySelector('#status').onchange=e=>{status=e.target.value;selected.clear();render()}
 for(const box of document.querySelectorAll('[data-select]'))box.onchange=()=>{box.checked?selected.add(box.dataset.select):selected.delete(box.dataset.select);render()}
 for(const button of document.querySelectorAll('[data-edit]'))button.onclick=()=>edit(button.dataset.edit)
 document.querySelector('#review').onclick=preview
 if(latestBatch&&document.querySelector('#view-batch'))document.querySelector('#view-batch').onclick=()=>{history.pushState({},'',`/batches/${latestBatch.id}`);render()}
}
function edit(id){
 const row=state.invoices.find(i=>i.id===id)
 modal.innerHTML=`<div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">Review ${id}</h2><p class="muted">${row.vendor} · ${row.site} · ${money(row.amount)}</p><form id="edit-form"><label>Category<select name="category" aria-label="Category" required><option>Unassigned</option><option>Office supplies</option><option>Maintenance</option><option>Parts</option><option>Utilities</option></select></label><label>Review note<textarea name="memo" aria-label="Review note" required>${escape(row.memo)}</textarea></label><div id="save-error"></div><div class="actions"><button type="button" id="cancel">Cancel</button><button class="primary" type="submit">Save changes</button></div></form></section></div>`
 const form=document.querySelector('#edit-form');form.elements.category.value=row.category
 document.querySelector('#cancel').onclick=()=>modal.replaceChildren()
 form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Saving changes…';try{await post('save',{id,category:form.elements.category.value,memo:form.elements.memo.value});await load();modal.replaceChildren();banner=`${id} changes saved`;latestBatch=null;render()}catch(error){document.querySelector('#save-error').innerHTML=`<div class="error" role="alert">${escape(error.message)}</div>`;submit.disabled=false;submit.textContent='Save changes'}}
}
function preview(){
 const rows=state.invoices.filter(i=>selected.has(i.id)),total=rows.reduce((n,i)=>n+i.amount,0)
 modal.innerHTML=`<div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title"><h2 id="approval-title">Approval preview</h2><p>Check the invoices and total before confirming.</p><section class="preview" aria-label="Approval summary"><div>${rows.length} invoices selected</div><strong>${money(total)}</strong><ul>${rows.map(i=>`<li>${i.id} · ${i.vendor} · ${money(i.amount)}</li>`).join('')}</ul></section><div id="approval-error"></div><div class="actions"><button id="cancel-approval">Cancel</button><button class="primary" id="confirm">Approve ${rows.length} invoices</button></div></section></div>`
 document.querySelector('#cancel-approval').onclick=()=>modal.replaceChildren()
 document.querySelector('#confirm').onclick=async e=>{const button=e.target;button.disabled=true;button.textContent='Approving invoices…';try{const result=await post('approve',{ids:rows.map(i=>i.id)});await load();modal.replaceChildren();latestBatch=result.batch;banner=`${rows.length} invoices approved · ${money(total)}`;selected.clear();render()}catch(error){document.querySelector('#approval-error').innerHTML=`<div class="error" role="alert">${escape(error.message)}</div>`;button.disabled=false;button.textContent=`Approve ${rows.length} invoices`}}
}
function renderBatch(id){
 const batch=state.batches.find(b=>b.id===id)
 if(!batch){app.innerHTML='<h1>Batch not found</h1>';return}
 const rows=state.invoices.filter(i=>batch.ids.includes(i.id))
 app.innerHTML=`<button class="back" id="back">Back to invoice review</button><div class="eyebrow">Approval batch</div><h1>${batch.id}</h1><p class="muted">The batch is approved and its invoice coding is retained.</p><section class="metrics" aria-label="Batch summary"><div class="metric">Approved invoices<strong>${rows.length}</strong></div><div class="metric">Batch total<strong>${money(batch.total)}</strong></div><div class="metric">Status<strong>Approved</strong></div></section><table aria-label="Batch invoices"><thead><tr><th>Invoice / supplier</th><th>Category / review note</th><th>Status</th><th class="money">Amount</th></tr></thead><tbody>${rows.map(i=>`<tr><td><strong>${i.id}</strong><small>${i.vendor}</small></td><td>${escape(i.category)}<small>${escape(i.memo)}</small></td><td><span class="badge approved">${i.status}</span></td><td class="money">${money(i.amount)}</td></tr>`).join('')}</tbody></table>`
 document.querySelector('#back').onclick=()=>{history.pushState({},'','/');render()}
}
window.onpopstate=render
document.querySelector('#reset').onclick=async()=>{await post('reset',{});await load();site='All sites';status='All statuses';selected.clear();banner='';latestBatch=null;modal.replaceChildren();history.replaceState({},'','/');render()}
await load();render()
