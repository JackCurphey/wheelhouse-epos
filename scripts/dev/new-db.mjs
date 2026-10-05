// Makes a database of your own on the compose Postgres (split plan §4.2,
// rule 1): one per worktree, and a fresh one for every review, so only
// throwaway databases ever run an unmerged migration. Run it through
// scripts/new-db.sh <name>.
//
// The app's role can't create databases (docker/init-db.sh), so this connects
// as the compose superuser: ADMIN_DATABASE_URL if set, otherwise user
// postgres with POSTGRES_SUPERUSER_PASSWORD at DATABASE_URL's host and port,
// both from this worktree's .env. It grants the app role the same rights
// init-db.sh grants on epos, so row-level security works there as on epos.
// Node and pg rather than psql: psql isn't on every machine, and the app
// already depends on pg.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const NAME = /^[a-z_][a-z0-9_]*$/;

export async function createAppDatabase(adminUrl, name, appRole) {
  if (!NAME.test(name)) throw new Error(`"${name}": use lowercase letters, digits and _, not starting with a digit`);
  if (!NAME.test(appRole)) throw new Error(`"${appRole}" is not a plain role name`);
  const at = (database) => { const u = new URL(adminUrl); u.pathname = `/${database}`; return u.href; };
  const run = async (database, sql) => {
    const client = new pg.Client({ connectionString: at(database) });
    await client.connect();
    try { await client.query(sql); } finally { await client.end(); }
  };
  await run('postgres', `CREATE DATABASE ${name}`);
  await run(name, `GRANT ALL ON SCHEMA public TO ${appRole}`);
}

export async function dropDatabase(adminUrl, name) {
  if (!NAME.test(name)) throw new Error(`"${name}" is not a plain database name`);
  const u = new URL(adminUrl); u.pathname = '/postgres';
  const client = new pg.Client({ connectionString: u.href });
  await client.connect();
  try { await client.query(`DROP DATABASE IF EXISTS ${name}`); } finally { await client.end(); }
}

export function adminUrlFrom(env) {
  if (env.ADMIN_DATABASE_URL) return env.ADMIN_DATABASE_URL;
  if (!env.DATABASE_URL || !env.POSTGRES_SUPERUSER_PASSWORD) {
    throw new Error('Set ADMIN_DATABASE_URL, or have DATABASE_URL and POSTGRES_SUPERUSER_PASSWORD in .env');
  }
  const u = new URL(env.DATABASE_URL);
  u.username = 'postgres';
  u.password = env.POSTGRES_SUPERUSER_PASSWORD;
  u.pathname = '/postgres';
  return u.href;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import('../../server/load-env.js');
  const name = process.argv[2];
  try {
    if (!name) throw new Error('usage: scripts/new-db.sh <name>');
    const appRole = decodeURIComponent(new URL(process.env.DATABASE_URL).username);
    await createAppDatabase(adminUrlFrom(process.env), name, appRole);
    console.log(`Made database ${name} for ${appRole}.`);
    console.log(`Point this worktree at it: in .env, change the database name at the end of DATABASE_URL to ${name}, then run npm run migrate.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
