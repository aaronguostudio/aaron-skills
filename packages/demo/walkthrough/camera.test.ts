// The camera is only allowed to move because it keeps specific promises. These
// tests check the promises, not the easing: that it stays off unless asked, only
// follows geometry the capture asserted, opens and closes every step on the whole
// screen, and never reaches past the recording.
import {describe, expect, test} from 'bun:test';
import {buildTimeline, type Step} from '../remotion/src/projects/walkthrough-video/timeline';
import {cameraAt, cameraMoves, validateCamera, CAMERA_DEFAULTS, STILL} from '../remotion/src/projects/walkthrough-video/presentation/camera';

const VIEWPORT = {w: 1440, h: 900};
const on = {...CAMERA_DEFAULTS, enabled: true};

// One long step holding a checked field, and one with no saved geometry.
const steps: Step[] = [
  {id: 'review', caption: 'Check the total', kind: 'action', startMs: 0, endMs: 12000, clicks: [], shot: 'shots/01.png',
   focus: [{box: {x: 980, y: 180, w: 220, h: 72}, fromMs: 0, toMs: 12000}]},
  {id: 'plain', caption: 'Nothing asserted here', kind: 'action', startMs: 12000, endMs: 24000, clicks: [], shot: 'shots/02.png'},
];
const timeline = buildTimeline(steps);
const everyFrame = (fn: (frame: number) => void) => {
  for (let frame = 0; frame < timeline.durationInFrames; frame++) fn(frame);
};

describe('evidence-preserving camera', () => {
  test('stays still unless it is switched on', () => {
    expect(cameraMoves(timeline, steps, VIEWPORT, CAMERA_DEFAULTS)).toEqual([]);
    everyFrame(frame => expect(cameraAt([], frame, VIEWPORT)).toEqual(STILL));
  });

  test('only follows geometry the capture asserted', () => {
    const moves = cameraMoves(timeline, steps, VIEWPORT, on);
    expect(moves).toHaveLength(1);
    // The step without saved focus geometry never gets a move, however long it runs.
    const plain = timeline.segments.filter(s => s.step === 1);
    const span = {first: plain[0].fromFrame, last: Math.max(...plain.map(s => s.fromFrame + s.frames))};
    expect(moves.some(m => m.first >= span.first && m.first < span.last)).toBe(false);
  });

  test('opens and closes each step on the whole screen', () => {
    const moves = cameraMoves(timeline, steps, VIEWPORT, on);
    const first = timeline.segments.find(s => s.step === 0)!.fromFrame;
    // The settle window holds the full frame, so the outline is seen in context.
    expect(cameraAt(moves, first, VIEWPORT)).toEqual(STILL);
    expect(cameraAt(moves, moves[0].first - 1, VIEWPORT)).toEqual(STILL);
    // And it is back before the step hands over.
    expect(cameraAt(moves, moves[0].last - 1, VIEWPORT).scale).toBeCloseTo(1, 2);
    expect(cameraAt(moves, moves[0].last, VIEWPORT)).toEqual(STILL);
  });

  test('never reaches past the recording and never exceeds the limit', () => {
    const moves = cameraMoves(timeline, steps, VIEWPORT, {...on, maxScale: 2.5});
    everyFrame(frame => {
      const {scale, x, y} = cameraAt(moves, frame, VIEWPORT);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(scale).toBeLessThanOrEqual(2.5);
      expect(x).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(x + VIEWPORT.w / scale).toBeLessThanOrEqual(VIEWPORT.w + 1e-9);
      expect(y + VIEWPORT.h / scale).toBeLessThanOrEqual(VIEWPORT.h + 1e-9);
    });
  });

  test('keeps the asserted region inside the frame once it has moved', () => {
    const moves = cameraMoves(timeline, steps, VIEWPORT, on);
    const box = steps[0].focus![0].box as {x: number; y: number; w: number; h: number};
    const peak = moves[0].first + moves[0].inFrames + 5;
    const {scale, x, y} = cameraAt(moves, peak, VIEWPORT);
    expect(scale).toBeGreaterThan(1.05);
    expect(x).toBeLessThanOrEqual(box.x);
    expect(y).toBeLessThanOrEqual(box.y);
    expect(x + VIEWPORT.w / scale).toBeGreaterThanOrEqual(box.x + box.w);
    expect(y + VIEWPORT.h / scale).toBeGreaterThanOrEqual(box.y + box.h);
  });

  test('moves continuously, with no jump between frames', () => {
    const moves = cameraMoves(timeline, steps, VIEWPORT, on);
    let previous = cameraAt(moves, 0, VIEWPORT);
    everyFrame(frame => {
      const now = cameraAt(moves, frame, VIEWPORT);
      // A readable pan stays well under a twentieth of the frame per step.
      expect(Math.abs(now.scale - previous.scale)).toBeLessThan(0.08);
      expect(Math.abs(now.x - previous.x)).toBeLessThan(VIEWPORT.w * 0.05);
      expect(Math.abs(now.y - previous.y)).toBeLessThan(VIEWPORT.h * 0.05);
      previous = now;
    });
  });

  test('skips a step too short to open, hold and close', () => {
    const brief: Step[] = [{...steps[0], endMs: 1500, focus: [{box: {x: 980, y: 180, w: 220, h: 72}, fromMs: 0, toMs: 1500}]}];
    expect(cameraMoves(buildTimeline(brief), brief, VIEWPORT, on)).toEqual([]);
  });

  test('refuses settings it cannot honour', () => {
    expect(() => validateCamera({enabled: true, maxScale: 4})).toThrow('maxScale');
    expect(() => validateCamera({enabled: true, settleMs: 50})).toThrow('settleMs');
    expect(() => validateCamera({enabled: 'yes'})).toThrow('enabled');
    expect(() => validateCamera({enabled: true, zoom: 2})).toThrow('Unknown camera field');
    expect(() => validateCamera(undefined)).not.toThrow();
  });
});
