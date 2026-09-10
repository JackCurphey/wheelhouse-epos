# Release 1 — workshop operations with one POS integration

Date: 10 September 2026. **Scope revised after review with Jack; implementation plan ready for store review and issue splitting.** The scope reductions are decided; technical defaults and outstanding access/device evidence are identified below. This does not claim that implementation or the Lightspeed connection is complete.

Authority: [scope decision](../../decisions/2026-09-10-release-1-scope-reduction.md). It supersedes the earlier [172-row plan](../../reviews/2026-09-10-ranked-release-implementation-plan.md) and incompatible Release 1 requirements in the master/workshop-first plans. [Revised ledger](../../reviews/2026-09-10-release-1-revised-traceability.csv) preserves every original row and records scope changes.

## The release promise

A shop can take a booking, allocate work, create a quote, obtain approval for individual lines, communicate by email/SMS/WhatsApp, print and scan a bike tag, carry out the work and record collection. One proven Lightspeed connection supplies relevant catalogue/stock data and receives the agreed work-order handoff. The shop invoices, collects payment and handles refunds in its existing Lightspeed till.

**Later:** Wheelhouse invoices, customer payment links, deposits, counter-settlement/refund machinery, customer CSV/history import, reporting suites, chain/group capacity and disaster-recovery development. The second Lightspeed series and new standalone Bike Sale/till expansion are also Later. Quote totals, spending ceilings, operational queues and per-shop calendar capacity remain.

Recovery has been removed from the build plan and release gate as requested: no PITR programme or restore drill is required here. Existing protections are not removed. Transactional integrity and controlled retry of retained integrations/printing remain part of making those features work. This release makes no new disaster-recovery guarantee.

## What changes from the reviewed specification

| Previous plan/spec | Release 1 now |
|---|---|
| W12 invoice/Stripe/counter payments/refunds/deposits | Removed; money stays in Lightspeed |
| W13 R-Series and X-Series | One adapter; R-Series recommended, final choice gated by first-shop fit and real API proof |
| W15 customer import | Removed; normal customer records and staff-reviewed duplicates remain in P02 |
| W16 reports and W01b group model | Removed; operational job counters and single-shop capacity remain |
| W18 recovery/PITR | Removed; selected status/error visibility remains in P10 |
| W14 printing waits for W12 receipts | Printing depends on the job model only; QR bike tag is an early vertical slice |
| Quotes tied to financial release | Approval is its own workshop contract; no payment dependency |
| Full-history continuous migration in older Lightspeed spec | Current catalogue/stock plus current-job handoff only; no customer backfill or cutover promise |
| Prototype billing and messages | Billing controls omitted from this release; retained channels must send/receive real messages |

The August workshop spec’s claims that staff routes lack guards and workshop tests do not exist are stale. Current `checkJobSlot`, service migrations 014/015 and the existing workshop tests should be reused. `prototype/` remains an interaction reference. The production staff entrypoint is still largely `public/app.js`; migrate screens incrementally using the approved frontend direction.

## Shared implementation contracts

- **Job independent of till:** customer and optional bike, immutable job reference, planned effort, timed/drop-off allocation, assigned technician/shared queue, quote revisions, work state, custody and actor/version history. No automatic sale document required for a new Release 1 workshop job.
- **Approval:** retain the exact line IDs, quantities, descriptions and amounts presented. A stale link cannot approve edited prices. Re-proposal preserves already decided unchanged lines and asks again for changed work. The spending ceiling authorises work up to an amount; it does not store or charge a card. Version binding is a proposed internal correctness rule, with no new approval-configuration screen. The original No/Later rows remain visible in the ledger so this interpretation is reviewable.
- **Amounts:** deterministic quote tax/discount rounding and amount snapshots; no invoice issuance, invoice numbering, payments ledger or VAT-report feature. Imported/catalogue changes cannot silently alter an approved quote.
- **Capacity:** atomic creation/reschedule; account for untimed effort and queued jobs once. Assignment moves an allocation from shared capacity to a mechanic without double counting. Cancelled/expired reservations stop consuming capacity. Define effort still required for unfinished work separately from bikes awaiting collection. Preserve staff discretion over the customer reserve while validating moves server-side.
- **Visibility:** staff job QR opens an authorised staff route after login; it is not a customer progress token. Phone entry does not grant existing customer history. Group-level access is absent; each shop remains tenant-isolated.
- **External effects:** transaction plus durable local intention, short database leases, provider calls outside transactions, local duplicate prevention, explicit unknown result and reconciliation. Do not promise exactly-once SMS delivery or physical printing after an ambiguous acknowledgement.

## Work packages

Package IDs below replace W00–W18 for this release; the ledger retains both mappings. Each PR needs a named builder and reviewer when assigned. Jack owns shop workflow; technical ownership is assigned during issue splitting, not invented here.

| Package | Bounded implementation slices | Prerequisites | Acceptance |
|---|---|---|---|
| **P00 — integration and device proof** | P00a: confirm first-shop series and run LS-01–09 in the API brief. P00b: identify printer, label stock, driver PC and scanner; print/scan a fixture. P00c: prove provider setup for email, SMS and WhatsApp, including inbound support | Account/hardware/provider access; no other code package | Redacted real evidence and explicit capability gaps. A documented API or mock is not proof of our access |
| **P01 — tenant and staff access** | P01a: tenant-consistent relationships/resolver boundaries. P01b: deactivate/reactivate permanently invalidates old sessions. P01c: route permissions and printer/worker tenant scoping, aligned with the existing auth plan | Existing schema audit; no group model prerequisite | Two-shop raw API/DB tests reject cross-shop references; old token stays invalid after reactivation; actor history retained |
| **P02 — job workspace and records** | P02a: job-owned planned effort, version and reference without sale. P02b: statuses/labels/custody/history/lock/reopen. P02c: job modal, customer/bike CRUD, product search/barcode/SKU grouping, service writer, operational queue/search/chips/counters. P02d: staff duplicate review/merge independent of import | P01 for integration; current actor suffices for model development | Restart preserves job/effort; stale edit conflicts; work-ready and collection independent; no auto-sale; merge neither crosses shops nor grants public history access |
| **P03 — services, quotes and questions** | P03a: extend existing service category/bookability/linked SKU/minutes. P03b: quote calculations and revision-bound line approval/spending ceiling. P03c: reusable checklists and ordered service questions | P02 job contract, P01 access | Customer approves some lines and declines others; declined lines excluded; changed proposal needs new approval; quote still works without invoice/payment or message provider; template edits preserve old answers |
| **P04 — capacity and diary** | P04a: hours/leave/closures/breaks and reserved effort. P04b: atomic timed/drop-off booking, expiry/reschedule and shared queue allocation. P04c: day/week/month, grid sizes, resource settings/order, legends, original date/bike metadata | P02 effort model; P03 duration contract; P01 staff access | Two requests for last capacity yield one acceptance; timed availability includes existing untimed commitments; failed move retains original hold; view changes do not change capacity math |
| **P05 — customer booking and progress** | P05a: catalogue/not-sure, acceptance/review/reject and secure guest request/media/progress links. P05b: cancel/reschedule/expiry, service questions, prices/ceiling. P05c: embed/preselected service, informational text, theme/font controls; notification wiring after P06 | P02–P04; P03 question definitions; P06 only for channel integration | Customer books/returns on agreed devices after restart; no account/phone-match disclosure; full vs closed explained; no pay/deposit/card field; copied progress links work before messaging setup |
| **P06 — messaging and inbox** | P06a: encrypted shop-owned credentials, preferences, durable intention/log. P06b: email/SMS/WhatsApp adapters plus authenticated inbound/status callbacks. P06c: job compose/inbox and selected templates/reminders/toggles | P00c for real adapter proof; P01/P02 event and identity contracts | Real channel delivery and agreed inbound routes demonstrated; stale reminders cancelled; send-time preferences respected; failed/revoked provider visible; timeout does not trigger blind duplicate sends |
| **P07 — single Lightspeed connector** | P07a: connection/refresh/revocation, selected product/stock catalogue and employee mapping. P07b: current-job customer link plus work-order/approved-line handoff. P07c: stock ownership, child-edit polling, freshness and uncertain-write reconciliation | P00a passes first; P01–P03 contracts. No payment/report/import package | Actual account supports every required read/write; physical part add/remove/cancel changes stock once; labour never changes physical stock; linked POS job usable by staff; no finance API writes, bulk customer import or second adapter |
| **P08 — job cards and scannable bike tags** | P08a: tag/card layout and QR resolver. P08b: printer adapter, scoped durable print tasks/status/reprint. P08c: auto-print on book-in and physical scanner acceptance | P02 job reference; P00b hardware proof; P01 access. P05 only for automatic book-in trigger | Real printed tag attached to bike scans to correct job; logged-out scan signs in then returns; wrong-shop access fails; offline/unknown print state visible; reprint deliberate; no receipt/payment dependency |
| **P09 — shop settings** | Profile, store type, selected notice/marketing text; centralise service/booking/template settings in their owning packages rather than duplicate screens | P01; integrate P03/P05/P06 as relevant | Each control has a real consumer, safe default and tenant-scoped server validation; no group/subscription/report settings introduced |
| **P10 — release verification and status visibility** | Retained public status/error tracking; run integrated store scenarios; reconcile the revised ledger with acceptance evidence and documented limitations | All retained package slices and applicable provider/device proofs | Retained rows evidenced, one connector proven, tags scanned and real channels verified. No PITR/restore drill, group reporting or payment gate |

Relative build concentration: P02–P07 contain most implementation effort. P00 can expose access or hardware delays before those costs accumulate. No delivery dates or person-week estimates are justified until the proof tasks and issue sizing are complete.

## Printing contract: a tag the mechanic can use

Inspect/reuse `print-agent/main.js`, `print-label.ps1`, the staff label layout and server print routes. The existing agent targets **Windows drivers via PowerShell**; it is not proven to work on a Mac printer host. The current server uses in-memory print maps and clears jobs when collected by an agent; a restart/lost acknowledgement can lose state. P08 must fix the queued/claimed/acknowledged/failed/unknown workflow as part of reliable printing.

Tag minimum: readable job number, concise bike identification, relevant date and a QR containing the stable HTTPS staff-job URL. Agree what customer detail, if any, belongs on a tag visible in the shop. Render QR modules with preserved square geometry, high contrast and the encoder’s required quiet zone; do not stretch a small bitmap. Size/error correction are chosen against the actual label/printer and tested, not declared universally readable. Keep a readable job number as fallback.

Support QR scanning using a phone camera or agreed 2D reader. Where the shop uses a 1D scanner, print an additional Code 128 job number; do not assume it can read QR. Resolve scanner keyboard input in the staff search. Scan must never approve a quote, disclose unauthorised customer data or mark a job collected. Explicit user action performs mutations.

Auto-print on the agreed **book-in/custody event**, not every pending online request. Distinguish staff manual print and an intentional reprint. Bind printer registration, task claim, completion and status reads to tenant/device. Test actual output at normal driver settings, successful scan by both intended scan paths, offline printer, restart, agent logout/revocation, lost acknowledgement and duplicate event delivery. Preserve unknown status for operator reconciliation instead of asserting a sheet printed.

The QR slice of formerly Later row 296 is now in scope; its unrelated receipt customisation options remain Later. QR-mediated mechanic uploads and a customer native app are not implied.

## Single-adapter integration sequence

Follow [the readiness brief](../../decisions/2026-09-10-release-1-lightspeed-readiness.md), which separates fresh documentation from outstanding real-account evidence. R-Series is recommended, not yet confirmed. There are no Lightspeed credentials configured in this checkout. **P00a is an actual access/capability gate**, not a task to mark complete after reading documentation.

After proof: connect/refresh → scoped product/stock reads → explicit current-job customer association → create/update linked work order from approved work → reconcile part commitments → show current/degraded/unknown handoff state. Keep operational times in Wheelhouse where the POS has different scheduling semantics. Payment and refund actions remain in Lightspeed; no payment status inferred from work completion. Disconnection stops sync and leaves local work intact.

A cancelled unsold work order may release a stock commitment; it is not a refund. If a job was settled at the till, surface the conflict and let the shop use Lightspeed’s existing process. This prevents the reduced money scope from reappearing through an “integration” feature.

## Dependency order and first issues

| Stage | Start together where contracts permit | Exit |
|---|---|---|
| **A — prove and define** | P00 provider/print probes; P01 integrity/access audit; short job/approval/stock contracts | Single series fit and required endpoint map, supported print setup; clear blocked evidence where unavailable |
| **B — first useful workshop slice** | P02 persistent job/effort/reference; P03 service/quote calculations; P08 tag layout/resolver after job contract | Staff create a job, print a tag, scan it and reopen the correct job without a sale |
| **C — booking and approval** | P04 capacity/diary; P03 approvals/checklists; P05 booking against stable APIs; P06 channel setup; P09 settings | Request → schedule → quote approval → work → ready → collected; one source of job truth |
| **D — connected store workflow** | P07 only after P00a passes; P06/P05 event wiring; P08 automatic print and physical tests | Real connector handoff, real messaging, physical tag scan |
| **E — store verification** | P10 integration checks and row evidence | Retained scope accepted; deferred features absent from R1 flows |

These are integration stages, not a requirement to wait for unrelated view/configuration work. Messaging does not block building quote/progress links; printing does not wait for the complete booking widget; external API access does block connector implementation assumptions. Assign ownership for shared `server/server.js`, `public/app.js` and migration changes to avoid conflicting parallel edits.

First issue-ready slices:

1. **P00a — prove the chosen Lightspeed account/app**, using LS-01–09; can start once secure access exists. Produce evidence, not connector scaffolding.
2. **P01a/b — tenant relationships and durable revocation**, separate PRs; use populated two-shop fixtures and old-token reactivation test.
3. **P02a — job without sale, planned effort and stable reference**, conditional-version update and restart test. Recheck #18 only where existing order joins affect the job route; do not expand to invoice history.
4. **P08a — print-and-scan tag vertical slice**, after the job reference and hardware fixture; first physical demonstration.
5. **P03a/b — quote amounts and line approval**, after the job contract; an old link cannot approve a changed line and no declined amount enters the approved total.
6. **P04a/b — atomic capacity**, after effort/duration definitions; timed/drop-off/queue concurrency and reschedule tests.

For each issue include current row IDs, request/response examples, allowed state changes, migration/backfill, expected failure, relevant test command, builder/reviewer and exact proof artefact. No need to build a new specification tool.

## Store acceptance scenarios

| Scenario | Observable success |
|---|---|
| Staff intake and bike tag | Create customer/bike/job without a sale, print, attach and scan the tag into that job |
| Customer request | Guest submits service/problem/media, selects a valid day/time and returns through a scoped link |
| Concurrency and reschedule | One winner for last capacity, queued effort counted once, failed move keeps original allocation |
| Partial approval | Approve one line, reject another, revise a third; approved amount/history stay exact; no invoice/payment UI |
| Shop messages | Real email/SMS/WhatsApp update and agreed reply paths reach the same job; revoked keys and failed delivery are actionable |
| One POS handoff | Approved work arrives on the linked Lightspeed work order; product/stock and technician mapping correct; staff handle money in Lightspeed |
| Lost provider response | Local state shows uncertain result and reconciles before retrying a potentially accepted write |
| Print failure | Offline/unknown/reprint behavior clear; wrong-shop or logged-out QR does not expose the job |
| Work and custody | Finished/ready/collected remain separate; payment completion is not inferred |
| Scope check | No invoice issuing, payment/deposit/refund, customer import, report/group/recovery setup appears as a Release 1 task or gate |

Run affected backend/database tests with the non-superuser role, then existing test/typecheck/lint/build/CI checks for implementation changes. Reuse real workshop test fixtures. Add concurrent HTTP, quote revision and printer tenancy tests where they verify business failures; provider mocks supplement rather than replace the P00 proof. This planning pass has not executed application/provider/hardware tests.

## Remaining review inputs

1. First shop’s Lightspeed series and a usable authorised test app/account. Without it we cannot honestly certify API access; P07 stays conditional while other packages progress.
2. Printer model, tag dimensions, Windows driver host and whether the store has a 1D or 2D scanner. P00b produces the supported combination.
3. Concrete message providers/inbound behavior and the remaining selected template semantics (especially pickup versus collection and a delivery-link destination).
4. Proposed workflow defaults: stable states/labels, pending hold duration, quote revision behavior, tag contents and item-field overlaps. Review examples in the issue slices; no new reports, group or recovery decisions are needed.

The original ledger remains untouched. The revised ledger retains 154 original selected row references, defers 18 with reasons, and adds one partial QR row (296): **155 active row references, not 155 independent features**. Row 283 is conditional on the R-Series recommendation; substitute 284 if X-Series wins the same proof. This plan and v2 deck are the current store-review artefacts; previous decks are historical.

## User-experience review artefact

The [Release 1 journey atlas](../../design/release-1-journey/README.md) is the proposed visual build target for store review: 84 high-fidelity screen specimens covering the customer, service desk, mechanic and manager journeys, including alternate outcomes and setup. Screen notes identify their package dependencies and unresolved store/API/device assumptions. Scope decisions remain authoritative; the atlas is not final design sign-off or evidence that integrations are implemented.
