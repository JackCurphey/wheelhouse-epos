# Consolidation — journeys 6, 7

Read-only analysis for issue #116 step 1, 3 Oct 2026. Sources: `journeys.mjs:411-546`, the board recipes in `c2w.mjs:348-415` and `account.mjs:267-312`, the decision files, and walk-throughs 1 and 5. Screen counts come from `journeys.mjs` (j06 = 60, j07 = 44; checked by count). Anything marked *(inferred)* is a reading of the code, not something written in a file.

Cycle to Work decision 8 recorded 39 screens (`2026-10-02-cycle-to-work-review.md:152`). Walk-through 5 has since raised that to 60.

## Counts by class

| Class | J6 | J7 | Total |
|---|---|---|---|
| Real screen | 17 | 8 | 25 |
| Situation of another screen | 33 | 29 | 62 |
| Edge case | 6 | 1 | 7 |
| Settings | 4 | 6 | 10 |
| Deferred by the 3 Oct answers | 0 | 0 | 0 |
| **Drawn** | **60** | **44** | **104** |

- **Other journeys' screens with a line added:** 4 in journey 6 (`cw-today`, `cw-today-held`, `cw-today-choose`, `cw-messages`) and 15 in journey 7 (the job page ×3, Today, booking ×2, collection, Privacy requests, the staff customer page, Settings ×4, and `ac-account-c2w` ×2).
- **Cycle to Work copies in other journeys (out of scope here):** 17 more, in journeys 1, 10, 11 (7 till boards), 13, 15 and 17 (`journeys.mjs:145, 672, 695, 731-736, 814-816, 931-933, 1020, 1025`). Counting journey 7's two, 19 boards outside journey 6 are another journey's screen with a Cycle to Work line.
- **An exact duplicate:** `cw-today-choose` is the same board as `op-today-c2w` (`c2w.mjs:400` and `opening.mjs:241`, same options).
- **The code already treats these as one screen each:** the 14 order boards are one `orderPage()` with different options, and the 12 account boards are one `accountPage()`.

## Merge table

| Ids | Becomes | Saved | Decision touched |
|---|---|---|---|
| cw-list, -list-owner, -first-use, -ordered, -list-hold-ended, -list-deposit-refund | Cycle to Work list (Owner view, empty, Undo, hold ended, deposit to refund) | 5 | C2W 2, 7 (M2, M3); walk-through 5 M3, H2 |
| cw-order-held, -order-applied, -order-deposit, -order-deposit-paid, -order-deposit-counted, -order-deposit-refund, -order-get-ready, -marked-ready, -order-on-order, -order-ready, -order-owed, -order-part-paid, -order-paid, -more | The order page; its "Next" box has 12 situations, plus the More menu | 13 | C2W 1, 3, 4 |
| cw-new, -new-not-in-stock | New order box | 1 | C2W 7 (H5) |
| cw-quote, -quote-deposit, -quote-revised | The quote document | 2 | C2W 6, 7 (M9) |
| cw-certificate, -diff, -more, -late, -released | Certificate box. A message line covers match, less, more, late and released; `-match` stays drawn because it opens a second box | 4 | Walk-through 5 H4, M1, M3 |
| cw-mark-paid, -mark-paid-diff, -record-payment, -record-payment-more | One "Record a payment" box. From an order, one bike is ticked. The "Mark paid" button stays | 3 | C2W 5; walk-through 5 M7 (kept) |
| cw-owed, -owed-reports | Owed page (the back link follows where you came from) | 1 | Walk-through 5 L1 |
| cw-cancel, -cancel-ordered, -cancel-ordered-deposit | Cancel box | 2 | Walk-through 5 M8 |
| cw-customer-view, -released, -cancelled | The customer's view of the order | 2 | Walk-through 5 M3, M8 |
| cw-email-certificate-revised, cw-texts-certificate, -hold, -cancelled | A wording table under Messages; `cw-email` stays as the one drawn message | 4 | C2W 6; walk-through 5 M6 |
| cw-today, -today-held, -today-choose | Lines on Today (journey 10) | 3 | Opening the shop 3, 4 |
| cw-settings, -settings-deposit, cw-messages | One Settings page; Messages becomes a line on journey 8's page | 2 | C2W 8 |
| ac-account, -lower, -repairs, -new, -c2w, -c2w-collected, -question-sent, -asked, -delete-pending, -delete-cancelled, ac-download, -download-failed | The account page: filter, empty, Cycle to Work, sent, pending, cancelled, done, failed. `-lower` is only the same page scrolled down | 11 | Account 1, 4, 8 |
| ac-receipt, -receipt-sent | The one receipt | 1 | Leftover screens 1–2 |
| ac-question, ac-job-note, -note-sent, -note-answered | One conversation thread; on the job page it becomes a situation line | 3 | Account 3 |
| ac-inbox, -list, -sent, -all, -empty, -reply-text | Staff inbox. The phone list becomes a size rule, not a drawing | 5 | Account 7, 9 |
| ac-contact, -contact-changed | How we contact you box | 1 | Account 6, 8 (H2) |
| ac-stopped, -stopped-on | The "Stop these" page | 1 | Account 6 |
| ac-delete, -delete-blocked, -delete-sent | Delete request box | 2 | Account 4 |
| ac-today, -book-remind, -collect-remind, -reminder-landing, -privacy-requests, -customer-delete | Lines on the screens of journeys 10, 3, 5, 3, 15 and 15 | 6 | Account 2, 4 |
| ac-services, -service-edit, -messages, -reminder-wording | Lines on journey 8's Services and Messages pages | 4 | Owner setup 14; Account 2 |
| ac-review-first, -review-setting | Review request box (first time is a situation) | 1 | Account 5 |

**Edge cases that should be situation-list lines, not drawings:** a certificate for more, a late certificate, a certificate for a released bike, a payment for more than expected, the two cancel-after-ordering cases, and delete blocked. Walk-through 5's undrawn edge cases (`ux-walkthrough-5-cycle-to-work.md:106`) belong on the list too.

**Settings › Messages is drawn three times here** (`cw-messages`, `ac-messages`, `ac-reminder-wording`), on top of journey 8's own drawing.

## Reduced count and blocks

**From 104 drawings to 27: 18 for Cycle to Work and 9 for the account.** That count keeps every box that opens over a page, following issue #116's step 2, rule 1. It is an estimate made from the recipe code, not measured.

**Mark's blocks these screens use (12 of the 15):**
- 1 Settings page
- 2 Settings row
- 3 Table with filters (the list, owed, history, inbox list)
- 4 Detail page (the order)
- 6 Today cards
- 8 Are you sure (cancel, order anyway, delete request)
- 9 Form box (about 10 boxes)
- 10 Saving, failed and Undo message
- 11 Empty list
- 12 Hidden controls (cost and commission, money steps)
- 14 Activity list ("What's happened")
- 15 Job page (with the note thread)

Not needed here: 5 Report page, 7 Checklist (the hand-over checks are ticks inside a form box), 13 Shop switcher.

**New blocks, not on Mark's list (8):**
1. **Customer page frame:** the website shell, phone first.
2. **Person page:** a summary on the left and one history on the right. It is shared with the staff customer page (Account 1, `2026-10-01-account-and-reminders-review.md:31`).
3. **Stage strip** (`c2w.mjs:106, 331`). It probably also fits journey 4's tracker *(inferred)*.
4. **Next-step box:** one box that changes with the stage (`c2w.mjs:147-166`).
5. **Printed document:** the quote and the receipt (`c2w.mjs:195`, `account.mjs:129`).
6. **Customer message:** an email or text with "See your order" and the fixed "Stop these" line (`c2w.mjs:283-321`, `account.mjs:203`).
7. **Conversation thread with a reply box** (`account.mjs:135-137`).
8. **"Who pays what" money summary** (`c2w.mjs:143`). It is shared with the till.

That makes **20 blocks for 27 screens.**

## Main tasks, walked

| Task | Who | Clicks | Screens | Source |
|---|---|---|---|---|
| Make an order | Jo | about 10, plus typing | 3 | Walk-through 5:17 |
| Add the certificate | Jo | 2, plus 3 boxes typed | 2 | Walk-through 5:20 |
| Hand over | Jo | 2, plus 1 per check, then the till | 4–5 | Walk-through 5:21; till steps *(inferred)* |
| Find the order while on the phone | Jo | type, then 1 | 2 | `cs-search-c2w` *(inferred)* |
| A hold ending | Jack | 1 on Today | 1 | Walk-through 5:19 |
| One payment for several bikes | Jack | 3, plus typing | 3 | Owed → provider → box *(inferred)* |
| See their order | Maya | 1 tap | 1 | Walk-through 5:18 |
| Ask a question, read the reply | Maya | 2 taps plus typing, then 1 | 2, then 1 | `account.mjs:280-282` *(inferred)* |
| Stop reminders | Maya | 1 tap | 1 | Account 6 |
| Book from a reminder | Maya | 3 taps, details filled in | 2 or more | Walk-through 1:30; fix at `2026-10-02-ux-walkthrough.md:60` |

## Persona findings

**High**

1. **Jo can't fix a certificate typed in wrong.**
   - The More menu offers bike, accessories, provider, release and cancel, but nothing to change the certificate (`c2w.mjs:176`).
   - Saving a certificate shows no Undo, unlike ordering and "marked ready" (`c2w.mjs:359, 373-374`).
   - The certificate amount sets what the provider owes. This fails Jo's undo check (`personas.md:51`). It is a gap.

**Medium**

2. **New order can only pick a customer who already exists.** The Customer box has no "add someone new" (`c2w.mjs:187`; walk-through 5 L4). Jo, on the phone with a new customer, has to leave the order to add them first *(inferred)*.
3. **Two ways to record the same provider payment.** "Mark paid" and "Record a payment" do the same job. One box with the bikes ticked is simpler for Jack. "Record a payment" was drawn without checking how providers really pay (`ux-walkthrough-5-cycle-to-work.md:89`).
4. **Whether hand-over can go ahead with checks unticked is undecided** (walk-through 5 L4). A Saturday worker who doesn't remember the screen needs it to say (`personas.md:149-152`).
5. **Not known: does "See your order" need signing in?** The customer view is drawn inside the Account area (`c2w.mjs:334`). A job page link needs no sign-in (`2026-10-02-leftover-screens-review.md:17-18`). For a customer who isn't confident with phones, an emailed code from a text link is where they would get stuck.
6. **Possibly too big for the first release.** The deposit rule accounts for 5 of the 14 order states, plus 2 of the 3 cancel cases (`c2w.mjs:360-366, 393-396`). Holding these back would reopen Cycle to Work decision 4 (`2026-10-02-cycle-to-work-review.md:58-69`). Jack's choice:
   1. Build all three ordering rules and both deposit rules in the first release.
   2. Ship "once the certificate arrives" and "once applied" first, and add the deposit rule later. This cuts 7 drawings and their build and tests, but a shop that wants a deposit before ordering would have to wait.

**Low**

7. `cw-today-choose` duplicates `op-today-c2w`. Delete one.
8. `ac-account-lower` (the same page scrolled) and `ac-inbox-list` (the phone layout) should become rules, not drawings.
9. Draw Settings › Messages once, in journey 8. Each journey adds its rows as lines.

**Not checked:** the till's click counts at hand-over (journey 11), and whether the job page's tracker and the stage strip really are the same block.
