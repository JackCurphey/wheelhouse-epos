# UX walk-through 3 — stock

Walked 2 Oct 2026 by the walk-through helper, as story 3 of `docs/decisions/2026-10-02-ux-walkthrough.md` (decision 6: walk every remaining story). This is not a UI audit. Each journey has had its own audit, screen by screen. This walk follows one product, the Shimano brake pads B05S-RX that repair WH-1042 waits for, from the order to the reports, across five journeys, as the people handling it, and looks for what breaks where one journey hands over to the next.

**The story.** WH-1042 (Maya Patel's Trek Domane AL 3) is "Waiting for parts": Maya has been texted that her job has moved to Saturday 19 September at 16:00 (journey 12). Jack Lewis orders the pads (journey 13). They arrive; Jo Taylor scans the box in, books it in, prints labels and deals with a problem item (13). The job hears the pads have arrived (12 and 13). Pads are sold at the till (11). Stock is counted in a stock take, and a difference is applied or adjusted (14). Jack reads margin and stock value in Reports (17). Walked as Jack (desktop), Jo (desktop, and a phone for counting), Alex Morgan (the mechanic, tablet), and again as someone using a screen reader or only a keyboard, and as someone with low vision.

**How facts are handled.** Every finding names the screens (id and size) and the source line or decision it rests on. Bracketed placeholders (`[n]`, `£[cost]`, `[Supplier]`, `[Shelf name]`) are unknowns, not errors. Where I could not check something I say so.

**Not raised, on purpose.** Anything a journey's own UI audit already covers, unless the story makes it worse. The supplier screens (`po-suppliers`, `po-feed`, `po-send`), which wait for a later release. Everything walk-throughs 1 and 2 changed, including "Don't close things by themselves", the till's warning for stock held for online orders (`till-held`) and the one shelf for ready orders. Jack's role: decision 6 makes him the Owner in every example. While I worked, the shared `MANAGER` example in `settings-frame.mjs` changed from "Manager" to "Owner" (my first receiving renders say "Jack Lewis · Manager", later ones "Owner"), and `opening.mjs` has uncommitted changes. I have taken that as the other helper's work in progress, not a finding. None of the recorded decisions is reopened; where a finding touches one, it says which.

**Verdict.** Each journey's own screens are sound. Scanning a box in is quick, the job is flagged on three screens, and a stock take's blind count, recount and "sold during the count, allowed for" are well drawn. The breaks are at the joins where the stock changes hands. The biggest: the pads that arrive for WH-1042 aren't kept for it. Jo can sell them at the till with no warning while the job page still says "Arrived" (H1). A stock take compares what's on one shelf with stock that's kept somewhere else (held for an online order, waiting on a job) or that moved during the count other than by a sale. Applying the count then writes off stock that's really there (H2). Earlier in the story, nothing carries a job's need for the pads to the person who orders (M1). Partway through, Jo as Staff can't book in a delivery with a new product in it (M3). At the end, Jack's margin and stock value use costs that an invoice has already shown are wrong (M6), and stock written off doesn't appear in any report (M7).

## The story as walked

Clicks are taps or clicks on the main path; scans and typing are listed separately. The main path is a one-shop business, Jo as Staff without "Can order stock", Jack as Owner, the invoice check on.

1. **Jack sees the job needs pads.** `job-waiting-parts` (desktop): the pads line reads "On order"; the strip says "The brake pads are arriving later than expected. We've moved your job to Saturday at 16:00 … Sent to Maya by text". No board takes him from here to an order (M1).
2. **Jack orders.** `rs-hub` → "+ New order" → `rs-order`: supplier pill (last used, already picked), scan or search the pads, "Mark as ordered". **About 3 clicks, plus typing.** The line reads "B05S-RX · for job WH-1042"; how it got "for job" isn't drawn (M1).
3. **The box arrives; Jo scans it in.** `rs-hub-staff` → "Receive a delivery" → `rs-receive` (desktop, phone): each scan adds one; the pads line says "Job WH-1042 is waiting for 1". One item is damaged: "Problem?", "Mark as damaged" (`rs-problem`). "Book in [n] items". **About 5 clicks, plus a scan per item.** The board she lands on next is drawn only for someone who can order stock (M4). A new barcode would stop her (M3).
4. **Labels.** "Print labels" → `rs-labels`: the pads have the maker's barcode, so 0 labels; "Print [n] labels". **2 clicks.**
5. **The job hears.** `rs-job-arrived` (desktop, tablet): "Part arrived · Shimano brake pads B05S-RX booked in"; the line's In stock says "Arrived"; "Carry on with the work". `rs-diary-arrived`, `rs-overview-arrived`: a "Part arrived" badge. **0 clicks for Jo; 2 for Alex** (open the job, carry on). The three boards disagree about where the job is (M5), and nothing keeps the pads for it (H1).
6. **Jack checks the invoice.** `rs-delivery` → "Add the invoice" → `rs-invoice-diff`: "The invoice is £[z] more than you booked in" → "Accept the difference" (`rs-invoice-accepted`). **About 4 clicks, plus the number and total.** The pads' cost doesn't change (M6).
7. **Pads sold at the till.** `till-sale` (desktop, tablet): scan, "Take payment", "Card", receipt. **About 3–4 clicks.** No warning that one of them is the job's (H1).
8. **Stock take.** Jack: Stock take → "Start a count" → area → "Start the count" (`tk-start`), **3 clicks and typing**. Jo on her phone: "Join", scan the shelf, "I've finished my part" (`tk-count`), **3 clicks, plus scans**. Jack: "Check it" → `tk-diff` "[n] under · £[value]" → "Apply to [n] products" → `tk-applied`. **2 clicks.** The expected figure takes no account of pads kept elsewhere (H2).
9. **An adjustment.** Stock → the pads → "Adjust stock" → change, a reason, "Adjust" (`st-adjust`). **About 5 clicks.**
10. **Jack reads Reports.** Reports → "Margin and stock value" (`rp-margin`). **2 clicks.** No line for stock written off (M7); stock value is split by the till's groups (M10).

**Totals on the main path.** Jack: about 16 clicks across ordering, the invoice, the count and Reports, plus typing. Jo: about 10 clicks, plus a scan per item received and counted. Alex: 2.

## High

**H1 — `rs-booked`, `rs-job-arrived` (desktop, tablet), `till-sale`, `till-held` (desktop), `st-product` (desktop): the pads that arrive for WH-1042 aren't kept for it, so the till can sell them with no warning while the job still says "Arrived".**
- Booking in adds the pads to stock and flags the job (Receiving 2 and 3). The booked-in board says "was waiting for Shimano brake pads — flagged on the job, the diary and the Overview" (`receiving.mjs` line 138). The job's line then reads "Arrived" in its In stock column (`diary.mjs` line 2831).
- Nothing holds them. The till warns about held stock only for online orders: "[n] held for online orders — sold anyway" (`till.mjs` line 122, walk-through 2 M6). I searched `till.mjs` for "held" and "job": the job only appears as a sale to pay for. The till's example sale is two of these pads (`till.mjs` line 111).
- The pads' history shows the job taking one only as "Used on job WH-1042 · −1 · Alex Morgan" (`stock.mjs` line 159). Between booking in and that moment, the job's pad is ordinary shelf stock.
- Online orders do hold stock: "Stock is held for the customer as soon as they've paid" (`online.mjs` line 303).

*Why it matters:* this is the one hand-over the whole story exists for. Maya was told in writing her bike would be done on Saturday at 16:00. If a walk-in buys the last pads on Friday, Alex opens a job that says "Part arrived … Arrived" with "Carry on with the work", and finds nothing on the shelf. Nobody is told until then. *Fix (touches Selling at the till 5, Receiving 2, walk-through 2 M6):*
1. Booking in holds what the job is waiting for: "1 held for job WH-1042" on the product's page (beside "In stock"), and on `rs-booked` ("1 held for WH-1042 — put it with the bike on Hook 3"). The hold lasts until the pad is used on the job, or the job is cancelled. The till warns as it does for online orders, "1 held for job WH-1042 — sold anyway", and never blocks (decision 5). If it is sold anyway, the job's line changes from "Arrived" to "Sold at the till — reorder" and the job's strip turns amber. One rule for every kind of hold.
2. Booking in takes the pad out of stock and puts it straight on the job ("Booked in for job WH-1042"). It can't be sold by mistake, but it vanishes from stock and the till, and a cancelled job needs it put back by hand.
3. Leave it, and tell staff to put a job's parts with the bike. Nothing to build; it depends on memory, and the screens still say "Arrived".

Recommend 1.

**H2 — `tk-start`, `tk-count` (desktop, phone), `tk-diff`, `tk-applied` (desktop); `on-settings-keep`, `rs-booked`: a stock take expects stock that isn't on the shelf being counted, and applying it writes that stock off.**
- An area count compares only what was scanned: "Only what's scanned in this area is compared" (`stock.mjs` line 232). For a scanned product, the drawings give one "Expected" figure (`tk-diff`, line 243). Stock belongs to a shop, not an area (stock audit M16: "No product belongs to an area in this design").
- Movements during the count are allowed for only when they are sales: "Sales during the count are allowed for" (`tk-start`), "[n] sold during the count, allowed for" (`tk-diff`); Stock control 5: "Sales carry on and are allowed for". Nothing says the same for stock booked in, used on a job, sent to another shop or adjusted while the count is open.
- Pads can be in stock and not on the wall: held for Maya's paid online order and waiting "at [Shelf name]" (`online.mjs` line 316, walk-through 2 L4), or set aside for WH-1042 (H1). A delivery booked in after Jo scanned the wall adds to "Expected" but not to her count.
- `tk-diff` then shows "[n] under · £[value]", and "Apply to [n] products" corrects stock to what was counted (`tk-applied`: "stock corrected").

*Why it matters:* the count is the shop's check that stock is right, and here it makes stock wrong, in the direction that costs money. The held pads are written off. Maya's order then shows them as gone, the next sale goes below zero, and Today asks for another count. *Fix (touches Stock control 5 and its audit H1, Buy online 2):*
1. `tk-diff` allows for everything, not just sales. The "Expected" figure for a product leaves out stock held for online orders or jobs, and says so under its name ("[n] held: order [order number] at [Shelf name] · job WH-1042"). Stock booked in, used on a job, sent or adjusted during the count is allowed for, with a line like the sales one ("[n] booked in during the count, allowed for"). Counting stays blind; nothing new for the counters.
2. Area and category counts only report differences; only a whole-shop count can apply them. Nothing is written off by mistake, but it loses decision 5's "a section at a time".
3. Leave it; the manager recounts anything under. Nothing to build; write-offs depend on someone noticing.

Recommend 1.

## Medium

**M1 — `job-waiting-parts` (desktop), `rs-hub`, `rs-order`, `rs-restock` (desktop), `on-settings-order-in`: what a job is waiting for never reaches the person who orders.**
- The job's line says "On order" (`diary.mjs` line 2225). On `job-waiting-parts` the actions are Add item, Scan barcode, Print and "Mark ready for collection"; none leads to ordering. I didn't check the line's own menu.
- The order line reads "B05S-RX · for job WH-1042" (`receiving.mjs` line 212), but no board shows how a line gets "for job". Deliveries and orders lists To return, the restock list (running low, selling fast), orders and deliveries (`receiving.mjs` lines 65-86); none lists a job's needs. I searched the generator for "for job", "order it" and "to order": only the order boards and Cycle to Work match.
- The same gap for online orders: Buy online's setting says an order for something ordered in "arrives as 'To order from [supplier]'" (`online.mjs` line 301). I found that phrase only in the setting.

*Why it matters:* the job promised Maya a date that depends on this order. Jack is the one with "Can order stock", and nothing on his screens says a job needs pads. That holds whether he orders in Wheelhouse or, as decision 2 fully supports, on the supplier's website. *Fix (touches Receiving 2 and Buy online 2):*
1. The restock list gets a third pill, "For customers", beside Running low and Selling fast. It lists every job line "On order" and every online item to order in, with who it's for ("for job WH-1042 · Maya Patel · promised Sat 19 Sep"), grouped by supplier like the rest. "Add to an order" sets the order line's "for job"; the basket download works as now. Today's restock line counts these too. It reuses a list Jack already uses for ordering.
2. A "Parts to order" section of its own at the top of Deliveries and orders. Clearer, but one more list.
3. "Order it" on the job's line. Direct, but the mechanic who marks it usually can't order, so it still needs a hand-over.

Recommend 1.

**M2 — `rs-problem`, `rs-booked`, `rs-order-ordered` (desktop), `rs-job-arrived`: when the job's pads are missing, damaged, or dropped from the order, the job hears nothing.**
- "Problem?" can mark the job's pads Damaged, Wrong item or Missing. Damaged and wrong items "aren't added to stock"; "Missing items stay 'to come' on the order", and Missing is offered "only when there's an order" (`receiving.mjs` lines 194-201).
- The only drawn result for the job is good news, "flagged on the job" (`rs-booked`). No board shows what WH-1042 says when its pads came damaged or didn't come.
- "Close the order" says only "Closing the order drops anything still to come" (`receiving.mjs` line 223), even for a line marked "for job WH-1042".
- A shop that orders on the supplier's website has no order, so it can't mark the job's pads Missing at all.

*Why it matters:* a partial delivery is when the job most needs to hear, so someone can chase the supplier or text Maya before Saturday. *Fix, no choice:* the booked-in board says what happened to the job ("Job WH-1042 · still waiting — the pads were damaged" with "Open the job"), and the job's strip says "Not in the delivery on [date] · still on order". "Close the order" asks first when a "for job" line is still to come: "Shimano brake pads for job WH-1042 are still to come. The job stays waiting for parts — reorder them, or tell Maya." "Missing" is offered on a line a job is waiting for even without an order.

**M3 — `rs-receive`, `rs-add-product`, `rs-book-blocked` (desktop, phone): Jo can't book in a delivery with a new product in it.**
- Everyone can receive (Receiving 4). An unknown barcode opens "Add this product", with Cost, Price and Low-stock level (`receiving.mjs` lines 118-124), and Book in stops until it's added or removed: "Add [barcode] first, or remove it — then book in" (line 110).
- Staff "can't change prices, edit or add products" (Stock control 11; Staff's stock list has no "+ Add a product", `stock.mjs` line 89). Every receiving board is drawn for someone who can order stock; no board shows Jo meeting an unknown barcode.

*Why it matters:* new products arrive in ordinary deliveries. As drawn, Jo either removes the item from the delivery (it's then in the stockroom but not in stock) or waits for Jack. *Fix (touches Receiving 3 and 4, Stock control 11; neither reopened):*
1. For Staff, the unknown line offers "Leave it for [Owner or manager]". The rest books in; the item stays on the delivery as "1 product to add". It shows on Deliveries and orders and on Today for people who can add products. Adding it counts it into stock and offers its label.
2. Staff add it with name, category and details but no cost or price; a manager fills those later. Quicker, but it loosens decision 11, and the product can be sold without a price.

Recommend 1.

**M4 — `rs-booked`, `rs-labels` (desktop): the screen Jo lands on after "Book in" is drawn only for someone who can order stock.** `rs-booked` is drawn for the shop's owner (`stockPage` defaults to `MANAGER`, `receiving.mjs` line 46). It offers "Add the invoice" and a "See the list" link to "To return to [Supplier]". Staff see neither (Receiving 9 and 10; the To return list is hidden for Staff, line 66). *Why it matters:* the last screen of Jo's job offers two things she can't do, and doesn't tell her who will. *Fix, no choice:* draw `rs-booked` as Staff. "Print labels" comes first, then the job line, then "1 set aside as damaged — [Owner] will return it" with no link, and no invoice button. The delivery shows "Waiting for invoice" to people who can order, as now.

**M5 — `rs-job-arrived`, `rs-diary-arrived`, `rs-overview-arrived` (desktop, tablet): the three "waiting job" boards put WH-1042 in three places.**
- The job: "Waiting for parts", "Kept on Hook 3", "Bike is here", diary time "Sat 19 Sep · 16:00–17:30" (`diary.mjs` line 2842).
- The diary: the Trek Domane block is on Thursday at 11:30 in the Scheduled colour, with "Part arrived"; Saturday 16:00 is empty (rendered, desktop and tablet).
- The Overview: under Arrivals, "Standard service · 11:30 appointment · Part arrived", custody "Expected", with "Book in" (rendered, desktop).
- The receiving audit's build note says these boards reused journey 12's approved example week, "whose example week has WH-1042 scheduled, not waiting".

*Why it matters:* these three boards exist to show Alex the hand-over, and they disagree about whether the bike is even in the shop. A reader of the canvas, or a builder working from it, can't tell which is right. *Fix, no choice:* draw the two boards with WH-1042 where the job page has it: a block on Saturday at 16:00 in the "Waiting for parts" colour with "Part arrived", and on the Overview a row among the jobs in the workshop, not under Arrivals. I didn't check which Overview tab lists jobs waiting for parts. Touches Receiving 10 (it keeps journey 12's approved boards unchanged; only these two journey 13 boards move).

**M6 — `rs-invoice-diff`, `rs-invoice-accepted`, `rs-order` (desktop), `st-product`, `rp-margin`: a wrong price on the invoice never reaches the product's cost.**
- The invoice check compares totals only (Receiving 6). "Accept the difference" records "Difference of £[z] accepted" and nothing else (`receiving.mjs` lines 164-166).
- The product's cost (`st-product`, "Cost £[cost]") is what Reports uses for "What it cost you" and "Stock value, at what it cost you" (`reports.mjs` lines 234-237), and what the stock list's margin column uses.

*Why it matters:* if the supplier has put the pads up, Jack accepts the higher invoice, and every margin and stock value figure from then on still uses the old cost. The one screen where the shop learns its cost went up doesn't record it. *Fix (touches Receiving 6; the check stays totals only):*
1. "Accept the difference" asks one optional question: "Did a cost go up?" Pick a product from the delivery and type its new cost. It changes from now on, and the product's history says "Cost changed · invoice [number]". One extra step only when it applies.
2. A "Change cost" link on each line of a booked-in delivery, for people who can order stock. Same effect, offered all the time, so easier to skip.
3. Leave costs, and add a line to the accepted state: "Costs on products are unchanged — change them on each product's page". Nothing new; it relies on Jack doing it.

Recommend 1.

**M7 — `tk-diff`, `tk-hub`, `st-adjust`, `st-today-adjust` (desktop), `rp-margin`, `rp-home`: stock written off has no place in Reports.** A count shows "£[value] under in all" (`stock.mjs` line 241); a finished count "£[value] under" (line 229); adjustments are Damaged, Lost or stolen, Used in the workshop and so on (line 205). Margin and stock value has sales, cost and margin, and stock value today (`reports.mjs` lines 233-237). I searched `reports.mjs` for "adjust", "count", "written", "damaged" and "lost": no match. The Activity log lists each "Stock adjusted" event (`oversight.mjs` line 59), but gives no value or total. `tk-diff` doesn't say whether "£[value]" is at cost or at price; the adjustment setting says "At cost" (`stock.mjs` line 208). *Why it matters:* Jack reads his margin as healthy while pads disappear, and the count he just applied doesn't show up anywhere he'd look later. *Fix, no choice:* Margin and stock value gains "Stock written off": counted under and over, and each adjustment reason, at cost, for the period, each linking to its count or product. `tk-diff` and `tk-hub` say "£[value] under, at cost".

**M8 — `rp-vat` (desktop), `rs-invoice-setting`, `rs-delivery-staff`: VAT on stock purchases counts only invoices added through an optional check.** The VAT report's Stock purchases row is "Supplier invoices booked in · [n]" (`reports.mjs` line 228). Invoices are added only through the invoice check. The check can be switched off: "Turn it off if you check invoices in your accounts software instead" (`receiving.mjs` line 180). It's done only by people who can order stock, after the delivery. *Why it matters:* a shop with the check off, or with deliveries still "Waiting for invoice", sees a stock-purchase VAT figure that is too low, labelled as what the accountant needs. *Fix (touches Receiving 6 and Reports 3):*
1. When the check is off, the Stock purchases box says "Supplier invoices are checked in your accounts software — take this figure from there" instead of a number. When it's on, it adds "[n] deliveries are still waiting for their invoice and aren't in this", linking to them.
2. Work the VAT out from booked-in costs for deliveries without an invoice. Always a number, but not the invoice's VAT, which is what the return needs.

Recommend 1.

**M9 — `tr-receive`, `tr-incoming` (desktop): receiving a transfer from another shop doesn't do what receiving a delivery does.** `tr-receive` shows "Scan each item", each line's count as plain text with "All here" or "1 short", and "Book in [n] items" (`stock.mjs` lines 221-223). Unlike `rs-receive`, the count can't be typed (receiving audit H2 fixed that for deliveries), there's no "Problem?", no spoken "Added …" after a scan, and no flag for a waiting job. Stock control 8 says the other shop "scans it in like a delivery (journey 13)". *Why it matters:* if Bolton gets WH-1042's pads from [Second site], the job never shows "Part arrived". A damaged item can only be booked in as stock. A keyboard-only user can't enter a count for an item with no barcode. *Fix, no choice:* receiving a transfer uses the delivery's list: a typed count between − and +, "Problem?" (Damaged, Missing), the scan announced, and "Job WH-1042 is waiting for 1", which sets "Part arrived" when booked in. Draw it as Staff, since everyone can receive.

**M10 — `rp-margin` (desktop), `st-categories`, `till-sale`: Reports' "category" is the till's groups, so stock value has a Workshop row.** Margin by category and Stock value by category list Workshop, Parts and Accessories (`reports.mjs` lines 35, 236-237). Those are the till's quick-button groups (`till-sale`). The Stockroom's categories are set in Settings › Stockroom › Categories, with Bearings and Drivetrain › Derailleurs as the examples (Stock control 10). *Why it matters:* Jack sees stock value split into a "Workshop" row, where labour holds no stock, and can't see stock value for bearings or brake parts, the categories he set up to find stock by. *Fix, no choice:* the category tables in Margin and stock value use the Stockroom's categories. Margin adds labour as its own row; stock value has no labour row. The till's quick buttons stay "groups".

## Low

**L1 — Same thing, different names along the stock's way.** Added to the script's word list.
- A job's pads are "On order" in the job's *Customer approval* column (`diary.mjs` line 2225), and "Arrived" in its *In stock* column, with approval back to "Approved" (line 2831).
- A job waiting is "Waiting for parts" (diary, job), and "Waiting for a part" in the Activity log (`oversight.mjs` line 76).
- Items that didn't come are "Missing", then "[n] to come", on a delivery, and "1 short" on a transfer (`tr-receive`, `tr-today-short`).
- "Book in" is the word for a bike arriving (walk-through 1 L1) and for a delivery ("Book in [n] items"). They are both staff actions in different rooms, and the word list now notes the second meaning.

Fix, no choice: "On order" moves to the In stock column, and approval stays "Approved" throughout. The Activity log says "Waiting for parts". A transfer says "1 missing", matching a delivery's "Missing". "Book in" stays for both.

**L2 — `st-adjust`, `rs-hub` (desktop): two ways to send something back to the supplier that don't meet.** Adjust stock has the reason "Returned to supplier" (`stock.mjs` line 205); the delivery's "To return to [Supplier]" list, with its "Returned" button, takes only items set aside at booking in (Receiving 9). Pads found faulty a week later can't go on the To return list. Fix, no choice: replace the adjust reason with "Faulty — to return to supplier", which takes the item out of stock and puts it on that supplier's To return list. "Returned" there records it as sent back.

**L3 — `rp-margin`, `tr-sites` (desktop): "On the shelves today" doesn't say what it includes.** Stock value is "Stock value, at what it cost you" (`reports.mjs` line 237). Stock held for customers isn't on an open shelf, and a transfer "On its way to [Site 2]" (`tr-sites`) is in neither shop. Fix, no choice: one line under the figure: "Includes stock held for customers (£[£]). Stock on its way between shops counts at the shop it's going to (£[£])."

**L4 — Accessibility at the joins.**
- `rs-receive`: after a scan, the spoken status is always "Added Shimano brake pads · 1" (`receiving.mjs` line 105). A screen-reader user scanning doesn't hear that this is the part a job is waiting for, which is only in the line below.
- `rs-diary-arrived` (desktop): "Part arrived" on the diary block is 10px (`diary.mjs` line 703), the smallest text on the board; on tablet and phone a short block folds it into the bike's name line (line 1278). It is the only sign of the hand-over on the diary.
- `st-adjust`: "Adjust" is greyed and `aria-disabled` until a reason is picked (line 207), and nothing says why.

Fix, no choice: the scan status reads "Added Shimano brake pads · 1 — job WH-1042 is waiting for 1". "Part arrived" on a diary block is drawn at the block's job-title size and follows "Larger text". Under the greyed "Adjust", a line reads "Pick a reason to adjust", linked to the button for screen readers.

**L5 — `rs-job-arrived` (desktop, tablet): the job's "booked in" link opens the manager's delivery.** The strip's "Shimano brake pads B05S-RX booked in" goes to `rs-delivery`, with costs and the invoice (`diary.mjs` line 2828), although Alex and Jo see the job. Fix, no choice: the link opens the delivery as the person looking can see it (`rs-delivery-staff` for Staff and mechanics).

**L6 — Edge cases at the joins that aren't drawn.** A refund at the till: whether the item goes back into stock, or is set aside as faulty (`till-refund` doesn't say; the void says "stock goes back on the shelf"). A delivery for [Second site] scanned in at Bolton. Pads held for both an online order and a job when only one is left. A job cancelled after its part was ordered. Listed so they're not lost; no choice needed until they're drawn.

## The edge cases asked about

- **A partial delivery.** Drawn: "[n] to come" while scanning, "Partly delivered", "Receive against this order" and "Close the order". Gaps: the job isn't told when its own part is the missing one, and closing the order drops it silently (M2). A shop with no order can't mark it missing (M2).
- **A wrong price on the invoice.** Drawn: the totals check, the difference with the set-aside items taken into account, "Queried" and "Accept the difference" with Undo. Gap: the higher cost never reaches the product, so margin and stock value stay on the old cost (M6). The stock-purchase VAT counts only invoices added this way (M8).
- **Pads sold while a stock take is in progress.** Drawn and handled: "[n] sold during the count, allowed for". Gap: other movements during the count, and stock kept away from the shelf, are not allowed for (H2).
- **A transfer between shops.** Drawn: send, on its way, cancel, receive, "1 short" on Today. Gaps: receiving it lacks the delivery's typed count, "Problem?", announcement and job flag (M9). Stock on its way isn't said to be in any shop's stock value (L3).
- **Stock held for an online order.** Drawn at the till (`till-held`, walk-through 2 M6) and on Online orders (`on-orders-sold-at-till`). Gaps: a stock take counts it as missing from the shelf (H2); stock waiting for a job has no hold at all (H1).

## Accessibility across the story

- **Screen reader or keyboard, as Jo receiving.** Receiving's screen-level work is done: every scan is a status, counts can be typed between − and +, "Problem?" is a button that names its row, the tick boxes are 44px, and Book in says why it's stopped (`role="alert"`). At the joins: the scan status doesn't say a job is waiting (L4); a transfer can't be counted without scanning (M9). Not checked: where focus goes after "Book in" opens the booked-in board, and after "Mark as damaged" closes.
- **Screen reader, as Alex.** The diary block's accessible name includes ", part arrived" (`diary.mjs` lines 699, 1284), and the Overview badge is words. Not checked: whether a screen-reader user is told anything when the flag appears, rather than finding it by reading the diary.
- **Keyboard, as Jack.** The stock take's Recount buttons name their product; "Not counted" is a `<details>` that opens with the keyboard; Change what's shown and the period chips are buttons. Adjust stock's disabled button doesn't say why (L4).
- **Low vision.** Staff have "Larger text" in Your settings. The boards are fixed sizes, so I couldn't test zoom or reflow. The smallest text on the main path is the diary's "Part arrived" at 10px (L4). The job's "Arrived" is green words in a table cell, not colour alone.

## Summary of choices for Jack

1. Keeping a job's part for the job (H1, options 1-3; touches Selling at the till 5). Recommend 1: hold it from booking in, warn at the till, never block.
2. What a stock take expects (H2, options 1-3; touches Stock control 5). Recommend 1: leave held stock out of "Expected", and allow for every movement during the count, not just sales.
3. Getting a job's need to whoever orders (M1, options 1-3; touches Receiving 2). Recommend 1: a "For customers" pill on the restock list.
4. A new product in a delivery received by Staff (M3, options 1-2; touches Stock control 11). Recommend 1: "Leave it for [Owner or manager]".
5. A cost that went up on the invoice (M6, options 1-3; touches Receiving 6). Recommend 1: an optional "Did a cost go up?" on accepting.
6. Stock-purchase VAT when invoices aren't all in Wheelhouse (M8, options 1-2). Recommend 1: say so instead of showing a short figure.

M2, M4, M5, M7, M9, M10 and L1–L6 have a single fix each and are listed so they are not lost.

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | rs-booked, rs-job-arrived, till-sale, till-held, st-product | The job's pads aren't held; the till sells them while the job says "Arrived" | Yes (1-3) |
| H2 | tk-start, tk-count, tk-diff, tk-applied | A count expects stock that's held elsewhere or moved, and writes it off | Yes (1-3) |
| M1 | job-waiting-parts, rs-hub, rs-order, rs-restock | A job's "On order" part never reaches whoever orders | Yes (1-3) |
| M2 | rs-problem, rs-booked, rs-order-ordered | Missing or damaged pads, or a closed order, don't reach the job | No |
| M3 | rs-receive, rs-add-product, rs-book-blocked | Staff can't book in a delivery with a new product | Yes (1-2) |
| M4 | rs-booked, rs-labels | After Book in, Jo sees an invoice button and a list she can't use | No |
| M5 | rs-job-arrived, rs-diary-arrived, rs-overview-arrived | Three boards put WH-1042 in three places | No |
| M6 | rs-invoice-diff, rs-invoice-accepted, rp-margin | An invoice's higher cost never reaches the product's cost | Yes (1-3) |
| M7 | tk-diff, st-adjust, rp-margin | Stock written off is in no report | No |
| M8 | rp-vat, rs-invoice-setting | Stock-purchase VAT counts only invoices added by the optional check | Yes (1-2) |
| M9 | tr-receive, tr-incoming | A transfer is received without a typed count, Problem? or the job flag | No |
| M10 | rp-margin, st-categories | Reports' categories are the till's groups; stock value has a Workshop row | No |
| L1 | various | Same thing, different names along the stock's way | No |
| L2 | st-adjust, rs-hub | Two return-to-supplier paths that don't meet | No |
| L3 | rp-margin, tr-sites | Stock value doesn't say what it includes | No |
| L4 | rs-receive, rs-diary-arrived, st-adjust | Scan status, 10px "Part arrived", unexplained disabled button | No |
| L5 | rs-job-arrived | The job's delivery link opens the manager's view | No |
| L6 | — | Edge cases at the joins not drawn | No |

## Verification (2 Oct 2026)

Rendered and looked at, with `peek.mjs` into the session scratchpad (`scratchpad/uxw3/`, none in the repo). At desktop: `rs-hub-staff`, `rs-receive`, `rs-problem`, `rs-booked`, `rs-labels`, `rs-job-arrived`, `rs-diary-arrived`, `rs-overview-arrived`, `rs-delivery-staff`, `rs-invoice-diff`, `rs-invoice-accepted`, `rs-order`, `rs-order-ordered`, `rs-restock`, `rs-today-restock`, `job-waiting-parts`, `st-product`, `st-adjust`, `tk-hub`, `tk-start`, `tk-diff`, `tk-applied`, `tr-receive`, `till-held`, `rp-margin`, `rp-vat`. At tablet: `rs-job-arrived`, `rs-diary-arrived`, `till-sale`, `job-mechanic`. At phone: `rs-receive`, `rs-diary-arrived`, `tk-count`, `st-product-staff`. Not every rendered board was opened as an image; the findings cite only the ones I looked at or read in source.

Read in source: `journeys.mjs` (journeys 11-17); `receiving.mjs` and `stock.mjs` in full; `reports.mjs` (header, the report list, Takings, VAT, Margin and stock value); `till.mjs` (basket, `till-held`, refunds, void, `till-job`, offline); `diary.mjs` (the job's work lines, the waiting-for-parts strip, `job-part-arrived`, the diary block and Overview "Part arrived"); `online.mjs` (holds, shelf, order-in setting); `opening.mjs` (`today()`'s stock lines); `oversight.mjs` (the Activity log's kinds); `settings-frame.mjs` (`MANAGER`). Searched the generator for "held"/"job" in `till.mjs`; "for job", "order it", "to order"; "To order from"; "adjust", "count", "written", "damaged", "lost" and "invoice" in `reports.mjs`.

Decisions read: Receiving stock (journey 13) and Stock take and stock control (14) in full; Selling at the till 5; Reports and accounts (the opening and decision 5); Multiple sites (its stock lines); Workshop day (searched for stock and waiting for parts); the UX walk-through decision. Audits read in part: `receiving-ui-audit.md` (H1 and its build note), `stock-ui-audit.md` (H1, M16), `reports-ui-audit.md` (M11, M18); walk-through 2's report for format.

Not checked: a real screen reader, keyboard order or focus on any board; zoom and reflow (fixed frames); the job line's own menu (how a line is marked "On order"); which Overview tab lists jobs waiting for parts; whether a job's parts are counted under Workshop or Parts in Reports; the Activity log's Today alerts beyond its kinds; journey 19's two-shop versions of the stock boards. Click counts are worked out from the boards, not timed with people.
