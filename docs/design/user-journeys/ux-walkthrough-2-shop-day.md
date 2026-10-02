# UX walk-through 2 — a shop day

Walked 2 Oct 2026 by the walk-through helper, as story 2 of `docs/decisions/2026-10-02-ux-walkthrough.md` (decision 4). This is not a UI audit. Each journey has had its own audit, screen by screen. This walk follows one day at North Street Cycles, Bolton, across five journeys, as the people living it, and looks for what breaks where one journey hands over to the next.

**The story.** Jo Taylor opens up: she checks in at Till B1 with her PIN and is asked about the float (journey B, journey 10). Jack Lewis looks at Today. Through the day Jo sells at the till: a sale with a discount, paid partly in cash and partly by card, with an emailed receipt, and a refund for something bought yesterday (journey 11, with the receipt screens of journey 5). An online order comes in from Maya Patel; Jo gets it ready and marks it ready, and Maya collects it (journey 2). After closing, Jack Lewis closes the day (journey 16). Walked as Jo (desktop till), Jack (desktop till and Today) and Maya (phone), and again as someone using a screen reader or only a keyboard, and as someone with low vision.

**How facts are handled.** Every finding names the screens (id and size) and the source line or decision it rests on. Bracketed placeholders (`[£ float]`, `[n]`, `[order number]`, `B1-[0000]`) are unknowns, not errors. Where I could not check something I say so; "I could not find it" is never written as "it is not there" unless I searched for it and say how.

**Not raised, on purpose.** Anything a journey's own UI audit already covers, unless the story makes it worse. The Soft sand look and the dashed "LOGO" box. Everything walk-through 1 already changed: the "Don't close things by themselves" setting (it covers the till's "Next sale starts in 5 seconds" and the "Mark ready" Undo), the ✕ that goes back to another board staying a link in the prototype, and Today's "11:30 appointment" line. The till's "Close the day" in the till bar and the pop-up ✕ on till boards are `<a>` links because the prototype jumps between boards; I have not counted that as "a button that is really a link". None of the recorded decisions is reopened; where a finding touches one, it says which.

**Verdict.** The till itself holds well through the day. Check-in is four digits, the float check is one press, a clean close is about six presses, the receipt choice fills in the customer's email, and a refund from a scanned receipt goes back to the card in about five. The breaks are at the joins between the money journeys and the online order. The biggest: when a day isn't closed (because the internet was down at closing, or nobody did it), yesterday's cash sits in the drawer and both the morning float check and the later "Close it" count it, so two days' cash figures come out wrong (H1). Money taken online has no place in the day's close (M5). Jo, working in till mode all day, is never told an online order has come in (M3), and searching for Maya at the till doesn't find her order (M4). A short float in the morning is gone from the evening's report (M2), and a mechanic can be the person asked about the float (M1).

## The story as walked

Clicks are taps or clicks on the main path; typing is listed separately. The main path is a one-shop business, blind counting on (the default the drawings assume, Cash-up 2), the card machine connected to the till (Selling at the till 6), Jo as Staff and Jack as Manager with "Can close the day".

1. **Jo switches the till on** — `till-checkin` (desktop): "Online · prices and stock updated [time]"; "Enter your PIN". **4 key presses**, no OK button (Signing in 4). The list under the pad already shows Alex Morgan "Checked in today" (M1).
2. **The float** — `op-float-check` (desktop): "Hello, Jo · Till B1 · first in today", "The drawer should have [£ float]", "Looks right". **1 click.** (Counting: "Count it", up to 12 boxes, "Done counting": 2 clicks plus typing; short: `op-float-short`, "Start the day", +1.)
3. **Jack looks at Today** — `op-today-short` (desktop): "Till B1's float was [£] short this morning", "Seen". **1 click.**
4. **A sale with a discount and a split payment** — `till-sale`, `till-discount`, `till-pay`, `till-pay-split`, `till-card`, `till-receipt` (desktop). Scan the pads, tap "Fit & adjust brakes"; "Add a discount", £4.00, a reason, Done; "Take payment", "Split", £20.00 cash, "Card · £54.00"; the customer taps their card; "Paid", "Email", "Send receipt" (`cp-receipt-address-customer`, Maya's address filled in). **About 11 clicks, 2 typed amounts** (+3 clicks and a search to add Maya to the sale). The discounted total never reaches the payment boards (M11).
5. **A refund for yesterday's sale** — `till-find` → `till-sale-detail` → `till-refund` (desktop). With the receipt: "Past sales", scan, Refund, a reason, "Refund £28.00 to the card". **About 5 clicks.** By name, as the receipt email suggests ("or just give your name in the shop"): about 8, through the Customers page (M10).
6. **An online order comes in** — nothing on the till says so (M3). Jo: "Unfold", "Online orders" (`on-orders`), picks the items, "Mark ready" (`on-orders-ready`: "Ready. The email goes to [Customer] in [n] seconds · Undo"). **3 clicks.**
7. **Maya** — `on-email-ready` (phone): "It's paid — just give your name or order number at the counter." **0 taps** (1 to open "See your order", `on-order-ready`).
8. **Maya collects** — Jo: "Unfold", "Online orders", "Hand over" → `on-hand-over` ("Click and collect · order [number]"), tick each item, "Mark collected". **About 6 clicks.** Searching "maya" at the till finds her job and her record but no order (M4).
9. **Jack closes the day** — PIN to take over the till, `eod-entry` "Close the day", `eod-count` (12 boxes), "Done counting — show the difference", "Keep this count and go on", `eod-banking` "Banking bagged — next step", card check matched by itself, `eod-finish` "Close the day and show the report", `eod-z` "Print". **4 key presses, 6 clicks, the count typed.** That matches the cash-up audit's "about 6 taps for a clean night".

**Totals on the main path.** Jo: about 26 clicks and 4 PIN presses across the day, plus the amounts and the count if she counts the float. Jack: about 7 clicks and 4 PIN presses, plus the cash count. Maya: 0–1 taps between paying online and collecting.

## High

**H1 — `eod-waiting` (desktop, phone), `till-checkin-offline`, `op-float-check`, `op-float-over`, `op-today-unclosed`, `op-close-yesterday` (desktop): when a day isn't closed, yesterday's cash is counted twice and neither count is right.**
- At closing, if Till B1 still has sales waiting to send, step 1 says "The day can't close until they've gone — they send by themselves when the internet is back", with only "Check again" (`cashup.mjs` `stepTills`, lines 55-56). Steps 3 and 4 show "To do"; nothing says whether Jack may count and bank now, or what to do with the cash overnight.
- Next morning the drawer holds the float plus yesterday's takings. The first person in still gets the usual check, "The drawer should have [£ float]" (`opening.mjs` line 33; Opening the shop 7). They count it, find it over, and are told "The till starts with what you counted" (`opening.mjs` line 58). The over float is not flagged when yesterday wasn't closed (Opening audit H1, decision 8). So today's till now expects yesterday's cash as well.
- Later Jack presses "Close it" on Today. It opens journey 16's count for "Wednesday 16 September" (`op-close-yesterday`, `opening.mjs` line 158), and he counts the same drawer, which by now also holds today's cash sales.
- Two smaller signs on the same board: the till bar on `eod-waiting` reads "Online" (desktop and phone, `cashup.mjs` line 28 calls `tillBar` with no offline state) while the step says "when the internet is back"; and step 5 reads "Card sales match the card machine · Matched" while some of the day's sales haven't reached Wheelhouse.
- Cash-up's background reads offline spec §8 as "a till can't be cleared while sales wait to send". The spec's own words are that the till "refuses sign-out, unregistering or clearing while sales are waiting", which is about clearing the browser's stored sales, not about counting the drawer (`docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`, §8).

*Why it matters:* the end-of-day count is the one place the shop checks its cash. Here Wednesday's count happens on Thursday afternoon with Thursday's money in the drawer, and Thursday starts out expecting Wednesday's takings. Both days show a cash difference that isn't real, and nobody can tell which money belongs to which day. It happens whenever the internet is down at closing, which is exactly when the shop most needs the paper trail. *Fix (touches Opening the shop 7 and its audit H1, Cash-up 4 and 6):*
1. Two parts. (a) On `eod-waiting`, counting and banking go ahead while sales wait; only the last step waits, and the day closes by itself once the sales have sent. Today then reads "Wednesday counted and banked · waiting for [n] sales to send". (b) For a day nobody counted, the morning check expects the float plus yesterday's cash ("The drawer should have [£ float] plus Wednesday's cash [£]"). That count becomes Wednesday's count, so "Close it" opens at banking, not at counting. The first customer is still never blocked and Staff do nothing new, they just count the drawer they already count.
2. "Close it" must be done before the float check, so the drawer is split first. The count stays clean, but this reopens Opening the shop 7: the first person in may be blocked by a job that isn't theirs.
3. Leave the screens and tell people to bag yesterday's cash separately: a line on `eod-waiting` and on the float check. Nothing new to build, but it relies on paper and memory.

Recommend 1.

## Medium

**M1 — `till-checkin` (desktop, tablet), `op-float-check`, `op-today` (desktop): the float check goes to "first in", but the example has a mechanic in first, and Today says he isn't in.**
- The PIN screen shows "Checked in today · Alex Morgan" (`signin.mjs` line 111). The float check then greets "Hello, Jo · Till B1 · first in today" (`opening.mjs` line 33). Today lists Alex as "Due in at [start time] · Mechanic · Not in yet" (`opening.mjs` line 84).
- The rule is that the first person to check in sees the float check (Opening the shop 2), and checking in at the till is how anyone gets onto Who's in (Opening the shop 5). Alex is a Mechanic who "can use the till" (`setup.mjs` line 186). So a mechanic who arrives first and checks in, as he has to in order to show as in, is the one asked about the drawer.

*Why it matters:* the float check is only worth something if the person answering it handles the cash. If Alex presses "Looks right" to get to his bench, Jo never sees the check, and Today says "float checked by Alex Morgan". The three boards also disagree about whether Alex is in. *Fix (touches Opening the shop 2 and 5):*
1. The float check goes to the first person to check in whose role takes payments (Staff, Manager, Owner). A mechanic checking in only records his time, even if he "can use the till". Then fix the example so Alex shows as "In" on Today. No new screen, one rule.
2. The float check comes when the drawer first opens (the first cash sale or "open the drawer"), for whoever is serving. Always the right person, but it lands in front of the first cash customer.
3. Keep "first in", and only fix the example. Nothing to build; a mechanic can still be asked.

Recommend 1.

**M2 — `op-float-short`, `op-today-seen`, `eod-count-result`, `eod-banking`, `eod-z` (desktop); `rp-day`: a short float in the morning is gone by the evening.**
- Jo is told "A manager sees this on Today. The till starts with what you counted" (`opening.mjs` line 58). Jack presses "Seen" and Tills reads "Float short · seen by Jack Lewis".
- In the evening the till's expected cash already starts from Jo's short count, so the evening count doesn't show the gap. Banking then says "Leave in the drawer [£ float]" and "Bank [£ counted − float]" (`cashup.mjs` lines 95-96), so the bank bag is short by the morning's amount.
- The end-of-day report's rows are Sales, Card, Cash, Gift cards…, Refunds, Voids, Discounts given, VAT, Cash difference and Banked (`cashup.mjs` line 116). The saved day in Reports has the same rows (`reports.mjs` `ZROWS`, line 199). Neither has the morning float or its difference. "The till expected [£ expected]" is one number with no breakdown.

*Why it matters:* Jack sees cash takings of one figure and a bank bag smaller than it, with nothing on the report to say why. Once "Seen" is pressed, the morning's difference lives nowhere a bookkeeper or a later manager would look. *Fix, no choice:* the report and the saved day gain "Float at the start · [£] ([£] short, counted by Jo Taylor at [time])". After counting (so blind counting stays blind, Cash-up 2) the result shows how the expected figure was made: float counted this morning, plus cash sales, minus cash refunds and paid-outs. Touches Cash-up 2 and 4.

**M3 — `till-sale`, `op-float-check`, `till-rail-open` (desktop), `op-today-staff`, `on-today`, `on-orders`: in till mode, Jo is never told an online order has come in.**
- Buy online 6 says "Today shows 'New online orders · [n]' and the sidebar item a count." The count is drawn only on the Online orders boards and `on-today`: `online.mjs` `countIn` (line 227) adds it to those pages alone. The till's folded rail and its unfolded panel (`app-map.mjs` `foldedRail`, lines 119-131) have no count: checked on `op-float-check` and `till-rail-open` at desktop.
- Today's "[n] new online orders" sits under Needs attention (`opening.mjs` line 117), which Staff don't see (Opening the shop 4; `op-today-staff` shows only Who's in and Workshop today).

*Why it matters:* the person who picks online orders spends the day on the till. Maya was told "We get it ready" and, with the shelf setting, "Ready the same day". Nothing on Jo's screen says there's an order to get ready. *Fix, no choice:* the same count pill on the rail's "Online orders" item, folded and unfolded, with "to get ready" for screen readers, as on the staff pages. Touches Buy online 6 and Opening the shop 4.

**M4 — `till-search` (desktop), `on-hand-over` (desktop), `on-email-ready`, `on-order-ready`, `on-confirmed` (phone): at the till, Maya's name finds her job but not her order.**
- Maya is told three times to "give your name or order number at the counter".
- At the till, typing "maya" shows Jobs ("WH-1042 · Maya Patel … Add to basket"), Customers and Products, and no orders (`till-search`, journey A). Buy online 10 says "search finds orders all the same". I found that only in that decision and in a comment (`online.mjs` line 226); no board draws an order in the till's search.
- The only drawn way to a hand-over is "Hand over" on the Online orders page, which means leaving the till. The hand-over pop-up is drawn over a basket holding someone else's £74.00 sale (`on-hand-over`, built on `till-collect`). Nothing says whether that sale is parked or stays.

*Why it matters:* Maya does what she was told and Jo, searching the way she does for everything else, finds the repair job (with "Add to basket") instead of the order. It's a slow hand-over at best, and at worst the wrong one. *Fix, no choice:* draw an "Orders" group in the till's search ("Order [order number] · Maya Patel · ready · Hand over"), and draw the hand-over over an empty basket, or say "The sale in progress is parked". Touches Buy online 9 (H5) and 10.

**M5 — `eod-card`, `eod-z` (desktop), `rp-takings`, `rp-day`; `on-confirmed` (phone), `on-cancel-refund`: money taken online has no place in the day's close.**
- An online order is paid at checkout through the payment provider, here part store credit and part card (`on-confirmed`). Repairs can be paid online too ("Pay now", journey 5).
- Closing the day is per till ("Day closed · Till B1"). Its card check compares "Card sales in Wheelhouse" with "Card machine's own total" (`cashup.mjs` lines 104-109). The report's rows have no online line (`cashup.mjs` line 116). Reports › Takings and cash-ups shows Card, Cash and "Other: Gift cards, store credit and customer accounts" (`reports.mjs` line 194), and the saved day uses the same rows (line 199). I searched `cashup.mjs` and `reports.mjs` for "online": no match in either about takings.
- So one of two things happens. If online card payments count as "Card", the card check can't match the machine on any day with an online sale. If they don't, they and their refunds (`on-cancel-refund`, "goes back the way Maya paid") appear in no day's takings.

*Why it matters:* Jack can't reconcile a day that had online sales, and the bookkeeper can't find them. *Fix (touches Cash-up 5–6, Reports and accounts 8, Buy online 5):*
1. An "Online" line of its own, per day, in Reports › Takings and cash-ups and the day's summary sent to Xero or QuickBooks, from the payment provider, not part of any till's close. The till's card check compares card-machine payments only, and the till's report ends "Online payments today: £[£] — see Reports". Clean split; one more line in two places.
2. An online order's money counts on the till that hands it over, on the day it's collected. Every penny is on a till, but money is booked on a different day from when it was taken, and an order cancelled before collection is on no till.
3. A day for the website, closed by itself each night, listed beside the tills. Neat in the report; a "till" nobody counts.

Recommend 1.

**M6 — `on-orders` (desktop), `till-sale` (desktop), `on-settings`: stock held for an online order isn't shown at the till.**
- "Stock is held for the customer as soon as they've paid" (`online.mjs` line 289; Buy online 2). Maya's order holds Shimano brake pads B05S-RX, shown to staff as "On the shelf".
- The till's example sale is two of the same pads (`till.mjs` line 106). The till warns only when stock says 0, "Stock says 0 — sold anyway" (Selling at the till 5). I searched `till.mjs` for "held" and "reserved": no match. The only "Held" tag I found is on a bike's frame number in Stock (`stock.mjs` line 171, Cycle to Work).

*Why it matters:* Jo can sell the pads Maya has paid for off the shelf to a walk-in. The order list still says "On the shelf", and the problem shows up when Jo goes to pick, or when Maya arrives. *Fix (touches Selling at the till 5 and Buy online 2):*
1. The basket line warns, as for out of stock, "[n] held for online orders — sold anyway", without blocking. The order's row then changes to "Not on the shelf any more" with Mark ready off. The same rule as decision 5.
2. Block selling held stock until the order is changed. The shelf can't oversell, but it reopens decision 5 (never block a sale).
3. Nothing at the till; the order list flags it when the count runs short. Nothing on the till, but it's found late.

Recommend 1.

**M7 — `till-needs-net`, `till-collect`, `on-orders` (desktop): offline mid-day, a refund leaves Jo with only "OK", and a hand-over isn't drawn.**
- "Refunds need the internet … A refund has to find the original sale, so it waits for the connection", with one button, "OK" (`till.mjs` lines 334-336). This follows the offline spec ("refunds and workshop payments can wait"). Nothing records that a customer was waiting for a refund, or tells Jo what to say to them.
- The same board lists what waits ("paying for a workshop job, changing products or prices, and reports"). It doesn't mention handing over an online order, and no offline hand-over is drawn. I didn't check whether the Online orders page works offline; the spec says offline covers selling and customer lookup.
- Whether the connected card machine can approve without the internet is still to check (Selling at the till 6); I didn't check it either.

*Why it matters:* Maya at the counter, offline, either for a refund or to collect a paid order, gets "come back later" with nothing written down. *Fix (touches the offline spec's "refunds can wait"; no decision reopened under option 1):*
1. "Note it for later" on `till-needs-net`: the sale (scanned or picked), the items and the customer go on a short list. The refund is done in one press when the till is back online, and Today shows "[n] refunds to finish". A paid order is handed over from what the till last downloaded, marked to send. Draw both.
2. Refund today's sales from this till while offline, since those sales are already on the till. Fewer waiting customers, but it reopens the spec's choice for some refunds.
3. As drawn, plus a line for the customer ("We'll refund it as soon as we're back online — we've kept your details"). Nothing to build; still nothing recorded.

Recommend 1.

**M8 — `on-email-ready` (phone), `on-settings-pay` (desktop), `on-today-uncollected`, `on-order-shop-cancelled`: "We'll keep it for you until [date]", but nothing sets that date.**
- The "ready" email ends "We'll keep it for you until [date]" (`online.mjs` line 220).
- Settings has "Remind the customer after [n] days" and "Show on Today after [n] days" (`online.mjs` line 296), then "Staff then contact the customer, or cancel it". No setting holds a "keep until". Buy online 7 makes cancelling a staff decision. So the [date] in the email has no source, and a manager may cancel before it, or long after it.
- The cancelled page tells Maya "We cancelled this order because it wasn't collected by [date], after we reminded you on [date]".

*Why it matters:* a date given to the customer in writing is a promise about her money. If it isn't one the shop set, the shop can break it without knowing. *Fix (touches Buy online 7):*
1. A third setting, "Keep orders for [n] days". The email's date comes from it, the Today "not collected" line appears on that date (replacing "Show on Today after"), and the cancelled page quotes it. Staff still decide; the date just tells them when.
2. Change the email to "We'll remind you after [n] days. Can't make it? Call us." No promised date and no new setting.
3. Drop the sentence. Simplest; Maya has no idea how long she has.

Recommend 1.

**M9 — `on-not-ready` (desktop), `on-messages`: "Sorry, not ready yet" points to a Messages row that doesn't exist.**
- "Not ready after all?" ticks "Send Maya 'Sorry, not ready yet' · The wording is in Settings › Messages" (`online.mjs` lines 274-276).
- The online order messages are Order confirmation, Order ready to collect, Order still waiting, Item we couldn't supply and Order cancelled (`setup.mjs` line 294). None is "not ready after all".

*Why it matters:* the same gap as walk-through 1 M4. A message the customer is sent that the shop can't see, reword or switch off. *Fix, no choice:* a sixth row, "Order not ready after all", "When an order marked ready is moved back"; the Messages summary count goes up by one.

**M10 — `till-find`, `till-search`, `till-refund` (desktop), `cs-sale`, `cp-receipt-email`: a refund for yesterday by name has no drawn way from the till.**
- The receipt email with a customer says "Keep this for returns — or just give your name in the shop" (`collect.mjs` line 186).
- Past sales lists only "Today on Till B1" and says "Older sale? Find the customer — their page shows every sale" (`till.mjs` line 287). That is plain text, not a link (Selling at the till 13). The till's search offers a customer only "Add to sale" (`till-search`).
- The customer's page does have the sale and "Refund at the till" (`customer.mjs` lines 216-218), but getting there means unfolding the rail, opening Customers, searching, opening the "Sales and refunds" section, then the sale: about 8 clicks in all, against about 5 with a scanned receipt.
- The refund pop-up is drawn only as "Maya Patel · today · paid by card" (`till.mjs` line 290); no board shows a refund for a sale from an earlier day.

*Why it matters:* the receipt told Maya her name is enough, and that path is the longest one at the counter. *Fix (touches Selling at the till 13):*
1. Make "Older sale? Find the customer" a button that opens a customer search, then that customer's sales in the same pop-up, ending on the till's refund. About 4 clicks. Keeps decision 13: older sales are still found through the customer, just without leaving the till.
2. A customer typed into Past sales' box lists their sales under it. The fewest clicks, but it widens Past sales' search, which decision 13 kept narrow.
3. As drawn; only draw the refund board for "yesterday". Nothing new; still about 8 clicks.

Recommend 1.

**M11 — `till-line`, `till-discount`, `till-pay`, `till-pay-split` (desktop, tablet), `cp-receipt-email-till`: a discount is never shown reaching the payment.**
- "Discount the whole sale" shows "Sale total £74.00 · 3 items … New total £70.00" (`till.mjs` line 181); a line discount shows "£50.40 for 2" (line 125).
- The basket has no discount row in any state (`till.mjs` `basket`, lines 80-104), and "Take payment", "Card" and "Split payment" all read £74.00 (`TOTAL`, line 190). The receipt for this kind of sale has "Discount · [reason] −£[amount]" (`collect.mjs` line 170).

*Why it matters:* the story's step "a discount, then a split payment" has no screen between the two. Jo (and a customer reading the basket) can't see that the discount took, and the drawn split starts from the full price. *Fix, no choice:* draw the basket with its discount row ("Discount · [reason] −£4.00", total £70.00), and the payment pop-ups from £70.00.

## Low

**L1 — Same thing, different names across the day.** Added to the script's word list.
- An online order is "Online orders" on the staff page and in the sidebar, and "Click and collect · order [number]" on the till's hand-over (`till.mjs` line 321).
- Handing it over is "Hand over" on Online orders (and on the bike's `cp-ready-paid`), then "Mark collected" on the till's hand-over.
- Jack Lewis is "Manager" on the till, Today, cash-up and the staff list (`setup.mjs`: "Jack Lewis · Manager · you … Only the owner can add or remove people"), and "Owner" on Online orders' settings and Messages (`online.mjs` `OWNER`). The script calls him the owner.
- The app map's Till mode says "Check in: Pick your name → enter PIN" (`app-map.mjs` line 334), against PIN alone (Signing in 4). It also says the sidebar "unfolds when you rest on it". There is an "Unfold" button, so keyboard users are fine, but the map describes only the hover.
- Cash-up's first step is "Every till has sent its sales" on a page that closes one till (Cash-up 6: each till closes on its own).
Fix, no choice: "Hand over" and "Online order" everywhere staff read them; one role for Jack in the examples; the map's check-in line reads "Enter your PIN"; step 1 reads "Till B1 has sent its sales".

**L2 — `op-today-waiting` (desktop): Today can't know the waiting count of a till that's offline, and "Try again" can't reach it.** "Till B1 has [n] sales waiting to send … Try again" (`opening.mjs` line 143). From Jack's Today the count can only be what the till said when it was last in touch; the offline spec's manager view shows "last sync and how many sales it is holding" (§8). Fix, no choice: "Till B1 last in touch at [time] · [n] sales waiting then", and "Check again" refreshes the line rather than promising to send.

**L3 — `op-float-short`, `op-float-over` (desktop): the difference pop-up has a ✕.** The first float check has none, so that "both ways out are answers" (Opening audit M1, `opening.mjs` line 31). The difference pop-up that follows has a ✕ beside "Count again" and "Start the day", and nothing says whether closing it records the difference. Fix, no choice: no ✕ here either.

**L4 — `till-collect`, `on-orders-ready` (desktop): where a ready order is kept isn't recorded.** The hand-over lists "from [shelf or storage spot]" (`till.mjs` line 322); "Mark ready" is one press and asks nothing (Buy online 6), so the spot has no drawn source. Jack's choice:
1. One "Online orders shelf" (or a few named spots) set once in Settings › Front desk › Online orders and shown on every hand-over. No extra press.
2. A row of spot pills on "Mark ready" (one extra press; remembers the last one).

Recommend 1.

**L5 — `eod-entry`, `till-park` (desktop): closing the day doesn't mention parked sales or a sale in the basket.** "Close the day" is drawn with a £74.00 sale in the basket. Parked sales are "Kept on this till until someone resumes or clears them" (`till.mjs` line 274), and no cash-up step mentions them. Fix, no choice: step 2 (Needs attention) lists any parked sale or sale in progress with Resume or Clear.

**L6 — Edge cases at the joins that aren't drawn.** Banking when the cash counted is less than the float. A cash refund bigger than the cash in the drawer. A refund at the till for an online order (refunds go back the way they were paid, and an online card payment isn't on the card machine). An online order collected by someone else on Maya's behalf. Listed so they're not lost; no choice needed until they're drawn.

## The edge cases asked about

- **The till is offline mid-day.** Drawn well: selling carries on, the routine grey notice and the four-hour amber one, receipts that "send when back online" (`cp-receipt-address-offline`), and "Can't sign out while sales are waiting". Gaps at the joins: a refund or a hand-over leaves Jo with "OK" and nothing recorded (M7); Today's count and "Try again" (L2); at closing it becomes H1.
- **The float was short in the morning.** Drawn: the count, "The float is short", Today's line, "Seen", "Float short · seen by Jack Lewis". Gaps: the shortfall is gone from the evening's report and the bank bag (M2); the difference pop-up's ✕ (L3); who answers the check (M1).
- **An online order isn't collected.** Drawn: the "Order still waiting" message, the "Not collected · [n] days" flag, Today's line with the phone number, "Contacted" and "Open", "Cancel and refund" with a reason, and the customer's cancelled page. Gaps: the "keep it until [date]" promise has no source (M8); held stock can be sold at the till meanwhile (M6).
- **A refund for a sale from yesterday.** With the receipt: the barcode scan works and it's short. By name, as the email suggests: about 8 clicks and a trip out of the till (M10). Offline: it waits with nothing written down (M7). The refund board is only drawn for "today" (M10).
- **Cash-up with sales still waiting to send.** The day can't close, nothing says what to do with the cash, and the next morning counts it twice (H1).

## Accessibility across the whole day

- **Screen reader or keyboard, as Jo.** The screen-level work is done: the PIN dots announce "2 of 4 digits entered", a wrong PIN is an alert, the count boxes are labelled "Number of £20" and so on, Today's sections are labelled lists, the till's offline notice is a status, and the rail has an "Unfold" button as well as unfolding on hover. Across the day the risks are at the joins. Jo isn't told an order has come in (M3), so a screen-reader user has no count to hear either. The "Mark ready" email waits "[n] seconds" with Undo, and the receipt choice counts down: both are covered by walk-through 1's "Don't close things by themselves", which should be checked to include the "Mark ready" Undo when built. Not checked: whether the PIN can be typed on a keyboard's number keys (the pad is drawn as buttons, with no input box), and where focus goes when a cash-up step opens the next one by itself.
- **Screen reader or keyboard, as Jack.** Cash-up's steps are buttons with `aria-expanded` and a status in words ("To do", "Counted", "Matched", "[n] sales waiting"), not colour alone. Today's warnings carry an icon and words. Not checked: keyboard order through the twelve count boxes and the total that "can be typed over".
- **Screen reader, as Maya.** The order page's steps are a list with the current step marked, and the ready email is plain text with one button. Nothing new found at the joins beyond M4 (what she was told to say doesn't find her order).
- **Low vision.** Staff have "Larger text" in Your settings. The till is drawn at fixed sizes (1280, 1180 and 390 wide), so I couldn't test zoom or reflow. The till bar's status pill ("Online", "Offline · [n] waiting to send") is the smallest text on the till and the main clue to H1 and M7; it's the first thing to check at 200% when built.

## Summary of choices for Jack

1. What happens to the cash when a day isn't closed (H1, options 1-3; touches Opening the shop 7, Cash-up 4 and 6). Recommend 1: count and bank at night even while sales wait; a day nobody counted is counted by the morning check.
2. Who is asked about the float (M1, options 1-3; touches Opening the shop 2 and 5). Recommend 1: the first person in whose role takes payments.
3. Where online money goes in the day's takings (M5, options 1-3). Recommend 1: an "Online" line of its own, outside the tills' close.
4. Selling stock held for an online order (M6, options 1-3; touches Selling at the till 5). Recommend 1: warn, don't block.
5. Refunds and hand-overs while offline (M7, options 1-3). Recommend 1: "Note it for later", and hand over from the till's own copy.
6. How long an uncollected order is kept (M8, options 1-3; touches Buy online 7). Recommend 1: a "Keep orders for [n] days" setting.
7. Reaching an older sale from the till (M10, options 1-3; touches Selling at the till 13). Recommend 1: the hint becomes a customer search inside Past sales.
8. Where ready orders are kept (L4, options 1-2). Recommend 1: one named shelf set once.

M2, M3, M4, M9, M11 and L1-L3, L5, L6 have a single fix each and are listed so they are not lost.

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | eod-waiting, op-float-check, op-today-unclosed, op-close-yesterday | An unclosed day's cash is counted twice; both days come out wrong | Yes (1-3) |
| M1 | till-checkin, op-float-check, op-today | Float check goes to "first in", which can be a mechanic; boards disagree about Alex | Yes (1-3) |
| M2 | op-float-short, eod-banking, eod-z, rp-day | The morning's short float is gone from the evening's report | No |
| M3 | till rail, op-today-staff, on-orders | In till mode Jo isn't told an online order came in | No |
| M4 | till-search, on-hand-over, on-email-ready | Maya's name finds her job, not her order; hand-over drawn over another sale | No |
| M5 | eod-card, eod-z, rp-takings, on-confirmed | Online payments have no place in the day's close | Yes (1-3) |
| M6 | on-orders, till-sale | Stock held for an online order can be sold at the till unseen | Yes (1-3) |
| M7 | till-needs-net, till-collect | Offline refund or hand-over: "OK" and nothing recorded | Yes (1-3) |
| M8 | on-email-ready, on-settings-pay | "We'll keep it until [date]" has no setting behind it | Yes (1-3) |
| M9 | on-not-ready, on-messages | "Sorry, not ready yet" has no Messages row | No |
| M10 | till-find, till-search, cs-sale, receipt email | A refund by name for yesterday: about 8 clicks out of the till | Yes (1-3) |
| M11 | till-discount, till-pay, till-pay-split | A discount never reaches the payment boards | No |
| L1 | various | Same thing, different names; Jack's role; app map's check-in | No |
| L2 | op-today-waiting | Today's waiting count and "Try again" for a till that's offline | No |
| L3 | op-float-short, op-float-over | The difference pop-up has a ✕ | No |
| L4 | till-collect, on-orders-ready | Where a ready order is kept isn't recorded | Yes (1-2) |
| L5 | eod-entry, till-park | Closing the day ignores parked sales | No |
| L6 | — | Edge cases at the joins not drawn | No |

## Verification (2 Oct 2026)

Rendered and looked at, with `peek.mjs` into the session scratchpad (none in the repo). At desktop: `till-checkin`, `till-checkin-offline`, `op-float-check`, `op-float-short`, `op-today-short`, `op-today-waiting`, `op-today-unclosed`, `op-close-yesterday`, `op-today-staff`, `till-rail`, `till-rail-open`, `till-search`, `till-discount`, `till-pay`, `till-pay-split`, `till-receipt`, `till-find`, `till-sale-detail`, `till-refund`, `till-needs-net`, `till-offline`, `cp-receipt-email-till`, `cp-receipt-address-offline`, `on-orders`, `on-orders-ready`, `on-order-staff-ready`, `on-hand-over`, `on-today`, `on-today-uncollected`, `eod-entry`, `eod-waiting`, `eod-count-result`, `eod-banking`, `eod-card`, `eod-z`. At tablet: `till-checkin`, `till-sale`. At phone: `op-float-check`, `eod-waiting`, `on-email-ready`, `on-order-ready`, `on-confirmed`. Not every rendered board was opened as an image; the findings cite only the ones I looked at or read in source.

Read in source: `journeys.mjs` (journeys A, B, 2, 5, 10, 11, 16); `opening.mjs`, `signin.mjs`, `till.mjs` and `cashup.mjs` in full; `online.mjs` (header, order pages, emails, staff side, settings); `collect.mjs` (the receipt section); `app-map.mjs` (`tillBar`, `foldedRail`, `till-search`, the Till mode map box); `setup.mjs` (staff and roles, `ONLINE_MSGS`); `reports.mjs` (Takings and cash-ups, `ZROWS`); `customer.mjs` (sales and `cs-sale`, by search); `stock.mjs` (the "Held" frame row, by search). Searched the generator for "held"/"reserved", "online" in `reports.mjs` and `cashup.mjs`, "storage"/"spot", "keep it for you", "orders" in search, and "check in" in `app-map.mjs`. Read the offline spec's §8 and its "refunds can wait" line.

Decisions read: Opening the shop (journey 10), Signing in (B), Selling at the till (11), Buy online (2), End-of-day cash-up (16), Collect and pay (5, the receipt and later changes), the leftover screens (receipts and till start-up), and the UX walk-through decision. Audits read in part: `signin-ui-audit.md` (H1), `online-ui-audit.md` (H5, M11), and walk-through 1's report for format.

Not checked: a real screen reader, keyboard order or focus on any board; zoom and reflow (fixed frames); whether the PIN can be typed on a keyboard; whether the Online orders page works offline; whether the card machine can approve offline (Selling at the till 6 says this is still to check); what the basket's customer link opens; the payment provider's reports; journey 19's two-shop versions of any of this. Click counts are worked out from the boards, not timed with people.
