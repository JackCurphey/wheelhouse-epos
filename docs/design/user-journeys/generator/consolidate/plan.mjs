// The one-canvas plan (issue #116 step 3): what happens to every screen id in
// journeys.mjs. Each journey has a file here (j11.mjs and so on) whose
// default export maps screen id → one of:
//   keep(block, { sizes })  stays a board; block is a number from the README's
//                           "Building blocks" list; sizes defaults to desktop
//                           (customer pages: phone) — rule 3
//   into(id, decision)      a line in that kept screen's situation list (rule 1)
//   later(reason)           deferred (3 Oct answers or the build plan): listed
//                           on its journey, not drawn
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeys } from '../journeys.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const keep = (block, { sizes } = {}) => ({ kind: 'keep', block, sizes });
export const into = (id, decision = '') => ({ kind: 'into', id, decision });
export const later = (reason) => ({ kind: 'later', reason });

// The numbered list under "### Building blocks" in ../../README.md.
export const blocks = () => {
  const md = readFileSync(join(here, '..', '..', 'README.md'), 'utf8');
  const start = md.indexOf('### Building blocks');
  if (start < 0) return new Map();
  const section = md.slice(start, md.indexOf('\n## ', start));
  return new Map([...section.matchAll(/^(\d+)\. (.+)$/gm)].map((m) => [Number(m[1]), m[2]]));
};

// Every screen in journeys.mjs, with its journey id.
export const screens = () => journeys.flatMap((j) => j.rows.flatMap((r) => r.screens.map((s) => ({ ...s, journey: j.id, row: r.label }))));

// The plan files, merged: { id → entry with its journey file }.
export const loadPlan = async () => {
  const plan = new Map();
  const dupes = [];
  for (const f of readdirSync(here).filter((f) => /^j[0-9a-z]+\.mjs$/.test(f)).sort()) {
    const { default: part } = await import(join(here, f));
    for (const [id, entry] of Object.entries(part)) {
      if (plan.has(id)) dupes.push(id);
      plan.set(id, { ...entry, file: f });
    }
  }
  return { plan, dupes };
};
