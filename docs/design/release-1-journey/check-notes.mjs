// Asserts Jack's 17 September review notes have been applied to the atlas.
// Source of the notes: docs/reviews/2026-09-17-release-1-screen-review-jack.md
// Run after: python3 package.py && node check-static.mjs
import { JSDOM, VirtualConsole } from '../../../prototype/node_modules/jsdom/lib/api.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = new URL('./', import.meta.url), path = n => new URL(n, url);
const index = JSON.parse(await readFile(path('screen-index.json'), 'utf8'));
const source = (await readFile(path('screens.js'), 'utf8'))
  + (await readFile(path('branches.js'), 'utf8'));
const rawBarcode = await readFile(path('tag-bars.svg'), 'utf8').catch(() => '');

const byId = id => {
  const screen = index.find(s => s.id === id);
  assert.ok(screen, `No screen with id "${id}"`);
  return screen;
};

// Some markup is computed at render time (a class built from a template
// expression, for example), so it never appears literally in the source.
// renderedOf gives the screen's actual HTML, the way check-static.mjs does.
const vc = new VirtualConsole();
const atlas = new JSDOM(await readFile(path('Wheelhouse-Release-1-Journey-Atlas.html'), 'utf8'), {
  runScripts: 'dangerously', url: 'https://atlas.example/', virtualConsole: vc,
  beforeParse(w) {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true };
    w.HTMLDialogElement.prototype.close = function () { this.open = false };
    w.HTMLElement.prototype.scrollTo = function () {};
    w.HTMLElement.prototype.scrollIntoView = function () {};
  },
});
const renderedOf = id => atlas.window.doc(atlas.window.eval('screens').find(s => s.id === id));

// The add(...) call for one screen: from add('<id>' up to the next add(' at line start.
const sourceOf = id => {
  const start = source.indexOf(`add('${id}'`);
  assert.ok(start > -1, `No add() call for "${id}"`);
  const next = source.indexOf("\nadd('", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
};

// Note 82 — a customer may have several bikes, so the record needs a bike chooser.
{
  const body = sourceOf('customer-record');
  assert.match(body, /<select/, 'customer-record has no <select> for choosing a bike');
  assert.match(body, /bike/i, 'customer-record bike chooser is not identifiable as a bike chooser');
}

// Note 01 — "individual service" opens a second page of detailed options,
// grouped under shop-defined categories.
{
  const list = byId('service-list');
  assert.equal(list.group, 'book', 'service-list belongs in the booking chapter');
  assert.equal(list.next, 'problem', 'service-list continues into the existing journey');
  assert.match(sourceOf('service'), /parent\.jump\('service-list'\)/,
    'the service screen does not offer a route to the detailed list');
  const body = sourceOf('service-list');
  for (const category of ['Wheels', 'Brakes', 'Drivetrain']) {
    assert.match(body, new RegExp(category, 'i'), `service-list has no "${category}" category heading`);
  }
}

// Note 68 — the shop edits the inspection checklist and chooses how many
// customer questions a service asks.
{
  const body = sourceOf('service-edit');
  assert.match(body, /checklist/i, 'service-edit does not expose the inspection checklist');
  assert.match(body, /Add (another )?question/i, 'service-edit cannot add a customer question');
  assert.match(body, /Remove|Delete|✕/, 'service-edit cannot remove a customer question');
}

// Notes 03 and 70 — booking mode is a shop setting with three options, and
// appointment-only shops still absorb walk-ins through an untimed shared queue.
{
  const body = sourceOf('booking-settings');
  for (const mode of ['Drop-off days only', 'Exact appointments only', 'Both \u2014 customer chooses']) {
    assert.ok(body.includes(mode), `booking-settings is missing the "${mode}" mode`);
  }
  assert.match(body, /shared queue/i,
    'booking-settings does not say what happens to a walk-in under appointment-only');
}

// Note 03 — the customer sees whichever mode the shop chose, not both by default.
{
  assert.match(sourceOf('date'), /your shop|the shop|set by/i,
    'the date screen does not explain that the shop controls this choice');
}

// Note 38 — the week view matches the one already built in public/app.js:
// a per-mechanic split grid with week navigation and a default-view preference.
{
  const body = sourceOf('week');
  assert.match(body, /Prev|\u2039/, 'week view has no previous-week control');
  assert.match(body, /This week/i, 'week view has no this-week control');
  assert.match(body, /Next|\u203a/, 'week view has no next-week control');
  assert.match(body, /mechanic/i, 'week view is not split by mechanic');
  assert.match(body, /default/i, 'week view offers no way to set a default diary view');
}

// Note 39 — month cells say "full" or "space available" AND are colour-coded.
{
  const body = sourceOf('month');
  assert.match(body, /Full/, 'month view never says "Full"');
  assert.match(body, /Space available/i, 'month view never says "Space available"');
  const rendered = renderedOf('month');
  for (const cls of ['monthcell full', 'monthcell some', 'monthcell free']) {
    assert.ok(rendered.includes(cls), `month view is missing the "${cls}" state`);
  }
}

// Note 44 — the appointment picker shows the diary with taken slots blocked out,
// as public-portal/portal.js already does.
{
  const rendered = renderedOf('appointment');
  assert.match(rendered, /class="slot taken"/,
    'appointment screen does not mark any slot as taken');
  assert.match(rendered, /<button class="slot taken"[^>]*\bdisabled\b/,
    'taken slots are rendered but not actually unselectable');
  assert.doesNotMatch(rendered, /<button class="slot chosen"[^>]*\bdisabled\b/,
    'a selectable slot was disabled');
  assert.match(rendered, /checked again|confirmed when you submit/i,
    'appointment screen does not warn that availability is re-checked on submit');
}

// Note 11 — Code 128 barcode instead of a QR, and the shop picks the headline.
{
  const body = sourceOf('print');
  assert.match(body, /__BARS__/, 'the tag does not carry the barcode token');
  assert.doesNotMatch(body, /__QR__/, 'the tag still carries the QR specimen');
  assert.match(body, /Code 128/, 'the tag screen does not name the barcode symbology');
  assert.match(body, /WH-1042/, 'the tag no longer shows the readable job number fallback');

  // Honesty gate: until the scanner proof (P00b), the specimen must say it does
  // not scan, in the screen note and in the image's own accessible name.
  const svg = rawBarcode;
  assert.match(svg, /not .{0,20}scan|non-scanning/i,
    'the barcode SVG does not declare itself a non-scanning specimen');
  assert.match(body, /not .{0,20}scan|non-scanning/i,
    'the print screen note does not declare the barcode a non-scanning specimen');
}

// The shop chooses what the tag headline shows.
{
  const body = sourceOf('printer-settings');
  for (const option of ['Job number', 'Customer name', 'Bike']) {
    assert.ok(body.includes(option), `tag headline choice is missing "${option}"`);
  }
}

atlas.window.close();
console.log('check-notes: all applied-note assertions passed');
