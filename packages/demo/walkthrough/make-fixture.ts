#!/usr/bin/env bun
// A synthetic capture folder for testing WalkthroughVideo: a 12-second recording of a dummy page
// drawn with ffmpeg (coloured blocks that change when "clicked"), plus matching steps and shots.
// No real application, product or screenshot is involved.
//
//   npx -y bun packages/demo/walkthrough/make-fixture.ts <empty folder outside the repo>
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { Capture, Step } from "../remotion/src/projects/walkthrough-video/timeline";

const W = 1440;
const H = 900;
const SECONDS = 12;
const OPEN = { x: 120, y: 160, w: 220, h: 56 };
const SAVE = { x: 600, y: 500, w: 160, h: 56 };
const centre = (b: typeof OPEN) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
// Like a real capture, the logged clock runs ahead of the recording. The video opens black and
// turns light at 0.4 s, which the capture logged at 0.4 s + SKEW_MS (capture.json sync.tMs);
// the renderer must measure the skew and take it off every time.
export const SKEW_MS = 300;
const FLASH_S = 0.4;
const at = (videoMs: number) => videoMs + SKEW_MS;

export const fixtureSteps: Step[] = [
  { id: "open", caption: "Open the form", kind: "action", startMs: at(1000), endMs: at(3000), clicks: [{ tMs: at(2500), ...centre(OPEN), box: OPEN }], shot: "shots/01-open.png" },
  { id: "save", caption: "Save it", kind: "action", startMs: at(3000), endMs: at(5200), clicks: [{ tMs: at(5000), ...centre(SAVE), box: SAVE }], shot: "shots/02-save.png" },
  { id: "saving", caption: "Wait while it saves", kind: "wait", startMs: at(5200), endMs: at(11000), clicks: [], shot: "shots/03-saving.png" },
  { id: "done", caption: "Saved", kind: "action", startMs: at(11000), endMs: at(11000), clicks: [], shot: "shots/04-done.png" },
];

const box = (b: { x: number; y: number; w: number; h: number }, color: string, from: number, to: number) =>
  `drawbox=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}:color=${color}:t=fill:enable='between(t,${from},${to})'`;

export function makeFixture(dirArg: string): string {
  const dir = resolve(dirArg);
  mkdirSync(join(dir, "shots"), { recursive: true });
  const filters = [
    `drawbox=x=0:y=0:w=${W}:h=64:color=0x1f2937:t=fill`, // app bar
    box(OPEN, "0x2563eb", 0, 2.5), // the button, then pressed
    box(OPEN, "0x1e3a8a", 2.5, SECONDS),
    box({ x: 560, y: 260, w: 480, h: 360 }, "0xe5e7eb", 3, SECONDS), // the form panel
    box(SAVE, "0x16a34a", 3, 5), // the save button, then pressed
    box(SAVE, "0x14532d", 5, SECONDS),
    ...[0, 1, 2, 3, 4, 5].map((i) => box({ x: 600 + i * 60, y: 420, w: 40, h: 40 }, "0xf59e0b", 5.2 + i, 11)), // progress
    box({ x: 600, y: 420, w: 400, h: 40 }, "0x22c55e", 11, SECONDS), // done
    box({ x: 0, y: 0, w: W, h: H }, "black", 0, FLASH_S - 0.01), // the sync flash
  ].join(",");
  const video = join(dir, "video.webm");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0xf4f6fa:s=${W}x${H}:d=${SECONDS}:r=25`, "-vf", filters, "-c:v", "libvpx", "-b:v", "1M", video]);
  const shotAt: Record<string, number> = { open: 2.0, save: 4.5, saving: 6.0, done: 11.5 };
  for (const step of fixtureSteps) {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(shotAt[step.id]), "-i", video, "-frames:v", "1", join(dir, step.shot!)]);
  }
  const capture: Capture = {
    version: 1,
    walk: "synthetic-form",
    env: "local",
    title: "Synthetic walkthrough",
    subtitle: "Open a form, save it, wait for it to finish",
    appRevision: "fixture",
    startedAt: "2026-10-05T00:00:00.000Z",
    viewport: { w: W, h: H },
    status: "passed",
    sync: { tMs: at(FLASH_S * 1000) },
  };
  writeFileSync(join(dir, "capture.json"), JSON.stringify(capture, null, 2) + "\n");
  writeFileSync(join(dir, "steps.json"), JSON.stringify(fixtureSteps, null, 2) + "\n");
  return dir;
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: make-fixture.ts <empty folder outside the repo>");
    process.exit(2);
  }
  console.log(makeFixture(dir));
}
