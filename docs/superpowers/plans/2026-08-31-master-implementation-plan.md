# Wheelhouse EPOS — master implementation plan

**Date:** 31 August 2026
**Status:** LOCKED. Changes to this file are decisions, not edits — record what
changed and why at the bottom.
**Owner:** Jack (project). Mark (platform, helping — see §7.)

This is the single document to work from. It states what we are building, the
order, who owns each piece, and the command that proves each piece is done.

**It supersedes the sequencing in** `docs/superpowers/specs/2026-08-31-system-build.md`
**and Stage 1 of** `docs/superpowers/specs/2026-08-31-workshop-first-build.md`,
following the corrective architecture review of the same date. Those documents
remain valid for their detail; this one is authoritative for order and scope.

**Reads as background, not required:**
`docs/decisions/2026-08-31-business-plan.md` (buyer, price, gates, ownership,
design partners) · `research/business/strategy.md` and
`business-research.md` (PR #7) · `docs/reviews/2026-08-31-architecture-stage-1-review.md`.

Confidence tags: **[V]** verified · **[R]** reported · **[U]** unverified ·
**[NF]** searched, not found.

---

## 1. What we are building, in one paragraph

A hosted point-of-sale and workshop system for independent bike shops. The buyer
wants to work on bikes and make money, does not care about technology, and is
price-sensitive. We lead with the **workshop module, given away free**, running
alongside whatever till the shop already has; the paid product is the full system
at one flat price in the £49–79/month band. The differentiator is the **experience**: obviously
simpler than anything else a shop can buy, and a **job-done email** that tells
the customer in plain English what was done, itemises the price, invoices it, and
lets them pay in one tap. Structured inspection follows as the same machinery
pointed at the middle of the job rather than the end.

## 2. The five things that are true and must stay true

1. **Postgres forced row-level security is the tenant boundary.** It is not
   weakened, replaced, or supplemented by application-only `WHERE shop_id`.
2. **The server is the authority.** A rule that exists only in the browser is not
   a rule. Every constraint gets a server-side test a raw HTTP call cannot bypass.
3. **Evidence before assertions.** Nothing is "done" until the command that
   proves it has been run and its output seen. An absent check is not a passing
   check.
4. **Simple is a gate.** A shop owner who has never seen the system completes a
   cash sale, adds a product, and books a job — unaided, watched, not
   self-reported. Anything that cannot survive that does not ship to this buyer.
5. **This is Jack's project.** Mark builds what Jack would never choose to own.
   See §7.

## 3. Verified current state

**Real and working [V]:** single Node process, one runtime dependency (`pg`);
Postgres multi-tenancy with 25 tables RLS-enabled and FORCEd, cross-shop reads
returning nothing and writes rejected; till, inventory, sales history, dashboard,
workshop diary with per-mechanic columns, customer booking portal, purchase
orders with split deliveries, Shopify integration, storefront, Electron print
agent. CI on every push, 89/89 green.

**Scaffolded, unused [V]:** Vite 8 + React 19 + TypeScript + Tailwind 4.3.3 with
a shadcn registry behind four mutation-tested gates (PR #9). Nothing renders
through it.

**Known defects [V]:**

| # | Defect | Evidence |
|---|---|---|
| D1 | **Cross-tenant foreign keys.** Tenant A can insert a row referencing tenant B's hidden row, because FKs use global `id` and PostgreSQL referential-integrity checks bypass RLS | Rolled-back probe in the review |
| D2 | Seven tables have no RLS: `shops`, `logins`, `sessions`, `customer_logins`, `customer_sessions`, `uploaded_image_types`, `schema_migrations`. Isolation depends on every query remembering a manual predicate; commit `5cdd4fd` proves that is not durable | Review |
| D3 | `set_config(..., false)` is session-scoped, in `server/db.js:111` **and** `server/auth.js:104` | Review |
| D4 | No pool checkout timeout. With all ten clients busy, acquisition waits unbounded | Review |
| D5 | Shopify events are claimed before the work succeeds — a failure then a retry skips the work permanently | Review |
| D6 | No idempotency key on irreversible writes, including sale completion | Review |
| D7 | Two outbound `fetch()` helpers with no abort signal; network I/O holds database clients on more paths than sale completion | Review |
| D8 | No SIGTERM/SIGINT handling, no crash guard, no database-backed health endpoint | Review |
| D9 | Diary rules — overlap, opening hours, working days, complete-job lock — are enforced in `public/app.js` only, for staff routes | Code inventory |
| D10 | Zero tests touch workshop behaviour | Code inventory |
| D11 | Portal `/bookings` returns `orderId`, `orderStatus`, `orderTotal` to the customer; `notes` has no internal/visible split; guest booking matches an existing customer by unverified phone alone | Code inventory |
| D12 | No email capability of any kind, including password reset | Code inventory |
| D13 | README describes SQLite, `data/shops/` and port 4000 | Code inventory |

## 4. Decisions locked by the architecture review

These reverse or constrain earlier design work. They are not open.

1. **No request-wide transactions.** Not with savepoints either. `runWithShop`
   enters before handlers read bodies and handlers await Shopify and Twilio; an
   outer transaction would stay open across client input and external retries.
2. **PgBouncer transaction pooling is unsupported.** Stage one supports direct
   managed PostgreSQL connections or session pooling only. Transaction pooling
   fails deployment review until measured pressure justifies it *and* tenant
   state lives in short explicit transactions. This applies directly to hosted
   Postgres: **Neon, Supabase, Aiven and DigitalOcean all default their pooled
   connection string to transaction mode** and document that session `SET` state
   does not survive **[V]** — so we use the direct/unpooled string.
3. **`DISCARD ALL` is cleanup hygiene for direct and session pooling only.** It
   is not transaction-pooling compatibility and must never be described as such.
4. **Tenant relationships are enforced in the schema**, by composite foreign keys
   against `(shop_id, id)`, applied systematically — not by a hand-picked subset
   and not by application validation, which stays only for friendly errors.
5. **Resolver tables get a database privilege boundary** — hardened
   `SECURITY DEFINER` functions with a fixed `search_path`, and the request role
   loses direct table access.
6. **Readiness and liveness are separate.** Readiness touches the database and
   controls routing; liveness reports the event loop and must not restart every
   replica during a shared database outage. The item is not closed until
   deployment config points at the endpoint.
7. **The frontend scaffold is not a prerequisite** for data-safety work and is
   sequenced independently. It is already merged, so this is historical — do not
   unwind it.
8. **Pool sizing is measured, not guessed.** Budget:
   `replicas * pool_max <= 70–80% of usable PostgreSQL connections`.

## 5. Phases

Each task has an ID, an owner, and a **done-condition that is a command or an
observable artefact**. Phases are ordered; tasks within a phase may run in
parallel unless a dependency is stated.

### P0 — Data safety. Blocks everything.

No design partner touches the system until P0 is complete. D1 and D2 are live
isolation defects.

| ID | Task | Owner | Done when |
|---|---|---|---|
| DS-0 | Revise `docs/superpowers/plans/2026-08-31-architecture-stage-1.md` and `.claude/workflows/wheelhouse-architecture-stage-1.js` per `docs/reviews/2026-08-31-claude-architecture-stage-1-revision-prompt.md`. Plan and workflow only — no production code | Mark | Both files meet the eleven acceptance criteria in the revision prompt |
| DS-1 | Make tenant state transaction-local. Every runtime `set_config` site, found by search, not assumption — includes `server/db.js` and `server/auth.js` | Mark | `grep -rn "set_config" server/` shows no `false` third argument; tests prove context does not leak between requests on a reused client |
| DS-2 | Safe client cleanup before local pool release: roll back abandoned transactions, reset `app.current_shop_id`, destroy the client if cleanup fails | Mark | A test that deliberately leaves a transaction open proves the next checkout is clean |
| DS-3 | Record transaction pooling as unsupported, in the plan and in deployment docs | Mark | Written, and the connection string in use is the direct/unpooled one |
| DS-4 | **Composite tenant foreign keys.** Unique `(shop_id, id)` on every tenant-owned parent; convert every tenant relationship to a composite FK. Designed for existing data: audit query, then add/backfill/validate | Mark | The review's cross-tenant probe fails at the database. An adversarial test attempts a cross-tenant reference for **every** converted relationship and all are rejected |
| DS-5 | **Resolver privilege boundary.** `SECURITY DEFINER` functions with fixed `search_path` for session resolution, tenant-qualified login verification, shop-slug resolution, session create/destroy, controlled account and shop creation. Revoke underlying table access from the request role. Covers staff and customer auth | Mark | The app role cannot `SELECT` directly from `logins`, `sessions`, `customer_logins`, `customer_sessions`; adversarial tests per function |
| DS-6 | `uploaded_image_types` policy: ownership, deletion, abuse response. It is a 192-bit bearer capability with a one-year immutable cache — not a demonstrated leak, but not revocable either | Mark + Jack (policy) | Written decision, plus a deletion path that works |
| DS-7 | Fix D11 — the three portal data exposures | Jack (paired) | Tests assert the portal response contains no order fields; internal notes are not sent; guest booking cannot attach to an existing customer on phone alone |
| DS-8 | **Workshop server-side enforcement** — lift overlap, opening hours, working days and the complete-job lock from `public/app.js` into `POST`/`PUT /api/workshop-jobs`. The logic exists at `server/server.js:3238-3261` | Jack (paired) | Raw HTTP tests: double-book rejected, 03:00 rejected, closed Sunday rejected, edit to a complete job rejected |
| DS-9 | **First workshop tests.** Jobs, diary rules, availability, portal booking, attachments. Written first, each mutation-tested — break the code, watch it fail for the right reason, restore | Jack (paired) | Test count rises; every new test has a recorded failing run |

**P0 exit gate:** every done-condition above observed, CI green, and the review's
two probes (nested transaction, cross-tenant FK) re-run and behaving correctly.

### P1 — Platform and operations

| ID | Task | Owner | Done when |
|---|---|---|---|
| PL-1 | Choose hosting and managed Postgres. Blocked on the UK-versus-EU residency decision (§10) | Mark | Decision recorded in `docs/decisions/` |
| PL-2 | **Managed PostgreSQL with true point-in-time recovery**, direct/session connection string | Mark | Provider console shows PITR enabled with a stated window |
| PL-3 | **Restore drill — Jack's hands, Mark's eyes.** Restore to a timestamp, verify data, record elapsed time | Jack, watched by Mark | A dated runbook in `docs/runbooks/` with the measured restore time. **Reports `blocked`, never `done`, until actually performed** |
| PL-4 | Advisory lock around migration discovery and execution | Mark | Two concurrent migration runs; one waits, neither corrupts |
| PL-5 | Pool checkout timeout (`connectionTimeoutMillis`) plus instrumentation: `waitingCount`, `totalCount`, `idleCount`, checkout latency, lease duration, idle-in-transaction age | Mark | Metrics visible; a saturation test returns a bounded error rather than hanging |
| PL-6 | `AbortSignal.timeout()` on both outbound fetch helpers; remove database leases from **every** path that awaits Shopify or Twilio inside `runWithShop`, not only sale completion | Mark | Test with a hung endpoint returns within the timeout and holds no client |
| PL-7 | **Sale idempotency** — client-generated key, unique per shop, on irreversible mutations | Mark | Duplicate submission creates one sale |
| PL-8 | **Shopify outbox**, RLS-protected, committed with outgoing state changes and processed outside the request's lease | Mark | Killing the process mid-push leaves the outbox row for retry |
| PL-9 | **Retryable inbound Shopify events** — `claimed` distinct from `completed`, failures reclaimable. Fixes D5 | Mark | A failed processing run followed by a retry completes the work |
| PL-10 | Bounded SIGTERM/SIGINT drain; fatal errors logged before non-zero exit | Mark | In-flight request completes on SIGTERM; a forced crash logs then exits non-zero |
| PL-11 | Separate readiness and liveness, **wired into deployment config** | Mark | Compose/host config references the endpoints; a database outage drains routing without a restart loop |
| PL-12 | Deploy pipeline, staging environment, rollback | Mark | A deliberate bad deploy is rolled back, timed, and written down |
| PL-13 | Error tracking, uptime monitoring, public status page. GlitchTip is the candidate — EU data sovereignty on every tier, unlike Sentry which gates residency behind Enterprise **[V]** | Mark | An induced error appears; the status page is public |
| PL-14 | Transactional email provider; password reset as the first real use. Separate sending domain from any future outreach domain | Mark | A password reset email arrives; SPF, DKIM and DMARC pass |
| PL-15 | Rewrite the README. It describes a product we do not sell | Jack | No SQLite, no `data/shops/`, no port 4000 |

### P2 — Product foundations

| ID | Task | Owner | Done when |
|---|---|---|---|
| PF-1 | Self-serve signup and shop provisioning — one URL, one login, no install | Jack (paired on the auth touchpoints) | A new shop signs up and reaches an empty till without human intervention |
| PF-2 | **Workshop-only mode** — a job completes without a linked till sale, because a wedge shop has no till of ours | Jack | A job created in workshop-only mode completes; no orphan `sale_documents` row |
| PF-3 | Print agent installer, signed, one-page setup | Mark | A non-developer installs it from the instructions alone |

### P3 — Workshop table stakes (W1) and the front door

| ID | Task | Owner | Done when |
|---|---|---|---|
| WS-1 | Job status history — who changed what, when. Required for notifications and for the attribution the legal position depends on | Jack (paired) | Every transition recorded with actor and timestamp |
| WS-2 | Automated status-triggered messaging, SMS and email, per-shop templates. `customer_messages` already carries `direction` and `provider_sid` for this | Jack | Booking confirmation, ready-for-collection and waiting-for-parts messages send and are logged |
| WS-3 | Internal versus customer-visible notes | Jack | Internal notes never appear in a portal response — asserted by test |
| WS-4 | Customer-level service history, not only per-bike | Jack | A job with no bike attached appears in the customer's history |
| WS-5 | Booking cancel and reschedule by the customer; reject with a reason by the shop | Jack | New statuses exist; both paths tested |
| WEB-1 | Public website: what it is, the free workshop, pricing, who we are, help, changelog, status, contact. Plain English, acronyms spelled out | Jack | Live, and a non-technical reader can say what it does |
| WEB-2 | Legal set: shop privacy notice, rider privacy notice, DPA offered to shops, cookie policy, terms | Jack + solicitor | Published |
| FOR-1 | Community forum, private to design partners. **Email-in and email-reply is a hard requirement**; single sign-on from the product account. Discourse's free tier may cover it — 500k pageviews, 20k emails, 2 staff seats **[V]**; Pro is $100/mo **[V]** | Jack | A design partner replies to a thread by email without visiting the site |

### P4 — Design partners, to Gate G2

| ID | Task | Owner | Done when |
|---|---|---|---|
| DP-1 | Ten shop conversations, local, in person | Jack | Written notes per shop in `docs/research/` |
| DP-2 | Recruit three to eight design partners; one-page agreement signed | Jack | Signed agreements |
| DP-3 | In-shop usability test per partner — the §2.4 gate, watched | Jack | Recorded pass or fail per shop, with what broke |
| DP-4 | WhatsApp group and the monthly fifteen-minute call running | Jack | Three months of cadence held |
| DP-5 | Usage instrumentation — G2 is thirty days of real jobs, not signatures | Mark | A dashboard showing jobs booked per shop per week |
| DP-6 | Madison trade account opened; the credit review is the slow part | Jack | Account open or explicitly refused |

**G2:** three shops running the free workshop on real jobs for thirty days.

### P5 — The experience, and the job-done email

Revised 31 August 2026: the differentiator is the experience, not the structured
inspection. The inspection is the same machinery aimed at the middle of the job
and follows in P5b. Business plan §5d has the reasoning and the three simplicity
tests.

**Blocked on the payments decision (§10.4) before CX-4 can start.**

| ID | Task | Owner | Done when |
|---|---|---|---|
| CX-0 | **Labour lines** — a time and a rate, not a fake product row. Still the prerequisite; touches the till | Mark + Jack | A job carries labour without inventing a product |
| CX-1 | **Plain-English job summary.** What was done, written for a customer, generated from the job rather than composed by hand | Jack | Three real completed jobs produce summaries a non-cyclist understands |
| CX-2 | Photos from the job attached to the summary. EXIF GPS stripped server-side on ingest | Jack (Mark on ingest) | A photo taken outdoors carries no location data after upload |
| CX-3 | **Itemised pricing and an invoice** on the summary — parts and labour separated | Jack | Invoice totals reconcile against the job's order |
| CX-4 | **Pay in one tap.** Shop keeps its own choice of processor; no coercion, no undisclosed cut | Mark | A customer pays from the email; funds reach the shop, not us |
| CX-5 | **The job-done email itself** — assembled from CX-1 to CX-4 and sent on completion | Jack | Customer test 3 in business plan §5d passes on real customers |
| CX-6 | **Mechanic-flow test.** Start, record, complete a job with the bike in front of you. Count taps, measure time | Jack | Test 2 in §5d passes, with the numbers written down |
| CX-7 | Append-only attributed entries; dispute flag with right of reply; no customer edit of a professional's entry | Mark (model), Jack (surface) | Attempted edit of another party's entry is rejected |

### P5b — Structured inspection (was the differentiator, now the extension)

| ID | Task | Owner | Done when |
|---|---|---|---|
| INS-1 | Reusable checklist templates per shop. Content authored by Jack | Jack | A shop can create and run its own checklist |
| INS-2 | Itemised estimate from flagged items, each line individually approvable or declinable | Jack | Customer approves two of four lines; only those two land |
| INS-3 | Approved lines flow into the job's linked order with no re-entry | Jack | No double keying, asserted by test |

### P6 — Paid product, to Gate G3

| ID | Task | Owner | Done when |
|---|---|---|---|
| TILL-1 | Refunds, voids, returns | Jack (paired) | A sale can be reversed; stock returns |
| TILL-2 | Cash-up / Z-report | Jack | End-of-day figures reconcile against a seeded day |
| TILL-3 | CSV export of everything | Jack | A shop exports its whole dataset unaided |
| TILL-4 | VAT as stored data; date-range reporting | Jack (paired) | A VAT return period can be produced |
| TILL-5 | Permissions model | Mark | A non-owner cannot reach owner functions — tested by raw HTTP |
| BIL-1 | Billing. Not before G3; the first three shops are invoiced by hand | Mark | First recurring payment collected |
| BIKE-1 | Richer bike record: year, size, wheel size, groupset, e-bike system, purchase date, photo; index `serial_number` | Jack | Fields present and searchable |
| BIKE-2 | Spec autofill, subject to 99spokes terms (§10) | Jack | A model lookup populates components, or the task is closed as blocked |
| BIKE-3 | **Shop-verified service facts** — hanger, bottom bracket standard, rotor mount, chain speed, tyre and valve. Captured once, reused forever. No data source sells these **[V]** | Jack | Second visit pre-fills from the first |
| BIKE-4 | Recall and safety-notice tracking by model and serial — unclaimed by any competitor **[NF]** | Jack | A recall flags matching bikes |

## 6. Frozen until after G3

Storefront and Duda, custom domains and DNS, distributor feeds, Shopify App
Store listing, offline mode, multi-site, product variants, the rider-owned
shareable bike record, marketing automation and cold outreach, a second
vertical, non-UK markets. The rider record is the leading G3 unlock candidate.

## 7. Ownership

Full rules in business plan §5c. In short:

**Mark:** data model and migrations, RLS and tenancy, auth, server rules and API
contracts, platform, deploys, backups, security, email and billing integration.
Reviews everything Jack merges.

**Jack:** the workshop domain specification, all product surfaces, every
customer-facing word, design partners and usability testing, the website, the
forum, the changelog.

**Mark does not build product features Jack could build more slowly.** Mark's
default is a question, not a patch. **Jack merges everything, including Mark's
work** — if Mark cannot explain a change to Jack, it is too clever for this
codebase. Product disagreements: Jack wins. "This will lose customer data":
Mark wins.

**Bright line:** Jack does not touch `server/`, migrations, RLS, auth, billing or
deploys through P0–P3; he pairs on them throughout and **owns them from P4**.

## 8. Platform stack

Recommended, roughly $155–170/month: app hosting on Render (Frankfurt) or Fly
(London), Neon Launch for Postgres with true PITR — **direct connection string,
not the pooled one** — Mailgun for email (the only provider with a stated EU
region toggle **[V]**), Discourse for the forum, GlitchTip for errors, free-tier
uptime monitoring, Stripe payment links instead of a billing product.

Cheapest defensible: Hetzner at roughly €15–25/month — but only once WAL-based
PITR has been built, restore-tested and timed, and Hetzner has no UK datacentre.

## 9. Compliance deliverables

Shop privacy notice · rider privacy notice · DPA for shops · cookie policy ·
terms · DPIA or a documented screening decision · records of processing ·
legitimate interests assessment · retention schedule · Article 26 arrangement
before any shop writes into a rider-owned record · solicitor review, the
joint-controller question first.

Structural rules already in the data model: append-only attributed entries,
dispute flag rather than deletion, retention split between rider view and the
shop's legal copy, EXIF stripped on upload, opt-in marketing honoured within ten
business days, no marketing SMS to a US number without a compliant consent flow.

## 10. Open decisions — all blocking something

1. **Two weekly time budgets**, Jack's and Mark's, and the ratio. Blocks every
   date in this plan.
2. **UK or EU data residency.** Blocks PL-1 and PL-2.
3. **Domain name.** Blocks the website, the product URL and the sending domain.
4. **Payments architecture** — the shop's own processor versus a Connect-style
   platform. The largest unscoped item in the plan. **Blocks CX-4 and therefore
   P5.** See business plan §5d.
5. **99spokes terms** — price, whether we may cache, whether we may redisplay.
   Blocks BIKE-2 only; BIKE-3 proceeds regardless.
6. **Is the job-done email free or paid?** It is now the strongest thing in the
   product and giving it away may be wrong.
6. **Forum public or private at launch.**
7. **Final price**, set at G3.

## 11. Change log

| Date | Change |
|---|---|
| 2026-08-31 | Created. Supersedes the sequencing in the system-build and workshop specs following the corrective architecture review. Adds P0 as a blocking phase on the strength of the verified cross-tenant foreign-key defect. |
| 2026-08-31 | **Differentiator changed** after review with Jack: the experience, not the structured inspection. P5 rebuilt around the job-done email — plain-English summary, photos, itemised pricing, invoice, pay in one tap. Inspection demoted to P5b as an extension of the same machinery. Adds the payments architecture as a blocking open decision. |
