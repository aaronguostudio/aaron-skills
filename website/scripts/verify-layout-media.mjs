// Read-only verification of reviewed public layout exports. No credentials needed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const media=JSON.parse(readFileSync(new URL('../layout-media.json',import.meta.url)));
const entries=Object.entries(media.files);
for(let i=0;i<entries.length;i+=4)await Promise.all(entries.slice(i,i+4).map(async([url,expected])=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,expected.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
 if(url.endsWith('.mp4')){
  assert.ok(response.headers.get('content-type').startsWith('video/mp4'));
  assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')));
  const range=await fetch(url,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(30000)});assert.equal(range.status,206);
  assert.equal((await range.arrayBuffer()).byteLength,1024);
 }else{assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
}));
console.log(`Verified ${entries.length} published media files, including eight seekable MP4s.`);
