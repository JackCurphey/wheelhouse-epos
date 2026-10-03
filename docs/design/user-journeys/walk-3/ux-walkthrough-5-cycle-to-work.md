# Walk-through 5, third walk: a Cycle to Work bike (clicked on the mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup built in `generator/out-mockup/` (the published one is https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi). Each step of story 5 in `generator/mockup/stories.mjs` was followed through the drawing the mockup shows and the target every button actually has, as each person, at desktop (Jo's and Jack's size), then tablet and phone. Maya's pages were walked at phone first. A scratchpad script listed each step's text and every control with its target; nothing was saved to the repo. The second walk is `../walk-2/ux-walkthrough-5-cycle-to-work.md`. Its findings, and Jack's 3 Oct answers to them, are not raised again here.

## The story, as the mockup clicks it

1. Jo Taylor (Staff, desktop): `cw-list` › "+ New Cycle to Work order" › `cw-new` › "Make the quote" › `cw-quote` › "Email to Maya".
2. Maya Patel (phone): `cw-email` › "See your Cycle to Work bike" › `cw-customer-view`.
3. Jack Lewis (Owner): on Today, "Hold Maya Patel's bike longer" (`op-today-c2w` › `cw-today-held`).
4. Jo: `cw-list` › "Add Maya Patel's certificate" › `cw-certificate` › "Save" › `cw-order-ready` › "Hand over" › `cw-hand-over` › "Hand over at the till" › `till-c2w` › "Take payment" › `till-c2w-pay` › "Cycle to Work · [Provider]" › `till-c2w-paid`.
5. Jack: `cw-owed` › `cw-owed-provider` › "Record a payment" › `cw-record-payment` › "Save", then Reports › Cycle to Work: owed and paid › All reports › Margin and stock value.

## Clicks and screens per person

Counted from the story's named buttons; typing and picking from lists aren't counted.

| Person | Clicks | Different screens |
|---|---|---|
| Jo Taylor (desktop) | 9 | 9 |
| Maya Patel (phone) | 1 | 2 |
| Jack Lewis (desktop) | 8 | 8 |

At phone size Jack can't reach Reports from `cw-owed-provider` (the phone menu has no Office room). That is already listed for Jack in `mockup-gaps.md` (story 5, step 18), so it isn't raised again. Every step of this story is drawn at all three sizes; no step falls back to the desktop drawing.

## High

None found.

## Medium

**M1 — Maya's "See your quote" opens Jo's staff screen.**
- *Screens:* `cw-customer-view` (phone, tablet, desktop) › `cw-quote`.
- *What happens:* on her own order page Maya taps "See your quote". The mockup opens `cw-quote`, "The quote, to print or email", drawn as Staff: Wheelhouse's staff sidebar with "Jo Taylor · Staff · Sign out" on desktop, the staff menu on phone, and "Print" and "Email to Maya" buttons. Her two other order pages (`cw-customer-released`, `cw-customer-cancelled`) do the same.
- *Why it matters:* a customer is shown the staff app, with buttons only Jo should press. On the canvas the link just said "a link", so this only shows up by clicking.
- *Fix, no choice:* "See your quote" opens the quote document itself, the one the email already attaches ("Attached: Quote [quote number]"), as a PDF. In the mockup that is a note saying it happens outside Wheelhouse, like "Download receipt (PDF)" on a repair. No new drawing.
- *Decision it touches:* the first walk's L2 ("See your order" and "See your quote" are links), taken; Cycle to Work 7. Not reopened: neither says what the link opens.

**Second check:** CONFIRMED. I read the drawing again: `cw-customer-view` has "See your quote → cw-quote" at all three sizes, and `cw-quote`'s role is Staff, with the staff sidebar on desktop and "Open menu → staff-app-menu" on phone. `cw-email` reads "Attached: Quote [quote number]". No decision in the Cycle to Work file or its 3 Oct later changes says where the link goes. Walk-2 didn't raise it.

**M2 — Paying with the certificate alone ends on a receipt with a card payment and an extra accessory.**
- *Screens:* `till-c2w-pay` › `till-c2w-paid` (all sizes).
- *What happens:* Maya's order says "Maya pays at collection £0.00" (`cw-certificate`, `cw-order-ready`, `cw-hand-over`), and the basket on `till-c2w` holds only the bike and the order's two accessories. Jo presses "Cycle to Work · [Provider] · £[£]". The next screen, the only paid screen drawn, reads "Paid Cycle to Work · [Provider] and card", lists "Card · Maya Patel £[£]", and the basket now has a third accessory "added at the counter". The drawn screen for that case, `till-c2w-extra`, is never on the way.
- *Why it matters:* this is a money promise. Maya was told she pays nothing, and the screen Jo sees straight after says she paid by card. A builder copying the click path would wire the certificate-only payment to a two-payment receipt.
- *Fix:* a real choice; see Question 1.
- *Decision it touches:* Cycle to Work 5 (the till hand-over); Selling at the till 7. Not reopened.

**Second check:** CONFIRMED. I re-read `till-c2w-pay` and `till-c2w-paid` at desktop, tablet and phone. `till-receipt`'s only situation is `till-c2w-paid`, and its canvas line is "Cycle to Work paid — both payments". No line or drawing shows a paid box for the certificate on its own. `till-c2w-extra` is drawn ("An accessory added at the counter — Maya pays for it as a second payment"), but no story button leads to it. Walk-2 judged the till lines from the code and didn't click the join.

**M3 — The story's Today step is the wrong Today, and it contradicts itself.**
- *Screens:* `op-today-c2w`, `cw-today-held`, `cw-today` (Owner, all sizes).
- *What happens:* the story says "the hold comes near its end", and Jack presses Hold longer. The mockup puts him on `op-today-c2w`, where the hold has already *ended*. The same Needs attention list shows "Maya Patel · Cycle to Work hold ended [date] — choose · still held · no certificate yet" *and* "Deposit to refund · Maya Patel · Cycle to Work · certificate added [date] · £[£] back the way it was paid". Her bike is in stock and held, so no deposit was taken. After "Hold Maya Patel's bike longer", the toast's "Undo" goes to `cw-today`, a different Today ("Cycle to Work quote, no certificate yet · held until [date]", with "Hold longer" and "Open the order"), not back to where Jack pressed.
- *Why it matters:* Jack reads that Maya has no certificate and that her certificate was added, on one screen. Undo appears to take him somewhere else.
- *Fix, no choice:* the story's Today step is `cw-today`, the hold-near-its-end Today, which is already drawn. Its "Hold longer" leads to `cw-today-held`, and Undo comes back to it. On `op-today-c2w` the deposit line names "[Customer]", not Maya, so the board agrees with itself.
- *Decision it touches:* Cycle to Work 3 (holds); Opening the shop 3, 4. Walk-2 L2 (one copy of the Today line) is separate and not re-raised.

**Second check:** CONFIRMED. I re-read the three boards' text. `cw-today` is drawn and its line is "Today: no certificate yet, a payment late". `cw-today-held`'s "Undo → cw-today". `op-today-c2w` and `cw-today-choose` show the same two Maya lines. Cycle to Work 3 says a held bike needs no deposit (deposits are for bikes ordered in). This isn't walk-2's L2, which was about the line appearing twice.

## Low

**L1 — The order's history credits the wrong person.**
- *Screens:* `cw-certificate`, `cw-order-ready`, `cw-hand-over` (desktop).
- *What happens:* Jack pressed Hold longer on Today, but the history reads "Jo Taylor held the bike longer, until [date]". Jo, signed in as "Jo Taylor · Staff", presses Save on the certificate, and the next screen's history reads "Jack Lewis added certificate [certificate number] … and marked the bike ready to collect".
- *Fix, no choice:* the history lines name whoever pressed the button in the drawings before them: "Jack Lewis held the bike longer", "Jo Taylor added certificate". Example names only; no new data.
- *Decision it touches:* none (the activity log's "who did what" rule is unchanged).

**Second check:** CONFIRMED. The text was read on all three boards. `cw-today-held`'s toast belongs to Jack's Today. The sidebar on `cw-certificate` is Jo's.

**L2 — Close and Save go somewhere that doesn't follow.**
- *Screens:* `till-c2w-pay`, `till-c2w-paid` (all sizes); `cw-record-payment` (desktop, tablet).
- *What happens:* "Close" on the Cycle to Work payment box goes to `till-sale`, a different sale: Shimano brake pads and a brake fitting, "Total £74.00". Maya's basket isn't there. "Close" on the paid box goes to the same £74.00 sale, not the empty till. "Save" on Record a payment returns to `cw-owed-provider` unchanged: Maya's row still reads "£[£] by [date] — Mark paid".
- *Fix, no choice:* "Close" on a till pop-up goes back to the screen before. "Close" after payment goes to the empty till (`till-empty`), as "No receipt" already does. Add a line to `cw-owed-provider`: "After Record a payment: the ticked bikes leave the list, with what was recorded". It follows `cw-order-paid`, which is already drawn for one order.
- *Decision it touches:* none.

**Second check:** CONFIRMED. The targets are `till-c2w-pay` "Close → till-sale", `till-c2w-paid` "Close → till-sale" and "No receipt → till-empty", and `cw-record-payment` "Save → cw-owed-provider". `till-sale` reads "Total £74.00". `cw-owed-provider` has no situation lines on the canvas.

## Dropped at the second check

- **The phone Owner can't reach Reports** (step 18). It is already in `mockup-gaps.md` for Jack.
- **Maya's later stages and "What you pay at collection" don't show on her page in the mockup.** These are lines on `cw-customer-view` (walk-2 M2, done as lines). The mockup only shows drawings, so they can't be clicked. This is the general point in story 8's Question 1, not a new Cycle to Work finding.
- **Margin doesn't take off the commission.** Jack answered this on 3 Oct (Reports and accounts, later change, walk-through 5 M3), and it is a line on `rp-margin`.
- **Staff cancelling from More.** Jack answered this on 3 Oct (Cycle to Work, later change, walk-through 5 L4).
- **"Next sale starts in 5 seconds" on `till-c2w-paid`, and 12px status text on `cw-list` and `rp-c2w`.** Walk-2 already raised these (L3). They are still 12px in the drawings. At phone size `rp-c2w`'s column headings and `cw-owed`'s "£[£] · [n] days" late figure are 12px too. These come under the same walk-2 fix, so they aren't raised again.

## Walk-2 findings, checked in the mockup

| Walk-2 | In the mockup |
|---|---|
| M1 joins not clickable | Fixed: every join in the story clicks, at every size, except the phone Owner's Reports (listed gap) |
| M2 Maya's page | Lines on the canvas; not visible in the mockup (see Dropped) |
| M3 Margin and commission | Answered by Jack; a line |
| M4 the cancel board | Not on this story's path; not checked |
| L1 words | Fixed: the till's shop button reads "Shop: Bolton. Choose a shop"; the certificate's hint reads "Leave it ticked if the bike can go now…"; the search box reads "Search jobs, customers, orders, products" |
| L2 doubled Today line | `op-today-c2w` and `cw-today-choose` are still the same board (M3 touches it) |
| L3 12px status text | Still open |
| L4 Staff in More | Answered by Jack; a line |

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | cw-customer-view › cw-quote | Maya's "See your quote" opens the staff app | No |
| M2 | till-c2w-pay › till-c2w-paid | Certificate-only payment ends on a two-payment receipt | Yes (Q1) |
| M3 | op-today-c2w, cw-today-held, cw-today | Wrong Today on the story's path; Maya both with and without a certificate | No |
| L1 | cw-certificate, cw-order-ready | History names the wrong person | No |
| L2 | till-c2w-pay, till-c2w-paid, cw-record-payment | Close goes to another sale; Save changes nothing | No |

## Verification

- **Walked:** every step of story 5 at desktop, tablet and phone in `generator/out-mockup/` (`manifest.json`, `data/j06-*`, `j10-*`, `j11-*`, `j17-*`). I read each step's text and every control's target, and checked the inline font sizes of 12px and under at phone size. I also read `cw-today`, `cw-today-choose`, `till-c2w-extra`, `till-sale`, `cw-hold-ending` and the canvas situation lines for the screens above (`out/project/canvas.json`).
- **Checks run:** `node --test docs/design/user-journeys/generator/mockup/` passes 4 of 4. It only proves each named button leads to the next step, not that the next step makes sense.
- **Decisions read:** Cycle to Work in full, with its 3 Oct later changes; Reports and accounts' 3 Oct later changes; the second walk's smaller questions (`2026-10-03-ux-walkthrough-second-walk.md`); `mockup-gaps.md`.
- **Not checked:** the rendered page in a browser. Fonts set by the stylesheet were not checked (only sizes written into the drawing). Also not checked: a screen reader, keyboard focus, zoom, or the cancel and deposit paths.

## Questions for Jack

1. **When Maya pays with only the certificate, what does the till show after (M2)?**
   1. Draw the paid box for the certificate alone: "Paid · Cycle to Work · [Provider]", with nothing from Maya. The two-payment box stays as a situation, reached when something is added at the counter. *Good for:* the main path shows what really happens, and a builder copies the right thing. *Costs:* one more drawing on the canvas.
   2. Keep the drawings, and make the story add an accessory at the counter, so it goes through `till-c2w-extra` and ends on the two-payment box. *Good for:* no new drawing, and the trickier case gets walked. *Costs:* the plain path ("Maya pays £0.00") is never shown paid anywhere.
   3. Leave it as it is. *Good for:* no work. *Costs:* the mockup keeps telling anyone who clicks through that Maya paid by card.

   Recommend 1.
