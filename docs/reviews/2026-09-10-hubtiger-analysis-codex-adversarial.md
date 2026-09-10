# Codex adversarial review — Hubtiger live analysis

**Model:** gpt-6-astra, reasoning effort medium. **Run:** 2026-09-10 via `codex exec`, read-only sandbox. **Target:** `docs/decisions/2026-09-10-hubtiger-live-analysis.md` as first written, before the corrections it prompted. Instructed to take no prior assumption as given.

Findings ranked by likely impact on the first-release decision. Line numbers refer to the [Hubtiger report](docs/decisions/2026-09-10-hubtiger-live-analysis.md).

1. **The report manufactures a launch baseline without defining the release or buyer.**

   > “Table stakes the market takes for granted [O]” (L263)

   One trial store establishes feature availability, not market expectations, adoption blockers or usage frequency. The earlier research’s “category leader” label rests on unaudited, global, mixed-vertical numbers; it cannot supply the missing UK-shop evidence.

   The September review’s opening amendment records a standalone prototype with simulated billing/messages and no incumbent integration. This report never distinguishes that prototype from a live release. Its assertion that “Nothing seen today changes” F04 (L260) conflicts with immediately declaring nine feature bundles table stakes.

   **Evidence needed:** an explicit release boundary, target-shop profile, and observed tasks showing which omissions prevent that cohort from using it.

2. **Every item in the table-stakes ranking has an untested smaller alternative.**

   The claimed ordering by weekly frequency (L264) has no usage data. Frequency alone also ignores consequence, implementation cost and existing workarounds.

   | Quoted requirement | Argument against requiring it at first release | Evidence that would settle it |
   |---|---|---|
   | “Status-driven automated messages… email and SMS at minimum” | Confirmation and completion through one channel may suffice. “Ten events… daily” bizarrely includes 6/12-month reminders; all trial templates were off. | Actual message logs, missed-contact costs and channel preferences. |
   | “Quote approval by link… pre-approved amount” | Recorded telephone approval or an intake ceiling may support the initial workflow. The customer approval round trip remains untested. | Measured approval delays and completed approve/reject/revise journeys. |
   | “Job card with timer, three note tiers… service history” | This bundles necessities with optional machinery. Fixed-price work may need no timer; internal/customer-visible notes may suffice; history could remain in the incumbent. | Real jobs demonstrating failure of those simpler arrangements. |
   | “Eleven-ish statuses, renameable, with SLA ageing” | Hubtiger mixes custody, work, warranty and logistics. Copying its count could reproduce the conflation challenged in F14. | Transition walkthroughs establishing distinct operational decisions and overdue actions. |
   | “Checklists… blocking close” | A basic checklist or acknowledgement may suffice; mandatory blocking can obstruct legitimate exceptions. | Observed missed checks, exception handling and demonstrated value of enforcement. |
   | “Bays and tags; print job tag” | Existing numbered tags or handwritten identifiers may work. Bay management is unnecessary without a storage-location problem. | Bike retrieval/error measurements and a real printer workflow. |
   | “Staff hours, leave, closing dates… availability strip” | A manually maintained daily capacity budget may serve drop-off shops. The strip is a presentation choice. | Representative schedules proving simpler capacity management fails. |
   | “Per-technician revenue and time-in-status reporting” | No managerial decision requiring these reports is established. Revenue attribution may mislead on shared jobs. | A named recurring decision, reconciled sample outputs and attribution rules. |
   | “Excel job import and CSV customer import” | Assisted migration of open jobs, or fresh entry with incumbent history retained, may suffice. File formats are not migration correctness. | Actual source exports, volumes, reconciliation and onboarding-time comparisons. |

3. **The deferrable list makes the opposite unsupported generalisation.**

   > “Things Hubtiger has that are plausibly deferrable” (L282)

   Fittings and pickup/delivery may define the first shop’s business. Deposits may matter more than technician reporting where no-shows hurt. Third-party payers and multi-quote options may be central to insurer-funded repairs; waivers may be part of established intake procedures.

   Coupons, referral earnings and gift cards may represent existing customer promises or balances. Community posts, rides, GTM and Pixel may support the acquisition channel being tested. A receipt designer may be optional while compatible job-tag output is essential. None automatically belongs in release one, but exclusion requires a cohort and workable alternatives.

   **Evidence needed:** target shops’ recent jobs, outstanding commitments, acquisition workflows and explicit acceptance of each workaround.

4. **The integration conclusion confuses separate products and inherits rejected diagnoses.**

   > “whether the R-Series work-order sync… actually closes the quote-push defect” (L293–294)

   An R-Series success cannot resolve an X-Series defect. Business research §3.6 already distinguishes their capabilities. The earlier trial also wrongly treats successful customer writes as excluding permissions problems; F04 explicitly rejects that inference. Different job-specific IDs likewise do not prove that either ID is the correct invoice ID.

   “Fails silently” (L290) conflicts with the trial’s account of raw error text “surfaced verbatim to the shop.”

   **Evidence needed:** separate series-specific contracts, captured UI behaviour, quote permissions/configuration and reconciled job-to-sale tests. Benchmark Wheelhouse’s manual handoff too; otherwise a competitor’s failed integration becomes an advantage over our unmeasured workflow.

5. **The asserted booking and mobile advantages are preferences disguised as observations.**

   > “Where Hubtiger is weak and a shop would notice [O,J]” (L287)

   Date-only booking can accurately express drop-off service. Instant confirmation can remove administrative work; moderation can delay or lose bookings. The earlier review already challenges both supposed advantages and the inference that one configuration proves moderation unavailable.

   “Photos are therefore attached… rather than through a native staff app” (L86–87) does not follow from seeing a QR option. A mobile browser might upload directly. Two visible role names do not establish permission limitations.

   **Evidence needed:** timed/drop-off configuration checks, mobile-browser tasks, role permission tests, and comparative task completion by mechanics and customers.

6. **The report silently changes earlier differentiation and sequencing claims.**

   > “Per-technician revenue… reporting” (L279); “service history on the item” (L273)

   The workshop spec calls technician efficiency/commission reporting unclaimed and deliberately defers it. Revenue reporting is not identical, but the report neither distinguishes the measures nor justifies promoting adjacent functionality. Per-item and chain history narrow the claimed bike-record opportunity without establishing rider-controlled, cross-independent-shop portability.

   Business research already recorded per-item history and R-Series work orders; calling these discoveries “new” needs qualification. Repair deposits also contradict the spec’s “Bikebook only” claim.

   **Evidence needed:** an explicit correction/supersession map and tests separating revenue, efficiency, commission, chain history and portable history.

7. **The evidence is insufficiently reproducible and overstates behaviour.**

   > “full status vocabulary and… transitions” (L34); “Every settings surface” (L35)

   One dropdown state does not reveal a transition model. Section 11 lists unvisited settings flows; no report was run. “Single-region Azure dependency” (L291) cannot be inferred from an Azure hostname or outage.

   The “15–20% below” currency comparison (L28–29) supplies no exchange rate, tax basis or billing equivalence; the tier ratios do not support a uniform discount.

   **Evidence needed:** durable captures, configuration/tier metadata, exercised transitions and reports, hosting evidence, and reproducible pricing arithmetic. Prioritise missing approval, notification-failure, cancellation/rescheduling and booking-disclosure retests over further catalogue counting.