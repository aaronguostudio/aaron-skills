// An evidence-preserving camera: the frame may move toward a region the capture
// already asserted, never toward one chosen for looks.
//
// Layout refuses `fit` other than contain because a cropped still cannot be
// checked against the recording. A camera move is a different claim. It only
// targets a step's saved `focus` geometry, which exists because `rec.show`
// verified those field values; it shows the whole screen first, so the viewer
// sees the region in its context before it fills the frame; and it returns to
// the whole screen before the step ends. Nothing is removed from the video:
// every pixel the recording holds is on screen at the start and end of each
// move, and the overlays travel on the same transform as the picture.
//
// Off by default. Pure math, no Remotion: the composition applies the result and
// the tests check the guarantees without rendering.
import type {Step, Timeline, Box} from '../timeline';

export type CameraSettings = {enabled: boolean; maxScale: number; settleMs: number};
export const CAMERA_DEFAULTS: CameraSettings = {enabled: false, maxScale: 1.8, settleMs: 900};
// Easing either way, and the shortest move worth making. The pull-back takes as
// long as the push-in: a quicker one reads as a snap at the end of a step, which
// is where the viewer is reading the result.
const IN_MS = 520, OUT_MS = 520, MIN_HOLD_MS = 600;
// Keep this much of the frame around the evidence, so a move never crops to the
// outline itself; the viewer keeps the row, the card or the control it sits in.
const MARGIN = 2.2;

// The visible rectangle in capture coordinates. scale 1 with x/y 0 is the whole screen.
export type Camera = {scale: number; x: number; y: number};
export const STILL: Camera = {scale: 1, x: 0, y: 0};

export type CameraMove = {first: number; last: number; inFrames: number; outFrames: number; scale: number; cx: number; cy: number};

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function validateCamera(value: unknown): asserts value is CameraSettings | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Camera must be an object');
  const c = value as CameraSettings;
  if (Object.keys(value).some(k => !['enabled', 'maxScale', 'settleMs'].includes(k))) throw Error('Unknown camera field');
  if (typeof c.enabled !== 'boolean') throw Error('Camera needs enabled true or false');
  if (c.maxScale !== undefined && (!Number.isFinite(c.maxScale) || c.maxScale < 1 || c.maxScale > 2.5)) throw Error('Camera maxScale must be between 1 and 2.5');
  if (c.settleMs !== undefined && (!Number.isFinite(c.settleMs) || c.settleMs < 400 || c.settleMs > 4000)) throw Error('Camera settleMs must be between 400 and 4000');
}

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return {x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y};
};

const focusBox = (focus: {box: Box | [number, number, number, number]}): Box | null => {
  const b = focus.box;
  const box = Array.isArray(b) ? {x: b[0], y: b[1], w: b[2], h: b[3]} : b;
  return box && [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w > 0 && box.h > 0 ? box : null;
};

// One move per step that has asserted geometry and enough screen time to use it.
export function cameraMoves(timeline: Timeline, steps: Step[], viewport: {w: number; h: number}, settings: CameraSettings): CameraMove[] {
  if (!settings.enabled) return [];
  const fps = timeline.fps, ms = (n: number) => Math.round((n * fps) / 1000);
  const moves: CameraMove[] = [];
  for (const [index, step] of steps.entries()) {
    const boxes = (step.focus ?? []).map(focusBox).filter((b): b is Box => b !== null);
    if (!boxes.length) continue;
    const segments = timeline.segments.filter(s => s.step === index);
    if (!segments.length) continue;
    const start = segments[0].fromFrame, end = Math.max(...segments.map(s => s.fromFrame + s.frames));
    const first = start + ms(settings.settleMs), inFrames = ms(IN_MS), outFrames = ms(OUT_MS);
    // The whole screen opens and closes the step; a move needs a real hold between.
    if (end - first < inFrames + outFrames + ms(MIN_HOLD_MS)) continue;
    const box = union(boxes);
    const scale = clamp(Math.min(viewport.w / (box.w * MARGIN), viewport.h / (box.h * MARGIN)), 1, settings.maxScale);
    if (scale <= 1.05) continue;
    moves.push({first, last: end, inFrames, outFrames, scale, cx: box.x + box.w / 2, cy: box.y + box.h / 2});
  }
  return moves;
}

export function cameraAt(moves: CameraMove[], frame: number, viewport: {w: number; h: number}): Camera {
  const move = moves.find(m => frame >= m.first && frame < m.last);
  if (!move) return STILL;
  const held = move.last - move.first;
  const rising = clamp((frame - move.first) / move.inFrames, 0, 1);
  // Reach the whole screen on the step's last visible frame, not one frame after
  // it: a move still closing when the step hands over shows as a jump.
  const falling = clamp((move.last - 1 - frame) / move.outFrames, 0, 1);
  const t = smooth(Math.min(rising, falling, 1)) * (held > 0 ? 1 : 0);
  const scale = 1 + (move.scale - 1) * t;
  // Interpolate the centre from the middle of the screen, so the move starts
  // exactly where the still frame was and cannot jump.
  const cx = viewport.w / 2 + (move.cx - viewport.w / 2) * t;
  const cy = viewport.h / 2 + (move.cy - viewport.h / 2) * t;
  const w = viewport.w / scale, h = viewport.h / scale;
  // Clamped so the view never reaches past the recording: no invented pixels.
  return {scale, x: clamp(cx - w / 2, 0, viewport.w - w), y: clamp(cy - h / 2, 0, viewport.h - h)};
}
