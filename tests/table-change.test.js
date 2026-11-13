// Tests that change a shared table (a check, a trigger) do it through
// changeTable (tests/helpers/table-change.js). A change waits for the strongest
// lock on its table, and while it waits every new write to that table queues
// behind it: the app's own short lock waits (2 s for stock) ran out, and
// delivery tests in other files were told "Wheelhouse is busy" (12 Nov).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { changeTable } from './helpers/table-change.js';

const T = `zz_table_change_${process.pid}`;
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });
after(async () => {
  await pool.query(`DROP TABLE IF EXISTS ${T}`);
  await pool.end();
});

test('a change waiting on a busy table doesn\'t hold up a write with a short lock wait, and lands once the table is free', async () => {
  await pool.query(`DROP TABLE IF EXISTS ${T}; CREATE TABLE ${T} (n int)`);
  // A long reader, as another test file's open transaction.
  const reader = await pool.connect();
  let changing;
  try {
    await reader.query('BEGIN');
    await reader.query(`SELECT * FROM ${T}`);
    changing = changeTable(pool, `ALTER TABLE ${T} ADD CONSTRAINT ${T}_probe CHECK (n <> -1) NOT VALID`);
    await pause(300);
    const writer = await pool.connect();
    try {
      await writer.query('BEGIN');
      await writer.query("SET LOCAL lock_timeout = '2s'");
      await writer.query(`INSERT INTO ${T} VALUES (1)`);
      await writer.query('COMMIT');
    } catch (err) {
      await writer.query('ROLLBACK');
      assert.fail(`the write waited behind the change: ${err.code} ${err.message}`);
    } finally {
      writer.release();
    }
    await pause(300);
  } finally {
    await reader.query('COMMIT');
    reader.release();
  }
  await changing;
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = '${T}_probe'`);
  assert.equal(rows[0].n, 1, 'the change landed');
  // The connection's own lock wait is as it was.
  const { rows: [{ lock_timeout: wait }] } = await pool.query('SHOW lock_timeout');
  assert.notEqual(wait, '100ms');
});

test('a change that fails for another reason fails at once, saying why', async () => {
  const began = Date.now();
  await assert.rejects(changeTable(pool, 'ALTER TABLE zz_no_such_table_at_all ADD COLUMN x int'), /does not exist/);
  assert.ok(Date.now() - began < 2000);
});
