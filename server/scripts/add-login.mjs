// Adds a person as the owner of a shop that has none (add-hosted-copy design 7,
// task 3.6b): the test shop the loader makes has no login, and staff sign in
// only through WorkOS, so nobody can be signed in to it to add one from the
// app. On the hosted copy (docs/runbooks/hosted-copy.md, "Loading the test shop"):
//
//   docker compose exec app node server/scripts/add-login.mjs --shop <address> --email <email> --name <name>
//
// The shop's address is the part of its web address after /book/, e.g.
// north-street-cycles. Their password is random and never shown: they sign in
// through WorkOS with that email.
import '../load-env.js';
import { parseArgs } from 'node:util';
import { pool } from '../db.js';
import { AuthError, addOwnerLogin } from '../auth.js';

const USAGE = 'Usage: node server/scripts/add-login.mjs --shop <address> --email <email> --name <name>';

let code = 0;
try {
  const { values } = parseArgs({ options: { shop: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } } });
  if (!values.shop || !values.email || !values.name) {
    console.error(USAGE);
    code = 1;
  } else {
    const login = await addOwnerLogin({ shopSlug: values.shop, name: values.name, email: values.email });
    console.log(`Added ${login.name} (${login.email}) as the owner of ${login.shopName}. Sign in through WorkOS with that email.`);
  }
} catch (err) {
  // A typing slip (an unknown option, a name without quotes, an option with
  // no value) is a refusal too, not a stack trace (review).
  const slip = String(err.code ?? '').startsWith('ERR_PARSE_ARGS_');
  if (!(err instanceof AuthError) && !slip) throw err;
  console.error(slip ? 'Refused: the command wasn’t typed as expected. Nothing was changed.' : `Refused: ${err.message}. Nothing was changed.`);
  if (slip) console.error(`${USAGE}\nPut a name with a space in quotes: --name "Jack Curphey".`);
  code = 1;
} finally {
  await pool.end();
}
process.exitCode = code;
