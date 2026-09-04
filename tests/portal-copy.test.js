import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { JOB_STATUSES } from '../server/server.js';

// public-portal/copy.js is a plain browser script, not a module - it is
// loaded by a <script> tag alongside portal.js, the same no-build-step
// approach the rest of the portal uses. Evaluating it in a vm context is
// how this test reads it without a bundler or a DOM.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPortalCopy() {
  const src = readFileSync(path.join(root, 'public-portal/copy.js'), 'utf8');
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(src, context);
  return context.PortalCopy;
}

// The point of this test. A customer must never be shown a raw database
// enum: 'waiting_parts' and 'on_hold' are the two that read worst. Adding a
// sixth status to JOB_STATUSES server-side without giving it customer-facing
// words should fail here rather than ship an underscore to a customer.
test('every job status the server can set has customer-facing words', () => {
  const copy = loadPortalCopy();
  const missing = JOB_STATUSES.filter((s) => !copy.JOB_STATUS[s]);
  assert.deepEqual(missing, [], 'job statuses with no customer-facing copy');
});

test('every status label is prose, not the enum value', () => {
  const copy = loadPortalCopy();
  for (const status of JOB_STATUSES) {
    const { label } = copy.JOB_STATUS[status];
    assert.ok(label, `${status} has no label`);
    assert.ok(!label.includes('_'), `${status} label still contains an underscore: ${label}`);
    assert.notEqual(label, status, `${status} label is just the enum value`);
  }
});

test('every status explains itself in one line', () => {
  const copy = loadPortalCopy();
  for (const status of JOB_STATUSES) {
    const { explanation } = copy.JOB_STATUS[status];
    assert.ok(explanation, `${status} has no explanation`);
    assert.ok(explanation.length > 10, `${status} explanation is too short to help: ${explanation}`);
  }
});

// PORTAL_JOB_TYPES already carries minutes (30/60/120) and portal.js already
// uses them to fit-check - this is the formatting that puts them in front of
// the customer choosing the job.
test('durations are shown to customers in words, not raw minutes', () => {
  const copy = loadPortalCopy();
  assert.equal(copy.formatDuration(30), '30 minutes');
  assert.equal(copy.formatDuration(60), '1 hour');
  assert.equal(copy.formatDuration(120), '2 hours');
  assert.equal(copy.formatDuration(90), '1 hour 30 minutes');
});

test('no status copy leaks the word pending as a bare badge', () => {
  const copy = loadPortalCopy();
  // 'pending' is the status every new booking lands in, and it is the one a
  // customer is most likely to misread as "done". Its words must say who is
  // being waited on.
  const { label, explanation } = copy.JOB_STATUS.pending;
  assert.match(`${label} ${explanation}`.toLowerCase(), /shop|confirm/, 'pending copy must say the shop has to confirm');
});

test('an unknown status still never shows a customer an underscore', () => {
  const copy = loadPortalCopy();
  const fallback = copy.statusFor('awaiting_collection');
  assert.ok(!fallback.label.includes('_'), `fallback label kept the underscore: ${fallback.label}`);
  assert.equal(fallback.label, 'Awaiting collection');
});

test('statusFor returns the real copy for a known status', () => {
  const copy = loadPortalCopy();
  assert.equal(copy.statusFor('scheduled').label, copy.JOB_STATUS.scheduled.label);
});

// ---- Status badges must be visible, not just worded ----

test('every job status has a badge style, not just badge words', () => {
  // styles.css had .badge.status-pending only, so 'Waiting to be confirmed'
  // rendered as a lilac pill and the other four as bare text. The tokens for
  // all five already exist (the staff diary's .job-card.status-* uses them)
  // and design-contrast.test.js already gates them for AA.
  const css = readFileSync(path.join(root, 'public/styles.css'), 'utf8');
  const missing = JOB_STATUSES.filter((s) => !css.includes(`.badge.status-${s}`));
  assert.deepEqual(missing, [], 'job statuses with no badge styling');
});

test('badge styles use status tokens rather than raw colours', () => {
  const css = readFileSync(path.join(root, 'public/styles.css'), 'utf8');
  for (const status of JOB_STATUSES) {
    const rule = css.slice(css.indexOf(`.badge.status-${status}`));
    const line = rule.slice(0, rule.indexOf('}'));
    assert.match(line, new RegExp(`--status-${status}-bg`), `${status} badge does not use its own bg token`);
    assert.match(line, new RegExp(`--status-${status}-ink`), `${status} badge does not use its own ink token`);
  }
});

// ---- Dates ----

test('My Bookings formats dates instead of printing raw ISO', () => {
  // The portal already has fmtDateLabel() and uses it everywhere else;
  // renderMyBookingsView printed b.jobDate straight, so a customer read
  // "2026-09-11" instead of "Fri, 11 Sep".
  const js = readFileSync(path.join(root, 'public-portal/portal.js'), 'utf8');
  assert.ok(!js.includes('esc(b.jobDate)'), 'My Bookings still renders the raw ISO date');
});

// ---- The two views that had no words at all ----

test('the diary legend explains every state the grid can show', () => {
  const copy = loadPortalCopy();
  // Arrays come back from the vm context in another realm, so compare
  // values rather than structures - deepEqual would fail on the prototype.
  const keys = Array.from(copy.DIARY_LEGEND, (entry) => entry.key).sort().join(',');
  assert.equal(keys, 'busy,closed,free,full');
  for (const entry of copy.DIARY_LEGEND) {
    assert.ok(entry.label && entry.label.length > 3, `legend entry ${entry.key} has no usable label`);
  }
});

test('a guest gets a confirmation they can read, not just a toast', () => {
  // A signed-in customer at least lands on My Bookings. A guest was sent
  // back to the picker with no record that anything had happened.
  const copy = loadPortalCopy();
  assert.ok(copy.BOOKING_CONFIRMED.heading, 'no confirmation heading');
  assert.ok(copy.BOOKING_CONFIRMED.guest.length > 20, 'guest confirmation says too little');
  assert.ok(copy.BOOKING_CONFIRMED.account.length > 20, 'account confirmation says too little');
  // Neither may promise contact the software does not itself make.
  for (const line of [copy.BOOKING_CONFIRMED.guest, copy.BOOKING_CONFIRMED.account]) {
    assert.ok(!/we('| wi)ll (call|ring|text|email)/i.test(line), `confirmation promises contact the system does not make: ${line}`);
  }
});
