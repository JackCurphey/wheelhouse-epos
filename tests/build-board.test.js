// The build board (docs/build-progress/build-board.html, published as Jack's
// and Mark's shared artifact) draws everything from its BOARD block with one
// script. On 20 Oct an unescaped apostrophe ("shop's") inside a quoted line
// broke that script and the whole board showed nothing; this loads the page
// as a browser would and checks every part drew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../docs/build-progress/build-board.html', import.meta.url), 'utf8');

test('the build board’s script runs and every section has content', () => {
  const doc = new JSDOM(html, { runScripts: 'dangerously' }).window.document;
  for (const id of ['updated', 'ov-now', 'lead', 'sub']) assert.ok(doc.getElementById(id).textContent.trim(), `#${id} is empty`);
  for (const id of ['ov-tally', 'ov-wait', 'ov-mark', 'ov-next', 'tally', 'screens', 'pieces', 'asks', 'journeys']) {
    assert.ok(doc.getElementById(id).children.length > 0, `#${id} has nothing in it`);
  }
});

// Slices instead of stages (Jack, 27 Oct: "Instead of having the stages and
// the percentage we are through the current stage, we'll just have slices
// instead"). Release 2 is built in six slices, A to F (Mark's replan, #499,
// accepted 26 Oct). Each slice's bar is worked out from its own items, done
// counting 1 and partly done half; the summary line is worked out from the
// slices' states. Never typed in.
test('the board shows Release 2 as six slices, each with its own bar', () => {
  const doc = new JSDOM(html, { runScripts: 'dangerously' }).window.document;
  assert.ok(doc.getElementById('ov-project-bar') === null, 'the whole-project bar is gone');
  assert.ok(doc.getElementById('ov-stage-bar') === null, 'the stage bar is gone');
  const cards = [...doc.querySelectorAll('#ov-slices > li')];
  assert.deepEqual(cards.map((c) => c.dataset.letter), ['A', 'B', 'C', 'D', 'E', 'F']);
  const LABELS = { build: 'Being built', next: 'Next', later: 'Later', played: 'Played' };
  for (const card of cards) {
    const rows = [...card.querySelectorAll('details li[data-status]')];
    assert.ok(rows.length > 0, `slice ${card.dataset.letter} lists its items`);
    const count = (s) => rows.filter((li) => li.dataset.status === s).length;
    assert.equal(count('done') + count('part') + count('todo'), rows.length, 'every item is done, part or todo');
    const pct = Math.round(((count('done') + count('part') / 2) / rows.length) * 100);
    const bar = card.querySelector('[role="progressbar"]');
    assert.equal(bar.getAttribute('aria-valuenow'), String(pct), `slice ${card.dataset.letter}'s bar`);
    assert.equal(bar.firstElementChild.style.width, `${pct}%`);
    assert.equal(card.querySelector('.pill').textContent, LABELS[card.dataset.state]);
    assert.match(card.textContent, /You can play: /);
  }
  // The summary line follows the states, not typed text.
  const name = (s) => cards.filter((c) => c.dataset.state === s).map((c) => c.dataset.letter);
  const join = (ls) => ls.length > 1 ? `${ls.slice(0, -1).join(', ')} and ${ls.at(-1)}` : ls[0];
  const phrase = (ls, words) => ls.length ? [`${join(ls)} ${ls.length > 1 ? 'are' : 'is'} ${words}`] : [];
  const parts = [...phrase(name('build'), 'being built'), ...phrase(name('next'), 'next')];
  const n = cards.length;
  const expected = `Release 2 in ${n} slices${parts.length ? `: ${parts.join(', ')}` : ''} · ${name('played').length} of ${n} played`;
  assert.equal(doc.getElementById('ov-slices-sum').textContent, expected);
  // Every work package is in a slice or in the Not in a slice fold, once.
  const ids = [...doc.querySelectorAll('#ov-slices li[data-id], #ov-outside li[data-id]')].map((li) => li.dataset.id);
  assert.equal(new Set(ids).size, ids.length, 'no package twice');
  assert.equal(ids.length, 38, 'all 38 work packages');
  assert.ok(doc.querySelectorAll('#ov-outside li').length === 8, 'eight packages in no slice');
});

// Release 2 overall (Jack, 29 Oct, "count every item"): the slice bar's rule
// applied to every item in slices A to F together, done counting 1 and partly
// done half. Worked out from the slice cards' own rows, never typed in.
test('the overall figure counts every item in every slice', () => {
  const doc = new JSDOM(html, { runScripts: 'dangerously' }).window.document;
  const line = doc.getElementById('ov-slices-overall');
  assert.ok(line, 'the overall line is there');
  const rows = [...doc.querySelectorAll('#ov-slices > li details li[data-status]')];
  assert.deepEqual([...new Set([...doc.querySelectorAll('#ov-slices > li')].map((c) => c.dataset.letter))], ['A', 'B', 'C', 'D', 'E', 'F']);
  const count = (s) => rows.filter((li) => li.dataset.status === s).length;
  const [done, part, todo] = [count('done'), count('part'), count('todo')];
  const pct = Math.round(((done + part / 2) / rows.length) * 100);
  assert.equal(line.textContent, `Release 2 overall: about ${pct}% · ${done} done, ${part} partly done, ${todo} to do across all slices`);
  // The bar sits after the line and before the slice cards.
  const bar = line.nextElementSibling;
  assert.ok(bar.classList.contains('bar'), 'the bar follows the line');
  assert.ok(bar.nextElementSibling === doc.getElementById('ov-slices'), 'the slice cards follow the bar');
  assert.ok(line.previousElementSibling === doc.getElementById('ov-slices-sum'), 'the line follows the summary');
  assert.equal(bar.getAttribute('role'), 'progressbar');
  assert.equal(bar.getAttribute('aria-label'), 'Release 2 overall');
  assert.equal(bar.getAttribute('aria-describedby'), 'ov-slices-overall');
  assert.equal(bar.getAttribute('aria-valuemin'), '0');
  assert.equal(bar.getAttribute('aria-valuemax'), '100');
  assert.equal(bar.getAttribute('aria-valuenow'), String(pct));
  assert.equal(bar.firstElementChild.style.width, `${pct}%`);
});

