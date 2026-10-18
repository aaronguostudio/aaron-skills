import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readFile} from 'node:fs/promises';

// Maintainer tests deliberately load runtime source from a fresh export.
const example = process.env.BLUEPRINT_EXAMPLE;
assert.ok(example, 'Run via test_blueprint.py so runtime tests use an isolated export.');
const {createStore, can} = await import(pathToFileURL(path.join(example,'model.mjs')).href);
let op=0;
const write=(store, action, extra={}) => store.apply({id:'REQ-104',actorId:'jules',action,expectedVersion:store.read('REQ-104','jules').version,operationId:`op-${++op}`,...extra});
const denied=(fn,code) => assert.throws(fn,e=>e.code===code);

test('A1: incomplete drafts save; callers cannot mutate stored snapshots',()=>{
  const s=createStore(), result=write(s,'save',{patch:{purpose:'',startDate:''}});
  assert.equal(result.record.status,'Draft');assert.equal(result.record.version,2);
  result.record.history.length=0;result.record.ownerId='casey';
  assert.equal(s.read('REQ-104','jules').ownerId,'jules');assert.equal(s.read('REQ-104','jules').history.length,1);
});
test('A2: invalid purpose, equipment, impossible or reversed dates never mutate',()=>{
  for(const patch of [{purpose:'short'},{purpose:'x'.repeat(241)},{equipment:'Unknown'},{startDate:'2026-02-30'},{endDate:'2026-11-01'},{startDate:'not a date'}]){
    const s=createStore(), before=s.read('REQ-104','jules');
    denied(()=>write(s,'submit',{patch}),'invalid');assert.deepEqual(s.read('REQ-104','jules'),before);
  }
});
test('A3: exact retry returns the original result, even after a later decision',()=>{
  const s=createStore(), command={id:'REQ-104',actorId:'jules',action:'submit',expectedVersion:1,operationId:'same'};
  const first=s.apply(command);write(s,'approve',{actorId:'morgan'});
  const second=s.apply(command);assert.equal(second.replayed,true);assert.deepEqual(second.record,first.record);
  assert.equal(s.read('REQ-104','jules').status,'Approved');assert.equal(s.read('REQ-104','jules').history.length,2);
});
test('A4: approval is terminal; review cannot smuggle changes to draft fields',()=>{
  const s=createStore();write(s,'submit');
  denied(()=>write(s,'approve',{actorId:'morgan',patch:{purpose:'Changed without owner consent'}}),'invalid');
  write(s,'approve',{actorId:'morgan'});
  for(const [action,actorId] of [['save','jules'],['revise','jules'],['approve','morgan'],['reject','morgan']]) denied(()=>write(s,action,{actorId}),'forbidden');
  assert.equal(s.read('REQ-104','jules').history.length,2);
});
test('A5/A6: rejection validates a reason; revise/resubmit retains ID and audit',()=>{
  const s=createStore();write(s,'submit');const before=s.read('REQ-104','jules');
  denied(()=>write(s,'reject',{actorId:'morgan',reason:'abc'}),'invalid');assert.deepEqual(s.read('REQ-104','jules'),before);
  denied(()=>write(s,'reject',{actorId:'morgan',reason:'x'.repeat(241)}),'invalid');
  write(s,'reject',{actorId:'morgan',reason:'  Please choose a shorter date range.  '});
  const revised=write(s,'revise').record;assert.equal(revised.id,'REQ-104');assert.equal(revised.rejectionReason,'');
  assert.equal(revised.history.find(h=>h.action==='reject').reason,'Please choose a shorter date range.');
  write(s,'submit',{patch:{endDate:'2026-11-04'}});assert.equal(s.read('REQ-104','jules').status,'Submitted');assert.equal(s.read('REQ-104','jules').history.length,4);
});
test('A7: visibility, self-review and direct calls enforce ownership',()=>{
  const s=createStore();
  assert.deepEqual(s.list('jules').map(r=>r.id),['REQ-104']);
  assert.deepEqual(s.list('morgan').map(r=>r.id),['REQ-105','REQ-106']);
  assert.deepEqual(s.list('casey').map(r=>r.id),['REQ-105','REQ-107']);
  denied(()=>s.read('REQ-107','morgan'),'forbidden');denied(()=>s.read('REQ-105','jules'),'forbidden');
  denied(()=>s.apply({id:'REQ-106',actorId:'morgan',action:'approve',expectedVersion:1,operationId:'self'}),'forbidden');
  denied(()=>write(s,'save',{actorId:'casey'}),'forbidden');denied(()=>s.list('toString'),'forbidden');
  denied(()=>write(s,'save',{patch:{ownerId:'casey'}}),'invalid');
  write(s,'submit');denied(()=>write(s,'approve'),'forbidden');denied(()=>write(s,'save'),'forbidden');
  assert.equal(can(s.read('REQ-104','morgan'),'morgan','approve'),true);
});
test('A7: cached operation IDs never bypass visibility on another request',()=>{
  const s=createStore();write(s,'save',{operationId:'cached'});
  denied(()=>s.apply({id:'REQ-107',actorId:'jules',action:'save',expectedVersion:1,operationId:'cached'}),'forbidden');
});
test('A8: concurrent old-version decision cannot overwrite the accepted one',()=>{
  const s=createStore();write(s,'submit');const version=s.read('REQ-104','morgan').version;
  write(s,'reject',{actorId:'morgan',expectedVersion:version,reason:'Please update the dates.'});
  const before=s.read('REQ-104','morgan');
  // A competing review receives a refresh instruction even if the state changed.
  denied(()=>write(s,'approve',{actorId:'morgan',expectedVersion:version}),'stale');
  assert.deepEqual(s.read('REQ-104','morgan'),before);
  write(s,'revise');const oldVersion=s.read('REQ-104','jules').version;
  write(s,'save',{patch:{purpose:'A newer draft saved from another view'}});
  denied(()=>write(s,'submit',{expectedVersion:oldVersion}),'stale');
});
test('A8: actor-scoped operation IDs reject changed payload and allow reordered keys',()=>{
  const s=createStore();const command={id:'REQ-104',actorId:'jules',action:'save',expectedVersion:1,operationId:'key',patch:{purpose:'An updated purpose',equipment:'Audio kit'}};
  s.apply(command);
  assert.equal(s.apply({...command,patch:{equipment:'Audio kit',purpose:'An updated purpose'}}).replayed,true);
  denied(()=>s.apply({...command,patch:{purpose:'Different purpose'}}),'conflict');
  assert.equal(s.read('REQ-104','jules').history.length,1);
});
test('A9: invalid write can retry corrected input without poisoning its key',()=>{
  const s=createStore();denied(()=>write(s,'submit',{operationId:'retry',patch:{purpose:''}}),'invalid');
  assert.equal(write(s,'submit',{operationId:'retry',patch:{purpose:'A corrected submission'}}).record.status,'Submitted');
});
test('A10: empty fixture creates a version-zero draft and no provider action',()=>{
  const s=createStore({empty:true});assert.deepEqual(s.list('jules'),[]);
  const draft=s.createDraft('jules');assert.equal(draft.version,0);assert.equal(draft.history.length,0);
  const saved=s.apply({id:draft.id,actorId:'jules',action:'save',expectedVersion:0,operationId:'first'});
  assert.equal(saved.record.version,1);assert.equal(saved.record.history.length,1);
});
test('packet matches model states/transitions and all rule IDs exist',async()=>{
  const packet=JSON.parse(await readFile(path.join(example,'blueprint.json'),'utf8'));
  assert.deepEqual(packet.states.map(s=>s.id),['Draft','Submitted','Approved','Rejected']);
  assert.deepEqual(packet.transitions.map(t=>[t.from,t.to]),[['Draft','Draft'],['Draft','Submitted'],['Submitted','Approved'],['Submitted','Rejected'],['Rejected','Draft']]);
  const s=createStore();const actual=[];
  for(const [action,actorId,reason] of [['save','jules',''],['submit','jules',''],['reject','morgan','Please revise the dates.'],['revise','jules',''],['submit','jules',''],['approve','morgan','']]){
    const before=s.read('REQ-104',actorId);const after=write(s,action,{actorId,reason}).record;actual.push([before.status,after.status]);
  }
  for(const transition of packet.transitions)assert.ok(actual.some(([a,b])=>a===transition.from&&b===transition.to));
  assert.deepEqual(packet.rules.map(r=>r.id),['R1','R2','R3','R4','R5','R6','R7']);
});
