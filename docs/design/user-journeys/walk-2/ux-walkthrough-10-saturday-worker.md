# UX walk-through 10: the Saturday worker's day (WP-W.2)

Walked 3 Oct 2026 on the one canvas (https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j), issue #116 step 4: journeys 10, 11, 16, 2, and the book-in and hand-over of 3 and 5. A new story, so no earlier report to check.

## The story

The Saturday worker (no name yet) works one day a week at North Street Cycles, Bolton. They're on the front desk and were added as "No email, till only". The drawings are dated Thursday 17 September; those dates stand in for a Saturday.

1. They check in on Till B1 with their PIN. They're the first in who takes payments, so they get the float check.
2. They sell Shimano brake pads B05S-RX and "Fit & adjust brakes" (£74.00, by card).
3. Maya Patel comes in for an online order that's already paid. The worker hands it over at the till.
4. A customer brings in a booked bike (the drawings' WH-1042, Trek Domane AL 3, Standard service). The worker books it in.
5. Maya collects a repair she paid online (£111.00): "Nothing more to pay. When you come in, just give your name." The worker hands it over. Another customer collects an unpaid repair and pays at the till.
6. Closing time comes. "Close the day" is for owners, managers and anyone with "Can close the day". Whether one of them works Saturdays is not known.

## Clicks and screens

| Person | Clicks (drawn path) | Different screens |
|---|---|---|
| Saturday worker | 18, plus typing three searches. Steps 4 and 5 (paid online) have no drawn path for a till-only worker. Someone with an email sign-in would need about 4 more clicks for each. | 9: `till-checkin`, `op-float-check`, `till-sale`, `till-pay`, `till-card`, `till-receipt`, `till-search`, `till-collect`, `till-rail`. With an email sign-in, 2 more: the diary and `job-overview`. |
| Maya Patel (phone) | 2 ("Pay £111.00 now", "Pay £111.00") | 4: `on-confirmed`, `on-email-ready`, `cp-summary`, `cp-pay` |
| Whoever closes the day (Jack Lewis on the boards) | 4 PIN taps, then about 6 (Cash-up 6) | 3: `eod-count`, `eod-paidout`, `eod-z` |

Where the clicks go: 4 for the PIN, 1 for "Looks right", 5 for the sale, 4 for the online order (open it, two ticks, Hand over), 4 for the unpaid repair (Add to basket, Take payment, Card, receipt).

## Findings

**H1: `till-search`, `till-collect`, `till-sale` (desktop); `job-overview` situations "Job · booked in, tag printed" and "At the counter, paid online: Hand over"; `op-today` (desktop). A till-only worker can't book a bike in or hand over a repair that was paid online.**

*What happens:* Decision 8 of walk-through 8 says the till will do both. The decision file says "The drawings and the build are not changed yet", and WP-W.6 plans to draw them. On the canvas, both happen only on the job page (and Today's "Book in"); `till-sale`'s situation list has neither. A till-only person is told: "They don't sign in to Wheelhouse, so they can't open anything away from the till" (`setup.mjs` line 275).

*Why it matters:* On a Saturday, the person at the counter has no way to take the bike in, and no way to give Maya back a bike she has already paid for.

*Fix:*
1. **Open the job page from the till, cut down to the counter tasks.** This adds a line to `job-overview`'s situation list: "Opened from the till by a till-only person: Book in and Hand over; everything else read-only." Good for: no new drawing, and the job is still drawn only once (drawing rule 5). Costs: a till-only worker sees a large page they use once a week, and "can't open anything away from the till" gets an exception.
2. **The hand-over becomes a line on `till-collect`, and the book-in becomes one new pop-up on the till.** The hand-over line: "A repair paid online: WH-1042 · Maya Patel · Paid online · [date] · Hand over". Same layout as the online-order hand-over, so one way to hand things over. The book-in needs a drawing because no till screen has a hook choice ("Kept on Hook 3"), a tag print or the customer's note; it would use building block 9, the form box. Good for: one drawing instead of decision 8's two, and the worker stays on the till. Costs: one new pop-up.
3. **Two new till screens, as decision 8 says.** Good for: it's what was decided. Costs: two drawings, one of which repeats the hand-over the till already has.

Recommend 2. Whichever is chosen, the situation lists also need: the book-in while the till is offline, and a booking deposit shown at book-in ("Deposit paid £[deposit]", from `bk-page`).

*8th question:* the hand-over can be a line (options 1 and 2). The book-in can only be a line under option 1.

*Touches:* walk-through 8 decision 8 (it says "Two new till screens"); the till-only rule (walk-through 4 M2); Collect and pay 3; Workshop day 27 (storage slots).

**Second check:** CONFIRMED — `j11_sit_till-sale` and `j11_sit_till-collect` in `canvas.json` have no book-in or paid-online repair line, `till-collect` hands over only "Online order · [order number]" (`till.mjs` line 442), the job page holds both (`j12_sit_job-overview` "Job · booked in, tag printed", "At the counter, paid online: Hand over"), and `setup.mjs` line 275 says what is quoted; severity High is right. Two things to add: option 1 reverses the basis of decision 8, not just an exception to it — walk-through 8's M6 part 2 option 1, which Jack took, was offered because it "Keeps 'till only' true" (`ux-walkthrough-8-shared-workshop.md`, M6); and option 2's pop-up draws book-in a second time beside the job page's, which drawing rule 5 ("Nothing is drawn twice", README) weighs against, a cost the option does not list.

**H2: `till-search` (desktop); `cp-summary` "The link opened again after paying" (phone). At the till, a job that's already paid looks like a job waiting to be paid.**

*What happens:* Typing "maya" shows "WH-1042 · Maya Patel, Trek Domane AL 3 · Standard service · approved £111.00, Add to basket ↵". Maya's page promises "Nothing more to pay." The search result has no line for a job that's been paid online. The "Paid online · [date]" strip (Collect 5 H3) is on the job page, which this worker never sees.

*Why it matters:* Someone who hasn't used the till for a week presses the obvious button and could charge Maya £111.00 a second time. That breaks a promise about money.

*Fix, no choice:* add lines to `till-search`'s situation list. "A job paid online: Paid online · [date], with Hand over in place of Add to basket." "A job expected today: Expected 11:30, with Book in." Add a line to `till-sale`: "A paid job can't be added to the basket; it says Paid online · [date]."

*8th question:* lines only, no drawing.

*Touches:* Collect and pay 5 (H3).

**Second check:** CONFIRMED — `ja-till-search-desktop` reads "WH-1042 · Maya Patel / Trek Domane AL 3 · Standard service · approved / £111.00 / Add to basket ↵" with no paid state, `j11_sit_till-sale` and `ja_sit_till-search` have no paid-online line, and the quoted promise is `cp-summary-paid` (`collect.mjs` line 84); High is right (Collect and pay 5 H3 "no double payment"). The fix is not fully "no choice": where "Hand over" and "Book in" lead from the search result depends on Jack's answer to H1.

**M1: `till-rail`, `staff-app` (desktop); `set-staff-invite` situation "Add someone with no email: till only"; `on-orders` (desktop). It isn't drawn what a till-only person can open, and on a Saturday nobody may be able to press "Mark ready".**

*What happens:* The till boards show the full staff sidebar, with "Online orders [n] to get ready", Diary, Stock and Today, and "Sign out" at the bottom. Walk-through 8's fix M6 part 1 decided the till opens "as the person checked in by PIN, with their role". The till-only rule says they can't open anything away from the till. Nothing on the canvas shows which of these a till-only person gets. "Mark ready" is on Front desk › Online orders, not on the till.

*Why it matters:* The worker can see that 3 orders need getting ready but may not be allowed to open them. An order paid on Saturday morning then waits until a full-time member of staff is in, even though the confirmation page says "We get it ready — about [n] days".

*Fix:*
1. **"Till only" includes Front desk › Online orders.** The worker can mark orders ready, and every other room is hidden (block 12, controls hidden by role). Good for: Saturday orders keep moving. Costs: the till-only rule gets wider.
2. **"Till only" means only the till page.** The rail shows only the till, and the order count says "A colleague gets these ready". Good for: keeps the rule as it is. Costs: orders wait.

Recommend 1. *8th question:* either option is a line on `till-rail`'s situation list. *Touches:* walk-through 4 M2; walk-through 8 M6 part 1; Buy online 6.

**Second check:** CONFIRMED — `ja-till-rail-desktop` shows the full Staff sidebar with "Online orders [n] to get ready" and "Sign out", `ja_sit_till-rail` has one line ("rail unfolded"), and "Mark ready" is only on `on-orders`; Medium is right. Two corrections: the till board shows "[n]", not 3 (the 3 is "To get ready · 3" on `on-orders`, which the worker would not see); and walk-through 8 M6 part 1 is the rule for staff with an email sign-in, while the till-only rule was kept as "till only" by decision 8, so option 1 reopens that, which should be said in so many words, not only as "the rule gets wider".

**M2: `till-checkin` situation "Till check-in: wrong PIN"; `set-staff-person` situation "Clear a forgotten PIN". A till-only worker who forgets their PIN on a Saturday can't work unless an owner or manager is there.**

*What happens:* The check-in screen says "No email? Ask the owner or a manager." The till-only form says "A forgotten PIN is cleared and given again the same way": in person, at the till.

*Why it matters:* A PIN used once a week is easy to forget. Whether a manager works Saturdays is not known.

*Fix:*
1. **An owner or manager can give a new PIN from their own phone.** Under Staff and roles › the person, "Give a new PIN" shows a one-time PIN they can read out over a call. Good for: the till isn't stuck. Costs: a PIN is passed on by phone.
2. **Keep it in person.** The wrong-PIN line adds "Forgotten it? Only [names] can give you a new one." Good for: nothing changes. Costs: no till on that Saturday.

Recommend 1. *8th question:* a line on `set-staff-person` and one on `till-checkin`. *Touches:* Signing in 6–7; walk-through 4 M2.

**Second check:** CONFIRMED — `jb-till-checkin-desktop` reads "No email? Ask the owner or a manager." and `setup.mjs` line 276 says "A forgotten PIN is cleared and given again the same way"; Medium is right. Option 1 contradicts a recorded decision and the finding should say so: Signing in 6 has each person get their PIN "so nobody else knows it" (`2026-09-29-signing-in-review.md` lines 41–45), and a PIN read out by a manager over a call is known to the manager.

**M3: `till-sale` situation "Close the day appears in the till bar after closing time · Manager"; `eod-count`. Nothing tells a Staff member what to do at closing time.**

*What happens:* For anyone who can't close the day, the till looks the same at 17:00 as it did at 10:00. If nobody closes the day, the next morning already handles it: the first float check expects "the float plus [day]'s cash", and Today shows "Close it" (Opening 7; walk-through 2 H1).

*Why it matters:* The worker doesn't know whether to count the drawer, leave it, or wait for someone. The screens don't say that leaving it is fine.

*Fix, no choice:* a line on `till-sale`: "After closing time, for someone who can't close the day: Closing up? [Name] closes the day. If nobody who can is in, just check out; the drawer is counted when the shop next opens." "Check out" is walk-through 8 M6's word.

*8th question:* a line. *Touches:* Cash-up 5; Opening 7.

**Second check:** CONFIRMED — the only closing-time line in `j11_sit_till-sale` is "Close the day appears in the till bar after closing time — Manager", and Opening 7 (`2026-09-30-opening-the-shop-review.md` lines 44–50) says the next morning's float check and Today's "Close it" handle an unclosed day; Medium is right. "Check out" is walk-through 8 M6 part 1's word for leaving the till (`2026-10-03-ux-walkthrough-8.md` line 62), not a timesheet check-out, which Opening 5 left out for now; the line's wording should keep that clear.

**M4: the links between screens in this story don't work.**

*What happens:* On `till-search`, the order's "Hand over" and the job's "Add to basket ↵" go to `#`. On `on-orders`, "Hand over" has no link, though the page says it "opens the till's hand-over". On `op-today`, "Book in" has no link and "Open the diary" goes to `#`. "Count it", "Looks right", "Start the day", "Take payment", "Card" and the till's "Hand over" have no links; only the ✕ goes anywhere. The job page's "Book in" links to itself (`job-book-in` was folded in). From `till-checkin`, "Next" goes to `pin-change`, not the float check.

*Why it matters:* The story can't be clicked through from check-in to closing.

*Fix, no choice:* wire these joins up in step 5's clickable mockup. *8th question:* nothing to draw.

**Second check:** CONFIRMED in part, one part REFUTED — the `#` links and unlinked buttons are as stated (`ja-till-search`, `on-orders`, `op-today`, `op-float-check`, `till-sale`, `till-pay`, `till-collect` checked; the job page's "Book in" is `href="j12-job-overview-desktop.dc.html"`), but `till-checkin`'s "Next ›" is the canvas's own board-to-board arrow (`aria-label="Next screen"`), not a control in the app; the real gap there is that the PIN pad leads nowhere. Severity should be Low: these are static drawings, and wiring the joins is already step 5's job in issue #116, so nobody using the product is confused.

**L1: `till-checkin`. It doesn't say whether the PIN can be typed on the keyboard.** The pad is drawn as buttons with no input box (walk-through 2 left this "not checked"). Fix, no choice: a line saying "The keyboard's number keys work too." *8th question:* a line.

**Second check:** CONFIRMED — the pad on `jb-till-checkin-desktop` is buttons with no `<input>` (only `aria-label="2 of 4 digits entered"`), and `ux-walkthrough-2-shop-day.md` line 231 lists "whether the PIN can be typed on a keyboard" as not checked; Low is right.

**L2: `till-collect`. Handing over an online order has no Undo.** A repair's hand-over gets "Collected · the job is closed" with Undo (Collect 5 M4). An online order's hand-over gets nothing like it. Fix, no choice: a line saying "Handed over · Undo for a few minutes". *8th question:* a line. *Touches:* Collect and pay 5.

**Second check:** CONFIRMED — `till-collect` ends at "Not now" and "Hand over" with no after-state, `j11_sit_till-collect` has only the offline line, and Collect and pay 5 M4 gives a repair "Collected · the job is closed" with Undo (`2026-09-30-collect-and-pay-review.md` lines 69–70); Low is right.

**Persona and access checks.** *Saturday worker:* check-in, the float check, the online-order hand-over ("Already paid online — nothing to take at the till") and the search box make sense after a week away; book-in, the paid-online hand-over and closing time don't (H1, H2, M3). Today, booking in is only learnable by being shown (it's under Workshop › Diary). The forgotten PIN (M2) and closing the day need a manager; closing is by design. *Screen reader:* the PIN dots announce "2 of 4 digits entered" and the hand-over's ticks are labelled; a paid job's state isn't in the search result (H2). *Keyboard:* see L1; focus order not checked. *Low vision:* not checked (not rendered). The receipt's 5-second countdown is covered by walk-through 1's "Don't close things by themselves".

**Decided but not yet drawn** (WP-W.6). These aren't new findings:
- Walk-through 8 M6 part 1: the bottom of the till's menu should read "Jo Taylor · Staff · Check out". The boards still say "Sign out".
- Walk-through 8 L1: the diary's quick look still says "Jo Taylor · 09:05"; it should be 09:12.
- Walk-through 8 decision 8 (see H1).

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | till-search, till-collect, till-sale, job-overview, op-today | Till-only worker can't book in or hand over a repair paid online | Yes (1–3) |
| H2 | till-search, cp-summary | A job paid online shows "Add to basket" at the till | No |
| M1 | till-rail, staff-app, set-staff-invite, on-orders | What till-only opens isn't drawn; nobody can "Mark ready" on a Saturday | Yes (1–2) |
| M2 | till-checkin, set-staff-person | Forgotten PIN with no manager in | Yes (1–2) |
| M3 | till-sale, eod-count | Nothing tells Staff what to do at closing | No |
| M4 | till-search, on-orders, op-today, op-float-check, till boards | The links between screens in the story don't work | No |
| L1 | till-checkin | PIN on the keyboard's number keys not stated | No |
| L2 | till-collect | No Undo after handing over an online order | No |

## Choices for Jack

1. **H1: how should the till book bikes in and hand over repairs paid online?** (1) Open the job page from the till, cut down to those two tasks. (2) The hand-over becomes a line on the till's existing hand-over, and the book-in gets one new pop-up. (3) Two new till screens, as decision 8 says. I recommend 2.
2. **M1: can a till-only person open Online orders and mark them ready?** (1) Yes. (2) No, only the till page. I recommend 1.
3. **M2: a forgotten PIN with no manager in.** (1) A manager can give a new PIN from their own phone. (2) Keep it in person, at the till. I recommend 1.

## Verification

- **Boards read** (text and links in the HTML, desktop unless noted): jb till-checkin, till-setup, pin-change; j10 op-float-check, op-float-short, op-today; every j11 desktop board; j16 eod-check, eod-count, eod-paidout, eod-z; ja till-rail, till-search, staff-app; j02 on-orders, on-order-staff, and on-confirmed, on-email-ready (phone); j03 bk-page, bk-request (phone); j05 cp-summary, cp-pay, receipts (phone); j12 job-overview, new-job.
- **Situation lists** in `canvas.json` for ja, jb, j02, j03, j05, j08 (staff), j10, j11, j12, j16. **Code:** `setup.mjs`, `collect.mjs`, `opening.mjs`, `diary.mjs`, `till.mjs`, `consolidate/j05, j11, j12`.
- **Decisions read:** Opening the shop, Selling at the till, Cash-up, Buy online, Collect and pay, Book a repair (deposits), walk-through 8, walk-throughs 2–7, build-plan answers; none has a "Later change (3 Oct, issue #116)" note. Also the personas, the script, issue #116 step 4 and the README's drawing rules.
- **Not checked:** anything rendered (colour, zoom, layout); the till on a phone; where focus moves; whether a manager works Saturdays (not known); whether a till-only person can be given "Can close the day" (not stated). Click counts are by hand and weren't counted twice.

## Second check

Checked 3 Oct 2026 by a second reviewer who did not write the report, against `canvas.json`, the board files, the generator modules and the decision files.

- **Counts:** 7 confirmed (H1, H2, M1, M2, M3, L1, L2), 1 confirmed in part with one part refuted (M4), 0 uncertain.
- **Severity:** M4 should be Low. The rest stand.
- **Decisions reopened without saying so plainly:** H1 option 1 and M1 option 1 both widen "till only", which decision 8 was chosen to keep ("Keeps 'till only' true", walk-through 8 M6 part 2). M2 option 1 goes against Signing in 6 ("so nobody else knows it"). Each lists the decision under *Touches*, but Jack should be told that picking these options changes a decision.
- **8th question:** H1 option 2 adds a drawing and gives its reason (no till screen has the hook, tag print or note). The cost it leaves out is drawing rule 5: book-in would then be drawn twice. No other fix adds a drawing.
- **Missed by the walker (mine):**
  1. The story assumes the Saturday worker was added as "No email, till only". `personas.md` doesn't say how they were added, and nor does Jack's answer in walk-through 8 ("saturday workers do work the front desk"). H1, M1 and M2 only apply if that is true, so it should be marked as an assumption.
  2. Steps 4 and 5 use WH-1042 both for the bike booked in and for Maya's paid repair collected the same day. The drawings use WH-1042 for both, so nothing is made up, but they are one job, not two.
  3. H2's "fix, no choice" depends on H1: whatever "Hand over" and "Book in" open from the search result follows from Jack's choice there.
- **Nothing invented found.** The quoted wording, screen ids and `setup.mjs` line 275 match the files. The click counts were not recounted.
