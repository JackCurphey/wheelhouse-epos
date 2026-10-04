// WP-W.5 coverage check: every journey × every persona who uses it, and which
// walk-through story covered it. Run from the repo root:
//   node docs/design/user-journeys/generator/coverage.mjs [--json]
// Sources: generator/journeys.mjs (screens, roles), generator/consolidate/j*.mjs
// (keep / into / same / later), generator/mockup/stories.mjs (each step's
// screen id and person), the build plan's AFTER-LS block (Lightspeed, after
// the trading week).
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(process.cwd());
const gen = join(repo, 'docs/design/user-journeys/generator');
const imp = (p) => import(pathToFileURL(join(gen, p)).href);
const { journeys } = await imp('journeys.mjs');
const { loadPlan, screens } = await imp('consolidate/plan.mjs');
const { stories } = await imp('mockup/stories.mjs');
const { plan } = await loadPlan();
// The second source of evidence: the coverage walks (coverage-walks.mjs).
// `--without <file>` leaves one out (to check it is what covers its cell);
// COVERAGE_WALKS_DIR points at another folder (to check a missing file fails).
const { coverageWalks, WALK_DIR } = await imp('coverage-walks.mjs');
const without = process.argv.includes('--without') ? process.argv[process.argv.indexOf('--without') + 1] : null;
const walkDir = process.env.COVERAGE_WALKS_DIR || join(repo, WALK_DIR);
const missingWalks = coverageWalks.filter((w) => !existsSync(join(walkDir, w.file))).map((w) => w.file);
if (missingWalks.length) { console.error(`coverage.mjs: listed coverage walk files are missing from ${walkDir}: ${missingWalks.join(', ')}`); process.exit(1); }

const all = new Map(screens().map((s) => [s.id, s]));

// Kept board a screen id is drawn on (follows into/same chains).
const board = (id) => {
  let cur = id;
  for (let i = 0; i < 20; i++) {
    const p = plan.get(cur);
    if (!p) return { id: cur, missing: true };
    if (p.kind === 'keep') return { id: cur };
    if (p.kind === 'later') return { id: cur, later: true };
    cur = p.id;
  }
  return { id: cur, loop: true };
};

// Lightspeed (journey 21 and its situations on other boards): after the
// trading week, not in Release 2's first build (build plan, AFTER-LS block).
const planMd = readFileSync(join(repo, 'docs/superpowers/plans/2026-10-03-release-2-build-plan.md'), 'utf8');
const lsBlock = planMd.slice(planMd.indexOf('<!-- screens AFTER-LS -->'), planMd.indexOf('<!-- /screens -->', planMd.indexOf('<!-- screens AFTER-LS -->')));
// Situation ids only: "Added to the `op-today` board" names an in-scope board, not a Lightspeed situation.
const afterLS = new Set([...lsBlock.matchAll(/(the )?`([a-z0-9-]+)`( board)?/g)].filter((m) => !(m[1] && m[3])).map((m) => m[2]));
if (process.env.SHOW_LS) console.error([...afterLS].join(" "));
const outJourneys = new Map([['j21', 'after the trading week (build-plan question 5: no Lightspeed test account yet, and Jack\'s shop does not need it to switch over)']]);

const P = ['Maya', 'Jo', 'Alex', 'Jack', 'Saturday'];
const whoToPersona = { Customer: 'Maya', Staff: 'Jo', Mechanic: 'Alex', Owner: 'Jack', 'Saturday worker': 'Saturday' };

// Which kept screens each persona uses, from each screen's role.
// Till only (walk-through 8 decision 8, and its walk-through 10 M1 later
// change): the till, plus Front desk › Online orders; "Close the day" is for
// owners and managers (cash-up decision 5), so eod-* is not the Saturday worker's.
const tillOnly = (s) => s.role === 'Staff' && (s.id.startsWith('till-') || s.id === 'pin-change' || (s.journey === 'j02') || s.id === 'cp-receipt-address');
// 'map' (role Everyone) is the drawing of how the app fits together, not a
// screen anyone opens. 'your-settings' (role Everyone) opens from a staff
// person's name, so "Everyone" means every staff person, not customers.
// The staff app frame ('staff-app') is used by Jo, Alex (Workshop room only)
// and the owner; a till-only worker never leaves the till.
const notAScreen = new Set(['map']);
const everyoneStaff = (s) => s.role === 'Everyone';
const uses = {
  Maya: (s) => s.role === 'Customer',
  Jo: (s) => s.role === 'Staff' || everyoneStaff(s),
  Alex: (s) => s.role === 'Mechanic' || everyoneStaff(s) || (s.role === 'Staff' && (s.journey === 'j12' || ['till-checkin', 'staff-app'].includes(s.id))),
  Jack: (s) => ['Owner', 'Manager', 'Owner and Manager'].includes(s.role) || everyoneStaff(s) || s.id === 'staff-app',
  Saturday: (s) => everyoneStaff(s) || tillOnly(s),
};

const kept = [...all.values()].filter((s) => plan.get(s.id)?.kind === 'keep' && !notAScreen.has(s.id));
const cells = {}; // journey → persona → { uses:Set(screen), strict:Set(story), lines:Set(story), lsOnly:Set(story) }
for (const j of journeys) {
  cells[j.id] = {};
  for (const p of P) cells[j.id][p] = { uses: new Set(), strict: new Set(), lines: new Set(), ls: new Set(), walks: [], byEvidence: false };
}
for (const s of kept) for (const p of P) if (uses[p](s)) cells[s.journey][p].uses.add(s.id);

const problems = [];
for (const st of stories) {
  for (const step of st.steps) {
    const p = whoToPersona[step.who];
    if (!p) { problems.push(`story ${st.n}: unknown who ${step.who}`); continue; }
    const b = board(step.id);
    if (b.missing || b.loop || b.later) { problems.push(`story ${st.n}: ${step.id} → ${JSON.stringify(b)}`); continue; }
    const kj = all.get(b.id).journey;
    const ownJ = all.get(step.id)?.journey;
    if (afterLS.has(step.id)) { cells[kj][p].ls.add(st.n); continue; }
    const c = cells[kj][p];
    c.strict.add(st.n);
    if (!c.uses.has(b.id)) { c.uses.add(b.id); c.byEvidence = true; }
    if (ownJ && ownJ !== kj) cells[ownJ][p].lines.add(st.n);
  }
}

for (const w of coverageWalks) {
  if (w.file === without) continue;
  const c = cells[w.journey]?.[w.person];
  if (!c) { problems.push(`coverage walk ${w.file}: no cell ${w.journey} × ${w.person}`); continue; }
  if (!c.uses.size) problems.push(`coverage walk ${w.file}: ${w.person} doesn't use ${w.journey}`);
  c.walks.push(w.file);
}

const name = (j) => (j.num ? j.num : String(Number(j.id.slice(1))));
const out = [];
for (const j of journeys) {
  const row = { id: j.id, num: name(j), name: j.name, out: outJourneys.get(j.id) || null, cells: {} };
  for (const p of P) {
    const c = cells[j.id][p];
    const used = c.uses.size > 0;
    row.cells[p] = {
      uses: used,
      screens: [...c.uses],
      stories: [...c.strict].sort((a, b) => a - b),
      linesOnly: [...c.lines].filter((n) => !c.strict.has(n)).sort((a, b) => a - b),
      lightspeedOnly: [...c.ls].sort((a, b) => a - b),
      walks: c.walks,
      byEvidence: c.byEvidence,
    };
  }
  out.push(row);
}

if (process.argv.includes('--json')) { console.log(JSON.stringify({ out, problems }, null, 1)); process.exit(0); }
const head = ['Journey', 'Maya (customer)', 'Jo (front desk)', 'Alex (mechanic)', 'Jack Lewis (owner)', 'Saturday worker'];
console.log('| ' + head.join(' | ') + ' |');
console.log('|' + head.map(() => '---').join('|') + '|');
let empty = 0;
for (const r of out) {
  const cellText = (c) => {
    if (!c.uses) return '—';
    if (r.out) return c.stories.length ? c.stories.join(', ') + ' (later)' : 'later';
    if (!c.stories.length && c.walks.length) return 'walk 4';
    if (!c.stories.length) { empty++; return '**EMPTY**'; }
    return c.stories.join(', ');
  };
  console.log(`| ${r.num} ${r.name} | ${P.map((p) => cellText(r.cells[p])).join(' | ')} |`);
}
console.log(`\nEmpty cells: ${empty}`);
for (const r of out) for (const p of P) {
  const c = r.cells[p];
  if (c.uses && !r.out && !c.stories.length && !c.walks.length) console.log(`EMPTY ${r.num} ${r.name} × ${p}: screens ${c.screens.join(', ')}; situation lines only in stories [${c.linesOnly}]; Lightspeed-only steps [${c.lightspeedOnly}]`);
  if (c.uses && !r.out && c.stories.length && c.linesOnly.length) console.log(`also lines ${r.num} × ${p}: [${c.linesOnly}]`);
  if (c.byEvidence) console.log(`note ${r.num} × ${p}: a story step adds a screen the role rule did not give this person`);
}
if (problems.length) console.log('\nProblems:\n' + problems.join('\n'));
