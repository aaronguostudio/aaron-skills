#!/usr/bin/env bun
// Render a capture folder into walkthrough.mp4 plus chapters.txt, both written into that folder.
//
//   npx -y bun packages/demo/walkthrough/render-walkthrough.ts <run> [--out <file.mp4>] [--calibration-ms <n>] [--stills] [--dry-run]
//
// <run> follows capture contract version 1 (see ../../../docs/capture-contract.md).
// Refuses a capture whose status is not "passed", and any run folder or output inside this repo,
// so a work recording can never land in the content pipelines here.
import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve, sep } from "path";
import { privateDirectory } from "../capture/scripts/platform.mjs";
import {
  cardMinMs,
  elevenLabs,
  loadApiKey,
  loadScript,
  loadVoiceProfile,
  narrate,
  stepMinMs,
  WALKTHROUGH_SPEED,
  withSpeed,
  type NarrationClip,
  type NarrationScript,
} from "./narration";
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
export type Timing = { stepMinMs?: number[]; titleMs?: number; endMs?: number };

// The capture clock and the recording's first frame drift apart by a few hundred ms (the
// screencast starts after the page does). A capture can mark the moment its page turned from
// black to white (capture.json `sync.tMs`); this finds that frame and returns the offset to add
// to every capture time. Null when there is no such transition or ffprobe is missing.
export function detectSyncOffset(video: string, syncMs: number): number | null {
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
  } catch {
    return null;
  }
  let sawBlack = false;
  for (const line of csv.split("\n")) {
    const [pts, yavg] = line.split(",").map(Number);
    if (!Number.isFinite(pts) || !Number.isFinite(yavg)) continue;
    if (yavg < 40) sawBlack = true;
    else if (sawBlack && yavg > 200) return Math.round(pts * 1000 - syncMs);
  }
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
    const detected = detectSyncOffset(join(run, "video.webm"), capture.sync.tMs);
    if (detected === null) throw new RenderRefusal("Could not find the recorded sync marker. Record again or supply a verified --calibration-ms offset.");
    [calibrationMs, calibrationSource] = [detected, "sync flash"];
  }
  const steps = calibrate(raw, calibrationMs);
  const { stepMinMs: mins, titleMs, endMs } = timing;
  const timeline = buildTimeline(steps, {
    ...(mins ? { minStepMs: (_s: Step, i: number) => mins[i] ?? 0 } : {}),
    titleMs,
    endMs,
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
  voiceProfile?: string;
  script?: string;
  speed?: number;
  brand?: string;
};

export function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, stills: false, narrate: false, out: undefined, script: undefined };
  const values: Record<string, keyof Args> = {
    "--out": "out", "--calibration-ms": "calibrationMs", "--voice-profile": "voiceProfile",
    "--script": "script", "--speed": "speed", "--brand": "brand",
  };
  const flags = new Map<string, "dryRun" | "stills" | "narrate">([
    ["--dry-run", "dryRun"], ["--stills", "stills"], ["--narrate", "narrate"],
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

export async function main(argv: string[]): Promise<number> {
  let parsed: Args;
  try { parsed = parseArgs(argv); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error)); return 2;
  }
  const { run, out, dryRun, stills, calibrationMs, narrate: withVoice, voiceProfile, script: scriptArg, speed, brand: brandArg } = parsed;
  if (!run || (calibrationMs !== undefined && !Number.isFinite(calibrationMs))) {
    console.error(
      "usage: render-walkthrough.ts <capture folder> [--out <file.mp4>] [--narrate] [--script <script.json>] [--voice-profile <id>] [--speed <0.7-1.2>] [--brand <id>] [--calibration-ms <n>] [--stills] [--dry-run]",
    );
    return 2;
  }
  const roots = repoRoots();
  let prepared: Prepared;
  try {
    prepared = prepare(run, out, roots, calibrationMs);
  } catch (error) {
    if (error instanceof RenderRefusal) {
      console.error(error.message);
      return 3;
    }
    throw error;
  }
  // A plan must not mutate the run, read credentials, download media or incur usage.
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, out: prepared.out, seconds: prepared.seconds,
      narrationRequested: withVoice, narrationTiming: withVoice ? "requires synthesis; not performed" : "silent",
      calibrationMs: prepared.calibrationMs, steps: prepared.steps.length }, null, 2));
    return 0;
  }
  // Private outputs even when the user's shell has a permissive umask.
  process.umask(0o077);
  mkdirSync(dirname(prepared.out), { recursive: true });
  if (process.platform === "win32") await privateDirectory(dirname(prepared.out));
  // Before any voice is made, so a brand that is not there costs nothing.
  let branding: Brand | undefined;
  if (brandArg !== undefined) {
    try {
      branding = installBrand(loadBrandProfile(brandArg), prepared.run);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 3;
    }
    console.log(`brand:    ${brandArg} — "${branding.slogan}"${branding.sound ? ` with ${branding.sound}` : ", silent"}`);
  }
  let clips: NarrationClip[] = [];
  if (withVoice) {
    let script: NarrationScript | undefined;
    let profile: ReturnType<typeof loadVoiceProfile>;
    try {
      // Read before any voice is made, so a bad script or speed costs nothing.
      script = scriptArg ? readScript(scriptArg, prepared.steps, roots) : undefined;
      profile = withSpeed(loadVoiceProfile(voiceProfile), speed ?? WALKTHROUGH_SPEED);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 3;
    }
    const key = loadApiKey([]);
    clips = await narrate(prepared.run, prepared.steps, profile, elevenLabs(key), undefined, script);
    const source = prepared.calibrationSource;
    const timing = {
      stepMinMs: stepMinMs(prepared.steps, clips),
      ...cardMinMs(clips, branding?.sound ? BRAND_STING_LEAD_MS : 0),
    };
    prepared = { ...prepare(run, out, roots, prepared.calibrationMs, timing), calibrationSource: source };
    const style = script ? `conversational script ${resolve(scriptArg!)}` : "captions";
    console.log(
      `voice:    ${profile.name} at ${profile.voice_settings.speed}×, ${clips.length} clips (${style}) in ${join(prepared.run, "narration")}`,
    );
  }
  writeFileSync(prepared.chaptersPath, prepared.chaptersText);
  console.log(`chapters: ${prepared.chaptersPath}`);
  console.log(`length:   ${Math.round(prepared.seconds)} s`);
  console.log(`sync:     ${prepared.calibrationMs} ms (${prepared.calibrationSource})`);
  const result = spawnSync(
    "node",
    [
      join(REMOTION_DIR, "node_modules", "@remotion", "cli", "remotion-cli.js"),
      "render",
      ENTRY,
      "WalkthroughVideo",
      prepared.out,
      `--public-dir=${prepared.run}`,
      `--props=${JSON.stringify({
        calibrationMs: prepared.calibrationMs,
        stepMinMs: prepared.stepMinMs,
        titleMs: prepared.titleMs,
        endMs: prepared.endMs,
        narration: clips,
        branding,
      })}`,
      "--codec=h264",
      "--crf=20",
      "--pixel-format=yuv420p",
      // A silent walkthrough can still open on a brand's sting, so muting follows the audio
      // actually in the composition, not the narration alone.
      ...(clips.length || branding?.sound ? ["--audio-codec=aac"] : ["--muted"]),
      "--log=error",
    ],
    { cwd: REMOTION_DIR, stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("Remotion render failed.");
    return result.status ?? 1;
  }
  console.log(`video:    ${prepared.out}`);
  if (stills) console.log(`stills:   ${writeStills(prepared)} (one per step; look at every one)`);
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
