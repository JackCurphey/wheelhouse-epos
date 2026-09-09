# Specification acceptance scenarios — 8 September 2026

**Scope update:** The subsequently agreed [workshop prototype decisions](2026-09-08-workshop-prototype-decisions.md) define the immediate deliverable and its P-01–P-13 walkthrough checks. The scenarios below remain a broader review backlog for applicable live capabilities; they are not all prototype requirements. Pricing, target audience, integration, real billing, and real messaging are deferred under that decision.

Companion to the [adversarial review](2026-09-08-spec-and-business-adversarial-review.md). These are **proposed behavioral contracts**, not approved product changes or tests claimed to have run. They expose choices before anyone writes code. Where a rule is undecided, the outcome explicitly calls for a decision rather than silently making one.

Use this at the counter with Jack and a shop operator. For each applicable scenario, write the expected screen/message, the database/business facts that change, the facts that do not change, and the person allowed to perform the action. A technical reviewer should check the failure and concurrency cases. A useful result can be “out of scope, with this explicit fallback.”

## 1. The product promise and first successful use

| ID | Scenario | Required outcome to specify | Review finding |
|---|---|---|---|
| AC-01 | A shop reads “free” and signs up without an SMS account | Exact included functionality, provider charges, setup burden and fallback are clear before signup. Decide whether the till is paid. Password recovery does not depend on a shop-provided messaging key | F01, F17 |
| AC-02 | A shop already uses Lightspeed and does not want to switch till | Booking, workshop, stock, invoicing and payment each have an explicit owner. No promise of invisible integration where a manual action is required | F05 |
| AC-03 | A public signup produces X-Series, while the adapter is R-Series | Detect unsupported series before credentials/import. Give an honest supported path; do not claim compatibility based on branding | F02 |
| AC-04 | A new shop has no mechanics, hours or bookable services | Staff can reach a usable diary through a short setup; public booking stays unavailable with a useful message until prerequisites exist. Do not send the free user to an empty till | F03, F13 |
| AC-05 | An owner with no training tries booking, receiving and completing a job | Record completion, assistance, errors and time. Agree task-specific success thresholds before comparing with a competitor | F03, F04 |
| AC-06 | A grandfathered free partner never buys the till | Their agreed entitlement is honored. Do not count them as failed paid conversion unless the paid offer is actually outside their grandfathering and available to buy | F01, F03 |

## 2. Capacity and booking

Fixture: a shop in `Europe/London`, open 09:00–18:00 on the test working day. One mechanic has 540 minutes before downtime and reserve. A service has a saved price and a snapshotted planned duration. These fixture numbers are for testing, not proposed universal defaults.

| ID | Scenario | Required outcome to specify | Review finding |
|---|---|---|---|
| AC-07 | 360 minutes are already booked, reserve is 120, customer requests 60 | Exactly fits: acceptance leaves the reserve intact. A request for 61 does not fit. UI and server agree on the selected service's duration | F11, F13 |
| AC-08 | Two customers simultaneously request the last 60 minutes | At most one reservation succeeds; the other receives an availability conflict. No extra job, orphan order, charged message or unrelated duplicate customer is left by the losing operation | F11, F12 |
| AC-09 | Staff create a job while a portal booking targets the same slot | Both use the same authoritative capacity operation. Staff reserve override remains separate from timed overlap rules | F11 |
| AC-10 | Two staff members edit the same job from stale screens | One accepted version is preserved; the other sees a conflict or explicit merge. No silent overwriting of notes, charges or schedule | F11, F14 |
| AC-11 | A customer reschedules into a slot another customer just took | Original reservation survives the failed move; no second reservation or misleading reschedule email appears | F11, F12 |
| AC-12 | Several pending requests are never reviewed | Decide hold duration, review deadline, reminders and expiry. Public acknowledgement accurately says whether the appointment is confirmed | F12 |
| AC-13 | A customer selects “Not sure,” then a mechanic finds a two-hour repair | Initial one-hour reservation uses the decided default; duration/price revision is explicit, capacity is rechecked, and a revised appointment is communicated if needed | F10, F12 |
| AC-14 | A pending booking is cancelled, rejected, expired or marked no-show | Define which states release capacity, preserve history, permit reopening and send messages. Retrying the action has no additional effect | F12, F14 |
| AC-15 | A mechanic deliberately accepts work beyond the daily reserve | Allowed per the recorded staff override decision. Decide warning, actor/reason audit and the distinct rule for physical timed overlap | F11, F13 |
| AC-16 | A drop-off job has no start/end time and no till order | Its planned effort still reduces capacity. Unknown effort has an explicit estimate policy; it never silently becomes zero | F09, F13 |
| AC-17 | Two mechanics have 30 minutes free each; a timed job needs one continuous hour | Reject unless the work genuinely supports splitting. Pooled arithmetic cannot invent a one-hour slot | F13 |
| AC-18 | A shop switches booking mode with future confirmed jobs | Decide effective-date behavior, existing time promises, conversion and customer notices. No silent loss of appointment times | F13 |
| AC-19 | A mechanic is ill, a bank holiday is added, or lunch becomes a recurring block | Affected bookings are surfaced for replanning. Subtract the union of unavailable intervals; do not count lunch twice as a block and the same reserve | F13 |
| AC-20 | Earliest slot is 09:00; configured arrival lead is 30 minutes; shop opens 09:00 | Do not instruct arrival at a closed shop. Constrain availability or define a staffed intake window | F13 |
| AC-21 | Rider and server are in different timezones; DST or midnight occurs | Shop-local date/time is authoritative. Recurrences and reminder sending use the shop timezone. Define handling of nonexistent/ambiguous times for supported hours | F13, F17 |
| AC-22 | A multi-day repair waits for parts overnight | Bike custody continues; consumed mechanic capacity reflects actual planned work by day, not the full time the bike is stored | F13, F14 |

## 3. Work, charges, approvals and payment

| ID | Scenario | Required outcome to specify | Review finding |
|---|---|---|---|
| AC-23 | Saved service price/minutes change after a booking | Existing agreed job price/minutes retain their snapshots. Explicit replanning is distinct from catalogue editing | F10 |
| AC-24 | Mechanic stretches a slot, records actual time or performs a free warranty repair | Price does not silently multiply by time. Planned effort, allocation, actual time and fixed charge have defined independent meanings | F10 |
| AC-25 | Mechanic adds labour and a part, but is forbidden to operate the till | Workshop work editing succeeds; payment/refund endpoints remain denied. A route group must not accidentally require cashier powers | F19 |
| AC-26 | A customer approves two of four estimate lines; another employee edits the estimate meanwhile | Approval is bound to an exact immutable version and amount. Stale approval does not authorize new work. Stable line identity survives edits | F10, F15 |
| AC-27 | A job is repaired but unpaid; another is prepaid but unfinished | Work, financial balance and custody can represent both. Neither payment nor a webhook asserts the repair happened | F14 |
| AC-28 | A job is completed twice, or reopened and completed again | Decide completion/version history. One applicable summary/invoice intention per event; no repeated charge or obsolete invoice link | F14, F17 |
| AC-29 | A VAT shop and a non-VAT shop issue otherwise identical invoices | Correct supplier status and tax treatment are retained on issued documents. Invoice requirements do not depend on current profile values after issue | F15 |
| AC-30 | An invoice includes discounted parts, fixed-price labour and different tax treatments | Amounts reconcile in the defined minor-unit/decimal rounding convention. Issued values remain immutable; corrections use an appropriate version/credit process | F15 |
| AC-31 | A payment link is open while staff record cash payment | The customer cannot unknowingly pay the same balance twice. Define link invalidation, authoritative balance checks and recovery if settlement races | F15 |
| AC-32 | Provider accepts payment but callback is delayed; user refreshes or retries | One payment obligation and settlement are reconciled. Browser redirect alone never marks the invoice paid; duplicate events have no additional effect | F15 |
| AC-33 | Part is refunded but damaged; labour is refunded; a partial exchange has a price difference | Financial reversal and physical stock disposition are independent and auditable. No labour stock movement. No saleable return without an explicit disposition | F16 |
| AC-34 | A customer pays online and another person collects the bike | Payment does not prove collection authority. Record the shop's chosen verification, collector and staff actor | F14 |
| AC-35 | A service called “brake check” has no recorded outcome | Generated text does not claim pads were replaced or the bike certified safe. Only approved completed facts enter the customer summary | F18 |

## 4. Coexistence, import and cutover

| ID | Scenario | Required outcome to specify | Review finding |
|---|---|---|---|
| AC-36 | Wheelhouse job uses a part from Lightspeed stock and is paid on Lightspeed | Specify reservation, invoice, payment and stock ownership at each step. Measure any manual entry. Later import must match rather than duplicate the local job | F05, F06 |
| AC-37 | Lightspeed has a phone job added immediately after the last poll | Do not assert globally live availability. Define the scheduling-authority rule, reconciliation/warning or conservative fallback | F05, F08 |
| AC-38 | Parent timestamp stays unchanged when a child line changes | Live-account result determines a supported child/reconciliation strategy. No claimed complete sync without demonstrated coverage | F07 |
| AC-39 | 150 records share a timestamp; pages hold 100; process crashes after the first page | Resume without losing 50 records or duplicating business effects. Checkpoint/page writes and equal-timestamp semantics are explicit | F07 |
| AC-40 | Source changes a record during backfill and deletes another before the next poll | Define consistent handover and deletion detection. Neither old values nor deleted records persist indefinitely without an explicit archive policy | F06, F07 |
| AC-41 | Two workers start the same shop import, or token refreshes race | One coordinated account workflow; replay-safe writes and durable refreshed credentials. A crash releases/reclaims ownership safely | F07 |
| AC-42 | Work orders sync but inventory fails for an hour | Inventory visibly remains stale; a job poll does not reset its freshness. Required actions are blocked/warned according to their safety | F08 |
| AC-43 | One source row is malformed while thousands are valid | Row is quarantined with actionable context and safe redaction; progress/completeness do not falsely become green | F07 |
| AC-44 | Two source accounts both have customer ID 42; a guest has the same phone as an imported customer | Provider/account/tenant IDs isolate records. Phone or name similarity never automatically grants identity or joins history | F06, F19 |
| AC-45 | Import brings old sales, refunds and notification history | No current stock deduction, new tax calculation, message send or current-day revenue effect. Preserve historical provenance and totals | F06, F17 |
| AC-46 | A prospective payer uses variants, gift balances, deposits or outstanding work not supported here | Cutover is blocked or those records have an explicitly accepted preservation/operating plan. “Everything imported” must not conceal lost liabilities | F06 |
| AC-47 | Shop stops syncing, disconnects, or requests deletion | Stop future access promptly. Define source-mirror deletion separately from local work, audit/legal retention, exports and credential revocation | F06, F22, F23 |
| AC-48 | Go-live fails after a final import, or after the first Wheelhouse payment | Define reversible steps and point beyond which rollback needs reconciliation rather than a database rewind. One system owns new writes at each stage | F06, F22 |

## 5. Messages, identity, privacy and recovery

| ID | Scenario | Required outcome to specify | Review finding |
|---|---|---|---|
| AC-49 | SMS provider times out after accepting a message | No blind infinite retry. Provider acceptance/unknown/delivery states are explicit; duplicate-charge risk is bounded and visible | F17 |
| AC-50 | Shop's own provider balance is empty or credentials revoked | Repair completion remains saved. Show an actionable provider problem and permitted contact fallback. Do not expose the key | F17 |
| AC-51 | Customer opts out after a service reminder is queued, or the reminder becomes obsolete | Recheck suppression and relevance at send time. Distinguish marketing reminder from necessary booking communication | F17, F23 |
| AC-52 | Many anonymous bookings try to trigger paid messages | Bound per-tenant/provider spending and public abuse across replicas. State reservation fairness and legitimate-user fallback | F12, F17 |
| AC-53 | Attacker supplies a valid login code from another browser, replays a callback or alters a return URL | Callback is tied to the initiating login transaction; replay/substitution rejected; redirects constrained | F20 |
| AC-54 | One person is staff at A, a customer at B, and a customer at A | Explicit active context permits legitimate roles without exposing staff data to the customer surface. Identity does not imply membership | F19, F20 |
| AC-55 | Owner deactivates staff or changes a sensitive permission while sessions are live | A specified maximum revocation delay is met. Local membership, tokens and webhook reconciliation agree; a delayed event cannot resurrect access | F19, F20 |
| AC-56 | An invitation is accepted but local provisioning fails; membership events are replayed out of order | Recover to one correct membership without orphan access, duplicate shops or an impossible login. Failure is observable and retryable | F20 |
| AC-57 | Tenant A references B's customer, service, document, attachment or device | Database relationships and authorization reject cross-tenant linkage. Test every supported relationship, not only visible-row reads | F21 |
| AC-58 | A customer disputes a factual service record or asks for erasure | Preserve appropriate attribution while applying a purpose-specific correction/restriction/retention/deletion process. “Append-only” is not a blanket refusal | F23 |
| AC-59 | A phone photo contains location metadata or a private attachment URL is shared | Strip required metadata and define access, expiry, caching and deletion. Public catalogue media and private job evidence have different contracts | F22, F23 |
| AC-60 | Database/host is restored to before messages or payments were sent | Reconcile with external providers before retrying side effects. Restore files and keys as well as tables; do not send old completion emails or recreate settled payments | F22 |
| AC-61 | Auth, database or Lightspeed is unavailable at opening time | Exact degraded behavior and fallback are specified. Distinguish liveness, readiness and sync health. No false booking confirmation or claimed successful sale | F08, F21, F22 |
| AC-62 | A shop requests its data before self-service export is built | Staff-assisted export contains relationships and attachments in documented formats. Verify it belongs only to that shop and can be understood independently | F22 |
| AC-63 | Product stops operating or a founding shop leaves | Honor the written free/exit promise, export, notice and retention schedule. A paid feature expansion cannot silently rewrite grandfathering | F01, F22 |

## 6. Corrections to the feature inventory

These are proposed **Change** or **Missing** entries for issue #16, not newly approved scope. Frozen ideas remain frozen. “In” should mean a useful product capability, not inclusion in the first release.

| Existing IDs | Proposed correction |
|---|---|
| ACC-01 | Signup lands in the chosen product mode; distinguish existing invite-gated signup from missing production onboarding |
| ACC-04, ACC-08 | Define command-level rights and actor attribution, including job work, refunds, exports, credentials and shared devices |
| ACC-06 | Remove email as a universal MFA dependency; select supported factors and recovery policy explicitly |
| ACC-09 | Keep multi-site expansion separate from importing one location of a multi-location external account |
| TILL-09–11, PAY-06 | Separate refund, physical return, exchange, void and provider settlement. Online refunds do not inherently need a terminal |
| TILL-14–15 | Cash-up requires opening float and movements; define immutable closed periods and corrections |
| INV-06–07, JOB-10 | Decide operational support versus archival preservation for source variants, serials and reservations before claiming whole-shop migration |
| PUR-06, JOB-11 | Remove the circular dependency; define one job-to-purchase relationship and its receiving/replanning lifecycle |
| CUS-05, CUS-08 | Customer matching is not authentication. Merging needs provenance, authorization, collision policy and a recovery path |
| BIKE-07 | Duplicate serial detection is not proof of identity or ownership. Unknown/reused/mistyped serials need a policy |
| BIKE-08, BIKE-11 | Replace “reused forever” with attributed, dated and revisable component facts; record replacements |
| BIKE-10, BIKE-14 | Keep recall/registry capabilities separate from safety certification and title claims; require sources and explicit coverage |
| JOB-02, JOB-19 | Separate booking/work/payment/custody states and allowed transitions; reopen preserves history |
| JOB-07–08 | Define private attachment access and retention, uploads from supported phones, retry and metadata stripping |
| JOB-12–13 | Use the agreed fixed-price labour model, with separate estimated effort; remove the obsolete hourly-rate wording |
| JOB-14–15 | Stable job reference and promised-ready time are distinct from database ID and drop-off/scheduled date |
| JOB-18, JOB-22 | Job work must exist without a till sale; optional billing links cannot own the whole workshop domain |
| JOB-23, CAL-10 | Server rules now partly implemented; add atomic concurrent enforcement and stale-edit handling |
| CAL-07–13 | Add mode/timezone/exception semantics and define reserve versus actual downtime; respect the decided staff reserve override |
| BOOK-04 | Do not mark complete until the portal uses bookable services, snapshots duration and honors price visibility |
| BOOK-06–08 | Add reservation expiry, review deadlines, acknowledgement versus confirmation and atomic reschedule |
| COM-04, COM-07, COM-09 | Separate event notifications, appointment reminders and service marketing; add delivery/replay/suppression contracts |
| DONE-01 | Specify grounded summary generation and safe fallback; no inferred repair outcomes |
| DONE-04, REP-05 | Invoice/tax model is a prerequisite. A sales VAT report is not a complete VAT return or MTD integration |
| DONE-05–06, PAY-05 | Split architecture decision from provider integration and settlement reconciliation. “Viewed” is not a payment state |
| INS-04–05 | Approval binds to a stable estimate version/line IDs and amount; stale links cannot authorize changed work |
| DAT-01–03 | Add assisted early export, external provenance, source mirror, reconciliation and cutover; “everything” must enumerate supported data |
| DAT-04–05 | Specify measurable recovery targets, attachments/keys and external-side-effect reconciliation |
| PLT-01–04 | Separate current RLS behavior, relationship integrity, resolver authorization and explicit supported pool topology |
| PLT-05–07 | Irreversible booking/payment/notification/import work needs replay policy; not only Shopify |
| PLT-17–18 | Specify distributed/public-spend abuse limits and meaningful adoption metrics rather than signup counts |
| FD-05, HW-04 | Forum and print-agent scope need present-user evidence; neither is a default prerequisite for booking |
| LEG-01–10 | Map purposes and obligations to the actual UK launch; distinguish regulatory requirement from chosen product policy |
| **Missing: external account connection** | Supported Lightspeed series, scopes, account/location mapping, consent, credential lifecycle, disconnect |
| **Missing: sync integrity** | Per-stream checkpoints, initial backfill, deletion/merge handling, quarantine, worker coordination, source-to-local mapping |
| **Missing: visible degraded operation** | Freshness by relevant resource, stale-data actions, provider/auth/DB outage fallback |
| **Missing: workshop custody** | Check-in, storage/tag, ready, collection and authorized collector; do not confuse with repair/payment |
| **Missing: migration readiness** | Golden source dataset, supported/unsupported liabilities, reconciliation, cutover authority and rollback limit |
| **Missing: free-tier contract** | Entitlements, third-party charges, support bounds, grandfathering and funding assumptions |

## 7. A small specification set that can close the gaps

The answer is not 214 individual design documents. Keep five bounded contracts, linked to existing feature IDs:

1. **Product and economics:** first shop profile, free/paid promise, supported integrations, exclusions, observed-use gate and cost model.
2. **Workshop domain:** work lines, capacity, modes, booking/work/custody states, revisions and transitions. Include the actor/permission matrix.
3. **Integration and migration:** source authority, identity mapping, polling consistency, freshness, supported source records and cutover.
4. **Money and communication:** issued documents, tax snapshots, balances, refunds, notification events, summaries, consent and replay rules.
5. **Production acceptance:** identity boundaries, tenant integrity, operations, recovery, exports, privacy and failure behavior.

Each contract should carry: status and decision-maker; current source version; explicit unresolved choices; scenarios passed on paper; live/provider checks still needed; and dependent features that remain blocked. Avoid code listings until these contracts are coherent.

## 8. Evidence needed outside a document review

- An authorized account on the selected Lightspeed series: endpoint scopes, account/location mapping, timestamp changes on parent/child operations, pagination/deletion behavior, real costs and rate headers, and a representative export sample.
- An observed workshop week or equivalent representative records: timed/drop-off work, walk-ins, diagnosis changes, parts delays, no-shows, custody, billing, refunds and the incumbent handoff.
- A real job-to-invoice-to-payment/reversal example for the chosen merchant integration. Do not infer settlement from a successful browser redirect.
- A measured hosted restore that includes attachments, credentials and reconciliation, not just a provider-console checkbox.
- A precise commercial answer on the paid till versus completely free software, with actual support/onboarding observations before publishing unit economics as viable.

Until those are available, the honest completion state is **reviewed with named unresolved evidence**, not “all specs correct.”
