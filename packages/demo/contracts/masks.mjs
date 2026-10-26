// Explicit, local capture-clock masks. Detection and audience choices belong to the agent.
export function maskBox(value) {
  return Array.isArray(value) ? {x:value[0], y:value[1], w:value[2], h:value[3]} : value;
}

export function validateMasks(capture, steps) {
  if (capture.masks === undefined) return [];
  if (!Array.isArray(capture.masks)) return ['masks must be an array; [] removes masking'];
  const {w, h} = capture.viewport ?? {};
  const start = steps[0]?.startMs;
  const end = steps.at(-1)?.endMs;
  const errors = [];
  for (const [i, mask] of capture.masks.entries()) {
    const where = `mask ${i + 1}`;
    if (!mask || typeof mask !== 'object' || Array.isArray(mask) ||
        Object.keys(mask).sort().join(',') !== 'box,fromMs,toMs') {
      errors.push(`${where}: needs only box, fromMs and toMs`); continue;
    }
    const b = maskBox(mask.box);
    if ((Array.isArray(mask.box) && mask.box.length !== 4) || !b ||
        Object.keys(b).sort().join(',') !== 'h,w,x,y' ||
        ![b.x,b.y,b.w,b.h].every(Number.isFinite) ||
        !(b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x+b.w <= w && b.y+b.h <= h)) {
      errors.push(`${where}: box must fit inside the capture viewport`);
    }
    if (![mask.fromMs,mask.toMs].every(Number.isFinite) ||
        !(start <= mask.fromMs && mask.fromMs <= mask.toMs && mask.toMs <= end)) {
      errors.push(`${where}: times must fit inside the recorded step range`);
    }
  }
  return errors;
}
