# Release 1 scope reduction — review with Jack

Date: 10 September 2026. **Status: scope changes instructed by Mark following review with Jack.** Implementation details below are planning interpretations, not new feature approvals.

This decision supersedes the relevant Release 1 selections in the original #47 ranking and the earlier 172-row implementation plan. It also supersedes incompatible Release 1 sequencing and gates in the August master plan and workshop-first spec. The original ranking and reviews remain historical evidence.

## The agreed scope

Keep booking, the diary, job cards, workshop statuses and capacity. Keep quotes with approval or rejection of individual lines. Keep email, SMS and WhatsApp. Build **one** Lightspeed integration with proven access and a demonstrated integration contract. Keep printing: the shop prints job information and attaches tags to bikes; tags must carry scannable QR codes and appropriate scanner support.

Move invoicing, online customer payments and refunds to Later. Customer import, reports, group capacity and recovery are also out of this release. The second Lightspeed adapter is Later.

The feedback referred to the four cards on the scope slide. “The card on file is fine” is interpreted as **card one** (booking/diary/job card/status/capacity), given that context and the explicit exclusion of online payments. It does not introduce storage of payment cards.

## Consequences applied to the plan

| Consequence | Treatment |
|---|---|
| Deposits and counter-settlement machinery | Later with payments; quote spending ceilings remain estimates/authorisation, not payment authorisations |
| Third-party billing and a new Bike Sale/till module | Later with the money work; existing application code is not deleted |
| Invoice/receipt printing | Later; job cards and physical bike tags stay in Release 1 |
| Customer CSV/history migration | Later, including import checkpoint/quarantine UI; ordinary customer creation and staff-reviewed duplicate management remain |
| Connector customer use | Resolve/create only the customer needed by a current job; no bulk customer backfill or migration promise |
| Reports versus daily work visibility | Report suites move Later; selected operational queues, calendar capacity strips, job status chips and overdue counters stay |
| Group capacity | Defer both aggregate reports and the chain/group model supporting them; tenant isolation between independent shops remains |
| Recovery | No PITR programme, restore drill, RPO/RTO project or disaster-recovery sign-off in this release. Existing hosting protections are not removed. Retry/reconciliation for a message, print request or stock mutation is part of those retained features, not a reintroduced disaster-recovery programme |
| Quote correctness | Amounts still need deterministic calculation and a preserved record of exactly what was approved. No invoice numbers, settlement ledger, Stripe onboarding or refund engine |
| Existing defect #17 | Defer settlement/refund-specific remediation with till work; ensure quoted labour is not treated as physical stock by the connector |

## Lightspeed choice and evidence

One adapter is decided. **R-Series is the planning recommendation, conditional on first-shop fit and the access proof.** The specific series has not been confirmed in this feedback. No account credentials or live API evidence were available in this session. The recommendation is not a claim that our client has full access.

Use the [API readiness brief](2026-09-10-release-1-lightspeed-readiness.md). “Full API access” means all operations needed by this release pass using the actual app, account, employee rights and agreed scopes. It does not mean requesting every permission, including excluded payment/refund/report permissions.

## Operative documents

- [Revised implementation plan](../superpowers/plans/2026-09-10-release-1-workshop-plan.md).
- [Updated row ledger](../reviews/2026-09-10-release-1-revised-traceability.csv), retaining the original bucket/rank alongside current scope and the reason for every change.
- [Updated store-review PowerPoint](../presentations/Wheelhouse-Release-1-Store-Review-v2.pptx).

The plan carries 154 of the original 172 selected row references under the R-Series recommendation, moves 18 to Later, and brings in only the QR portion of originally Later row 296. Counts describe traceability, not independently sized features. If X-Series is selected instead, swap rows 283/284 and their adapter specification; do not add a second adapter.
