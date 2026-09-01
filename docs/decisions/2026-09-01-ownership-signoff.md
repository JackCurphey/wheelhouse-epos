# Ownership sign-off — master implementation plan

**Date:** 1 September 2026  
**Signed off by:** Jack  
**Plan under review:** `docs/superpowers/plans/2026-08-31-master-implementation-plan.md` on `origin/docs/business-plan`, dated 31 August 2026  
**Scope:** the owner column only — who builds each task. Not the feature set, not the release order.

## Result

**63 of 63 tasks decided.** 58 agreed, 5 queried, 0 reassigned.

The proposed split was Mark 24, shared 5, Jack 34. No task was moved between owners, so that split stands as written — subject to the five queries below.

## Queried

These are not rejections. Each one needs an answer from Mark before the owner is settled.

| ID | Task | Proposed owner | Jack’s note |
|---|---|---|---|
| `PF-3` | Print agent installer, signed, one-page setup | Mark | you can get rid of the print agent if you want and just make it all browser based. the reason i originally made it an app was so that you install it once and then never have to think about i again, which im sure you can get functioning the same way in the browser |
| `DP-1` | Ten shop conversations, local, in person | Jack | dont think this is necessary |
| `DP-2` | Recruit three to eight design partners; one-page agreement signed | Jack | dont think this is necessary |
| `DP-3` | In-shop usability test per partner, watched | Jack | dont think this is necessary |
| `DP-4` | WhatsApp group and the monthly fifteen-minute call running | Jack | dont think this is necessary |

## Sequencing note

Issue #16 stages this work as: (1) agree the features, (2) organise into releases, (3) assign and schedule. The master implementation plan already carries a filled-in owner column, which is step three. Either the plan runs ahead of that sequence or #16’s staging is out of date. Worth settling before the owners are treated as fixed.

## Every task

### P0 — Data safety

Blocks everything. No design partner touches the system until this is complete — two of these are live isolation defects.

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `DS-0` | Revise the architecture stage-one plan and workflow per the review prompt. Plan and workflow only — no production code | Mark | Agreed |  |
| `DS-1` | Make tenant state transaction-local at every runtime site, found by search rather than assumption | Mark | Agreed |  |
| `DS-2` | Safe database-client cleanup before releasing it back to the pool | Mark | Agreed |  |
| `DS-3` | Record transaction pooling as unsupported, in the plan and in deployment docs | Mark | Agreed |  |
| `DS-4` | Composite tenant foreign keys on every tenant-owned relationship, designed for existing data | Mark | Agreed |  |
| `DS-5` | Resolver privilege boundary — revoke direct table access from the request role | Mark | Agreed |  |
| `DS-6` | Uploaded-image-types policy: ownership, deletion, abuse response (policy) | Both | Agreed |  |
| `DS-7` | Fix the three portal data exposures (paired) | Jack | Agreed |  |
| `DS-8` | Workshop server-side enforcement — lift the diary rules out of the browser into the API (paired) | Jack | Agreed |  |
| `DS-9` | First workshop tests — jobs, diary rules, availability, portal booking, attachments; each mutation-tested (paired) | Jack | Agreed |  |

### P1 — Platform and operations

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `PL-1` | Choose hosting and managed Postgres. Blocked on the UK-versus-EU data residency decision | Mark | Agreed |  |
| `PL-2` | Managed PostgreSQL with true point-in-time recovery | Mark | Agreed |  |
| `PL-3` | Restore drill — restore to a timestamp, verify the data, record the elapsed time (Jack’s hands, Mark’s eyes) | Both | Agreed |  |
| `PL-4` | Advisory lock around migration discovery and execution | Mark | Agreed |  |
| `PL-5` | Pool checkout timeout plus connection instrumentation | Mark | Agreed |  |
| `PL-6` | Timeouts on outbound calls; hold no database connection while awaiting Shopify or Twilio | Mark | Agreed |  |
| `PL-7` | Sale idempotency — a duplicate submission creates one sale | Mark | Agreed |  |
| `PL-8` | Shopify outbox, processed outside the request | Mark | Agreed |  |
| `PL-9` | Retryable inbound Shopify events — failures reclaimable | Mark | Agreed |  |
| `PL-10` | Bounded shutdown drain; fatal errors logged before exit | Mark | Agreed |  |
| `PL-11` | Separate readiness and liveness checks, wired into deployment config | Mark | Agreed |  |
| `PL-12` | Deploy pipeline, staging environment, rollback | Mark | Agreed |  |
| `PL-13` | Error tracking, uptime monitoring, public status page | Mark | Agreed |  |
| `PL-14` | Transactional email provider; password reset as the first real use | Mark | Agreed |  |
| `PL-15` | Rewrite the README — it describes a product you do not sell | Jack | Agreed |  |

### P2 — Product foundations

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `PF-1` | Self-serve signup and shop provisioning — one URL, one login, no install (paired on the auth touchpoints) | Jack | Agreed |  |
| `PF-2` | Workshop-only mode — a job completes without a linked till sale | Jack | Agreed |  |
| `PF-3` | Print agent installer, signed, one-page setup | Mark | Query | you can get rid of the print agent if you want and just make it all browser based. the reason i originally made it an app was so that you install it once and then never have to think about i again, which im sure you can get functioning the same way in the browser |

### P3 — Workshop table stakes and the front door

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `WS-1` | Job status history — who changed what, when (paired) | Jack | Agreed |  |
| `WS-2` | Automated status-triggered messaging, text and email, per-shop templates | Jack | Agreed |  |
| `WS-3` | Internal versus customer-visible notes | Jack | Agreed |  |
| `WS-4` | Customer-level service history, not only per-bike | Jack | Agreed |  |
| `WS-5` | Customer cancel and reschedule; shop rejects with a reason | Jack | Agreed |  |
| `WEB-1` | Public website: what it is, the free workshop, pricing, help, changelog, status, contact | Jack | Agreed |  |
| `WEB-2` | Legal set — privacy notices, data agreement for shops, cookie policy, terms (with a solicitor) | Jack | Agreed |  |
| `FOR-1` | Private design-partner forum, with email-in and email-reply as a hard requirement | Jack | Agreed |  |

### P4 — Design partners

Gate G2: three shops running the free workshop on real jobs for thirty days.

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `DP-1` | Ten shop conversations, local, in person | Jack | Query | dont think this is necessary |
| `DP-2` | Recruit three to eight design partners; one-page agreement signed | Jack | Query | dont think this is necessary |
| `DP-3` | In-shop usability test per partner, watched | Jack | Query | dont think this is necessary |
| `DP-4` | WhatsApp group and the monthly fifteen-minute call running | Jack | Query | dont think this is necessary |
| `DP-5` | Usage instrumentation — jobs booked per shop per week | Mark | Agreed |  |
| `DP-6` | Madison trade account opened | Jack | Agreed |  |

### P5 — The experience, and the job-done email

Blocked on the payments decision before CX-4 can start.

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `CX-0` | Labour lines — a time and a rate, not a fake product row. Touches the till | Both | Agreed |  |
| `CX-1` | Plain-English job summary, generated from the job rather than written by hand | Jack | Agreed |  |
| `CX-2` | Photos from the job attached to the summary, location data stripped on upload (Jack, Mark on ingest) | Both | Agreed |  |
| `CX-3` | Itemised pricing and an invoice — parts and labour separated | Jack | Agreed |  |
| `CX-4` | Pay in one tap. The shop keeps its own processor; no undisclosed cut | Mark | Agreed |  |
| `CX-5` | The job-done email itself, assembled from CX-1 to CX-4 | Jack | Agreed |  |
| `CX-6` | Mechanic-flow test — start, record and complete a job with the bike in front of you | Jack | Agreed |  |
| `CX-7` | Append-only attributed entries; dispute flag with right of reply (Mark the model, Jack the surface) | Both | Agreed |  |

### P5b — Structured inspection

Was the differentiator; now the extension.

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `INS-1` | Reusable checklist templates per shop, content authored by Jack | Jack | Agreed |  |
| `INS-2` | Itemised estimate from flagged items, each line individually approvable | Jack | Agreed |  |
| `INS-3` | Approved lines flow into the job’s order with no re-entry | Jack | Agreed |  |

### P6 — Paid product

To gate G3.

| ID | Task | Proposed owner | Decision | Note |
|---|---|---|---|---|
| `TILL-1` | Refunds, voids, returns (paired) | Jack | Agreed |  |
| `TILL-2` | Cash-up and end-of-day report | Jack | Agreed |  |
| `TILL-3` | Export everything to a spreadsheet | Jack | Agreed |  |
| `TILL-4` | VAT stored as data; date-range reporting (paired) | Jack | Agreed |  |
| `TILL-5` | Permissions model — a non-owner cannot reach owner functions | Mark | Agreed |  |
| `BIL-1` | Billing. Not before G3; the first three shops are invoiced by hand | Mark | Agreed |  |
| `BIKE-1` | Richer bike record: year, size, wheel size, groupset, e-bike system, photo | Jack | Agreed |  |
| `BIKE-2` | Spec autofill from a model lookup, subject to terms | Jack | Agreed |  |
| `BIKE-3` | Shop-verified service facts — captured once, reused forever | Jack | Agreed |  |
| `BIKE-4` | Recall and safety-notice tracking by model and serial | Jack | Agreed |  |

