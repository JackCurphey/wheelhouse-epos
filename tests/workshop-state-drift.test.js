// tests/workshop-state-drift.test.js
//
// The database's CHECK constraints are generated from the state machines, then
// committed as ordinary migration text. That gives reviewable, static SQL, but
// it also means the two can drift: add a state to a machine, forget the
// migration, and the model allows something the database rejects at 2am.
//
// This test re-generates each constraint and looks for it, verbatim, in the
// migration that is supposed to carry it. It does not query the database - it
// compares the model against the committed SQL, so it fails the moment a
// machine changes, not the moment a row is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkConstraint, MIGRATION_COLUMNS } from '../server/workshop/render-constraints.mjs';

test('checkConstraint renders a machine as SQL', () => {
  const machine = { name: 'x', states: ['a', 'b'] };
  assert.equal(checkConstraint(machine, 'x_state'),
    "CHECK (x_state IN ('a', 'b'))");
});

test('every machine constraint appears verbatim in its migration', async () => {
  for (const { machine, column, migration } of MIGRATION_COLUMNS) {
    const sql = await readFile(new URL(`../server/migrations/${migration}`, import.meta.url), 'utf8');
    const expected = checkConstraint(machine, column);
    assert.ok(sql.includes(expected),
      `${migration} does not contain the current constraint for ${machine.name}.\n`
      + `Expected to find:\n  ${expected}\n`
      + `Regenerate with: node server/workshop/render-constraints.mjs`);
  }
});
