// Pure timeline math for WalkthroughVideo. The composition and the render CLI share it, so the
// chapters written next to the mp4 always match what the video shows.
//
// Input is a capture folder (contract version 1): capture.json, steps.json, video.webm, shots/.
// The output timeline is: title card, then the recording from the first step on (the lead-in
// before it, sign-in and page loads, is left out) cut into segments (actions at normal speed,
// waits and long gaps fast-forwarded), then an end card.

import { validateEvidence } from "../../../../contracts/evidence.mjs";

export const FPS = 30;
export const TITLE_MS = 2500;
// A brand's sting and the opening line should not start together: the sting plays, and the
// voice comes in over its decay. The opening card is lengthened by the same amount.
export const BRAND_STING_LEAD_MS = 1400;
export const END_MS = 2500;
export const RESULT_HOLD_MS = 2000;
export const CAPTION_BAND = 96;
export const MAX_SPEED = 16;
// A fast-forwarded stretch lasts about this long on screen.
export const FAST_FORWARD_TARGET_MS = 2000;
// Gaps between steps shorter than this play at normal speed.
export const GAP_FAST_FORWARD_MS = 1500;
// A step that needs more time than it recorded holds a frame: an action with clicks just before
// its first click (the pointer is on the target and the target is outlined), an action without
// clicks on its last frame (the finished screen), a wait on its last frame (what it waited for).
export const PRE_CLICK_MS = 180;

export type Box = { x: number; y: number; w: number; h: number };
export type Click = { tMs: number; x: number; y: number; box?: Box };
// A region the step is about (a card, a row, a total), outlined while it is shown. Some capture
// tools write the box as [x, y, w, h].
export type Focus = { box: Box | [number, number, number, number]; fromMs: number; toMs: number };
export type StepKind = "action" | "wait";
export type Step = {
  id: string;
  caption: string;
  kind: StepKind;
  startMs: number;
  endMs: number;
  clicks: Click[];
  shot: string | null;
  narration?: string;
  focus?: Focus[];
  targets?: Record<string, { boxes: Box[]; fromMs: number; toMs: number }>;
  evidence?: Record<string, { kind: "text" | "integer" | "dollarMinor" | "count"; expected: string | number }>;
};
export type Capture = {
  version: 1;
  walk: string;
  env: string;
  title: string;
  subtitle?: string;
  appRevision?: string;
  startedAt: string;
  viewport: { w: number; h: number };
  status: "passed" | "failed";
  failedStep?: string;
  failure?: string;
  calibrationMs?: number;
  // A sync flash: at tMs (capture clock) the page turned from black to white. The renderer finds
  // that frame in the recording and derives calibrationMs from it.
  sync?: { tMs: number };
};

export type Segment = {
  srcStartMs: number;
  srcEndMs: number;
  speed: number;
  fromFrame: number;
  frames: number;
  // Index into steps, or null for a gap between steps.
  step: number | null;
  // A still image shown instead of the recording (a result step with no recorded duration).
  still?: string;
  // The recording held on its frame at srcStartMs, so a short step stays up long enough.
  freeze?: boolean;
};

export type TimelineOptions = {
  // The least time each step stays on screen, in output ms. Defaults to the time it takes to read
  // the caption; narration passes the length of the step's voice clip instead.
  minStepMs?: (step: Step, index: number) => number;
  // The least time the title and end cards stay up, for an opening or closing narration line.
  // Never shorter than TITLE_MS and END_MS.
  titleMs?: number;
  endMs?: number;
};

// Time to notice a caption and read it, as subtitles are timed: 0.8 s to notice it, then about
// 18 characters a second, within bounds.
export const READ_MIN_MS = 2000;
export const READ_MAX_MS = 6000;

export function readingMs(caption: string): number {
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, Math.round(800 + 55 * caption.trim().length)));
}

export type Timeline = {
  fps: number;
  titleFrames: number;
  endFrames: number;
  videoFrames: number;
  durationInFrames: number;
  segments: Segment[];
};

export function validateCapture(capture: Capture, steps: Step[]): string[] {
  const problems: string[] = [];
  if (!capture || typeof capture !== "object") return ["capture.json must be an object"];
  if (capture.version !== 1) problems.push(`capture.json version is ${capture.version}, expected 1`);
  if (capture.status !== "passed") {
    problems.push(
      `capture status is "${capture.status}"` +
        (capture.failedStep ? ` at step "${capture.failedStep}"` : "") +
        "; only a passed walk gets a video",
    );
  }
  const { w, h } = capture.viewport ?? { w: 0, h: 0 };
  if (!(w > 0 && h > 0 && w % 2 === 0 && h % 2 === 0)) {
    problems.push(`viewport ${w}x${h} must be positive and even (H.264)`);
  }
  if (typeof capture.title !== "string" || !capture.title.trim()) problems.push("capture.json has no title");
  if (capture.sync !== undefined && !(Number.isFinite(capture.sync?.tMs) && capture.sync.tMs >= 0)) {
    problems.push("capture.json sync.tMs must be a non-negative number");
  }
  if (capture.calibrationMs !== undefined && !Number.isFinite(capture.calibrationMs)) problems.push("Invalid calibrationMs");
  if (!Array.isArray(steps) || steps.length === 0) {
    problems.push("steps.json has no steps");
    return problems;
  }
  let previousEnd = 0;
  const ids = new Set<string>();
  steps.forEach((step, i) => {
    if (!step || typeof step !== "object") { problems.push(`step ${i + 1}: must be an object`); return; }
    const where = `step ${i + 1} (${step.id})`;
    if (typeof step.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(step.id) || ids.has(step.id)) problems.push(`${where}: missing or duplicate id`);
    ids.add(step.id);
    if (typeof step.caption !== "string" || !step.caption.trim()) problems.push(`${where}: empty caption`);
    if (step.kind !== "action" && step.kind !== "wait") problems.push(`${where}: kind must be action or wait`);
    if (!(Number.isFinite(step.startMs) && step.startMs >= previousEnd)) problems.push(`${where}: starts before the previous step ends`);
    if (!(Number.isFinite(step.endMs) && step.endMs >= step.startMs)) problems.push(`${where}: ends before it starts`);
    previousEnd = Math.max(previousEnd, step.endMs);
    if (!Array.isArray(step.clicks ?? []) || !Array.isArray(step.focus ?? [])) { problems.push(`${where}: clicks/focus must be arrays`); return; }
    for (const click of step.clicks ?? []) {
      if (!click || ![click.tMs, click.x, click.y].every(Number.isFinite)) { problems.push(`${where}: invalid click`); continue; }
      if (click.tMs < step.startMs || click.tMs > step.endMs) problems.push(`${where}: click at ${click.tMs} ms is outside the step`);
      if (click.x < 0 || click.y < 0 || click.x > w || click.y > h) problems.push(`${where}: click (${click.x}, ${click.y}) is outside the viewport`);
    }
    for (const focus of step.focus ?? []) {
      if (!focus || ![focus.fromMs, focus.toMs].every(Number.isFinite)) { problems.push(`${where}: invalid focus`); continue; }
      if (!focusBox(focus)) problems.push(`${where}: a focus needs a box {x, y, w, h} or [x, y, w, h]`);
      if (!(focus.fromMs >= step.startMs && focus.toMs <= step.endMs && focus.toMs >= focus.fromMs)) {
        problems.push(`${where}: focus from ${focus.fromMs} to ${focus.toMs} ms is outside the step`);
      }
    }
    if (step.shot != null && (typeof step.shot !== "string" || step.shot.startsWith("/") || step.shot.split(/[\\/]/).includes(".."))) {
      problems.push(`${where}: shot path must stay inside the capture folder`);
    }
    problems.push(...validateEvidence(step, { w, h }));
  });
  return problems;
}

// Apply the capture's calibration offset to every time it carries.
export function calibrate(steps: Step[], calibrationMs = 0): Step[] {
  if (!calibrationMs) return steps;
  return steps.map((step) => ({
    ...step,
    startMs: step.startMs + calibrationMs,
    endMs: step.endMs + calibrationMs,
    clicks: (step.clicks ?? []).map((c) => ({ ...c, tMs: c.tMs + calibrationMs })),
    ...(step.focus ? { focus: step.focus.map((f) => ({ ...f, fromMs: f.fromMs + calibrationMs, toMs: f.toMs + calibrationMs })) } : {}),
  }));
}

export function focusBox(focus: Focus): Box | null {
  const b = focus.box;
  const box = Array.isArray(b) ? (b.length === 4 ? { x: b[0], y: b[1], w: b[2], h: b[3] } : null) : b;
  if (!box || ![box.x, box.y, box.w, box.h].every(Number.isFinite) || box.w <= 0 || box.h <= 0) return null;
  return box;
}

// The recorded moment a step holds on when it needs more time than it recorded.
function holdPoint(step: Step): number {
  const lastFrame = Math.max(step.startMs, step.endMs - Math.ceil(1000 / FPS));
  // A wait is about what it was waiting for. Holding its first frame leaves the caption to be read
  // against the spinner, with the pointer and outlines already on controls that have not rendered.
  if (step.kind === "wait") return lastFrame;
  const [first] = step.clicks ?? [];
  if (first) return Math.min(step.endMs, Math.max(step.startMs, first.tMs - PRE_CLICK_MS));
  // The last frame, or earlier if the step's last focus ended before it: hold while it is up.
  const focusEnds = (step.focus ?? []).map((f) => f.toMs);
  const lastFocusEnd = focusEnds.length ? Math.max(...focusEnds) : Infinity;
  return Math.max(step.startMs, Math.min(lastFrame, lastFocusEnd));
}

export function speedFor(durationMs: number, fastForward: boolean): number {
  if (!fastForward) return 1;
  return Math.min(MAX_SPEED, Math.max(1, Math.ceil(durationMs / FAST_FORWARD_TARGET_MS)));
}

const msToFrames = (ms: number) => Math.round((ms * FPS) / 1000);

export function buildTimeline(steps: Step[], options: TimelineOptions = {}): Timeline {
  const minStepMs = options.minStepMs ?? ((step: Step) => readingMs(step.caption));
  type Piece = Omit<Segment, "fromFrame" | "frames"> & { outMs: number };
  const pieces: Piece[] = [];
  let cursor = steps[0]?.startMs ?? 0;
  steps.forEach((step, i) => {
    if (step.startMs > cursor) {
      const gap = step.startMs - cursor;
      const speed = speedFor(gap, gap >= GAP_FAST_FORWARD_MS);
      pieces.push({ srcStartMs: cursor, srcEndMs: step.startMs, speed, step: null, outMs: gap / speed });
    }
    const duration = step.endMs - step.startMs;
    const minMs = Math.max(0, minStepMs(step, i));
    if (duration === 0) {
      // Nothing recorded for this step: hold its shot (the result) as a still.
      if (step.shot) {
        pieces.push({ srcStartMs: step.startMs, srcEndMs: step.endMs, speed: 1, step: i, still: step.shot, outMs: Math.max(RESULT_HOLD_MS, minMs) });
      } else if (minMs > 0) {
        pieces.push({ srcStartMs: step.startMs, srcEndMs: step.startMs, speed: 1, step: i, freeze: true, outMs: minMs });
      }
    } else {
      let speed = speedFor(duration, step.kind === "wait");
      // Fast-forward no faster than the caption can be read.
      if (duration / speed < minMs) speed = Math.max(1, Math.floor(duration / minMs));
      const shown = duration / speed;
      if (shown < minMs) {
        // Still too short at normal speed: hold one frame for the rest of the time (see
        // PRE_CLICK_MS), so the caption is read while the screen shows what it is about.
        const at = holdPoint(step);
        if (at > step.startMs) pieces.push({ srcStartMs: step.startMs, srcEndMs: at, speed, step: i, outMs: (at - step.startMs) / speed });
        pieces.push({ srcStartMs: at, srcEndMs: at, speed: 1, step: i, freeze: true, outMs: minMs - shown });
        if (step.endMs > at) pieces.push({ srcStartMs: at, srcEndMs: step.endMs, speed, step: i, outMs: (step.endMs - at) / speed });
      } else {
        pieces.push({ srcStartMs: step.startMs, srcEndMs: step.endMs, speed, step: i, outMs: shown });
      }
    }
    cursor = Math.max(cursor, step.endMs);
  });

  // Frame positions come from cumulative milliseconds, so rounding never drifts.
  const titleFrames = msToFrames(Math.max(TITLE_MS, options.titleMs ?? 0));
  let outMs = 0;
  const segments: Segment[] = [];
  for (const piece of pieces) {
    const fromFrame = titleFrames + msToFrames(outMs);
    outMs += piece.outMs;
    const frames = titleFrames + msToFrames(outMs) - fromFrame;
    if (frames <= 0) continue;
    const { outMs: _ignored, ...segment } = piece;
    segments.push({ ...segment, fromFrame, frames });
  }
  const videoFrames = msToFrames(outMs);
  const endFrames = msToFrames(Math.max(END_MS, options.endMs ?? 0));
  return { fps: FPS, titleFrames, endFrames, videoFrames, durationInFrames: titleFrames + videoFrames + endFrames, segments };
}

// The output frame at which a moment of the recording is shown.
export function sourceMsToFrame(timeline: Timeline, ms: number): number {
  const { segments } = timeline;
  if (segments.length === 0) return timeline.titleFrames;
  let seg = segments.find((s) => !s.still && ms >= s.srcStartMs && ms < s.srcEndMs);
  if (!seg) seg = ms < segments[0].srcStartMs ? segments[0] : segments[segments.length - 1];
  const within = Math.min(Math.max(ms - seg.srcStartMs, 0), seg.srcEndMs - seg.srcStartMs);
  return seg.fromFrame + Math.min(seg.frames - 1, Math.round(((within / seg.speed) * FPS) / 1000));
}

export function stepAtFrame(timeline: Timeline, frame: number): Segment | undefined {
  return timeline.segments.find((s) => frame >= s.fromFrame && frame < s.fromFrame + s.frames);
}

export function formatClock(frame: number, fps = FPS): string {
  const total = Math.floor(frame / fps);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// One line per step: "m:ss  Caption", at the frame where the step first appears.
export function chapters(timeline: Timeline, steps: Step[]): string {
  const lines: string[] = [];
  steps.forEach((step, i) => {
    const seg = timeline.segments.find((s) => s.step === i);
    if (seg) lines.push(`${formatClock(seg.fromFrame, timeline.fps)}  ${step.caption}`);
  });
  return lines.join("\n") + "\n";
}

// The output frames on which the recording shows a moment between fromMs and toMs, held frames
// included. Null when no frame does (for example a moment in the left-out lead-in).
export function framesShowing(timeline: Timeline, fromMs: number, toMs: number): { first: number; last: number } | null {
  let first: number | null = null;
  let last = 0;
  for (const s of timeline.segments) {
    if (s.still) continue;
    let a: number;
    let b: number;
    if (s.srcEndMs === s.srcStartMs) {
      if (s.srcStartMs < fromMs || s.srcStartMs > toMs) continue;
      [a, b] = [0, s.frames - 1];
    } else {
      const msPerFrame = (1000 / FPS) * s.speed;
      a = Math.max(0, Math.ceil((fromMs - s.srcStartMs) / msPerFrame));
      b = Math.min(s.frames - 1, Math.floor((toMs - s.srcStartMs) / msPerFrame));
      if (a > b) continue;
    }
    first ??= s.fromFrame + a;
    last = s.fromFrame + b;
  }
  return first === null ? null : { first, last };
}

// The pointer, drawn over the recording (Playwright records none). It glides onto each click
// target about a second (of recording) before the click, rests there through any pre-click hold,
// and ripples where the click lands. On a step that clicks nothing it parks beside the step's
// first focus region, far enough off it that its halo (25 px) clears the outline.
export const POINTER_LEAD_MS = 1050;
const GLIDE_FRAMES = 18;
const PARK_GAP = 30;
const POINTER_W = 24;

type Target = { x: number; y: number; arrive: number; click: number | null; box?: Box };

function parkBeside(box: Box, viewport: { w: number; h: number }): { x: number; y: number } | null {
  const y = Math.min(viewport.h - 40, box.y + Math.min(box.h / 2, 60));
  if (box.x + box.w + PARK_GAP + POINTER_W <= viewport.w) return { x: box.x + box.w + PARK_GAP, y };
  if (box.x - PARK_GAP - POINTER_W >= 0) return { x: box.x - PARK_GAP - POINTER_W, y };
  return null;
}

function pointerTargets(timeline: Timeline, steps: Step[], viewport: { w: number; h: number }): Target[] {
  const targets: Target[] = [];
  // The pointer leaves its last target no earlier than this frame, and needs GLIDE_FRAMES to move.
  let leave = timeline.titleFrames;
  for (const step of steps) {
    if (step.clicks?.length) {
      for (const click of step.clicks) {
        const at = sourceMsToFrame(timeline, click.tMs);
        const lead = framesShowing(timeline, Math.max(step.startMs, click.tMs - POINTER_LEAD_MS), click.tMs)?.first ?? at;
        const arrive = Math.min(at, Math.max(lead, leave + GLIDE_FRAMES));
        targets.push({ x: click.x, y: click.y, arrive, click: at, box: click.box });
        leave = at;
      }
      continue;
    }
    const focus = step.focus?.[0];
    const box = focus && focusBox(focus);
    const park = box && parkBeside(box, viewport);
    const range = park && framesShowing(timeline, focus!.fromMs, focus!.toMs);
    if (park && range) {
      targets.push({ ...park, arrive: Math.max(range.first, leave + GLIDE_FRAMES), click: null });
      leave = targets[targets.length - 1].arrive;
    }
  }
  return targets;
}

export type CursorState = { x: number; y: number; visible: boolean; ripple: number | null };

export function cursorAt(timeline: Timeline, steps: Step[], viewport: { w: number; h: number }, frame: number): CursorState {
  const targets = pointerTargets(timeline, steps, viewport);
  const clicks = targets.flatMap((t) => (t.click === null ? [] : [t.click]));
  const videoEnd = timeline.titleFrames + timeline.videoFrames;
  if (targets.length === 0 || frame < timeline.titleFrames || frame >= videoEnd) {
    return { x: viewport.w / 2, y: viewport.h / 2, visible: false, ripple: null };
  }
  let previous = { x: viewport.w / 2, y: viewport.h / 2, leave: timeline.titleFrames };
  for (const target of targets) {
    if (frame < target.arrive) {
      const start = Math.max(previous.leave, target.arrive - GLIDE_FRAMES);
      const t = frame <= start ? 0 : (frame - start) / Math.max(1, target.arrive - start);
      const eased = t * t * (3 - 2 * t);
      return { x: previous.x + (target.x - previous.x) * eased, y: previous.y + (target.y - previous.y) * eased, visible: true, ripple: rippleAt(clicks, frame) };
    }
    previous = { x: target.x, y: target.y, leave: target.click ?? target.arrive };
  }
  return { x: previous.x, y: previous.y, visible: true, ripple: rippleAt(clicks, frame) };
}

// Outlines, drawn over the recording: the control being clicked (from its logged box), from the
// moment the pointer lands on it until just after the click, and each focus region a step names,
// while the recording shows it. An outline draws itself on as it appears and fades as it goes.
export const CLICK_OUTLINE_TAIL_MS = 180;
const OUTLINE_PAD = { x: 6, y: 5 };
const DRAW_FRAMES = 12;
const FADE_FRAMES = 6;

export type Highlight = { kind: "click" | "focus"; box: Box; draw: number; opacity: number };

function outlines(timeline: Timeline, steps: Step[], viewport: { w: number; h: number }) {
  const marks: { kind: Highlight["kind"]; box: Box; first: number; last: number }[] = [];
  const pad = (b: Box): Box => ({ x: b.x - OUTLINE_PAD.x, y: b.y - OUTLINE_PAD.y, w: b.w + 2 * OUTLINE_PAD.x, h: b.h + 2 * OUTLINE_PAD.y });
  for (const step of steps) {
    for (const focus of step.focus ?? []) {
      const box = focusBox(focus);
      const range = box && framesShowing(timeline, focus.fromMs, focus.toMs);
      if (box && range) marks.push({ kind: "focus", box: pad(box), ...range });
    }
  }
  for (const target of pointerTargets(timeline, steps, viewport)) {
    if (!target.box || target.click === null) continue;
    const tail = Math.round((CLICK_OUTLINE_TAIL_MS * FPS) / 1000);
    marks.push({ kind: "click", box: pad(target.box), first: target.arrive, last: target.click + tail });
  }
  return marks;
}

export function highlightsAt(timeline: Timeline, steps: Step[], viewport: { w: number; h: number }, frame: number): Highlight[] {
  const videoEnd = timeline.titleFrames + timeline.videoFrames;
  if (frame < timeline.titleFrames || frame >= videoEnd) return [];
  return outlines(timeline, steps, viewport)
    .filter((m) => frame >= m.first && frame <= m.last)
    .map((m) => ({
      kind: m.kind,
      box: m.box,
      draw: Math.min(1, (frame - m.first + 1) / DRAW_FRAMES),
      opacity: Math.min(1, (m.last - frame + 1) / FADE_FRAMES),
    }));
}

const RIPPLE_FRAMES = 15;

function rippleAt(clicks: number[], frame: number): number | null {
  for (const click of clicks) {
    const age = frame - click;
    if (age >= 0 && age < RIPPLE_FRAMES) return age / RIPPLE_FRAMES;
  }
  return null;
}

// One output frame per step to look at before delivering: the middle of its hold (the frame the
// viewer looks at longest), else a few frames before it ends.
export function stillFrames(timeline: Timeline, steps: Step[]): { id: string; index: number; frame: number }[] {
  return steps.flatMap((step, index) => {
    const own = timeline.segments.filter((s) => s.step === index);
    if (own.length === 0) return [];
    const hold = own.find((s) => s.freeze || s.still);
    const last = own[own.length - 1];
    const frame = hold ? hold.fromFrame + Math.floor(hold.frames / 2) : last.fromFrame + Math.max(0, last.frames - 3);
    return [{ id: step.id, index, frame }];
  });
}
