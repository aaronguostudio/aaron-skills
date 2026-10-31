#!/usr/bin/env bun
// Render a capture folder into walkthrough.mp4 plus chapters.txt, both written into that folder.
//
//   npx -y bun packages/demo/walkthrough/render-walkthrough.ts <run> [--out <file.mp4>] [--calibration-ms <n>] [--stills] [--dry-run]
//
// <run> follows capture contract version 1 (see ../../../docs/capture-contract.md).
// Refuses a capture whose status is not "passed", and any run folder or output inside this repo,
// so a work recording can never land in the content pipelines here.
import {validateCallouts, validateCalloutTiming} from "../remotion/src/projects/walkthrough-video/callouts";
import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve, sep } from "path";
import { privateDirectory } from "../capture/scripts/platform.mjs";
import {
  cardMinMs,
  loadScript,
  loadVoiceProfile,
  narrate,
  stepMinMs,
  WALKTHROUGH_SPEED,
  withSpeed,
  type NarrationClip,
  type NarrationScript,
} from "./narration";
import {loadPresentation, installPresentation, validatePresentationMedia} from './presentation';
import {outsideGit, readImportedAudio, installImportedAudio} from './import-audio';
import {speechProvider,providerKey} from './voice-providers';
import {annotationPages, layoutGeometry} from '../remotion/src/projects/walkthrough-video/presentation/layout';
import {paletteFor} from '../remotion/src/projects/walkthrough-video/presentation/theme';
import { installBrand, loadBrandProfile } from "./brand";
import type { Brand } from "../remotion/src/projects/walkthrough-video/brand/model";
import {
  BRAND_STING_LEAD_MS,
  buildTimeline,
  calibrate,
  chapters,
  stillFrames,
  validateCapture,
  type Capture,
  type Step,
} from "../remotion/src/projects/walkthrough-video/timeline";

const REMOTION_DIR = resolve(import.meta.dir, "..", "remotion");
const ENTRY = "src/projects/walkthrough-video/index.tsx";

export class RenderRefusal extends Error {}

// The main checkout's root, even when this runs from a worktree inside it.
export function repoRoots(from = import.meta.dir): string[] {
  const roots = new Set<string>();
  try {
    const top = execFileSync("git", ["-C", from, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    roots.add(realpathSync(top));
    const common = execFileSync("git", ["-C", from, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    roots.add(realpathSync(dirname(common)));
  } catch {
    roots.add(realpathSync(resolve(import.meta.dir, "..", "..", "..")));
  }
  return [...roots];
}

function realish(path: string): string {
  // The output file does not exist yet: resolve its closest existing parent.
  let probe = resolve(path);
  const tail: string[] = [];
  while (!existsSync(probe)) {
    tail.unshift(probe.slice(dirname(probe).length + 1));
    probe = dirname(probe);
  }
  return join(realpathSync(probe), ...tail);
}

export function insideAny(path: string, roots: string[]): boolean {
  const real = realish(path);
  return roots.some((root) => real === root || real.startsWith(root + sep));
}

export type Prepared = {
  run: string;
  out: string;
  chaptersPath: string;
  chaptersText: string;
  seconds: number;
  calibrationMs: number;
  calibrationSource: "argument" | "capture.json" | "sync flash" | "none";
  steps: Step[];
  // Per step, the output frame worth checking before delivering (see stillFrames).
  stills: { id: string; index: number; frame: number }[];
} & Timing;

// The least times narration asks for: per step, and for the title and end cards.
export type Timing = { stepMinMs?: number[]; titleMs?: number; endMs?: number; titleBaseMs?:number; endBaseMs?:number };

// The capture clock and the recording's first frame drift apart by a few hundred ms (the
// screencast starts after the page does). A capture can mark the moment its page turned from
// black to white (capture.json `sync.tMs`); this finds that frame and returns the offset to add
// to every capture time. Null means inspection succeeded but found no transition;
// a missing/broken probe is a prerequisite failure, never a missing marker.
export function detectSyncOffset(video: string, syncMs: number, diagnose?: (reason: string) => void): number | null {
  // Resolve the directory through cwd, outside FFmpeg's filter grammar. Windows
  // drive colons/backslashes and apostrophes in directory names are not filters.
  const movie = `movie='${basename(video).replace(/'/g, "'\\''")}',signalstats`;
  let csv: string;
  try {
    csv = execFileSync(
      "ffprobe",
      ["-v", "error", "-f", "lavfi", "-i", movie, "-read_intervals", `%+${Math.ceil(syncMs / 1000) + 10}`,
        "-show_entries", "frame=pts_time:frame_tags=lavfi.signalstats.YAVG", "-of", "csv=p=0"],
      { cwd: dirname(resolve(video)), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT' && existsSync(dirname(resolve(video)));
    const reason = missing
      ? 'ffprobe could not start. Install FFmpeg including ffprobe, verify PATH and run aaron-demo doctor.'
      : 'ffprobe could not decode the recording for synchronization. Verify FFmpeg and the original video.webm; run aaron-demo doctor.';
    diagnose?.(reason);
    throw new RenderRefusal(reason);
  }
  let sawBlack = false;
  for (const line of csv.split("\n")) {
    const [pts, yavg] = line.split(",").map(Number);
    if (!Number.isFinite(pts) || !Number.isFinite(yavg)) continue;
    if (yavg < 40) sawBlack = true;
    else if (sawBlack && yavg > 200) return Math.round(pts * 1000 - syncMs);
  }
  diagnose?.('ffprobe completed, but no black-to-white marker was found in the inspected frames.');
  return null;
}

export function prepare(
  runArg: string,
  outArg?: string,
  roots = repoRoots(),
  calibrationArg?: number,
  timing: Timing = {},
): Prepared {
  const run = resolve(runArg);
  const out = resolve(outArg ?? join(run, "walkthrough.mp4"));
  if (insideAny(run, roots)) throw new RenderRefusal(`The capture folder ${run} is inside this repo. Keep captures outside it.`);
  if (insideAny(out, roots)) throw new RenderRefusal(`Refusing to write ${out}: it is inside this repo.`);
  for (const name of ["capture.json", "steps.json", "video.webm"]) {
    if (!existsSync(join(run, name))) throw new RenderRefusal(`${run} has no ${name}; is it a capture folder?`);
  }
  const capture = JSON.parse(readFileSync(join(run, "capture.json"), "utf8")) as Capture;
  const raw = JSON.parse(readFileSync(join(run, "steps.json"), "utf8")) as Step[];
  const problems = validateCapture(capture, raw);
  if (problems.length) throw new RenderRefusal(`Capture refused:\n- ${problems.join("\n- ")}`);
  for (const step of raw) {
    if (step.shot && !existsSync(join(run, step.shot))) problems.push(`step ${step.id}: shot ${step.shot} is missing`);
  }
  if (problems.length) throw new RenderRefusal(`Capture refused:\n- ${problems.join("\n- ")}`);
  let calibrationMs = 0;
  let calibrationSource: Prepared["calibrationSource"] = "none";
  if (calibrationArg !== undefined) [calibrationMs, calibrationSource] = [calibrationArg, "argument"];
  else if (capture.calibrationMs !== undefined) [calibrationMs, calibrationSource] = [capture.calibrationMs, "capture.json"];
  else if (capture.sync) {
    let reason = '';
    const detected = detectSyncOffset(join(run, "video.webm"), capture.sync.tMs, detail => { reason = detail; });
    if (detected === null) throw new RenderRefusal(`Could not find the recorded sync marker. ${reason} Preserve this capture for diagnosis; verify ffprobe and the original recording before recording again or supplying a verified --calibration-ms offset.`);
    [calibrationMs, calibrationSource] = [detected, "sync flash"];
  }
  const steps = calibrate(raw, calibrationMs);
  const { stepMinMs: mins, titleMs, endMs } = timing;
  const timeline = buildTimeline(steps, {
    ...(mins ? { minStepMs: (_s: Step, i: number) => mins[i] ?? 0 } : {}),
    titleMs,
    endMs,
    titleBaseMs:timing.titleBaseMs,
    endBaseMs:timing.endBaseMs,
  });
  return {
    run,
    out,
    chaptersPath: join(dirname(out), "chapters.txt"),
    chaptersText: chapters(timeline, steps),
    seconds: timeline.durationInFrames / timeline.fps,
    stills: stillFrames(timeline, steps),
    calibrationMs,
    calibrationSource,
    steps,
    ...timing,
  };
}

// One jpg per step, at the frame the viewer looks at longest, into stills/ beside the video: the
// frames to look at before delivering. Returns the folder.
export function writeStills(prepared: Prepared, fps = 30): string {
  const dir = join(dirname(prepared.out), "stills");
  mkdirSync(dir, { recursive: true });
  for (const { id, index, frame } of prepared.stills) {
    const file = join(dir, `${String(index + 1).padStart(2, "0")}-${id}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", (frame / fps).toFixed(3), "-i", prepared.out, "-frames:v", "1", "-q:v", "3", file]);
  }
  return dir;
}

// A conversational script names the run's people and work, so it stays with the run, never here.
export function readScript(path: string, steps: Step[], roots = repoRoots()): NarrationScript {
  const full = resolve(path);
  if (insideAny(full, roots)) {
    throw new RenderRefusal(`The script ${full} is inside this repo. Keep it in the run folder.`);
  }
  return loadScript(full, steps);
}

export type Args = {
  run?: string;
  out?: string;
  dryRun: boolean;
  stills: boolean;
  calibrationMs?: number;
  narrate: boolean;
  narrationNotice: boolean;
  voiceProfile?: string;
  script?: string;
  speed?: number;
  brand?: string;
  template?: string;
  presentation?: string;
  callouts?: string;
  layoutPreset?: string;
  coverPreset?: string;
  audio?: string;
  voiceProvider?: string;
  cover: boolean;
  preview: boolean;
};

export function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, stills: false, narrate: false, narrationNotice: false, out: undefined, script: undefined, cover:false, preview:false };
  const values: Record<string, keyof Args> = {
    "--out": "out", "--calibration-ms": "calibrationMs", "--voice-profile": "voiceProfile",
    "--script": "script", "--speed": "speed", "--brand": "brand",
    '--template':'template', '--presentation':'presentation', '--callouts':'callouts', '--cover-preset':'coverPreset', '--layout':'layoutPreset', '--audio':'audio', '--voice-provider':'voiceProvider',
  };
  const flags = new Map<string, "dryRun" | "stills" | "narrate" | 'cover' | 'narrationNotice' | 'preview'>([
    ["--dry-run", "dryRun"], ["--stills", "stills"], ["--narrate", "narrate"],
    ['--cover','cover'], ['--narration-notice','narrationNotice'],
    ['--preview','preview'],
  ]);
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith("--")) {
      if (seen.has(item)) throw new RenderRefusal(`Duplicate option: ${item}`);
      seen.add(item);
      if (flags.has(item)) { args[flags.get(item)!] = true; continue; }
      const key = values[item];
      if (!key) throw new RenderRefusal(`Unknown option: ${item}`);
      const value = argv[++i];
      if (value === undefined || value.startsWith("--") || value === "") throw new RenderRefusal(`${item} needs a value`);
      if (key === "speed" || key === "calibrationMs") {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new RenderRefusal(`${item} needs a finite number`);
        if (key === "speed" && (number < 0.7 || number > 1.2)) throw new RenderRefusal("Speaking speed must be between 0.7 and 1.2");
        args[key] = number;
      } else Object.assign(args, { [key]: value });
    } else {
      if (args.run) throw new RenderRefusal("Expected exactly one capture folder");
      args.run = item;
    }
  }
  args.narrate ||= args.script !== undefined;
  return args;
}

const USAGE = "usage: aaron-demo render <passed-run> [--template minimal|professional|showcase] [--presentation <external.json>] [--callouts <external.json>] [--cover-preset <id>] [--layout <id>] [--cover] [--preview] [--narration-notice] [--audio <manifest.json> | --narrate | --voice-provider none|elevenlabs|google|custom|kokoro|import] [--script <script.json>] [--voice-profile <id>] [--speed <0.7-1.2>] [--brand <legacy-id>] [--out <file.mp4>] [--stills] [--dry-run]. First narration: aaron-demo voice setup";

export async function main(argv: string[]): Promise<number> {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) { console.log(USAGE); return 0; }
  let parsed:Args;
  try {parsed=parseArgs(argv);} catch(error) {console.error(error instanceof Error?error.message:String(error)); return 2;}
  try {
    const {run, out, dryRun, stills, calibrationMs, voiceProfile, script:scriptArg, speed, brand:brandArg} = parsed;
    if (!run) {console.error(USAGE); return 2;}
    let provider = parsed.voiceProvider ?? (parsed.audio ? 'import' : parsed.narrate ? 'configured' : 'none');
    if (!['none','import','configured','elevenlabs','google','custom','kokoro','qwen'].includes(provider)) throw new RenderRefusal('Unknown voice provider');
    const generated=!['none','import'].includes(provider);
    if(parsed.preview&&generated)throw new RenderRefusal('Preview never synthesizes narration; use none or --audio with existing clips');
    if (provider === 'qwen') throw new RenderRefusal('Qwen TTS adapter is reserved, not implemented or validated. Use --audio with output from your local TTS. No provider call was made.');
    if ((provider === 'import') !== !!parsed.audio || (parsed.audio && parsed.narrate) || (!generated && (parsed.narrate || scriptArg || voiceProfile || speed !== undefined))) throw new RenderRefusal('Conflicting audio options: choose none, imported manifest, or configured narration');
    if (brandArg && (parsed.template || parsed.presentation || parsed.coverPreset || parsed.layoutPreset)) throw new RenderRefusal('Use the presentation brand configuration or legacy --brand, not both');
    outsideGit(run);
    if (out) outsideGit(out);
    const roots = repoRoots();
    let prepared = prepare(run, out, roots, calibrationMs);
    const capture = JSON.parse(readFileSync(join(prepared.run,'capture.json'),'utf8'));
    if(parsed.callouts) outsideGit(parsed.callouts);
    const callouts=parsed.callouts ? JSON.parse(readFileSync(resolve(parsed.callouts),'utf8')) : undefined;
    if(parsed.callouts) validateCallouts(callouts,prepared.steps,capture.viewport);
    if (parsed.presentation) outsideGit(parsed.presentation);
    const config = loadPresentation(parsed.template, parsed.presentation, capture.title, capture.subtitle ?? '',parsed.coverPreset,parsed.layoutPreset);
    if (parsed.cover && !config) throw new RenderRefusal('--cover requires --template, --layout or --presentation');
    const p = config?.presentation;
    const logoChecks=p?validatePresentationMedia(p,config?.assetRoot):[];
    const geometry=layoutGeometry(capture.viewport,p);
    const resolvedPalette=p?{intro:paletteFor(p,'intro'),body:paletteFor(p,'body'),outro:paletteFor(p,'outro')}:undefined;
    const baseTiming = p ? {titleBaseMs:p.intro.enabled?p.intro.durationMs:0, endBaseMs:p.outro.enabled?p.outro.durationMs:0} : {};
    const imported = parsed.audio ? readImportedAudio(parsed.audio,prepared.steps) : undefined;
    const script=scriptArg?readScript(scriptArg,prepared.steps,roots):undefined;
    if(script&&p&&((!p.intro.enabled&&script.intro)||(!p.outro.enabled&&script.outro)))throw new RenderRefusal('Narration script targets a disabled card');
    if(p?.layout)prepared.steps.forEach((step,i)=>annotationPages(p,geometry.annotation,step.caption,imported?.clips.find(c=>c.at===i)?.text??script?.steps[step.id]??step.narration));
    const checkCards = (clips:NarrationClip[]) => {
      if (p && ((!p.intro.enabled && clips.some(c=>c.at==='intro')) || (!p.outro.enabled && clips.some(c=>c.at==='outro')))) throw new RenderRefusal('Audio targets a disabled intro or outro card');
    };
    if (imported) checkCards(imported.clips);
    prepared = prepare(run,out,roots,prepared.calibrationMs,{...baseTiming,...(imported?{stepMinMs:stepMinMs(prepared.steps,imported.clips),...cardMinMs(imported.clips,p?.intro.enabled&&(p.intro.sound||p.intro.soundPreset!=='none')?BRAND_STING_LEAD_MS:0)}:{})});
    if (dryRun && callouts && !generated) validateCalloutTiming(callouts,prepared.steps,buildTimeline(prepared.steps,{...(prepared.stepMinMs?{minStepMs:(_s:Step,i:number)=>prepared.stepMinMs?.[i]??0}:{}),titleMs:prepared.titleMs,endMs:prepared.endMs,titleBaseMs:prepared.titleBaseMs,endBaseMs:prepared.endBaseMs}));
    if (dryRun) {
      console.log(JSON.stringify({dryRun:true,maskCount:capture.masks?.length??0,out:prepared.out,seconds:prepared.seconds,template:p?.template ?? 'legacy',coverPreset:p?.cover?.preset,coverRequested:parsed.cover,voiceProvider:provider,narrationNotice:parsed.narrationNotice,narrationRequested:provider!=='none',narrationTiming:generated?'requires synthesis; not performed':provider==='import'?'measured imported clips':'silent',calibrationMs:prepared.calibrationMs,steps:prepared.steps.length,geometry,resolvedPalette,logoChecks,logoFallback:!logoChecks.length?p?.brand.fallback??'omit':undefined},null,2));
      return 0;
    }
    const selected=generated?loadVoiceProfile(voiceProfile):undefined;
    if(selected){
      if(provider!=='configured'&&provider!==selected.provider)throw new RenderRefusal('Selected voice profile belongs to another provider; use voice setup or --voice-profile to choose the intended narrator. No fallback was selected.');
      provider=selected.provider!;
    }
    process.umask(0o077);
    mkdirSync(dirname(prepared.out),{recursive:true});
    if (process.platform === 'win32') await privateDirectory(dirname(prepared.out));
    let branding:Brand|undefined;
    if (brandArg) branding=installBrand(loadBrandProfile(brandArg),prepared.run);
    const presentation=config?installPresentation(config.presentation,config.assetRoot,prepared.run):undefined;
    let clips:NarrationClip[]=[];
    let narrationKind:'ai'|'imported'='ai';
    if (imported) {
      clips=installImportedAudio(imported,prepared.run);
      narrationKind=imported.aiGenerated?'ai':'imported';
    } else if (selected) {
      const profile=withSpeed(selected,speed??(provider==='elevenlabs'?WALKTHROUGH_SPEED:Number(selected.voice_settings.speed??1)));
      clips=await narrate(prepared.run,prepared.steps,profile,(text,voice)=>speechProvider(provider,()=>providerKey(voice),voice).synthesizeMp3({text,voice:voice.voice_id,model:voice.model_id,outputFormat:voice.output_format,settings:voice.voice_settings,language:voice.language}),undefined,script);
    }
    checkCards(clips);
    const timing={...baseTiming,...(clips.length?{stepMinMs:stepMinMs(prepared.steps,clips),...cardMinMs(clips,(presentation?.intro.sound||branding?.sound)?BRAND_STING_LEAD_MS:0)}:{})};
    prepared=prepare(run,out,roots,prepared.calibrationMs,timing);
    if(callouts) validateCalloutTiming(callouts,prepared.steps,buildTimeline(prepared.steps,{...(prepared.stepMinMs?{minStepMs:(_s:Step,i:number)=>prepared.stepMinMs?.[i]??0}:{}),titleMs:prepared.titleMs,endMs:prepared.endMs,titleBaseMs:prepared.titleBaseMs,endBaseMs:prepared.endBaseMs}));
    writeFileSync(prepared.chaptersPath,prepared.chaptersText);
    const props=`--props=${JSON.stringify({calibrationMs:prepared.calibrationMs,stepMinMs:prepared.stepMinMs,titleMs:prepared.titleMs,endMs:prepared.endMs,narration:clips.map(({at,file,ms,text})=>({at,file,ms,text})),narrationKind,narrationNotice:parsed.narrationNotice,branding,presentation,callouts})}`;
    const cli=join(REMOTION_DIR,'node_modules','@remotion','cli','remotion-cli.js');
    const invoke=(args:string[])=>{
      const result=spawnSync('node',[cli,...args],{cwd:REMOTION_DIR,stdio:'inherit'});
      if (result.status!==0) throw new RenderRefusal('Remotion render failed');
    };
    if(parsed.preview)invoke(['still',ENTRY,'WalkthroughVideo',join(dirname(prepared.out),'body-preview.png'),`--frame=${prepared.stills[0].frame}`,`--public-dir=${prepared.run}`,props,'--log=error']);
    else invoke(['render',ENTRY,'WalkthroughVideo',prepared.out,`--public-dir=${prepared.run}`,props,'--codec=h264','--crf=20','--pixel-format=yuv420p',...(clips.length||presentation?.intro.sound||branding?.sound?['--audio-codec=aac']:['--muted']),'--log=error']);
    if (parsed.cover) {
      const png=join(dirname(prepared.out),'cover.png');
      invoke(['still',ENTRY,'WalkthroughCover',png,`--public-dir=${prepared.run}`,props,'--log=error']);
      // FFmpeg distributions differ in optional WebP encoders. The installed Pillow
      // wheel is already a verified runtime dependency, so cover export uses it.
      const python=join(resolve(import.meta.dir,'../../..'),'.venv',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python3');
      execFileSync(python,['-c','from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=85,method=6)',png,join(dirname(prepared.out),'cover.webp')]);
    }
    if (stills&&!parsed.preview) writeStills(prepared);
    writeFileSync(join(dirname(prepared.out),parsed.preview?'preview-manifest.json':'render-manifest.json'),JSON.stringify({version:1,maskCount:capture.masks?.length??0,preview:parsed.preview,template:p?.template??'legacy',presentation,geometry,resolvedPalette,logoChecks,voiceProvider:provider,narrationKind:clips.length?narrationKind:'none',narrationNotice:parsed.narrationNotice,seconds:prepared.seconds,sourceCaptureSha256:Bun.SHA256.hash(readFileSync(join(prepared.run,'capture.json')),'hex'),sourceVideoSha256:Bun.SHA256.hash(readFileSync(join(prepared.run,'video.webm')),'hex'),narration:clips},null,2)+'\n');
    console.log(`${parsed.preview?'preview':'video'}: ${parsed.preview?join(dirname(prepared.out),'body-preview.png'):prepared.out} (${prepared.seconds.toFixed(2)}s); template: ${p?.template??'legacy'}; voice: ${provider}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error?error.message:String(error));
    return 3;
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
