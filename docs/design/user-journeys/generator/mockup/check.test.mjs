// Run: node --test docs/design/user-journeys/generator/mockup/
// Needs the Soft sand builds (node build.mjs in the generator).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDrawings } from './drawings.mjs';
import { controlsOf, resolve, loadLinks } from './controls.mjs';

const { drawings } = await loadDrawings();
const maps = await loadLinks();
const fileToId = (f) => { const id = f.replace(/\.dc\.html$/, '').replace(/-(desktop|tablet|phone)$/, ''); return drawings.has(id) ? id : null; };
const shown = [...drawings.values()].filter((d) => d.kind !== 'later' && Object.keys(d.sizes).length);

test('every button and link in the mockup goes somewhere', () => {
  const dead = new Map();
  for (const d of shown) for (const [size, s] of Object.entries(d.sizes)) for (const c of controlsOf(s.html)) if (!resolve(c, d, maps, fileToId)) { const k = `${d.id} · ${c.label || '(no label)'}`; dead.set(k, (dead.get(k) || 0) + 1); }
  assert.equal(dead.size, 0, `${dead.size} dead controls, e.g.\n${[...dead.keys()].slice(0, 40).join('\n')}`);
});

test('every target is a screen the mockup can show', () => {
  const bad = new Set();
  for (const d of shown) for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) { const t = resolve(c, d, maps, fileToId); if (t?.go && !(drawings.get(t.go) && Object.keys(drawings.get(t.go).sizes).length)) bad.add(`${d.id} · ${c.label} → ${t.go}`); }
  assert.deepEqual([...bad].slice(0, 40), []);
});

// Step 6: every walk-through story can be clicked start to finish. A step's
// `does` in brackets is a hand-over (the next person picks up), not a click.
test('every story clicks from each step to the next', async () => {
  const { stories } = await import('./stories.mjs');
  const broken = [];
  for (const st of stories) st.steps.forEach((step, i) => {
    const next = st.steps[i + 1];
    if (!next || /^\(.*\)$/.test(String(step.does ?? '').trim())) return;
    const d = drawings.get(step.id);
    // The button the step names (its exact label) must itself lead on; a
    // sidebar link to the same place doesn't count.
    const ok = d && Object.values(d.sizes).some((s) => controlsOf(s.html).some((c) => c.label === String(step.does).trim() && resolve(c, d, maps, fileToId)?.go === next.id));
    if (!ok) broken.push(`story ${st.n}, step ${i + 1}: ${step.id} → ${next.id} (${step.does ?? ''})`);
  });
  assert.deepEqual(broken, []);
});

// Step 6: … "as each persona, at each size". The mockup shows a step at the
// chosen size, or desktop (then any size) where it isn't drawn at that size;
// at every size the step's named button must lead on.
test('every story clicks through at desktop, tablet and phone', async () => {
  const { stories } = await import('./stories.mjs');
  const broken = [];
  for (const size of ['desktop', 'tablet', 'phone']) for (const st of stories) st.steps.forEach((step, i) => {
    const next = st.steps[i + 1];
    if (!next || /^\(.*\)$/.test(String(step.does ?? '').trim())) return;
    // A size whose drawing genuinely lacks the button (`missingAt`, with
    // `missingWhy`) is a real gap in the drawings, not a click to fake.
    if (step.missingAt?.includes(size)) return;
    const d = drawings.get(step.id);
    const at =(dd) => dd?.sizes[size] ?? dd?.sizes.desktop ?? dd?.sizes.single ?? Object.values(dd?.sizes ?? {})[0];
    const s = at(d);
    // A step may name its button for one size (`doesAt: { phone: '…' }`) where the label differs.
    const label = String(step.doesAt?.[size] ?? step.does).trim();
    const leads = (dd, ss) => ss && controlsOf(ss.html).some((c) => c.label === label && resolve(c, dd, maps, fileToId)?.go === next.id);
    // On a phone or tablet the sidebar sits behind a menu: one tap to open it,
    // then the named item (a menu situation's drawing, id ending "-menu").
    const viaMenu = s && controlsOf(s.html).some((c) => { const t = resolve(c, d, maps, fileToId)?.go; return t && /-menu$/.test(t) && leads(drawings.get(t), at(drawings.get(t))); });
    const ok = leads(d, s) || viaMenu;
    if (!ok) broken.push(`${size}: story ${st.n}, step ${i + 1}: ${step.id} → ${next.id} (${step.does ?? ''})`);
  });
  assert.deepEqual(broken, []);
});

// Third walk, answer 7: under each drawing the mockup lists that screen's
// situation lines, the same lines as the canvas. Needs `node build.mjs` and
// `node mockup/build-mockup.mjs` run after the last change.
test('the mockup lists each screen’s situation lines, the same as the canvas', async () => {
  const { readFileSync } = await import('node:fs');
  const canvas = JSON.parse(readFileSync(new URL('../out/project/canvas.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../out-mockup/manifest.json', import.meta.url), 'utf8'));
  const onCanvas = {};
  for (const [key, n] of Object.entries(canvas.notes)) {
    const m = /^[a-z0-9]+_sit_(.+?)(?:_(\d+))?$/.exec(key);
    if (!m) continue;
    (onCanvas[m[1]] ??= []).push(...n.text.split('\n').filter((l) => l.startsWith('• ')));
  }
  const lines = manifest.lines ?? {};
  assert.ok(Object.keys(onCanvas).length > 100, `${Object.keys(onCanvas).length} situation notes on the canvas`);
  const bad = [];
  // A screen the mockup has no drawing of (a Release 1 picture) has no page to list them under.
  for (const [id, want] of Object.entries(onCanvas)) if (manifest.screens[id] && JSON.stringify(lines[id] ?? []) !== JSON.stringify(want)) bad.push(id);
  for (const id of Object.keys(lines)) if (!onCanvas[id]) bad.push(`${id} (not on the canvas)`);
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} screens whose lines differ`);
});

// Walk-through 10 L1 (Opening the shop 2): the float check is for the first
// person in today only. A PIN on till-checkin opens the till; only a story's
// first check-in of the day (its step marked `firstIn`) opens the float check.
test('a PIN on till-checkin opens the till, except at a story’s first check-in', async () => {
  const { stories } = await import('./stories.mjs');
  const d = drawings.get('till-checkin');
  const digits = Object.values(d.sizes).flatMap((s) => controlsOf(s.html)).filter((c) => /^[0-9]$/.test(c.label));
  assert.ok(digits.length >= 10, `${digits.length} PIN digits drawn`);
  const bad = digits.map((c) => resolve(c, d, maps, fileToId)).filter((t) => t?.go !== 'till-empty' || t?.first !== 'op-float-check');
  assert.deepEqual(bad, [], 'every digit opens till-empty, and op-float-check at a first check-in');
  const wrong = [];
  for (const st of stories) st.steps.forEach((step, i) => {
    const next = st.steps[i + 1];
    if (step.id !== 'till-checkin' || !next) return;
    const toFloat = (drawings.get(next.id)?.owner ?? next.id) === 'op-float-check';
    if (toFloat !== Boolean(step.firstIn)) wrong.push(`story ${st.n}, step ${i + 1}: ${toFloat ? 'opens the float check but is not marked firstIn' : 'marked firstIn but its next step is not the float check'}`);
  });
  assert.deepEqual(wrong, []);
});

// Story mode's step counter follows the steps in order: a click to a screen
// that is only a later step (story 8: the Saturday PIN opens the till, which
// is the story's last step) doesn't jump the counter there.
test('story mode’s step counter moves only to the current or the next step', async () => {
  const { readFileSync } = await import('node:fs');
  const { stories } = await import('./stories.mjs');
  const src = /^const stepIndex = .*;$/m.exec(readFileSync(new URL('./page.html', import.meta.url), 'utf8'))?.[0];
  assert.ok(src, 'page.html defines stepIndex on one line');
  const stepIndex = new Function(`${src}; return stepIndex;`)();
  const s8 = stories.find((s) => s.n === 8).steps;
  const at = s8.findIndex((s) => s.id === 'till-checkin');
  assert.equal(stepIndex(s8, at, 'till-empty'), at, 'off the path: the counter stays');
  assert.equal(stepIndex(s8, at, 'till-search-paid'), at + 1);
  const bad = [];
  for (const st of stories) st.steps.forEach((step, i) => { if (stepIndex(st.steps, i - 1, step.id) !== i) bad.push(`story ${st.n}, step ${i + 1}`); });
  assert.deepEqual(bad, []);
});

// The coverage walks (4 Oct, docs/design/user-journeys/walk-4/): screens a walk
// needed that no click reached, and the links its fixes name.
const targetOf = (t) => t?.go ?? t?.act;
test('the screens the coverage walks needed can be reached by a click or a story step', async () => {
  const { stories } = await import('./stories.mjs');
  const reached = new Set(stories.flatMap((st) => st.steps.filter((s, i) => i === 0 || /^\(.*\)$/.test(String(st.steps[i - 1].does ?? '').trim())).map((s) => s.id)));
  for (const d of shown) for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) { const t = resolve(c, d, maps, fileToId); if (t?.go && t.go !== d.id) reached.add(t.go); }
  const need = ['site-ocean-menu', 'rp-your-settings', 'wb-off-preview', 'wb-off-preview-ask', 'bk-settings', 'ac-review-first', 'on-settings-show', 'on-orders-arrived', 'dq-today-no-answer', 'ac-inbox-list', 'ws-pay-none'];
  assert.deepEqual(need.filter((id) => !reached.has(id)), []);
});

test('no button leads to a dropped or later screen', () => {
  const bad = new Set();
  for (const d of shown) for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) { const t = resolve(c, d, maps, fileToId); if (t?.go && drawings.get(t.go)?.kind === 'later') bad.add(`${d.id} · ${c.label} → ${t.go}`); }
  assert.deepEqual([...bad], []);
});

test('a Close button never stays on the page', () => {
  const bad = new Set();
  for (const d of shown) for (const s of Object.values(d.sizes)) for (const c of controlsOf(s.html)) if (/^close(?: menu| search|,.*)?$/i.test(c.label) && resolve(c, d, maps, fileToId)?.act === 'stay') bad.add(`${d.id} · ${c.label}`);
  assert.deepEqual([...bad], []);
});

// [screen, label, where it goes (a screen id, back or stay), words its note must have]
const COVERAGE_LINKS = [
  ['site-ocean', 'Open menu', 'site-ocean-menu'],
  ['site-menu', 'Close menu', 'back'], ['site-ocean-menu', 'Close menu', 'back'],
  ['diary-mechanic', 'Your settings — Alex Morgan, Mechanic', 'your-settings', 'Alex Morgan’s'],
  ['job-checklist', 'Your settings — Alex Morgan, Mechanic', 'your-settings', 'Alex Morgan’s'],
  ['your-settings', 'Close', 'back'], ['rp-your-settings', 'Close', 'back'],
  ['diary-mechanic', 'Diary', 'diary-mechanic'], ['job-mechanic', 'Diary', 'diary-mechanic'], ['staff-app-mechanic', 'Diary', 'diary-mechanic'],
  ['diary-mechanic', 'Today', 'stay'],
  ['op-today', 'Your settings — Jack Lewis, Owner', 'rp-your-settings'],
  ['ws-page', '[shop-name].wheelhouseepos.com', 'wb-off-preview'],
  ['ws-page-moving', '[shop-name].wheelhouseepos.com', 'wb-off-preview'],
  ['ws-page-on', '[shop-name].wheelhouseepos.com', 'wb-home'],
  ['wb-off-preview-ask', 'Back to Wheelhouse', 'op-today-staff'],
  ['ws-no-access', 'Back to Today', 'op-today-staff'],
  ['wb-off-preview', 'Open menu', 'site-menu'], ['wb-off-preview-ask', 'Open menu', 'site-menu'], ['wb-off-preview-product', 'Open menu', 'site-menu'],
  ['ws-page-moving', 'Open Online orders settings', 'ws-pay-none'],
  ['ws-page-moving', 'Taking payments Connected to [payment provider] · test payment done · in Settings › Front desk › Online orders', 'ws-pay-none'],
  ['ws-pay-connected', 'Make a test payment', 'ws-pay-tested', 'moving'],
  ['on-settings', 'Showing products Set on each category and product', 'on-settings-show'],
  ['on-settings-show', 'Change what your website started with', 'ws-start-products'],
  ['on-orders-arrived', 'Mark ready', 'on-orders-ready', 'Maya'],
  ['set-workshop-services', 'Online booking Exact times · 2 hours’ notice · deposit [n]% · each booking a request', 'bk-settings'],
  ['bk-settings', 'Services Full service, Individual service', 'set-workshop-services'],
  ['bk-settings', 'Mechanics Alex Morgan, Jo Taylor, Shared queue', 'set-workshop-mechanics'],
  ['dq-diary-waiting', 'Trek Domane AL 3, Standard service, Maya Patel, WH-1042, Quoting, 11:30–13:00 · approved £111', 'dq-job-sent'],
  ['dq-record-answer', 'Save: yes to 2 lines, no thanks to 1', 'dq-job-answered', 'by phone'],
  ['cp-receipt-address', 'Send receipt', 'cp-receipt-email-till', '£74.00'],
  ['cp-receipt-address-save', 'Add the customer', 'till-empty'], ['cp-receipt-address-save', 'Not now', 'till-empty'],
  ['cp-receipt-address-offline', 'Send when back online', 'till-empty'],
  ['staff-app-menu', 'Messages', 'ac-inbox-list'],
  ['ac-inbox', 'Needs a reply: Maya Patel · Question from her account', 'ac-inbox', 'question from her account'],
  ['set-msg-list', 'Edit the wording of Review request', 'ac-review-first'],
  ['set-msg-list', 'Edit the wording of Service reminder', 'ac-reminder-wording'],
  ['set-msg-list', 'Edit the wording of Bike still waiting', 'cp-message-wording'],
  ['ac-messages', 'Edit the wording of Review request', 'ac-review-first'],
  ['on-messages', 'Edit the wording of Review request', 'ac-review-first'],
  ['dq-messages', 'Edit the wording of Review request', 'ac-review-first'],
  ['ac-review-first', 'Save', 'set-msg-list', 'Review request is now On'],
  ['ac-delete-blocked', 'Ask to delete', 'ac-delete-sent'],
  ['cs-privacy', 'Delete their details', 'cs-privacy-delete', 'Maya'],
  ['cs-privacy-delete', 'Delete their details', 'cs-privacy', 'Done [date]'],
];
test('the coverage walks’ links lead where their fixes say', () => {
  const bad = [];
  for (const [id, label, want, note] of COVERAGE_LINKS) {
    const d = drawings.get(id);
    const ts = d ? Object.values(d.sizes).flatMap((s) => controlsOf(s.html)).filter((c) => c.label === label).map((c) => resolve(c, d, maps, fileToId)) : [];
    if (!ts.length) { bad.push(`${id} · ${label}: no such button`); continue; }
    for (const t of ts) if (targetOf(t) !== want || (note && !String(t.say ?? '').toLowerCase().includes(note.toLowerCase()))) bad.push(`${id} · ${label} → ${targetOf(t)}${t?.say ? ` (“${t.say}”)` : ''}, want ${want}${note ? ` with “${note}”` : ''}`);
  }
  // The diary's Today button stays; the sidebar's Today link still opens Today (walk-through 1 L2).
  const diary = drawings.get('diary');
  for (const c of Object.values(diary.sizes).flatMap((sz) => controlsOf(sz.html)).filter((c) => c.label === 'Today')) {
    const t = targetOf(resolve(c, diary, maps, fileToId));
    if (t !== (c.tag === 'button' ? 'stay' : 'op-today-staff')) bad.push(`diary · Today (${c.tag}) → ${t}`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

// The coverage walks' wording in the drawings (answers 1 and 4; walks 5 M2,
// 7 M2, 10 M1, 11 L2, 12 L1).
test('the coverage walks’ wording is in the drawings', () => {
  const text = (id, size) => { const d = drawings.get(id); const ss = size ? [d?.sizes[size]] : Object.values(d?.sizes ?? {}); return ss.filter(Boolean).map((s) => s.html.replace(/&rsquo;|&#39;/g, '’').replace(/&amp;/g, '&')); };
  const has = (id, re, size) => { const t = text(id, size); return t.length > 0 && t.every((h) => re.test(h)); };
  const lacks = (id, re, size) => { const t = text(id, size); return t.length > 0 && t.every((h) => !re.test(h)); };
  const menuWord = /aria-label="Open menu"[^>]*>(?:(?!<\/button>)[\s\S])*>Menu<(?:(?!<\/button>)[\s\S])*<\/button>/;
  const checks = {
    'answer 1: site, phone, "Menu" on the button': has('site', menuWord, 'phone'),
    'answer 1: wb-home, phone, "Menu" on the button': has('wb-home', menuWord, 'phone'),
    'answer 1: the staff app’s menu has no word': lacks('staff-app-menu', />Menu</),
    'answer 4: ac-delete-blocked says it waits': has('ac-delete-blocked', /We’ll delete your account once your bike has been collected/),
    'answer 4: ac-delete-blocked keeps Ask to delete': has('ac-delete-blocked', />Ask to delete</),
    'answer 4: ac-delete-blocked has no "Ask again"': lacks('ac-delete-blocked', /Ask again after that/),
    'walk 10 M1: the question row names Maya': has('ac-inbox', /Question from her account/, 'desktop'),
    'walk 5 M2: payments not counted on ws-page-moving': lacks('ws-page-moving', /Payments connected, and the test payment worked/),
    'walk 5 M2: ws-pay-tested-moving drops "counts towards"': lacks('ws-pay-tested-moving', /counts towards/),
    'walk 7 M2: ws-pay-none names deposits': has('ws-pay-none', /deposits/),
    'walk 11 L2: the review switch is named': has('set-msg-list', /aria-label="Review request: Off"/),
    'walk 11 L2: the bike ready switch is named': has('set-msg-list', /aria-label="Bike ready: On"/),
    'walk 12 L1: Today names Maya': has('ac-today', /Maya Patel asked us to delete her account/),
    'walk 12 L1: the confirm names Maya': has('cs-privacy-delete', /Delete Maya Patel’s details\?/),
  };
  assert.deepEqual(Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k), []);
});

// Issue #123 (Codex review, point 11): the checks above pass over empty lists
// when the drawings aren't built, so say so instead.
test('the drawings are built, so the checks above have something to check', () => {
  assert.ok(shown.length > 700, `${shown.length} drawings loaded — run node build.mjs in the generator first`);
});

// Issue #123, point 11: the published manifest itself — every story step,
// situation and view points at a screen, and every size at a data file.
test('the built manifest points only at screens and data files that exist', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const out = new URL('../out-mockup/', import.meta.url);
  const m = JSON.parse(readFileSync(new URL('manifest.json', out), 'utf8'));
  const bad = [];
  const has = (id, why) => { if (!m.screens[id]) bad.push(`${why}: ${id}`); };
  for (const [id, s] of Object.entries(m.screens)) {
    if (s.owner) has(s.owner, `${id}'s owner`);
    for (const [size, z] of Object.entries(s.sizes)) if (!existsSync(new URL(`data/${z.file}.json`, out))) bad.push(`${id} at ${size}: data/${z.file}.json`);
    if (!Object.keys(s.sizes).length) bad.push(`${id}: no sizes`);
  }
  for (const [o, ids] of Object.entries(m.situations)) { has(o, 'situation owner'); for (const id of ids) has(id, `situation of ${o}`); }
  for (const st of m.stories) for (const step of st.steps) has(step.id, `story ${st.n}`);
  for (const [o, vs] of Object.entries(m.views ?? {})) for (const v of vs) if (!m.situations[o]?.includes(v.id)) bad.push(`view ${v.id} is not a situation of ${o}`);
  assert.ok(m.views && Object.keys(m.views).length, 'the manifest lists each screen’s views for a person or shop');
  assert.deepEqual(bad.slice(0, 40), []);
});

// Issue #123, point 12: the page loads the drawings' own font (Public Sans in
// Soft sand), not the Fjell build's Work Sans.
test('the mockup page loads the font the drawings use', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../out-mockup/index.html', import.meta.url), 'utf8');
  const m = JSON.parse(readFileSync(new URL('../out-mockup/manifest.json', import.meta.url), 'utf8'));
  const link = /<link rel="stylesheet" href="([^"]+)"/.exec(page)?.[1] ?? '';
  const faces = [...new Set([...m.css.matchAll(/font-family:\s*'([^']+)'/g)].map((x) => x[1]))].filter((f) => !/mono/i.test(f));
  assert.ok(faces.length, 'the drawings name a font');
  for (const f of faces) assert.ok(link.includes(f.replace(/ /g, '+')), `the page's font link loads ${f}: ${link}`);
});
