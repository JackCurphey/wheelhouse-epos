# Journey 6 — UI audit (desktop, Soft sand)

Audited 2 Oct 2026 by the designer helper from the 25 desktop renders of the Cycle to Work boards (1280 x 800: `cw-list`, `cw-new`, `cw-new-not-in-stock`, `cw-quote`, `cw-order-held`, `cw-hold-ending`, `cw-order-applied`, `cw-order-deposit`, `cw-order-anyway`, `cw-certificate`, `cw-certificate-diff`, `cw-cancel`, `cw-order-ready`, `cw-hand-over`, `cw-order-owed`, `cw-mark-paid`, `cw-mark-paid-diff`, `cw-order-paid`, `cw-owed`, `cw-today`, `cw-settings`, `cw-settings-deposit`, `cw-settings-provider`, `cw-messages`, `cw-email`), against `docs/decisions/2026-10-02-cycle-to-work-review.md` (decisions 1-6), `generator/c2w.mjs` (`c2wPage`, `countIn`, `listPage`, `orderRow`, `orderPage`, `NEXT`, `HIST`, `details`, `customerBox`, `newOrder`, `quoteDoc`, `certificate`, `orderAnyway`, `holdReminder`, `handOver`, `markPaid`, `cancelOrder`, `owedPage`, `providersOpen`, `providerEdit`, `email`), the pieces it changes or reuses (`settings-frame.mjs` `c2wFolds` and `C2W_INTRO`; `setup.mjs` `C2W_MSGS` and `msgListOpen`; `opening.mjs` `today({ c2w })`; `diary.mjs` sidebar item; `ui.mjs` bike icon and the Soft sand colours), the rendered HTML of the boards for the accessibility checks, and the decisions it has to agree with (Selling at the till 15; Opening the shop 3 and 4; Management oversight 1 and its audit; Reports and accounts 5; Owner setup 9 and 10; Buy online 6 for how a grouped list behaves; and the accessibility-first and fewest-clicks principles). Tablet and phone are not drawn yet, so nothing here covers them.

**How scheme facts are handled.** Nothing in this audit says how Cycle to Work schemes or their providers really work, because I have not checked. Where a finding depends on that (whether a certificate can differ from a quote, whether VAT or salary sacrifice changes the price, whether collection has to be confirmed with the provider, whether the customer pays anything at collection), it is marked "unverified" and the fix is worded so it holds whichever way the answer falls.

**Not raised, on purpose.** The [bracketed] placeholders (`[Provider]`, `[Bike]`, `[Size]`, `[Customer]`, `[Accessory]`, `[supplier]`, `[Second site]`, `[quote number]`, `[certificate number]`, `[reference]`, `[reason]`, `[date]`, `[£]`, `[£ less]`, `[n]`, `[%]`, `[rate]`, `[VAT number]`, `[Shop address]`, `[shop phone]`, `[Employer]`, `[From their agreement]`, `[how they want it confirmed]`). The Soft sand look. Tablet and phone. 12-13px text that is only a label. The dashed "LOGO" box on the quote and sidebar (no official logo file exists, so the placeholder is the honest choice). Clipped scroll areas the renderer cuts off (the list below "Ready to collect", the settings page below the open folds, the providers list below its first rows, the fourth Cycle to Work message "Your hold ends soon" below the fold on `cw-messages`). The toast on `cw-order-held` sitting over the customer's phone number (a still picture of something that disappears). Real example data: North Street Cycles, Bolton, Jack Lewis, Jo Taylor, Maya Patel and the Today rows (WH-1045 Jamie Brooks and the rest). None of the six decisions is reopened: its own kind of order with six stages (1), the sidebar item and its count (2), a bike in stock held from the quote (3), a bike not in stock ordered by a rule the shop picks, with "Order now anyway" (4), providers listed once and Wheelhouse working out what is owed (5), a proper quote then a message at each step, with the website quote page noted for later (6). Where a finding below needs a rule the decisions do not state, it says so and offers a choice.

**Verdict.** The structure follows the decisions. All six stages are drawn and the stage strip says where an order is in words, a tick and "Now", not colour alone. The list is grouped by stage the way Online orders is. Every dialog is marked as a dialog and named. "Order now anyway" asks for a reason and says it goes in the activity log. The hold reminder offers "Hold longer" or "Release the bike". "Mark paid" flags a short payment. Contrast on the tokens used passes. The gaps are in what the screens claim and who they are for. Several fixed sentences state how schemes work, as fact (H1). The money split is fixed at "the customer pays nothing", which the shop's own deposit and accessory choices can make untrue (H2). Staff see the shop's cost and commission, which the Reports and accounts decision keeps from them (H3). Nothing says who may mark a payment paid or write one off, and none of that is logged (H4). The quote promises a hold that the order may not have, and has nowhere to say what happens to a deposit (H5). Around those: reminders that do not reach the person who gave the quote, a sidebar count with no rule, a held bike that looks held only on its own page, a one-press order that spends money, a payments page with no way in, a customer page that is not drawn, and several steps of an order's life that are missing.

Checked against source: `c2wPage()` signs every Cycle to Work board in as `STAFF` (Jo Taylor) unless a caller passes `OWNER`, so `details()` (which prints `kv('Provider', ... commission [%])` and `kv('Expected from the provider', ...)`) and `orderAnyway()` (which prints "for £[£] cost") are shown to a Staff member; `handOver()` hard-codes `kv('Maya pays', mono('£0.00'))` and draws the first collection box with `checked` set; `certificate(true)` hard-codes "Maya pays nothing at the till for Cycle to Work, so a difference has to be agreed first"; `quoteDoc()` has one closing paragraph ("Use this quote number when you apply. We hold your bike until [date]; once your certificate arrives, it's yours to collect.") and `email()` says "you'll need it when you apply"; `setup.mjs` (`payOther`) says "Recorded at the till; the scheme pays the shop"; `NEXT.held` says "we'll remind you the day before" while `holdOpen()` has "[n] days before" and `C2W_MSGS` has "Your hold ends soon" where decision 6 names the message "Your hold ends on [date]"; `c2wFolds()` has Holding bikes, Bikes not in stock, Deposits, Scheme providers and On Today, with no setting for how long a quote is valid, although `quoteDoc()` prints "Valid until [date]"; `countIn(html, count = '4')` writes the sidebar count and `c2wPage()` calls it on every Cycle to Work board, but `today({ c2w: true })` never does and the rendered picture of `cw-list` shows 2 where the HTML says 4; `select()` writes a plain `label` above a `button` with no link between them (four times in `newOrder()`); `radio()` is used without a `fieldset` in `holdReminder()` (it is used with one in the settings folds); `listPage()`'s group headings are `h3` under the page's `h1`; `HIST` has four different lists (2, 4, 4 and 2 lines) so the history shrinks when an order is paid; "Applied", "Employer" and "Application reference" appear only as display text (`orderRow` status, `NEXT.applied`, `customerBox`) with no field or tick to set them; `owedPage()` is reached from nowhere (the only text "Owed by" is in `c2w.mjs` itself, and `reports.mjs` has none); `cancelOrder()` is drawn for the deposit case only; `today()` uses its fixed `MANAGER` ("Jack Lewis · Manager") while `owedPage()`, `c2wSettings()` and `messages()` pass `OWNER`; the "Open" and "Edit" links are `min-height: 44px` and about 35px wide (read off the screenshot); `journeys.mjs` (j06) and `workflow.mjs` still say Cycle to Work "waits on Jack's explanation". The rendered pictures and the HTML disagree on two boards (the `cw-cancel` picture shows a "Release the bike" selection box that the current source draws as a plain note, and the sidebar count above), so wherever they differed I went by the HTML and source. Nothing was run in a browser, and no keyboard, screen reader or drag was tested; the boards were only seen at 1280 x 800. Contrast was worked out by hand for three pairs: muted `#6E6752` on the sand page `#F4EEE1` is about 4.9:1 and on `#F0EADC` about 4.7:1 (13px notes and stage dates, both pass 4.5:1), and the blue "Ready to order" badge `#294872` on `#E4EAF3` is about 7.7:1. The amber pair is the one the journey 18 audit worked out (about 5.3:1) and was not recomputed.

## High

**H1 — `cw-hand-over`, `cw-certificate`, `cw-certificate-diff`, `cw-quote`, `cw-email`: fixed wording states how schemes work, as fact.**
- `cw-hand-over` has two checks, "Maya has signed [Provider]'s collection form" (drawn already ticked) and "Collection confirmed with [Provider]", and a line "Maya pays £0.00". `cw-certificate` says "Matches the quote" and `cw-certificate-diff` says "Maya pays nothing at the till for Cycle to Work, so a difference has to be agreed first". `cw-quote` and `cw-email` tell the customer to use the quote number "when you apply", and the quote prints one VAT rate over the bike and the accessories. Settings › Payments says "the scheme pays the shop".
- Unverified: whether schemes use a collection form, whether collection is confirmed with the provider, whether the customer pays nothing, whether a certificate can differ from a quote and why, whether a provider asks for the shop's quote number, and how VAT applies. The decision says no provider's process is drawn as fact and that each provider's way of confirming a handover is a note the shop types for that provider; the Edit provider board already has that box.
- A box that starts ticked records a check nobody made. Not said: whether "Hand over at the till" waits for the boxes.

*Why it matters:* a shop whose provider works differently gets wrong instructions printed on its own quote and in its own emails to customers, and a handover checklist that is the drawing's idea of the process, not the provider's. *Fix:*
1. Neutral wording, with the specifics supplied by the shop. The hand-over list is one box per line of the provider's own note from Settings, none ticked to start, and the history records which were ticked. "Maya pays" is worked out from the order (H2), not typed into the screen. The certificate check shows "Certificate £[£] · quote £[£]" and flags a difference without saying why. The quote and email say "Quote number [quote number]" without saying what it is for, plus an optional line each shop writes once ("How to apply: [the shop's words]"). A little more to set up; nothing in the starting wording can be wrong.
2. Keep the wording as drawn, and let the shop edit every sentence in Settings. Less to redraw; the starting words still claim a process, and most shops will not edit them.
3. As drawn, once Jack confirms from his own experience that every provider his shop uses works this way. Cheapest; only as good as the confirmation, and other shops' providers are not Jack's.
Recommend 1. Jack to say which of the fixed statements are true of the providers his shop uses; I could not check.

**H2 — `cw-hand-over`, `cw-certificate-diff`, `cw-new`, `cw-settings-deposit`, `cw-order-owed`: the money split is fixed at "the customer pays nothing", which the decisions' own choices can make untrue.**
- Decision 4 lets the shop count a deposit toward the price ("The certificate covers the rest" on `cw-settings-deposit`). The customer has then already paid part, the provider's share is smaller, and `cw-hand-over` still says "Maya pays £0.00". The order's "Expected from the provider" has no line showing the deposit.
- `cw-new` says accessories are "Optional — if the scheme allows them". If one is outside what the provider pays for, nobody is shown who pays for it at the till. Unverified whether schemes allow this; the drawing already assumes some may not.
- `cw-certificate-diff` offers one way out, "Save and change the order", which changes the order without asking. There is no way to keep the quote and take the difference from the customer.
- `cw-hand-over` shows "Amount £[£]" without saying whether it is the order total or the certificate amount; `cw-order-owed` shows "[£] less [%] commission" with no line that adds it up.

*Why it matters:* the till takes whatever this screen hands it. A wrong £0.00 sends a bike out on a short sale, and it is found weeks later when the provider pays less. *Fix:*
1. A small "Who pays what" block on the order and the hand-over: the total, any deposit already paid, the provider's share, and "Maya pays at collection £[£]" worked out from those. If it is not £0.00 the till opens with a second payment line for the difference. The certificate-difference pop-up offers "Change the order to match" and "Keep the order; Maya pays the £[£] difference". One block to draw, and a rule per provider for whether accessories are inside what the provider pays (the shop's, not Wheelhouse's).
2. Keep £0.00, and add one line staff fill in at hand-over ("Maya also pays £[£]"). Smaller; staff do the sums and a forgotten line is a short sale again.
3. As drawn.
Recommend 1. Jack to confirm the deposit case: when it counts toward the price, what the provider owes.

**H3 — `cw-order-anyway`, `cw-order-*`, `cw-new`: Staff see the shop's cost and commission, which the Reports and accounts decision keeps from them.**
- `cw-order-anyway` is drawn as Jo Taylor (Staff) and says "[Bike] · [Size] from [supplier] for £[£] cost". Every order board shows "[Provider] · commission [%]" and "Expected from the provider £[£]", also as Jo. `cw-new` shows "Commission [%] · pays in about [n] days" under Scheme provider.
- Reports and accounts decision 5 (and Stock control's refinement of it): cost and margin are for owners, managers and Staff with "Can see costs and margin". Commission is the shop's margin on the sale and the bike's cost is the same kind of fact. "Expected" is the total less commission, so subtracting gives the commission anyway.

*Why it matters:* the shop would see one rule in Reports and the opposite in Cycle to Work. *Fix:*
1. Hide the cost and the commission from anyone without that switch. They still see the total and "Expected £[£]", which they need to mark a payment. The commission can still be worked out by subtraction; Jack to say whether that matters.
2. Hide cost, commission and the expected amount too: staff see "Waiting for [Provider]". Only people with the switch (and owners and managers) can mark paid (H4, option 1).
3. As drawn.
Recommend 1.

**H4 — `cw-list`, `cw-mark-paid-diff`, `cw-order-anyway`, `cw-cancel`: nothing says who can do each step, and the steps that move money are not logged.**
- The boards show Jo Taylor (Staff) with "Mark paid" on `cw-list`, "Add the certificate" and "Order now anyway…" on the order pages, while the history shows Jack Lewis adding certificates and marking paid. The drawings imply a split and never state it.
- `cw-mark-paid-diff` offers "Close with a reason", which gives up on money a provider owes, and "Save as part paid". `cw-cancel` refunds a deposit. Only "Order now anyway" says it goes in the activity log (decision 4). Management oversight 1 listed nine kinds of line, and its audit (M7) said new kinds need Jack's approval; closing with a reason, part payments, cancelling with a refund and releasing a bike are new kinds.
- Settings › On Today says the late-payment line goes "to owners and managers", and Opening the shop 4 adds anyone with "Can close the day".

*Why it matters:* the money side is the reason this journey exists ("keep on top of it ourselves"). A payment closed with a reason by anyone, with no record, is the easiest way to lose money quietly. *Fix:*
1. No new switch. The customer steps (quote, hold, release, add the certificate, hand over) are for everyone at the front desk. The money steps ("Mark paid", "Save as part paid", "Close with a reason", cancelling an order that holds a deposit, "Order now anyway") are for owners, managers and Staff with "Can close the day", the existing money-side switch. Each money step writes an activity-log line. Jack to approve the new kinds in the log.
2. One new switch, "Can handle Cycle to Work money". Exact; it adds a switch to every person pop-up, which means redrawing each journey's pop-up again.
3. As drawn: anyone does anything, and only "Order now anyway" is logged.
Recommend 1.

**H5 — `cw-quote`, `cw-new`, `cw-new-not-in-stock`, `cw-settings-deposit`: the quote promises a hold the order may not have, and has nowhere to say what happens to a deposit.**
- `cw-quote` has one closing paragraph: "We hold your bike until [date]; once your certificate arrives, it's yours to collect." `cw-new` lets staff untick "Hold the bike" ("Don't hold this one", decision 3), and a bike that is not in stock has no hold at all (`cw-new-not-in-stock`). Both would print a promise the order does not make. Staff cannot see what the quote will say when they untick.
- `cw-settings-deposit` has "Keep it when the bike was ordered in" with the note "Say so on the quote", but the quote has no deposit lines, and does not say what makes the shop order the bike (the certificate, the application, or a deposit).
- Whether consumer law sets rules for a kept deposit is unverified; whoever advises Jack should confirm. The quote should at least state the shop's own rule in plain words.

*Why it matters:* it is a printed promise to a customer, and the customer is the one who loses if it is wrong. *Fix:*
1. The closing paragraph is built from the order. Held: the hold sentence. Not held: "We'll order [Bike] once [your certificate arrives / you've applied / we've taken a £[£] deposit]". A deposit line says "refunded when the certificate arrives" or "not refunded if you pull out after we've ordered the bike", whichever is the shop's rule. Staff see the sentence in the New order pop-up before "Make the quote". Three more quote versions to draw.
2. One paragraph the shop writes once in Settings and every quote carries. Staff cannot tailor it; it is wrong whenever the order differs.
3. As drawn, with the hold sentence simply removed when "Don't hold this one" is ticked. Smallest; deposits stay unmentioned.
Recommend 1.

## Medium

**M1 — `cw-new`, `cw-quote`, `cw-order-held`: it is not clear what "Make the quote" does, and an email may go to a customer unseen.**
- `cw-new`'s button is "Make the quote". `cw-order-held`'s toast then says "Quote emailed to Maya. Bike held until [date]." `cw-quote` has its own "Print" and "Email to Maya" buttons, which suggests emailing is a separate step. The New order pop-up shows no email address and no tick for emailing. Decision 6 says the quote is "sent from the order in one press".

*Why it matters:* an email that leaves the shop without anyone seeing it cannot be taken back, and the customer's address is not on the screen. *Fix:*
1. "Make the quote" opens `cw-quote`, and "Email to Maya" and "Print" are the next press. One click more; staff see what will be sent.
2. "Make the quote" emails at once, as the toast says. Fewest clicks; nothing to check first.
3. A tick in New order, "Email the quote to maya@example.test now", ticked when the customer has an address, with the address shown. The same single click, and the choice and the address are on the screen.
Recommend 3.

**M2 — `cw-today`, `cw-settings`, `cw-list`: the reminders do not reach the person who gave the quote.** Settings says "Remind staff before the hold ends", and the On Today note says these lines go to owners and managers. Opening the shop 4 shows Today's Needs attention only to owners, managers and Staff with "Can close the day". Jo, who gave the quote and holds the bike, sees an amber badge on the list if she opens it, and the sidebar count (M3). *Why it matters:* a held bike that is forgotten is the problem Jack described. *Fix:*
1. Today stays as Opening the shop 4 says. The person who gave the quote is also reminded where she works: a line at the top of the list ("[n] holds ending soon · [n] payments late") and the count (M3). The setting reads "Remind the shop before the hold ends". Nothing to change in Opening the shop.
2. Hold-ending lines also show on Today to every Staff member. A narrow exception to Opening the shop 4, justified because it is not money.
3. As drawn, with only the setting reworded.
Recommend 1.

**M3 — all staff boards, `cw-today`: the sidebar count has no rule, and the boards disagree.** The HTML of `cw-list` and the other order boards says 4; the picture of `cw-list` shows 2; `cw-today` shows none although its Needs attention says 2. Decision 2 says a count "when something needs doing" and does not say what counts. The list itself has one hold ending, one bike ready to order, one ready to hand over and two payments to mark, one of them late. *Why it matters:* Staff do not see Today (Opening the shop 4), so this count is the only nudge they get. *Fix:* one rule, then the same number on every board.
1. Count what is due or late: holds ending soon, bikes ready to order, quotes with no certificate after [n] days, payments late.
2. Count everything with an action button (order, hand over, mark paid).
3. Count only what Today shows (hold ending, payment late).
Recommend 1.

**M4 — `cw-new`, `cw-list`: a held bike looks held only on its own order.** Decisions 1 and 3 take a held bike off sale. `cw-new` says "1 in stock at Bolton" with no word about whether that one is already held. Not drawn: what the Till's search, Stock and the website show for a held bike, and what a second person sees who tries to hold the same bike. *Why it matters:* the likeliest accident is a held bike sold at the till or online. *Fix:*
1. A held bike shows as "Held for Maya Patel until [date]" in Stock and the till's search, the website shows it as sold out, and the New order box says "0 free · 1 held for [Customer]" and will not hold it twice. Needs one note on the Stock and Till boards.
2. A held bike simply drops out of the count everywhere; staff find out why only on the order. Simplest; someone searching Stock sees none and wonders.
3. As drawn.
Recommend 1.

**M5 — `cw-list`: "Order from [supplier]" spends the shop's money in one press, with no price and no way back.** The button on the list creates a supplier order in Deliveries and orders (decision 4). It shows no cost, no confirmation and no undo. *Why it matters:* it sits next to "Open" links that cost nothing. *Fix:*
1. A confirming line: "Order [Bike] · [Size] from [supplier]?" with Order and Cancel. One click more. The cost is added only for people allowed to see it (H3).
2. One press, then a toast "Ordered from [supplier] · Undo" that works until the order is sent to the supplier (what "sent" means is for whoever builds it to say). Fewest clicks; a safety net in the pattern `cw-order-held` already uses.
3. As drawn.
Recommend 2. The rule the shop chose in Settings already acts as the confirmation.

**M6 — `cw-owed`: the "Owed by Cycle to Work providers" page has no way in.** Decision 5 asks for it. It is drawn as the Owner, and nothing links to it: not the list, the sidebar, Today or Reports. Its "Cycle to Work" back link goes to the list. *Why it matters:* the page that answers "who owes us money" cannot be found. *Fix:*
1. A line at the top of the list, "Owed by providers £[£] · [n] late", linking to the page and shown only to people who may see the money (H4), plus a card on Reports.
2. Reports only, for owners, managers and Staff with "Can see reports". The list stays as it is, with its "Collected · waiting for payment" group.
3. No separate page; the "Collected · waiting for payment" group gets a total and a filter by provider. One page fewer; no per-provider totals unless filtered.
Recommend 1.

**M7 — `cw-email`: "See your order" opens a page that is not drawn.** Decision 6 says the order shows in the customer's account on the website. Nothing shows what the customer sees. The order page as drawn includes the commission, the amount expected from the provider and staff names in the history, none of which a customer should see. *Fix:*
1. Draw one customer view: the stage strip, the bike, the hold date and a copy of the quote, with no commission, no provider payment and no staff names. It needs the website account's look; tablet and phone follow.
2. Show only the stage and dates as a status line. Less to draw; the customer cannot see their quote again.
3. Leave it undrawn until the website quote page is built (noted for later), and take "See your order" out of the email until then, so it does not lead nowhere.
Recommend 1.

**M8 — steps of an order's life that are not drawn.** One pass, no choice:
- Where "Applied", "Employer" and "Application reference" are set. `cw-order-applied` shows the result and `cw-order-held` shows the Customer box as read-only text. Decision 4 says "staff tick 'Applied', or note the application reference".
- What follows "Take the deposit at the till" (the order after it is paid), and who triggers the deposit refund when the certificate arrives.
- A bike that was on order arriving: the list has "Certificate received · on order · Due from [supplier] [date]", then "Ready to collect". The order page for these two states is not drawn.
- A bike released and then the certificate arrives: `cw-hold-ending` says "Wheelhouse checks the bike's still here". What the screen says if it is not is not drawn.
- "Save as part paid" and "Close with a reason": the stage strip, the history and the Today line afterwards.
- "Order from [supplier]" and "Hold longer" leave a mark in the history (M10).

**M9 — `cw-order-*`, `cw-new`, `cw-settings`: the edges of the order are not drawn, and "Valid until" has no source.**
- "More…" (labelled "change, cancel") is never opened. If the bike, size, provider or price changes after the quote has been emailed, "Email the quote again" re-sends it; nothing says it becomes a new version or carries a new number.
- `quoteDoc()` prints "Valid until [date]", but `c2wFolds` has no setting for how long a quote is valid, and "No certificate after [n] days" under On Today is a different thing.
- First use: no providers yet (the Scheme provider box would be empty, and Staff cannot open Settings) and an empty list.
- `cw-cancel` is drawn for the deposit case only. Not drawn: a bike already ordered from the supplier, a certificate already received, or whether Maya is emailed.
- Not said: whether the "Certificate received" message is sent when the certificate differs from the quote (`cw-certificate-diff`).

*Fix, "Valid until" (a choice):*
1. It follows the hold length: one number to set. Wrong for a bike that is not held.
2. Its own setting under Cycle to Work: "Quotes are valid for [n] days".
3. Staff pick a date on each quote. One more box in New order.
Recommend 2. The rest is one pass: draw the More menu, a revised quote ("Revised [date]", with the change in the history, never sent without a press), the first-use screens, and the cancel dialog's other cases.

**M10 — `cw-order-held`, `cw-order-ready`, `cw-order-owed`, `cw-order-paid`: "What's happened" is not a full record.** The history has 2, 4, 4 and 2 lines on those boards, and shrinks when an order is paid: the paid order loses the quote, the hold and the certificate. The stage strip's "[date] · [name]" lines have no matching rows for several stages. Decision 1 says each stage records the date, who did it and what matters. No lines exist for adding "Applied", "Order from [supplier]" (with the supplier), "Hold longer", release, the deposit, "Order now anyway" (with its reason), a part payment or "Mark paid" with the provider's reference. "Confirmed the collection with [Provider]" is drawn after the hand-over while the hand-over pop-up asks for it before. *Fix, no choice:* one list that only grows, in time order, with a line for each of those, kept in full on a paid order.

**M11 — accessible names and structure.** In the rendered HTML:
- `cw-list`: the "Mark paid" buttons (two), "Order from [supplier]" and "Hand over" have no customer in their names, so a person hears the same words twice. The "Open" links are named well ("Open Maya Patel's order"). *Fix:* "Mark paid: [Customer] · [Provider]", "Hand over [Customer]'s bike".
- `cw-today`: two "Open the order" buttons and a "Hold longer" button with no names. *Fix:* "Open Maya Patel's order", "Hold Maya Patel's bike longer", "Open [Provider]'s late payment".
- `cw-new`, `cw-new-not-in-stock`: the four drop-down boxes (Customer, Scheme provider, Bike, Accessories) have a plain text heading above them that is not tied to the box, so a screen reader says the current value ("Maya Patel · 07700 900 142") without the word "Customer". *Fix:* tie each heading to its box.
- `cw-list`: the page title is `h1` and the group headings jump to `h3` with no `h2`. The order pages, Today and Settings run in order. *Fix:* the group headings become `h2`.
- `cw-hold-ending`: the two choices are not grouped under a question, so a screen reader hears "Hold longer, radio button" with no context. The settings folds do group theirs. *Fix:* a group with a name, "What to do with the hold".
- `cw-quote`: the paper itself has no heading ("Cycle to Work quote" is bold text); the page's `h2` "The quote" sits above it. Low risk; a heading on the paper helps a printed or emailed copy that is read by a screen reader.
- Not tested: the order the keyboard moves through the stage strip and list, where focus goes when a dialog opens and closes, and whether "More…" opens a menu a keyboard can use.

## Low

**L1** — reminder wording. `cw-order-held` says "we'll remind you the day before" and a badge says "Hold ends in 2 days". Settings has "[n] days before" for staff and `cw-messages` has "A few days before a held bike is released" for the customer. `cw-hold-ending` and the message row say "Your hold ends soon" where decision 6 names the message "Your hold ends on [date]". Use the one number from Settings everywhere, and either use the decision's name or record the change.
**L2** — small targets. The "Open" links on the list and the "Edit" links on providers are 44px high and about 35px wide (read off the screenshot, not measured), under the 44px rule the earlier audits used. Give them 44px of width. "Email the quote again", "Print the quote" and "More…" are plain-text buttons with no outline, so they look like words, not buttons; a hairline outline in the details box fixes it.
**L3** — one box, two units. "Commission" ("A % or a £ amount per bike", `cw-settings-provider`) and "Deposit" ("£[£] or [%] of the price", `cw-settings`) each take one number that could mean either. Add a small £ / % switch beside each box. Providers can only be edited, not retired. Not said: whether changing a provider's commission or days changes orders already open. A choice: 1. new terms apply to new orders and open orders keep the terms they were made with; 2. new terms apply to every open order. Recommend 1.
**L4** — "Ready to collect" is a Cycle to Work stage and also the Workshop tile on `cw-today` ("Ready to collect 4, in the workshop now"). Keep the stage (decision 1's words) and label the tile "Repairs ready to collect". "Put aside" for customers and "held" for staff is consistent with decisions 3 and 6 and needs no change; noted so it is not looked for.
**L5** — who Jack is. `cw-today` signs him in as Manager (the shared Today uses a fixed Manager), while `cw-settings`, `cw-owed` and `cw-messages` sign him in as Owner, and the order and list boards sign in Jo Taylor (Staff). `today()` now takes a person option, so Cycle to Work can pass the same one on every board it draws as Jack (the same fix as Management oversight audit M2).
**L6** — stale words elsewhere. `journeys.mjs` (j06) says "Jack's own Cycle to Work design, to be explained before piece 8. No screens can be proposed until then", and `workflow.mjs` says Cycle to Work "waits on Jack's explanation". Both are out of date now that the screens exist. Settings › Payments' "the scheme pays the shop" is in H1. These sit outside the Cycle to Work drawings and are listed so they are not lost.
**L7** — fewest clicks. Counted by hand from the boards: "Order from [supplier]" is 1; "Mark paid" is 2 (the button, then "Mark paid" in the pop-up); adding a certificate from the list is 3 (Open, "Add the certificate", Save); handing over is 3 or 4 before the till opens (Hand over, up to two ticks, "Hand over at the till"); "Hold longer" from Today is 2, because its pop-up opens with "Hold longer" already chosen. Two to save: "Hold longer" on Today holds at once with a toast "Held until [date] · Undo", and "Release the bike" stays on the order page; and "Add the certificate" is offered on the list row as "Hand over" is. Neither is needed to approve the journey.

## Summary of what to decide

11 recommendations, each a choice between real options; Jack to pick:

1. Fixed wording that states how schemes work (H1, options 1-3).
2. The money split at hand-over (H2, options 1-3).
3. Whether Staff see cost and commission (H3, options 1-3).
4. Who can do the money steps, and logging them (H4, options 1-3).
5. What the quote promises, and the deposit terms (H5, options 1-3).
6. What "Make the quote" does about the email (M1, options 1-3).
7. Who gets the hold reminders (M2, options 1-3), and the rule for the sidebar count (M3, options 1-3).
8. How a held bike shows elsewhere (M4, options 1-3) and the "Order from [supplier]" press (M5, options 1-3).
9. A way into the owed page (M6, options 1-3) and the customer's website view (M7, options 1-3).
10. How long a quote is valid (M9, options 1-3) and whether commission changes reach open orders (L3, options 1-2).

M8, M10, M11 and L1, L2, L4-L7 have a single fix each and are listed so they are not lost.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | hand-over, certificate, certificate-diff, quote, email | Fixed wording states how schemes work; a box starts ticked | Yes (1-3) |
| H2 | hand-over, certificate-diff, new, settings-deposit, order-owed | "Maya pays £0.00" is fixed; deposit and accessories can make it wrong | Yes (1-3) |
| H3 | order-anyway, order pages, new | Staff see cost and commission | Yes (1-3) |
| H4 | list, mark-paid-diff, order-anyway, cancel | Nobody says who does money steps; write-offs unlogged | Yes (1-3) |
| H5 | quote, new, new-not-in-stock, settings-deposit | Quote promises a hold; no deposit terms | Yes (1-3) |
| M1 | new, quote, order-held | "Make the quote" may email unseen | Yes (1-3) |
| M2 | today, settings, list | Reminders miss the person who gave the quote | Yes (1-3) |
| M3 | all staff boards, today | Sidebar count has no rule; boards disagree | Yes (1-3) |
| M4 | new, list | A held bike looks held only on its order | Yes (1-3) |
| M5 | list | "Order from [supplier]" spends in one press | Yes (1-3) |
| M6 | owed | Owed page has no way in | Yes (1-3) |
| M7 | email | "See your order" page not drawn | Yes (1-3) |
| M8 | order boards | Applied tick, deposit, arrival and part-paid steps not drawn | Yes |
| M9 | order boards, new, cancel | More menu, quote changes, first use, cancel cases; "Valid until" has no source | Yes (1-3) |
| M10 | order-held, ready, owed, paid | History shrinks and misses events | Yes |
| M11 | list, today, new, hold-ending, quote | Repeated or missing button names, heading skip | Yes |
| L1-L7 | various | See above | Yes |

## Verification (2 Oct 2026)

Checked by reading: all 25 renders as images; `c2w.mjs` in full; `docs/decisions/2026-10-02-cycle-to-work-review.md` in full; the previous audit `oversight-ui-audit.md` for format; `settings-frame.mjs` (`c2wFolds`, `C2W_INTRO`, area wiring) by search and the lines around them; `setup.mjs` `C2W_MSGS` and `msgListOpen` (lines 280-310) and the "Other ways to pay" row; `opening.mjs` `today()` (its option list and the two `c2w` lines); `ui.mjs` colours, `badge`, `field`, `button` and `card`; the `diary.mjs` sidebar entry, `journeys.mjs` and `workflow.mjs` by search; decision 15 of `2026-09-29-selling-at-the-till-review.md`, decisions 3 and 4 of `2026-09-30-opening-the-shop-review.md`, decisions 9 and 10 of `2026-09-30-owner-setup-review.md`, decision 5 of `2026-10-01-reports-and-accounts-review.md`, decision 6 of `2026-10-01-buy-online-review.md` (by search and the lines around them). Searched the rendered HTML of `cw-list`, `cw-today`, `cw-settings`, `cw-quote`, `cw-new`, `cw-hand-over` and `cw-cancel` for headings, the sidebar count, `role="dialog"`, `aria-modal`, the checkbox state and the label-to-box links in the New order pop-up. The hand-over checkboxes, the count of 4 and the missing radio on `cw-cancel` come from that HTML. I could not run any command in this session (the shell was disabled), so no board was re-rendered and nothing was measured; the three contrast figures are my own arithmetic from the colour codes.

Not checked: how Cycle to Work schemes and providers actually work (H1, H2, H5 and M9 depend on it and say so); whether consumer law sets rules for a kept deposit (H5; not legal advice); keyboard order, focus (including where it goes when a dialog opens or closes), a screen reader, or any browser behaviour; the boards were only seen at 1280 x 800; tablet and phone; the list, order pages and Today as a Manager, as a person in "All shops" or as a Staff member with and without "Can close the day", none of which is drawn (so `cw-list` is also unchecked for a second shop, where a shop label would be needed); the "Open" and "Edit" link widths are read off the screenshots, not measured; the other 22 pictures were not compared one by one with the HTML, so more of them may be out of date than the two noticed; what the order's stage strip, history and Today lines look like for any state this audit lists as not drawn; and whether a "Held" label and a hold can be shown in Stock, the till search and the website without changes to those journeys (M4, a question for whoever builds it).

**Checked afterwards by the main session (2 Oct 2026).** The two differences between the pictures and the HTML came from the pictures being rendered before a last change: `cw-cancel` lost its single "Release the bike" option and the sidebar count went from 2 to 4. All 25 boards were then rendered again from the current files, so the pictures and the HTML now match. H3 confirmed against Reports and accounts decision 5: cost and margin are for people with "Can see costs and margin", and Jo Taylor has it switched off. L6 confirmed: `journeys.mjs` and `workflow.mjs` still describe Cycle to Work as waiting on Jack's explanation.
