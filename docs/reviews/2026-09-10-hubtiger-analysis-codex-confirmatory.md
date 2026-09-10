# Codex confirmatory review — Hubtiger live analysis

**Model:** gpt-6-astra, reasoning effort medium. **Run:** 2026-09-10 via `codex exec`, read-only sandbox. **Target:** `docs/decisions/2026-09-10-hubtiger-live-analysis.md` as first written. The factual corrections it identified (template count 26 not 27, four discrepancies not two, no GBP/USD discount figure, the push does not fail silently, no Azure region claim, auto-assigned slot, QR is one upload route) were applied to the report after this ran.

**Key:** (a) directly supported by recorded observations; (b) consistent but inferred; (c) unsupported, including contradicted claims. These grades assess the documentary record, not independent product verification. Screenshots are outside the repo; observed controls establish their presence, not successful execution.

**Section 1 — claims of new evidence**

| Claim | Assessment |
|---|---|
| Workshop £45/£65/£85, rental £30–£229, WhatsApp £8/month | **(a)** Recorded subscription-page observation. **(b)** Resolves localised pricing for this account; actual UK billing terms remain unverified. |
| Prices are 15–20% below converted $52/$99/$125 | **(c)** No exchange rate, date or tax basis. The three price pairs cannot all yield that discount range under one exchange rate. |
| Full catalogue: 27 workshop, five fitting, two sale templates | **(a)** Five fitting and two sale entries. **(c)** Workshop list contains **26**, not 27; completeness is unestablished. |
| Catalogue defines automated messaging “in this market” | **(c)** One competitor’s configuration does not establish market requirements. |
| 55 reports in 14 groups | **(a)** Fourteen groups are enumerated and 55 is recorded as an observed count. The abbreviated list cannot independently substantiate 55 or completeness. |
| Full status vocabulary and transitions | **(a)** Eleven settings labels and seven offered actions from Waiting–Parts. **(c)** A complete transition model: other starting states were not exercised. |
| Every settings surface, including timers and options | **(a)** Named controls and values. **(c)** “Every”: §11 excludes several settings flows and dialogs. |
| Dated changelog features and R-Series special-order rule | **(a)** As recorded vendor statements; **(b)** As functioning capabilities. No cross-store or R-Series execution test occurred. |
| Seven discoveries absent from earlier documents; two contradictions | **(c)** Several were already recorded; §9 contains four entries, not two. |

**Section 9 — alleged contradictions**

| Claim | Assessment |
|---|---|
| Citrus-Lime absent publicly, URL returns 404, present in picker | **(a)** Recorded checks and earlier trial §3.4. Calling this a contradiction is **(b)**: omission does not deny availability. Working support remains unproven; the report correctly says so. |
| Waivers marketed only for rentals, present for repairs and in four help articles | **(a)** Repair controls and the recorded help-centre finding. **(c)** “Only” marketed under rentals: no exhaustive marketing inventory supports that exclusion. Omission alone is not contradiction. |
| Marketing promises date/time; widget offers date only and shop assigns slot | **(a)** For the tested configuration. Earlier trial §3.5b records automatic technician/time assignment, so manual shop assignment is **(c)**. Product-wide absence of time selection is also **(c)**. |
| Only consumer app exists; staff browser-only; photos require QR; remove technician app from parity | **(a)** Browser interface and QR upload prompt. **(c)** Exclusivity and mandatory QR: §3 also offers direct drag/drop/tap upload. No app-store search inventory or mobile-browser test establishes the broader claims. Dropping native-app scope is **(b)** as a proposal, not an evidenced requirement. |

**Section 10 — release implications**

F04’s “candidate backlog, not launch requirement” attribution is **(a)**. Continuing that position and using the inventory for prioritisation are **(b)**. “Market table stakes,” weekly frequency ranking and “ten events a UK shop uses daily” are **(c)**: no shop-use evidence supports them, and the list includes months-later reminders.

| Proposed capability | Assessment |
|---|---|
| 1. Automated templates/toggles, email/SMS | **(a)** Controls and channel options; **(b)** Working automation. All templates were disabled; delivery was untested. Templates also include scheduled and approval events, not just statuses. |
| 2. Approval link; pre-approved amount skips approval | **(a)** Template description and amount field; **(b)** Functional link; **(c)** Verified bypass behaviour. |
| 3. Timer, three note tiers, catalogue parts, time/money totals, item history | **(a)** Recorded controls and earlier parts-add test. Populated history behaviour remains **(b)**. |
| 4. Eleven-ish renameable statuses and ageing | **(a)** Settings labels, thresholds and original-date columns; **(b)** Working rename/ageing rules. Original-date age does not itself establish time in each status. |
| 5. Per-service/pre-service checklists; blocking close | **(a)** Configuration and vendor changelog statement; **(b)** Actual enforcement. |
| 6. Bays/tags; print after book-in | **(a)** Fields and print option; **(b)** Successful automatic printing. |
| 7. Hours, leave and closures drive availability | **(a)** Settings and availability strip; **(b)** Causal behaviour. Dragging recalculated availability, but leave/closure changes were not tested. |
| 8. Technician revenue/time-in-status reporting | **(a)** Report entries; **(b)** Correct calculations. No reports were run. |
| 9. Excel jobs/CSV customers support migration | **(a)** Import surfaces; **(b)** Successful, adequate migration. |

The entire deferral list is **(b)** as a scope proposal. Settings/menu/report entries support the listed features’ presence **(a)**, but gift cards/referral earnings have report-only evidence, and community posts were not recorded as opened functionality.

For the weakness list: date-only booking and instant confirmation are **(a)** within this trial; universal absence of moderation/time selection is **(c)**. Search-dependent customer results and unlabelled icons are **(a)**. X-Series push failure is **(a)**, but “silently” is **(c)**: the earlier trial says raw exception text reached the shop. Two observed roles are **(a)**; an exhaustive two-role model is **(c)**. Mandatory phone round-trip and single-region Azure deployment are **(c)**. Azure hosting/outage evidence establishes no region count. Whether shops notice these as weaknesses is **(b)**.

Open questions are justified **(a)**. However, R-Series success could not establish that the separate X-Series defect was fixed **(c)**.

**Consistency and treatment of earlier documents**

- Templates total **33 enumerated**, versus **34 claimed**.
- The calendar has **12 labels**: it adds two fitting states and omits Cancelled relative to the eleven settings statuses. This may reflect different scopes, but “full vocabulary” needs reconciliation.
- GBP/WhatsApp/SMS figures agree where repeated; rental intermediate tiers and billing conditions are missing.
- “New” overstates novelty: earlier trial §3.5 already records repair waivers and numerous settings; §§3.4/3.5b record Citrus-Lime and booking discrepancies. Business research §3.6 already records item history and R-Series-specific work orders.
- F04’s wording is quoted accurately, but its configuration caveats are subsequently ignored. The review’s prototype amendment also prevents treating this inventory as authorised live-release scope.
- The August spec requested mobile/tablet access, not a native technician app. Its category-wide history/reporting gap assertions cannot be inherited as facts.

**Safe actions today versus further checks**

Safely retain the observed controls as a candidate inventory, correct the counts and novelty claims, record the account’s displayed GBP prices, and reproduce the documented X-Series failure before relying on that handoff.

Before stronger decisions:

- **Pricing:** inspect checkout/invoice terms and calculate a dated, tax-comparable conversion.
- **Completeness:** preserve full template/report/status captures and exercise transitions.
- **Workflow claims:** test message delivery, approval/bypass, checklist blocking, printing, imports and leave-driven availability.
- **Configuration/mobile exclusions:** inspect alternate booking/role settings and test direct phone upload; verify staff-app availability.
- **Integrations/architecture:** test each POS series separately, verify Citrus-Lime support, and obtain deployment-region evidence.
- **Launch priorities:** observe target shops performing these tasks and explicitly approve scope.