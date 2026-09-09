# Specification and business review — 8 September 2026

**Subsequent scope decision:** Mark, acting as Jack's proxy, has agreed a standalone, interactive workshop prototype before market validation. See the [prototype decisions](2026-09-08-workshop-prototype-decisions.md) for the operative prototype scope. Freemium remains a hypothesis; pricing and audience selection are deliberately deferred. Billing and outbound messages are simulated, and incumbent integration is outside this prototype. The findings below retain their original evidence and apply to later live capabilities as relevant; they are not all prerequisites for the prototype. Commercial risk has been deferred for learning, not validated away.

**Verdict: do not treat the current document set as an executable specification.** The product direction is plausible, but several essential workflows cannot be implemented consistently from these documents. More feature code would currently harden assumptions that the specs have not resolved.

This review proposes corrections; it does not approve a new business model, alter Jack's decisions, or change release ownership. Its companion [acceptance scenarios](2026-09-08-spec-acceptance-scenarios.md) makes the findings testable without starting implementation.

### Where to start

| Consequence | Findings to resolve | Why these come first |
|---|---|---|
| Could change the business or first customer | F01–F04 | Revenue, target series, adoption evidence and differentiation remain unsettled |
| Could force a domain/schema rewrite | F05–F07, F09–F10, F14–F16 | Coexistence, migration, work, scheduling and money need compatible ownership rules |
| Could make a real-shop pilot unsafe or misleading | F08, F11–F13, F17, F19–F23 | Concurrent reservations, stale data, access, side effects and recovery need explicit contracts |
| Could waste implementation effort | F18, F24–F26 | Generated summaries, stale plans and parity scope can expand without proving customer value |

Not every finding blocks all work. For example, a corrected diagram or shop walkthrough can proceed while provider access is unresolved; payment-link code should wait for its money contract, and live multi-tenant onboarding should wait for its safety evidence. Recommendations for frozen features apply only if those features are later enabled.

## Evidence boundary

The working checkout is `f62b537`, from 31 August. Reviewing only that checkout would have produced materially wrong findings. I inspected GitHub's current `main`, **`ccdbf16f5b936c83bd03756bc3a0e9628250b6f6`**, using a separate read-only source snapshot, plus open **PR #44**, head **`5055f082ed43507df604b75c069301a0f9ee698d`**. The main SHA was checked again before writing. Existing local edits and untracked reviews were preserved.

Sources include the business plan, feature catalogue, master plan, workshop/system/service/auth specs, subsequent decisions, business research, current code at the disputed boundaries, and the latest trial report. Drive searches did not locate a relevant business plan; the plans were found in Git history and GitHub. Issue #16 and its ownership comment were read. The referenced XLSX was not obtained, and unrecorded conversations are outside this review.

**Evidence labels here:** **Confirmed** = directly read in the documents/code or independently checked against a primary source. **Inference** = a failure implied by the design, not a production incident reproduced here. **Open** = requires a business decision, real shop observation, or authorized provider test. I did not rerun the product's database suite or competitor trials. Historical test counts are not presented as current verification.

### Source key

All links below pin the reviewed version, rather than a moving branch.

| Key | Source |
|---|---|
| B | [Business plan](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-08-31-business-plan.md) |
| C | [214-feature catalogue](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-08-31-feature-catalogue.md) |
| M | [Master implementation plan](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/superpowers/plans/2026-08-31-master-implementation-plan.md) |
| L | [Lightspeed platform decision](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-02-lightspeed-first-platform.md) |
| S | [R-Series sync decision](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-02-r-series-sync-and-rate-limits.md) |
| D | [Booking modes and downtime](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-04-booking-mode-and-downtime.md) |
| J | [Job type before diary](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-04-job-type-before-diary.md) |
| W | [Service catalogue and labour design](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/superpowers/specs/2026-08-31-workshop-service-catalogue-design.md) |
| A | [WorkOS design](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md) and [implementation plan](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/superpowers/plans/2026-08-31-workos-auth-migration.md) |
| T | [Tenant-scoping decision](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md) |
| R | [Business research](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/research/business/business-research.md) |
| Q | [8 September competitive trials, open PR #44](https://github.com/JackCurphey/wheelhouse-epos/blob/5055f082ed43507df604b75c069301a0f9ee698d/docs/decisions/2026-09-08-competitive-trials.md) |
| O | [Ownership sign-off](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/docs/decisions/2026-09-01-ownership-signoff.md) and [issue #16](https://github.com/JackCurphey/wheelhouse-epos/issues/16) |
| CODE | [Current server](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/server/server.js), [database layer](https://github.com/JackCurphey/wheelhouse-epos/blob/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/server/db.js), [migrations](https://github.com/JackCurphey/wheelhouse-epos/tree/ccdbf16f5b936c83bd03756bc3a0e9628250b6f6/server/migrations) |

## What is sound

- Leading with booking and workshop work that can coexist with an existing till is a reasonable hypothesis. It lowers the initial switching commitment.
- Choosing one integration first, preserving server authority and forced RLS, snapshotting service prices, and requiring a performed restore are sound constraints.
- The latest decisions correctly distinguish a drop-off day from an appointment time, allow shops to choose which services appear online, and leave the customer's diagnosis to a mechanic.
- The research repeatedly corrects itself and explicitly labels some unknowns. This is valuable, provided corrections replace operative claims rather than merely accumulating below them.
- Using a supported identity provider can remove real security maintenance. The problem is incomplete application authorization and workflow design, not the existence of that dependency.
- There is no evidence here that hundreds of shops require microservices, tenant-per-database storage, a new queue service, or a wholesale frontend rewrite.

## Findings that change what should be built

### F01 — There is no single settled commercial promise

**Confirmed conflict / Open decision. Sources: B §§3–4, 13; M §1; Q §6.3.**

B promises a free workshop forever and a £49–79/month paid full system, yet leaves the public free tier's future open after G4. Q says the software is completely free and marginal-cost integrations use customer accounts. It does not clearly say whether the till remains paid. Q is also still an open PR, so its recorded decisions must be distinguished from merged policy.

This determines entitlements, onboarding, billing, support, and whether the business has revenue. BYO Twilio transfers messaging charges; it does not pay for hosting, storage, backups, security, maintenance or support. If everything is free, the current conversion gates and economics no longer describe the business.

**Required correction:** one commercial contract table: booking, diary, job-done email, till, integrations, support and export; who pays whom; limits; grandfathering; what can change. Resolve whether “free forever” applies to a defined version, defined functions, or every future workshop feature. Do not silently reinterpret the latest wording. This review asks for clarification and carries both economic cases meanwhile.

### F02 — The target market is narrower than the market calculation

**Confirmed gap / Inference. Sources: B §3; L §§3, 5, 7–8; Q §§2, 6.4.**

The 1,675-independent-shop estimate is neither a current UK R-Series census nor an addressable customer count. The actual first segment is UK shops on the chosen Lightspeed series, with a booking problem, usable API access, and willingness to adopt a second system. None of those conversion factors is measured.

The X-Series trial does not prove R-Series is unavailable. Equally, an R-Series API reference does not prove we can obtain an appropriate account or recruit shops on it. “North America uses the same adapter, so the build does not change” is too strong: tax, currency, addresses, timezones, messaging and support hours still change the product.

**Required correction:** name the first shop profile and exclusions; distinguish market size from reachable prospects and likely adopters. Obtain the target-series access path and a small verified list of eligible shops before committing the adapter. Treat geographic expansion as a separate readiness decision. Do not switch to X-Series merely because its trial was easier to open.

### F03 — The plan removes its learning mechanism while retaining its learning gates

**Confirmed conflict. Sources: B §§8, 10–11; O; L §5; M P4 and §10.9.**

O marks DP-1 through DP-4 as queried, while L describes the programme as struck out. M still depends on three real shops using the product for thirty days. Formal calls and a WhatsApp group are optional methods; independent evidence that shops can and will use the product is the requirement. Desk research and Jack's expertise cannot establish another shop's adoption.

The proposed conversion kill criterion is also confounded: free-forever founding partners may never be eligible to convert, and no conversion is meaningful until the paid till floor actually exists. G4's under-5% monthly churn at ten paying shops effectively means zero lost shops in each such month, not a stable estimate of churn.

**Required correction:** keep a small observed-use gate even if the programme format is dropped. Define eligible paid prospects separately from grandfathered users; start conversion measurement when a usable offer exists; record cancellations as counts with denominators. Test the free flow with booking/diary tasks rather than requiring a cash sale in a product whose till is hidden.

### F04 — “Better than competitors” still overstates the evidence

**Confirmed reasoning defect. Sources: R §3.6 and §10.3; L §6; Q §§3–6.**

Q's observed Hubtiger diary defeats the broad feature-superiority claim. But Q itself repeats the old claim that nobody used Hubtiger and the evidence is marketing, even after recording live tests. It also leaves a tested integration in its outstanding list. “No timed diary” does not establish Velodrop is worse for drop-off shops: our own D explicitly chooses an untimed day queue for them.

Instant confirmation in one Hubtiger configuration is not proof that moderation is unavailable in every configuration. A failed quote push in one X-Series trial is useful evidence of that failure, not of all Hubtiger integrations failing. Successful customer writes do not rule out endpoint-specific permissions or quote configuration. A button labelled Citrus Lime proves a listed option, not a working supported integration.

**Required correction:** rewrite the comparison around three observed shop tasks, including the manual handoff to the incumbent till. Separate vendor claim, trial observation, interpretation, configuration and untested behavior. Remove “nobody,” “cannot copy,” and “inevitable” claims unsupported by evidence. Feature parity is a candidate backlog, not a launch requirement.

### F05 — Read-only coexistence has no complete job-to-payment workflow

**Confirmed specification gap / Inference. Sources: L §4; M §1, PF-2, CX-3–5; earlier wedge §5.**

A Wheelhouse booking uses a chain from Lightspeed's catalogue. The mechanic completes the job here. Which system reserves that chain, creates the invoice, takes payment, decrements stock and issues a refund? Reading Lightspeed cannot cause any of those writes. If staff manually enter the work in Lightspeed, that is double entry; if they do not, its stock and accounts are wrong. A later imported Lightspeed job can also duplicate the locally created one.

Calling write-back a convenience because it benefits Lightspeed overlooks the shop's current workflow. Nor can two independent booking authorities guarantee capacity safety merely by polling: a phone job created just after a poll is invisible until the next successful sync.

**Required correction:** specify one fully worked coexistence journey, with a source-of-truth table for each field and every stock/money event. Choose a measured manual handoff, narrow write-back, or a clear operating rule making Wheelhouse the scheduling authority. Preserve that choice as a product decision. Do not promise no double entry or a globally conflict-free diary unless the chosen workflow delivers it.

### F06 — Continuous import is being mistaken for migration readiness

**Confirmed gap. Sources: L §4, S §4, M P6, C DAT-01–03.**

An imported customer list and sales history do not make replacing a till a settings change. The target data model lacks or has not specified several source concepts: stock reservations, serialised items, variants, deposits, gift liabilities, outstanding work, credits, refunds, tax snapshots and historical provenance. Frozen feature scope and a promise to migrate a whole R-Series shop conflict if that shop uses those concepts.

Historical imports must not run through ordinary sale creation and deduct today's stock, send receipts, or change today's takings. Local edits must not be overwritten by imported versions without policy. Identical integer IDs from two accounts must not collide.

**Required correction:** separate an external source mirror from live operational records. Define identity by tenant, provider, external account, entity type and external ID. Specify supported imports, archive-only records and explicit unsupported cases. Define cutover reconciliation, final delta, stock snapshot, open liabilities, rollback limits and who signs off. Preserve original document identity and tax amounts; do not recalculate historical receipts using today's catalogue.

### F07 — Polling has a transport outline, not a correctness contract

**Confirmed gap. Sources: S §§3–6; L §4.**

The parent/child timestamp question is correctly open. Other loss paths are not covered: records sharing the checkpoint timestamp; a record changing while pages are fetched; a crash after page writes but before checkpointing; deleted records; archived records; customer merges; two workers processing one account; token refresh races; a poisoned row; incomplete initial backfill coexisting with live polls.

**Required correction:** durable per-stream checkpoints advanced only after durable writes; replay-safe upserts; a deliberate equal-timestamp/overlap strategy; deletion and merge reconciliation; bounded worker ownership; retry and quarantine states; explicit backfill-to-live handover. Separate streams for the entities actually promised, and prove child-change coverage against the target account. Do not assume a deletion feed or timestamp semantics that the provider has not demonstrated.

The quoted 17-minute backfill is a lower-bound illustration for 1,000 one-cost pages, not a migration SLA. Relations, endpoint costs, multiple streams, retries and live-sync headroom alter it. Current [Lightspeed documentation](https://developers.lightspeedhq.com/retail/introduction/ratelimits/) confirms per-account/client buckets, a base one-drip/second rate, and variable costs. Separate allowances do not prove our integration can never affect till operation; sustained abuse can still suspend API access. Keep the header-driven throttling, but measure the full workload.

### F08 — The freshness requirement contains a dangerous exception

**Confirmed contradiction. Source: S §5.**

S requires visible freshness, then says not to show it if the number becomes large. That hides precisely the state in which staff need it. A single successful work-order check can also mask stale inventory or an unfinished historical import. A recent empty response is not proof that all data is reconciled.

**Required correction:** always show last successful relevant sync plus healthy, delayed, disconnected or incomplete status. Distinguish last attempt from last success and distinguish resource streams. Never turn a failure green because another stream succeeded. Attribute our scheduling delay, provider outage, revoked access and rate limits accurately. Define what actions remain safe while stale, including customer booking behavior.

### F09 — Scheduling depends on a till document the free mode removes

**Confirmed design conflict. Sources: D §5.1; W pieces B–D; M PF-2; CODE `createWorkshopJob`.**

D proposes deriving duration from `sale_document_items` on the job's order. PF-2 deliberately creates jobs without those orders. This is not merely a derive-versus-cache performance choice: a standalone job must own its planned work without becoming a till sale. Also, a source Lightspeed due date has no scheduled slot; assigning it a fictitious time to fit the diary would invent capacity information.

**Required correction:** define job work and scheduling effort independently of whether a till invoice exists. A small job-work structure or explicitly non-fiscal work document can serve; a general ledger rewrite is unnecessary. Specify imported unscheduled work, unknown duration, the one-hour “not sure” reservation, multiple services, parts with zero labour, and free repairs with positive duration. Cache an aggregate only if measurements justify it.

### F10 — Billing duration, scheduling duration and elapsed time are conflated

**Confirmed inconsistency / Open domain decision. Sources: B/M CX-0; C JOB-12; W decisions 1–4; D §5.1.**

M and C describe time multiplied by a rate; W explicitly says a typed fixed price and no hourly-rate concept. W also snapshots minutes, while D says service totals determine the slot. A mechanic resizing a slot, changing a service, recording actual time or doing a warranty recheck now has several possible meanings.

**Required correction:** keep the decided fixed-price labour model unless Jack changes it. Name planned effort, scheduled allocation, actual time and charge separately. Define who may override each and whether repricing/replanning needs customer approval. Catalogue edits never rewrite saved job terms. Shop-verified bike component facts must carry provenance and replacement history; “captured once, reused forever” is wrong when the component changes.

### F11 — Correct sequential checks still permit concurrent overbooking

**Confirmed code shape / Inference, not a live race reproduced here. Sources: M DS-8; D §4; CODE `checkJobSlot`, staff POST/PUT and portal POST.**

Current code checks availability before `createWorkshopJob` begins its insert transaction. Two requests can both see the same last slot or daily capacity, both pass, and both insert. Adding a request transaction at ordinary read-committed isolation would not by itself solve that race. The existing sequential reserve fix is useful and should not be mistaken for a concurrency guarantee.

**Required correction:** checking and consuming capacity must be one serialized database operation for the affected resource/day, including edits and moves. A per-resource/day lock and recheck is a possible small implementation; it must also handle an initially empty day. Define deterministic lock order for moves across mechanics/days, optimistic version checks for stale edits, and retry/idempotency behavior. Prove one winner for two competing requests. Preserve D §7.7: staff may intentionally exceed the daily reserve; that does not imply they may silently overlap timed jobs.

### F12 — Moderated bookings have no reservation lifecycle

**Confirmed gap. Sources: D §7.3; C BOOK-06–08; M WS-1/5; CODE JOB_STATUSES.**

Pending requests consume slots today. Without an expiry/review policy, anonymous requests can occupy the diary indefinitely. If pending requests do not reserve, multiple people can request the same capacity and confirmation becomes a negotiation. Neither choice is specified end to end.

**Required correction:** define requested, accepted, rejected, cancelled, expired and no-show behavior, with the capacity effect of each. Define acknowledgement versus confirmation; deadline and escalation when staff do not review; revised-service approval; customer rescheduling as an atomic move; and what happens if sending the message fails. Rate limits alone do not define a fair reservation policy, especially across replicas or shared public networks.

### F13 — Drop-off operation is not ready merely because settings exist

**Confirmed gap. Sources: D §§6–9; J; merged booking-foundations plan; CODE migration 015.**

The foundation adds configuration; the portal still uses hardcoded timed job types. Do not report that as drop-off support. The remaining decisions include pooled versus assigned capacity, mode changes with future jobs, recurrence exceptions, carry-over work, and workshop effort spanning multiple days. Simply summing everyone's free minutes can offer an impossible timed slot or assign specialist work to an unavailable mechanic.

**Required correction:** state separate algorithms for timed and drop-off shops; keep booking mode per shop as decided. Include a shop timezone, local calendar dates, closures, leave, breaks and existing future bookings. Avoid double-subtracting lunch as both a block and a reserve. A 09:00 appointment with a 30-minute arrival lead at a shop opening at 09:00 currently promises arrival at 08:30; constrain earliest slots or define a real intake window. Reconfirm affected bookings when shop settings change.

### F14 — “Complete” conflates work, payment and custody

**Confirmed gap and current behavior. Sources: C JOB-02/19, DONE-06; M CX-5; CODE order tender route around lines 2260–2270.**

Tendering an order currently sets its job to complete. The job-done email is supposed to be sent on completion and invite payment. A bike can be repaired but unpaid, prepaid but still in progress, ready but uncollected, or collected by an authorized third party. One status cannot safely drive all four processes.

**Required correction:** separate work status, booking status, payment balance and bike custody. They can be small fields and explicit transition rules, not a workflow engine. Record checked in, ready, collected, collector authority and staff actor. Specify no-show, parts delay, failed repair, warranty return and reopening. Payment must not assert that work or safety checks occurred; sending a completion email must not create a second invoice or request payment of an already settled balance.

### F15 — Invoice and payment requirements precede their prerequisites

**Confirmed dependency defect. Sources: M CX-3–5 versus TILL-4; C DONE-04 → REP-05; W “VAT needs no work.”**

Reconciling an invoice to an order total does not establish a valid invoice. The promise covers VAT and non-VAT shops, immutable issued documents, credit notes, discounts, parts/labour, and external payment reconciliation. A sales-period report alone is not a VAT return and is not Making Tax Digital integration.

**Required correction:** specify currency, rounding, per-line tax treatment, supplier identity and VAT status at issue, unique invoice numbering, tax point, issued-document immutability, partial settlement and credit notes before CX-3. HMRC distinguishes invoice requirements and VAT record requirements; only VAT-registered businesses issue VAT invoices. [Invoice requirements](https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include), [VAT Notice 700/21](https://www.gov.uk/guidance/record-keeping-for-vat-notice-70021), [VAT records](https://www.gov.uk/charge-reclaim-record-vat/keeping-vat-records).

Keep Wheelhouse subscription billing separate from a shop collecting a repair payment. Define merchant identity, supported providers, transaction fees, stale links, partial payments, cash collected while a link is open, provider retries, refunds and disputes. “Keep your processor” cannot mean automatic integration with every processor. It can mean a supported set plus an honest external-payment workflow.

### F16 — Refund, stock return and sale cancellation are not synonyms

**Confirmed underspecification. Sources: C TILL-09–11, PAY-06; M TILL-1; original Shopify spec.**

“A sale is reversed; stock returns” is insufficient. Refunding labour returns no stock. Refunding a broken chain may put it in quarantine rather than sellable stock. A cancellation before payment is different from a refund after settlement. Imported historical sales are another distinct case.

**Required correction:** define money movement and inventory disposition independently, per line and quantity. Include partial refunds, discounts/tax allocation, exchanges, manual card refunds, duplicate submissions and multiple staff attempting a refund. Decide whether external refunds are initiated here or only reconciled here. Do not infer restocking from the existence of a refund webhook.

### F17 — Notifications need delivery and spending semantics

**Confirmed gap. Sources: M WS-2/6, CX-5; Q §6.3; C COM-04/07/09.**

A status trigger plus a message log does not specify reliable delivery. A provider timeout may occur after a message was accepted. A retry can charge the shop twice. Reopening and completing a job can send an obsolete invoice. An imported historical job can accidentally notify an old customer. A failed SMS must not roll back a completed repair.

**Required correction:** commit a notification intention with the business transition, process outside the database lease, track provider acceptance/delivery/failure separately, and handle ambiguous sends explicitly. Define deduplication per event/template version, recipient snapshots, suppression at send time, quiet hours for reminders, cancellation of stale queued reminders, and a manual contact fallback. Do not promise exactly-once external delivery unless the provider contract supports it.

Customer-owned accounts also need guided provisioning, spend caps, abuse limits, key rotation, disconnect behavior and log redaction. Product login/password reset must still work before a shop has configured messaging. Transactional email and service-marketing reminders need distinct purpose/consent rules. Twilio charges UK SMS **per segment**, with destination/type-dependent costs; “one message” is not a dependable cost unit. [Twilio UK pricing](https://www.twilio.com/en-us/sms/pricing/gb).

### F18 — A generated job summary has no truthfulness contract

**Confirmed gap. Sources: B §5d; M CX-1; C DONE-01.**

“Generated from the job, not composed by hand” does not specify templates versus AI, whether notes are customer-safe, or how a suggestion becomes an assertion that work was done. A service titled “brake check” is not evidence that pads were replaced or the bike is safe.

**Required correction:** start with a deterministic summary of approved, completed customer-visible work. If AI is chosen later, specify grounding, review, cost, data handling and fallback. Never invent diagnosis, completion, safety certification or charges. Keep internal notes out by construction. Preview the exact invoice and summary before irreversible sending, and record the version sent.

### F19 — WorkOS permissions do not yet express workshop operation

**Confirmed design contradiction. Sources: A §6.3; M TILL-5; C ACC-04.**

The mechanic role has workshop write but lacks `till:operate`; all sale-document routes require `till:operate`. Current job charges live on sale documents. Consequently a mechanic may be able to move a job but not add the labour needed to finish it. The role prose promises read-only sales but the route table puts sales reads behind the same write-capable permission. The cashier permission also groups ordinary sales with document mutations, while the catalogue promises restricted refunds and discounts.

**Required correction:** map permissions to actual commands: edit job work, issue estimate, approve price override, take payment, refund, adjust stock, view financials, manage credentials, export, and manage members. Separate sensitive actions where business rules require it. Decide shared-device actor attribution and owner recovery. Do not infer access rights from scheduling flags or grant cashier access automatically to an otherwise unmapped membership. Default denial plus an explicit route allowlist is simpler to reason about than a default-open route.

### F20 — The auth plan omits browser-bound login protection and cross-system recovery

**Confirmed omission / Inference. Source: A implementation Task 7 and Tasks 7a/12.**

The specified callback exchanges any supplied code and sets a cookie without a described browser-bound login transaction. Tests positively exercise a callback without such a transaction. The organization-selection example puts a pending authentication token in a URL. Neither a sealed cookie nor hosted login automatically proves that the callback belongs to the browser that initiated it.

**Required correction before auth implementation:** specify a short-lived, single-use login transaction with CSRF protection, validated return destinations, and PKCE/provider protections as appropriate to the selected flow. Keep sensitive pending tokens out of URLs. Add negative tests for unsolicited/replayed callbacks and cross-browser substitution. OAuth security guidance requires clients to prevent CSRF; the current WorkOS Node guide separately calls for protection on state-changing app routes. [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html), [WorkOS Node guide](https://workos.com/docs/authkit/vanilla/nodejs).

Also define concurrent refresh behavior across tabs/replicas, membership revocation freshness, invitation acceptance, duplicate/out-of-order webhooks, and recovery after WorkOS succeeds but local provisioning fails. One user can be staff at one shop and a customer at another: organization presence describes a session context, not a person's permanent type. Test that dual-role journey. Use real SDK contract checks for critical auth shapes; a fake that repeats our assumptions cannot verify the provider integration. WorkOS documents refresh rotation and configurable session lifetimes. [WorkOS sessions](https://workos.com/docs/authkit/sessions).

### F21 — The production gate and the tenant-scoping implementation disagree

**Confirmed conflict, with useful fixes already shipped. Sources: M §4/DS-1; T; CODE.**

M prohibits request-wide transactions. T records a merged savepoint-aware request-wide option, disabled by default. M's DS-1 acceptance is a text search for no `set_config(..., false)`, even though direct/session connections with deliberate cleanup remain the supported operating mode. T itself acknowledges the boot probe can miss unsafe topology. A green probe cannot authorize transaction pooling.

**Required correction:** record one production topology and semantic acceptance criteria, not a grep that rewards a dangerous mechanical change. Keep the request-wide mode off unless deliberately re-approved after the full response/commit and lease-boundary review. Prefer short explicit database units when transaction pooling is actually needed. Do not claim stage one closed DS-4/DS-5: current migrations still include single-ID tenant relationships and do not implement the proposed resolver privilege boundary.

The resolver design also needs its own threat model. A `SECURITY DEFINER` wrapper that accepts an arbitrary shop or session token is not safe just because underlying tables are revoked. Specify callable functions, minimal results, ownership, safe search paths, permitted roles and tenant-consistent relationships. Shared-role RLS protects ordinary tenant queries; it is not a guarantee against arbitrary malicious SQL that can set its own tenant context.

### F22 — Availability, recovery and exit are requirements, not provider checkboxes

**Confirmed gaps. Sources: B §5b; M PL-2/3/11/12 and TILL-3; T; current STATUS.**

PITR is valuable, but no recovery-point target, restoration-time target, attachment recovery, credential recovery or replay policy is defined. Restoring the database can resurrect a sent-notification intention or an old payment state while the provider has continued operating. A shared-database PITR restore is not automatically a safe single-shop restore.

**Required correction:** agree measurable recovery targets and rehearse database plus file/key recovery in isolation. Reconcile external side effects before workers resume. Specify unavailable-database, unavailable-auth and unavailable-POS behavior, with a simple printable/exported daily work fallback if offline operation remains out of scope. Verify health behavior in the real hosting topology: a Compose health status is not automatically traffic removal.

The design-partner promise of data out on request begins before P6's self-service CSV feature. Provide a documented staff-assisted export before onboarding, including attachments, relationships and machine-readable identifiers, then automate it when justified. Define cancellation, expiry, export, deletion and retained records. “Stop and delete” for a source integration must not delete independently created shop work by accident.

### F23 — Privacy research has been converted into overconfident schema rules

**Confirmed overstatement. Sources: workshop-first spec §5; system-build §4/7; M §9; L §4.**

An account does not by itself make us controller for all its data; purpose and decision-making do. An attributed opinion is not a blanket exemption from rectification or erasure, and not every mechanic entry is an opinion. “Never delete” cannot be the whole rights policy. UK/EU hosting alone does not establish all six jurisdictions' compliance or account for subprocessors, logs and remote access.

**Required correction:** map controller/processor roles per processing purpose and data flow. Keep attributed revisions for audit integrity while supporting lawful correction, restriction, redaction, deletion and retention exceptions. Distinguish a bike association from verified ownership; a stolen-bike lookup alone does not establish title either. Separate a current UK launch review from future jurisdiction work. ICO guidance determines roles by purposes/means and describes rights with conditions, not blanket exclusions. [Controller/processor test](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/what-are-controllers-and-processors/), [rectification](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-rectification/), [erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).

This is a concrete request to correct legal assumptions before fixing them into the model, not a conclusion that a particular contractual arrangement is legally required in every case.

### F24 — The feature catalogue is an inventory, not a specification

**Confirmed by a structural check. Sources: C; M; O.**

The catalogue really contains 214 unique feature IDs and the stated 55 Have / 11 Partial / 146 None / 2 Unknown counts. Those arithmetic totals are correct; their implementation status is a 31 August snapshot. They must not be reused as a current audit.

Dependencies are materially incomplete. `JOB-11` depends on `PUR-06`, which depends on `JOB-11`. `DONE-05` depends on a payment decision but not on a payment implementation. `PAY-06` ties card refunds to a physical terminal, overlooking online payments. Email is marked prerequisite for all two-factor authentication even though that is not inherent. The master plan omits task IDs for the now-central Lightspeed connection, continuous import, freshness and stop/delete requirements. Service reminders, booking modes and BYO credentials also need explicit acceptance contracts.

**Required correction:** retain the IDs and add proposed In/Out/Change/Missing decisions separately from implementation status. Split decisions from deliverables. Record only real prerequisites. Every retained feature needs an actor, precondition, observable outcome, failure case, data ownership and acceptance example before being treated as implementation-ready. Do not turn agreement that a feature is useful into agreement to build it before launch.

### F25 — The operative documents cannot safely be followed in their current form

**Confirmed. Sources: M, T, W, D, A, current STATUS, local reviews.**

M calls itself the single document to work from yet still contains a blocked DS-0 because the review prompt is absent remotely, old test counts, completed work labelled absent, obsolete phase rationale, and missing Lightspeed tasks. The referenced corrective review and revision prompt exist as local untracked files in this workspace, not in the reviewed remote main. STATUS says nothing is blocked while listing real access/design dependencies.

W says labour/service work is unimplemented although parts are merged. D says nothing is implemented although its foundations are merged. A assumes the staff React rewrite exists and retains migration numbers now occupied by service and booking work. Its drop-column migration is explicitly dev-only; it must not become a production migration by following the old instructions later.

**Required correction:** a compact current-spec index with approved/proposed/superseded/implemented states and explicit supersession links. Reconcile affected sentences, not just add a correction paragraph. Archive executable plans once executed. Reference behavior/symbols and source SHAs rather than only drifting line numbers. Make the missing local review evidence durable through the normal review process. Keep original decision history; stop asking implementers to infer precedence from it.

### F26 — Several expensive dependencies are justified by future scope

**Inference from current requirements. Sources: M P1/P3/P6; A; B §5b; Q §6.1.**

Full Hubtiger parity, a forum with SSO/email-in, all-history migration from day one, chain SSO, recall tracking and a custom receipt designer can each become substantial projects. None is automatically required to prove that a UK shop prefers our booking-and-diary flow. The architecture workflow even built an unused transaction mode while more direct tenant-integrity tasks remain open.

**Required correction:** require each new subsystem to name the present shop task it enables and the smaller alternative considered. Keep identity security, correct scheduling, data isolation, recovery and consent. Challenge breadth such as enterprise SSO before chain demand, a community platform before recurring peer discussion, and recall tooling without a source/update/false-negative policy. A print agent decision should be based on an actual job-tag workflow and supported devices, not “nearly finished” or the assumption browser printing is automatically equivalent.

## Economics stress test

This is a sensitivity model, **not a forecast**. The 1,675 shops remain an old input from the plan, not a freshly verified population. Using the plan's consumer-inclusive prices and an illustrative standard 20% VAT treatment gives:

| Monthly price incl. VAT | Monthly revenue excl. VAT | Annual revenue per payer | Revenue at 1,675 payers/year |
|---|---:|---:|---:|
| £49 | £40.83 | £490 | £820,750 |
| £59 | £49.17 | £590 | £988,250 |
| £79 | £65.83 | £790 | £1,323,250 |

The plan's roughly £1.3m ceiling corresponds to the top of its range, not to a £59 midpoint. Its UK R-Series subset will be smaller. Actual VAT treatment depends on the business's status and supplies; the model does not decide that status. [UK VAT rates](https://www.gov.uk/vat-rates).

For a worked stress case, assume **1,000 total active shops**, £59 paid price, **£15 monthly variable cost per paid shop**, **£3 per free shop**, and **£200 fixed monthly operating cost**. Costs are invented inputs for sensitivity, not measured provider quotes. BYO messaging is excluded. These deliberately modest free-user costs show why zero messaging margin does not mean zero cost.

| Paid share | Paying shops | Revenue excl. VAT/month | Contribution after assumed costs |
|---|---:|---:|---:|
| 2% | 20 | £983.33 | −£2,456.67 |
| 5% | 50 | £2,458.33 | −£1,341.67 |
| 10% | 100 | £4,916.67 | £516.67 |
| 20% | 200 | £9,833.33 | £4,233.33 |

This case breaks even around **8.61% paid share**, before acquisition, migration/onboarding, development and any costs omitted from the £15/£3 assumptions. If the till is also free, the subscription contribution is zero and another funding model must be written. Do not conceal founder support time by pricing it at zero.

The model to complete needs: active free/paying shops, conversion lag, eligible conversion cohort, support minutes × loaded hourly cost, onboarding hours, storage/photo retention, backup costs, polling traffic, email, provider support and fixed operations. Model 10/100/1,000 shops and normal/busy/recovery weeks. At £59 including VAT, a 30-minute call at an assumed £40/hour costs £20 of £49.17 net monthly revenue before infrastructure. That is the practical constraint behind the simplicity promise.

## Complexity and maintainability assessment

Applying the review skills: **entropy** (growing disorder and maintenance cost without corresponding value) is concentrated in conflicting specifications and duplicated sources of truth. **Negentropy** (deliberate growth in order and reusable capability) comes from a single behavioral contract, source provenance and reusable acceptance scenarios. **Tacit knowledge** (unwritten assumptions about how the shop actually works) is currently carrying scheduling, payment, custody and migration decisions.

| Area | Assessment | Simpler direction | Simplification effort estimate |
|---|---|---|---|
| Core tenant integrity and recovery | Necessary complexity; preserve | Explicit short transactions, tenant-consistent references, tested restore | Not a deletion candidate |
| Optional request-wide transaction machinery | V2 structural complexity beyond the supported topology | Keep disabled; assess removal separately; do not activate to satisfy a text search | Roughly 1–3 engineering days to assess/remove safely, not measured |
| Forum/SSO/community infrastructure | V1 drag before observed community demand | Existing email/WhatsApp plus maintained help pages | A few hours to remove from launch dependencies; no production deletion proposed |
| Full competitor parity | V2 structural scope expansion | Select requirements from observed jobs and keep the rest candidate-only | 1–2 planning sessions to bound; avoided build cost unknown |
| Full-history live operational import | V3 if every domain must mimic the source before booking works | Separate source archive/mirror from operational migration and explicit cutover | 1–3 design sessions; implementation estimate needs source samples |
| WorkOS SDK and central authorization | Justified, with overbroad launch scope | Keep supported auth; correct commands and boundaries; justify chain SSO separately | Do not replace with custom identity code |
| Recall/spec enrichment | V2 if placed before evidence of paid adoption | Basic attributed service facts; license research and recall sources separately | A planning change now; later effort unestimated |

Qualitative requirement-to-complexity rating: **6/10 for the roadmap**, driven by breadth and unproved integration promises, not by the current single-process stack. No defensible monthly “vanity debt hours” can be calculated without maintenance observations; inventing one would repeat the research's confidence problem.

Proposed continuation rules: no new subsystem without a present workflow and a simpler alternative; no extra adapter before the first one passes its real-account contract; no promise of parity based on unread or single-configuration marketing; no infrastructure expansion without a measured capacity/recovery need. Security/financial incidents should contain the affected capability and preserve evidence/data, not trigger an indiscriminate automatic shutdown of every shop.

## Decisions to resolve before further dependent feature work

These are proposed questions for the named decision-makers, not reassigned tasks or accepted decisions. Product authority remains Jack's, technical data-safety review remains Mark's, and paired work needs an explicit driver/reviewer definition.

| Decision | Proposed direction | Closure evidence |
|---|---|---|
| What is free and what funds it? | One explicit entitlement and third-party-cost table | Same promise in business plan, pricing copy and onboarding |
| First supported shop and Lightspeed series | Keep R-Series provisional until access and relevant shops are verified | Source-account sample and eligible-shop evidence |
| Where is a coexistence job scheduled, billed and paid? | One scheduling authority and a supported, measured handoff | Full booking-to-refund paper walkthrough with no unexplained writes |
| What replaces the disputed partner programme? | Small observed-use gate; format flexible | Independent users completing real tasks and returning to use it |
| What owns job work and duration? | Independent of till billing; fixed-price labour preserved | Free job, imported job and paid job fit one model |
| How are pending bookings, cancellations and edits handled? | Explicit reservations and atomic transitions | Competing bookings and rejected reschedule scenarios have one answer |
| What is the sync completeness contract? | Per-stream state, replay, reconciliation and visible degradation | Live API capability report plus checkpoint failure scenarios |
| What is launch financial scope? | Correct invoices/payments before job-done payment links | Golden invoice/refund examples and merchant-account decision |
| What is launch access scope? | Workshop permissions and secure hosted identity before chain features | Permission matrix exercised against real user journeys |
| What are recovery and exit commitments? | Measured targets and a manual export path before onboarding | Restore/reconciliation drill and complete shop export |

The end condition for this specification work is not “everything has a paragraph.” It is that Jack and Mark can walk the companion scenarios, arrive at one unambiguous expected outcome for each launch workflow, and identify the external claims still needing evidence. Only then should those contracts be translated into implementation plans.

## Verification performed for this review

- Read local branches, current remote main, PR state, issue #16 and the recorded September decisions; current main remained at the pinned SHA on recheck.
- Parsed all 214 catalogue rows: counts match, no duplicate IDs, and the `JOB-11`/`PUR-06` cycle exists.
- Inspected current booking validation/write boundaries, portal redaction and guest identity behavior, labour and booking migrations, tenant mode, auth plan callbacks, and permission contracts.
- Confirmed that staff booking checks, guest-phone isolation, portal redaction, service/labour foundations, capacity-reserve subtraction and the Compose `/healthz` update have landed. They are not re-reported as wholly absent.
- Checked primary Lightspeed, WorkOS, OAuth, ICO, HMRC and Twilio material for the specific claims cited. No broad competitor financial audit, universal legal clearance, or production safety certification is claimed.
- Independently calculated the economic scenarios. No product code changed; no real customers were contacted or messaged; no provider accounts were connected.
