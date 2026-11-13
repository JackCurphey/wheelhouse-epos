// A change to a shared table from a test (adding a check or a trigger, or
// taking one away), without holding up other test files.
//
// Such a change needs a strong lock on its table, so it waits for every open
// transaction there to finish. While it waits, every new write to that table
// queues behind it. The app's own lock waits are short (2 s for stock), so on a
// busy full run other files' requests were told "Wheelhouse is busy": three
// delivery files at once on 12 Nov, behind db-transaction-scope's check on
// stock_movements. So a change waits at most 100 ms at a time and tries again
// until it gets in: writers then wait 100 ms at most.
//
// The three statements go as one query, which Postgres runs as one transaction
// on one connection, so this works with a pool or a single client. If the
// change can't get its lock, the setting rolls back with it.

const WAIT = '100ms';
const AGAIN_AFTER_MS = 50;
const GIVE_UP_AFTER_MS = 60_000;

export async function changeTable(db, sql) {
  const end = Date.now() + GIVE_UP_AFTER_MS;
  for (;;) {
    try {
      return await db.query(`SET lock_timeout = '${WAIT}'; ${sql}; RESET lock_timeout`);
    } catch (err) {
      if (err.code !== '55P03' || Date.now() > end) throw err;
      await new Promise((r) => { setTimeout(r, AGAIN_AFTER_MS); });
    }
  }
}
