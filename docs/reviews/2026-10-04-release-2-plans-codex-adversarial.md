# Codex adversarial review — Release 2 build plan and the two-person split

**Model:** gpt-6-astra (Codex CLI 0.156.1). **Run:** 4 Oct 2026 via `codex exec`, read-only sandbox, on `origin/main` at `a7958bb` plus the uncommitted split plan. **Targets:** `docs/superpowers/plans/2026-10-03-release-2-build-plan.md` (P) and `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md` (S) as first written, with the questions file, `CLAUDE.md`, the programme and offline specs, the design-readiness records and the code. Prompt: instructed to take no claim as given and cite every finding.

Claude checked the main evidence against the code on 4 Oct: the screen-trace check reads only `server/server.js`; migrations are tracked by filename; the decisions give nine switches; `createSale` still writes `sales`/`sale_items`; the till snapshot still converts pounds with `ROUND(price * 100)`; workshop quotes are `NUMERIC(10,2)`; `mockup-gaps.md` lists 95 not-drawn pages. All held. Line numbers below refer to the files as they were at `a7958bb`; S line numbers refer to the split plan before it was corrected for these findings.

---

**The plan is not ready for an uninterrupted two-person build.** Stage 0 is close, but the operating rules, migration policy and route-extraction safeguards need correcting first.

Read-only review; no files changed. I ran 16 focused plan-coverage and screen-trace tests: all passed. Full application/browser tests, current GitHub PR status, hosted infrastructure and external accounts remain **unverified**.

Below, **P** means [the build plan](docs/superpowers/plans/2026-10-03-release-2-build-plan.md), and **S** means [the split plan](docs/superpowers/plans/2026-10-04-release-2-two-person-split.md).

1. **There are competing instructions for how the build runs — BLOCKER**

   **Evidence:** S:151 says “Feature pull requests don't touch `STATUS.md` or the board”; [CLAUDE.md:46–48](CLAUDE.md:46) requires updates “after every pull request opens or merges.” S:320–321 still labels Jack’s agreement to the status and order changes “Open.” [CLAUDE.md:14–18](CLAUDE.md:14) directs builders to the original order and requires Jack’s explicit start instruction.

   **Fix:** Approve and commit one authoritative operating order, updating CLAUDE.md and STATUS together. Record Mark’s agreement to the programme/business-plan scope change too; the programme still calls that joint decision unresolved at [programme spec:132–141](docs/superpowers/specs/2026-09-27-release-2-design.md:132).

2. **The migration-number rule contradicts its own immutability rule — BLOCKER**

   **Evidence:** S:91–96 says the second PR renumbers before merging, but also “once a file has run anywhere, it keeps its name.” Local testing normally runs it before merge. The runner records `filename TEXT PRIMARY KEY` and skips only `appliedSet.has(file)` at [run-migrations.js:62–77](server/migrations/run-migrations.js:62).

   Renaming an applied migration makes it appear new. A duplicate-number check cannot detect that, changed contents under an existing filename, or historical ordering differences.

   **Fix:** Allocate numbers before first application, with no reuse; alternatively explicitly permit rebuilding disposable branch databases after renumbering. Hosted/shared databases must receive only immutable migrations, with an upgrade test from the previous main schema.

3. **WP-0.4 needs an extraction design and a non-vacuous acceptance check — BLOCKER**

   **Evidence:** S:77–84 promises `register(route)` and unchanged tests. Routes currently depend on shared helpers, including `checkJobSlot` used by workshop and booking at [server.js:2988,5686](server/server.js:2988), and process-wide state: `pendingShopifyPushes = new Set()` and request-local cleanup at [server.js:161,246–251](server/server.js:161). Dispatch passes different arguments for till, portal and staff handlers at [server.js:6501,6542,6594](server/server.js:6501).

   Worse, [assert-screen-trace.mjs:94](scripts/ci/assert-screen-trace.mjs:94) reads only `server/server.js`. I verified that an empty source passes.

   **Fix:** Specify shared modules, singleton ownership, handler signatures and registration order before moving code. Update discovery and assert a complete route inventory—including the 15 helper-generated actions—instead of treating unchanged green tests as proof.

4. **The first-week schedule already violates the handoff it promises — BLOCKER**

   **Evidence:** S:116–117 requires Mark’s server half to merge before Jack starts screens. Yet S:329–334 starts Jack’s WP-0.2 screens before Mark’s WP-0.2 server work, which comes between 1.1 and 1.2. S:172 specifically makes the client retry key depend on the server contract. S:252–255 also forbids starting the next stage before its check.

   **Fix:** Publish one dependency schedule that closes stage 0 before stage 1 and respects the retry-contract dependency. Replace “so he never waits” with a list of genuinely ready tasks.

5. **The reordered foundations and workshop work will require rework — SHOULD-FIX before stage 1**

   **Evidence:** S:268–274 puts Today and sign-in before sites, offline storage and live updates. P:291 nevertheless requires `till-checkin-offline`; P:242–244 requires the current site on every request. S:283–293 pulls forward “Who did what,” sign-off, notes and printing. Q3 requires sign-off by the person identified “by PIN on a shared computer” at [questions:44–47](docs/decisions/2026-10-03-build-plan-questions.md:44); [walk-through decisions:25–31](docs/decisions/2026-10-03-ux-walkthrough-8.md:25) require live notes and conflict handling.

   **Fix:** Gate each pulled-forward item on identity, settings/activity, site scoping, messaging, printing and live-update contracts as applicable. Existing visual blocks do not establish those dependencies.

6. **“Four roles and eight switches” is already stale — SHOULD-FIX before WP-1.1**

   **Evidence:** P:201–205 specifies eight switches. [Owner setup:63–82](docs/decisions/2026-09-30-owner-setup-review.md:63) specifies five, adds settings, then two workshop switches; [line 272](docs/decisions/2026-09-30-owner-setup-review.md:272) adds “Can see costs and margin”: **nine**.

   Actual authentication inserts `is_owner` at [auth.js:74–75](server/auth.js:74); `/me` exposes `isOwner`, not the four-role model, at [server.js:380–388](server/server.js:380). Conversely, the employee/login link already exists, but is nullable, in [013_link_employee_logins.sql:1–10](server/migrations/013_link_employee_logins.sql:1).

   **Fix:** Enumerate the complete role/switch matrix, defaults, old-account migration and device-PIN permissions. Explicitly cover workshop, till-only online orders and cost-data access on server routes.

7. **“Shops everywhere” must distinguish tenants from physical sites — SHOULD-FIX before stage 1**

   **Evidence:** P:242 calls this “Shops (sites).” Existing `sites` carry a tenant `shop_id`, while tills carry both `shop_id` and `site_id`: [036_till_offline_core.sql:17–37](server/migrations/036_till_offline_core.sql:17). Existing stock sync still executes `UPDATE products SET stock_qty = stock_qty - ?`, without site stock, at [sync.js:175–183](server/till/sync.js:175).

   The RLS checker discovers only tables containing `shop_id` and checks ENABLE/FORCE flags, not policy correctness: [assert-rls-coverage.mjs:29–46,73–79](scripts/ci/assert-rls-coverage.mjs:29).

   **Fix:** Define tenant, site and permitted-site context before either builder adds tables. Require isolation tests for new tables, references, background work and site selection; retain tenant RLS and use the existing per-tenant backfill pattern.

8. **WP-1.6 understates the migration to one sales record — SHOULD-FIX before WP-1.5/1.6**

   **Evidence:** P:263–266 says “Move the till … onto … `till_sales`.” But `createSale` writes `sales` and `sale_items` at [server.js:1825,1841](server/server.js:1825); workshop conversion calls it and updates `converted_sale_id` at [server.js:2337–2358](server/server.js:2337); dashboard queries still read `sales` at [server.js:5286–5304](server/server.js:5286). Shopify order handling also calls `createSale` at line 1920.

   Snapshot prices still convert pounds using `ROUND(price * 100)` at [snapshot.js:16](server/till/snapshot.js:16). Workshop quote amounts remain `NUMERIC(10,2)` at [017_workshop_quotes.sql:45](server/migrations/017_workshop_quotes.sql:45).

   **Fix:** Inventory every writer, reader, foreign key and money conversion, including history, reports, workshop labour and integrations. Specify compatibility during migration and reconcile totals before declaring one sales record complete.

9. **The offline server core is real; an offline till is not yet proved — SHOULD-FIX before completing stage 1**

   **Evidence:** Sync returns per-item `failed` results at [sync.js:269–270,294](server/till/sync.js:269). The approved spec requires restart without internet, persistent storage, protected pending sales and retained failures at [offline spec:92–99,148–158,202–205](docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md:92). P:263–271 compresses this into one package with no screen of its own.

   **Fix:** Give WP-1.6 explicit browser acceptance gates: cold offline reload, durable receipt allocation, multiple tabs, lost replies, server outage, failed-item retention and recovery after upgrades. Rehearse on separate test tills; dropping production practice mode does not remove the need to rehearse.

10. **Import feasibility and reconciliation are postponed too far — SHOULD-FIX before stage 1 data contracts**

   **Evidence:** [Programme spec:107–113](docs/superpowers/specs/2026-09-27-release-2-design.md:107) calls export sufficiency “the largest risk and the cheapest to check.” [Q4:118–121](docs/decisions/2026-10-03-build-plan-questions.md:118) confirms only Excel, not available datasets. P:415–418 guesses products/stock/customers/bikes; P:881–904 leaves refresh and running alongside until stage 8.

   Neither import package explicitly assigns historical sales, although the agreed weekly check compares “sales total, number of sales” at [Moving decisions:43–49](docs/decisions/2026-09-30-moving-from-citrus-lime-review.md:43).

   **Fix:** Check representative exports, identifiers, site stock, sales and outstanding balances early, with Jack handling real data. Assign missing import scope and move repeated reconciliation alongside the relevant stages.

11. **File ownership names bottlenecks rather than removing them — SHOULD-FIX before parallel work**

   **Evidence:** S:50–68 gives Mark API types/client, server tests and all helpers, but gives Jack full-stack workshop work. [tests/helpers/staff.js:15–29](tests/helpers/staff.js:15) directly depends on auth; [client.ts:102–108](src/lib/api/client.ts:102) contains workshop actions. Mark’s `mv-start` and accounts screens must register in Jack’s `SCREENS` map at [app-shell.tsx:22–26](src/staff/app-shell.tsx:22).

   S assigns `registry/**` but omits generated `public/r/**`, which CI compares at [check-registry-drift.mjs:28–29](scripts/ci/check-registry-drift.mjs:28). S:218 also gives Jack booking-server work outside his stated exception.

   **Fix:** Define coordinated exceptions for fixtures, workshop contracts/tests, booking and screen registration; assign generated assets. Retire legacy fields only after checking all consumers: `status` is explicitly retained for both the old app and booking pages at [server.js:2433–2436](server/server.js:2433).

12. **Design coverage is not complete interaction coverage — SHOULD-FIX before each affected package**

   **Evidence:** [mockup-gaps.md:5–7](docs/design/user-journeys/mockup-gaps.md:5) lists **95** destinations without drawings and says each needs disposition. Examples include an unsent sale’s “Fix” at line 18 and payment links at line 59. The plan test checks declared screen/block assignments at [plan-coverage.test.mjs:66–83](docs/design/user-journeys/generator/consolidate/plan-coverage.test.mjs:66), not these missing interactions or backend dependencies.

   **Fix:** Assign each in-scope gap to a package and either an existing pattern, situation or explicit decision. Do not reopen the 21 smaller-screen detours Jack already accepted.

13. **WP-0.5 lacks deployment and recovery acceptance criteria — SHOULD-FIX before WP-0.5**

   **Evidence:** S:175 says deploy main on every merge; S:57–58 assigns PITR and a rehearsed restore without scheduling their completion. Current defaults require direct/session pooling; transaction mode can acknowledge success before commit: [db.js:319–334](server/db.js:319). Attachments also live on disk: [server.js:3895–3907](server/server.js:3895).

   **Fix:** Specify pooler mode, durable uploads, deployment/migration sequencing, rollback, test-data isolation and disabled real integrations. Schedule a timed database **and attachment** restore before real use; hosting approval and the recorded residency decision remain unverified.

14. **A fake payment provider does not settle the card-machine requirement — SHOULD-FIX before payment contracts**

   **Evidence:** [Till decision 6:41–51](docs/decisions/2026-09-29-selling-at-the-till-review.md:41) requires sending amounts and receiving approval/decline; manual entry is fallback. Refunds also require the connected machine at lines 63–66. [Q7:122–125](docs/decisions/2026-10-03-build-plan-questions.md:122) leaves model, integration and offline behaviour unknown.

   **Fix:** Verify the actual Paymentsense terminal and supported integration, including refunds and recovery after an uncertain result. Keep terminal payments distinct from online payments; recording “card” offline does not establish that the terminal approved payment.

15. **The final release gate is both overbroad and incomplete — SHOULD-FIX before stage 8**

   **Evidence:** P:912–913 requires “every row of §5 real,” but §5 includes Lightspeed, explicitly deferred at P:923. Conversely, [Q9/Q12:82–85,101–105](docs/decisions/2026-10-03-build-plan-questions.md:82) require wording, professional checks and retention decisions without corresponding completion tasks. P:66–70’s “240 pull requests” predates the split’s contracts, cleanup and daily status PRs.

   **Fix:** Create a named, dated release checklist covering required accounts, wording, retention, accounting checks, recovery and reconciliation, explicitly excluding deferred work. Treat 240 PRs as an unverified estimate; measure throughput after foundations before forecasting completion.

**Verdict:** **No, not as written.** Stage 0 can start after findings 1–4 are resolved and Jack explicitly authorizes the build. Later work can proceed safely with the remaining findings attached as package gates; the promise of proceeding without further stops is currently unsupported.

**Claims checked and found TRUE:**

- `server.js` has 6,861 lines and 146 literal route registrations; there are also 15 generated workshop actions. Dispatch is first-match. Extraction is feasible with the safeguards above.
- Migration 036 and `server/till/` implement a substantial server core: pence/VAT storage, duplicate handling, PIN hashes, snapshots, attention records and negative-stock handling.
- Migrations run in filename order under an advisory lock.
- CI includes typecheck, lint, build, registry drift, RLS coverage, browser tests and design checks.
- All 47 declared building blocks pass the plan’s assignment/order test. The coverage script reports zero empty journey/person cells.
- Practice mode, supplier browsing and Lightspeed deferrals are recorded decisions; the 21 phone/tablet detours are explicitly accepted.
- Jack’s recorded answers settle sign-off through “Mark ready” and the ten-minute workshop idle timeout.