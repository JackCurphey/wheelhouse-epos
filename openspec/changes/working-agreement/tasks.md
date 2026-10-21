# Tasks: how Mark and Jack work together

Owner "either" means whoever is free first; say so on the pull request.

## 1. The agreement

- [x] 1.1 `CLAUDE.md` rewritten to match `design.md` (the first two session steps, "Allowed without asking" rule 4, "How each piece is built")
- [x] 1.2 One line at the top of the split plan pointing here
- [ ] 1.3 Jack told by an issue: what changes, what stays, how to overrule it (Mark)
- [x] 1.4 `openspec/config.yaml` context and proposal rule no longer say each file has one owner (Mark's 21 Oct decision covers editing it)
- [ ] 1.5 STATUS tidied: one block per person; the "Check #" list moved to a "To review" checklist issue; the stage check as a checklist issue (either)

## 2. The checks (either; each one test first, watched failing, with the break shown)

- [ ] 2.1 Owner-only list and test (design 3), covering the routes found open on 21 Oct: service categories and services, label settings, shop theme, employee change and permanent delete
- [ ] 2.2 Concurrency tests for convert and for the last unit (these are tasks 3.1 and 3.2's tests; one test file)
- [ ] 2.3 The browser-test-per-screen check, with today's gaps listed and allowed
- [x] 2.4 The reply-shape file, used first by the screens that read the till and the workshop overview (`src/lib/api/shapes.ts`, next to `types.ts`; a job as read (`WORKSHOP_JOB`, with its days) and as an edit or action sends it back (`WORKSHOP_JOB_CHANGED`, without), checked against real replies, an online booking's among them, by `tests/reply-shapes.test.js` and by the Overview and till tests through `tests/helpers/fake-job.js`. The other screen tests that fake a job move to the helper under 3.13)
- [ ] 2.5 For each check, break the code it covers, show it going red, restore
- [ ] 2.6 Editing CI to run 2.1–2.4: ask first per the global rule, then split the 9-minute job in parallel if it helps (either)

## 3. Findings from the 21 Oct review of origin/main (each: test first, watched failing; owner either)

P1:
- [ ] 3.1 Convert can take one order's payment twice: claim the order first (`UPDATE … WHERE status='open' RETURNING`), then create the sale (`sales.js`, `lib/sales.js`)
- [ ] 3.2 Stock deduction loses updates: `stock_qty = stock_qty - ?` inside the transaction, not a read then an absolute write
- [ ] 3.3 Customer sign-up takes over an existing customer by email (`customer-auth.js` `signupCustomer`): create a new customer and let staff merge, until email is verified

P2:
- [ ] 3.4 Owner-only on the settings and employee routes (see 2.1)
- [ ] 3.5 A cancelled, declined or expired booking can't be booked in or started (#190 A)
- [ ] 3.6 Delete the legacy `status` branch of `PUT /api/workshop-jobs/:id`
- [ ] 3.7 Job actions (cancel, decline, accept) and Delete job run inside `withJobBookingLock`, and the booking message goes after commit
- [ ] 3.8 Quote send must not rotate the customer's link while sending is pretend (`messageLink`)
- [ ] 3.9 "Amount to pay" in Bike ready, and the till's amount due, come from one function including the group discount
- [ ] 3.10 An order with no lines can't be converted, or saved empty
- [ ] 3.11 Remove the till's unsigned-finish exception now that the old job form is gone (#343)
- [ ] 3.12 Split `src/screens/diary/diary-page.tsx` with no behaviour change, guarded by the existing diary tests
- [ ] 3.13 Screens' tests stop mocking the whole server (design 3, reply-shape file) and each new screen gets a browser spec (in progress: `tests/helpers/fake-job.js` and `fake-order.js` check every fake job and order against the reply shapes as they are made, and every screen test that fakes one uses them; the other replies still to get shapes)

P3, for later, not started unasked: raw 500 text on public routes; `null` bodies on public routes; sign-up wording that names known emails; no rate limit on public availability; rate limiter never forgets keys; link expiry from the job date, not collection (Q8); messages: hung send blocks every shop, Undo leaves a dead link, subject line breaks, failure can block finishing a job; guard knows only three key prefixes; upload type is the client's claim; migration 046's table rewrite; `public-portal/` dead code; two pill implementations; one serial CI job; the `migration-048` queued row never asserted.

## 4. Checks

- [ ] 4.1 `npx openspec validate working-agreement` passes
- [ ] 4.2 After one month, Mark and Jack read the digest issues and say what to change
