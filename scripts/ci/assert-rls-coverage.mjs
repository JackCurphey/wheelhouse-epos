// Fails if any table carrying a shop_id column is not protected by BOTH
// ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY.
//
// Why this exists: tenant isolation in this app is enforced by Postgres RLS,
// not by application code (see server/db.js). A migration that adds a
// shop-scoped table and forgets its ALTER TABLE ... ENABLE/FORCE ROW LEVEL
// SECURITY lines produces a table that looks fine, passes every functional
// test, and silently serves one shop's rows to another. Nothing else in the
// suite catches that, so it is checked directly against the live catalogue
// after migrations have run.
//
// ENABLE alone is not enough: without FORCE, the table's owner (which is the
// role the app connects as) bypasses its own policies.
import '../../server/load-env.js';
import pg from 'pg';

// Tables that legitimately carry a shop_id but must NOT have RLS: the
// pre-authentication registry tables. They are what *resolves* which shop a
// request belongs to, so they are queried before any shop context exists and
// a policy filtering on current_setting('app.current_shop_id') could never
// match. Documented at server/migrations/001_init_schema.sql:22-24 and
// server/migrations/003_customer_portal.sql:5-8.
//
// Every name here must still exist as a shop_id-bearing table; if one is
// renamed or dropped the exemption is stale and this script fails, so the
// list cannot quietly outlive its justification.
const EXEMPT = new Set(['logins', 'customer_logins']);

const QUERY = `
  SELECT c.relname AS table_name,
         c.relrowsecurity AS enabled,
         c.relforcerowsecurity AS forced
  FROM pg_class c
  WHERE c.relkind = 'r'
    AND c.relnamespace = 'public'::regnamespace
    AND EXISTS (
      -- pg_attribute, not information_schema.columns: information_schema is
      -- privilege-filtered, so a table the connecting role holds no grants on
      -- is simply invisible there - which is exactly the table most likely to
      -- have been added without thinking about isolation. pg_catalog is not
      -- filtered, so nothing can hide from this check.
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid
        AND a.attname = 'shop_id'
        AND a.attnum > 0
        AND NOT a.attisdropped
    )
  ORDER BY c.relname
`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: true } : false,
});

await client.connect();
let rows;
try {
  ({ rows } = await client.query(QUERY));
} finally {
  await client.end();
}

if (rows.length === 0) {
  console.error('RLS coverage: found no tables with a shop_id column at all.');
  console.error('Migrations have probably not run against this database.');
  process.exit(1);
}

const failures = [];
const seen = new Set();

for (const row of rows) {
  seen.add(row.table_name);
  if (EXEMPT.has(row.table_name)) continue;
  if (!row.enabled || !row.forced) {
    failures.push(
      `  ${row.table_name}: relrowsecurity=${row.enabled} relforcerowsecurity=${row.forced}`,
    );
  }
}

const staleExemptions = [...EXEMPT].filter((name) => !seen.has(name)).sort();

const required = rows.filter((row) => !EXEMPT.has(row.table_name)).length;
console.log(
  `RLS coverage: ${rows.length} tables with a shop_id column, ` +
    `${required} required to be protected, ` +
    `${rows.length - required} exempt (${[...EXEMPT].sort().join(', ')}).`,
);

if (failures.length > 0) {
  console.error('\nRLS coverage FAILED - these shop-scoped tables are unprotected:');
  console.error(failures.join('\n'));
  console.error(
    '\nAdd to the migration that creates each table:\n' +
      '  ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;\n' +
      '  ALTER TABLE <table> FORCE ROW LEVEL SECURITY;\n' +
      'plus the shop_id policy the neighbouring tables use.',
  );
}

if (staleExemptions.length > 0) {
  console.error(
    `\nRLS coverage FAILED - exempt tables no longer exist (or lost their shop_id ` +
      `column): ${staleExemptions.join(', ')}.\n` +
      'Update the EXEMPT list in scripts/ci/assert-rls-coverage.mjs.',
  );
}

if (failures.length > 0 || staleExemptions.length > 0) process.exit(1);
console.log('RLS coverage OK.');
