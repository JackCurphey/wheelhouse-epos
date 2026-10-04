// Run: node --test docs/design/user-journeys/generator/consolidate/
import test from 'node:test';
import assert from 'node:assert/strict';
import { blocks, screens, loadPlan } from './plan.mjs';

const all = screens();
const { plan, dupes, lines } = await loadPlan();
const ids = new Set(all.map((s) => s.id));

test('every screen in journeys.mjs has a plan entry', () => {
  const missing = all.filter((s) => !plan.has(s.id)).map((s) => s.id);
  assert.deepEqual(missing, [], `${missing.length} screens have no entry`);
});

test('no screen is planned twice, and no entry names a screen that does not exist', () => {
  assert.deepEqual(dupes, []);
  assert.deepEqual([...plan.keys()].filter((id) => !ids.has(id)), []);
});

test('every "into" points at a kept screen', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'into' && plan.get(e.id)?.kind !== 'keep').map(([id, e]) => `${id} → ${e.id}`);
  assert.deepEqual(bad, []);
});

test('every kept screen names a building block from the README', () => {
  const B = blocks();
  assert.ok(B.size >= 15, 'README building-block list not found');
  const bad = [...plan].filter(([, e]) => e.kind === 'keep' && !B.has(e.block)).map(([id, e]) => `${id}: ${e.block}`);
  assert.deepEqual(bad, []);
});

test('every "later" says why', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'later' && !String(e.reason || '').trim()).map(([id]) => id);
  assert.deepEqual(bad, []);
});

test('the canvas fits: at most 450 screen boards', () => {
  const boards = [...plan.values()].filter((e) => e.kind === 'keep').reduce((n, e) => n + (e.sizes?.length || 1), 0);
  assert.ok(boards <= 450, `${boards} boards`);
});

test('every extra situation line sits on a kept screen and says what and who', () => {
  const bad = lines.filter((l) => plan.get(l.on)?.kind !== 'keep' || !String(l.text || '').trim() || !String(l.who || '').trim()).map((l) => `${l.file}: ${l.on} "${l.text}"`);
  assert.deepEqual(bad, []);
});

test('every situation line says what is different (README rule 2)', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'into' && !String(e.diff || '').trim()).map(([id]) => id);
  assert.deepEqual(bad, [], `${bad.length} lines have no "what's different"`);
});

test('every "same" points at a board or a situation line', () => {
  const bad = [...plan].filter(([, e]) => e.kind === 'same' && !['into', 'keep'].includes(plan.get(e.id)?.kind)).map(([id, e]) => `${id} → ${e.id}`);
  assert.deepEqual(bad, []);
});

// The coverage walks (4 Oct, walk-4; docs/decisions/2026-10-04-coverage-walks.md):
// answers 2 and 5 drop four screens, and the answers and the walks' fixes are
// situation lines on the screens they name.
test('the coverage walks: dropped screens are later, and the new lines sit on their screens', () => {
  const notDropped = ['on-settings-start', 'on-settings-start-answered', 'ws-start-products-answered', 'cs-privacy-blocked'].filter((id) => plan.get(id)?.kind !== 'later' || !/^Dropped, not later: /.test(plan.get(id).reason));
  assert.deepEqual(notDropped, []);
  const want = [
    ['ac-inbox', 'Question from her account'], ['cs-privacy', 'Still in the way'],
    ['staff-app', 'Check out'], ['wb-off-preview', 'switch-over morning'], ['ws-page', 'Not connected'],
    ['bk-settings', 'Connect [payment provider] first'], ['set-workshop-services', 'Customers can book this online'],
    ['set-workshop-services', 'Take a deposit for this service'], ['job-overview', 'answered by phone'],
    ['dq-record-answer', 'Goes with'], ['set-msg-list', 'add your review page first'],
    ['cs-privacy', 'once WH-1042 is collected'], ['cs-privacy', 'Done [date]'], ['cs-privacy', 'build-plan question 9'],
  ];
  const missing = want.filter(([on, t]) => !lines.some((l) => l.on === on && l.text.includes(t))).map(([on, t]) => `${on}: ${t}`);
  assert.deepEqual(missing, []);
});
