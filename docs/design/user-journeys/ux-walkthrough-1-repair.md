# UX walk-through 1 — a repair, start to finish

Walked 2 Oct 2026 by the walk-through helper, as the pilot for `docs/decisions/2026-10-02-ux-walkthrough.md` (decision 1). This is not a UI audit. Each journey has had its own audit, screen by screen. This walk follows one story across six journeys, as the people living it, and looks for what breaks at the hand-offs between them.

**The story.** Maya Patel finds North Street Cycles' website (journey 1), books a Standard service for her Trek Domane AL 3 (journey 3), drops it off and approves a quote (journey 4, WH-1042, £111.00 approved), Alex Morgan does the work from the Workshop diary (journey 12), she is told "Bike ready", pays and gets a receipt (journey 5), and months later a service reminder brings her back to her account (journey 7). Walked as Maya (phone, and a computer for the account), Jo Taylor (front desk, desktop), Alex Morgan (mechanic, tablet) and Jack Lewis (owner), and again as someone using a screen reader or only a keyboard, and as someone with low vision.

**How facts are handled.** Every finding names the screens (id and size) and the source line or decision it rests on. Bracketed placeholders (`[time]`, `£[deposit]`, `[n]`) are unknowns, not errors. Where I could not check something I say so; "I could not find it" is never written as "it is not there" unless I searched for it and say how.

**Not raised, on purpose.** Anything a journey's own UI audit already covers, unless the story makes it worse. The Soft sand look and the dashed "LOGO" box. Example-data overlap that is not a design question: Maya's Trek has nine jobs in the diary's one example week (WH-1042, 1051, 1054, 1056, 1059, 1062, 1071, 1074, 1077 — `diary.mjs` `JOBS`), like the Aisha Khan overlap noted in journey 5's decisions. None of the recorded decisions is reopened; where a finding touches one, it says which.

**Verdict.** The spine of the story holds well. WH-1042, the Trek Domane AL 3, the lines and the £111.00 total are the same on every screen, staff and customer. The "Your booking · WH-1042" line carries Maya's one page from the booking to the ready page, as Drop off and approve the quote decision 1 intended. Maya chose Text, and every message she is told about goes by text; the receipt goes to the email she gave "for your receipt". The breaks are at the joins: the spending limit Maya set at booking is dropped before the quote; the moment the bike becomes "ready" takes two presses with three names; a promised delay message and a diary state for "waiting for Maya" don't exist; and a few things are asked twice.

## The story as walked

Clicks are taps or clicks on the main path; typing is listed separately. "Main path" here is a one-shop business with no deposit, bookings as requests, and online payment on, because that is how most of the boards are drawn.

1. **Maya finds the shop** — `wb-home` (phone). Hero button "Book a repair". **1 tap.** With two shops she has already been given "Collecting from Bolton" in the header.
2. **She chooses the service** — `bk-service` (phone). Standard service, "Next: your bike". **2 taps.** (Two-shop business: `ms-book-shop` first, "Which shop?", **+1 tap**.)
3. **Her bike and the problem** — `bk-bike` (phone). Make and model, colour, "Anything we should look at?" typed; "Go ahead if the whole bill comes to no more than £200" chosen; "Next: when". **1 tap, 3 fields.**
4. **When** — `bk-when` (phone). "Book this time" on "Earliest you can have: Thu 17 Sep, 09:30" goes straight to the details step. **1 tap** (3 if she picks a day and a time).
5. **Her details** — `bk-details` (phone). Name, mobile, email (browser fill-in can do these at once), Text already chosen, the reminder tick, "Send booking request". **1–2 taps, 3 fields.**
6. **Request received** — `bk-request` (phone). "Thanks, Maya — your request is with us", "Extra work: OK if the whole bill is up to £200", "Reference WH-1042". **0 taps.**
7. **Jo accepts it** — `diary` → `request-new` / `bk-staff-request` (desktop). Click the "Waiting for you" card, Open, Accept (a mechanic pill if needed). **3–4 clicks.** Maya gets "Booking confirmed" (`bk-page`).
8. **Drop-off** — `dq-in-shop` (Maya, phone: "We've got your bike — booked in Thu 17 Sep at 09:12"); Jo: Today's "Book in" → `job-overview` → "Book in" → `job-book-in` (desktop), tag printed. **2 clicks.**
9. **Alex finds more work and sends a quote** — `diary-mechanic` → `job-book-in` → `dq-job-quote` (tablet/desktop). Open the job, add pads and fitting and the cable (scan or Add item), set Needed/Optional and "Goes with", add a photo, "Send quote". **About 9–10 taps.** Toast "Sending the quote to Maya by text in 1 minute · Undo" (`dq-job-sent`).
10. **Maya answers** — text → `dq-quote` (phone) → "Approve £111.00" → `dq-answered`. **2 taps.**
11. **Alex does the work** — `job-mechanic`, `job-checklist` (tablet). Open the checklist, tick 10 items, Done, tick each line Done, "Mark ready for collection". **About 16 taps.** This lands on `job-finished` ("Work finished"), where someone presses "Mark ready & notify customer". **+1.** (H2)
12. **Bike ready, Maya pays online** — text → `cp-summary` → "Pay £111.00 now" → `cp-pay` → "Pay £111.00" → `cp-paid` (phone). **3 taps plus the card form.** "Your receipt is on its way by email" → `cp-receipt-email`.
13. **Collection** — Jo: search for Maya, open WH-1042 (`cp-ready-paid`, desktop), "Hand over" → `cp-collected`. **2 clicks plus typing.** (Not paid online: "Take payment" → `cp-till` "Take payment · £111.00" → receipt choice: **3 clicks**.)
14. **Months later** — reminder text → `ac-reminder-landing` (phone), service and bike already chosen, "Book this time", then her details typed again (M7), Send. **3 taps, 3 fields.** Or receipt email "See it in your account" → `cust-signin` / `cust-code` → `ac-account` (computer): **2 taps plus email and code.**

**Totals on the main path.** Maya: about 16 taps and 9 typed fields across the whole story, 6 of them fields she has already given once. Jo: about 8 clicks. Alex: about 26 taps, most of them the ten-item checklist.

## High

**H1 — `bk-bike`, `bk-request`, `bk-page` (phone); `job-overview`, `job-mechanic`, `job-finished`, `cp-ready-unpaid`, `cp-ready-paid` (desktop/tablet); `dq-job-quote`, `dq-job-answered` (desktop); `dq-quote` (phone): Maya's £200 spending limit is dropped between booking and the quote.**
- At booking Maya chooses "Go ahead if the whole bill comes to no more than £200" (`bk-bike`, `book.mjs` `limit()`), and every booking page repeats it: "Extra work — OK if the whole bill is up to £200" (`bookingLines`, `LIMIT`).
- Workshop day 43: under the customer's limit the quote is skipped. The job page says so too: "Quotes are sent when the total is over the customer's limit, or they set none" (`job-page.mjs`). £111.00 is under £200, so by the rules no quote would be sent.
- Journey 4 sends her one anyway. To make that board consistent, `diary.mjs` (the comment above `job-quote`, and `quoteJobBoards`) sets the tag to "No spending limit set" on the quote boards only. The same job therefore reads "Customer OK up to £200" on `job-overview`, `job-mechanic`, `job-finished` and both collection boards, and "No spending limit set" on `dq-job-quote` and `dq-job-answered`. `quote.mjs` and the quote audit both note the example has no limit; neither says what Maya was told at booking.
- The path the rule creates is not drawn anywhere. I searched `quote.mjs`, `collect.mjs`, `account.mjs` and `setup.mjs` for "limit": after booking, no customer screen and no message mentions it. So when Alex adds £46 of pads and fitting under her limit, nothing says what Maya sees, or when. The first she would hear of it is "What we did" on the "Bike ready" page.

*Why it matters:* Maya was told "go ahead up to £200, we won't bother you". Either the shop asks her anyway (the promise is broken), or it doesn't and the bill is £46 more than she booked with no word until she collects. Staff also see two different limits on one job. *Fix:*
1. Draw the "within your limit" path. Staff: a line by "Send quote" saying "Within Maya's £200 limit — no quote needed. She'll be told what was added", and the lines go straight to Approved. Maya: a short message ("Alex added brake pads and fitting, £46.00 — within your £200 limit, so we've gone ahead") and the same line on her job page under "Work agreed". Then change the story's example so the quote is legitimately sent: Maya picks "Call me before any extra work" (the option already on `bk-bike`). One message row, one job-page line and one staff line to draw; every board tells the same story.
2. Keep the limit as a note for staff only, and always send a quote for anything new. This reopens Workshop day 43 (under the limit, no quote).
3. Only fix the example (Maya picks "Call me first" everywhere) and leave the within-limit path undrawn. Cheapest, but the path a £200-limit customer takes is still missing.

Recommend 1.

**H2 — `job-mechanic` (tablet), `job-finished` (desktop), `dq-job-answered` (desktop), `cp-summary` (phone), `set-msg-list`/`dq-messages`: the moment the bike becomes "ready" takes two presses with three different names, and the rules disagree about which one tells Maya.**
- Alex's main button on `job-mechanic` is "Mark ready for collection". It leads to `job-finished`, whose status is "Work finished" and whose strip says "Alex finished the work and final checks at 15:30. The bike is still in the shop." That board has two equal dark buttons: "Mark ready & notify customer" and "Take payment" (`diary.mjs`, `job-finished`).
- Settings › Messages says "Bike ready" is sent "When a job is finished" (`setup.mjs` `msgListOpen`). Drop off and approve the quote decision 6 says the customer's tracker moves "by itself as staff use the job page (book in, start work, finished)". By those words Maya's page reaches "Ready" at "Work finished", before anyone has pressed "notify".
- `dq-job-answered` also shows "Mark ready for collection" as its main button straight after Maya approves, with the service not started and the checklist at 0 of 10.
- "Bike still waiting" and the Today flag count days "from when the bike is marked ready" (`cp-setting`). With two steps it is unclear which press starts that clock.

*Why it matters:* this is the hand-off the whole collection journey hangs on. Alex presses a button that says "Mark ready for collection" and reasonably believes he has. Maya either isn't told (the bike sits), or her page says "ready" and offers "Pay now" before the text arrives. *Fix:*
1. One press. The mechanic's "Mark ready for collection" marks the job ready and sends "Bike ready" with a short Undo, as sending a quote does (Drop off and approve the quote decision 5). "Work finished" goes. The fewest clicks, and it matches the Messages wording.
2. Two steps on purpose, with clear names. The mechanic's button becomes "Work finished — pass to the front desk"; the front desk's becomes "Mark ready and tell Maya"; Messages reads "When a job is marked ready"; the tracker and the "still waiting" clock move on the second press. Suits shops that wash or check bikes before calling the customer; one extra click on every job.
3. A shop setting choosing 1 or 2 (off = option 1). Most flexible; one more setting to explain.

Recommend 1, and on `dq-job-answered` make the main button "Start work".

## Medium

**M1 — `wb-home` (phone), `ms-book-shop` (phone), `bk-service`: with two shops, Maya is asked "Which shop?" after the website has already remembered Bolton.**
- `wb-home` (phone) shows "Collecting from Bolton · Change" at the top: the shop is "chosen once and remembered across the website" (Buy online decision 8). Pressing the hero's "Book a repair" opens `ms-book-shop`, "Which shop?", with nothing chosen. This is as recorded: Multiple sites audit M8 says nothing is chosen unless the customer came from that shop's page (`sites.mjs`, "Nothing chosen unless the customer came from a shop's page").
- The two recorded decisions each make sense alone. Joined, Maya picks Bolton twice.

*Why it matters:* one wasted tap, and a small "didn't it just ask me that?" moment on the first screen of booking. *Fix (touches Multiple sites decision 5 and audit M8, and Buy online 8):*
1. Booking starts with the remembered shop already chosen, shown as the closed line "Shop · Bolton · Change", as `ms-book-shop-chosen` already draws for a customer coming from Bolton's page. One tap fewer; a customer who wanted the other shop has to notice and press Change.
2. Keep asking, and say why: "Your repair can be at either shop — which one?" No tap saved, but the second question explains itself.
3. Keep asking, but put the remembered shop first and marked "Your shop". No tap saved; less thinking.

Recommend 1.

**M2 — `bk-confirmed`/`bk-page` (phone); `job-overview` (desktop); Today (`opening.mjs`); the workshop overview: the time Maya was told to arrive is not on any staff screen I checked, and her diary block is at a different time.**
- Maya is told "Thursday 17 September, arrive 09:30" (`bk-page`, `bk-confirmed`: "Arrive at 09:30").
- In the diary WH-1042 sits Thu 17 Sep 11:30–13:00 (`diary.mjs` `JOBS`), and the job page shows "Diary time Thu 17 Sep · 11:30–13:00" (`job-overview`, desktop). Workshop day 12 puts a request "in the slot it asked for", which would be 09:30.
- On Today's "Still to arrive", WH-1045 (Jamie Brooks) reads "10:30 appointment"; WH-1042 has only a "Book in" button (`opening.mjs` line 87). The overview's arrivals list is the same (`diary.mjs` `ARRIVALS`).

*Why it matters:* Jo can't see that Maya is due at 09:30, so she can't tell if Maya is early or late, or answer "what time did I book?" on the phone. *Fix:*
1. The arrival time is the diary slot's start, as Workshop day 12 already implies. Move the example block to 09:30 and show "09:30 appointment" on Today and the overview as for WH-1045. No new idea; one example change and one label.
2. Keep two times on purpose (arrive 09:30, work 11:30–13:00), and show "Arriving 09:30" on Today, the overview, the job's details strip and the diary block. Closer to how a busy shop works; a new field on four screens.

Recommend 1 for Release 1's appointment shops; 2 only if Jack wants arrival and work slots to differ.

**M3 — `diary`, `diary-mechanic` (desktop/tablet), `dq-job-sent`, Today: the diary has no way to show "waiting for Maya's answer", and the colour the quote decision asks for already means something else.**
- Drop off and approve the quote decision 4 says the job shows "No answer yet" "on Today and in the diary"; decision 5 says the job "turns purple ('Awaiting approval')". Workshop day 12 says "purple only ever means pending" (a booking request), and the diary's legend reads Scheduled, Pending (purple), Change requested, Waiting for parts, Ready, Cancelled (`diary.mjs` `ST`).
- The job page does show "Awaiting approval" in purple (`dq-job-sent`). The diary has no such state: WH-1042 is a plain "scheduled" block. Searching the generator for "No answer yet" finds it only on Today (`opening.mjs`), not in the diary.
- The diary shows status by colour alone unless "Show status symbols" is on (Workshop day 57). A purple job in the diary would read as a booking request.

*Why it matters:* Alex works from his diary. He can't see that WH-1042 is held up waiting for Maya, and if it turned purple he'd read it as a request. *Fix (touches Workshop day 12 and quote decisions 4–5, which disagree):*
1. A diary state of its own, "Waiting for the customer", with its own colour, a word on the block where there's room, and a legend entry; "No answer yet" after the reminder. One new state; ends the colour clash.
2. Keep purple for both, and name it "Pending or waiting for an answer" in the legend. No new colour; purple means two things.
3. No diary state: the job page and Today are enough (as drawn now). Nothing to draw; decision 4's "in the diary" isn't met.

Recommend 1.

**M4 — `dq-waiting-part` (phone), `job-waiting-parts` (desktop), `dq-record-answer`, Settings › Messages: Maya is promised messages that have no row in Messages.**
- Her page says "Waiting for a part — we'll update you" and "Expected ready: Sat 19 Sep, 16:00" (`dq-waiting-part`). The staff strip is written to her: "We've moved your job to Saturday at 16:00 in the diary and will confirm as soon as your bike is ready" (`waitingStripCompact`). Nothing says whether that text is sent.
- "Record their answer" says "Maya gets a text — the way Maya chose — with what was agreed" (`dq-record-answer`).
- Settings › Messages lists Quote to approve, Bike ready, Bike still waiting, six booking messages, and Service reminder and Review request (`setup.mjs` `msgListOpen`, `BOOKING_MSGS`). There is no row for a delay or new ready date, and none for "your answers" after a phone call.

*Why it matters:* Maya was told Thursday. If the delay text never goes, she turns up on Thursday for a bike that isn't ready. The shop also can't reword or switch off messages it can't see. *Fix, no choice:* add two rows under the job messages, both "Customer's choice": "New ready date" (sent when a job moves to Waiting for parts or its ready-by day moves, with the strip's wording as the draft and the quote's one-minute Undo) and "Your answers" (sent after "Record their answer"). Draw the waiting-for-parts strip with "Sent to Maya by text · [time]".

**M5 — `bk-expired`, `cp-expired` (phone): one link, two different expiry rules.**
- Drop off and approve the quote decision 1: "The link from booking keeps working the whole way", from booking to "Ready to collect".
- `bk-expired`: "Links stop working 30 days after the booked date." `cp-expired`: "It was for job WH-1042, which has been collected", live "[n] days after collection" (Collect and pay H1). I found the 30-day rule only in that board's wording and title, not in a decision line.
- A bike waiting for parts, or ready but not collected, more than 30 days after Thu 17 Sep would hit the first rule while still in the shop, and "Bike still waiting" would send a link that says it has expired.

*Why it matters:* the one link Maya has stops working while her bike is still with the shop. *Fix, no choice:* one rule for the one page: it lives until [n] days after collection; for a booking that never arrives (cancelled, declined, no-show), [n] days after the booked date. `bk-expired` keeps its wording for that second case.

**M6 — `bk-details`, `bk-request` (phone); `dq-quote-deposit`, `dq-answered-deposit`, `cp-summary-deposit`, `cp-pay`, `cp-paid`, `cp-receipt-email`: a deposit paid at booking can't be followed to the end.**
- Settings offers "A percentage of the price" (`bk-settings-deposits`). At booking the only price is the £65.00 service.
- Journey 4 carries it as "Deposit paid £[deposit]" and "Still to pay when you collect £[balance]". Journey 5 shows "Deposit paid £27.75" and "Pay £83.25 now" (`cp-summary-deposit`). £27.75 is 25% of £111.00, journey 11's till deposit taken after the quote (`collect.mjs` line 30), not anything Maya could have paid when booking a £65.00 service.
- After "Pay £83.25 now", `cp-pay` and `cp-paid` exist only for £111.00 ("Pay £111.00", "£111.00 paid"). The receipt has one "Paid by Card" row (`collect.mjs` `repairLines`); no version shows the deposit and the rest as two payments.
- In the other direction, `bk-request` (phone) reads "Deposit paid £[deposit]" and "your deposit comes back in full" after `bk-details`, which has no deposit step (`bookingLines` draws the deposit by default). A no-deposit "Request received" is not drawn.

*Why it matters:* "We take the deposit now, and it comes off the bill when you collect" (`bk-details-deposit`) is a money promise. The pay page, the paid page and the receipt are where Maya checks it was kept, and none of them is drawn with a deposit. *Fix:*
1. A percentage is worked out on the price known at booking and then fixed, as a sum. Draw `cp-pay` and `cp-paid` for the balance, and a receipt with "Deposit paid online · [date]" and "Paid by card" as two rows. Draw `bk-request` without a deposit.
2. Only fixed-sum deposits online (drop "A percentage"). Simplest to explain; less flexible for expensive jobs. Touches Book a repair decision 3 ("a fixed sum or a percentage").

Recommend 1.

**M7 — `ac-reminder-landing` (phone and desktop): coming back from her reminder, Maya is treated as a stranger.**
- The page knows her: "From your reminder: booking the next Standard service for your Trek Domane AL 3 · green · black mudguards", with service and bike already done.
- The same page still says "Booked with us before? Sign in to use your saved bikes and details" (checked in the rendered HTML: `whenFromReminderAt` uses the guest title), and step 4 is the guest form, so she types her name, mobile and email again.

*Why it matters:* the reminder is meant to make rebooking one tap (Account decision 2), and she ends up re-entering three things the shop already has. *Fix:*
1. The reminder's link also fills in step 4, shown part-hidden ("Maya P. · 07700 ••• 142 · Change"), with no sign-in, the way "Stop these" works with no sign-in. Fewest taps; anyone with the link sees a partly hidden name and number.
2. The link signs her in. The full signed-in step 4; a link that signs someone in is a bigger thing to lose.
3. Keep the guest form, but drop the "Booked with us before?" line on this page so it doesn't contradict itself. No taps saved.

Recommend 1.

**M8 — `cp-message-wording` (desktop), `cp-paid` (phone): "Bike still waiting" tells a customer who has paid online that she still has to pay.**
- After paying online Maya is told "When you come in, just give your name" (`cp-paid`).
- If she then doesn't come, "Bike still waiting" reads "…ready to collect from North Street Cycles. £111.00 to pay on collection." (`collect.mjs` `waitingDialog`). The wording has one version, built from "Bike ready".

*Why it matters:* a reminder that asks for money she has already paid prompts a worried call or a second payment at the counter. *Fix, no choice:* "[Amount to pay]" fills in as "Paid — nothing more to pay" for a paid job (one wording, two fill-ins), and the preview shows both.

**M9 — `wb-search-typing` (phone), `wb-home-lower`, `bk-service` (phone): a repair chosen on the website isn't in the booking's list, and booking doesn't open with it chosen.**
- The website offers "Fit & adjust brakes · Book a repair · £18.00" and "Brake service" in search (`wb-search-typing`, phone) and on the home page's repairs list (`browse.mjs` `SERVICES`).
- Booking's individual services are Brake service, Gear adjustment and Safety check (`book.mjs` `SINGLE`). "Fit & adjust brakes" is not among them; on the job page it is a labour line that "goes with" the pads.
- No board shows booking opened from a chosen repair; `bk-service` always opens with Standard service chosen.

*Why it matters:* the first hand-off in the story. Maya taps the repair she searched for and lands on a list without it. *Fix, no choice:* the website's repairs list and search use the same list as booking (the services marked bookable online, Book a repair decision 11), and a repair chosen on the website opens booking with it ticked and step 1 closed to its line with "Change". Draw that one board.

## Low

**L1 — Same thing, different names across the story.**
- Making a booking is "Book a repair" (header, home, account), "Book a service" (the bike card on `ac-account`) and "Book in here" (the reminder's wording). On the staff side "Book in" means receiving the bike (`job-overview`, Today). Fix: "Book a repair" everywhere a customer reads it, "Book in" only for staff.
- Ready is "Ready for collection" (staff status), "Ready" (diary legend, tracker), "ready to collect" (customer page and journey name) and "Bike ready" (message). Close enough to read, but worth one word list.
- The Standard service line's approval chip is "Booked" (`job-overview`), "Agreed" (`dq-job-answered`) and "Approved" (`job-mechanic`, `job-finished`).
- The shop's address is "24 North Street" in journeys 3 and 4 and "[Shop address]" in journey 5 and the receipt.
Fix: a short glossary of customer words and staff words; the script below asks walkers to check against it.

**L2 — `bk-details`, `cp-summary` (phone): the reminder tick is asked twice, unticked both times.** Maya can say yes at booking and is then shown the same unticked box under "Pay now", "the way you chose when you booked". If she already said yes, the box reads as if she hadn't. Fix: when she has said yes, show "You'll get a reminder when it's due · Change" instead of the box.

**L3 — `cp-receipt-email`, `cp-receipt-text`, `ac-receipt` (phone): one receipt, three versions.** The email and the text-link page carry the barcode (kept for showing at the counter, leftover screens later change) and say "Download receipt (PDF)" and "Email it to me"; the account's receipt pop-up has no barcode (`account.mjs` has none), says "Includes VAT" not "VAT at [rate]", and "Email me this receipt" and "Download receipt". The account one is what Maya would open months later. Only a purchase receipt is drawn from the account, not a repair's. Fix, no choice: the account opens the same receipt page as the text link.

**L4 — `bk-request` (phone), `cp-receipt-email`: the first Maya hears of "your account" is the receipt email.** She booked as a guest; nothing in booking says she now has an account she can sign into with her email. "See it in your account" is the first mention. I could not check whether a guest booking gives her an account that `cust-signin` will accept. Fix: one line on the request and confirmed pages, "See this booking any time: sign in with maya@example.test".

**L5 — `job-mechanic` (tablet), `cp-summary` (phone): two checks not done, and nobody says which.** `job-mechanic` lets "Mark ready for collection" go at 8 of 10. The ready page lists only the ticked checks and "8 of 10 checks done." The two not ticked are "Cables & housing" and "Bolts torqued" (`job-page.mjs` `CHECKLIST_10`). This touches Collect and pay M1 (Jack kept the count wording) and Workshop day 64 (mechanic sign-off, not yet designed). Jack's call: name the checks not done, with "not needed" or a reason.

**L6 — Accessibility, `till-receipt`, `dq-job-sent`, `cp-collected`: actions on a timer.** The till's receipt choice closes itself ("Next sale starts in 5 seconds"; it pauses only once Email or Text is pressed, leftover M1). The quote's Undo lasts a minute; "Collected" has Undo "for a few minutes". For Jo using a screen reader or a keyboard, five seconds to reach and choose a receipt is short. This touches Selling at the till 3. Fix: a per-person choice in Your settings › Accessibility, beside Reduce motion and Larger text: "Don't close things by themselves" (timers wait for a key press).

**L7 — Accessibility, every pop-up on the staff path (`job-overview` … `cp-collected`, `bk-staff-request`, `dq-quote-photo`): ✕ is a link, not a button.** Both the shared pop-up (`settings-frame.mjs` `popup`) and the diary's dialog header (`diary.mjs` `dialogHeader`) draw "Close" as `<a href>`. The leftover screens decisions parked this for the end-of-project audit; this walk is on that path. Fix, no choice: a button.

**L8 — `job-waiting-parts` (desktop): two dates on one screen.** The strip says "Moved to Sat 19 Sep · 16:00 in the diary" and Ready by reads "Sat 19 Sep", but "Diary time" still reads "Thu 17 Sep · 11:30–13:00". Jo on the phone to Maya reads both. Fix, no choice: Diary time follows the move.

**L9 — Edge cases at the joins that aren't drawn.** A job marked ready while its quote is still unanswered (what `cp-summary` shows, and whether "Mark ready" is allowed). A "Not sure what's wrong?" booking reaching a quote (its fixed deposit against an unknown price). The pay-online pages after a deposit (M6). Listed so they're not lost; no choice needed until they're drawn.

## The edge cases asked about

- **She doesn't approve the quote.** Drawn well: "Decline the extra work", the answered page "Alex will carry on with the service", a reminder, Today's "no answer to the quote yet" with her number and "Record their answer", and withdrawal. Gaps at the joins: no diary state while she hasn't answered (M3); "your answers" after a phone call has no message row (M4); a bike finished with the quote still open (L9).
- **The bike is ready but she doesn't come.** Drawn: "Bike still waiting" after [n] days, then a Today flag with "Contacted", and account deletion blocked while the bike is in. Gaps: the reminder asks a paid customer to pay (M8); the link can expire while the bike waits (M5); which press starts the clock (H2).
- **She paid a deposit at booking.** The thread breaks at the pay page, the paid page and the receipt, and its numbers come from a different deposit (M6).

## Accessibility across the whole story

- **Screen reader or keyboard, as Maya.** Each journey's audit has done the screen-level work: radio groups and "Step 3 of 4" on booking, the price in each quote tick's label, the tracker's current step, the pay card first in reading order. Across the story, the risks are at the joins: the "Bike ready" text may not come (H2); she is asked to type things again (M7, L2). The payment provider's card form is a placeholder, so its accessibility can't be checked.
- **Screen reader or keyboard, as Jo or Alex.** The diary shows status by colour unless "Show status symbols" is on; the missing "waiting for the customer" state (M3) matters most here. Timers (L6) and ✕ as a link (L7) are on the main path.
- **Low vision.** Staff have "Larger text" in Your settings. Customers depend on the browser's zoom. The phone boards are drawn in a fixed 390px frame (`app-map.mjs` `sitePhone`), so I could not test the story at 320px wide or 200% zoom: a render at 320px only crops the frame. The pinned bars on phone ("Your booking", the quote's total and button) are the first thing to check when it's built.

## Summary of choices for Jack

1. The spending limit (H1, options 1-3). Recommend 1: draw the within-limit path, and Maya picks "Call me first" in the example.
2. One press or two to mark the bike ready (H2, options 1-3). Recommend 1: one press with Undo.
3. Whether booking reuses the remembered shop (M1, options 1-3; touches Multiple sites 5 and M8). Recommend 1.
4. Arrival time and diary slot: the same or separate (M2, options 1-2). Recommend 1.
5. A diary state for "waiting for the customer" (M3, options 1-3; Workshop day 12 and quote decisions 4–5 disagree). Recommend 1.
6. What a percentage deposit is a percentage of (M6, options 1-2). Recommend 1.
7. How the reminder link fills in Maya's details (M7, options 1-3). Recommend 1.
8. Whether the ready page names the checks not done (L5; touches Collect and pay M1).

M4, M5, M8, M9 and L1-L4, L6-L9 have a single fix each and are listed so they are not lost.

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | bk-bike, bk-request, job pages, dq-job-quote, dq-quote | Maya's £200 limit is dropped; the within-limit path is undrawn | Yes (1-3) |
| H2 | job-mechanic, job-finished, dq-job-answered, Messages | "Ready" takes two presses with three names; unclear which tells Maya | Yes (1-3) |
| M1 | wb-home, ms-book-shop | "Which shop?" asked after the site remembered Bolton | Yes (1-3) |
| M2 | bk-page, job-overview, Today | Her 09:30 arrival isn't on staff screens; diary says 11:30 | Yes (1-2) |
| M3 | diary, dq-job-sent | No diary state for "waiting for Maya"; purple already means a request | Yes (1-3) |
| M4 | dq-waiting-part, job-waiting-parts, dq-record-answer, Messages | Promised delay and "your answers" messages have no row | No |
| M5 | bk-expired, cp-expired | One link, two expiry rules | No |
| M6 | bk-request, deposit boards, cp-pay, cp-paid, receipt | Deposit thread breaks; £27.75 is a different deposit | Yes (1-2) |
| M7 | ac-reminder-landing | Reminder knows her bike, then asks her details again | Yes (1-3) |
| M8 | cp-message-wording, cp-paid | "Bike still waiting" asks a paid customer to pay | No |
| M9 | wb-search-typing, bk-service | Website repair not in booking's list; no "repair chosen" board | No |
| L1 | various | Same thing, different names | No |
| L2 | bk-details, cp-summary | Reminder tick asked twice | No |
| L3 | receipt email, text page, ac-receipt | One receipt, three versions; account one has no barcode | No |
| L4 | bk-request, receipt email | "Your account" first mentioned on the receipt | No |
| L5 | job-mechanic, cp-summary | Two checks not done, unnamed | Yes (touches Collect M1) |
| L6 | till-receipt, dq-job-sent, cp-collected | Timers; no per-person "wait for me" | No |
| L7 | every staff pop-up | ✕ is a link, not a button | No |
| L8 | job-waiting-parts | Diary time not moved with the job | No |
| L9 | — | Edge cases at the joins not drawn | No |

## Verification (2 Oct 2026)

Rendered and looked at, with `peek.mjs` into the session scratchpad (none in the repo): at phone, `wb-home`, `wb-search-typing`, `ms-book-shop`, `bk-service`, `bk-bike`, `bk-when`, `bk-details`, `bk-request`, `bk-page`, `dq-in-shop`, `dq-quote`, `dq-answered`, `dq-waiting-part`, `cp-summary`, `cp-summary-deposit`, `cp-pay`, `cp-paid`, `cp-receipt-email`, `ac-reminder-landing`, `ac-account`, `ac-receipt`; at desktop, `diary`, `bk-staff-request`, `job-overview`, `job-book-in`, `dq-job-quote`, `dq-job-answered`, `job-finished`, `job-waiting-parts`, `cp-ready-unpaid`, `cp-till`, `cp-ready-paid`, `cp-collected`, `cp-message-wording`; at tablet, `diary-mechanic`, `job-mechanic`. Four phone boards were also rendered at 320px wide; the fixed frame only crops, so that test told me nothing (see Accessibility).

Read in source: `journeys.mjs` (journeys 1, 3, 4, 5, 7, 12); `book.mjs` in full; `quote.mjs` in full; `collect.mjs` in full; `account.mjs` lines 1-300; `browse.mjs` (repairs, search); `diary.mjs` (`ST`, `JOBS`, the request pop-ups, the job stages, `ARRIVALS`, the strips); `job-page.mjs` (the limit tag, `CHECKLIST_10`, `CUSTOMER_NOTE`); `setup.mjs` (`msgListOpen`, "Bike ready" wording); `opening.mjs` (Today's lines); `sites.mjs` (booking's shop step); `till.mjs` (job and deposit boards, by search); `settings-frame.mjs` (`remindBox`, `popup`). Checked in the rendered HTML: `ac-reminder-landing` carries the guest sign-in line and not "Signed in as"; `bk-request` has a deposit line while `bk-details` has no deposit step. Searched the generator for "limit", "No answer yet", "expire"/"30 days", "barcode" in `account.mjs`, and "24 North Street".

Decisions read: Find the shop (journey 1), Book a repair (3), Drop off and approve the quote (4), Collect and pay (5), Account and reminders (7), Workshop day (12), the leftover screens, and the UX walk-through decision; Multiple sites decision 5 and its audit line M8; Buy online decision 8 by search. Audits read in part: `book-ui-audit.md` (M2, the limit), `quote-ui-audit.md` (scope), `account-ui-audit.md` (by search), `leftover-ui-audit.md` (format and M1).

Not checked: a real screen reader, keyboard order or focus on any board; zoom and reflow (fixed frames); the payment provider's card form; whether a guest booking creates an account `cust-signin` accepts (L4); what "Book a service" on the account opens; tablet sizes for Maya and phone sizes for Jo, beyond the boards listed; journey 1's other entry points (Our shops, a shop's page) beyond `ms-book-shop`; any board for a job finished with its quote still open (L9) beyond searching the stage list in `diary.mjs`. Click counts are worked out from the boards, not timed with people.
