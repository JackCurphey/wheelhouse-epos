// Fills in the mechanical part of the build board from what has merged.
// Adds one "done" row to BOARD.pieces for each pull request merged into main
// since the day before the board's `updated` date (chosen by merge date, so a
// pull request opened early and merged late is still picked up) and not yet on
// the board by number, turns a
// "review" row for a merged pull request into "done", and sets `updated`.
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
  if (/^status\b/i.test(pr.title) || /^board:/i.test(pr.title)) return true;
  if (/^bot\/board-/.test(pr.headRefName || '')) return true;
  const files = (pr.files || []).map((f) => f.path);
  return files.length > 0 && files.every((f) => UPKEEP_FILES.has(f));
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim()}'`;

// The first day to look at: the day before the board's `updated` date, as
// YYYY-MM-DD (UTC). Gives a day's slack for a pull request merged late.
export function sinceDay(html) {
  const m = /^ {2}updated: '(\d{1,2}) (\w{3}) (\d{4})',$/m.exec(html);
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  if (month < 0) throw new Error('Could not read the updated date in BOARD');
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]) - 1)).toISOString().slice(0, 10);
}

// Returns { html, added, flipped, highest }. `prs` is gh's list of merged pull
// requests: { number, title, mergedAt, headRefName, files: [{ path }] }.
export function updateBoard(html, prs, { today = new Date() } = {}) {
  const board = evaluate(html);
  const onBoard = new Set(board.pieces.map((p) => p.pr).filter(Number.isInteger));
  const floor = Math.max(0, ...onBoard);
  const since = `${sinceDay(html)}T00:00:00Z`;
  const merged = new Set(prs.map((p) => p.number));
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
  return { html: out, added, flipped, highest: Math.max(floor, ...added) };
}

export function fetchMerged(since) {
  const json = execFileSync('gh', [
    'pr', 'list', '--state', 'merged', '--base', 'main',
    '--search', `merged:>=${since}`,
    '--json', 'number,title,mergedAt,headRefName,files', '--limit', '200',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(json);
}

function main(argv) {
  const dry = argv.includes('--dry-run');
  const i = argv.indexOf('--today');
  const today = i >= 0 ? new Date(`${argv[i + 1]}T12:00:00Z`) : new Date();
  const before = readFileSync(BOARD_FILE, 'utf8');
  const result = updateBoard(before, fetchMerged(sinceDay(before)), { today });
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
