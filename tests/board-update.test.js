// The build board fills itself in (Jack, #669 change 4): scripts/board/update-board.mjs
// adds a "done" row for each pull request merged since the last one on the
// board, and nothing else. These tests feed it a made-up list of merged pull
// requests (never GitHub) and check it adds those rows, skips status-only
// pull requests, can run twice, and leaves the rest of the page untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { sinceDay, updateBoard } from '../scripts/board/update-board.mjs';

const html = readFileSync(new URL('../docs/build-progress/build-board.html', import.meta.url), 'utf8');
const TODAY = new Date('2030-01-05T12:00:00Z');
const { highest } = updateBoard(html, [], { today: TODAY });
const pr = (n, title, extra = {}) => ({
  number: n, title, mergedAt: new Date(Date.UTC(2030, 0, 1, 0, n)).toISOString(), headRefName: `mark/test-${n}`,
  files: [{ path: 'server/x.js' }], ...extra,
});
const NEW = [pr(highest + 1, 'First test change'), pr(highest + 2, "Second test change, with an apostrophe's")];
const lines = (s) => s.split('\n');

test('the highest pull request already on the board is found', () => {
  assert.ok(highest >= 667, `found ${highest}`);
});

test('a new merged pull request becomes a done row, and the date moves', () => {
  const out = updateBoard(html, NEW, { today: TODAY });
  assert.deepEqual(out.added, [highest + 1, highest + 2]);
  assert.match(out.html, new RegExp(`\\{ status: 'done', what: 'First test change', detail: '', pr: ${highest + 1} \\},`));
  assert.ok(out.html.includes(`what: 'Second test change, with an apostrophe\\'s'`), 'quotes are escaped');
  assert.ok(out.html.includes("  updated: '5 Jan 2030',"));
  assert.equal(out.highest, highest + 2);
  // New rows sit with the other done rows, ahead of the pieces still to do.
  assert.ok(out.html.indexOf('what: \'First test change\'') < out.html.indexOf("{ status: 'next', what: 'Replan into playable slices'"));
});

test('pull requests at or below the board, status pull requests and bot board pull requests are skipped', () => {
  const skipped = [
    pr(highest, 'Already there'),
    pr(highest + 1, 'Status, 12 Nov: caught up'),
    pr(highest + 2, 'Catching up the notes', { files: [{ path: '.agents/STATUS.md' }, { path: 'docs/build-progress/build-board.html' }] }),
    pr(highest + 3, 'Board: merged up to #1 (x)', { headRefName: 'bot/board-2030-01-04' }),
  ];
  const out = updateBoard(html, skipped, { today: TODAY });
  assert.deepEqual(out.added, []);
  assert.equal(out.html, html, 'nothing changes, not even the date');
});

test('a review row for a merged pull request is flipped to done', () => {
  const withReview = html.replace("{ status: 'next', what: 'Replan into playable slices'", "{ status: 'review', what: 'Replan into playable slices'");
  assert.notEqual(withReview, html);
  const out = updateBoard(withReview, [pr(499, 'Replan merged')], { today: TODAY });
  assert.deepEqual(out.flipped, [499]);
  assert.ok(out.html.includes("{ status: 'done', what: 'Replan into playable slices'"));
  assert.deepEqual(out.added, [], 'its row was already there');
});

test('running it twice adds nothing the second time', () => {
  const once = updateBoard(html, NEW, { today: TODAY });
  const twice = updateBoard(once.html, NEW, { today: new Date('2030-02-01T00:00:00Z') });
  assert.equal(twice.html, once.html);
  assert.deepEqual(twice.added, []);
});

test('everything but the new rows and the date line is left alone', () => {
  const out = updateBoard(html, NEW, { today: TODAY });
  const before = lines(html);
  const after = lines(out.html);
  const rows = after.filter((l) => /status: 'done', what: '(First|Second) test change/.test(l));
  assert.equal(rows.length, 2);
  const rest = after.filter((l) => !rows.includes(l));
  assert.equal(rest.length, before.length);
  const differ = rest.map((l, i) => [before[i], l]).filter(([a, b]) => a !== b);
  assert.equal(differ.length, 1, 'only one other line changes');
  assert.match(differ[0][0], /^ {2}updated: /);
  assert.match(differ[0][1], /^ {2}updated: '5 Jan 2030',$/);
});

test('the updated page still draws every section', () => {
  const out = updateBoard(html, NEW, { today: TODAY });
  const doc = new JSDOM(out.html, { runScripts: 'dangerously' }).window.document;
  assert.equal(doc.getElementById('updated').textContent.trim().includes('5 Jan 2030'), true);
  for (const id of ['ov-tally', 'tally', 'screens', 'pieces', 'asks', 'journeys']) {
    assert.ok(doc.getElementById(id).children.length > 0, `#${id} has nothing in it`);
  }
  assert.ok(doc.getElementById('pieces').textContent.includes('First test change'));
});

// A pull request opened early can merge after a higher-numbered one already on
// the board. It is chosen by when it merged, not by being above the highest number.
const onBoardNumbers = new Set([...html.matchAll(/\bpr: (\d+)\b/g)].map((m) => Number(m[1])));
const freeBelowHighest = () => {
  let n = highest - 1;
  while (onBoardNumbers.has(n)) n--;
  return n;
};

test('a lower-numbered pull request that merged after the board’s last update is still added', () => {
  const late = freeBelowHighest();
  assert.ok(late > 0 && late < highest);
  const out = updateBoard(html, [pr(late, 'Opened early, merged late')], { today: TODAY });
  assert.deepEqual(out.added, [late]);
  assert.ok(out.html.includes(`what: 'Opened early, merged late', detail: '', pr: ${late} },`));
  assert.equal(out.highest, highest, 'the highest number on the board does not go down');
});

test('the window starts the day before the board’s update date', () => {
  assert.equal(sinceDay("  updated: '1 Mar 2031',\n"), '2031-02-28');
  assert.equal(sinceDay("  updated: '1 Jan 2031',\n"), '2030-12-31');
  const day = sinceDay(html);
  const inside = pr(highest + 1, 'Merged on the day before', { mergedAt: `${day}T00:30:00Z` });
  const before = new Date(Date.parse(`${day}T00:00:00Z`) - 60000).toISOString();
  const outside = pr(highest + 2, 'Merged a minute too early', { mergedAt: before });
  assert.deepEqual(updateBoard(html, [inside, outside], { today: TODAY }).added, [highest + 1]);
});

test('a pull request that merged before the day ahead of the board’s update date is not added', () => {
  const stale = pr(freeBelowHighest(), 'Merged long ago', { mergedAt: '2020-01-01T00:00:00Z' });
  const out = updateBoard(html, [stale], { today: TODAY });
  assert.deepEqual(out.added, []);
  assert.equal(out.html, html);
});
