# UX walk-through 12: Maya twice, not confident with phones and in a hurry

Issue #116 step 4, WP-W.4, a new story. I walked it on the one canvas, on a phone, from the board HTML and the situation lists. Every customer page was walked twice: as Maya when she isn't confident with phones (**Maya, unsure**) and as Maya in a hurry (**Maya, hurried**). The first-release website now has a fixed design (3 Oct, answer 2). That helps Maya: every shop's site has the same layout, with "Book a repair" and "Shop" first.

## The story

1. Maya finds Shimano brake pads B05S-RX (£28.00) on North Street Cycles' website, with Bolton already chosen, and buys them to collect (journeys 1 and 2).
2. She books a Standard service (£65.00) for her Trek Domane AL 3: Thursday 17 September, arriving 11:30, with "Call me before any extra work". The job is WH-1042 (journey 3).
3. She drops the bike off. Alex Morgan's quote comes by text, and she approves £111.00 (journey 4).
4. The "Bike ready" text comes. She pays, either online or at the counter, and gets a receipt (journey 5).
5. She signs in, opens her receipt and changes how the shop contacts her (journey 7).
6. Separately, a Cycle to Work quote email comes and she checks her order (journey 6).

## Per person: taps and different screens

Typing and switching apps aren't counted as taps. A screen means one board.

| Step | Maya, unsure: taps / screens | Maya, hurried: taps / screens |
|---|---|---|
| Find the pads | 3 / 4 (home, Shop, category, product) | 2 / 3 (home, search, product) |
| Buy and collect | 6 / 6 (basket, checkout, bank check, confirmed, ready email, order) | 5 / 3 (Apple Pay) |
| Book | 9 / 6 (four steps, Request received, booking page) | 7 / 5 ("Book this time") |
| Quote | 2 / 1 | 2 / 1 |
| Ready and pay | 1 / 2 (pays at the counter) | 3 / 3 (pays online) |
| Account | 4 / 4 (menu, Account, sign-in, code, receipt) | 4 / 4 |
| Cycle to Work | 1 / 2, or 3 / 4 if she has to sign in (M4) | the same |
| **Total** | **26 / 25** | **24 / 21** |

The tap counts are close. For Maya, unsure, the cost is in reading, typing and switching between apps. The four booking boards are one real page, and so are the three job boards (`bk-page`, `dq-quote`, `cp-summary`).

## Findings

### H1: She asks for a call and gets a text asking her to approve
1. **Screens:** `bk-bike`, `bk-request`, `bk-page`, `dq-quote` (phone).
2. **What happens:** Maya picks "Call me before any extra work", and her pages repeat "We'll call you before any extra work". What actually comes is a text linking to "Approve £111.00" and "Your answers are final once sent." The shop only calls if she doesn't answer.
3. **Why it matters:** Maya, unsure, chose a call so she wouldn't have to decide on a screen. This breaks a promise about what happens next.
4. **Fix:**
   1. Change the words: "Ask me before any extra work" and "We'll send you the quote to approve, or call us". Costs nothing, but there's no longer a way to ask for a call.
   2. Keep "Call me" and do it: staff phone her and use "Record their answer" (`dq-record-answer`). Costs a call per quote.
   3. Let her choose at booking: "Send me the quote" or "Call me". One more choice on the form.

   Recommend 3: one radio button serves both versions of Maya.
5. **Decision it touches:** Workshop day 41 ("the shop calls them with a quote first"); Drop off 2 and 5; walk-through 1 H1.

8th question: all three fixes are wording or lines. No new drawing.

**Second check:** CONFIRMED — `bk-bike` offers "Call me before any extra work", `bk-request` and `bk-page` say "We’ll call you before any extra work" (and the booking bar's `limit === 'call'` row says "We’ll call you first", `book.mjs:106`), while `dq-quote` is a sent page with "Approve £111.00" and "Your answers are final once sent."; High is right (a promise about what happens next). Not said in the report: walk-through 1's decision (2026-10-02-ux-walkthrough.md, H1 fix) chose "Call me" precisely so the quote is *sent*, and Drop off 5 says a quote is sent "the way the customer chose (text, WhatsApp or email)" — so option 1 changes walk-through 1's example wording, option 2 reopens Drop off 5, and option 3 adds a field to the booking form (a design change beyond the drawings); Workshop day 41's own words ("the shop calls them with a quote first") support option 2.

### M1: None of the joins can be clicked
1. **Screens:** every customer phone board.
2. **What happens:** no in-page button or link points to another board. Each one is `href="#"` or a button with no target. The header's Prev/Next stops at each journey's end:
   - `wb-home` has no route to `bk-service`.
   - `bk-cancel` goes on to `bk-settings`, a staff desktop board.
   - `on-email-ready` goes on to `on-orders`, also a staff board.
   - `dq-quote` and `cp-summary` have no Prev at all.
3. **Why it matters:** none of the hand-overs between journeys can be followed.
4. **Fix, no choice:** wire them up in the step 5 clickable mockup: home to booking, product to basket, each text or email to its page, Pay now to pay online, Account to sign-in.
5. **Decision it touches:** issue #116 step 5.

8th question: links only.

**Second check:** CONFIRMED — the in-page links on the customer boards are `href="#"` or `<button type="button">`; `wb-home` Next is `wb-choose-shop`, `bk-cancel` Next is `bk-settings` (desktop), `on-email-ready` Next is `on-orders` (desktop), and on `dq-quote` and `cp-summary` "‹ Prev" is a greyed-out span, not a link. Severity should be Low, not Medium: it is about the canvas, not anything Maya meets, and making the joins clickable is already issue #116 step 5's job (`.agents/STATUS.md`).

### M2: The texts that bring Maya in aren't drawn
1. **Screens:** `set-msg-list`, `set-msg-edit` (desktop).
2. **What happens:** Maya starts each journey from a text: Request received, Booking confirmed, Quote to approve, Bike ready. Only Bike ready's wording is drawn, as the Settings preview ("£111.00 to pay on collection. See what we did: [link]"). The rest are just names in the list.
3. **Why it matters:** for Maya, unsure, the text is the only way in. It has to say who it's from, what to do, and that she doesn't need an app or a sign-in.
4. **Fix:**
   1. Write draft wording now, as lines, and read it again under Q9.
   2. Leave it all for Q9.

   Recommend 1.
5. **Decision it touches:** build plan Q9.

8th question: lines. Every text uses the same frame (block 46).

**Second check:** CONFIRMED — `set-msg-list` names "Request received", "Booking confirmed" and "Quote to approve" with no wording; only "Bike ready" has wording and a preview on `set-msg-edit`; block 46 is "Email and text frame" (`README.md:164`). The build plan's Q9 is already answered (Jack, 3 Oct, "all recommended": Claude drafts every automatic message as draft wording and Jack reads them all before going live, `2026-10-03-build-plan-questions.md:82–84, 107–113`), so the drafting itself is decided; the only choice left is whether to draft these four now or at Q9.

### M3: The sign-in code can't be pasted or filled in by the phone
1. **Screens:** `jb-cust-code`, `jb-cust-signin` (phone).
2. **What happens:** the code goes into six one-character boxes. They aren't marked as a one-time code, and the email box isn't marked for autofill. The code "works for 10 minutes".
3. **Why it matters:** Maya, unsure, has to switch apps and retype six digits against a timer. Maya, hurried, can't paste the code or use the phone's code suggestion.
4. **Fix, no choice:** one field that looks like six boxes, so paste and the phone's autofill both work. Mark the email box for autofill too. The six digits and 10 minutes stay.
5. **Decision it touches:** Signing in 5.

8th question: a line on `jb-cust-code`.

**Second check:** CONFIRMED — `jb-cust-code` has six `<input inputmode="numeric" maxlength="1">` boxes with no `autocomplete="one-time-code"`, `jb-cust-signin`'s `<input type="email">` has no `autocomplete`, and the page says "It works for 10 minutes"; six digits and 10 minutes are Signing in 5, which the fix keeps.

### M4: Opening the Cycle to Work order may mean signing in
1. **Screens:** `cw-email`, `cw-customer-view` (phone).
2. **What happens:** the email's "See your order" link opens a page whose breadcrumb is "Your account". Nothing says whether it opens without signing in. A repair's link does, and the sign-in page promises "Just checking a booking? Open the link in your text or email — no sign-in needed."
3. **Why it matters:** if it does need signing in, Maya, unsure, hits the code screen (M3) just to check her bike.
4. **Fix:**
   1. Make it a private link that needs no sign-in, like the repair's.
   2. Keep it in the account, and have the email say "Sign in with maya@example.test". That's two more screens for her.

   Recommend 1.
5. **Decision it touches:** Cycle to Work 6 and 7 (M7); Drop off 1.

8th question: a line on `cw-customer-view`.

**Second check:** CONFIRMED — `cw-email`'s "See your order" opens `cw-customer-view`, headed "Your account", and no line says whether it needs signing in; Cycle to Work decision 7 (M7) places the view "in their website account", so option 1 adds to that decision rather than just a line, which the report should say.

### M5: Words Maya needs to make a decision are in small text
1. **Screens:** `dq-quote`, `bk-when`, `wb-category`, `wb-home`, `ac-account` (phone).
2. **What happens:** the page text is 15px, but these are smaller:
   - 13px: "Your answers are final once sent.", "Ready today at Bolton" on product cards, the history lines.
   - 12px: "Needed", "Optional", "Waiting for your answer", and "Full", "Closed" and "[n] times" on the day strip.
3. **Why it matters:** these are the words that matter most, and they're the hardest to read for low vision and for Maya, unsure.
4. **Fix, no choice:** anything she has to read to choose is at least body size, and text follows the phone's text-size setting. The wording stays the same.
5. **Decision it touches:** Drop off 2, 7 and 8 (wording kept).

8th question: a building-block rule, not a drawing.

**Second check:** CONFIRMED — measured in the board HTML: on `dq-quote` "Your answers are final once sent." is 13px and "Needed", "Optional", "Waiting for your answer" 12px against 15px body text; `bk-when` "Full", "Closed" and "[n] times" are 12px; "Ready today at Bolton" is 13px on `wb-category` and `wb-home`; the history lines on `ac-account` are 13px.

### M6: The booking page shows a deposit Maya never paid
1. **Screens:** `bk-page` (phone).
2. **What happens:** the page shows "Deposit paid £[deposit]". Her story has no deposit: `bk-request` has none, the quote says "Nothing to pay today", and the ready page asks for the full £111.00. No situation line covers a confirmed booking without a deposit.
3. **Why it matters:** the page makes a money promise that the rest of her pages contradict, and the build could copy it.
4. **Fix:**
   1. Add a line: "Confirmed, no deposit: no Deposit row".
   2. Redraw the board without the deposit, and make the deposit a line.

   Recommend 1.
5. **Decision it touches:** Book 3 and 4; walk-through 1 M6.

8th question: option 1 is a line.

**Second check:** CONFIRMED that `bk-page` shows "Deposit paid £[deposit]" (`book.mjs:227`, `bookingLines` defaults to a deposit for a non-Lightspeed shop) while `bk-request` and `dq-quote` show none — but REFUTED that no line covers a booking page without a deposit: `bk-page`'s list already has "A drop-off booking, no deposit, the mechanic picked" (drawn with `deposit: false`, `book.mjs:276`) and "A Lightspeed shop: the booking’s page, no deposit". Severity should be Low (the example doesn't agree, like L4), and it hardly needs Jack's choice: option 1 is a one-line addition next to two that exist.

### L1: One thing, several names
- WH-1042 is "Reference" on `bk-request` and `bk-page`, "Your booking · WH-1042" on the quote and ready pages, and "Job WH-1042" in the Bike ready text.
- Cycle to Work: "See your order" in the email, "Your Cycle to Work bike" on the page, "See your quote" on its link.
- Sign-in uses maya@example.com; every other board uses maya@example.test.
- `cp-summary` heads a Standard service "Full service checklist".

**Fix, no choice:** one name for each, added to the word list. Touches Drop off 7 and Collect 5 M1. 8th question: wording.

**Second check:** CONFIRMED — "Reference WH-1042" on `bk-request`/`bk-page`, "Your booking · WH-1042" on `dq-quote`/`cp-summary`, "Job WH-1042" in the `set-msg-edit` preview; "See your order" / "Your Cycle to Work bike" / "See your quote" on `cw-email` and `cw-customer-view`; maya@example.com on `jb-cust-signin` and `jb-cust-code` (and also on the staff board `till-customer`, so "every other board" is not quite right); "Full service checklist" on `cp-summary`. Not said: "Full service checklist" is Jack's name from Workshop day 39, so renaming it touches that decision.

### L2: Buttons that are really links
These lead to another page but are buttons:
- "See your order" on `on-email-ready` (a button in an email goes nowhere) and on `on-confirmed`
- "Book a repair" and "Shop" on `wb-home`
- "Book a repair here"
- the two buttons on `wb-not-found`
- "Book a repair" on `ac-account`
- "Pay £111.00 now" on `cp-summary`

Walk-through 5 L2 fixed only the Cycle to Work ones. **Fix, no choice:** make them links. 8th question: build only.

**Second check:** CONFIRMED — each listed control is a `<button type="button">` (`on-email-ready`, `on-confirmed`, `wb-home` ×5, `wb-not-found` "Go to the home page" and "Our shops", `ac-account` ×2, `cp-summary` "Pay £111.00 now"), while `cw-email` "See your order" and `cw-customer-view` "See your quote" are now `<a>`; Low is right.

### L3: "Collect from" when booking a repair
`wb-choose-shop` asks "Which shop will you collect from?" even when she's booking a repair. The "Your booking" bar never names Bolton. **Fix, no choice:** add two lines: on `wb-choose-shop`, "From booking: 'Which shop will you bring your bike to?'"; on `bk-service`, "The bar names Bolton". Touches walk-through 1 M1 and Buy online 8. 8th question: lines.

**Second check:** REFUTED — booking doesn't use `wb-choose-shop`: with no shop chosen, the booking page asks its own "Which shop?" (Multiple sites 5; `book.mjs:456–461`, `sites.mjs:136–141`), shown by `bk-service`'s line "No shop chosen yet on the website: “Which shop?” first", and with Bolton remembered, `bk-service`'s line "The website already has Bolton: the shop chosen, straight to the service" is drawn by `serviceAfterShopAt` with a "Shop · Bolton · Change" line and a Shop row in the bar (`book.mjs:106, 459–461`). Both of L3's lines are already there.

### L4: The buy-online example numbers don't agree
`on-basket` has 2 pads (3 items). `on-checkout` says "Basket, 2 items" and shows the pads at £28.00. `on-confirmed` shows store credit for a guest who never signed in. **Fix, no choice:** make the examples agree. 8th question: no drawing.

**Second check:** CONFIRMED — `on-basket` shows the pads at quantity 2 with the header "Basket, 3 items"; `on-checkout` has `aria-label="Basket, 2 items"` and "Shimano brake pads £28.00"; `on-confirmed` shows "Store credit £[£]" alongside "Save your details for next time" (a guest).

### L5: Request received is drawn twice
`jb-pending`, an old Release 1 picture, sits beside the current `bk-request`. **Fix, no choice:** label it "Release 1 picture, replaced by `bk-request`". Touches Signing in 10. 8th question: one drawing fewer.

**Second check:** CONFIRMED — `jb-pending` is an image board titled "Request received" (blob `pending` in `blobs-fjell.json`); I opened the source picture (`docs/design/release-1-journey/evidence/screens/pending.png`) and it is the Release 1 "Your request is with us" page for WH-1042, which `bk-request` replaces; Signing in 10 kept those pages "as the Release 1 designs", which the report names. The "8th question" note says "one drawing fewer" but the fix only relabels it.

### L6, L7: Two missing lines
- On `jb-cust-signin`: "From booking: you come straight back to your booking" (Book 6, 9).
- On `cp-pay`: "the same ways to pay as checkout". Checkout draws Apple Pay and Google Pay; `cp-pay` shows only "[The payment provider's secure card form]", so not checked (Buy online 5).

**Fix, no choice:** both are lines.

**Second check:** CONFIRMED (both) — there is no situation list for `jb-cust-signin` on the canvas, and `cp-pay` shows only "[The payment provider’s secure card form]" while `on-checkout` has Apple Pay and Google Pay. For L7, Buy online 5 is about checkout; carrying it to the repair's Pay now is a small extension of that decision, not just a line.

## Checks as other people

- **Screen reader:** the choices are real radio groups, steps are read as "Step 3 of 4", the tracker marks the current step, and the photo and quantity buttons have labels. The problem is L2.
- **Keyboard only:** there's a skip link, and the photo viewer works with the arrow keys and Esc. Focus order not checked.
- **Low vision:** see M5. Nothing is shown only by colour ("taken", "Full" and "Ready today" are words), and nothing relies on hover.
- **Saturday worker** at the hand-overs: Maya is told to "give your name or order number", and Online orders has one search box. They'd also need to know she asked for a call (H1). The rest is walk-through 10's ground.

## Earlier findings on the one canvas

From walk-throughs 1 and 5, still in place:
- the guest sign-in line
- the checks that weren't done are named
- the link expiry lines
- a repair chosen on the website comes pre-ticked
- the reminder link
- Cycle to Work's "See your order" is a link

Partly in place:
- Request received without a deposit (but see M6)
- the remembered shop, which is only a line (L3)

## The end table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | bk-bike, bk-request, bk-page, dq-quote | "Call me", then a text to approve | Yes |
| M1 | all customer boards | No join can be clicked | No |
| M2 | set-msg-list | Texts that bring Maya in aren't drawn | Yes |
| M3 | jb-cust-code | Code can't be pasted or autofilled | No |
| M4 | cw-email, cw-customer-view | Cycle to Work order may need sign-in | Yes |
| M5 | dq-quote, bk-when and others | Words for deciding in 12–13px | No |
| M6 | bk-page | Deposit shown that wasn't paid | Yes |
| L1 | several | Several names for one thing | No |
| L2 | several | Buttons that are really links | No |
| L3 | wb-choose-shop, bk-service | "Collect from" when booking | No |
| L4 | on-basket, on-checkout, on-confirmed | Examples don't agree | No |
| L5 | jb-pending | Request received drawn twice | No |
| L6, L7 | jb-cust-signin, cp-pay | Two missing lines | No |

## Choices for Jack

1. **H1:** 1 change the words, 2 the shop calls, 3 Maya chooses "Send me the quote" or "Call me" (recommended).
2. **M2:** 1 draft the texts now as lines (recommended), 2 leave it for Q9.
3. **M4:** 1 a private link with no sign-in (recommended), 2 keep it in the account.
4. **M6:** 1 a "no deposit" line (recommended), 2 redraw the board.

## Verification

- **Boards read:** text, links, form fields, font sizes and screen-reader markup, all at phone size:
  - Journey 1: every customer board (`wb-off-preview` is staff, so skipped).
  - Journey 2: the six customer boards.
  - Journey 3: the eight customer boards.
  - Journeys 4–7 and B: `dq-quote`; `cp-summary`, `cp-pay` and the receipts; `cw-customer-view`, `cw-email`; the seven account boards; `cust-signin`, `cust-code`.
  - Staff boards, desktop: `on-orders`, `set-msg-list`, `set-msg-edit`.
- **Situation lists:** journeys 1–7, B and 21. I followed every Prev/Next and every in-page link.
- **Code:** `consolidate/j04`, `j05` and `jb`; `app-map.mjs` (the phone menu).
- **Decisions:** Book a repair; Drop off; Collect and pay; the 2 Oct walk-through decisions; Find the shop; Buy online 4 and 8; Account 6; Cycle to Work 6 and 7; Signing in 5; Workshop day 41–43; the build plan answers; Website management's later changes; issue #116 step 4; the drawing rules.
- **Not checked:** what's inside the pictures `j05-ready` and `jb-pending`; anything rendered (zoom, focus); situations that are only lines (judged from their wording).

## Second check

Second reviewer, 3 Oct 2026. Every finding checked against the board HTML, the situation lists in `canvas.json`, the generator (`book.mjs`, `sites.mjs`, `c2w.mjs`, `consolidate/j03.mjs`, `jb.mjs`) and the decision files.

- **Counts:** 13 confirmed (H1, M1–M6, L1, L2, L4, L5, L6, L7), 1 refuted (L3), 0 uncertain. M6 is confirmed on the board but its "no line covers it" part is refuted.
- **Severity changes:** M1 to Low (it is about the canvas, and is step 5's job); M6 to Low (an example that doesn't agree; lines already exist).
- **Decisions not named in the report:** H1's options touch walk-through 1's H1 fix and Drop off 5; M2 is mostly settled by Q9's answer; M4 option 1 adds to Cycle to Work 7; L1's "Full service checklist" is Workshop day 39's name; L7 extends Buy online 5.
- **8th question:** no fix adds a drawing where a line would do.
- **Nothing invented** that I found: the example values (WH-1042, £111.00, £28.00, Alex Morgan, maya@example.test) are on the boards.
- **Missed by the walker (mine):** on `bk-when` the shortcut reads "Earliest you can have Thu 17 Sep, 09:30 · Book this time", while the story's arrival is 11:30 (walk-through 1 M2). So Maya, hurried, who the tap table has using "Book this time", would book 09:30, not the story's 11:30. Low: the example doesn't agree.

