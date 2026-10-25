# Design: customers sign in with a code sent by email

## Decisions

1. **The adapter** lives in `server/signin/`.
   - `provider.js` reads `CUSTOMER_SIGNIN_PROVIDER`: `pretend` or nothing.
     It follows `server/payments/provider.js`, so a shop running for real
     never signs anyone in with a pretend code.
   - The adapter's two calls are shaped like WorkOS Magic Auth's:
     - `sendCode({ email })` returns `{ ok: true }`;
     - `checkCode({ email, code })` returns `'ok'`, `'wrong'` or
       `'expired'`.
2. **The pretend version** stores each code in `pretend_signin_codes`.
   - Each code is kept per shop and email, with `expires_at` 10 minutes
     on. A new code replaces the email's earlier ones.
   - The code is six random digits (`crypto.randomInt`). It is stored as
     written, as WorkOS would hold it on its side, so the tests and a
     developer can read it. Outside production it is also printed in the
     server log.
   - The table has row-level security per shop, as `pretend_payments`
     does.
   - **A code is used once.** The fifth wrong try uses it up, and after
     that it reads as expired.
3. **The routes** run in the shop's context, as every portal route but
   signup, login and logout does. The dispatcher needs no change.
   - **`sign-in/code`** takes `{ email }`.
     - Answers 400 for an email that isn't valid.
     - Answers 503 "Signing in by email isn’t switched on yet" with no
       provider.
     - Answers 429 when limited: 10 sends per network, or 5 per email
       address, in 15 minutes.
     - Otherwise answers 200, whether the email has an account or not, so
       the reply never says who does.
   - **`sign-in/check`** takes `{ email, code }`.
     - Answers 401 with `reason: 'wrong'` ("That code isn’t right. Check
       it, or send a new one") or `reason: 'expired'` ("That code has
       expired — send a new one", as drawn).
     - Answers 429 at 30 checks per network in 15 minutes.
     - When the code is right, it finds the shop's login for that email,
       or makes a new customer (no name, the email) and a login with no
       password. Both are made in one transaction, so two checks at once
       can't make two (unique `(shop_id, email)`; the loser reads the
       winner's).
     - A switched-off login is refused: "This account can’t sign in. Ask
       the shop".
     - Signed in, it sets `wh_customer_session` as login does, and answers
       `{ id, email, name, shopName, shopSlug }`, as `/me` does.
4. **A login with no password can't be signed into with a password.**
   `verifyPassword` already refuses a stored value that isn't
   `salt:hash`. A test holds it there.
5. **The screens** are the next change, `customer-code-signin-screens`.
