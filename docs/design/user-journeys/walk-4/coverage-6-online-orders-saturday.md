# Coverage cell 6: the Saturday worker gets an online order ready

Stage W coverage check (`../coverage-check.md`, "Empty cells", 6), 4 Oct 2026. Journey 2 (Buy online / click and collect) × the Saturday worker. Kept screens: `on-orders`, `on-order-staff`, `on-cant-supply`. Walked on the clickable mockup's build (`generator/out-mockup/`), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, the Saturday worker's checks in `../personas.md`, and issue #116's three changes.

The drawings call whoever is at the till "Jo Taylor" (rail: "Your settings — Jo Taylor, Staff"). That's example data, not a finding (walk-3 story 10 says the same).

## The story

Story 10 (`mockup/stories.mjs`), with one step added before Maya collects her online order (step 9), as Jo does in story 2:

1. At the till (`till-empty`), the rail shows "Online orders [n] to get ready". The Saturday worker presses it (`on-orders`).
2. "To get ready · 3": one order is all on the shelf, with **Mark ready**. Maya's says "Waiting for 1 item" (one item "On its way from [Second site]"), with no button. The worker presses Mark ready (`on-orders-ready`: "Ready. The email goes to [Customer] in [n] seconds · Undo").
3. As story 2 says, Maya's last item arrives later and her order is marked ready the same way (`on-orders-arrived`, a situation line: "Mark ready" in place of "Waiting for 1 item").
4. If an item can't be got: open the order (`on-order-staff`), **Can't supply an item** (`on-cant-supply`), pick it, type a reason, "Refund this item".
5. Back to the till (rail: Till).

Walk-through 10 M1 (walk-through 8 decisions, later change 3 Oct) opened Online orders to till-only workers. Their rail showing only Till and Online orders is "Not drawn yet", so the worker here sees Jo's full rail. Not raised.

## Clicks and screens

| Person | Size | Clicks | Boards | Kept screens |
|---|---|---|---|---|
| Saturday worker | Desktop | 3 (Online orders, Mark ready, Till) | 3 (`till-empty`, `on-orders`, `on-orders-ready`) | 2 (`till-sale`, `on-orders`) |
| Saturday worker | Tablet | the same | the same | the same |
| Saturday worker | Phone | 5 (Open menu, Online orders, Mark ready, Open menu, Till) | 4 (adds `staff-app-menu`) | the same |
| Can't supply (any size) | | +3 (the order, Can't supply an item, Refund this item), plus picking the item and typing a reason | +2 (`on-order-staff`, `on-cant-supply`) | +2 |

Against story 10 as walked in walk-3: 12 → 15 clicks at desktop (17 on a phone) and 20 → 22 boards. The phone's extra menu taps are the longer way round Jack accepted on 3 Oct ("Phone and tablet steps").

Issue #116's question, "could this be a line?": no new screen is needed. Marking ready is one press on the list, with Undo in place.

## High

None.

## Medium

None.

## Low

**L1 — Maya's own order can't be marked ready by clicking, and if it could, the board after shows someone else's.** `on-orders-arrived` (Maya's item "Arrived from [Second site]", with Mark ready) has no way in from any board. Its Mark ready (both rows) opens `on-orders-ready`, where the order just marked is "[Customer] … ready just now", Maya's still says "Waiting for 1 item", and the message is "The email goes to [Customer]". A Saturday worker trying it would think the wrong order went. *Fix, no choice:* in the mockup, Maya's Mark ready on `on-orders-arrived` shows a note ("showing [Customer]'s order marked ready; Maya's is the same"), and story 10's added step names `on-orders-arrived` so it can be clicked. No drawing changes. *Touches:* Buy online 6 (Mark ready is one press and sends "Order ready to collect"). *Second check:* CONFIRMED at all three sizes: no `data-go="on-orders-arrived"` in any data file; both its Mark ready controls have `data-go="on-orders-ready"`. Story 2 covers this with a bracketed step, so it isn't Medium.

**L2 — "Cancel and refund" is labelled for managers, but it's drawn with Jo (Staff) and staff can refund.** `on-cancel-refund`'s situation line ends "— Manager" (`consolidate/j02.mjs`), while the board’s own rail reads "Your settings — Jo Taylor, Staff", and `on-order-staff` offers Cancel and refund to staff. Selling at the till 9 chose no manager PIN for refunds, and Buy online 7 has "staff contact the customer or cancel it". If the build reads the label as who may do it, a Saturday worker can't cancel a paid order a customer asks to cancel. *Fix, no choice:* the line says Staff. *Second check:* CONFIRMED: the manifest gives `on-cancel-refund` role Manager; its rail reads "Your settings — Jo Taylor, Staff". No decision limits cancelling an online order to managers.

## Seen, not raised

- "Refund this item" and "Cancel and refund" lead to boards not drawn yet; both are in `../mockup-gaps.md` ("The staff order page with one item refunded …", "… once the whole order is cancelled and refunded").
- The till-only rail (only Till and Online orders): decided 3 Oct (walk-through 10 M1), not drawn yet.
- On a phone the till has no Online orders link of its own; the menu has it. Jack accepted the longer way round for phones (3 Oct).

## Persona checks

- **Saturday worker, after a week away:** `on-orders` says what to do ("Mark ready when everything's on the shelf for collection — the customer is told straight away"), why Maya's has no button ("Waiting for 1 item"), and Undo is there for a few seconds. On the order, "Mark ready isn't available yet: 1 item is still on its way from [Second site]." Nothing needs to be shown by someone else. After marking ready, the row names where it waits ("Waiting at [Shelf name]").
- **Without owner-level access:** every step here is drawn for Staff.
- **Screen reader:** the rail's link is named "Online orders [n] to get ready"; the order rows are buttons named with the customer and order. The rail unfolds on hover and on keyboard focus. Not checked in a browser.
- **Low vision, phone:** the items' status words ("On the shelf", "Waiting for 1 item", "Waiting at [Shelf name]") are 12px, the smallest text on this path.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| L1 | on-orders-arrived → on-orders-ready | Maya's Mark ready unreachable, and shows another order marked | No |
| L2 | on-cancel-refund | Cancel and refund labelled Manager though staff do it | No |

Counts: 0 High, 0 Medium, 2 Low.

## Questions for Jack

None. Both findings follow recorded decisions.

## Verification

- **Walked:** the added step of story 10 at desktop, tablet and phone, with scratchpad scripts listing each board's text, every control and target, and text under 14px; searches of every `data/*.json` for links into `on-orders`, `on-orders-arrived`, `on-order-staff` and `on-cant-supply`.
- **Boards read:** `till-empty`, `till-sale`, `staff-app-menu`, `on-orders`, `on-orders-ready`, `on-orders-arrived`, `on-order-staff`, `on-cant-supply`, `on-cancel-refund`; situation lines of `on-orders`, `on-order-staff`, `on-cant-supply`.
- **Decisions read:** Buy online 6, 7, 9; walk-through 8 decisions and their 3 Oct later changes (walk-through 10 M1); third-walk decisions ("Phone and tablet steps"); Selling at the till 9.
- **Not checked:** rendered layout, focus order and zoom; whether the till-only rail keeps the "[n] to get ready" count (not drawn yet).

## Second check

Re-read against the built data at three sizes and the decisions. Kept: 2. Dropped: 1.
1. "After Mark ready, nothing tells the worker where to put the order": dropped. `on-orders` says to mark it ready once it's "on the shelf for collection", and the ready row then names "Waiting at [Shelf name]".
