# Moving authentication to WorkOS

Design spec — 2026-08-31

Status: **approved design, not yet implemented.** This document is written to be
picked up cold by someone who has not been part of the conversation that
produced it. The implementation plan lives alongside it.

---

## 1. Why

The app authenticates people with code we wrote ourselves. `server/auth.js` is
173 lines that hash passwords with `scryptSync`, mint random session tokens,
and look them up in Postgres. It works, and it is deliberately small, but it
has no password reset, no email verification, no invitations, no MFA, no login
audit trail, and a permission model consisting of one boolean.

`README.md` already admits most of this. The Team UI says it out loud, at
`public/app.js:4216`:

> Every login can do everything for now - individual permissions are coming later.

This spec moves identity to WorkOS AuthKit and takes three things off the
to-build list:

1. **Stop hand-rolling passwords.** Sign-in, password reset, email
   verification and invitations become AuthKit's problem.
2. **Real roles and permissions.** Replace the single `is_owner` boolean with
   WorkOS RBAC, enforced per-route.
3. **SSO for larger shop groups.** A multi-branch chain signs in with its own
   Google Workspace / Okta / Entra tenant, self-served through the WorkOS
   Admin Portal.

MFA and Audit Logs are explicitly **out of scope** — see §13.

---

## 2. Scope

**Environment.** Local development on Docker Compose only. There is no
production deployment and no real user base. Everything below targets
`docker compose up` on a developer machine against a WorkOS **staging**
environment.

This matters more than it sounds. It removes, entirely:

- bulk user import at scale and the 200,000-user support threshold
- dual-write cutover, feature-flagged rollback, and phased rollout
- throttled password-reset email campaigns
- any downtime budget

What would be a fraught production migration is, here, a schema change and a
rewrite of one function. §12 records what a real cutover would additionally
need, so that this document stays useful if the app is ever deployed for real.

**In scope:** staff authentication, the customer booking portal, the RBAC
model, SSO/Organizations/Admin Portal, the Electron print agent's credentials,
and the test strategy for all of it.

**Not in scope:** the business logic behind the 98 API routes, Postgres RLS,
`server/db.js`, the storefront's public routes, or the Shopify webhook path.
None of these change.

---

## 3. Decisions taken

These were settled during design. They are recorded here so an implementer
does not relitigate them.

| # | Decision | Rationale |
|---|---|---|
| 1 | Cloud-hosted model; no offline auth path | The till does not need to survive an internet outage in a dev-only environment. Had shops run this locally, WorkOS could not have been the only auth path. |
| 2 | Replace the seam, not the architecture | See §4. WorkOS owns identity; we keep owning shop data, `shops.id`, and RLS. |
| 3 | **One** WorkOS environment, one user pool | Staff and customers are all WorkOS users. Which shops a person belongs to, and in what capacity, is our database's business. See §7 for the trust-boundary consequence, which is the significant cost of this choice. |
| 4 | Frontend target is React | The staff SPA is mid-rewrite to React 19 + Vite + shadcn (`src/staff/`). The spec assumes that lands first. |
| 5 | Adopt `@workos-inc/node` | Breaks the repo's one-dependency rule. See §10.1. |

---

## 4. The seam

The single most important structural fact about this codebase:

**Every protected route funnels through one function.** `currentSession(req)`
at `server/server.js:187` returns `{ login, shop }`. The dispatcher at
`server/server.js:3436` then does:

```js
const ctx = await currentSession(req);
if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
return runWithShop(ctx.shop.id, () => handler(...));
```

`runWithShop` sets `app.current_shop_id` on a pooled client, and Postgres RLS
does tenant isolation for every shop-scoped table. That is the whole
authorization primitive.

So the migration does **not** touch the 98 API handlers, RLS, `db.js`, or the
dispatcher's control flow. It replaces what happens *inside* `currentSession`,
plus the four `/api/auth/*` routes and the sign-in screen. Everything else in
this document is a consequence of that one substitution.

Keeping `currentSession` returning the same `{ login, shop }` shape — now with
an added `permissions` array — is a deliberate constraint. It is what keeps the
diff small and the change reviewable.

**One change to that control flow is required.** The dispatcher resolves `ctx`
at `server/server.js:3591` but does not pass it to the handler, so the ten
handlers that need `ctx.login.is_owner` call `currentSession(req)` a *second*
time (lines 434, 1343, 2602, 2608, 2630, 2638, 2647, 2662, 2678, 2691). Today
that costs a repeat Postgres lookup and nobody notices. Under WorkOS it costs a
second sealed-cookie decrypt and JWT verification per request, and — worse — a
second potential `.refresh()`, which can rotate the refresh token twice in one
request and invalidate the cookie the first refresh just wrote.

So: **pass `ctx` into the handler signature** and delete the redundant
`currentSession` calls. This is a small mechanical change across ten call
sites, it must happen as part of the migration rather than after it, and it is
the kind of thing that would otherwise show up as an intermittent
random-logout bug that is very unpleasant to diagnose.

### 4.1 Identity mapping

| Our concept | WorkOS concept | Link |
|---|---|---|
| `shops` row | Organization | `organizations.external_id` = our `shops.id`; we also store `shops.workos_org_id` |
| Staff member (`logins` row) | User + Organization Membership | `logins.workos_user_id` |
| `logins.is_owner` | Role `owner` on the membership | Replaced by RBAC; column dropped |
| `employees` row | *(nothing)* | Stays entirely ours — roster, working days, workshop diary |
| Customer (`customer_logins` row) | User with **no** organization membership | `customer_logins.workos_user_id` |
| `sessions` / `customer_sessions` | AuthKit sealed session cookie | Tables dropped |

Two properties of this mapping are worth stating plainly:

**`shops.id` stays ours.** RLS keys off it, it is referenced by every business
table, and it is an integer we control. WorkOS holds a pointer to it via
`external_id`, not the other way round. If the WorkOS org record is lost, shop
data is still coherent.

**Shop resolution comes from the token, not the user row.** Today
`getSessionContext` finds the shop via `login.shop_id`, which is why
`logins.email` has to be globally unique and why one person cannot be staff at
two shops. Under this design the access token carries `org_id`, so a session is
already scoped to one organization. We resolve the shop from `org_id`. The
global uniqueness constraint on `logins.email` is dropped and replaced with
`UNIQUE (shop_id, workos_user_id)` — one person, many shops, one membership
each. That is a bug fix that falls out of the migration for free.

### 4.2 Session lifecycle

AuthKit sealed sessions replace the `sessions` table. The sealed session is an
encrypted cookie containing the access token and refresh token; there is no
server-side session row.

**Sign in** — `GET /api/auth/login` redirects to
`workos.userManagement.getAuthorizationUrl({ provider: 'authkit', redirectUri, clientId })`.

**Callback** — `GET /callback` (path must match `WORKOS_REDIRECT_URI` exactly)
calls:

```js
const { user, sealedSession } = await workos.userManagement.authenticateWithCode({
  clientId: process.env.WORKOS_CLIENT_ID,
  code,
  session: { sealSession: true, cookiePassword: process.env.WORKOS_COOKIE_PASSWORD },
});
```

then sets `sealedSession` as the `wos-session` cookie and redirects to the app.

**Every request** — `currentSession(req)` becomes:

```js
const session = workos.userManagement.loadSealedSession({
  sessionData: cookies['wos-session'],
  cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
});
let result = await session.authenticate();
if (!result.authenticated) {
  result = await session.refresh();       // returns a NEW sealedSession
  if (!result.authenticated) return null; // caller 401s
  // re-set the wos-session cookie from result.sealedSession — mandatory
}
```

`.authenticate()` returns `{ authenticated, user, sessionId, organizationId,
role, permissions }`. That last pair is the entire RBAC story arriving with no
extra API round trip — important for a till, where per-request latency to
workos.com would be felt.

We then resolve locally:

```sql
SELECT * FROM shops  WHERE workos_org_id = $1;               -- organizationId
SELECT * FROM logins WHERE workos_user_id = $1 AND shop_id = $2 AND active;
```

and return `{ login, shop, permissions }`. If either lookup misses, the request
is 401 — a WorkOS user with no `logins` row for that shop is not staff.

**Multiple organizations.** A user in more than one org gets an organization
selection step: AuthKit returns a `pending_authentication_token`, we render the
org list, and call
`workos.userManagement.authenticateWithOrganizationSelection({ clientId, organizationId, pendingAuthenticationToken })`.
Switching shops later without re-authenticating uses
`authenticateWithRefreshToken({ clientId, refreshToken, organizationId })`.
Neither path exists in the app today — it is new UI, and it is the price of
fixing the one-shop-per-person limitation.

**Sign out** — `await session.getLogoutUrl()`, clear the cookie, redirect.
Unlike today, this ends the session at WorkOS, so "sign out everywhere"
becomes possible for the first time.

**Deactivation latency.** Today `login.active` is re-read from Postgres on
every request, so deactivating someone takes effect on their next click. That
property survives: the local `logins` lookup above still runs per request. But
`role` and `permissions` come from the token, so a **role change** does not
take effect until the token refreshes. This is a real behaviour change and must
be documented in the Team UI. Mitigate by keeping the access-token duration
short (§11).

---

## 5. Data model

One migration, `server/migrations/014_workos_identity.sql`.

```sql
-- shops: point at the WorkOS organization
ALTER TABLE shops ADD COLUMN workos_org_id TEXT UNIQUE;

-- logins: WorkOS owns the credential; we own the membership
ALTER TABLE logins ADD COLUMN workos_user_id TEXT;
ALTER TABLE logins DROP COLUMN password_hash;
ALTER TABLE logins DROP COLUMN is_owner;          -- superseded by RBAC roles
ALTER TABLE logins DROP CONSTRAINT logins_email_key;   -- global uniqueness
ALTER TABLE logins ADD CONSTRAINT logins_shop_user_unique
  UNIQUE (shop_id, workos_user_id);
CREATE INDEX idx_logins_workos_user ON logins(workos_user_id);

-- customer_logins: same treatment, no organization
ALTER TABLE customer_logins ADD COLUMN workos_user_id TEXT;
ALTER TABLE customer_logins DROP COLUMN password_hash;
CREATE INDEX idx_customer_logins_workos_user ON customer_logins(workos_user_id);

-- sealed cookies replace server-side session rows
DROP TABLE sessions;
DROP TABLE customer_sessions;
```

`workos_user_id` is deliberately left nullable rather than `NOT NULL`: a
`logins` row is created before the WorkOS invitation is accepted, and gets its
id when the user first signs in or when the `user.created` webhook arrives.
A row with a null `workos_user_id` cannot authenticate, which is the correct
behaviour for a pending invitation.

`logins.email` and `logins.name` are **kept**, denormalised from WorkOS. They
are what the Team list renders, and reading them from the local table avoids an
API call per row. They are refreshed by the `user.updated` webhook (§9.3).

### 5.1 Notes for the implementer

- `logins.is_owner` is read in eight places in `server/server.js`
  (lines 2606, 2631, 2639, 2648, 2663, 2679, 2692) and in `server/team.js`.
  Every one becomes a permission check (§6.3). `tests/team.test.js` asserts on
  it too and will need rewriting.
- `tests/helpers/testShop.js` tears down `sessions`, `logins`,
  `customer_sessions`, `customer_logins`. Two of those tables stop existing.
- `server/customer-auth.js` imports `hashPassword`, `verifyPassword` and
  `EMAIL_RE` from `server/auth.js`. The first two disappear.

---

## 6. Roles and permissions

### 6.1 What exists today

One boolean, `logins.is_owner`, checked on eight `/api/team*` routes. Of the 98
declared routes, 4 are `/api/auth/*` and 10 are `/api/portal/*`; the other 76
are open to any active login of the shop.

Separately, `employees.is_mechanic` and `employees.is_cashier` exist but are
**scheduling flags, not permissions** — they decide who gets a workshop diary
column and who appears in the Front Desk cashier dropdown. Nothing checks them
for access.

The migration is the moment to promote them. A shop already tells us who is a
mechanic and who is a cashier; the RBAC model should mean it.

### 6.2 Proposed roles

Environment-level roles in WorkOS, so every organization gets them by default.
Note the WorkOS gotcha: creating the first *organization-level* role for an org
permanently stops that org inheriting environment-level role changes, and is
irreversible. Do not create org-level roles unless a shop genuinely needs one.

| Role slug | Who | Intent |
|---|---|---|
| `owner` | The person who created the shop | Everything, including team and billing-shaped settings |
| `manager` | Trusted senior staff | Everything except team management |
| `mechanic` | Workshop staff | Workshop, bikes, customers; read-only inventory and sales |
| `cashier` | Till staff | Till, sales, customers; read-only inventory |

`member` is WorkOS's default role slug for a new membership. Map it to
`cashier`, or override the default in the dashboard — do not leave a person
holding `member` with no permissions mapped, because permission slug typos and
unmapped roles both fail silently as "denied".

### 6.3 Permission slugs and the route map

Check **permissions, never role slugs**. `role === 'owner'` breaks the moment a
shop gets a custom role; `permissions.includes('team:manage')` does not.

| Permission | Routes (from the current route table) |
|---|---|
| `till:operate` | `POST /api/sales`, `GET /api/sales`, `GET /api/sales/:id`, `/api/sale-documents*` |
| `inventory:read` | `GET /api/products`, `GET /api/categories`, `GET /api/suppliers` |
| `inventory:write` | `POST|PUT|DELETE /api/products*`, `POST /api/products/:id/stock`, `/api/suppliers*`, `/api/purchase-orders*`, `/api/catalogue-items*` |
| `workshop:read` | `GET /api/workshop-jobs*`, `GET /api/bikes/:id/jobs` |
| `workshop:write` | `POST|PUT|DELETE /api/workshop-jobs*`, `/api/bikes/:id`, attachments |
| `customers:read` | `GET /api/customers*`, `GET /api/customer-groups` |
| `customers:write` | `POST|PUT|DELETE /api/customers*`, `/api/customer-groups*`, `POST /api/customers/:id/texts` |
| `settings:manage` | `/api/shop-theme`, `/api/label-settings`, `/api/storefront-settings*`, `/api/shopify/*`, `PUT /api/workshop-settings` |
| `team:manage` | all eight `/api/team*` routes, `PUT /api/employees/:id`, `DELETE /api/employees/:id/permanent` |
| `devices:manage` | `/api/print-agents*` |

Role → permission grants:

| | owner | manager | mechanic | cashier |
|---|---|---|---|---|
| `till:operate` | ✓ | ✓ | | ✓ |
| `inventory:read` | ✓ | ✓ | ✓ | ✓ |
| `inventory:write` | ✓ | ✓ | | |
| `workshop:read` | ✓ | ✓ | ✓ | ✓ |
| `workshop:write` | ✓ | ✓ | ✓ | |
| `customers:read` | ✓ | ✓ | ✓ | ✓ |
| `customers:write` | ✓ | ✓ | ✓ | ✓ |
| `settings:manage` | ✓ | ✓ | | |
| `team:manage` | ✓ | | | |
| `devices:manage` | ✓ | ✓ | | |

`GET /api/dashboard` and `GET /api/employees` require only an authenticated
session — every role sees them.

### 6.4 Enforcement

The `route()` helper at `server/server.js:359` takes `(method, pattern,
handler)`. Extend it to `(method, pattern, handler, permission)` and enforce
centrally in the dispatcher, immediately after the existing 401:

```js
if (matched.permission && !ctx.permissions.includes(matched.permission)) {
  return sendJson(res, 403, { error: 'You do not have permission to do that' });
}
```

Central enforcement rather than eight inline `if (!ctx.login.is_owner)` checks
is the point. It makes the permission a visible property of each route
declaration, and it makes "which routes are unprotected?" a greppable question
— today it is not.

**A route with no declared permission stays open to any authenticated member of
the shop.** That is the current behaviour and preserves it exactly, so the RBAC
rollout can be incremental. It is also a footgun: a new route added without a
permission is silently open. The plan includes a test that asserts every route
in the table either declares a permission or appears on an explicit
`INTENTIONALLY_OPEN` allowlist.

### 6.5 Frontend

`src/staff/` must hide what the user cannot do, or the UI will offer buttons
that 403. `GET /api/auth/me` gains a `permissions: string[]` field; the React
app gates navigation and action buttons on it. Server-side enforcement remains
the only thing that is actually load-bearing — the client-side check is
cosmetic.

---

## 7. The customer portal, and the trust boundary

This is the part of the design that deserves the most scrutiny.

Today's separation is structural. `server/customer-auth.js` says why, in its
header comment:

> Deliberately separate rather than reusing logins/sessions: customers and
> staff are different audiences with different trust levels, and keeping them
> in different tables means a bug here can't accidentally grant portal code
> staff-level access or vice versa.

**Decision 3 gives that up.** With one WorkOS environment and one user pool, a
customer and a staff member are the same kind of object, and a customer's
sealed session cookie is a structurally valid session. The separation is no
longer two tables — it is one predicate.

What replaces it:

1. **Different cookie names.** Staff `wos-session`, customers
   `wos-customer-session`. A cookie presented on the wrong path is not read.
2. **Organization membership is the discriminator.** Staff sessions carry an
   `org_id`; customers are WorkOS users with **no** organization membership, so
   their tokens have no `org_id` at all. `currentSession()` returns null
   without one.
3. **The `logins` row is required.** Even with a valid token and an `org_id`,
   `SELECT * FROM logins WHERE workos_user_id = $1 AND shop_id = $2 AND active`
   must return a row. A customer has none.

All three must hold. Any one of them failing open is a privilege escalation
across the staff/customer boundary, so §11 requires explicit negative tests for
each: a customer session presented at `/api/*` must 401, and a staff session
presented at `/api/portal/*` must not resolve to a customer.

**If this trade is not worth it, revisit Decision 3.** Two WorkOS environments
— separate keys, separate user pools — preserves the structural boundary at the
cost of a second SDK client and a second set of env vars. The design is
otherwise identical, and the switch is cheap *before* implementation and
expensive after.

### 7.1 Portal specifics

- `customer_logins` keeps `UNIQUE (shop_id, email)` semantics via the
  customer↔shop link; one WorkOS user can be a customer of several shops.
- Guest bookings (`resolveGuestCustomer`, no account, name + phone) are
  **unchanged**. They never touch auth and must stay that way.
- Portal handlers keep their existing per-handler assertion that
  `ctx.shop.slug === params.shopSlug`.

---

## 8. SSO and the Admin Portal

Only relevant once a shop is a multi-branch group with its own identity
provider. Nothing here changes single-shop sign-in.

**Organization provisioning.** Creating a shop creates the org:

```js
const org = await workos.organizations.createOrganization({
  name: shopName,
  externalId: String(shop.id),
});
```

`externalId` is the back-reference, and `getOrganizationByExternalId()` /
`GET /organizations/external_id/{external_id}` recovers the org from a shop id
if `shops.workos_org_id` is ever lost. Create the org and the `shops` row in
one transaction; if the WorkOS call fails, roll the shop back rather than leave
an org-less shop that can never be signed into.

**Self-serve connection setup.** `workos.portal.generateLink({ organization, intent })`
produces a time-limited Admin Portal link the shop's IT contact uses to
configure their own SAML/OIDC connection. Surface it behind `team:manage` in
Office → Edit Shop. Confirm the valid `intent` values against
`https://workos.com/docs/reference/admin-portal` at implementation time — they
were not directly verifiable during design (§14).

**Group → role mapping.** Once a shop has SSO, their IdP groups can drive
WorkOS roles. Two rules matter and both bite:

- IdP role assignment **always overrides** roles set by API or Dashboard. Any
  `updateOrganizationMembership` call is silently reverted on the user's next
  login if a group mapping exists. The Team UI must not present role editing as
  authoritative for SSO-backed shops.
- IdP role mapping works only with **environment-level** roles, which is a
  second reason §6.2 avoids org-level roles.

This is Dashboard/Admin Portal configuration, not code, and it is **not**
available via the `workos` CLI.

---

## 9. Everything else that touches auth

### 9.1 The Electron print agent

`print-agent/main.js` signs in with staff credentials and writes
`{ cookie: "wh_session=<token>", ... }` to `session.json` in Electron
`userData`, unencrypted, then check-ins every ~10s.

Reusing a sealed session here is wrong: it is a human's credential on a
shared device, it expires, and refreshing it non-interactively from Electron is
awkward. **The print agent should not hold a user session.** Give it its own
credential — a per-device token this app issues, stored in `print_agent_devices`
(shop-scoped, RLS-protected, hashed at rest), presented as a bearer header and
checked before the `currentSession` gate.

This is genuinely separate work with its own design, and it is a **prerequisite**
for the cutover, because the moment `wh_session` stops existing the print agent
stops working. Sizing it is part of the plan; designing it is not part of this
document.

### 9.2 Things that do not change

- **`server/gateway.js`** — a dumb proxy that passes cookies through and does
  no auth. Untouched.
- **Storefront routes** — fully public, resolved by hostname/slug before any
  session logic. Untouched.
- **Shopify webhooks** — authenticated by HMAC over the raw body against a
  per-shop secret, not by session. Untouched.
- **`/api/uploaded-images/...`** — deliberately public, authorized by
  unguessable filename. Untouched.
- **Postgres RLS and `runWithShop`** — untouched. This is the design's main
  claim to being low-risk.

### 9.3 Webhooks

Local `logins.email` / `logins.name` are a denormalised copy, so they drift
when a user changes their details in AuthKit. Add `POST /webhooks/workos`,
verified with `workos.webhooks.constructEvent({ payload, sigHeader, secret })`
over the **raw** body — the Shopify handler at
`server/server.js` already establishes the raw-body pattern; reuse it.

Handle: `user.created`, `user.updated`, `user.deleted`,
`organization_membership.created`, `organization_membership.updated`,
`organization_membership.deleted`.

Webhook delivery to `localhost` needs a tunnel. Docker-only development means
this is the one piece that cannot be exercised without exposing a port —
§11 covers testing it without one.

### 9.4 Routes that disappear or change

| Today | After |
|---|---|
| `POST /api/auth/login` | `GET /api/auth/login` → redirect to AuthKit |
| *(none)* | `GET /callback` → `authenticateWithCode`, set cookie |
| `POST /api/auth/logout` | `POST /api/auth/logout` → `getLogoutUrl()`, clear cookie |
| `GET /api/auth/me` | unchanged shape, **plus** `permissions: string[]` |
| `POST /api/auth/signup` | creates shop + WorkOS org + owner membership |
| `POST /api/team` (owner sets a password directly) | `sendInvitation({ email, organizationId, roleSlug, inviterUserId })` |

`SIGNUP_CODE` gating on shop creation stays as-is. AuthKit authenticates
people; it does not decide who is allowed to create a shop, and that is still
our policy to enforce.

The in-memory per-IP rate limiters on `/api/auth/login` and the portal login
become dead code — AuthKit hosts those forms and rate-limits them. The limiters
on **signup** and **guest bookings** must stay; they gate our routes, not
AuthKit's.

---

## 10. Dependencies and configuration

### 10.1 The dependency question

`package.json` has exactly one runtime dependency, `pg`, and the README makes a
virtue of it. `@workos-inc/node` will be the second.

Take the SDK anyway. The alternative is hand-rolling JWKS fetching, JWT
signature verification, token refresh with rotation, and AEAD cookie sealing —
which is precisely the category of code that should not be hand-rolled, and the
reason for this migration in the first place. Writing our own crypto to avoid a
dependency on a service whose selling point is not writing our own crypto would
be self-defeating.

Two consequences to handle:

- **`engines.node` must move from `>=22.5.0` to `>=22.11.0`**, which
  `@workos-inc/node` (10.12.0 at time of writing) requires. Check the CI
  workflow's Node version too.
- **The README's "no npm install required" claim becomes false.** It is already
  false — `pg` is a dependency and the app needs Postgres — but this makes it
  unambiguous. Fix the README as part of the work. The "Data lives only on
  this computer" bullet (`README.md:132-134`) is separately stale — it still
  refers to a SQLite `data/accounts.db` that no longer exists.

### 10.2 Environment variables

Added to `.env` and `docker-compose.yml`:

```
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_REDIRECT_URI=http://localhost:4000/callback
WORKOS_COOKIE_PASSWORD=<32+ chars: openssl rand -base64 32>
WORKOS_WEBHOOK_SECRET=<from dashboard>
```

- `WORKOS_REDIRECT_URI` must match the registered Redirect URI in the WorkOS
  dashboard **exactly**, and must match the host-visible port from
  `docker-compose.yml` — not the in-container port, if they differ.
- `WORKOS_COOKIE_PASSWORD` shorter than 32 characters fails at runtime.
- Refuse to start when any of these are missing. `server/shopify.js` already
  establishes this pattern for `SHOPIFY_TOKEN_ENCRYPTION_KEY` in production —
  follow it, and make it unconditional here rather than production-only, since
  there is no meaningful fallback for an auth key.
- `.env` is already gitignored. Keep it that way; add a committed
  `.env.example` with the names and no values.

### 10.3 Cookie attributes

`wos-session`: `Path=/; HttpOnly; SameSite=Lax`, and `Secure` under the
existing `isHttpsRequest(req)` check at `server/server.js:135` (which reads
`x-forwarded-proto`, so it works behind the tunnel and still permits plain
http on localhost). Keep that helper — it already solves this correctly.

---

## 11. Testing

The current state: `tests/team.test.js` is the only real authz suite, and there
are **no HTTP-level tests at all**. `server/auth.js` itself is entirely
untested — `hashPassword`, `verifyPassword`, session creation, expiry, cookie
flags, the rate limiters and the dispatcher's 401 gate are all uncovered.

That gap is the biggest risk in this migration, and closing it is the first
phase of the plan, not the last. **Write the tests against the current
behaviour first, watch them pass, then migrate and watch them keep passing.**
A test suite written after the fact only proves the new code does what the new
code does.

**The WorkOS client is the test seam.** CI cannot reach workos.com, and should
not try. Put every WorkOS call behind a thin module — `server/workos.js` — and
inject a fake in tests. The fake mints predictable sealed-session values and
returns canned `{ authenticated, user, organizationId, role, permissions }`
objects. This also makes the webhook handler testable without a tunnel: post a
correctly-signed body straight at the route.

Required coverage, by priority:

1. **Cross-tenant isolation.** Port every case from `tests/team.test.js:361-475`
   (the regressions from commit `5cdd4fd`) to the new model. A shop owner must
   not be able to touch another shop's staff. This bug has already happened
   once in this codebase; it must not happen again silently.
2. **The staff/customer boundary** (§7). A customer session at `/api/*` → 401.
   A token with no `org_id` → 401. A valid token whose user has no `logins` row
   for that shop → 401.
3. **Permission enforcement.** For each role in §6.3, a granted route succeeds
   and a denied route 403s. Plus the meta-test that every route declares a
   permission or is on the `INTENTIONALLY_OPEN` allowlist.
4. **Session lifecycle.** Expired access token triggers `.refresh()`; the new
   `sealedSession` is written back to the cookie; a failed refresh 401s.
   Forgetting to re-set the cookie after refresh is the single most likely
   implementation bug — test it directly. Assert also that a single request
   verifies the session exactly **once**: with the fake client counting calls,
   a request to an owner-gated route must not call `.authenticate()` twice
   (§4, the double-verification trap).
5. **Deactivation.** `active = false` takes effect on the next request without
   a token refresh.
6. **HTTP-level smoke tests** for `/api/auth/*` and `/callback`, which have
   never had any.

CI already spins up postgres:16 and asserts the app role is not a superuser
(`rolsuper = 'f'`) — a guard added in `5cdd4fd` after `docker/init-db.sh` was
found to be silently failing, which had left the app connecting as a superuser
and **bypassing RLS entirely**. Keep that assertion. It is load-bearing.

---

## 12. What a production cutover would additionally need

Not required for the Docker-only scope, recorded so this document survives the
app being deployed for real.

**Password import is viable — do not plan for a mass reset.** WorkOS accepts
scrypt hashes in PHC string format, and the format it documents is:

```
$scrypt$v=1$n=16384,r=8,p=1,kl=64$<salt-b64>$<hash-b64>
```

Node's `crypto.scryptSync(password, salt, 64)` uses exactly N=16384, r=8, p=1
with a 64-byte key — **identical to the documented example**. Our stored
`saltHex:hashHex` therefore converts by hex-decoding each half and re-encoding
as base64 with `=` padding stripped. Users keep their passwords.

Caveat: WorkOS publishes that example but does not publish accepted parameter
*ranges*. Verify with a single real import against a staging environment before
relying on it for a real user base.

The rest of a real cutover: create WorkOS users with `createUser({ email,
passwordHash, passwordHashType: 'scrypt', emailVerified, externalId })`, keep
the script idempotent and tracked per user, disable webhook delivery during the
bulk run, and either freeze signups or dual-write during the window.

---

## 13. Deferred

Deliberately excluded. Each is additive and none is blocked by this design.

- **MFA.** AuthKit supports it; enable it in the dashboard when wanted.
- **Audit Logs.** There is no login audit trail today and this migration does
  not add one. Worth revisiting — WorkOS Audit Logs would cover it.
- **Directory Sync (SCIM).** Only meaningful for a shop group large enough to
  provision staff from their IdP. Preferred over SSO-only group mapping when it
  arrives, because roles propagate in real time rather than at next login.
- **Fine-grained authorization (FGA).** The §6 role model is coarse and
  shop-wide. Per-resource rules ("this mechanic, these jobs") would need FGA.
- **PIN / fast user switching on a shared till.** Not present today; every till
  user signs in with email and password on a 30-day cookie, so a shared
  terminal effectively runs as one long-lived login. AuthKit does not solve
  this and the migration does not change it.

---

## 14. Open questions

To resolve at implementation time. Each was researched during design and could
not be settled from published documentation — **verify, do not guess**.

1. **Default access token lifetime.** Dashboard-configurable under the
   application's Sessions tab; WorkOS does not publish the default. Read the
   actual value and pick deliberately: shorter means role changes land sooner
   (§4.2) and costs more refreshes.
2. **Inactivity timeout.** Same page, also unpublished. Determines how long a
   till can sit idle before staff are signed out — a real operational concern
   for a shop that opens at 9am with yesterday's browser still open.
3. **Full `reason` enum from `.authenticate()`.** Only
   `no_session_cookie_provided` is directly documented. Others were reported
   second-hand and are unverified. Handle unknown reasons as "not
   authenticated" rather than switching exhaustively on the value.
4. **`portal.generateLink` intents.** Reported as `sso`, `dsync`,
   `audit_logs`, `log_streams`, `certificate_renewal`, `domain_verification`,
   but not confirmed from primary documentation. Check
   `https://workos.com/docs/reference/admin-portal`.
5. **Roles/permissions API endpoints.** WorkOS docs confirm roles are
   manageable by API as well as Dashboard, but the endpoint list was not
   obtainable. If roles must be created programmatically (for seeding a dev
   environment reproducibly), check `https://workos.com/docs/reference/roles`.
   Otherwise create the four roles in the Dashboard once and document it.
6. **Whether Decision 3 survives contact with §7.** The one-user-pool choice
   trades a structural trust boundary for a predicate. It is cheap to reverse
   now and expensive to reverse later.

---

## 15. Pre-existing issues found during this design

Not caused by this work and not fixed by it, but they surfaced while mapping
the auth system and someone should know.

- **The storefront owner-preview feature does not work.**
  `server/storefront.js:85` takes a third `sessionShopId` parameter, but the
  only production caller — `server/server.js:3441` — passes two arguments. So
  `sessionShopId` is always `undefined`, `shop.id !== sessionShopId` is always
  true, and an owner can never preview a disabled storefront. Only the tests
  pass the third argument, so the suite is green while the shipped behaviour
  (commits `8ee6553`, `9f88409`) is broken. This is a live example of a test
  passing while the feature does not work.
- **No CSRF protection** beyond `SameSite=Lax` on state-changing routes.
  AuthKit does not change this; the app's own POST routes still need it.
- **Session tokens are stored in the clear** in `sessions.token`. Moot after
  this migration — the table is dropped — but true today.
- **`attachRoles` and `deactivateTeamMember`** update `employees` filtered on
  `id` alone without `shop_id`. Safe only because `employees` is RLS-protected
  and those run inside `runWithShop`, unlike `logins`, which is not. The
  asymmetry between the two tables is exactly what caused `5cdd4fd`, and it is
  still there.
- **No way to transfer shop ownership** or promote a second owner. §6's role
  model should fix this in passing — with roles on memberships, granting a
  second `owner` is just a role assignment.
