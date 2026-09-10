# Release 1 implementation plan — draft, revised after second adversarial review

> **Superseded after review with Jack:** use the [narrowed Release 1 plan](../superpowers/plans/2026-09-10-release-1-workshop-plan.md) and [scope decision](../decisions/2026-09-10-release-1-scope-reduction.md). The 172-row scope and gates below are historical.

Date: 10 September 2026. **DRAFT — do not execute as an approved replacement for the locked master plan.** Revised the same day after the Claude Fable 5.1 review; Jack's decisions in the register below remain open.

Build Jack’s selected 172 rows as coherent workshop workflows, reusing the working application. Split into the packages below, then into bounded PRs. Keep his 102 Later and 43 No rows intact. The original R1 order is retained for traceability but replaced here by a proposed dependency order. This document is deliberately in `docs/reviews/`: approval and a recorded amendment to the master plan come after Jack’s decisions.

Read the [Claude Fable 5.1 review](2026-09-10-ranked-release-claude-review.md). Read with [the adversarial findings](2026-09-10-ranked-release-adversarial-review.md), [the full row-to-package CSV](2026-09-10-ranked-release-traceability.csv), and [Jack’s exact source comment](2026-09-10-ranked-release-source.md). All 172 selected rows have exactly one primary package; overlapping requirements retain all source IDs without duplicate implementation. Package IDs W00–W18 are unchanged so the CSV remains valid.

## Change log — second review (Claude Fable 5.1, 10 September 2026)

| ID | Change | Why |
|---|---|---|
| C01 | W01 split into W01a tenant integrity and W01b group foundation; W02/W03/W04 now depend on W01a only | D08 (chain scenario) was accidentally gating staff access, job model and catalogue work |
| C02 | W08 and W10 no longer hard-depend on W07; W10 no longer hard-depends on W08. Messaging and approval integration become named later slices | Provider onboarding must not sit on the critical path of the core job workflow |
| C03 | W05 now explicitly requires untimed drop-off and unassigned queue jobs to consume capacity, with a concurrent test and explicit counting rules | Current `mechanicFreeMinutes` and `checkJobSlot` ignore jobs without a start time. The portal still requires a start time and mechanic, so this is a gap for planned drop-off and existing staff untimed jobs, not evidence that public booking accepts unlimited requests today |
| C04 | W02 acceptance made precise for session revocation across deactivate/reactivate | `reactivateTeamMember` restores `active` without invalidating existing sessions |
| C05 | W03 depends on W01a and the current session actor, not on the W02 role model | Smallest vertical slice should not wait for roles |
| C06 | Stale comments in `customer-auth.js` added to W02 scope; guest-duplicate accumulation noted in W15 | Comments claim phone matching that no longer exists |
| C07 | Test and print-agent file references now state that existence was verified by the earlier inspection and that behaviour was not re-tested in this review | Keep inspection provenance separate from untested behaviour |
| C08 | W06 day-view slice moved to stage 3; week/month stays stage 4 | Day view needs only W03 and existing diary code |
| C09 | D09 blocking narrowed to status/label/ageing/custody transitions and cancellation; number floor also flagged D10 | History/version plumbing and job-owned effort do not depend on status semantics; cancellation releases reservations and may notify, so it does |
| C10 | Status corrections added for rows 48 and 49 | Capacity gate exists only on the timed portal path; drop-off is configuration only |
| C11 | First five implementation issues written out as a dependency sequence; I-04 split into decision-free calculation work and D02-gated snapshot semantics | Requested by the review prompt; snapshot semantics must not bypass D02 |
| C12 | Critical path and stage table updated for C01–C03 | Consistency |

No bucket, package ID, row mapping or product decision changed. Recommendations remain recommendations until Jack records a decision.

## Planning baseline

1. This is a plan for a persisted live product, not another simulator. Real payments/messages/integrations require live readiness evidence; simulation is useful for tests and internal demos only.
2. Free software and shop-owned provider accounts are the latest recorded live commercial decision in the [competitive trial §6.3](https://github.com/JackCurphey/wheelhouse-epos/blob/b7034548661c3c83ac958fedcb92cfd76e0736b8/docs/decisions/2026-09-08-competitive-trials.md). No credit resale, subscriptions or paid-tier machinery is added. Hosting/support funding and first release cohort remain decisions.
3. Both POS series, group capacity and online payment remain in this full Release 1 plan because Jack selected them. Demonstrating a subset is an internal milestone, not permission to declare Release 1 complete. External access may dominate elapsed time.
4. Retain Postgres FORCE RLS, existing Node backend, migration runner, gateway and approved frontend direction. Introduce production React screens incrementally (`src/staff/main.tsx` is currently inert; `public/app.js` is the live staff app). `prototype/` supplies examples and scenarios, not storage/auth code to promote wholesale. No general rewrite.
5. Excluded UI features do not authorize removal of existing data or safeguards. Necessary safeguards that conflict with a bucket are explicit decisions below; they are not secretly reclassified.
6. This is an initial breakdown, not a calendar commitment. Team availability, provider access and detailed field contracts are unknown. Packages marked L/XL require several PRs; sizing is relative, not elapsed weeks.
7. Evidence limits: this plan cites code read in review (server.js job/capacity routes, auth.js, team.js, customer-auth.js, migrations 014/015). Test files and the print agent were listed on disk by the earlier inspection, so their existence is verified. Their current behaviour was not run or exercised in this review and must be confirmed when issues are created.

## Decision register — resolve only before affected work

Recommendations are ready for Jack/Mark to challenge; pending does not mean all work stops.

| ID | Decision and recommended interpretation | Blocks |
|---|---|---|
| D01 | Confirm live release/cohort, supported operating modes and commercial precedence. Recommend free/BYO baseline; explicitly record how this release amends master-plan P1/P3/P5 and #16. Assign funding/support ownership. | External release; W13 ownership contract |
| D02 | R1 line approval/re-proposal vs No 169/173 and Later catalogue snapshots 208. Recommend immutable version-bound approvals and booking amount/effort snapshots as internal correctness; decide whether approved work becomes job charges automatically or through reviewed application. Never silently bill declined or stale-approved work. | W04 proposal/booking snapshot semantics and any approval implementation (W08). Amount calculation and #17 labour-stock reproduction proceed. W12 settlement also waits. |
| D03 | R1 phone identity 183. Recommend staff duplicate suggestions plus separate verified guest access; never use a typed number as proof. If automatic identity is wanted, specify verification and recovery. | W02 identity matching and W15 merge; safe new-guest records can proceed |
| D04 | R1 deposit 26 vs Later 233. Recommend one deposit capability with both IDs linked; Jack must resolve bucket conflict. Specify hold/payment/rejection/expiry/refund interaction, amount rule and timing. | W12 deposit slice and W10 deposit enablement |
| D05 | R1 messaging vs Later 151/165. Recommend send-time preferences, revocation/failure visibility and fixed reminder schedules as necessary internals. Choose real email/WhatsApp providers, supported inbound channels and a functioning destination for R1 delivery-link 139 (delivery booking is Later). Define the event behind row 125. | Affected W07 delivery features; templates, outbox and credential storage can be drafted |
| D06 | Resolve row overlaps: drop-off 49 vs No 15; item edit 99 vs Later 185/No 186; service updates 94 vs No 69; R1 job list search/chips vs No table 51. Recommend dual timed/drop-off modes, retained underlying item/service data, and a task list without requiring a table. Decide whether field exclusions remove controls or only standalone feature scope. | Corresponding W03/W06/W10/W11 UI contracts |
| D07 | R1 R+X/stock mutations vs older read-first design and Later cutover/quote push. Choose first series by actual access and first-shop workflow, document per-object read/write authority, cancellation/return semantics and manual fallback. Second series remains R1 unless explicitly changed. | W13 write integrations; bounded access probes can proceed |
| D08 | Confirm group-capacity scenario and roles. Recommend group-to-shop membership plus authorised aggregate capacity, no cross-store customer history or transfers. | W01b group schema and W16 group report only. W01a, W02, W03, W04 proceed. |
| D09 | Define stable work/custody/payment facts, warranty classification, labels, allowed commands and ageing clocks. Recommend server validation without a configurable workflow editor (Later 107); distinguish staff reserve override from overlap checks (Later 40 already partly exists). | W03 status/label/ageing/custody transitions, cancellation (it releases reservations and may notify) and W05 override rules. Actor history, version plumbing and job-owned effort proceed. The job number floor also needs D10. |
| D10 | Define “Bike Sale product module” 253, third-party payer 240, tax/report attribution, SKU groups 98, service groups 6, minimum job number 66 and 22-font widget 14. Recommend reuse existing till; payer reference without insurer portal; simple SKU grouping; minimum number as a one-way floor; no arbitrary font uploads. Exact UI/control acceptance remains to be agreed, not silently reduced. | Relevant slices in W04/W10/W11/W12/W16 and the W03 minimum job number floor |
| D11 | Choose supported staff/customer devices and printing hardware/setup. No 309 excludes mechanic phone inspection, not necessarily usable customer phone booking. No installer 299 does not prove browser auto-print support. Recommend real print-agent/manual setup proof or revise auto-print promise explicitly. | W10 device gate and W14 automatic print |
| D12 | Confirm recovery targets, provider budgets, data export/retention procedure, roles and owners for live operations. Use earlier review F19–F23 as inputs; obtain current provider/security/legal specifics during implementation, not by copying old prescriptions. | W01/W02 sensitive integrations and W18 live release |

## Shared contracts to settle in W00

Keep these as short schema/API examples attached to the implementing issues, not a new specification framework:

- **Job:** tenant/shop, customer and optional bike; immutable human number; original request/date; planned effort separate from charged labour minutes; booking mode/date/window; technician or shared queue; promised-ready time; independent work/custody state; actor/time history; version for compare-and-swap edits. Planned effort must exist and count against capacity whether or not the job has a start time or a technician.
- **Group:** authorised membership in a set of shops; every operational record still belongs to one shop. A group report uses explicitly authorised aggregation, never disabled RLS.
- **Amounts:** currency, quantity, unit price, discount, tax basis/rate/amount and total snapshots, deterministic rounding; proposal versions and settled line identities. Later catalogue changes never rewrite accepted proposals or issued documents. No tax-compliance certification is implied by implementing these fields.
- **Capacity:** availability is a read projection, reservation is an atomic command. Pending/accepted/expired/cancelled holds, reschedule replacement, duration changes and staff overrides have explicit rules. Untimed (drop-off) and unassigned (queue) jobs consume daily effort. A queued job counts once against the shop pool and is not counted again when assigned to a technician; only active allocations count, cancelled and expired ones do not; completed and historical jobs stop consuming capacity. Shop timezone and DST apply consistently. No double-counting lunches plus reserve.
- **Side effects:** commit business change and durable effect intent together; call providers outside database leases. Distinguish requested/accepted/delivered/failed/unknown. Use local idempotency keys and provider IDs where supported, safe retry/reconciliation after uncertain outcomes, and no historical-import notifications.
- **External source ownership:** identify system of record for customer/product/price/stock/job/invoice/payment/refund per shop mode. Include origin IDs, revision/cursor, freshness and disconnect semantics. Local jobs survive connector disconnect.

## Work packages and proposed PR boundaries

Owner labels are proposed lanes, not staffing commitments: **Platform** (Mark’s area), **Workshop** (Jack’s area), **Integrations** and **QA/reviewer** (assign explicitly). Product decisions stay with Jack. Every package needs a builder and independent reviewer when assigned.

### W00 — Reconcile scope and prove the riskiest assumptions (M; Jack + technical leads)

Depends on: none. Evidence: ranking, both reviews, current code and newer trial.

- [ ] Record decision answers, approved/proposed/implemented document precedence and master-plan amendment draft. Correct status claims by behavioral audit. Link #17/#18; do not close them from old issue prose alone.
- [ ] Prepare bounded R/X access and capability probes, payment/inbound-channel probes and physical print proof. Obtain required shop credentials through normal secure setup; no secrets in issues. Each probe ends with supported operations, observed failure/retry behavior and an evidence bundle or explicit blocker.
- [ ] Write shared command/examples above, sample invoices/reports, and one full job-to-payment ownership walkthrough per supported mode.

Exit: D02, D06, D09 answers (or explicit “proceed on recommendation”) recorded before W08 and W03 status work start; D07 before W13b; D04 before any deposit slice; D08 before W01b. Provider uncertainty remains visible. W01a, W02, W03 history/version/effort plumbing, W04 amount calculation and labour-stock work, and W18 recovery preparation do not wait for any probe. Snapshot semantics wait for D02. Nothing here starts implementation before the master-plan amendment is recorded; issue preparation may.

### W01 — Tenant integrity and minimal group foundation (L; Platform)

Primary rows: 314, 315. Split into two slices with the same package ID.

**W01a — tenant integrity.** Depends on: W00 tenant contract only.

- [ ] Audit/add tenant-consistent foreign keys, resolver privilege boundaries and service-role access; handle existing dirty relationships explicitly. Retain session-scoped topology until its documented alternative is proven.
- [ ] Test two shops with guessed foreign IDs, worker jobs and connector credentials. Apply migrations on an existing populated fixture as well as fresh install.

**W01b — group foundation.** Depends on: W01a and D08.

- [ ] Add minimal group/shop membership and explicit authorised aggregation path; no shared customer history.
- [ ] Test two groups: membership removal removes aggregate access.

Files: `server/db.js`, `server/auth.js`, `server/migrations/`, `docker/init-db.sh`; existing database tests under `tests/` (listed by the earlier inspection; not run in this review). Exit: cross-tenant reads/writes/relations fail; group membership removal removes aggregate access; no permission by UI hiding.

### W02 — Staff access, customer identity and records (L; Platform + Workshop)

Depends on: W01a; D03 for matching only. Primary rows: see CSV.

- [ ] Update the existing auth migration plan against current entrypoints/migration numbering and earlier F19/F20 before implementing its approved direction. Separate workshop work from taking/refunding money; No 218 means a specific mechanic preset is not assumed.
- [ ] Implement/test roles, deactivation and persistent session revocation. Current behaviour: `getSessionContext` rejects inactive logins, but `reactivateTeamMember` restores `active` without touching `sessions`, so a token issued before deactivation works again after reactivation. Deactivation must delete or invalidate existing sessions; reactivation must require a new login. Preserve actor history and dual staff/customer contexts.
- [ ] Reuse customer CRUD/search/details and first-class customer bike records; define verified guest access and staff-only duplicate suggestions. Raw contact entry must not enumerate existing customers or expose bikes/history. Correct the stale header comment on `resolveGuestCustomer` that still describes phone matching. W11 owns the item editor; W02 owns its identity/access contract.

Files: `server/auth.js`, `server/customer-auth.js`, `server/team.js`, existing auth specs/tests (exist per earlier inspection; not run here). Exit: raw HTTP permission matrix, cross-shop identity and deactivate → reactivate stale-token tests pass; customer record matching never authenticates a person. Merge execution belongs to W15.

### W03 — Independent job model and workflow (L; Workshop)

Depends on: W01a, W00 amount/data contracts, current session actor for history; D06/D09 for status/label/ageing/custody transitions and cancellation; D10 for the minimum job number floor. History, version plumbing and job-owned effort proceed. Includes rows 248/229 early despite their original late ranks.

- [ ] Add/backfill job-owned planned effort and immutable number/floor; preserve jobs with/without orders and bikes (`createWorkshopJob` already supports `skipAutoOrder`; the *mode* and the effort field are missing). Resolve #18’s one-order cardinality on the current model without preventing legitimate invoice/credit history.
- [ ] Define semantic states/labels, custody, warranty/tags, assignment/shared queue, original booking and promised-ready times. Map the existing five `JOB_STATUSES` (`pending`, `scheduled`, `waiting_parts`, `on_hold`, `complete`) without silently inferring collection or payment from `complete`.
- [ ] Add actor history, conditional-version updates, lock-on-collection and authorised reopen; protect lines/media and all alternate routes. Add selected ageing predicates from recorded event times; specify calendar vs working-day clocks and whether re-entry resets age.

Files: `server/server.js` job routes/serialization, `server/migrations/`, existing workshop job/rule tests (exist per earlier inspection; not run here). Exit: job without sale keeps duration; stale edit returns conflict without partial changes; collection is independent of settlement; imported completed jobs stay silent.

### W04 — Service catalogue, charge model and tax facts (L; Workshop)

Depends on: W01a, W00 amount contract; D02 for proposal/booking snapshot semantics and approval behaviour; D10 for groups and module definitions. Amount calculation and #17 reproduction proceed without either. Can proceed alongside W03 after schema ownership is allocated.

- [ ] Extend existing services (migration 014: name, price, minutes, active; 015: `bookable_online`) with category/groups, linked SKUs; reuse price/minutes/settings. Define service change behavior on existing proposals.
- [ ] Implement authoritative amount/tax/discount calculation and snapshots for downstream quotes/invoices; separate charged time from planned effort. Proposal/booking snapshot semantics overlap Later 208 and No 169 and are disputed: they are gated on D02 and are not implemented ahead of it by calling them internal. Amount/tax/discount calculation and the labour-stock fix proceed. Do not reclassify the rows.
- [ ] Reproduce/fix #17 for unmigrated Services-category products; prove labour never consumes/restocks physical stock. Specify tax setting changes for future vs existing documents; replace the hardcoded 20% in `vatFromInclusive` with stored facts.

Files: migration 014/015 as read-only history, new migrations, `server/server.js` service/line/sale paths, service and sale-document tests (exist per earlier inspection; not run here). Exit: changed catalogue cannot change agreed charges; inclusive/exclusive/discount rounding fixtures reconcile; labour stock regression passes.

### W05 — Availability and atomic reservations (L; Workshop)

Depends on: W03/W04; W02 for per-technician hours only; D09 for override rules.

- [ ] Add per-technician hours, leave, closures, recurring breaks and lead-time rules to one availability calculation; preserve current opening-hours, working-day and staff overlap checks in `checkJobSlot`.
- [ ] Make untimed and unassigned jobs count. Today `mechanicFreeMinutes` selects only rows with a start time and `checkJobSlot` returns early for jobs without times. The portal still requires a start time and mechanic, so public drop-off booking is not accepted today; the gap is that the planned drop-off mode would inherit this code and that existing staff-created untimed jobs are invisible to a customer's timed booking (not reproduced). Reservation must use job-owned planned effort regardless of start time or technician. Queued jobs count once at the shop pool, are not double counted on assignment, follow active/cancelled/expired allocation state, and completed or historical jobs do not consume capacity forever.
- [ ] Implement timed slots and drop-off daily effort reservations, unassigned queue capacity policy, pending expiry and atomic reschedule. Lock/recheck the shared capacity resource inside a short transaction; choose deterministic lock order for moves across resources/days.
- [ ] Define staff overrides and duration increases without silently consuming customer reserve. Settings/mode changes must not erase existing allocations.

Files: `checkJobSlot`, `mechanicFreeMinutes`, portal/staff job routes, availability/settings tests. Exit: two concurrent timed requests for the last slot yield one acceptance; two concurrent untimed drop-off requests for the last unit of daily effort yield one acceptance; failed move preserves original hold; expiry releases once; leave/DST/mode-change fixtures agree between UI and API.

### W06 — Diary views and capacity presentation (M; Workshop)

Depends on: W03 for day view/resource configuration; W05 for capacity strip, week/month and drag; D06. Primary rows include day/week/month, grid sizes, resource ordering/configure, legends and card metadata.

- [ ] Deliver day view/resource configuration against production APIs (stage 3 internal milestone).
- [ ] Add capacity strip, week/month and 5/15/30-minute presentation, status colours/labels, original date and item type. View granularity does not change stored effort or reserve math.
- [ ] Wire drag moves to W05 with clear failure/reload and keyboard alternative.

Files: `public/app.js` diary and incremental `src/staff/` screens. Exit: every view reflects the same allocation; stale drag cannot overwrite a colleague; view selection does not require unrelated messaging/payment work.

### W07 — Real messaging, inbox and selected automations (XL; Integrations)

Depends on: W01a/W02/W03 and the side-effect contract; W04 amounts only for monetary merge fields; D05/D12. Booking/quote-specific triggers integrate after W08/W10 as separate slices. W08 and W10 do not wait for W07.

- [ ] Implement encrypted per-shop credential setup/rotation/disconnect, channel preference schema and durable delivery log/outbox. Extend `server/sms.js`; choose email and WhatsApp paths based on proofs.
- [ ] Add real outbound adapters and authenticated inbound/status callbacks. Correlate conversations to shop/customer/job without assuming phone alone uniquely identifies a job; route ambiguity for staff handling. Define whether email supports replies before claiming a unified inbox across all channels.
- [ ] Add compose, Ctrl+Enter, inbox, templates/toggles, selected booking/collection reminders and merge text. Schedule against job version/due time; cancel obsolete intentions; deduplicate triggers and callbacks. D05 must define the event behind “Pickup / Bike Picked Up” (row 125), distinguishing courier pickup from customer collection; delivery-link template also requires D05 resolution.

Files: `server/sms.js`, existing message tables/routes, new narrow messaging modules, job/customer UIs. Exit: timeout after provider acceptance does not blindly resend; revoke credentials/preferences while queued and send is suppressed/failed visibly; inbound spoof/replay/cross-tenant callbacks fail; business transition survives delivery failure. No marketing scheduler or generic automation builder.

### W08 — Versioned quote approval (L; Workshop)

Depends on: W02/W03/W04; D02. Message delivery of the link is a later slice after W07; the link must first work when shown on screen or copied by staff.

- [ ] Build proposals, line decisions, spending ceiling and preserved settled-line semantics. Persist exactly what was offered and authorised.
- [ ] Provide secure revocable customer links and approve/decline API; edit/re-propose creates a new revision with explicit handling of prior approvals. Define ceiling currency, cumulative spend, tax and exclusions.
- [ ] Integrate quote template/link send (after W07), service updates and reviewed application of approved work to charges per D02.

Files: job/line routes, new quote storage, customer portal and job screen. Exit: declined lines excluded; approved amount cannot drift; stale/replayed link cannot authorise revised work; parallel edits conflict; below/above-limit fixtures prove ceiling semantics. A manual approval record is a fallback, not completion of R1 online approval.

### W09 — Checklists and service questions (M; Workshop)

Depends on: W03/W04.

- [ ] Add reusable pre-service checklist templates, checkbox/value controls, front/rear and label colour; snapshot applied questions/answers on the job.
- [ ] Add ordered custom service questions with text/textarea/checkbox and reorder control. Decide simple shop-level/pre-service attachment rather than implicitly implementing Later per-service checklist row 197.
- [ ] Wire book-in answers and widget questions; validate types/lengths and retain prior answers through template edits.

Files: new template/answer storage/routes, job and booking surfaces. Exit: edits do not rewrite historical answers; required/type validation consistent server/client; Later closing-block alerts and inspection-photo features are not smuggled in.

### W10 — Customer booking and secure progress (L; Workshop)

Depends on: W02–W05, W09; D06/D10/D11 where relevant. Notification slice after W07; approval-in-progress-link slice after W08; deposit slice after W12 and D04. The core request-to-confirmation journey does not wait for W07/W08.

- [ ] Replace hardcoded `PORTAL_JOB_TYPES` with the bookable catalogue and “not sure” duration (`unspecified_job_minutes`). Remove the portal’s mandatory start time and mechanic for drop-off shops. Offer timed/drop-off mode, price setting, service acceptance rules, review/reject reason, deadlines, cancellation/reschedule and booking disable switch.
- [ ] Implement guest problem/media intake and narrowly scoped progress tokens: secure generation/storage, expiry/rotation, attachment access and per-action authority. No account or phone match should be needed merely to submit a new request.
- [ ] Add iframe/URL embed, service/group preselection, information text, selected colour/font options and advance ceiling. Validate preselected IDs against this shop’s current bookability. Ensure embed authentication/token handling works under browser cookie restrictions.
- [ ] Connect optional booking deposit only after W12/D04. Verify held booking versus payment failure/late completion/rejection with one shared lifecycle.

Files: `public-portal/portal.js`, portal routes, customer auth and attachment routes, incremental frontend. Exit: complete request-to-return journey after restart; full/closed/unfittable explain different states; cancel releases capacity once; customer phone browser and desktop work on agreed devices; upload cap/type/auth checks run on server. Full staff phone inspection stays excluded.

### W11 — Job workspace, queue and existing product surfaces (L; Workshop)

Depends on: W03/W04; integrates W06–W09 as those land; D06/D10.

- [ ] Deliver modal job workspace with schedule/assignment/item, attachment panel, status, history, service writer, product/service search, SKU/price/total, exact barcode add and SKU groups. Define unknown/ambiguous barcode behavior; never add an arbitrary fuzzy match.
- [ ] Deliver item editing/replacement per D06, move control, list search/status chips/KPI tiles and technician display; staff claim shared work atomically. KPI predicates come from W03, not hardcoded display labels.
- [ ] Verify/reuse existing Bike Sale module 253 to the D10 definition. Do not rebuild the till or add No table layout solely to copy Hubtiger.

Files: existing staff app and `src/staff/`, product/customer/job endpoints. Exit: one job state shared across diary/list/modal; failed/stale edits preserve work; search/keyboard/barcode flows demonstrated; jobs without bikes remain usable.

### W12 — Invoicing, online/counter settlement and refunds (XL; Integrations + Workshop)

Depends on: W02/W03/W04/W08; D02/D04/D07/D10. W13 must resolve external settlement ownership before enabling coexistence money flows.

- [ ] Issue immutable job invoices with agreed numbering, issuer/customer/currency/tax facts and explicit status; distinguish quote from invoice and work completion from settlement.
- [ ] Implement shop-connected Stripe payment and counter-recorded payment against one outstanding balance, with payment attempt IDs and authenticated callbacks. Define terminal/partial-payment limitations honestly.
- [ ] Implement independent refund/void/return operations per quantity and stock disposition, including labour and externally settled transactions. Add payer reference/role without inventing insurer approval portal.
- [ ] Add deposit lifecycle only after D04; reconcile payment after hold expiry, rejected booking, cancellation and refund failures.

Files: existing sale/document routes/tests, new payment/reconciliation modules and migrations. Exit: simultaneous counter payment/open link is detected and reconciled without silently double crediting; duplicate callbacks/refund submissions do not repeat effects; restored DB is reconciled before processing. Do not promise atomic cross-system prevention of every late charge; document recovery/refund behavior for money already taken by a provider.

### W13 — POS integration, separately for each series (XL; Integrations)

Depends on: W01a/W02/W03/W04 and D07; contract/probe work starts in W00. Reconciliation with W12 is a joint integration gate, not circular implementation dependency.

- [ ] W13a: shared connection metadata, encrypted credentials, product/inventory freshness page, POS employee mappings and disconnect/revocation. Implement only common behavior demonstrated by both selected providers.
- [ ] W13b: first chosen series, initial resumable read/import and incremental reconciliation, then approved work-order/stock mutations. Record source IDs, checkpoints, child changes, deletions and local ownership; exercise rate-limit/backoff behavior with evidence.
- [ ] W13c: second series with its own object/endpoint/permission proof and acceptance suite. Do not implement R-Series shapes behind X-Series mocks.
- [ ] W13d: interrupted write recovery, add/remove/cancel stock accounting, sync freshness/degraded operation and deliberate stop. Reconcile amount/stock ownership with W12, and prove changes are neither double applied nor echoed indefinitely.

Files: new series-specific modules under `server/`, shop connection UI, migrations; consult existing Shopify code for reusable lessons rather than treating it as Lightspeed implementation. Exit: real read/write/retry/withdrawal evidence for each series, including R child-line timestamp probe; fallback visibly records incomplete handoffs. No historical migration/cutover promise from a fresh-data import. If the probe blocks a series, full R1 remains blocked until Jack changes scope.

### W14 — Job/receipt/tag printing (M plus device uncertainty; Platform)

Depends on: W03/W04 for job/tag data, W12 for final receipts; D11. Automatic book-in event integrates with W10. The `print-agent/` files exist per the earlier inspection; their behaviour was not exercised in the second review and must be confirmed before relying on them.

- [ ] Reuse existing print path for job card/receipt and test a physical supported printer.
- [ ] Define job tag versus full card and auto-print event. Rows 79/298 share one delivery mechanism but can have distinct output acceptance. Add work-order barcode that opens the correct authorised job.
- [ ] Persist print intent/acknowledgment and visible failure/reprint; avoid duplicate automatic print after event replay. A barcode identifies a job; it is not an unscoped authentication token.

Files: `print-agent/`, existing print routes/UI. Exit: physical outputs legible/scannable, printer offline/reconnect behavior shown, setup documented without relying on No installer 299. Browser dialog-only output does not close automatic-print rows.

### W15 — Customer import and reviewed deduplication (M; Integrations)

Depends on: W01a/W02 and D03; use W13 source IDs where available. Note: every guest booking currently creates a new customer row, so duplicates accumulate from the first live booking; the staff duplicate-review view should not wait for CSV import.

- [ ] One CSV importer covers rows 179 and 276. Add preview, mapping, row quarantine, checkpoint/resume and idempotent rerun.
- [ ] Add duplicate detection and authorised reviewed merge; preserve job/bike/payment associations and provenance, invalidate/review access grants rather than expanding them accidentally.
- [ ] Reconcile counts and sampled relationships; rehearse interruption mid-batch and reversal of an accidental merge using recorded mappings/backups.

Files: new importer, customer routes/storage and integration tests. Exit: valid + quarantined + intentionally skipped equals input; restart does not duplicate customers; merge cannot cross shops or grant customer history by phone alone. No Excel jobs/history importer, no full till cutover implied (Later 275/277/280).

### W16 — Selected reports (M; Workshop)

Depends on: W03/W04/W05 for booking/capacity, W12 for financial/tax facts, W01b group membership; D08/D10. Define sample expected outputs in W00.

- [ ] Build booking snapshots/detail/platform/day-hour, VAT/tax and workshop financial breakdowns. Define time basis, date range/timezone, completed vs paid revenue, refunds, discounts, shared job technician attribution and denominator for AOV.
- [ ] Add authorised group capacity aggregation from the same W05 rules. No customer cross-store history or per-technician time tracking required by inference.
- [ ] Reconcile fixed mixed-data fixtures against source documents and late refunds; mask financial columns by permission.

Files: report queries/endpoints and UI, deterministic fixtures. Exit: totals trace to source rows and reconcile; group permission removal takes effect; empty/new shops work. No generic BI builder, MTD filing integration, commissions or leaderboard.

### W17 — Remaining shop settings (S; Workshop)

Depends on: W01a/W02; integrates W07/W10; D10/D12.

- [ ] Reuse shop profile and expose store type and marketing prompt/text settings; notifications and merge-text settings are owned by W07 to avoid duplicate control panels.
- [ ] Ensure each selected setting has a named consumer, server validation, safe defaults and tenant isolation. Capture configured notice/choice version where needed by the agreed data policy.

Files: workshop/shop settings routes and staff UI. Exit: changing a setting changes the intended preview/behavior; historical records stay intact; no “GDPR compliant” claim from a checkbox.

### W18 — Recovery, observability and live release (L; Platform + reviewer)

Depends on: W01a for initial recovery foundation; final gate depends on all selected packages. Start hosting/recovery work early, not after reports.

- [ ] Set up supported hosted database/PITR, attachment backups and key recovery; agree measurable RPO/RTO and rehearse an isolated restore. Include group/tenant verification and external side-effect reconciliation before worker restart.
- [ ] Deliver public status page and error tracking with credential/customer-data redaction; define actual deployment health/failure behavior and operator ownership. Provide staff-assisted export/operational fallback without implementing No job-list CSV UI.
- [ ] Run integrated journeys below with real supported devices/provider test environments, then controlled live verification. Record every R1 row’s evidence and open limitations.

Exit: restore drill meets agreed targets; local side-effect intents are deduplicated, retries are controlled, uncertain provider outcomes are visible and reconciled rather than assumed (a provider may have accepted a request whose response was lost, so "never duplicated" cannot be guaranteed outright); every selected row has acceptance evidence, with provider/device evidence where a row depends on one, or is explicitly changed by Jack. No live release based on mocks, old test totals or a successful prototype demo.

## Status corrections added by the second review

| Rows | Evidence | Planning treatment |
|---|---|---|
| 48 | Portal booking route subtracts requested minutes and calls `checkJobSlot`; both consider only timed, mechanic-assigned jobs | “Capacity gate” exists for the timed path only; drop-off/queue capacity is W05 work |
| 49 | Migration 015 stores `booking_mode`, windows and `unspecified_job_minutes`; portal still rejects a missing start time or mechanic | Configuration built in app; end-to-end drop-off booking is W10 + W05 work; CSV “BUILT-in-prototype” describes the simulator only |
| 217 | `getSessionContext` rejects inactive logins; reactivation restores `active` without invalidating sessions | Deactivation works today; durable revocation across reactivation is W02 |
| 183 | `resolveGuestCustomer` creates a new customer per guest booking; its header comment still says “matched by phone” | No identity matching exists; fix the comment in W02; duplicates accumulate until W15 |

## Dependency order and parallel work

| Stage | Work that can start together | Integration gate |
|---|---|---|
| 0 | W00 decisions/source reconciliation; series/channel/print probes; baseline audit | Shared job/amount/authority contracts and assigned schema ownership |
| 1 | W01a tenant integrity; W02 session revocation and roles; W04 amount calculation and labour-stock fix after W01a (snapshot semantics after D02); W18 recovery preparation | Tenant/access and money-model fixtures |
| 2 | W03 job model; W01b group after D08; W07 provider foundations after W02 plus event contract; W13a connector foundations; W15 importer after W02 | Persistent job without till, stable versions/events, safe credentials |
| 3 | W05 capacity after W03/W04; W08 quote after job/amount model; W09 templates; W06 day view; W11 incremental workspace; W17 settings | Internal request → schedule → approve → complete → collect journey with links shown on screen, no provider required |
| 4 | W06 week/month and drag; W10 booking; W12 money; W13b–d per-series writes; W14 printing; W16 reports; W07/W08/W10 messaging integration slices | End-to-end workflow plus external reconciliation |
| 5 | W18 integrated release gate with all owners | All 172 rows proven, or a recorded Jack scope amendment |

These are merge/integration stages, not a claim that every package in a row has no prerequisites. Package dependency lists govern. Avoid parallel edits to `server/server.js`, `public/app.js`, auth contracts and migration numbering: assign one integrating owner per shared file/contract, reserve migration numbers at merge, and keep new modules narrowly scoped. Freeze API examples before separate frontend/backend PRs; pair their acceptance fixtures.

**Likely critical path for the internal workflow:** W00 → W01a → W03/W04 → W05/W08 → W10 → internal journey. **Likely critical path for release:** external access. Either POS series, WhatsApp/email onboarding, Stripe connect or physical printing can dominate elapsed time, and none of them now blocks the internal journey. Get their evidence early. Calendar month view, checklist colours and report presentation should not block provider probes or core job work.

## Acceptance and issue splitting

Use one issue per numbered package slice above when it can be reviewed independently; split L/XL packages before coding. Provider proofs run alongside. UI-only breadth follows working APIs.

### First five implementation issues (drafts, not published)

These form a dependency sequence, not a set that all starts at once. I-01 and I-02 have no prerequisite; I-03 and I-04a follow I-01; I-04b waits for decision D02; I-05 follows I-03 and I-04a. Implementation starts only after the master-plan amendment is recorded; issue preparation may begin now.

| # | Issue | Package | Prerequisite | Acceptance example | Failure case |
|---|---|---|---|---|---|
| I-01 | Tenant integrity audit and fix | W01a | none | Two-shop fixture: every cross-shop foreign ID via raw HTTP and SQL under the app role is rejected; migration runs on a populated fixture | A job referencing another shop’s bike is accepted |
| I-02 | Durable session revocation | W02 | none | Deactivate during a live session, then reactivate: old token rejected both times; new login required; stale `customer-auth.js` comments corrected | Old token resumes after reactivation (current behaviour) |
| I-03 | Job without order with job-owned planned effort | W03 | I-01 | Create job with `skipAutoOrder` and planned minutes; restart; job persists with duration and no sale document; stale edit returns conflict without partial change | Job with no order loses its duration or leaves the diary |
| I-04a | Amount/tax calculation and labour-stock regression | W04 | I-01 (no decision) | Inclusive/exclusive/discount rounding fixtures reconcile; stored tax facts replace the hardcoded rate; labour never moves physical stock (#17) | Labour line restocks a product |
| I-04b | Proposal/booking snapshot semantics | W04 | I-04a, D02 recorded | Change catalogue price and tax setting after a proposal exists: agreed lines behave as D02 decides | Existing proposal total changes silently |
| I-05 | Atomic reservation including untimed jobs | W05 | I-03, I-04a; D06 for drop-off policy and D09 for cancellation/override semantics | Two concurrent timed requests for the last slot and two concurrent drop-off requests for the last unit of effort each yield one acceptance; failed move keeps original hold; expiry releases once | Timed booking ignores an existing untimed staff job (confirmed code shape, not reproduced); both untimed requests succeed once drop-off booking exists (hypothetical, not current public behaviour) |

Each issue must contain:

- Source row IDs and original buckets/ranks; related existing issue; decision answers that apply.
- Actor, precondition, command/request and observable result; one concrete failure case.
- Schema/API ownership, migrations/backfill and no-data-loss rollback/disable path.
- Dependencies, assigned builder/reviewer, bounded PR slice and explicit exclusions.
- Verification commands, fixtures and expected outcomes; provider/device evidence where mocks cannot prove behavior.

Release scenarios supplement the [earlier acceptance scenarios](2026-09-08-spec-acceptance-scenarios.md), retaining their IDs where applicable:

| Scenario | Required evidence |
|---|---|
| Timed guest booking → reviewed/automatic acceptance → quote → work → ready → collected | Restart between steps; same job visible to customer/shop; custody/payment independent; exactly the agreed messages and invoice |
| Drop-off + shared queue + unknown problem | Job-owned effort consumes daily capacity without promising a start; two concurrent drop-off requests for the last unit have one winner; claim race has one winner; no till order needed |
| Last capacity slot and failed reschedule | Concurrent HTTP requests from separate sessions; one booking wins; original reservation preserved on failed move; expiry releases exactly once |
| Quote edit/approval race + spending ceiling | Old links cannot approve new amounts; declined lines excluded; settled decisions preserved; agreed tax/discount totals |
| Payment link + counter payment + refund | Provider retries/late success/partial return reconciled without duplicate local settlement or assumed stock return |
| POS edit + timeout + reconnect, separately R and X | Correct source ownership, child changes, no echo/duplicate stock, visible stale data; local job survives disconnect |
| Guest phone collision + stale staff access + cross-shop references | No data disclosure; old staff session does not revive after reactivation; no invalid cross-tenant relationship |
| CSV restart + duplicate merge | Input reconciliation and retained relationships; merge does not expand guest access |
| Printer offline + application restore | Visible pending/failed output, intentional reprint; recovered jobs/files/keys within agreed targets; side effects reconciled before resume |
| Group report + changed membership | Only allowed shops aggregate; figures reconcile to per-shop booking/financial source data |

Run affected database-backed tests with the non-superuser role, then the repo’s `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and existing CI gates for code changes. Add real concurrent HTTP tests where relevant; frontend browser tests target production surfaces, not only `prototype/`. Provider fakes test failures; provider test accounts prove contract compatibility. Do not add tests that merely mirror display constants.

## Scope accounting and handoff

The CSV is a planning ledger, not an edit to Jack’s ranking. It contains 317 rows, including all Later/No selections, their source citations, one primary package for each R1 row and decision flags for overlaps. R1 duplicates 179/276 share W15; related printing 79/298 share W14. Conflicting deposit 233 stays Later with a D04 flag. Other deferred safeguards remain in their original buckets with decision flags. The second review changed no mapping.

Next step is Jack’s decisions on disputed scope (D02, D04, D06, D07, D08 first), then incorporation into a dated master-plan amendment and issue-ready slices starting with I-01 to I-05. Until that amendment is recorded, this plan stays a draft: analysis, issue drafting and bounded access probes proceed; implementation that depends on an open decision does not. A narrower first release is an option for Jack, not an unstated assumption in this plan. No GitHub issues/comments or provider messages have been posted as part of preparing this pack.

