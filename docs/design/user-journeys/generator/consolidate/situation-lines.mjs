// Each kept screen's situation list (README rule 2), as one module so the
// canvas (build.mjs, the note under each board) and the clickable mockup
// (mockup/build-mockup.mjs, the list under each drawing) show the same lines
// (third walk, answer 7: "the same lines as the canvas").
//   situationLines(id) → [line] (each starting "• "), or [] when it has none.
// The screens folded into a kept screen, from any journey, in journeys.mjs
// order: "what's different" is the folded drawing's own title and its diff;
// "who" its role; then the decision it came from. Then the lines a journey
// file adds with no old drawing behind them (consolidate/plan.mjs `lines`).
import { readFileSync } from 'node:fs';
import { journeys } from '../journeys.mjs';
import { loadPlan } from './plan.mjs';

const gen = new URL('../', import.meta.url).pathname;
export const LATER_TAG = 'after the trading week (build-plan question 5)';

function roleOf(designRole) {
  const who = designRole.split('·')[0].trim();
  if (who.startsWith('Service desk')) return 'Staff';
  if (who.startsWith('Mechanic')) return 'Mechanic';
  if (who.startsWith('Manager')) return 'Manager';
  if (who.startsWith('Customer')) return 'Customer';
  return who;
}

export async function situationLines() {
  const { plan, lines: extraLines } = await loadPlan();
  const designs = Object.fromEntries(JSON.parse(readFileSync(gen + 'shots/screens.json', 'utf8')).map((s) => [s.id, s]));
  const allScreens = journeys.flatMap((j) => j.rows.flatMap((r) => r.screens.map((x) => ({ ...x, journey: j }))));
  const byId = new Map(allScreens.map((x) => [x.id, x]));
  const ownerOf = (id) => { const e = plan.get(id); return e.kind === 'keep' ? id : e.kind === 'into' || e.kind === 'same' ? ownerOf(e.id) : null; };
  const situations = new Map();
  for (const x of allScreens) { const e = plan.get(x.id); if (e?.kind === 'into') { const own = ownerOf(x.id); if (!situations.has(own)) situations.set(own, []); situations.get(own).push({ x, decision: e.decision, diff: e.diff }); } }
  // Release 1 pictures (d()) carry no title or role in journeys.mjs; theirs are
  // in shots/screens.json.
  const titleOf = (x) => x.title ?? designs[x.id]?.title ?? x.id;
  const roleOfScreen = (x) => x.role ?? (designs[x.id] ? roleOf(designs[x.id].role) : '');
  // Lightspeed lines wait for after the trading week (Lightspeed shops, later
  // change of 3 Oct, walk-through 6 M4): tagged where they sit.
  const waits = (line, j21) => (j21 || /Lightspeed/.test(line) ? `${line} · ${LATER_TAG}` : line);
  return (id) => {
    const list = situations.get(id) ?? [];
    const extra = extraLines.filter((l) => l.on === id);
    const home = byId.get(id)?.journey.id;
    return [
      ...list.map(({ x, decision, diff }) => waits(`• ${titleOf(x)}${diff ? `: ${diff}` : ''} — ${roleOfScreen(x)}${x.journey.id !== home ? ` · from journey ${x.journey.num ?? Number(x.journey.id.slice(1))}` : ''}${decision ? ` · ${decision}` : ''}`, x.journey.id === 'j21')),
      ...extra.map((l) => waits(`• ${l.text} — ${l.who}${l.decision ? ` · ${l.decision}` : ''}`, l.file === 'j21.mjs')),
    ];
  };
}
