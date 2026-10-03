// The buttons and links in a drawing, and where each one goes in the mockup
// (docs/superpowers/specs/2026-10-03-clickable-mockup.md, "Link rules").
import { readdirSync } from 'node:fs';

// `note`: a short line the mockup shows over the page it opens (third walk:
// "Now working: Alex Morgan", "showing Till B2's report").
// `shop`: the shop the page opens at (a shop's link in the Reports strip).
export const go = (id, note, shop) => ({ go: id, ...(note ? { say: note } : {}), ...(shop ? { shop } : {}) });
export const BACK = { act: 'back' };
export const STAY = { act: 'stay' };
export const outside = (what) => ({ act: 'outside', what });
// A page the drawings don't have yet: the mockup says so, and the gap is listed.
export const notDrawn = (what) => ({ act: 'notdrawn', what });

const CTRL = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g;
const attr = (attrs, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
export const labelOf = (attrs, inner) => (attr(attrs, 'aria-label') ?? inner.replace(/<[^>]+>/g, ' ')).replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();

// Every control in a drawing's HTML, in order.
export function controlsOf(html) {
  const out = [];
  for (const m of html.matchAll(CTRL)) out.push({ tag: m[1], attrs: m[2], label: labelOf(m[2], m[3]), href: attr(m[2], 'href'), index: m.index, length: m[0].length, openEnd: m.index + 1 + m[1].length + m[2].length + 1 });
  return out;
}

// A choice that switches something on the page itself (a radio, tab, switch,
// tick box or option) stays on the page, before any shared label (third walk,
// walk-through 11 M1: the "Today" period opened the Today page).
const IN_PAGE = /\brole="(switch|radio|checkbox|tab|menuitemradio|option)"/;
// The customer page's history filter "Messages" is a pressed-or-not button
// that filters the history, not the sidebar's Messages (walk-through 9 L2).
const FILTER = (c) => c.tag === 'button' && /\baria-pressed="/.test(c.attrs) && c.label === 'Messages';
const NAV_KINDS = /\brole="(switch|radio|checkbox|tab|menuitemradio|option)"|\baria-pressed="|\baria-expanded="|\baria-checked="/;
const CLOSE = /^(close|cancel|not now|back|✕|×|close this|done|keep editing)$/i;

// A journey's map may also have a '*' entry: labels that go to the same place
// on every board of that journey.
// Load the link maps once.
const here = new URL('./links/', import.meta.url).pathname;
export async function loadLinks() {
  const maps = {};
  for (const f of readdirSync(here).filter((f) => f.endsWith('.mjs'))) {
    const { default: m } = await import(here + f);
    maps[f.replace(/\.mjs$/, '')] = m;
  }
  return maps;
}

// Where a control goes. `id` is the drawing it sits on; `owner` its kept
// screen; `fileToId` maps a generator board file name to a screen id.
export function resolve(control, { id, owner, journey }, maps, fileToId) {
  const per = maps[journey] ?? {};
  const own = per[id]?.[control.label] ?? (owner && per[owner]?.[control.label]) ?? findAcross(maps, id, owner, control.label);
  if (own) return own;
  if (IN_PAGE.test(control.attrs) || FILTER(control)) return STAY;
  if (per['*']?.[control.label]) return per['*'][control.label];
  // Shared label patterns (links/shared.mjs '~'): the diary's job blocks.
  const pat = (maps.shared?.['~'] ?? []).find(([re]) => re.test(control.label));
  if (pat) return pat[1];
  if (control.href && control.href !== '#' && fileToId(control.href)) return go(fileToId(control.href));
  // A jump to a part of the same page (Settings' "Jump to" pills: href="#set-till").
  if (control.href && /^#./.test(control.href)) return STAY;
  // A shared target can depend on whose screen it is (a function of the drawing).
  const shared = maps.shared?.[control.label];
  if (shared) return typeof shared === 'function' ? shared({ id, owner, journey, role: arguments[1].role ?? '' }) : shared;
  if (NAV_KINDS.test(control.attrs)) return STAY;
  if (CLOSE.test(control.label)) return BACK;
  return null;
}
// A screen's map may sit in another journey's file (a folded screen from
// another journey keeps its own journey's file).
function findAcross(maps, id, owner, label) {
  for (const [k, m] of Object.entries(maps)) if (k !== 'shared') { const t = m[id]?.[label] ?? (owner && m[owner]?.[label]); if (t) return t; }
  return null;
}
