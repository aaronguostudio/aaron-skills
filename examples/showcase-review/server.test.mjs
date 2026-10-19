import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

test('synthetic access gate and reviewed batch persist across authenticated requests', async () => {
  const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let output='';
  const ready=new Promise((resolve,reject)=>{
    child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(found)resolve(found[0]);});
    child.once('error',reject);child.once('exit',code=>reject(Error('Fixture exited before readiness: '+code)));
  });
  const timer=setTimeout(()=>child.kill(),15000);
  try{
    const base=await ready;
    assert.equal((await fetch(base+'/api/state')).status,401);
    const gate=await fetch(base+'/',{redirect:'manual'});assert.equal(gate.status,303);assert.equal(gate.headers.get('location'),'/login');
    const login=await fetch(base+'/demo-session',{method:'POST',redirect:'manual'});assert.equal(login.status,303);
    const session=login.headers.get('set-cookie');assert.match(session,/HttpOnly/);assert.match(session,/SameSite=Strict/);
    const cookie=session.split(';')[0];
    const get=path=>fetch(base+path,{headers:{cookie}});
    const post=(path,data,authorized=true)=>fetch(base+path,{method:'POST',headers:{...(authorized?{cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal((await fetch(base+'/api/state',{headers:{cookie:'showcase_session=unknown'}})).status,401);
    assert.equal((await post('/api/approve',{ids:['INV-2041','INV-2042']},false)).status,401);
    assert.equal((await post('/api/approve',{ids:['INV-2041','INV-2042']})).status,400);
    assert.equal((await post('/api/save',{id:'INV-2041',category:'Office supplies',memo:'Reviewed for workshop supplies'})).status,200);
    const response=await post('/api/approve',{ids:['INV-2041','INV-2042']});assert.equal(response.status,200);
    const batch=(await response.json()).batch;assert.equal(batch.total,2000);assert.deepEqual(batch.ids,['INV-2041','INV-2042']);
    const state=await(await get('/api/state')).json();assert.equal(state.batches.length,1);
    assert.equal(state.invoices.find(x=>x.id==='INV-2041').category,'Office supplies');
    assert.equal(state.invoices.filter(x=>batch.ids.includes(x.id)&&x.status==='Approved').length,2);
  }finally{clearTimeout(timer);child.kill();if(child.exitCode===null)await once(child,'exit');}
});
