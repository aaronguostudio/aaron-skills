// Run with the installed Bun. Extract independent review frames; do not alter deliverables.
import {existsSync, mkdirSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const [runtimeArg, runArg, outArg] = process.argv.slice(2);
if (!runtimeArg || !runArg || !outArg) throw Error('usage: review_frames.mjs <installed-runtime> <passed-run> <new-review-dir>');
const runtime = resolve(runtimeArg), run = resolve(runArg), out = resolve(outArg);
for (const target of [run, out]) {
  let parent = target;
  while (!existsSync(parent)) parent = dirname(parent);
  parent = realpathSync(parent);
  while (true) {
    if (existsSync(join(parent, '.git'))) throw Error('Raw benchmark evidence must be outside every Git repository');
    if (dirname(parent) === parent) break;
    parent = dirname(parent);
  }
}
const {prepare} = await import(pathToFileURL(join(runtime, 'packages/demo/walkthrough/render-walkthrough.ts')).href);
const {buildTimeline} = await import(pathToFileURL(join(runtime, 'packages/demo/remotion/src/projects/walkthrough-video/timeline.ts')).href);
const prepared = prepare(run);
const timeline = buildTimeline(prepared.steps);
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', prepared.out], {encoding:'utf8'}).trim());
if (Math.abs(duration - prepared.seconds) > 0.12) throw Error('Video duration differs from silent default timeline; inspect its actual render options instead');
mkdirSync(out); // Preserve earlier review evidence.
function extract(frame, name) {
  const path = join(out, name);
  execFileSync('ffmpeg', ['-v','error','-ss',(frame / 30).toFixed(5),'-i',prepared.out,'-frames:v','1','-q:v','2',path]);
  return name;
}
const held = prepared.stills.map(s => ({id:s.id, frame:s.frame, file:extract(s.frame, `held-${s.id}.jpg`)}));
const waits = [];
prepared.steps.forEach((step, index) => {
  if (step.kind !== 'wait') return;
  const segments = timeline.segments.filter(s => s.step === index);
  const end = Math.max(...segments.map(s => s.fromFrame + s.frames));
  const start = Math.max(Math.min(...segments.map(s => s.fromFrame)), end - 30);
  const files = [];
  for (let frame = start; frame < end; frame++) files.push(extract(frame, `wait-${step.id}-${String(frame).padStart(5,'0')}.jpg`));
  waits.push({id:step.id, startFrame:start, endFrame:end-1, files});
});
writeFileSync(join(out,'review-plan.json'), JSON.stringify({durationSeconds:duration, calibrationMs:prepared.calibrationMs, held, waits},null,2)+'\n');
console.log(JSON.stringify({heldFrames:held.length,waitTails:waits.length,durationSeconds:duration}));
