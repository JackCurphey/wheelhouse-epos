// The build board fills itself in (Jack, #669 change 4): scripts/board/update-board.mjs
// adds a "done" row for each pull request merged in the last 14 days that is
// not already on the board, and nothing else. These tests run it on a small
// made-up board and a made-up list of merged pull requests (never GitHub and
// never today's real board), apart from one test that checks the real page
// still parses and comes back unchanged when there is nothing to add.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as board from '../scripts/board/update-board.mjs';

const REAL = readFileSync(new URL('../docs/build-progress/build-board.html', import.meta.url), 'utf8');
const WORKFLOW = readFileSync(new URL('../.github/workflows/board.yml', import.meta.url), 'utf8');

const FIXTURE = `<main></main>
<script>
// THE DATA.
const BOARD = {
  overview: { note: "kept, with 'quotes' and a </b> tag" },
  // a hand-written comment that must survive
  updated: '3 Mar 2030',
  lead: 'Hand written.',
  sub: 'Merged 1 to 3 Mar: #10 to #20, all Jack\\'s.',
  pieces: [
    { status: 'done', what: 'Old one', detail: 'x', pr: 10 },
    { status: 'done', what: 'Newer one', detail: 'y', pr: 20 },
    { status: 'review', what: 'Waiting', detail: 'z', pr: 30 },
    { status: 'next', what: 'Later thing', detail: 'w', pr: 40 },
  ],
  asks: [
    { what: 'Hand-written ask', detail: 'stays' },
  ],
};
</script>
`;
const TODAY = new Date('2030-03-10T12:00:00Z'); // look-back starts 2030-02-24

const pr = (n, title, extra = {}) => ({
  number: n, title, mergedAt: new Date(Date.UTC(2030, 2, 5, 0, n)).toISOString(), headRefName: `mark/test-${n}`,
  author: { login: 'markcurphey', is_bot: false }, files: [{ path: 'server/x.js' }], ...extra,
});
const run = (html, prs, opts = {}) => board.updateBoard(html, prs, { today: TODAY, ...opts });
const evalBoard = (html) => {
  const start = html.indexOf('const BOARD = {');
  return new Function(`${html.slice(start, html.indexOf('\n};', start) + 3)}\nreturn BOARD;`)();
};
const whatOf = (html, n) => evalBoard(html).pieces.find((p) => p.pr === n)?.what;

test('a new merged pull request becomes a done row, ahead of the pieces still to do, and the date moves', () => {
  const out = run(FIXTURE, [pr(50, 'First change'), pr(51, 'Second change')]);
  assert.deepEqual(out.added, [50, 51]);
  assert.ok(out.html.includes("    { status: 'done', what: 'First change', detail: '', pr: 50 },\n"));
  assert.ok(out.html.indexOf("what: 'Second change'") < out.html.indexOf("what: 'Waiting'"), 'before the review row');
  assert.ok(out.html.includes("  updated: '10 Mar 2030',\n"));
  assert.equal(out.highest, 51);
});

test('a lower-numbered pull request that merged late is added: rows are chosen by merge date, not by number', () => {
  const out = run(FIXTURE, [pr(15, 'Opened early, merged late')]);
  assert.deepEqual(out.added, [15]);
  assert.equal(out.highest, 40, 'the highest number on the board does not go down');
});

test('the look-back is 14 days: a minute inside is added, a minute outside is not', () => {
  assert.equal(board.lookBackDay(TODAY), '2030-02-24');
  const inside = pr(50, 'Inside', { mergedAt: '2030-02-24T00:00:00Z' });
  const outside = pr(51, 'Outside', { mergedAt: '2030-02-23T23:59:00Z' });
  assert.deepEqual(run(FIXTURE, [inside, outside]).added, [50]);
});

test('a hand-made status pull request that moved the date does not hide pull requests that were never added', () => {
  // Same board, but a person has set `updated` to the 9th: the look-back still reaches back from today.
  const moved = FIXTURE.replace("'3 Mar 2030'", "'9 Mar 2030'");
  assert.deepEqual(run(moved, [pr(50, 'Merged on the 5th')]).added, [50]);
});

test('pull requests already on the board, status pull requests and the bot’s own board pull requests are skipped', () => {
  const skipped = [
    pr(20, 'Already there'),
    pr(51, 'Status, 12 Nov: caught up'),
    pr(52, 'Catching up the notes', { files: [{ path: '.agents/STATUS.md' }, { path: 'docs/build-progress/build-board.html' }] }),
    pr(53, 'Board: merged up to #1 (x)'),
    pr(54, 'Some new title from the bot', { headRefName: 'bot/board' }),
  ];
  const out = run(FIXTURE, skipped);
  assert.deepEqual(out.added, []);
  assert.equal(out.html, FIXTURE, 'nothing changes, not even the date');
});

test('bot authors, dependency-update branches and "Bump" titles are skipped; reverts are kept', () => {
  const prs = [
    pr(51, 'Update a thing', { author: { login: 'dependabot[bot]', is_bot: true } }),
    pr(52, 'Update another', { author: { login: 'some-app[bot]' } }),
    pr(53, 'Update a third', { author: { login: 'x', is_bot: true } }),
    pr(54, 'Fix a dependency', { headRefName: 'dependabot/npm_and_yarn/x' }),
    pr(55, 'Fix another dependency', { headRefName: 'renovate/x' }),
    pr(56, 'Bump jsdom from 1 to 2'),
    pr(57, 'Revert "Something that broke"'),
  ];
  assert.deepEqual(run(FIXTURE, prs).added, [57]);
});

test('a review row whose pull request merged is flipped to done, whatever the date it merged', () => {
  const out = run(FIXTURE, [], { mergedReview: [30] });
  assert.deepEqual(out.flipped, [30]);
  assert.ok(out.html.includes("{ status: 'done', what: 'Waiting', detail: 'z', pr: 30 }"));
  assert.ok(out.html.includes("  updated: '10 Mar 2030',\n"));
  assert.deepEqual(board.reviewNumbers(FIXTURE), [30]);
  assert.deepEqual(run(FIXTURE, [], { mergedReview: [999] }).flipped, [], 'a number with no review row flips nothing');
});

test('running it twice adds nothing the second time', () => {
  const prs = [pr(50, 'First change'), pr(15, 'Late one')];
  const once = run(FIXTURE, prs, { mergedReview: [30] });
  const twice = run(once.html, prs, { mergedReview: [30] });
  assert.equal(twice.html, once.html);
  assert.deepEqual(twice.added, []);
  assert.deepEqual(twice.flipped, []);
});

test('everything but the new rows, the flipped row and the date line is left byte for byte alone', () => {
  const out = run(FIXTURE, [pr(50, 'First change')], { mergedReview: [30] });
  const before = FIXTURE.split('\n');
  const after = out.html.split('\n').filter((l) => !l.includes("what: 'First change'"));
  assert.equal(after.length, before.length);
  const differ = after.map((l, i) => [before[i], l]).filter(([a, b]) => a !== b).map(([a]) => a.trim().split(',')[0]);
  assert.deepEqual(differ, ["updated: '3 Mar 2030'", "{ status: 'review'"]);
});

// A title is typed by anyone and lands inside a script block in a quoted string.
test('awkward titles stay one safe string: </script>, comments, backslashes, ${, quotes, newlines', () => {
  const titles = [
    'Close </script> early',
    'Open <!-- a comment',
    'back\\slash and trailing\\',
    'Template ${evil()} text and `ticks`',
    `It's "quoted" and it's 'single'`,
    'two\nlines\r\nand\ttabs',
    'line separator',
  ];
  const prs = titles.map((t, i) => pr(60 + i, t));
  const out = run(FIXTURE, prs);
  assert.equal(out.added.length, titles.length);
  assert.equal(out.html.split('</script>').length, 2, 'only the page’s own </script> is left');
  assert.ok(!out.html.includes('<!--'));
  titles.forEach((t, i) => assert.equal(whatOf(out.html, 60 + i), t.replace(/\s+/g, ' ').trim(), `title ${i}`));
});

test('the real board page parses and comes back unchanged when nothing is added, and still draws after a row is added', () => {
  const none = board.updateBoard(REAL, [], { today: TODAY });
  assert.equal(none.html, REAL);
  assert.deepEqual(none.added, []);
  const out = board.updateBoard(REAL, [pr(9999, 'A made-up row for the test')], { today: TODAY });
  const doc = new JSDOM(out.html, { runScripts: 'dangerously' }).window.document;
  for (const id of ['ov-tally', 'tally', 'screens', 'pieces', 'asks', 'journeys']) {
    assert.ok(doc.getElementById(id).children.length > 0, `#${id} has nothing in it`);
  }
  assert.ok(doc.getElementById('pieces').textContent.includes('A made-up row for the test'));
});

// The nightly run rebuilds one fixed branch from main so rows never double up
// while an earlier pull request is still open.
test('the workflow rebuilds one fixed branch from main each night and updates its pull request', () => {
  assert.ok(WORKFLOW.includes('bot/board'), 'one fixed branch');
  assert.ok(!/bot\/board-/.test(WORKFLOW), 'no per-day branch names');
  assert.ok(/git push --force origin HEAD:bot\/board/.test(WORKFLOW), 'force-pushes the rebuilt branch');
  assert.ok(/gh pr list --head bot\/board/.test(WORKFLOW), 'looks for an open pull request first');
  assert.ok(/gh pr edit/.test(WORKFLOW), 'updates the title of an open one');
  assert.ok(/gh pr create/.test(WORKFLOW), 'opens one when there is none');
  assert.ok(/gh pr close/.test(WORKFLOW), 'closes the open one when nothing differs from main');
  assert.ok(/ref: main/.test(WORKFLOW), 'starts from main');
});
