# Leftover screens — UI audit (desktop, tablet and phone, Soft sand)

Audited 2 Oct 2026 by the designer helper from the 24 renders of the leftover screens, each at desktop (1280 x 800), tablet (1180 x 820) and phone (390 x 844): `cp-receipt-email`, `cp-invoice-email`, `cp-receipt-text`, `cp-receipt-address`, `till-checkin`, `till-checkin-offline`, `rp-returning`, `rp-home`. They were checked against `docs/decisions/2026-10-02-leftover-screens-review.md` (decisions 1-5), `generator/collect.mjs` (`rkv`, `receiptBody`, `receiptEmail`, `receiptText`, `tick`, `receiptAddress`), `generator/signin.mjs` (`tillStatus`, `tillFrame`, `checkin`), `generator/reports.mjs` (`REPORTS`, `reportCard`, `graph`, `table`, `lapsed`, `returning`), and the pieces they reuse: `till.mjs` (`till-receipt`, the offline boards), `settings-frame.mjs` (`popup`, `overlay`), `diary.mjs` (`barcode128`), `customer.mjs` (`addDialog`) and the `ui.mjs` colours. I also looked at the decisions they have to agree with (Selling at the till, Customer service 3) and at the accessibility-first and fewest-clicks principles. Journey 5's pop-up sits on top of `till-receipt`, so I read that one too.

**How facts are handled.** Nothing here says what a VAT invoice must contain, or how long a link should stay valid, because I have not checked. Where a finding depends on that it is marked "unverified" and the fix is worded so it holds either way. Take the VAT points to the accountant before building.

**Not raised, on purpose.** The [bracketed] placeholders (`[Shop address]`, `[shop phone]`, `[VAT number]`, `B1-[0000]`, `[date]`, `[time]`, `[rate]`, `£[VAT]`, `[card ending]`, `[Company name]`, `[Company address]`, `[Company VAT number]`, `[accounts email]`, `[link]`, `[email address]`, `[n]`, `[£]`, `[date]`, `[Customer]`, `[Up or down]`, `[Report name]`). The Soft sand look. The dashed "LOGO" box (no official logo file exists). The uniform placeholder bars on the chart. Real example data: North Street Cycles, Bolton, Till B1, Jo Taylor, Alex Morgan, Maya Patel, WH-1042 and its £111.00, the till sale of £74.00 behind the pop-up, and "Thursday 17 September" on Reports home (already there before these screens). The renderer clipping the bottom of long pages (the not-seen table on the desktop and tablet pictures of `rp-returning`, the buttons on `cp-receipt-text-desktop`). None of the five decisions is reopened: one receipt email that doubles as the VAT invoice (1), a text that is a short link to the same receipt with no sign-in (2), an address used for one receipt only unless "Save to a customer record" is ticked (3), the start-up status as one line on the PIN screen (4), the Returning customers report with a not-seen list (5).

**Verdict.** The structure follows the five decisions. The receipt email, the VAT invoice, the text page, the pop-up, both PIN screens, the report and its Reports-home card are all drawn at three sizes. The status line says its state in words and an icon, not colour alone. The pop-up is a marked, named dialog; its address box has a real label and is 44px high; the tick is a real checkbox with a 44px label. Report cards are real links, 76px tall. The report's table has column and row headings, and the customer names are 44px links. Contrast on the tokens used passes. `rp-home` has no finding: the new card's title matches the report's title, it sits with the staff-visible reports (source flag `false`), and it reads well at all three sizes. The gaps are in what the emails point at and depend on, and in the report. The "See it in your account" button and the "give your name in the shop" line lead nowhere for a receipt sent to an address with no customer, which decision 3 creates (H1). The VAT invoice needs a company VAT number and an accounts email that no customer record holds (H2). The report's chart says its figures are in a table below, and there is no such table (H3). The offline line uses "3 sales", a number nobody has (H4). Around those: a five-second countdown that sits under a pop-up you have to type in (M1), pop-up states not drawn (M2), one kind of sale drawn for a receipt meant for every sale (M3), a status line that does not say what "up to date" means (M4), and a report whose bars, buttons and wording do not match the other reports (M5-M9).

Checked against source: `receiptEmail()` has no branch for a sale with no customer, and prints `button('See it in your account')` and "Keep this for returns — or just give your name in the shop." for every email; `button()` with no `href` writes a `<button>`, not a link; the invoice draws `[Company VAT number]` and `to [accounts email]`, and `addDialog(true)` in `customer.mjs` (the only place a company is made) asks for company or club name, contact name, phone, email, optional address, optional postcode, group, note and "Happy to hear about offers": no VAT number and no separate accounts email; `receiptBody()` prints one row "VAT at [rate]" and one row "Paid by", and prints the same invoice number format `B1-[0000]` as the receipt; `receiptAddress()` draws the pop-up over `tillScreens['till-receipt'][SIZE]`, whose own text is `<p role="timer">Next sale starts in 5 seconds</p>` (`till.mjs`), so two `role="dialog" aria-modal="true"` regions are in the page; the address box is `value="[email address]"` (pre-filled text, not a placeholder), `type="email"`, no `autocomplete` or `inputmode`; the tick's second line is the fixed text "Off: the address is used for this receipt only." and does not change when ticked; the pop-up's close is `<a href="#" aria-label="Close">` in `settings-frame.mjs` `popup()`; `receiptText()` reuses the Bike ready page frame, whose `site()` marks "Book a repair" as the current tab, and prints "Your receipt" whatever the customer; `signin.mjs` `tillFrame()` writes `offline: offline ? '3 sales' : null` into the top bar and `tillStatus()` writes "3 sales waiting to send" into the line, while `till.mjs` and the decision use `[n]` for the same fact; the phone's top bar (`tillPhoneBar`) shows "Offline" with no count; `tillStatus()` is `<p role="status">` with a pill radius of 999px; `graph()` writes `role="img"` and `aria-label="... The figures are in the table below."` on every chart, and `returning()` has only one table, "Not seen lately"; `graph()` draws the dashed bar as the "same days last week" in every other report (comment at `reports.mjs` line 74) and as "New" here; `returning()` passes `PERIODS` of "This month / Last 12 months / Pick dates", prints "Spent in the last 2 years", has no control for the "[n]" in "Not seen for [n] months", and names the first row "Maya Patel" with `[date]`; `graph()`'s month labels use `overflow-wrap: anywhere` and `lineGraph()` hides every second label on a phone while `graph()` does not; the record's switch is "Happy to hear about offers" (`customer.mjs` line 136) while the report says "OK to message". Colours, worked out by hand here: amber line `#7A5A10` on `#F7EAC2` about 5.3:1; green line `#295C39` on `#E1EEDD` about 6.5:1; muted `#6E6752` on the email's white about 5.6:1 (all pass 4.5:1). Muted on the sand page (about 4.9:1) is the figure the earlier audits worked out and was not recomputed. Nothing was run in a browser, and no keyboard, screen reader or phone keyboard was tested.

## High

**H1 — `cp-receipt-email`, `cp-invoice-email`, `cp-receipt-address`: "See it in your account" and "give your name in the shop" lead nowhere when the receipt went to an address with no customer.**
- Decision 3 says that with no customer on the sale the address is for this receipt only and nobody joins the list without agreeing. So there is no account to see. `receiptEmail()` has one version, and that version always has the button (all three sizes of `cp-receipt-email`) and the line "Keep this for returns — or just give your name in the shop". With no customer, there is no name on file to give.
- `cp-invoice-email` is addressed to "[accounts email]". A company's accounts department may not be the person who holds the shop account, so the same button may lead to a sign-in they cannot use.
- Not drawn: the email for an address-only receipt.

*Why it matters:* a customer-facing email with a dead button, and a returns instruction that cannot work, on the exact path decision 3 creates. *Fix:*
1. Two versions of the same email. With a customer: as drawn. With no customer: the button is replaced by a line "Questions? Call [shop phone]" and the returns line reads "Keep this for returns. Show this email or give the receipt number." The invoice follows whichever applies. One extra email to draw; keeps decision 1's wording.
2. One version for everyone: the button reads "View this receipt online" and opens the no-sign-in receipt page that the text message already uses (`cp-receipt-text`). "See it in your account" becomes a plain line for people who have an account. Fewest versions, and it works for an accountant. It changes the words decision 1 named.
3. As drawn.
Recommend 1.

**H2 — `cp-invoice-email`: the VAT invoice needs details that no customer record holds.**
- The invoice prints "Invoice to [Company name] · [Company address] / VAT number [Company VAT number]" and is sent to "[accounts email]". The only place a company is made is Add a customer, which asks for the company or club name, a contact name, a phone, an email, an optional address and optional postcode (`customer.mjs`, customer decision 3). There is no VAT number and no accounts email. The address is optional, so the "Invoice to" block can be missing it.
- Whether a customer's VAT number and address must be on a VAT invoice is unverified; I did not check.
- The invoice also reuses the till's receipt number (`B1-[0000]`) under the word "Invoice". Whether a VAT invoice needs its own number series is unverified.

*Why it matters:* a VAT invoice with a blank or invented block, or sent to the contact's personal email, is the document a company will try to reclaim VAT with. *Fix:*
1. Add two optional boxes to a company customer: "VAT number" and "Send invoices to" (defaults to the contact's email). The invoice prints the "Invoice to" block from the record, and a line that is blank is left out, never shown as a bracket. A little more on Add a customer; the invoice then has a source for every line.
2. No new boxes. The invoice shows what the record has (company name, address if given, contact's email) and never a VAT number line. Smallest; the company cannot reclaim VAT if a number is needed.
3. Ask at the till when someone wants an invoice ("Company VAT number?"). More typing at the counter each time.
Recommend 1. Jack to confirm with the accountant what a VAT invoice must carry (unverified).

**H3 — `rp-returning` (all three sizes): the chart says its figures are in a table below, and the report has no such table.**
- `graph()` gives every chart `role="img"` with an `aria-label` that ends "The figures are in the table below." `returning()` has one table, "Not seen lately", which lists customers, not months. The monthly counts of new and returning customers are shown nowhere in words or numbers. A person using a screen reader hears a promise that cannot be kept, and a sighted person sees bars with only a top value. The other reports that use this chart (Sales, Workshop) have the matching table next to it.

*Why it matters:* it fails the accessibility-first rule for anyone who cannot read the bars, and it leaves everyone without the actual monthly numbers. *Fix, no choice:* add a table "New and returning customers by month" under the chart, with the columns Month, Returning and New (and the total). Keep the wording the chart's label already uses. The not-seen table stays as it is.

**H4 — `till-checkin-offline` (all three sizes): "3 sales waiting to send" is an invented number.**
- The amber line reads "Till B1 · Bolton · Offline · 3 sales waiting to send · last updated [time]" and the dark bar at the top of the desktop and tablet pictures reads "Offline · 3 sales waiting to send" (`signin.mjs` lines 73 and 96). Nobody has a count; the decision and the rest of the till boards (`till.mjs`, "[n] sales are still waiting to send") use [n]. "[time]" is correctly bracketed.

*Why it matters:* it breaks the rule that unknown facts are bracketed, and it is the one number on the screen a person would act on. *Fix, no choice:* "[n] sales waiting to send" in both places. The decision's own example shows `[n]`.

## Medium

**M1 — `cp-receipt-address`: the pop-up sits on a screen that closes itself after five seconds.**
- Behind the pop-up is the "Paid" box, which says "Next sale starts in 5 seconds" (`till.mjs`, `role="timer"`). Typing an email address takes longer than that. Nothing on the board says the countdown stops when Email is pressed, and the till's sale (£74.00, "Take payment") is still visible behind it.
- Pressing Email or Text, then typing, then Send is three taps plus the typing.

*Fix, no choice:* pressing Email or Text stops the countdown and hides the line; after Send or Cancel the Paid box goes back to the receipt choices with a fresh five seconds. Put the cursor in the address box when the pop-up opens, and let the Enter key send. Draw the Paid box once with the countdown stopped.

**M2 — `cp-receipt-address`: states the pop-up needs that are not drawn.**
- A blank or badly typed address: "Send receipt" is always live and there is no error line. The rest of the app puts the error under the box and in words.
- Ticking "Save to a customer record": decision 3 says this opens a quick "Add customer" with the address filled in. That board is not drawn. Not said whether the receipt is sent first or the customer is added first, or what happens if the person cancels the Add customer box.
- The text version of the pop-up (a phone number instead of an address, with the same tick) is not drawn. Decision 3 covers "the address or number".
- The pop-up with a customer on the sale: does Email send at once to the address on the record, or open this pop-up with it filled in? Not drawn.
- The till offline. Search of the generator turned up no board for what happens when someone presses Email or Text while the till has no internet (the way `till-needs-net` does for refunds). Plain English wording would be "It will send when the till is back online."
*Fix, no choice:* draw those five. The error line reads "That doesn't look like an email address — check it" under the box, and "Send receipt" stays live so it can be pressed and explained. Send first, then Add customer if the tick was on (the receipt must not wait on form-filling).

**M3 — `cp-receipt-email`, `cp-invoice-email`: only one kind of sale is drawn, and the VAT lines are one-size.**
- Decision 1 says every till sale and every collected repair sends this email. Only the collected repair (WH-1042, three lines, £111.00) is drawn. Not drawn: a till sale with a quantity ("2 x £28.00"), a discount, a split payment, change given, a part payment or a refund. `receiptBody()` has one "Paid by" row and one "VAT at [rate]" row.
- One VAT row for a whole sale is a claim about how the sale's VAT works. Whether every line has the same rate, and whether a VAT invoice should list the price before VAT, are unverified. The till backdrop of `cp-receipt-address` shows one "Includes VAT £12.33" line, so the till itself currently assumes one total.
*Fix:*
1. Draw a second sample, a till sale: two quantities, a discount line, a split payment, and VAT as the till already works it out. Keep one "VAT at [rate]" row until the accountant says whether lines can have different rates (then it becomes one row per rate, with the price before VAT).
2. Leave the one sample, and say in the decision that other sales use the same layout. Less to draw; the rest is guesswork for the builder.
Recommend 1.

**M4 — `till-checkin`, `till-checkin-offline`: the status line does not say what "up to date" means, and the amber line does not say what was updated.**
- Green reads "Till B1 · Bolton · Online · up to date". Up to date with what: the products and prices, the sales sent, both? Amber reads "... · last updated [time]": updated what? A person who has just come in has no way to tell if it matters.
- Decision 4 gives two amber cases: "Offline · [n] sales waiting to send" and "Last updated [time]". Only the first is drawn. Not drawn: online but the till has not updated for a while, and online with sales still waiting to send. Today the line would say "Online · up to date" in green for both, since the green is drawn from "online" alone.
- The line repeats things on the page: "Till B1 · Bolton" is already top left, and "Online" or "Offline · 3 sales waiting to send" is already in the dark bar. One fact now appears three times on desktop and tablet.
*Fix:* say what updated, in plain English, and cover the missing state. Green: "Online · prices and stock updated [time]". Amber, offline: "Offline · [n] sales waiting to send · prices and stock last updated [time]". Amber, online but stale or still sending: "Online · [n] sales still sending" or "Online · prices and stock last updated [time]". Drop "Till B1 · Bolton" from the line, which also stops the wrap in L5. Jack to say how stale is too stale for amber: [n] minutes.

**M5 — `rp-returning`: the dashed bar means something different from every other report, and the figures do not match the chart.**
- On Sales and Workshop, the dashed outline bar is the same period before (`reports.mjs` line 74's comment). On Returning customers, the dashed bar is "New" and the solid bar is "Returning" (legend, all sizes). Someone who has read the other reports will read dashed as "last year".
- The three stat cards each say "[Up or down] [n] on the 12 months before", and the chart's spoken description does too ("... on the 12 months before"), but the chart shows no earlier period at all.
*Fix:*
1. Keep the dashed bar to mean "the period before", and show new and returning as two stacked parts of one solid bar, returning dark, new lighter with a pattern so colour is not the only signal. The same chart reads the same everywhere.
2. Keep the bars as they are and change the dashed meaning here only, with the legend saying "New (outline)". Quickest; it is the one report where dashed means something else.
Recommend 1. The comparison wording on the stat cards stays; the chart's description stops mentioning an earlier period.

**M6 — `rp-returning-phone`: the month names break across lines.**
- On the 390px picture the twelve month labels wrap mid-word: "No / v", "De / c", "Fe / b", "Ma / r", "Ap / r", "Ma / y", "Au / g", "Se / p". `graph()` allows breaks anywhere. `lineGraph()` (the line chart in other reports) hides every second label on a phone; the bar chart does not.
*Fix, no choice:* on a phone show every second month (or the first letter with the full month in the table from H3), the way the line chart already does.

**M7 — `rp-returning`: the controls do not fit what the report shows.**
- The period buttons are "This month / Last 12 months / Pick dates" (all sizes). "Came back within 12 months" and "New and returning customers by month" make little sense for "This month" (one bar, and a rate that needs a year).
- The not-seen table says "Spent in the last 2 years" while the page says "the last 12 months". Nothing says why two years. And "Not seen for [n] months" has no way to change n (the decision gives it as a number, not where it is set).
*Fix:*
1. Buttons "Last 12 months / Last 24 months / Pick dates"; the spend column follows the chosen period and its heading says which ("Spent in the last 12 months"); a small box beside the table title "Not seen for [n] months" sets n, with a starting value [n]. Fits what the report is for.
2. A fixed 12 months with no period buttons, and a fixed n set under Settings. Simplest; the "Change what's shown" button covers the rest.
3. As drawn.
Recommend 1.

**M8 — `rp-returning`: the note does not say who is left out, and decision 3 leaves most walk-ins out.**
- The note reads "A customer counts when they buy something or a repair is collected — in the shop or online." Decision 3 keeps a walk-in receipt out of the customer list unless someone ticks "Save to a customer record" (unticked to start). Those sales have no customer, so they can never be a "returning customer" and the counts will run low in a shop with many walk-ins.
*Fix, no choice:* add one line under the chart: "Sales with no customer on them are not counted." The numbers need no change; only the promise does.

**M9 — `rp-returning`: the not-seen list has no next step.**
- Decision 5 says the report "suggests contact only for customers who said yes to messages". The table has an "OK to message" column with Yes or No as plain words and no button. To message the customer, a person opens the customer page (one click on the name) and starts a message from there: more clicks than they need.
*Fix:*
1. A "Message" button on each "Yes" row, and none on a "No" row; it opens the same message action the customer's page has (I did not check which one that is). One click from the list.
2. A "Message these customers" button at the top that picks only the "Yes" rows. Fewest clicks for a campaign; needs the Messages screens to take a list.
3. As drawn.
Recommend 1.

**M10 — `cp-receipt-text`: anyone holding the link sees what the customer bought, and the barcode.**
- Decision 2 accepts that anyone with the link can see the receipt. The page as drawn prints the shop's details, the bike and the work done, the card payment and the receipt barcode (all three sizes). Selling at the till 13 says the barcode finds a sale for a refund. Whether the barcode alone is enough for a refund (and who checks) is unverified.
- Nothing says how long the link works.
*Why it matters:* a forwarded text or a screenshot shows a stranger the customer's bike and service history. Not a reason to reopen decision 2; it is about what the page chooses to print. *Fix:*
1. As drawn. The customer may need to show the barcode from their phone at the counter, which this keeps.
2. Keep the receipt number and drop the barcode on the web page only (the email keeps it). A refund can still be found by typing the number.
3. As 1, and the link stops working after [n] days with a page that says "This receipt link has run out. Ask the shop to send it again."
Recommend 1. Jack to say whether customers are expected to show the phone at the counter, and whether a link should expire.

**M11 — `cp-receipt-text`: what "Email it to me" and "Download receipt" do is not drawn, and a company customer's page says "Your receipt".**
- "Email it to me" on a page with no sign-in has no address to send to, and the page does not say where it goes. If it asks for an address on a phone, that board is missing. The customer chose a text because they gave a phone number, not an email.
- "Download receipt" does not say what the file is. Plain English would be "Download receipt (PDF)" if that is what it is; I did not check what is intended.
- The heading is fixed as "Your receipt" (`receiptText()`). Decision 2 says the link opens the same thing as the email, so for a company customer it should read "VAT invoice" and show their details.
*Fix:* draw "Email it to me" opening a one-box dialog (address, "Send") like the till's; name the download's file type on the button; and let the page take the same invoice version as the email. Not shown: the page after the link has run out (M10, option 3).

## Low

**L1** — `cp-receipt-email`, `cp-invoice-email`: "See it in your account" is drawn as a button (`button()` with no link writes a `<button>`). In an email it has to be a real link. The barcode is an inline SVG (`barcode128()`); from memory, many email programs do not show inline SVG, so the barcode may arrive blank. The receipt number printed beside it is real text, which is the fallback. Hand both to the build: link, and a picture file for the barcode.
**L2** — `cp-receipt-email`, `cp-invoice-email`, `cp-receipt-text`: the receipt's table has no name and its first column is plain cells, not row headings (`rkv()`, line 150). The report tables in `reports.mjs` have both. Give it a name ("Items on this receipt") and make the first column row headings.
**L3** — `cp-receipt-text` page frame. The "Book a repair" tab is underlined as the current page on desktop and tablet, because the frame is copied from the Bike ready page; no tab should be marked. On the desktop picture the "Download receipt" and "Email it to me" buttons are cut in half by the bottom edge, so I could not see them whole there (they are fine at tablet and phone). The line "Opened from the link in the text — nothing to sign in to." is drawn as page text; if it is a note for the drawing, it should not look like copy the customer sees.
**L4** — `cp-receipt-email-phone`, `cp-invoice-email-phone`: the receipt number and date are right-aligned in a block that wraps under the shop's address, so they sit about 20px in from the left edge, ragged against everything else. Left-align the two lines when they wrap.
**L5** — `till-checkin-offline` (all sizes): the amber pill wraps to two lines, with a dot starting the second line ("· last updated [time]"), and the rounded pill shape makes the wrap look squeezed. Dropping "Till B1 · Bolton" (M4) fixes it. The decision's note says the bar and the line agree, but on the phone the bar says "Offline" with no count while the line has one.
**L6** — `cp-receipt-address`: the address box is filled in with the text "[email address]" as a value, not a placeholder, so a real build would start with text to delete; it has no `autocomplete` and no `inputmode="email"` (so a phone shows the wrong keyboard). The tick's second line always starts "Off:" and does not change when ticked. Plain English: "Leave this unticked and we'll use the address for this receipt only." The pop-up's ✕ is a link (`<a href="#">`) in the shared `popup()`, not a button, the same on every pop-up in the app. Two modal dialogs are open at once (the pop-up over "Paid"); where keyboard focus goes when the second opens and closes was not tested.
**L7** — `rp-returning`: words and example. "OK to message" is the customer record's "Happy to hear about offers" (`customer.mjs`); use one wording, ideally "Happy to hear about offers". "Last in" can mean the last purchase or collection, including online ones, so "Last bought or collected" is plainer. The first not-seen row is "Maya Patel", who is the repair customer collecting a bike in the other journeys; use `[Customer]`.
**L8** — fewest clicks, counted by hand from the boards. At the till: Print 1; No receipt 1; Email or Text with no customer 3 (the button, the box, Send) plus typing, and 4 or more with the tick (M2). With the cursor already in the box and Enter to send (M1) it is 2 plus typing. Reports home to Returning customers 1; from the not-seen list to a customer 1 (M9 option 1 messages them in 1). Receipt email: 1 to open it online (H1 option 2 makes it work for everyone).

## Summary of what to decide

7 choices for Jack; the first four need the accountant or Jack's knowledge:

1. What the receipt email says when there is no customer to have an account (H1, options 1-3).
2. Where a company's VAT number and accounts email come from (H2, options 1-3), and what a VAT invoice must carry (unverified; accountant).
3. Whether to draw a till-sale receipt too, and how VAT shows on it (M3, options 1-2).
4. What "up to date" means on the PIN screen and how stale is too stale (M4; one value, [n] minutes).
5. How the report's bars, buttons and spend column are arranged (M5 options 1-2, M7 options 1-3).
6. What the not-seen list can do (M9, options 1-3).
7. Whether the text receipt page prints the barcode, and whether the link expires (M10, options 1-3).

H3, H4, M1, M2, M6, M8, M11 and L1-L8 have a single fix each and are listed so they are not lost.

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | receipt email, invoice email, receipt address | "See it in your account" leads nowhere when there is no customer | Yes (1-3) |
| H2 | invoice email | VAT invoice needs a VAT number and accounts email no record holds | Yes (1-3) |
| H3 | returning customers | Chart promises a table of figures that is not there | No |
| H4 | till check-in offline | "3 sales" is invented; should be [n] | No |
| M1 | receipt address | Five-second countdown runs under the typing pop-up | No |
| M2 | receipt address | Error, Add customer, text version, customer-on-sale and offline not drawn | No |
| M3 | receipt email, invoice email | Only a repair is drawn; VAT shown as one row | Yes (1-2) |
| M4 | till check-in, offline | "Up to date" and "last updated" do not say what; stale state missing | Yes (one value) |
| M5 | returning customers | Dashed bar means "New" here and "the period before" elsewhere | Yes (1-2) |
| M6 | returning customers (phone) | Month names break mid-word | No |
| M7 | returning customers | Period buttons, 2-year spend and [n] months do not fit the report | Yes (1-3) |
| M8 | returning customers | Walk-ins with no customer are not counted, and it does not say so | No |
| M9 | returning customers | Not-seen list has no next step | Yes (1-3) |
| M10 | receipt text | Link shows the bike and the barcode to anyone; no lifetime | Yes (1-3) |
| M11 | receipt text | "Email it to me" and "Download" undrawn; heading fixed | No |
| L1-L8 | various | See above | No |

## Verification (2 Oct 2026)

Checked by reading: all 24 renders as images (the eight screens at desktop, tablet and phone); `docs/decisions/2026-10-02-leftover-screens-review.md` in full; the two earlier audits (`c2w-ui-audit.md`, `lightspeed-ui-audit.md`) for format and severity; `collect.mjs` lines 1-60 and 143-165; `signin.mjs` lines 69-107; `reports.mjs` lines 20-143 and 215-240; `ui.mjs` colours (lines 46-49) and `button` (115-127); `settings-frame.mjs` `popup` and `overlay` (160-173); `diary.mjs` `barcode128`; `till.mjs` `till-receipt` (236-241) and the offline boards by search; `customer.mjs` `addDialog` (123-137) and `docs/decisions/2026-09-30-customer-service-review.md` decision 3. Searched the generator for "3 sales" and "sales waiting", for any offline receipt wording, for "company" fields, and for "accounts email" and "Company VAT" (only the invoice board has them). Contrast: three pairs worked out by hand here (amber line about 5.3:1, green line about 6.5:1, muted on white about 5.6:1); muted on the sand page reuses the earlier audits' figure. I had no way to run a command or open a browser in this session (reading and search tools only), so nothing was re-rendered and nothing was measured. The accessibility findings come from the generator source, not from the built HTML of each board.

Not checked: what a VAT invoice must contain, the VAT rules for mixed rates, and the length of time a link should live (H2, M3, M10 depend on these and say so); keyboard order, focus (including where it goes when the second dialog opens on `cp-receipt-address`), a screen reader, the phone's on-screen keyboard over the address box, or any browser behaviour; the not-seen table on the phone (the picture of `rp-returning-phone` ends above it) and on desktop and tablet beyond its first row; whether the Messages screens can take a list of customers (M9 option 2); which message action the customer page has (M9 option 1); Staff's version of Reports home and of `rp-returning` (the staff-visible flag is `false`, so staff should see both, but no Staff board is drawn); the other till screens beyond `till-receipt` and the offline boards found by search; whether the text receipt page matches the website frame's other pages beyond the tab and clipping noted in L3.
