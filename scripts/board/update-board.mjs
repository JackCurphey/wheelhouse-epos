// Fills in the mechanical part of the build board from what has merged.
// Adds one "done" row to BOARD.pieces for each pull request merged into main
// in the last 14 days that is not already on the board by number (chosen by
// merge date, so a pull request opened early and merged late is still picked
// up, and a hand-made status pull request that moves `updated` can't hide
// any). Turns a "review" row whose pull request has merged, on whatever date,
// into "done", and sets `updated` to today. Skips status and board pull
// requests, bot authors, dependency-update branches and "Bump" titles.
// Everything else in BOARD (the lead, the asks, who is on what, the slices) is
// written by hand and is never touched: this makes surgical text edits, it
// does not re-write the object. `sub` (the "Merged 3 to 10 Nov..." line) names
// who wrote what and what is open, which a script can't know, so it is left
// for a person. Safe to run twice: the second run adds nothing.
// Spec: issue #669, change 4 (Jack's approval).
//
// Usage:
//   node scripts/board/update-board.mjs [--dry-run] [--today YYYY-MM-DD]
// Needs the GitHub command line (`gh`) signed in. With --dry-run it prints
// what it would change and writes nothing. When GITHUB_OUTPUT is set (in
// GitHub Actions) it also writes `changed=true|false` and `highest=<number>`.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOARD_FILE = fileURLToPath(new URL('../../docs/build-progress/build-board.html', import.meta.url));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Pull requests that only touch these files are the board's own upkeep.
const UPKEEP_FILES = new Set(['.agents/STATUS.md', 'docs/build-progress/build-board.html']);

export function boardDate(d) {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// The BOARD object's text: from "const BOARD = {" to the line "};".
function boardBlock(html) {
  const start = html.indexOf('const BOARD = {');
  const end = html.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('Could not find the BOARD block in the board page');
  return { start, end: end + 3, text: html.slice(start, end + 3) };
}

// Evaluates the block the way the page does (it is plain JavaScript).
function evaluate(html) {
  const { text } = boardBlock(html);
  return new Function(`${text}\nreturn BOARD;`)();
}

// Where the pieces list starts and ends, as character offsets in the page.
function piecesRange(html) {
  const { start, end } = boardBlock(html);
  const open = html.indexOf('\n  pieces: [\n', start);
  const close = html.indexOf('\n  ],\n', open);
  if (open < 0 || close < 0 || close > end) throw new Error('Could not find BOARD.pieces in the board page');
  return { open: open + '\n  pieces: [\n'.length, close: close + 1 };
}

export function isUpkeep(pr) {
  // Status pull requests are titled "Status, 11 Nov", "Status 26 Oct: ..." or
  // "Status: ..."; "Status page for jobs" is a piece of work.
  if (/^status(?:[,:]|\s+\d)/i.test(pr.title) || /^board:/i.test(pr.title)) return true;
  const branch = pr.headRefName || '';
  if (branch === 'bot/board' || /^(dependabot|renovate)\//.test(branch)) return true;
  if (/^bump\s/i.test(pr.title)) return true;
  const who = pr.author || {};
  if (who.is_bot || /\[bot\]$/.test(who.login || '')) return true;
  const files = (pr.files || []).map((f) => f.path);
  return files.length > 0 && files.every((f) => UPKEEP_FILES.has(f));
}

// One safe single-quoted JavaScript string. `<` becomes \x3c so a title can't
// close the script block (</script>) or open a comment (<!--); whitespace
// including newlines collapses to one space.
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const quote = (s) => `'${flat(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c')}'`;

// How far back to look for merged pull requests: 14 days before today, as
// YYYY-MM-DD (UTC).
export function lookBackDay(today) {
  return new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
}

// The numbers of the pieces marked "review", to ask GitHub whether they merged.
export function reviewNumbers(html) {
  const { open, close } = piecesRange(html);
  return [...html.slice(open, close).matchAll(/status: 'review'.*\bpr: (\d+)\b/g)].map((m) => Number(m[1]));
}

// Returns { html, added, flipped, highest }. `prs` is gh's list of merged pull
// requests: { number, title, mergedAt, headRefName, author, files: [{ path }] };
// `mergedReview` is the numbers of "review" rows' pull requests known to have merged.
export function updateBoard(html, prs, { today = new Date(), mergedReview = [] } = {}) {
  const board = evaluate(html);
  const onBoard = new Set(board.pieces.map((p) => p.pr).filter(Number.isInteger));
  const floor = Math.max(0, ...onBoard);
  const since = `${lookBackDay(today)}T00:00:00Z`;
  const merged = new Set([...mergedReview, ...prs.map((p) => p.number)]);
  let out = html;

  // A "review" row whose pull request has now merged is done.
  const flipped = [];
  const { open, close } = piecesRange(out);
  const rows = out.slice(open, close).split('\n').map((line) => {
    const m = /^(\s*\{ status: )'review'(.*\bpr: (\d+)\b.*)$/.exec(line);
    if (m && merged.has(Number(m[3]))) {
      flipped.push(Number(m[3]));
      return `${m[1]}'done'${m[2]}`;
    }
    return line;
  });
  out = out.slice(0, open) + rows.join('\n') + out.slice(close);

  const fresh = prs
    .filter((p) => p.mergedAt >= since && !onBoard.has(p.number) && !isUpkeep(p))
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.number - b.number);
  const added = fresh.map((p) => p.number);

  if (fresh.length) {
    // New rows go after the last "done" row, ahead of the pieces still to do.
    const range = piecesRange(out);
    const lines = out.slice(range.open, range.close).split('\n');
    lines.pop(); // the empty string after the last newline
    let at = lines.length;
    while (at > 0 && !/status: 'done'/.test(lines[at - 1])) at--;
    const newLines = fresh.map((p) => `    { status: 'done', what: ${quote(p.title)}, detail: '', pr: ${p.number} },`);
    lines.splice(at, 0, ...newLines);
    out = out.slice(0, range.open) + lines.join('\n') + '\n' + out.slice(range.close);
  }

  if (fresh.length || flipped.length) {
    const date = boardDate(today);
    const replaced = out.replace(/^( {2}updated: )'[^'\n]*',$/m, `$1'${date}',`);
    if (replaced === out && !out.includes(`updated: '${date}',`)) throw new Error('Could not find the updated line in BOARD');
    out = replaced;
  }

  // Never hand back a page whose data no longer evaluates.
  const check = evaluate(out);
  for (const n of [...added, ...flipped]) {
    if (!check.pieces.some((p) => p.pr === n && p.status === 'done')) throw new Error(`#${n} did not land as a done row`);
  }
  for (const p of fresh) {
    if (check.pieces.find((x) => x.pr === p.number).what !== flat(p.title)) throw new Error(`#${p.number}'s title did not survive`);
  }
  return { html: out, added, flipped, highest: Math.max(floor, ...added) };
}

export const LIST_LIMIT = 200;

function ghList(since) {
  return JSON.parse(execFileSync('gh', [
    'pr', 'list', '--state', 'merged', '--base', 'main',
    '--search', `merged:>=${since}`,
    '--json', 'number,title,mergedAt,headRefName,author,files', '--limit', String(LIST_LIMIT),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

function ghView(n) {
  return JSON.parse(execFileSync('gh', ['pr', 'view', String(n), '--json', 'state'], { encoding: 'utf8', timeout: 30_000 }));
}

// Pull requests merged into main since `since` (YYYY-MM-DD). A full page may
// mean the list was cut short, so it says so.
export function fetchMerged(since, list = ghList, warn = console.warn) {
  const prs = list(since);
  if (prs.length >= LIST_LIMIT) warn(`Warning: ${prs.length} pull requests merged since ${since}, the most one list returns; some may be missing.`);
  return prs;
}

// Which of these pull requests have merged, whatever the date. A number GitHub
// can't find (a review row pointing at an issue, say) is warned about and skipped.
export function fetchMergedAmong(numbers, view = ghView, warn = console.warn) {
  return numbers.filter((n) => {
    try {
      return view(n).state === 'MERGED';
    } catch (error) {
      warn(`Warning: could not look up #${n} (${error.message.split('\n')[0]}); its review row is left alone.`);
      return false;
    }
  });
}

function main(argv) {
  const dry = argv.includes('--dry-run');
  const i = argv.indexOf('--today');
  const today = i >= 0 ? new Date(`${argv[i + 1]}T12:00:00Z`) : new Date();
  const before = readFileSync(BOARD_FILE, 'utf8');
  const result = updateBoard(before, fetchMerged(lookBackDay(today)), { today, mergedReview: fetchMergedAmong(reviewNumbers(before)) });
  const changed = result.html !== before;
  const titles = new Map(fetchTitles(result.html));
  if (!changed) console.log(`The board is up to date (highest pull request on it: #${result.highest}).`);
  for (const n of result.added) console.log(`  add     #${n} ${titles.get(n) || ''}`);
  for (const n of result.flipped) console.log(`  flip    #${n} review -> done`);
  if (changed) console.log(`  updated -> ${boardDate(today)}`);
  console.log('  `sub` (the "Merged ..." line) is left for a person to update.');
  if (changed && !dry) writeFileSync(BOARD_FILE, result.html);
  if (dry && changed) console.log('Dry run: nothing written.');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed && !dry}\nhighest=${result.highest}\n`);
}

function fetchTitles(html) {
  return evaluate(html).pieces.filter((p) => Number.isInteger(p.pr)).map((p) => [p.pr, p.what]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
