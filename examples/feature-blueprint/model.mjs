// Fictional in-memory simulation. A backend must independently enforce these rules.
export const people = Object.freeze({
  jules: {id: 'jules', name: 'Jules Reed', role: 'requester'},
  morgan: {id: 'morgan', name: 'Morgan Vale', role: 'coordinator'},
  casey: {id: 'casey', name: 'Casey Park', role: 'requester'},
});
export const equipment = ['Camera kit', 'Lighting kit', 'Audio kit'];
const clone = (v) => structuredClone(v);
export class RuleError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new RuleError(code, message); };
function person(id) { return Object.hasOwn(people, id) ? people[id] : fail('forbidden', 'Unknown simulated identity.'); }
function visible(record, actor) {
  return record.ownerId === actor.id || (actor.role === 'coordinator' && record.status !== 'Draft');
}
export function can(record, actorId, action) {
  const actor = person(actorId);
  if (!visible(record, actor)) return false;
  if (['save', 'submit'].includes(action)) return record.ownerId === actorId && record.status === 'Draft';
  if (action === 'revise') return record.ownerId === actorId && record.status === 'Rejected';
  if (['approve', 'reject'].includes(action)) return actor.role === 'coordinator' && record.ownerId !== actorId && record.status === 'Submitted';
  return false;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function checkForm(record) {
  if (!equipment.includes(record.equipment)) fail('invalid', 'Choose a supported equipment kit.');
  if (record.purpose.length < 10 || record.purpose.length > 240) fail('invalid', 'Purpose must contain 10–240 characters.');
  if (!validDate(record.startDate) || !validDate(record.endDate)) fail('invalid', 'Enter two valid calendar dates.');
  if (record.endDate < record.startDate) fail('invalid', 'End date must be on or after start date.');
}
export function createStore({empty = false} = {}) {
  const records = new Map();
  const operations = new Map();
  let sequence = 110;
  function seed(id, ownerId, status, purpose, kit = 'Camera kit') {
    records.set(id, {id, ownerId, status, purpose, equipment: kit, startDate: '2026-11-03', endDate: '2026-11-05', version: 1, rejectionReason: '', history: []});
  }
  if (!empty) {
    seed('REQ-104', 'jules', 'Draft', 'Record a short workshop for the design team');
    seed('REQ-105', 'casey', 'Submitted', 'Capture lighting references for the studio', 'Lighting kit');
    seed('REQ-106', 'morgan', 'Submitted', 'Prepare equipment for a community interview', 'Audio kit');
    seed('REQ-107', 'casey', 'Draft', 'An unfinished request visible only to Casey');
  }
  function read(id, actorId) {
    const actor = person(actorId), record = records.get(id);
    if (!record || !visible(record, actor)) fail('forbidden', 'Request unavailable to this identity.');
    return clone(record);
  }
  return {
    list(actorId) { const actor = person(actorId); return [...records.values()].filter(r => visible(r, actor)).map(clone); },
    read,
    createDraft(actorId) {
      person(actorId);
      const id = `REQ-${sequence++}`;
      records.set(id, {id, ownerId: actorId, status: 'Draft', equipment: equipment[0], purpose: '', startDate: '', endDate: '', version: 0, rejectionReason: '', history: []});
      return read(id, actorId);
    },
    apply({id, actorId, action, expectedVersion, operationId, patch = {}, reason = ''}) {
      const actor = person(actorId);
      // R1/R4: visibility is checked before even an idempotent response is returned.
      const before = read(id, actorId);
      if (typeof operationId !== 'string' || !operationId.trim()) fail('invalid', 'Operation ID is required.');
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) fail('invalid', 'Expected version is required.');
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('invalid', 'Invalid draft fields.');
      const allowed = ['equipment', 'purpose', 'startDate', 'endDate'];
      if (Object.entries(patch).some(([k, v]) => !allowed.includes(k) || typeof v !== 'string')) fail('invalid', 'Only text draft fields may be changed.');
      if (typeof reason !== 'string') fail('invalid', 'Reason must be text.');
      const key = `${actor.id}:${operationId}`;
      const normalizedPatch = Object.fromEntries(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b)));
      const payload = JSON.stringify({id, action, expectedVersion, patch: normalizedPatch, reason});
      if (operations.has(key)) {
        const previous = operations.get(key);
        if (previous.payload !== payload) fail('conflict', 'Operation ID already used for a different action.');
        return {record: clone(previous.record), replayed: true};
      }
      const ownerAction = ['save', 'submit', 'revise'].includes(action) && before.ownerId === actorId;
      const reviewAction = ['approve', 'reject'].includes(action) && actor.role === 'coordinator' && before.ownerId !== actorId;
      if (!ownerAction && !reviewAction) fail('forbidden', 'This identity cannot perform that action.');
      if (before.version !== expectedVersion) fail('stale', 'This view is stale. Refresh the request before trying again.');
      if (!can(before, actorId, action)) fail('forbidden', 'This action is unavailable in the current state.');
      if (!['save', 'submit'].includes(action) && Object.keys(patch).length) fail('invalid', 'Review actions cannot edit draft fields.');
      const after = {...before, ...patch};
      after.purpose = after.purpose.trim();
      if (action === 'submit') { checkForm(after); after.status = 'Submitted'; }
      if (action === 'approve') after.status = 'Approved';
      if (action === 'reject') {
        const trimmed = reason.trim();
        if (trimmed.length < 5 || trimmed.length > 240) fail('invalid', 'Rejection reason must contain 5–240 characters.');
        after.status = 'Rejected'; after.rejectionReason = trimmed;
      }
      if (action === 'revise') { after.status = 'Draft'; after.rejectionReason = ''; }
      after.version += 1;
      after.history = [...before.history, {id: `${id}-v${after.version}`, actorId, operationId, from: before.status, to: after.status, action, reason: action === 'reject' ? after.rejectionReason : '', occurredAt: new Date().toISOString()}];
      records.set(id, after);
      operations.set(key, {payload, record: clone(after)});
      return {record: clone(after), replayed: false};
    },
  };
}
