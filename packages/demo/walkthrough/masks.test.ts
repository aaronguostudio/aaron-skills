import {expect, test} from 'bun:test';
import cases from '../../../evals/fixtures/mask-cases.json';
import {validateMasks} from '../contracts/masks.mjs';
import {buildTimeline, calibrate, masksAt, validateCapture, type Capture, type Step} from '../remotion/src/projects/walkthrough-video/timeline';

const viewport = {w:1440,h:900};
const capture:Capture = {version:1,walk:'synthetic',env:'local',title:'Synthetic',startedAt:'2026-10-26',viewport,status:'passed'};
const step:Step = {id:'result',caption:'Result',kind:'action',startMs:100,endMs:200,clicks:[],shot:null};
const box = [10.2,20.3,80.1,40.1] as [number,number,number,number];
const rect = {x:10,y:20,w:81,h:41};

test('shared Python/JS mask contract rejects invalid data before the final renderer', () => {
  for (const fixture of cases) {
    const c = {...capture,...('masks' in fixture?{masks:fixture.masks}:{})};
    expect(validateMasks(c,[step]).length === 0,fixture.id).toBe(fixture.accepted);
    expect(validateCapture(c as Capture,[step]).length === 0,fixture.id).toBe(fixture.accepted);
  }
});

test('ordinary captures introduce no masks or timing changes', () => {
  const timeline = buildTimeline([step]);
  for (let frame=0;frame<timeline.durationInFrames;frame++) expect(masksAt(timeline,[],frame)).toEqual([]);
});

test('capture clock follows calibrated playback and a held frame without fading', () => {
  const timeline = buildTimeline(calibrate([{...step,startMs:1300,endMs:2300}],-300));
  const mask = {box,fromMs:2100,toMs:2300};
  expect(masksAt(timeline,[mask],timeline.titleFrames,-300)).toEqual([]);
  const hold = timeline.segments.find(s=>s.freeze)!;
  expect(masksAt(timeline,[mask],hold.fromFrame,-300)).toEqual([rect]);
  expect(masksAt(timeline,[mask],hold.fromFrame+hold.frames-1,-300)).toEqual([rect]);
  expect(masksAt(timeline,[mask],timeline.durationInFrames-1,-300)).toEqual([]);
});

test('masks persist through fast-forward waits and gaps independently of step ownership', () => {
  const timeline = buildTimeline([
    {...step,startMs:1000,endMs:3000},
    {...step,id:'wait',startMs:9000,endMs:21000,kind:'wait'},
  ],{minStepMs:()=>0});
  const gap = timeline.segments.find(s=>s.step===null)!;
  const wait = timeline.segments.find(s=>s.step===1)!;
  expect(gap.speed).toBe(3); expect(wait.speed).toBe(6);
  expect(masksAt(timeline,[{box,fromMs:5000,toMs:7000}],gap.fromFrame+30)).toEqual([rect]);
  expect(masksAt(timeline,[{box,fromMs:14000,toMs:16000}],wait.fromFrame+30)).toEqual([rect]);
  expect(masksAt(timeline,[{box,fromMs:5000,toMs:7000}],wait.fromFrame+30)).toEqual([]);
});

test('subframe boundaries are conservative, and held screenshots use all masks', () => {
  const timeline = buildTimeline([{...step,startMs:1000,endMs:3000}],{minStepMs:()=>0});
  expect(masksAt(timeline,[{box,fromMs:1010,toMs:1020}],timeline.titleFrames)).toEqual([rect]);
  const still = buildTimeline([{...step,startMs:3000,endMs:3000,shot:'shots/result.png'}]);
  expect(masksAt(still,[{box,fromMs:1000,toMs:1200}],still.titleFrames)).toEqual([rect]);
});
