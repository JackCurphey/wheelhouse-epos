// Builds the canvas files (project/canvas.json + one .dc.html per screen) from journeys.mjs.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { journeys } from './journeys.mjs';
import * as stage1 from './stage1.mjs';
// stage2.mjs (the first Workshop day drawings) is superseded by the approved
// redesign (decision 69); journey 12 now comes from the Soft sand build below.
const DRAWN = { ...stage1.screens };
import { FONT_LINK } from './ui.mjs';
import { TOUCH_TITLE_OVERRIDE } from './diary-titles.mjs';
import { workflow, WF_W, WF_H } from './workflow.mjs';
import { loadPlan, blocks } from './consolidate/plan.mjs';
import { situationLines } from './consolidate/situation-lines.mjs';

const here = new URL('./', import.meta.url).pathname;
// One canvas for the whole product (issue #116 step 3, Jack, 3 Oct: "start
// step 3"). It used to be three, each near the 512-file limit; now each real
// screen is one board and its other situations are listed under it
// (consolidate/, README "Rules for drawings from now on"). It keeps the shop
// floor link, the one Jack has shared; the back-office and customers canvases
// carry a "Moved" note.
const PARTS = [
  { key: 'all', root: here + 'out/', live: 'live-canvas.json', url: 'https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j', title: 'Wheelhouse user journeys', short: 'Every journey', ids: journeys.map((j) => j.id) },
];

// Journeys drawn in Soft sand on their own canvases (decisions 48 and 69 of
// Workshop day; decision 15 of journey A). ui.mjs picks its theme when it
// loads, and this process is Fjell, so each Soft sand canvas is built in its
// own process and its boards read back from its project/ folder.
// Journey 12 = diary.mjs; journey A = app-map.mjs; journey B = signin.mjs; journey 11 = till.mjs; journey 16 = cashup.mjs; journey 8 = setup.mjs; journey 15 = customer.mjs; journey 10 = opening.mjs; journey 9 = moving.mjs; journey 5 = collect.mjs; journey 13 = receiving.mjs; journey 14 = stock.mjs; journey 3 = book.mjs; journey 4 = quote.mjs; journey 7 = account.mjs; journey 19 = sites.mjs; journey 17 = reports.mjs; journey 2 = online.mjs; journey 1 = browse.mjs; journey 18 = website.mjs; journey 20 = oversight.mjs; journey 6 = c2w.mjs; journey 21 = lightspeed.mjs.
const SAND_SOURCES = {
  diary: { script: 'build-diary.mjs', dir: here + 'out-diary-sand/project/' },
  'app-map': { script: 'build-app-map.mjs', dir: here + 'out-app-map-sand/project/' },
  signin: { script: 'build-signin.mjs', dir: here + 'out-signin-sand/project/' },
  till: { script: 'build-till.mjs', dir: here + 'out-till-sand/project/' },
  cashup: { script: 'build-cashup.mjs', dir: here + 'out-cashup-sand/project/' },
  // explore: exploration boards kept on the journey's own canvas only (the
  // three layout options Jack chose between, journey 8 decision 3).
  setup: { script: 'build-setup.mjs', dir: here + 'out-setup-sand/project/', explore: ['so-list', 'so-onepage', 'so-hub', 'so-hub-area'], exploreRow: 'Options' },
  customer: { script: 'build-customer.mjs', dir: here + 'out-customer-sand/project/', explore: ['cs-opt-folds', 'cs-opt-timeline'], exploreRow: 'Options' },
  opening: { script: 'build-opening.mjs', dir: here + 'out-opening-sand/project/' },
  moving: { script: 'build-moving.mjs', dir: here + 'out-moving-sand/project/' },
  collect: { script: 'build-collect.mjs', dir: here + 'out-collect-sand/project/' },
  receiving: { script: 'build-receiving.mjs', dir: here + 'out-receiving-sand/project/' },
  stock: { script: 'build-stock.mjs', dir: here + 'out-stock-sand/project/' },
  book: { script: 'build-book.mjs', dir: here + 'out-book-sand/project/' },
  quote: { script: 'build-quote.mjs', dir: here + 'out-quote-sand/project/' },
  account: { script: 'build-account.mjs', dir: here + 'out-account-sand/project/' },
  sites: { script: 'build-sites.mjs', dir: here + 'out-sites-sand/project/' },
  reports: { script: 'build-reports.mjs', dir: here + 'out-reports-sand/project/' },
  online: { script: 'build-online.mjs', dir: here + 'out-online-sand/project/' },
  browse: { script: 'build-browse.mjs', dir: here + 'out-browse-sand/project/' },
  website: { script: 'build-website.mjs', dir: here + 'out-website-sand/project/' },
  oversight: { script: 'build-oversight.mjs', dir: here + 'out-oversight-sand/project/' },
  c2w: { script: 'build-c2w.mjs', dir: here + 'out-c2w-sand/project/' },
  lightspeed: { script: 'build-lightspeed.mjs', dir: here + 'out-lightspeed-sand/project/' },
};
for (const s of Object.values(SAND_SOURCES)) execFileSync(process.execPath, [s.script, '--theme', 'sand'], { cwd: here, stdio: ['ignore', 'ignore', 'inherit'] });
const SAND_SIZES = ['single', 'desktop', 'tablet', 'phone'];
// Each journey's own canvas, where all three sizes live.
const SAND_CANVAS = {
  diary: 'https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U',
  'app-map': 'https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA',
  signin: 'https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe',
  till: 'https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG',
  cashup: 'https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE',
  setup: 'https://claude.ai/artifact/EN9dy5TkNzuwJcUCSpLW1B',
  customer: 'https://claude.ai/artifact/LbStDU6XExLrd7FNd2zEox',
  opening: 'https://claude.ai/artifact/E9XTaKJys2WH3gpgwfPJbq',
  moving: 'https://claude.ai/artifact/Wkp23VuCPRydTjfYmJgKo9',
  collect: 'https://claude.ai/artifact/LdnE9ayZJ1L2qu6suqcC2W',
  receiving: 'https://claude.ai/artifact/RsbUcYNz9QfEF8LAbxSKwo',
  stock: 'https://claude.ai/artifact/7oZPudk8GGxqY9L1iXBvbV',
  book: 'https://claude.ai/artifact/KxkLMpRgFk23oeFJdfuq95',
  quote: 'https://claude.ai/artifact/XWm8FSLNSWC4de3vcCAKWC',
  account: 'https://claude.ai/artifact/Hoz1q28Frh9M7hNgV2bo3b',
  sites: 'https://claude.ai/artifact/LXYUo9UQymsN2VyNSynAcB',
  reports: 'https://claude.ai/artifact/NXHvoKd8wY8wpAhBYsPRUt',
  online: 'https://claude.ai/artifact/QGRBBPUhHRd5rg94XbgAyS',
  browse: 'https://claude.ai/artifact/7g2TbX8jMauaaTqSkvj5CQ',
  website: 'https://claude.ai/artifact/RkyxcQZBCaVYfUa8bqixZM',
  oversight: 'https://claude.ai/artifact/XLYiuhFS1WVjS9ohF7G7gf',
  c2w: 'https://claude.ai/artifact/6NR9hm3Gnc3kX1i57xcRgt',
  lightspeed: 'https://claude.ai/artifact/2qnzyGx8enhxbVN17Brpnf',
};
const sandFile = (id, size) => (size === 'single' ? `${id}.dc.html` : `${id}-${size}.dc.html`);
// The sizes a Soft sand screen was drawn at: whichever boards its own canvas has.
const sandSizesOf = (src, id) => SAND_SIZES.filter((v) => existsSync(SAND_SOURCES[src].dir + sandFile(id, v)));
// The big canvas shows one board per screen (decision 8 of journey 16, Jack,
// 29 Sep — the canvas holds at most 512 files): desktop, or the one-off
// large board, or — for a phone-only screen — its only size.
const bigSizeOf = (src, id) => { const all = sandSizesOf(src, id); return all.includes('single') ? 'single' : all.includes('desktop') ? 'desktop' : all[0]; };
// The one-canvas plan: every screen is kept, folded into a kept screen's
// situation list, or listed as later (consolidate/check.test.mjs checks it).
const { plan, lines: extraLines } = await loadPlan();
const allScreens = journeys.flatMap((j) => j.rows.flatMap((r) => r.screens.map((x) => ({ ...x, journey: j }))));
const byId = new Map(allScreens.map((x) => [x.id, x]));
for (const x of allScreens) if (!plan.has(x.id)) throw new Error(`no one-canvas plan for ${x.id} (consolidate/${x.journey.id}.mjs)`);
const isKept = (id) => plan.get(id)?.kind === 'keep';
// Each kept screen's building block, named on its board (issue #116 step 6).
const BLOCKS = blocks();
const blockOf = (id) => { const n = plan.get(id)?.block; return n ? `Block ${n}: ${String(BLOCKS.get(n) ?? '').replace(/\s*\(.*$/, '')}` : ''; };
// The kept screen a screen's situation belongs to (itself when kept).
const ownerOf = (id) => { const e = plan.get(id); return e.kind === 'keep' ? id : e.kind === 'into' || e.kind === 'same' ? ownerOf(e.id) : null; };
// Sizes shown for a kept screen: the plan's, else rule 3 — phone for a
// customer page, otherwise desktop (or the one-off large board).
const shownSizes = (x) => {
  const all = sandSizesOf(x.sand, x.id);
  const want = plan.get(x.id).sizes;
  if (want) { const missing = want.filter((v) => !all.includes(v)); if (missing.length) throw new Error(`${x.id} has no ${missing.join(', ')} board`); return want; }
  if (x.role === 'Customer' && all.includes('phone')) return ['phone'];
  return [bigSizeOf(x.sand, x.id)];
};
function sandBoard(src, id, size) {
  const f = SAND_SOURCES[src].dir + sandFile(id, size);
  const src_ = readFileSync(f, 'utf8');
  const helmet = /<helmet>\n([\s\S]*?)<\/helmet>\n/.exec(src_);
  const body = /<\/helmet>\n([\s\S]*)\n<\/x-dc>/.exec(src_);
  const size_ = /"\$preview":\{"width":(\d+),"height":(\d+)\}/.exec(src_);
  if (!helmet || !body || !size_) throw new Error(`cannot read ${id}-${size} from the Soft sand build`);
  return { helmet: helmet[1], inner: body[1], w: Number(size_[1]), h: Number(size_[2]) };
}
for (const P of PARTS) { rmSync(P.root, { recursive: true, force: true }); mkdirSync(P.root + 'project', { recursive: true }); }

const blobs = JSON.parse(readFileSync(here + 'blobs-fjell.json', 'utf8'));
const designs = Object.fromEntries(JSON.parse(readFileSync(here + 'shots/screens.json', 'utf8')).map((s) => [s.id, s]));

const STATUS = {
  review: { label: 'For review', long: 'NEW DRAWING · FOR YOUR REVIEW', bar: '#0e5f6f', tint: '#e2f1f3', ink: '#0e5f6f' },
  built: { label: 'Built', long: 'BUILT', bar: '#1f6f5c', tint: '#e8f5ec', ink: '#164f42' },
  designed: { label: 'Designed', long: 'DESIGNED · NOT BUILT', bar: '#2c5289', tint: '#eaf1fb', ink: '#2c5289' },
  old: { label: 'Old app', long: 'OLD APP ONLY · NEEDS A NEW DESIGN', bar: '#6a3ea1', tint: '#f1e8fb', ink: '#6a3ea1' },
  gap: { label: 'Not designed', long: 'NOT DESIGNED YET', bar: '#b8460f', tint: '#fbeee6', ink: '#93380b' },
};
const STRIP = 56;
const FONT = "'Work Sans', ui-sans-serif, system-ui, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function roleOf(designRole) {
  const who = designRole.split('·')[0].trim();
  if (who.startsWith('Service desk')) return 'Staff';
  if (who.startsWith('Mechanic')) return 'Mechanic';
  if (who.startsWith('Manager')) return 'Manager';
  if (who.startsWith('Customer')) return 'Customer';
  return who;
}
const deviceOf = (role, mobile) => (mobile ?? role === 'Customer') ? 'phone' : role === 'Mechanic' ? 'tablet' : 'desktop';
const sizeOf = (device) => (device === 'phone' ? [390, 844] : [1100, 760]);

function page(title, w, h, body, helmet = null) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${helmet ?? `<link rel="stylesheet" href="${FONT_LINK.replace(/&/g, '&amp;')}">
<style>
body,button,input,select,textarea{font-family:${FONT}}
body{margin:0;color:#1c1e19;background:#f3f2ee}
a{color:#3f4d33}a:hover{color:#1c1e19}
</style>
`}</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

const navLink = (href, text, label) => href
  ? `<a href="${href}" aria-label="${label}" style="display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 8px; background: rgba(255,255,255,0.18); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none">${text}</a>`
  : `<span style="display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 8px; color: rgba(255,255,255,0.45); font-size: 14px; font-weight: 600">${text}</span>`;

let CUR_BLOCK = ''; // the building block of the board being drawn
function strip(st, meta, nav, extra = '') {
  const s = STATUS[st];
  return `<div style="height: ${STRIP}px; box-sizing: border-box; padding: 0 10px 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${s.bar}; color: #ffffff">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 13px; font-weight: 700; letter-spacing: 0.6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${s.long}</span>
<span style="font-size: 12px; font-weight: 500; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${CUR_BLOCK ? `${esc(CUR_BLOCK)} · ` : ''}${esc(meta)} · ${nav.pos}</span>
</div>
<nav style="display: flex; gap: 6px; flex-shrink: 0">
${extra}${navLink(nav.prev, '‹ Prev', 'Previous screen')}
${navLink('Main.dc.html', 'Overview', 'Back to the overview')}
${navLink(nav.next, 'Next ›', 'Next screen')}
</nav>
</div>`;
}

function imageBoard(scr, w, h, meta, title, nav) {
  const src = `/_blob/${blobs[scr.id]}`;
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #ffffff">
${strip(scr.status, meta, nav)}
<img src="${src}" alt="${esc(title)}" style="width: ${w}px; height: ${h}px; display: block">
</div>`;
}

function drawnBoard(scr, w, h, meta, inner, nav) {
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #ffffff">
${strip(scr.status, meta, nav)}
<div style="width: ${w}px; height: ${h}px; overflow: hidden">${inner}</div>
</div>`;
}

// A Soft sand board: the canvas's own status strip (kept in Work Sans like
// every other board) over the approved drawing, which keeps its own fonts.
function sandBoardHtml(scr, w, h, meta, inner, nav) {
  // Second walk question 2 (Jack, 3 Oct): the link says it opens the journey's
  // own canvas, where every size is drawn.
  const others = SAND_CANVAS[scr.sand] ? navLink(SAND_CANVAS[scr.sand], w < 500 ? 'Its canvas ↗' : 'Other sizes, on its own canvas ↗', 'Tablet and phone sizes, on this journey’s own canvas') : '';
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #ffffff">
<div style="font-family: ${FONT}">${strip(scr.status, meta, nav, others)}</div>
<div style="width: ${w}px; height: ${h}px; overflow: hidden">${inner}</div>
</div>`;
}
// Links between Soft sand boards point at this canvas's file names (j12-…,
// ja-…) — including across journeys, e.g. the sidebar's name button to
// journey A's Your settings; links to screens with no board here (the other
// rooms in the sidebar) lose their href.
function relink(html, known) {
  return html.replace(/ href="([^"#][^"]*?\.dc\.html)"/g, (m, f) => (known.get(f) ? ` href="${known.get(f)}"` : ''));
}

function placeholderBoard(scr, w, h, meta, nav) {
  const s = STATUS[scr.status];
  const phone = w < 500;
  const pad = phone ? 24 : 48;
  const list = scr.content.length
    ? `<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: #56594f">WHAT GOES ON IT</div>
${scr.content.map((c) => `<div style="display: flex; gap: 10px; align-items: flex-start; font-size: ${phone ? 15 : 16}px; line-height: 1.45"><span style="flex-shrink: 0; width: 8px; height: 8px; margin-top: 8px; border-radius: 999px; background: ${s.bar}"></span><span>${esc(c)}</span></div>`).join('\n')}
</div>` : '';
  const today = scr.today
    ? `<div style="padding: 16px 18px; border-radius: 10px; background: ${STATUS.old.tint}; color: #3a2159; font-size: ${phone ? 14 : 15}px; line-height: 1.45"><strong style="display: block; margin-bottom: 4px; color: ${STATUS.old.ink}">Today</strong>${esc(scr.today)}</div>` : '';
  const source = scr.source ? `<div style="font-size: 13px; color: #56594f; line-height: 1.4">Source: ${esc(scr.source)}</div>` : '';
  return `<div style="width: ${w}px; height: ${h + STRIP}px; display: flex; flex-direction: column; background: #f3f2ee">
${strip(scr.status, meta, nav)}
<div style="flex-grow: 1; box-sizing: border-box; padding: ${pad}px; display: flex; flex-direction: column">
<div style="flex-grow: 1; box-sizing: border-box; padding: ${phone ? 24 : 40}px; border: 2px dashed #83867a; border-radius: 10px; background: #fbfbf9; display: flex; flex-direction: column; gap: ${phone ? 18 : 24}px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${s.ink}">${esc(scr.role.toUpperCase())} · ${esc(deviceOf(scr.role).toUpperCase())}</div>
<h1 style="margin: 0; font-size: ${phone ? 26 : 32}px; line-height: 1.2; font-weight: 700; letter-spacing: -0.4px">${esc(scr.title)}</h1>
<p style="margin: 0; font-size: ${phone ? 16 : 18}px; line-height: 1.5; color: #3d4038">${esc(scr.purpose)}</p>
</div>
${list}
${today}
<div style="flex-grow: 1"></div>
${source}
</div>
</div>
</div>`;
}

function navFor(list, file) {
  const i = list.indexOf(file);
  return { prev: list[i - 1] || null, next: list[i + 1] || null, pos: `${i + 1} of ${list.length}` };
}
const GAP_X = 80;

// A screen becomes one board, or two (desktop + phone) when it is a new drawing.
const variantsOf = (j, x) => {
  if (x.sand) return shownSizes(x).map((v) => ({ file: `${j.id}-${sandFile(x.id, v)}`, v, sand: x.sand }));
  if (!x.drawn) return [{ file: `${j.id}-${x.id}.dc.html`, v: null }];
  const d = DRAWN[x.id];
  if (!d) throw new Error(`no drawing for ${x.id}`);
  if (d.single) return [{ file: `${j.id}-${x.id}.dc.html`, v: 'single' }];
  return [{ file: `${j.id}-${x.id}-desktop.dc.html`, v: 'desktop' }, { file: `${j.id}-${x.id}-phone.dc.html`, v: 'phone' }];
};
const seq = journeys.map((j) => j.rows.flatMap((r) => r.screens.filter((x) => isKept(x.id)).flatMap((x) => variantsOf(j, x).map((o) => o.file))));
// Every Soft sand board file name (as its own canvas names it, any size) →
// the board on this canvas a link to it should open, for relink(): its own
// board at that size if shown, else its first board; a folded-in situation
// opens the screen it belongs to; a "later" screen has no board.
const sandFiles = new Map();
const boardFor = (id, size) => {
  const own = ownerOf(id);
  if (!own) return null;
  const x = byId.get(own);
  const vs = variantsOf(x.journey, x);
  return (vs.find((o) => o.v === size) ?? vs[0]).file;
};
for (const x of allScreens) if (x.sand) for (const v of sandSizesOf(x.sand, x.id)) {
  const f = sandFile(x.id, v);
  if (sandFiles.has(f)) throw new Error(`two Soft sand boards are both called ${f}`);
  sandFiles.set(f, boardFor(x.id, v));
}
// Each Soft sand canvas must hold exactly the screens journeys.mjs lists for
// it, in the same order and rows — journeys.mjs lists them by hand (with
// plain titles), so check they agree.
for (const [src, { dir, explore = [], exploreRow = null }] of Object.entries(SAND_SOURCES)) {
  const sandCanvas = JSON.parse(readFileSync(dir + 'canvas.json', 'utf8'));
  const isExplore = (f) => explore.some((id) => f.startsWith(id + '-') || f === id + '.dc.html');
  const theirs = sandCanvas.order.filter((f) => f !== 'Main.dc.html' && !isExplore(f));
  const mine = journeys.flatMap((j) => j.rows.flatMap((r) => r.screens.filter((x) => x.sand === src)));
  const ours = mine.flatMap((x) => sandSizesOf(src, x.id).map((v) => sandFile(x.id, v)));
  if (theirs.join() !== ours.join()) throw new Error(`journeys.mjs no longer matches ${src}'s own canvas:\n theirs ${theirs.join()}\n ours ${ours.join()}`);
  const theirRows = Object.values(sandCanvas.notes).map((n) => n.text).filter((t) => !(exploreRow && t.startsWith(exploreRow)));
  const ourRows = journeys.flatMap((j) => j.rows.filter((r) => r.screens.some((x) => x.sand === src)).map((r) => r.label));
  if (theirRows.join('|') !== ourRows.join('|')) throw new Error(`${src} rows differ: ${theirRows.join(' | ')}`);
}
for (const j of journeys) if (!PARTS.some((P) => P.ids.includes(j.id))) throw new Error(`journey ${j.id} is on no canvas`);
// Each kept screen's situation list (README rule 2), shared with the mockup
// (consolidate/situation-lines.mjs: the same lines under each drawing).
const linesOf = await situationLines();
// Release 1 pictures (d()) carry no title or role in journeys.mjs; theirs are
// in shots/screens.json.
const titleOf = (x) => x.title ?? designs[x.id]?.title ?? x.id;
const situationText = (id) => {
  const lines = linesOf(id);
  return lines.length ? [`Situations of this screen (${lines.length})`, ...lines].join('\n') : null;
};
const NOTE_LINE = 30;
// A note's height: its lines, each wrapping at about 8px a character.
const noteH = (t, w) => t.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil((l.length * 8) / Math.max(w - 32, 200))), 0) * NOTE_LINE;
const laterText = (j) => {
  const list = j.rows.flatMap((r) => r.screens).filter((x) => plan.get(x.id).kind === 'later');
  return list.length ? [`Later — not drawn here (${list.length})`, ...list.map((x) => `• ${titleOf(x)} — ${plan.get(x.id).reason}`)].join('\n') : null;
};
let numbered = 0;
const NUMS = Object.fromEntries(journeys.map((j) => [j.id, j.num ?? String(++numbered).padStart(2, '0')]));
const allCounts = {};
for (const P of PARTS) {
const boards = P.boards = {};
const order = P.order = [];
const notes = P.notes = {};
// Links to a screen on the other canvas lose their href (relink).
const known = sandFiles;
// One canvas: the overview on top, then every journey as a single left-to-right line, stacked.
let y = 360 + 60 + journeys.length * 58 + 140 + 1000;
journeys.filter((j) => P.ids.includes(j.id)).forEach((j) => {
  const list = seq[journeys.indexOf(j)];
  const num = NUMS[j.id];
  const tally = { review: 0, built: 0, designed: 0, old: 0, gap: 0, first: null };
  let x = 0;
  let tallest = 0;
  let noteDepth = 0;
  const boardH = (scr) => Math.max(...variantsOf(j, scr).map((o) => boards[o.file]?.h ?? 0));
  for (const row of j.rows) {
    const kept = row.screens.filter((x) => isKept(x.id));
    if (!kept.length) continue; // a row whose screens all became situations elsewhere
    // No row-label note: a canvas holds at most 200 notes, and the situation
    // lists need them. Rows stay apart by the wider gap below.
    for (const scr0 of kept) {
      const scr = { ...scr0 };
      const x0 = x;
      for (const { file, v, sand } of variantsOf(j, scr)) {
        CUR_BLOCK = blockOf(scr.id);
        const nav = { ...navFor(list, file), };
        let title, meta, w, h, html, helmet = null;
        if (sand) {
          const sb = sandBoard(sand, scr.id, v);
          [w, h] = [sb.w, sb.h];
          meta = v === 'single' ? scr.role : `${scr.role} · ${v}`;
          title = v === 'single' ? scr.title : `${(sand === 'diary' && v !== 'desktop' && TOUCH_TITLE_OVERRIDE[scr.id]) || scr.title} (${v})`;
          helmet = `<link rel="stylesheet" href="${FONT_LINK.replace(/&/g, '&amp;')}">\n${sb.helmet}`;
          html = sandBoardHtml(scr, w, h, meta, relink(sb.inner, known), nav);
        } else if (v) {
          const d = DRAWN[scr.id];
          if (v === 'single') { [w, h] = [stage1.MAP_W, stage1.MAP_H]; meta = scr.role; }
          else { [w, h] = v === 'desktop' ? [stage1.DW, stage1.DH] : [stage1.PW, stage1.PH]; meta = `${scr.role} · ${v}`; }
          title = v === 'single' ? scr.title : `${scr.title} (${v})`;
          html = drawnBoard(scr, w, h, meta, d[v], nav);
        } else if (scr.status === 'built' || scr.status === 'designed') {
          const dsg = designs[scr.id];
          if (!dsg) throw new Error(`no design for ${scr.id}`);
          const role = roleOf(dsg.role);
          const device = deviceOf(role, dsg.mobile);
          [w, h] = sizeOf(dsg.mobile ? 'phone' : 'desktop');
          title = dsg.title;
          meta = `${role} · ${device}`;
          html = imageBoard(scr, w, h, meta, title, nav);
        } else {
          const device = deviceOf(scr.role);
          [w, h] = sizeOf(device);
          title = scr.title;
          meta = `${scr.role} · ${device}`;
          html = placeholderBoard(scr, w, h, meta, nav);
        }
        if (boards[file]) throw new Error(`duplicate ${file}`);
        writeFileSync(P.root + 'project/' + file, page(`${title} (${STATUS[scr.status].label})`, w, h + STRIP, html, helmet));
        boards[file] = { x, y, w, h: h + STRIP, title: `${STATUS[scr.status].label} · ${title}`, is_interactive: true };
        order.push(file);
        tally.first ??= file;
        x += w + (v === 'desktop' || v === 'tablet' ? 40 : GAP_X);
        tallest = Math.max(tallest, h + STRIP);
      }
      tally[scr.status]++; // count each screen once, whatever its sizes (Jack, 29 Sep)
      const sit = situationText(scr.id);
      if (sit) {
        // The canvas editor keeps 5,000 characters of a note (seen 3 Oct), so a
        // long list carries on in a second note beside the first.
        const w = Math.min(Math.max(x - x0 - 40, 360), 2000);
        const parts = [];
        let cur = [];
        for (const line of sit.split('\n')) {
          if (cur.length && [...cur, line].join('\n').length > 4800) { parts.push(cur.join('\n')); cur = ['Situations of this screen, continued']; }
          cur.push(line);
        }
        parts.push(cur.join('\n'));
        let ny = y + boardH(scr) + 40;
        parts.forEach((t, i) => { notes[`${j.id}_sit_${scr.id}${i ? `_${i + 1}` : ''}`] = { x: x0, y: ny, text: t, w }; ny += noteH(t, w) + 40; });
        noteDepth = Math.max(noteDepth, ny - (y + boardH(scr)));
      }
    }
    x += 160; // a wider gap between sections of the same journey
  }
  const lt = laterText(j);
  if (lt) notes[`${j.id}_later`] = { x, y, text: lt, w: 720, fill: 'gray' };
  notes[`${j.id}_title`] = { x: 0, y: y - 560, text: `${num} · ${j.name} — ${j.who}`, kind: 'title1', maxW: Math.max(x - 240, 1600) };
  allCounts[j.id] = { num, name: j.name, who: j.who, ...tally, part: P };
  y += Math.max(tallest + noteDepth, lt ? lt.split('\n').length * NOTE_LINE : 0) + 1000;
});
}

// Overview board
const KEYS = ['review', 'built', 'designed', 'old', 'gap'];
for (const P of PARTS) {
const { boards, order, notes, root } = P;
const pages = [];
const counts = journeys.map((j) => allCounts[j.id]);
const total = Object.fromEntries(KEYS.map((k) => [k, counts.reduce((a, c) => a + c[k], 0)]));
const all = KEYS.reduce((a, k) => a + total[k], 0);
const legend = [
  ['review', 'New shadcn-style drawing, desktop and phone. Waiting for your review.'],
  ['built', 'In the app today.'],
  ['designed', 'Drawn and agreed; not built yet.'],
  ['old', 'Only in the old staff app. Release 2 retires it, so it needs a new design.'],
  ['gap', 'Needed, but nothing exists yet. We design these one by one.'],
];
const cell = (n, st) => `<span style="display: inline-block; min-width: 44px; text-align: center; padding: 4px 10px; border-radius: 999px; font-size: 15px; font-weight: 700; ${n ? `background: ${STATUS[st].tint}; color: ${STATUS[st].ink}` : 'color: #83867a'}">${n}</span>`;
const rowsHtml = counts.map((c) => `<a href="${c.part === P ? c.first : c.part.url}" style="display: grid; grid-template-columns: 64px minmax(0, 1fr) 220px 100px 90px 100px 100px 120px; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #dcdbd3; text-decoration: none; color: #1c1e19">
<span style="font-size: 15px; font-weight: 700; color: #56594f">${c.num}</span>
<span style="font-size: 17px; font-weight: 600">${esc(c.name)}</span>
<span style="font-size: 15px; color: #56594f">${esc(c.who)}</span>
<span>${cell(c.review, 'review')}</span><span>${cell(c.built, 'built')}</span><span>${cell(c.designed, 'designed')}</span><span>${cell(c.old, 'old')}</span><span>${cell(c.gap, 'gap')}</span>
</a>`).join('\n');
const OW = 1600;
const OH = 360 + 60 + counts.length * 58 + 140 + 80;
const overview = `<div style="width: ${OW}px; height: ${OH}px; box-sizing: border-box; padding: 64px; display: flex; flex-direction: column; gap: 36px; background: #f3f2ee">
<div style="display: flex; flex-direction: column; gap: 10px">
<div style="font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #3f4d33">WHEELHOUSE</div>
<h1 style="margin: 0; font-size: 48px; line-height: 1.1; font-weight: 700; letter-spacing: -1px">User journeys — ${esc(P.short.toLowerCase())}</h1>
<p style="margin: 0; font-size: 19px; line-height: 1.5; color: #3d4038; max-width: 980px">Every journey on one canvas, one board per real screen. The other situations of a screen — empty, saved, failed, the Staff view, all shops and so on — are listed under its board instead of drawn (issue #116). Screens put off for later are listed at the end of their journey. The table counts the ${all} screens drawn here, in ${counts.length} journeys. Scroll down to see the journeys laid out left to right in the order they happen. In Play, click a row to jump to its first screen; each board's "Tablet and phone" link opens its journey's own canvas, where every drawing is kept.</p>
</div>
<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px">
${legend.map(([st, text]) => `<div style="padding: 18px 20px; border-radius: 12px; background: #fbfbf9; border: 1px solid #dcdbd3; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; justify-content: space-between"><span style="padding: 5px 12px; border-radius: 999px; background: ${STATUS[st].bar}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.4px">${STATUS[st].label.toUpperCase()}</span><span style="font-size: 30px; font-weight: 700; color: ${STATUS[st].ink}">${total[st]}</span></div>
<div style="font-size: 15px; line-height: 1.45; color: #3d4038">${text}</div>
</div>`).join('\n')}
</div>
<div style="background: #fbfbf9; border: 1px solid #dcdbd3; border-radius: 12px; overflow: hidden">
<div style="display: grid; grid-template-columns: 64px minmax(0, 1fr) 220px 100px 90px 100px 100px 120px; gap: 12px; padding: 14px 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: #56594f">
<span>#</span><span>JOURNEY</span><span>WHO</span><span>FOR REVIEW</span><span>BUILT</span><span>DESIGNED</span><span>OLD APP</span><span>NOT DESIGNED</span>
</div>
${rowsHtml}
</div>
</div>`;
writeFileSync(root + 'project/Main.dc.html', page('User journeys overview', OW, OH, overview));
boards['Main.dc.html'] = { x: 0, y: 0, w: OW, h: OH, title: 'Overview', is_interactive: true };
order.unshift('Main.dc.html');
writeFileSync(root + 'project/Workflow.dc.html', page('How the journeys connect', WF_W, WF_H, workflow(counts)));
boards['Workflow.dc.html'] = { x: OW + 240, y: 0, w: WF_W, h: WF_H, title: 'Workflow: how the journeys connect' };
order.splice(1, 0, 'Workflow.dc.html');

const canvas = {
  v: 3,
  createdOnFiles: JSON.parse(readFileSync(here + P.live, 'utf8')).createdOnFiles,
  title: P.title,
  launch: { view: 'canvas' },
  attachments: JSON.parse(readFileSync(here + P.live, 'utf8')).attachments ?? [],
  pages,
  boards,
  order,
  notes,
  designSystems: JSON.parse(readFileSync(here + P.live, 'utf8')).designSystems ?? [],
};
// The canvas editor caps these when it saves (seen 3 Oct): a sticky note's
// width at 2000, a title's maxW at 8000, a board title at 120 characters.
// Capped here too, so a build matches what the canvas keeps.
for (const n of Object.values(canvas.notes)) { if (n.w > 2000) n.w = 2000; if (n.maxW > 8000) n.maxW = 8000; }
for (const b of Object.values(canvas.boards)) if (b.title && b.title.length > 120) b.title = b.title.slice(0, 120);
writeFileSync(root + 'project/canvas.json', JSON.stringify(canvas, null, 1));
// Boards on the live canvas that this build no longer makes: publish these as
// null so they are removed.
const removed = Object.keys(JSON.parse(readFileSync(here + P.live, 'utf8')).boards ?? {}).filter((f) => !boards[f]).sort();
writeFileSync(root + 'removed.json', JSON.stringify(removed, null, 1) + '\n');
console.log(JSON.stringify({ canvas: P.key, files: order.length, total, pages: pages.length, notes: Object.keys(notes).length, removed: removed.length }));
}
