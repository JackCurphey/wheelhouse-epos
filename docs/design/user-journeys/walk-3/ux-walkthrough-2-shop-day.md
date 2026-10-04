# UX walk-through 2, third walk: a shop day (clickable mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup (`generator/mockup/`, built into `generator/out-mockup/`). I followed story 2's 31 steps in `mockup/stories.mjs` through the drawings the mockup shows and the targets `controls.mjs` `resolve()` gives each button, as Jo at the desktop till, then at tablet and phone. A scratchpad script listed each step's screen text and every control with its target. I didn't see it rendered. The second walk is `../walk-2/ux-walkthrough-2-shop-day.md`; anything it raised that Jack has answered is not raised again.

## The story, as the mockup clicks it

1. Jo checks in at Till B1 (`till-checkin`), presses Looks right on the float (`op-float-check` → `op-float-matched`).
2. Jo sells two Shimano brake pads and Fit & adjust brakes (£74.00), takes £4.00 off (`till-discount` → `till-discounted`, £70.00), splits £20.00 cash and £50.00 card, and emails the receipt to a customer who isn't on the sale (`till-receipt` → `cp-receipt-address` → `cp-receipt-email-guest`).
3. Jo opens Past sales, opens Maya's sale and refunds one pad to the card (`till-find` → `till-sale-detail` → `till-refund`).
4. Jo opens Online orders, opens Maya's order and marks it ready (`on-orders` → `on-order-staff` → `on-orders-ready`). Maya gets the email and opens her order (`on-email-ready` → `on-order-ready`).
5. Maya comes in; Jo finds the order from the till's search and hands it over (`till-search` → `till-collect` → `till-empty`).
6. Jack Lewis closes the day (`eod-entry` → `eod-count` → `eod-count-result` → `eod-banking` → `eod-finish` → `eod-z`).

## Clicks and screens, per person

| Person | Clicks the story presses | Different screens | Notes |
|---|---|---|---|
| Jo (desktop) | 16, plus 4 PIN digits, a discount reason, the cash amount, the email address and a refund reason | 20 | On a phone two steps can't be clicked (Add a discount, Past sales), listed in `mockup-gaps.md` |
| Maya | 1 | 3 | The guest receipt email, the ready email, her order page |
| Jack Lewis | 5, plus 4 PIN digits and the cash count | 6 | |

## High

**H1 — One sale, three different records: £70.00 split on the till, "Card · £74.00" on Paid, and a £111.00 repair in the emailed receipt.**
- *Screens:* `till-split-discounted`, `till-card-discounted` → `till-receipt` → `cp-receipt-address` → `cp-receipt-email-guest` (all three sizes); then `till-find`, `till-sale-detail`.
- *What happens:* Jo takes £70.00 after the £4.00 discount: "Cash £20.00 · Still to pay £50.00", then the card for £50.00. The next screen, `till-receipt`, says "Paid · Card · £74.00 · receipt B1-[0000] · £74.00", over a basket with no discount at £74.00. Jo presses Email, and the email the customer gets (`cp-receipt-email-guest`) is for "WH-1042 · Trek Domane AL 3": Standard service £65.00, pads £28.00, Fit & adjust £18.00, "Total £111.00 · Paid by Card". Then Past sales lists that sale as "Maya Patel · 3 items · card · £74.00", and its detail shows "Total · card £74.00" with no discount and no cash. But the sale had no customer ("Receipt B1-[0000] · no customer on this sale").
- *Why it matters:* a receipt is the shop's record of the money and the customer's proof for a return. Built from these drawings, the receipt step and the email could show the wrong total and the wrong way paid. Jo, refunding later, sees a different sale from the one rung up.
- *Fix, no choice:* draw the discounted path to the end, as the payment boxes already are: `till-receipt` reads "Paid · £70.00 · Cash £20.00 · Card £50.00", and the guest email shows the pads ×2, Fit & adjust, "Discount −£4.00", "Total £70.00", "Paid by Cash £20.00 and Card · [card ending] £50.00". Where `till-find` and `till-sale-detail` stand for this sale in the story, they show "No customer", the discount and both payments. Or the story uses another sale, and says so.
- *Decision it touches:* walk-through decision 6 (2 Oct), "'Take payment' and 'Split payment' drawn from the discounted £70.00". This carries it to the receipt; it doesn't reopen it.
- *Second check:* CONFIRMED at desktop, tablet and phone. `till-receipt` has only one situation (`till-c2w-paid`), so no discounted receipt exists. Walk-1 M11 and decision 6 covered only the payment boxes, and walk-2 didn't follow the receipt. High, by the script's rule: a broken promise about money.

## Medium

**M1 — Mark ready on Maya's order is greyed out, but the story (and the mockup) presses it. Her "ready to collect" page still has an item on its way.**
- *Screens:* `on-orders`, `on-order-staff`, `on-orders-ready`, `on-order-ready` (all sizes).
- *What happens:* Maya's order on `on-orders` says "Waiting for 1 item": "[Product] … On its way from [Second site]". Opened, it says "Mark ready isn't available yet: 1 item is still on its way from [Second site]", and Mark ready is `aria-disabled` at 45% opacity. The mockup still wires it to `on-orders-ready`, whose "Ready" row and Undo name "[Customer]", not Maya. Maya's page then says "Your order is ready to collect" over "[Product] … Coming from [Second site]".
- *Why it matters:* followed as clicked, Maya is told to come in for an order with an item still on the road. The rule (Mark ready waits) is drawn, but the customer's ready page breaks it.
- *Fix, no choice:* on `on-order-ready`, both items are "On the shelf at Bolton". The story follows the order that is all on the shelf: its row has Mark ready on the list itself, one click instead of two. The mockup leaves a disabled button with no target.
- *Decision it touches:* Buy online (Mark ready only when everything is on the shelf, as `on-orders` itself says). Not reopened.
- *Second check:* CONFIRMED. The built HTML has `aria-disabled="true"` on the button, with `data-go="on-orders-ready"`, at desktop and phone. `on-order-moving` is the drawn "on its way" state, so `on-order-ready` showing "Coming from" is the drawing's own slip. Walk-2 didn't raise it.

**M2 — "Looks right" lands on "The count matches", and the till then says the float was "counted by Jo Taylor".**
- *Screens:* `op-float-check` → `op-float-matched` (all sizes); `eod-count-result`, `eod-z`.
- *What happens:* Jo only glanced and pressed Looks right. The next screen is titled "The count matches: the till is ready" and says "Float checked · Till B1 · counted by Jo Taylor". At closing, "How the till worked it out" starts "Float counted this morning · Jo Taylor at [time]", and the report says "Float at the start [£] short, counted by Jo Taylor".
- *Why it matters:* the record says a count happened that didn't. If cash is short at night, Jack reads that the morning float was counted, and a short report ("short") for a day the float looked right.
- *Fix, no choice:* Looks right goes straight to the till (`till-empty`) with "Float checked · looked right · Jo Taylor". Only a count says "counted by". Cash-up's workings read "Float this morning · looked right · Jo Taylor" on such a day. `eod-z`'s "short" belongs to the short-float day, so on the story's day the report reads the float as it was checked.
- *Decision it touches:* Opening 2 and 8 (H1: "a count that matches closes the pop-up with 'Float checked'"). The 2 Oct walk-through decisions note that Looks right makes the figure "what the till expected, not a count". This applies that; it doesn't reopen it.
- *Second check:* CONFIRMED. `op-float-matched` is the matched-count situation of `op-float-check`, and no "looked right" state is drawn. The story and the mockup both send Looks right there. Walk-2 checked that the morning workings exist (its M1), not this wording.

**M3 — After a card refund, nothing shows that it finished.**
- *Screens:* `till-refund` (all sizes).
- *What happens:* "Refund £28.00 to the card" says "this happens outside Wheelhouse" (the card machine). There's no "Refunded" screen to come back to. `mockup-gaps.md` lists "Refunded: what the till shows once a refund is done", but only from the cash and store-credit buttons.
- *Why it matters:* Jo, with the customer waiting, can't tell the refund went through, or where its receipt is.
- *Fix:* add the card route to that gap in `mockup-gaps.md`, for the same decision there (draw it, make it a line, or leave it for the build).
- *Second check:* CONFIRMED. The only exits from `till-refund` are Back, Close, the reasons and the outside step. No decision draws the finished refund.

## Low

**L1 — Close on the day's report goes back to "Ready to close the day".** On `eod-z`, Close is wired as "back", so it reopens `eod-finish` with "Close the day and show the report" pressable again. Every other till box's Close goes to the till. *Fix, no choice:* Close on `eod-z` goes to the till. *Second check:* CONFIRMED. `eod-z` resolves Close to `back` at all sizes, and `eod-z` has no situations. No decision says otherwise (Cash-up 5 and its later change say only that closed days reopen from Reports).

**L2 — Maya's name drops out of the hand-over.** The till's search row reads "Order [order number] · Maya Patel", but `till-collect` reads "[Customer] · paid online [date]" with "[Item]" rows, so Jo can't check the name against the person at the counter. *Fix, no choice:* `till-collect` shows "Maya Patel" and her two items, as her order does. *Second check:* CONFIRMED at all sizes. Example data from the drawings only, nothing invented.

**L3 — Story mode guides only step 1, and Person stays as chosen.** The same mockup issue as walk-3 story 1 L2. Here Jack's closing steps show "Serving: Jack Lewis", while the sidebar still says "Jo Taylor · Staff", because the drawings show the till computer signed in as Jo. That part is as decided (the till stays signed in). *Fix:* as story 1 L2.

## Second-walk findings seen again, not raised again

- Walk-2 H1 (refunds to finish on Today): answered 3 Oct (walk-through decisions, later change). Lines only, not clickable.
- Walk-2 L1–L4: L1 (hand-over lines under `till-collect`) and L4 (renaming "Tablet and phone ↗") were answered. L3's search wording was answered (second-walk answer 3).
- On a phone, "Open the sale", Add a discount and Past sales: listed in `mockup-gaps.md`.
- "Next sale starts in 5 seconds": covered by "Don't close things by themselves" (walk-through 1 L6, 2 Oct).

## Persona checks

- **Jo:** every desktop step's button leads on; the till's search finds Maya's order and offers Hand over in one click. H1 and M2 are what Jo would see wrong.
- **Saturday worker:** the same till path. M2's wording matters most for someone who only glances at the float.
- **Maya:** M1.
- **Jack Lewis:** 5 clicks to close the day, then L1.
- **Screen reader:** the disabled Mark ready is announced as unavailable, with its reason in words. That's good; the mockup just ignores it (M1).
- **Low vision:** the till's own text is 12px or more. Under 12px on this path at desktop and tablet: only the sidebar's room headings (Front desk, Workshop, Stockroom, Office, 11px) and the logo placeholder. Not raised: they are headings, and the till folds the sidebar to a rail.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | till-receipt, guest receipt email, Past sales | £70.00 split sale recorded as £74.00 card, emailed as £111.00 | No |
| M1 | on-order-staff, on-order-ready | Story presses a disabled Mark ready; "ready" page has an item on its way | No |
| M2 | op-float-matched, eod | "Looks right" recorded as "counted by Jo Taylor" | No |
| M3 | till-refund | No "Refunded" after a card refund | Already in `mockup-gaps.md` |
| L1 | eod-z | Close goes back to "Ready to close the day" | No |
| L2 | till-collect | Maya's name and items become placeholders | No |
| L3 | mockup story mode | Same as story 1 L2 | No |

Counts: 1 High, 3 Medium, 3 Low.

## Verification

- **Walked:** all 31 steps at desktop, tablet and phone, with every control's target. I also opened `op-float-check`'s, `till-receipt`'s, `on-order`'s, `eod-count`'s, `till-refund`'s and `till-collect`'s situations.
- **Read:** the script, personas, walk-2 report 2, the second-walk decisions, `mockup-gaps.md`; decisions Opening 2, 3 and 8, Cash-up 5 and its later change, the 2 Oct walk-through decisions (M11 and decision 6) and its 3 Oct later change, Leftover screens 1–3.
- **Not checked:** rendered layout and colour; a real screen reader or keyboard; text-only situation lines.

## Second check

Re-read on 3 Oct against the drawings at all three sizes and the decisions. Kept: 7. Dropped: 3.
1. The till computer signed in as Jo while Jack serves: as decided (the till stays signed in; Signing in).
2. The receipt step's 5-second timer: walk-through 1 L6 (2 Oct).
3. On a phone, Online orders sits behind the menu: drawn that way, and the story's `doesAt` follows it.

## Questions for Jack

None. Every finding here either applies a recorded decision or is already in `mockup-gaps.md` for you to decide.
