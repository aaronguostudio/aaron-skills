import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
const seed=()=>[
 {id:'INV-2041',vendor:'Lumen Supply',site:'North Workshop',amount:1250,status:'Needs review',category:'Unassigned',memo:''},
 {id:'INV-2042',vendor:'Aster Services',site:'North Workshop',amount:750,status:'Needs review',category:'Maintenance',memo:'Monthly service'},
 {id:'INV-2043',vendor:'Boreal Parts',site:'South Depot',amount:980,status:'Needs review',category:'Parts',memo:''},
 {id:'INV-2044',vendor:'Cedar Electric',site:'North Workshop',amount:420,status:'Approved',category:'Utilities',memo:'Previous batch'},
]
let invoices=seed(),batches=[],audit=[]
const sessions=new Map()
const login=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ledgerlane — Demo access</title><link rel="stylesheet" href="/styles.css"><body><main style="max-width:650px;margin:10vh auto"><div class="eyebrow">Aaron Skills · Synthetic application</div><h1>A safe place to show the work.</h1><p>Ledgerlane is a fictional review workspace. Continue as a seeded demo reviewer to explore invoice coding and a checked approval batch.</p><p>No real account, password, invoices or payments are involved. The session and data stay on this local test server.</p><form method="post" action="/demo-session"><button class="primary" type="submit">Continue as demo reviewer</button></form></main></body></html>`
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname
  if(path==='/styles.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});res.end(await readFile(new URL('styles.css',import.meta.url)));return}
  if(path==='/login'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(login);return}
  if(path==='/demo-session'&&req.method==='POST'){const token=randomBytes(24).toString('hex');sessions.set(token,Date.now()+30*60*1000);res.writeHead(303,{'Location':'/','Set-Cookie':`showcase_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`,'Cache-Control':'no-store'});res.end();return}
  const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('showcase_session='))?.split('=')[1]
  if(!token||!(sessions.get(token)>Date.now())){if(path.startsWith('/api/'))return json(res,{error:'Demo sign-in required'},401);res.writeHead(303,{'Location':'/login','Cache-Control':'no-store'});res.end();return}
  res.setHeader('Cache-Control','no-store')
  if(path==='/api/state'&&req.method==='GET')return json(res,{invoices,batches,audit})
  if(path.startsWith('/api/')&&req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk
   const data=JSON.parse(raw||'{}')
   if(path==='/api/reset'){invoices=seed();batches=[];audit=[];return json(res,{ok:true})}
   if(path==='/api/save'){
    await delay(850)
    const row=invoices.find(i=>i.id===data.id)
    if(!row||row.status!=='Needs review')return json(res,{error:'Invoice is not editable'},400)
    if(!['Office supplies','Maintenance','Parts','Utilities'].includes(data.category)||!String(data.memo||'').trim())return json(res,{error:'Choose a category and enter a review note.'},400)
    row.category=data.category;row.memo=data.memo.trim();audit.push({action:'save',id:row.id,category:row.category,memo:row.memo})
    return json(res,{ok:true})
   }
   if(path==='/api/approve'){
    await delay(1300)
    const ids=[...new Set(data.ids||[])],rows=invoices.filter(i=>ids.includes(i.id))
    if(!ids.length||rows.length!==ids.length||rows.some(i=>i.status!=='Needs review'||i.category==='Unassigned'))return json(res,{error:'Select coded invoices that need review.'},400)
    const batch={id:`BATCH-${1001+batches.length}`,ids,total:rows.reduce((n,i)=>n+i.amount,0)}
    for(const row of rows)row.status='Approved'
    batches.push(batch);audit.push({action:'approve',...batch})
    return json(res,{ok:true,batch})
   }
   return json(res,{error:'Unknown operation'},404)
  }
  const files={'/app.mjs':['app.mjs','text/javascript'],'/styles.css':['styles.css','text/css']}
  const [file,type]=files[path]||['index.html','text/html']
  res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(await readFile(new URL(file,import.meta.url)))
 }catch(error){json(res,{error:error.message},500)}
})
server.listen(Number(process.env.PORT||4231),'127.0.0.1',()=>console.log(`Example: http://127.0.0.1:${server.address().port}`))
