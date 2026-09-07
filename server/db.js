// Database layer for the bike shop EPOS - PostgreSQL via `pg`, shared across
// every shop. Shop isolation is enforced by Postgres Row-Level Security, not
// by application code: every shop-scoped table has a `shop_id` column with a
// policy that filters on `current_setting('app.current_shop_id')`, which is
// SET once per request (see runWithShop below) on a client checked out from
// the pool for that request's whole lifetime. A forgotten WHERE clause can
// never leak another shop's rows - the database refuses to return or accept
// them.
//
// DEPLOYMENT CONSTRAINT - read before putting a connection pooler in front
// of this app.
//   DB_TENANT_SCOPE=session (the default, and what ships today) makes
//   `app.current_shop_id` a SESSION-scoped Postgres setting. That is only
//   safe when one checked-out client means one dedicated backend for the
//   whole request, i.e. a direct connection or a SESSION-mode pooler.
//   A TRANSACTION-mode pooler (PgBouncer's transaction mode and most managed
//   equivalents) may hand the same backend to two overlapping requests, and
//   one shop's tenant setting then becomes another's. Transaction pooling
//   requires DB_TENANT_SCOPE=transaction, which is NOT yet ready to be the
//   default - see the note on runWithShop below. assertPoolerModeSafe()
//   detects the unsafe combination at boot rather than leaving it to be
//   discovered in production.
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
  // Without this, pool.connect() (and pool.query(), which checkDatabaseHealth
  // and every runWithShop scope use) QUEUES INDEFINITELY once all `max`
  // clients are checked out, instead of failing. That is exactly the
  // steady-state failure this app's own deferred Shopify pushes can cause:
  // pushInventoryLevel's withRetry can hold a connection for up to ~15.15s
  // per attempt chain (see server/shopify.js), and a few concurrent slow
  // pushes can exhaust all 10. Without a bound, /healthz can't report that -
  // instead of a fast 503 it hangs, the orchestrator's own probe timeout
  // fires, the pod gets restarted, and any in-flight push dies with it.
  // 5s matches SHOPIFY_API_TIMEOUT_MS (server/shopify.js) - long enough that
  // a healthy request briefly queued behind a normal burst isn't punished,
  // short enough that a genuinely exhausted pool surfaces as a bounded
  // request failure well within any reasonable orchestrator probe timeout.
  connectionTimeoutMillis: 5000,
});

// pg-pool emits 'error' on the POOL (not the individual client) whenever an
// IDLE client's underlying connection dies - a Postgres restart, a failover,
// a load balancer resetting a TCP connection, a cloud provider recycling a
// connection. None of that is exceptional; it is an ordinary fact of running
// against a network database, and it happens to a connection nobody is
// currently using. node-postgres's own docs call this out explicitly and
// recommend exactly this: log it and do nothing else. The pool has already
// removed the dead client by the time this fires and creates a replacement
// on the next checkout; every OTHER client currently in use by another
// request is unaffected.
//
// This is PRE-EXISTING and this branch did not cause or worsen it. Before
// the crash guard installed elsewhere on this branch (server/server.js:
// installCrashGuard), Node's own default behaviour for an uncaught exception
// was already to print a stack and exit(1) - a listener-less 'error' event is
// an EventEmitter throwing synchronously, which for a failure surfaced from
// an async socket event becomes an uncaught exception with nothing else in
// the picture. The crash guard turned that from an unexplained crash into a
// logged, deliberate exit(1); it did not change the outcome. Without this
// handler, that exit(1) takes down the ENTIRE shared multi-tenant process -
// every shop, not just whichever request happened to be near that
// connection - over a routine event that a bare `pg.Pool` is designed to
// recover from on its own. Do not add reconnection logic here: pg already
// replaces the client itself. Do not swallow this silently either - an
// operator needs to see it to tell "Postgres restarted" from "Postgres is
// down", and it is signal, not noise.
pool.on('error', (err) => {
  console.error('db: idle client connection error - pool continues with its other clients', err);
});

// ---------- Tenancy scope mode ----------

export const TENANT_SCOPE_MODES = ['session', 'transaction'];
const TENANT_SETTING = 'app.current_shop_id';

// Read per call rather than captured at import time, so a deployment can be
// reconfigured without reasoning about module load order, and so the tests
// can exercise both modes in one process. A typo is a hard error rather than
// a silent fallback to `session`: "trasnaction" quietly behaving as session
// is exactly the kind of misconfiguration this whole file exists to prevent.
//
// BLANK IS NOT A TYPO. `DB_TENANT_SCOPE=` in a .env file, or a bare
// `- DB_TENANT_SCOPE` in a compose file (which passes the variable through as
// an empty string when it is unset in the host environment), both arrive here
// as "". Treating that as an unrecognised value refused to boot an otherwise
// healthy deployment over a variable the operator never meant to set. Blank
// after trimming means "not configured", so it takes the default. A value
// that is present but wrong still fails loudly.
export function tenantScopeMode() {
  const configured = (process.env.DB_TENANT_SCOPE ?? '').trim().toLowerCase();
  const raw = configured === '' ? 'session' : configured;
  if (!TENANT_SCOPE_MODES.includes(raw)) {
    throw new Error(
      `DB_TENANT_SCOPE must be one of ${TENANT_SCOPE_MODES.join(', ')} - got ${JSON.stringify(raw)}`
    );
  }
  return raw;
}

// Holds the state of whichever request is currently being handled (see
// runWithShop): the single `pg` client checked out for it, which shop it is
// for, and how deep into nested transaction blocks it is. `prepare()`/
// `dbExec()` below read this on every call so the ~150 `db.prepare(...)`/
// `db.exec(...)` call sites throughout server.js don't need a db argument
// threaded through them - mirrors the shape of the previous per-shop-file
// design exactly, just backed by a checked-out pooled client instead of a
// DatabaseSync instance.
export const dbContext = new AsyncLocalStorage();

function currentState() {
  const state = dbContext.getStore();
  if (!state) throw new Error('No database client in scope for this request');
  return state;
}

function currentClient() {
  return currentState().client;
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

// ---------- Transaction nesting ----------

// dbExec is used for nothing but BEGIN / COMMIT / ROLLBACK anywhere in
// server/ (11 blocks, 33 statements, across server/server.js and
// server/team.js), which makes it the single place where transaction
// nesting can be handled once instead of at 33 call sites.
//
// Postgres has no nested BEGIN: a second BEGIN on a connection that is
// already in a transaction is a no-op with a warning. So before this shim, a
// handler's BEGIN/COMMIT/ROLLBACK block that happened to run inside another
// open transaction would silently borrow the outer boundary - its ROLLBACK
// discarding the outer block's work, its COMMIT making the outer block's
// work durable early. Nothing in the app nests today, but DB_TENANT_SCOPE=
// transaction opens an outer transaction around every request, and any new
// handler calling into an existing one would do the same. Mapping depth >= 1
// onto savepoints keeps every one of those 11 blocks a real boundary in both
// modes, with no call site changes.
//
// A rule for future handlers: do not open a savepoint per iteration of an
// unbounded loop. Each one costs a subtransaction, and Postgres degrades
// badly past ~64 of them per transaction. The 11 sites here are all
// straight-line, so this is a caution, not a current problem.
// Anything that opens, closes or manipulates a transaction has to go through
// the shim, because anything that reaches the connection directly moves the
// real transaction depth without moving `state.txDepth` with it. Matching only
// the bare verbs was the trap: `BEGIN TRANSACTION`, `START TRANSACTION`, `END`
// and `COMMIT WORK` are all ordinary, correct SQL that a future handler may
// well write, and every one of them used to fall straight through to a raw
// query and re-open the nested-BEGIN collapse this shim exists to close. All
// 11 sites today use the bare form, so there is no live bug - the point is
// that the shim is trap-proof for the next handler someone writes.
//
// TX_CONTROL is the wide net: everything it catches is handled or refused,
// never run raw. TX_BEGIN / TX_END are the forms the shim can faithfully map
// onto savepoints. The rest are refused rather than guessed at:
//   - SAVEPOINT / RELEASE / ROLLBACK TO: hand-rolled savepoints would collide
//     with the shim's own `sp_<n>` bookkeeping.
//   - AND CHAIN: closes one transaction and immediately opens another, which
//     no savepoint can imitate.
//   - BEGIN with isolation or read-only characteristics: a savepoint cannot
//     carry them, so honouring the statement at depth >= 1 is impossible and
//     silently ignoring it would be worse.
//   - PREPARE TRANSACTION / COMMIT PREPARED: two-phase commit, not in use.
const TX_CONTROL = /^\s*(?:BEGIN|START|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION)\b/i;
const TX_BEGIN = /^\s*(?:BEGIN|START)(?:\s+(?:WORK|TRANSACTION))?\s*;?\s*$/i;
const TX_END = /^\s*(COMMIT|END|ROLLBACK|ABORT)(?:\s+(?:WORK|TRANSACTION))?\s*;?\s*$/i;
const INVALID_SAVEPOINT = '3B001';

// For raw statements that don't fit the get/all/run shape - BEGIN / COMMIT /
// ROLLBACK, mainly. Runs on the same request-scoped client as prepare()
// above, so it participates in the same transaction.
export async function dbExec(sql) {
  if (!TX_CONTROL.test(sql)) {
    await currentClient().query(sql);
    return;
  }
  const state = currentState();
  if (TX_BEGIN.test(sql)) return beginScope(state);
  const end = TX_END.exec(sql);
  if (end) {
    // END and ABORT are Postgres's aliases for COMMIT and ROLLBACK.
    const word = end[1].toUpperCase();
    return endScope(state, word === 'END' ? 'COMMIT' : word === 'ABORT' ? 'ROLLBACK' : word);
  }
  throw new Error(
    `db: unsupported transaction-control statement passed to dbExec: ${JSON.stringify(sql.trim())}. ` +
      'Use a plain BEGIN / COMMIT / ROLLBACK so the savepoint shim can keep the nesting depth honest.'
  );
}

async function beginScope(state) {
  if (state.txDepth === 0) {
    await state.client.query('BEGIN');
    state.txDepth = 1;
    return;
  }
  // Names are never reused within a request, so a stale reference from an
  // unbalanced caller can never resolve to a live savepoint by accident.
  const name = `sp_${++state.savepointSeq}`;
  await state.client.query(`SAVEPOINT ${name}`);
  state.savepointStack.push(name);
  state.txDepth += 1;
}

// COMMIT/ROLLBACK with nothing left to close MUST NOT THROW. These calls sit
// in catch blocks that immediately re-throw the original error - createSale's
// post-COMMIT Shopify loop (server/server.js:1618-1624) is the live example -
// so raising a database error about savepoints here would replace the real
// failure with a misleading one. Log and no-op instead.
async function endScope(state, verb) {
  if (state.txDepth === 0) {
    console.warn(`db: ${verb} issued with no transaction open - ignored`);
    return;
  }
  if (state.txDepth === 1) {
    await state.client.query(verb);
    state.txDepth = 0;
    return;
  }

  const name = state.savepointStack.pop();
  state.txDepth -= 1;
  if (!name) {
    console.warn(`db: ${verb} issued for a savepoint that was already released - ignored`);
    return;
  }
  try {
    if (verb === 'COMMIT') {
      await state.client.query(`RELEASE SAVEPOINT ${name}`);
    } else {
      await state.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await state.client.query(`RELEASE SAVEPOINT ${name}`);
    }
  } catch (err) {
    if (err && err.code === INVALID_SAVEPOINT) {
      console.warn(`db: ${verb} target savepoint ${name} no longer exists - ignored`);
      return;
    }
    throw err;
  }
}

// ---------- Request scope ----------

// Checks out one dedicated client from the pool for the duration of a
// request (never a shared/pool-wide query - Postgres transactions require a
// single connection throughout BEGIN...COMMIT/ROLLBACK), sets the RLS
// variable on it once, and always releases it back to the pool when the
// request finishes, even on error. Concurrent requests - whether for the
// same shop or different shops - each get their own client, so they never
// share (or race on) `app.current_shop_id`.
//
// Two modes, chosen by DB_TENANT_SCOPE:
//
//   session (DEFAULT, and what ships) - `set_config(..., false)`, exactly
//     today's behaviour. The setting lives on the connection, so the release
//     path below has to clear it by hand; forgetting to was the bug this
//     change fixes.
//
//   transaction (OFF by default) - BEGIN, then `set_config(..., true)`, so
//     the tenant is scoped to the request's transaction and cannot outlive
//     it under any pooler. NOT safe to switch on yet: Shopify pushes with
//     retry (server/server.js:1618, :963), Twilio sends (:1330), the
//     storefront static/upload streaming branch (:3769, :3735) and
//     readJsonBody all run inside this scope today, and every route writes
//     its HTTP response with sendJson BEFORE the outer COMMIT would land.
//     Enabling it would hold row locks across third-party HTTP with backoff
//     and across slow-client I/O, and would make a commit failure
//     unreportable to a client already told it succeeded. Moving that work
//     out of this scope is the prerequisite, and is deliberately not part of
//     this change.
export async function runWithShop(shopId, fn) {
  const outer = dbContext.getStore();
  if (outer) {
    // Re-entering for the same shop is harmless and is what a helper calling
    // into another helper looks like - reuse the scope. Re-entering for a
    // DIFFERENT shop would silently run under the outer shop's tenant
    // setting and its transaction, which is the exact class of bug RLS is
    // here to make impossible. Refuse loudly.
    if (String(outer.shopId) !== String(shopId)) {
      throw new Error(
        `runWithShop re-entered for shop ${shopId} inside an active scope for shop ${outer.shopId}`
      );
    }
    return await fn();
  }

  const mode = tenantScopeMode();
  const client = await pool.connect();
  const state = {
    client,
    shopId: String(shopId),
    mode,
    txDepth: 0,
    savepointSeq: 0,
    savepointStack: [],
  };
  try {
    if (mode === 'transaction') {
      await client.query('BEGIN');
      state.txDepth = 1;
    }
    // SET doesn't accept bind parameters (it's a syntax error, not just
    // unsupported) - set_config() is the parameterized equivalent. The third
    // argument is is_local: true scopes the setting to the surrounding
    // transaction, false to the whole connection.
    await client.query(`SELECT set_config('${TENANT_SETTING}', $1, ${mode === 'transaction'})`, [state.shopId]);

    const result = await dbContext.run(state, fn);

    if (state.txDepth > 0) {
      if (mode === 'transaction') {
        // Committing the request's own outer transaction is the whole point
        // of this mode. A COMMIT also releases any savepoints an unbalanced
        // handler left open.
        await client.query('COMMIT');
      } else {
        // Session mode: runWithShop opened no transaction, so anything still
        // open is a handler that forgot to close its own block. Roll it back.
        // Committing work the handler never committed would be inventing a
        // decision it did not make, and it is how a half-finished sale would
        // become durable.
        console.warn('db: request finished with a transaction still open - rolling it back');
        await client.query('ROLLBACK');
      }
      state.txDepth = 0;
    }
    return result;
  } catch (err) {
    if (state.txDepth > 0) {
      // Never let the rollback's own failure replace the error that caused
      // it - the release path below will destroy the client if it is wedged.
      await client.query('ROLLBACK').catch(() => {});
      state.txDepth = 0;
    }
    throw err;
  } finally {
    await releaseClient(state);
  }
}

// A pooled client goes back into circulation for whichever shop asks next,
// so it has to leave here carrying nothing from this request: no open
// transaction, and no tenant setting. Both were leaking before this change -
// the next holder of the connection inherited the previous request's shop,
// and could read its uncommitted rows.
//
// This function MUST NOT REJECT, ever. It is called from runWithShop's
// `finally`, so a rejection here does not merely fail cleanup - it replaces
// the handler's original error with a cleanup error, and the real reason the
// request failed is gone. `client.release()` is a live source of that:
// node-postgres throws from release() on a client the pool has already
// removed after a connection-level error, which is exactly the situation in
// which a handler is most likely to be reporting something the operator needs
// to read. Every failure path below is therefore logged and swallowed.
async function releaseClient(state) {
  const { client } = state;
  let cleanupError = null;
  try {
    if (state.txDepth > 0) {
      await client.query('ROLLBACK');
      state.txDepth = 0;
    }
    // Blank rather than RESET/DISCARD ALL: DISCARD ALL would also throw away
    // prepared statements and every other per-connection nicety to solve a
    // problem one targeted set_config solves. Blank is safe because the RLS
    // policies cast this setting to int with no missing_ok fallback, so a
    // connection that reaches an RLS table without a tenant raises rather
    // than returning silently-empty results.
    await client.query(`SELECT set_config('${TENANT_SETTING}', '', false)`);
  } catch (err) {
    // Handing a client of unknown state back to the pool is worse than
    // losing it. Passing an error to release() makes node-postgres destroy
    // the connection instead of reusing it.
    console.error('db: could not reset a pooled client on release - destroying it', err);
    cleanupError = err;
  }

  try {
    // release(err) destroys the connection; release() returns it to the pool.
    if (cleanupError) client.release(cleanupError);
    else client.release();
  } catch (err) {
    // The client is already out of our hands either way, and there is nothing
    // left to fall back to. Log it and let the caller's own error stand.
    console.error('db: releasing a pooled client threw - ignoring so the original error survives', err);
  }
}

// ---------- Pooler safety guard ----------

// One-line policy switch. 'fail' refuses to boot on an unsafe combination;
// 'warn' logs and continues.
//
// 'fail' is a RECORDED DECISION, not a default that happened to be picked:
// the repo owner ruled on 6 September 2026 that the guard hard-fails rather
// than warns, on the grounds that customer data security is paramount. The
// failure being prevented is one shop's staff being served another shop's
// data on a recycled connection, and a server that refuses to start is a
// louder and cheaper failure than one that runs and quietly mixes tenants.
// It is an availability trade, and it has been made. Changing this constant
// to 'warn' reverses that decision and needs the owner's sign-off, not just
// a one-word edit.
const POOLER_GUARD_ON_UNSAFE = 'fail';

const POOLER_PROBE_SETTING = 'app.pooler_probe';

// How many clients are checked out concurrently per round. More clients means
// more distinct pairs that have to land on distinct backends, which is the
// only thing that improves this probe's sensitivity (see the asymmetry note
// below). Kept comfortably under the pool's max of 10 so the probe cannot
// starve anything else that needs a connection while it runs.
const POOLER_PROBE_CLIENTS = 4;

// Detects a connection-multiplexing pooler by observation, not by guessing
// from a hostname. Several clients are checked out CONCURRENTLY, each is
// given its own nonce as a session variable, and each is then asked to read
// the setting back. On a direct connection (or a session-mode pooler) every
// client is its own backend and reads its own nonce. If any client reads a
// nonce that is not its own, or if any two report the same pg_backend_pid,
// they are sharing a backend and a request's session state is not its own.
//
// WHAT THIS PROBE CAN AND CANNOT ESTABLISH - read before trusting a result.
// The evidence is ASYMMETRIC. An `unsafe` result is proof: a session variable
// crossing between two clients, or two clients reporting one backend pid, has
// no innocent explanation, so this cannot cry wolf. A `safe` result is NOT
// proof of the converse. It means only that this probe did not observe
// sharing on this sample, which is a different claim. PgBouncer in
// transaction mode with pool_size > 1 has more than one server connection to
// hand out, so concurrently checked-out probe clients can each land on a
// different backend and the probe returns safe on a topology that is not -
// and the probe runs at boot, when a pooler is at its most idle and therefore
// at its most likely to have spare backends. Raising the client count raises
// the number of simultaneous backends the pooler must supply before the
// sample looks clean, so it narrows the gap; it does not close it. Nothing
// short of knowing the deployment topology can. Treat `safe` as "no evidence
// of a transaction-mode pooler", never as "verified direct connection".
export async function probePoolerMode(targetPool = pool, rounds = 3, clientsPerRound = POOLER_PROBE_CLIENTS) {
  for (let round = 0; round < rounds; round += 1) {
    const clients = await Promise.all(
      Array.from({ length: clientsPerRound }, () => targetPool.connect())
    );
    try {
      const nonces = clients.map(
        (_, i) => `${process.pid}-${round}-${i}-${Math.random().toString(36).slice(2)}`
      );
      for (const [i, client] of clients.entries()) {
        await client.query(`SELECT set_config('${POOLER_PROBE_SETTING}', $1, false)`, [nonces[i]]);
      }

      const seen = [];
      for (const client of clients) {
        const { rows: [row] } = await client.query(
          `SELECT current_setting('${POOLER_PROBE_SETTING}', true) AS value, pg_backend_pid() AS pid`
        );
        seen.push(row);
      }

      // Shared backends mean the last set_config wins for all of them, so at
      // least one client reads a nonce that is not the one it wrote.
      for (const [i, row] of seen.entries()) {
        if (row.value !== nonces[i]) {
          return {
            safe: false,
            reason:
              'Concurrently checked-out clients share one Postgres backend: a session variable set on one was ' +
              'readable from another. A transaction-mode connection pooler is in front of this app.',
          };
        }
      }

      const pids = new Map();
      for (const row of seen) {
        if (pids.has(row.pid)) {
          return {
            safe: false,
            reason: `Two concurrently checked-out clients reported the same backend pid (${row.pid}). A transaction-mode connection pooler is in front of this app.`,
          };
        }
        pids.set(row.pid, true);
      }
    } finally {
      // Blanking has to happen even when a probe query above threw. It used
      // to be the last statement of the try, which meant a mid-probe failure
      // returned clients to the pool still carrying app.pooler_probe - the
      // exact residue class this whole file exists to remove. Each blank is
      // independently guarded so one wedged client cannot stop the others
      // being cleaned, and so a cleanup failure never masks the probe error.
      for (const client of clients) {
        await client.query(`SELECT set_config('${POOLER_PROBE_SETTING}', '', false)`).catch((err) => {
          console.error('db: could not clear the pooler probe setting on a client', err);
        });
        try {
          client.release();
        } catch (err) {
          console.error('db: releasing a pooler probe client threw - ignored', err);
        }
      }
    }
  }
  return {
    safe: true,
    // Deliberately worded as an observation, not a clearance - see the
    // asymmetry note above.
    reason:
      `No evidence of a shared backend: ${clientsPerRound} concurrently checked-out clients reached ` +
      `distinct Postgres backends in each of ${rounds} rounds. This does not prove the topology is safe.`,
  };
}

// Boot-time gate. Session-scoped tenancy plus a transaction-mode pooler is
// the one combination that silently breaks tenant isolation, so it is
// checked once at startup rather than trusted.
export async function assertPoolerModeSafe(targetPool = pool) {
  const mode = tenantScopeMode();
  if (mode === 'transaction') {
    // The tenant travels with the transaction, so a backend shared between
    // transactions carries nothing across.
    return { safe: true, reason: 'DB_TENANT_SCOPE=transaction: tenancy is scoped to each transaction.' };
  }

  const result = await probePoolerMode(targetPool);
  if (result.safe) return result;

  const message =
    `Unsafe database topology: ${result.reason} ` +
    'With DB_TENANT_SCOPE=session the tenant is a session-scoped Postgres setting, so one shop\'s ' +
    'requests can be served on a connection still carrying another shop\'s tenant. Use a direct ' +
    'connection or a session-mode pooler.';
  if (POOLER_GUARD_ON_UNSAFE === 'fail') throw new Error(message);
  console.warn(message);
  return result;
}
