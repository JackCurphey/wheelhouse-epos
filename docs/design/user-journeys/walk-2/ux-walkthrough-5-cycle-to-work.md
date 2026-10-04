# Walk-through 5, second walk: a Cycle to Work bike (one canvas)

Walked 3 Oct 2026 for issue #116 step 4. The method is `ux-walkthrough-script.md` with its three changes: an eighth question ("could this be a line in a situation list?"), screens counted as well as clicks, and the joins walked by following the links in each board's HTML. The canvas walked is the one canvas, built locally at `generator/out/project/` (211 boards). The earlier walk is `../ux-walkthrough-5-cycle-to-work.md` (4 High, 8 Medium, 4 Low). Every recommendation from it was taken (UX walk-through decisions, "Walk-throughs 5 and 6: as built").

## The story

1. Jo Taylor (Staff, desktop) makes Maya Patel's Cycle to Work order at North Street Cycles, Bolton. The quote is emailed and the bike is held (`cw-list`, `cw-new`, `cw-order-held`).
2. Maya gets the quote email and taps "See your order" (`cw-email`, `cw-customer-view`, phone).
3. The hold comes near its end, and Jack Lewis (Owner) presses "Hold longer" on Today (`op-today`, a situation line).
4. The certificate comes in. Jo adds it with "The bike is ready" ticked, and Maya gets "Ready to collect" (`cw-certificate`).
5. Maya comes in. Jo (or the Saturday worker) hands the bike over and puts it through the till, paid by "Cycle to Work · [Provider]" (`cw-hand-over`, then `till-sale`, `till-pay` and `till-receipt`, each in its Cycle to Work situation).
6. The provider pays. Jack records the payment and reads Reports (`cw-owed`, `cw-owed-provider`, `cw-record-payment`, `rp-home`, `rp-c2w`, `rp-margin`).

## Clicks and screens per person

Main path: an in-stock bike, a certificate that matches the quote, nothing added at the counter. Typing isn't counted.

| Person | Clicks | Different screens | Screens |
|---|---|---|---|
| Jo Taylor | about 22 (11 for the order, 3 for the certificate, 8 for the hand-over and till) | 8 | cw-list, cw-new, cw-order-held, cw-certificate, cw-hand-over, till-sale, till-pay, till-receipt |
| Saturday worker (hand-over only) | 8 | 5 | cw-list, cw-hand-over, till-sale, till-pay, till-receipt |
| Maya Patel | 1–2 taps | 2 | cw-email (the texts are its situations), cw-customer-view |
| Jack Lewis | about 10 (1 Today, 5 for the payment, 2 for Reports, 2 for Margin) | 8 | op-today, cw-list, cw-owed, cw-owed-provider, cw-record-payment, rp-home, rp-c2w, rp-margin |

Last time Jo's count stopped at "an unknown number at the till". Now every step has a screen.

## High

None found.

## Medium

**M1 — The joins can't be clicked on the canvas.**
- *Screens:* `cw-hand-over`, `cw-email`, `cw-list`, `cw-order-held` (desktop, phone); `till-sale`, `till-c2w-pick`; `rp-home`, `rp-c2w`; `cw-owed`.
- *What happens:* the only working links are ‹ Prev / Next › (inside one journey) and the till pop-ups' close links. "Hand over at the till" is a button with no destination; that board's Next › goes to `cw-owed`, and the till's board shows the £74.00 brake-pads sale, with the Cycle to Work sale only a situation line. Links drawn as `href="#"`: "See your order" (`cw-email`), every `cw-list` row, `cw-owed`'s provider rows, `rp-home`'s "Cycle to Work: owed and paid" card, the till sidebar's "Cycle to Work". No link at all: the j06 sidebar's "Till" and "Today". Buttons going nowhere: "See what's owed now" (`rp-c2w`), "Take the deposit at the till", "Refund the £[£] deposit", "Open" (`till-c2w-pick`). "Tablet and phone ↗" opens the old canvases, not boards on this one.
- *Why it matters:* the story crosses journeys four times: order to till, till back to order, email to customer page, Reports to owed. None of those can be walked by clicking, so a gap at a join would only show up on paper.
- *Fix, no choice:* step 5's mockup wires each of these to its target screen, ending the address with the right situation (for example `till-sale.html?state=c2w` and `cw-order-held.html?state=collected`). The build fails on any dead link, as step 5 says.
- *8th question:* no drawing is added. The situations become address endings.
- *Decision it touches:* none.

**Second check:** CONFIRMED, severity should drop to Low — `cw-hand-over`'s "Hand over at the till" is a plain `<button>` and its Next › is `j06-cw-owed-desktop.dc.html`; "See your order" (`cw-email`), the `cw-list` rows, `cw-owed`'s provider rows, `rp-home`'s "Cycle to Work: owed and paid" card and `till-sale`'s sidebar are `href="#"`; the j06 sidebar's Till and Today are `<a>` with no `href`; `till-sale` shows the £74.00 pads sale; but issue #116 step 5 already says "A dead link is a bug" and step 4.3 says to walk the joins on step 5's mockup, which isn't built yet, so this is a note on the step order, not a missing screen.

**M2 — Maya's order page has no "what you pay" and no later stages.**
- *Screens:* `cw-customer-view` (phone); `ac-account` (phone).
- *What happens:* the board shows only "Your bike is put aside until [date]". Its situation list adds only "no longer put aside" and "the order cancelled". The page lists Bike, Accessories and "Total (includes VAT) £[£]". It has nothing for Certificate received, Ready to collect or Collected, and no line saying what Maya pays at collection. The texts link to this page. "A certificate for less, order kept" reads "You pay £[£] when you collect. See your order: [link]" (`c2w.mjs`). Only her account's situation list has "with what she pays at collection".
- *Why it matters:* Maya taps the link to check what she owes and sees the full total, with no word on what she pays. That's earlier H4 half-fixed.
- *Fix, no choice:* add three lines to `cw-customer-view`'s situation list. "Certificate received: What you pay at collection £[£]", worked out from the same "Who pays what" figures (£0.00 when the certificate covers it). "Ready to collect: the same line, and come in to collect". "Collected: the bike and its frame number".
- *8th question:* lines only. The layout doesn't change.
- *Decision it touches:* Cycle to Work 6 and 7 (M7); walk-through 5 H4.

**Second check:** CONFIRMED — `customerView()` (`c2w.mjs` 324–334) has only the held, released and cancelled states, with "Total (includes VAT) £[£]" and no "what you pay" line; the text at `c2w.mjs` 307 says "You pay £[£] when you collect. See your order: [link]"; the earlier H4 fix ("The customer view gets a 'What you pay at collection' line") was taken, so this finishes a decision rather than reopening one; Medium is right.

**M3 — The Margin report counts a Cycle to Work bike at full price.**
- *Screens:* `rp-margin`, `rp-c2w` (desktop).
- *What happens:* Margin reads "Margin (sales less cost)". The commission appears only on `rp-c2w` ("Commission £[£]") and in the Xero rows. Nothing on `rp-margin` or in its situation list mentions Cycle to Work or commission.
- *Why it matters:* Jack's persona check asks that the figures match everywhere. For each Cycle to Work bike, Margin shows more than the shop keeps, because the provider's commission is a real cost of that sale.
- *Fix:*
  1. Take the commission off. Add a line to Margin's situation list: "Cycle to Work bikes: margin after the provider's commission". Use the commission from the provider's settings at the sale, and correct it when the bike is marked paid. *Good for:* Jack's margin is true. *Cost:* a day's margin can move after the day is closed.
  2. Leave Margin as it is, with a note: "Cycle to Work commission £[£] isn't taken off here; see Cycle to Work: owed and paid". *Good for:* simpler, and nothing moves after a day is closed. *Cost:* the figure Jack reads most stays too high.

  Recommend 1.
- *8th question:* a line or a note, not a drawing.
- *Decision it touches:* Reports and accounts 5 (margin); Cycle to Work 5; walk-through 5 H3.

**Second check:** CONFIRMED, citation wrong — `rp-margin` has "Margin (sales less cost)" and "What it cost you" with no Cycle to Work or commission line, and the canvas has no `j17_sit_rp-margin` list; but Reports and accounts 5 is the two permission switches, the Margin report is decisions 1 and 8; the trade-off also leaves out that card fees aren't taken off Margin either, so option 2 matches how other payment costs are treated.

**M4 — The cancel board shows an order in a state that can't happen.**
- *Screens:* `cw-cancel` (desktop).
- *What happens:* the order says "not in stock". Its Next box still says "Waiting for a £[£] deposit before ordering", with "Take the deposit at the till". Its history already says "Jo Taylor took a £[£] deposit at the till · sale B1-[0000]", with no "ordered" line, even though the rule is "order straight away with a deposit". The pop-up then says "[Bike] · [Size] goes back on sale at Bolton" about a bike that was never in the shop.
- *Why it matters:* whoever builds from this board copies the wrong words. Jo would be told a bike goes back on sale when there isn't one.
- *Fix, no choice:* draw the board in its "Deposit paid, bike ordered" state, so the Next box matches the history. Make the pop-up's first line follow the bike: "goes back on sale" when the bike is in stock, nothing when it was never ordered, and the existing "Cancelling after the bike was ordered" line once it has been. Add "Cancelling before the bike is ordered" to the situation list.
- *8th question:* a corrected board and one line.
- *Decision it touches:* Cycle to Work 4; walk-through 5 M8.

**Second check:** CONFIRMED — the board is built from `orderPage({ next: 'deposit', … hist: ['quote', 'toOrderDep', 'deposit'] })` with the in-stock pop-up (`c2w.mjs` 393, 247), so it shows "Waiting for a £[£] deposit", the deposit already taken, no "ordered" line, and "goes back on sale at Bolton"; one caution: "Deposit paid, bike ordered" is also the state of the existing line "Cancelling after ordering: the deposit kept" (`c2w.mjs` 396), so the fix should say the base board shows the refund rule, so the two don't become the same drawing.

## Low

**L1 — Words.**
- *Screens:* the till boards, `cw-applied`, `cw-order-anyway`, `cw-cancel`, `cw-certificate` and the staff search.
- *What happens:*
  - The till's shop button is read out as "Switch site". The word list says "shop" (walk-through 7 L1).
  - On boards where the bike is not in stock, the history still says "it says the bike is put aside until [date]".
  - The certificate's tick is on, but its grey line describes leaving it off: "Untick if it needs work first. Maya is sent 'Certificate received' now…". The Saturday worker could read that as what the tick does.
  - The search box reads "Search jobs, customers, products", but it also finds an order by quote or certificate number (`till-search` situation).
- *Fix, no choice:*
  - Change "Switch site" to "Shop: Bolton. Choose a shop".
  - When the bike isn't in stock, the history follows the quote's own sentence.
  - The grey line reads "Leave it ticked if the bike can go now. Untick it if it needs work first."
  - The search box reads "Search customers, jobs, orders, products".
- *8th question:* wording only.
- *Decision it touches:* none reopened.

**Second check:** CONFIRMED — the till boards' shop button has `aria-label="Switch site"` (`till-sale`, `till-pay`, `till-receipt`, `till-c2w-pick`, `till-search`) against the word list's "Shop: Bolton. Choose a shop" (`ux-walkthrough-script.md` 126); `cw-applied` and `cw-order-anyway` say "it says the bike is put aside until [date]" beside "not in stock"; `cw-certificate`'s tick is checked with the grey line "Untick if it needs work first…"; the search box reads "Search jobs, customers, products".

**L2 — Situation lists that need tidying.**
- *Screens:* `op-today`, `till-sale`.
- *What happens:* `op-today` has the line about a hold that ended with no choice and a deposit to refund twice, once "from journey 6" and once from Opening. On `till-sale`, the Cycle to Work lines cite "Till 5, 11, 12; Customer service 10" but not Cycle to Work 5, which is the decision behind them.
- *Fix, no choice:* keep one copy of the Today line, and cite Cycle to Work 5 on the till lines.
- *8th question:* this one is about the lists themselves.

**Second check:** CONFIRMED — `op-today` has both "Today: a hold ended with no choice, a deposit to refund" (from journey 6) and "Today: a Cycle to Work hold that ended with nobody choosing, and a deposit to refund" (`consolidate/j06.mjs` 64 notes `cw-today-choose` is the same board as `op-today-c2w`); the two `till-sale` Cycle to Work lines cite "Till 5, 11, 12; Customer service 10" and not Cycle to Work 5, which sets the till hand-over.

**L3 — Low vision: small status text.**
- *Screens:* `cw-list`, `rp-c2w`.
- *What happens:* on `cw-list`, "Hold ends in [n] days", "Ready to order" and the top line ("1 payment late") are 12px. So are the column headings on `rp-c2w`. Hints in the pop-ups are 13px. After a Cycle to Work sale, the till's Paid box ("Her order is now Collected") closes by itself after 5 seconds. Your settings' "Don't close things by themselves" already covers that (walk-through 1 L7).
- *Fix, no choice:* any text that carries a status is at least 14px.
- *8th question:* a written rule, not a drawing.

**Second check:** CONFIRMED, one citation wrong — on `cw-list` the top line, "Hold ends in [n] days" and "Ready to order" are 12px, `rp-c2w`'s column headings are 12px, `cw-certificate`'s hint is 13px, and `till-receipt` says "Next sale starts in 5 seconds"; the timer finding is walk-through 1 L6 (`ux-walkthrough-1-repair.md` 165), not L7; the setting is in `app-map.mjs` 167.

**L4 — No Staff line in the More menu.**
- *Screens:* `cw-order-held` (its More situation), `cw-cancel`.
- *What happens:* Maya rings on a Saturday to cancel. "More: change or cancel the order" and `cw-cancel` are marked Owner and Manager. Cancelling an order that holds a deposit is a money step (Cycle to Work 7, H4). No line says what Jo or the Saturday worker sees.
- *Fix, no choice:* add a line, "More, as Staff". Staff can cancel an order with no deposit. With a deposit, they read "A deposit is held: ask a manager to cancel".
- *8th question:* one line.
- *Decision it touches:* Cycle to Work 7 (H4); not reopened.

**Second check:** CONFIRMED, but the fix narrows a decision — `cw-more` is drawn as Owner (`c2w.mjs` 391), its line says Owner and Manager, and `cw-hand-over` shows Jo (Staff) a "More…" button with nothing drawn for her; Cycle to Work 7 (H4) also lets Staff with "Can close the day" do money steps, which the fix leaves out, and whether Staff can cancel an order with no deposit isn't settled by the decision (its customer steps are quote, hold, release, certificate, hand over), so that part belongs in `decided-while-building.md` or with Jack.

**L5 — Edge cases still not drawn or listed.** No choice is needed until they're drawn.
- The internet drops during the Cycle to Work sale (the till's offline lines don't say what happens to the order).
- The card for Maya's part is declined after the provider's line has gone on.
- Maya isn't yet a customer when the order is made: New order's Customer box still has no "add someone new" (earlier L4).
- A bike comes back after the provider has paid.


**Second check:** CONFIRMED — `till-sale`'s offline lines and `till-refund`'s lines don't mention a Cycle to Work order, no card-declined line mentions the provider's payment, and `cw-new`'s Customer box is only a picker ("Maya Patel · 07700 900 142") with no "add someone new".

## Earlier findings: what the one canvas shows now

- **Fixed:** H1 (the till sale, as lines on `till-sale`, `till-pay`, `till-receipt`, with `till-c2w-pick` drawn; judged from the old code in `till.mjs`), H2 (the deposit isn't taken off the price; refunding it is the next step), M1 (the "bike is ready" tick, on by default), M2 (`rs-receive` lines), M3 (holds), M4 (`till-serial`, `wb-product` lines), M5 (`cs-page`, `ac-account`, `till-search` lines), M6 ("the way each customer chose"), M7 (`cw-owed-provider`, `cw-record-payment`), L1, L2 ("See your order" and "See your quote" are links), L3.
- **Partly fixed:** H3 (Takings, the day's report, the cash-up, Xero and `rp-c2w` done; Margin still open, M3), H4 (pop-ups and texts done; Maya's page not, M2), M8 (messages and lines done; the base board is wrong, M4).
- **Still open:** L4's edge cases (now L5).
- **Not checked:** whether the stock-take board with the Cycle to Work note is on the canvas; where "Ask the shop a question" goes.

## The end

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | cw-hand-over, cw-email, rp-home, till boards | No join in the story can be clicked | No |
| M2 | cw-customer-view | Maya's page has no "what you pay" and no later stages | No |
| M3 | rp-margin, rp-c2w | Margin ignores the provider's commission | Yes (1–2) |
| M4 | cw-cancel | The cancel board's state contradicts itself | No |
| L1 | till, cw-applied, cw-certificate, search | Words | No |
| L2 | op-today, till-sale | A doubled line and a missing decision reference | No |
| L3 | cw-list, rp-c2w | 12px status text | No |
| L4 | cw-order-held More, cw-cancel | No Staff line in the More menu | No |
| L5 | — | Edge cases not drawn | No |

## Choices for Jack

1. **Margin and the provider's commission (M3).**
   1. Margin takes off the commission for Cycle to Work bikes. Jack's margin is true, but a closed day's figure can change when the provider pays.
   2. Margin stays as it is, with a note pointing to the Cycle to Work report. Simpler, but the margin Jack reads stays too high.

   Recommend 1.

## Verification

- **Boards read** from their HTML (text, links, ticks, font sizes, `aria-current`) with an extractor kept in the session scratchpad: all 18 journey 6 boards; `till-sale`, `till-c2w-pick`, `till-pay`, `till-serial`, `till-receipt`; `rp-home`, `rp-c2w`, `rp-takings`, `rp-day`, `rp-margin`, `rp-accounts-connect`; `op-today`, `set-msg-list`, `cs-page`, `ac-account`, `till-search`; the j16 cash-up boards for "Cycle to Work" only.
- **Canvas notes:** every j06, j11 and j17 situation list, every other line mentioning Cycle to Work; there is no "later" list for j06, j11 or j17.
- **Source:** `consolidate/j06.mjs`, and the Cycle to Work parts of `c2w.mjs`, `till.mjs`, `reports.mjs`, `stock.mjs`, `receiving.mjs`.
- **Decisions:** Cycle to Work in full; the UX walk-through decisions (walk-through 5 "as built"); the 3 Oct build-plan questions; the 3 Oct later changes (none on the Cycle to Work file); Selling at the till 9 and 15.
- **Not checked:** a real screen reader, keyboard focus and zoom (fixed frames); tablet; two shops; how real providers pay; "Ask the shop a question"; the stock-take board. Clicks are worked out from the boards, not timed.
- **Seen outside this story:** `rp-home` doesn't yet show the 3-figure strip from Reports' 3 Oct later change (question 1). It bears on Jack's first persona check, but it isn't specific to Cycle to Work, so it's left to the Reports and two-shop walks.

## Second check

Checked 3 Oct 2026 by a second reviewer against the board HTML in `generator/out/project/`, `canvas.json`'s notes, `c2w.mjs`, `consolidate/j06.mjs`, the Cycle to Work and Reports decisions, and issue #116.

- **Counts:** 9 findings checked. 9 confirmed, 0 refuted, 0 uncertain. Severity: M1 should drop to Low. Corrections: M3's decision reference, L3's walk-through 1 reference, and L4's fix (it leaves out Staff with "Can close the day").
- **Not re-checked:** the click and screen counts. They were not recounted.
- **Found by the second reviewer (mine):**
  - The stock-take board with the Cycle to Work note is on the canvas: `tk-diff` and `tk-start` say "Bikes held for Cycle to Work orders are expected on the shelf and counted". That closes the walker's first "Not checked" item.
  - "Ask the shop a question" on `cw-customer-view` is a plain button with no destination (`c2w.mjs` 333). It belongs in M1's list.
  - "Earlier findings" lists H3 as partly fixed because of Margin. But H3's recommended fix (earlier report, option 1) never included the Margin report, and everything it named is drawn. So M3 is a new finding, not something left over from H3.
  - No finding adds a drawing where a situation-list line would do. No data or wording was invented. Every example uses the canvas's own placeholders.

