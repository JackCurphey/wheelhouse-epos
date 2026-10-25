// The pretend sign-in provider (openspec/changes/customer-code-signin design 2):
// it keeps its codes in pretend_signin_codes, as WorkOS would on its side, and
// answers as Magic Auth does. No email goes anywhere: outside production the
// code is printed in the server's log for a developer to type.
import { randomInt } from 'node:crypto';
import { prepare } from '../db.js';

const VALID_MINUTES = 10;
// The fifth wrong try uses the code up (design 2).
const WRONG_TRIES = 5;

export const pretend = {
  name: 'pretend',
  /** Sends a new code to `email`, replacing its earlier one. */
  async sendCode({ email }) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // One statement over the one live code per email, so two asks at once leave one (review).
    await prepare(
      `INSERT INTO pretend_signin_codes (email, code, expires_at) VALUES (?, ?, now() + interval '${VALID_MINUTES} minutes')
       ON CONFLICT (shop_id, email) WHERE used_at IS NULL
       DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, wrong_tries = 0, created_at = now()`
    ).run(email, code);
    if (process.env.NODE_ENV !== 'production') console.log(`Pretend sign-in: the code for ${email} is ${code}`);
    return { ok: true };
  },
  /** 'ok' uses the code; 'wrong' counts a try; 'expired' for one too old, used or used up. */
  async checkCode({ email, code }) {
    // One conditional update, so two checks at once can't both use it.
    const used = await prepare(
      `UPDATE pretend_signin_codes SET used_at = now()
        WHERE email = ? AND code = ? AND used_at IS NULL AND expires_at > now() RETURNING id`
    ).get(email, String(code));
    if (used) return 'ok';
    const live = await prepare(
      `UPDATE pretend_signin_codes
          SET wrong_tries = wrong_tries + 1, used_at = CASE WHEN wrong_tries + 1 >= ${WRONG_TRIES} THEN now() END
        WHERE email = ? AND used_at IS NULL AND expires_at > now() RETURNING id`
    ).get(email);
    return live ? 'wrong' : 'expired';
  },
};
