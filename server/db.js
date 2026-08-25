// Database layer for the bike shop EPOS - PostgreSQL via `pg`, shared across
// every shop. Shop isolation is enforced by Postgres Row-Level Security, not
// by application code: every shop-scoped table has a `shop_id` column with a
// policy that filters on `current_setting('app.current_shop_id')`, which is
// SET once per request (see runWithShop below) on a client checked out from
// the pool for that request's whole lifetime. A forgotten WHERE clause can
// never leak another shop's rows - the database refuses to return or accept
// them.
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool, types } = pg;

// NUMERIC (money columns) and BIGINT (what COUNT()/SUM() over an integer
// column return) both come back from `pg` as strings by default, to avoid
// silent precision loss for values too large for a JS number. The app
// already treats these as plain JS numbers everywhere (Math.round(x*100)/100
// patterns, dashboard counts/quantities, etc.) and none of them can
// realistically exceed Number.MAX_SAFE_INTEGER for a bike shop's data, so
// convert once here rather than at every read site.
const NUMERIC_OID = 1700;
const BIGINT_OID = 20;
types.setTypeParser(NUMERIC_OID, (value) => (value === null ? null : parseFloat(value)));
types.setTypeParser(BIGINT_OID, (value) => (value === null ? null : parseInt(value, 10)));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  // Explicit opt-in rather than guessed from the hostname - guessing from
  // "localhost"/"127.0.0.1" broke as soon as the app started reaching
  // Postgres by its Docker Compose service name ("postgres") instead, which
  // is equally SSL-less but doesn't match that pattern. Managed cloud
  // Postgres providers generally require SSL, so set PGSSL=require in
  // DATABASE_URL's environment when eventually pointing at one.
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: true } : false,
});

// Holds the single `pg` client checked out for whichever request is
// currently being handled (see runWithShop). `prepare()`/`exec()` below read
// this on every call so the ~150 `db.prepare(...)`/`db.exec(...)` call sites
// throughout server.js don't need a db argument threaded through them -
// mirrors the shape of the previous per-shop-file design exactly, just
// backed by a checked-out pooled client instead of a DatabaseSync instance.
export const dbContext = new AsyncLocalStorage();

function currentClient() {
  const client = dbContext.getStore();
  if (!client) throw new Error('No database client in scope for this request');
  return client;
}

// Translates SQLite-style `?` positional placeholders to Postgres `$1, $2,
// ...`. Safe here because none of the app's SQL strings contain a literal
// `?` character inside a string literal.
function toPgPlaceholders(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// Bare `INSERT INTO ...` statements get `RETURNING id` auto-appended so
// `.run()` can still expose `.lastInsertRowid` (the node:sqlite equivalent)
// without every one of the ~15 call sites needing to add RETURNING by hand.
// The one exception is customer_group_members, which has no `id` column -
// its INSERT already carries its own explicit ON CONFLICT clause and never
// reads `.lastInsertRowid`, so it's excluded here.
function needsReturningId(sql) {
  return /^\s*INSERT\s+INTO\s+(?!customer_group_members)/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

// Mirrors node:sqlite's DatabaseSync `db.prepare(sql).get/all/run(...)`
// shape, so existing call sites mostly just need `await` added - see
// server.js/auth.js for the mechanical pass that did that.
export function prepare(sql) {
  const pgSql = toPgPlaceholders(sql);
  const runSql = needsReturningId(sql) ? `${pgSql} RETURNING id` : pgSql;
  return {
    async get(...params) {
      const { rows } = await currentClient().query(pgSql, params);
      return rows[0];
    },
    async all(...params) {
      const { rows } = await currentClient().query(pgSql, params);
      return rows;
    },
    async run(...params) {
      const { rows, rowCount } = await currentClient().query(runSql, params);
      return { lastInsertRowid: rows[0]?.id, changes: rowCount };
    },
  };
}

// For raw statements that don't fit the get/all/run shape - BEGIN / COMMIT /
// ROLLBACK, mainly. Runs on the same request-scoped client as prepare()
// above, so it participates in the same transaction.
export async function dbExec(sql) {
  await currentClient().query(sql);
}

// Checks out one dedicated client from the pool for the duration of a
// request (never a shared/pool-wide query - Postgres transactions require a
// single connection throughout BEGIN...COMMIT/ROLLBACK), sets the RLS
// session variable on it once, and always releases it back to the pool when
// the request finishes, even on error. Concurrent requests - whether for the
// same shop or different shops - each get their own client, so they never
// share (or race on) `app.current_shop_id`.
export async function runWithShop(shopId, fn) {
  const client = await pool.connect();
  try {
    // SET doesn't accept bind parameters (it's a syntax error, not just
    // unsupported) - set_config() is the parameterized equivalent.
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    return await dbContext.run(client, fn);
  } finally {
    client.release();
  }
}
