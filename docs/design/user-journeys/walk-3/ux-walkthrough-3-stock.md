# UX walk-through 3, third walk: stock (clickable mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup (`generator/mockup/`, built into `generator/out-mockup/`). I followed story 3's 29 steps in `mockup/stories.mjs` through the drawings the mockup shows and the targets `controls.mjs` `resolve()` gives each button: Jack Lewis and Jo Taylor at desktop, Alex at tablet, then every step at the other two sizes. A scratchpad script listed each step's screen text and every control's target. I didn't see it rendered. The second walk is `../walk-2/ux-walkthrough-3-stock.md`; its findings Jack answered (M3 cost going up, M7 "On order" automatically) and the ones it raised are not raised again.

## The story, as the mockup clicks it

1. Jack: `rs-hub` › See the list (for customers) › `rs-restock-customers` › Add to an order › `rs-order` › Mark as ordered › `rs-order-ordered`.
2. Jo: `rs-hub` › Receive a delivery › `rs-receive` › Problem › `rs-problem` › Mark as damaged › `rs-receive-marked` › Book in › `rs-booked`.
3. Alex: `rs-diary-arrived` › WH-1042's block › `rs-job-arrived` › Carry on with the work › `job-mechanic`.
4. Jo at the till: `till-held-job` › Take payment › `till-pay` › Card › `till-card` › `till-receipt` › No receipt.
5. Jack: `tk-hub` › Start a count › `tk-start` › Start the count › Jo counts on `tk-count` › I've finished my part › Jack: `tk-hub` › Check it › `tk-diff` › Apply › `tk-applied`.
6. Jo: `st-list` › the pads › `st-product` › Adjust stock › `st-adjust` › Adjust.
7. Jack: `rp-home` › Margin and stock value › `rp-margin`.

## Clicks and screens, per person

| Person | Clicks the story presses | Different screens | Notes |
|---|---|---|---|
| Jack Lewis | 8 | 10 | Overview to margin: 1 click from Reports, as the owner check asks |
| Jo Taylor | 11, plus scans, a reason and counts | 14 | Every step clicks at all three sizes; the count, receiving and stock pages are drawn for a phone now |
| Alex Morgan | 2 | 3 | |

## High

None.

## Medium

**M1 — Jo is shown the owner's stock pages, with cost and margin. The Staff versions are drawn, but no click reaches them.**
- *Screens:* `st-list`, `st-product`, `st-adjust`, `rs-booked`, `rs-receive` (desktop, tablet); `st-list-staff`, `st-product-staff`, `rs-booked-staff`, `tk-hub-staff`.
- *What happens:* the story walks Jo through `st-list` ("Manager": a Margin column), `st-product` ("Manager": "Cost £[cost] · Margin [n]%", and Edit) and `st-adjust` ("Owner"), and books her delivery in on `rs-booked` ("Manager"). `rs-receive` and `st-list` are drawn signed in as "Jack Lewis, Owner". Staff versions exist: `st-list-staff` ("no cost or margin"), `st-product-staff`, `rs-booked-staff` ("labels first"), `tk-hub-staff` ("join a count"). But clicking the pads on `st-list-staff` opens `st-product`, the manager's page with cost and margin. Adjust stock on `st-product-staff` opens `st-adjust`, drawn over the owner's page. The sidebar's Stock always opens `st-list`.
- *Why it matters:* clicking as Jo, the mockup shows her what her role must not see ("Can see costs and margin" is off for Jo). Anyone checking the build against the mockup would think Staff see costs.
- *Fix, no choice:* the story's Jo steps use the Staff screens, and on a Staff screen each link goes to the Staff version where one is drawn (pads → `st-product-staff`; the sidebar's Stock and Stock take by role, as the phone menu already is). `st-adjust` over `st-product-staff` is walk-2 L1's fix and still to be drawn.
- *Decision it touches:* Owner setup, later change 1 Oct (Reports 5 and 9: "Can see costs and margin", off for Jo Taylor); Stock control 11. Applies them.
- *Second check:* CONFIRMED. `resolve()` gives `st-list-staff` › pads → `st-product`, and `st-product-staff` › Adjust stock → `st-adjust`, at every size; `links/shared.mjs` has `Stock: go('st-list')`. Walk-2 L1 raised only `st-adjust`'s label, not that the Staff pages link out to the owner's. Kept as Medium (someone sees what their role shouldn't).

**M2 — "Mark as ordered" lands on an order already partly delivered, with the pads "All arrived".**
- *Screens:* `rs-order` → `rs-order-ordered` (all sizes).
- *What happens:* Jack presses Mark as ordered and sees "[Supplier] · ordered [date] · Partly delivered · Shimano brake pads B05S-RX · for job WH-1042 · ordered [n] · arrived [n] · All arrived". The moment between, ordered with nothing come yet, isn't drawn. That's also the moment WH-1042's line should turn "On order".
- *Why it matters:* Jack is told the pads have arrived before the box has been sent. The "On order" stage Jack chose on 3 Oct has nowhere to be seen.
- *Fix, no choice:* a line under `rs-order`: "Just ordered: every line 'ordered [n] · arrived 0', 'Waiting for the delivery'; job WH-1042's line now reads On order". In the mockup, Mark as ordered goes to that line's screen, or stays on `rs-order` until it's drawn.
- *Decision it touches:* Receiving stock, later change 3 Oct (walk-through 3 M7: "On order" once that part is on an order marked ordered).
- *Second check:* CONFIRMED. `rs-order`'s only situations are `rs-order-ordered` (partly delivered) and `rs-order-close`. No line draws "ordered, nothing arrived". Walk-2 didn't raise it.

**M3 — The count Jack starts isn't the count he checks.**
- *Screens:* `tk-hub`, `tk-start`, `tk-count`, `tk-diff` (all sizes).
- *What happens:* Jack starts a count of an area (`tk-start`: "Which area · Used before: [Area]"). Jo counts it on `tk-count` ("Counting [Area]") and presses "I've finished my part". Back on `tk-hub`, the [Area] count still says "Jo Taylor and Alex Morgan counting · Counting". The one marked "Ready to check" is a different count, "[Category] · everyone has finished". Jack checks and applies that one ("Check the count of [Category]").
- *Why it matters:* nobody can follow one count from start to apply. The step where every counter has finished and the count becomes "Ready to check" isn't shown for the count started.
- *Fix, no choice:* the story starts a category count (`tk-start`'s "A category"), or `tk-hub` after "I've finished my part" shows "[Area] · Alex Morgan still counting" with Check it waiting. Either way, one count all the way through.
- *Decision it touches:* Stock control 5 (staff join; the manager checks and applies). Not reopened.
- *Second check:* CONFIRMED in the text of `tk-start`, `tk-count`, `tk-hub` and `tk-diff` at all sizes. Walk-2 walked these boards one at a time, not as one count.

## Low

**L1 — WH-1042 changes stage and time between the diary and its own page.** In `rs-diary-arrived` the block reads "Waiting for parts, part arrived, 16:00–17:30". Open it, and the diary behind `rs-job-arrived` shows the same block as "In the workshop, 11:30–13:00 · approved £111". *Fix, no choice:* the backdrop on `rs-job-arrived` shows the part-arrived block. *Second check:* CONFIRMED (desktop and tablet). Related to the 3 Oct fresh review's leftover note on `job-overview`'s backdrop, but a different board, so not already raised.

**L2 — The margin chart's labels are 11px at every size.** `rp-margin`'s chart axis ("[n]%", "0") is 11px on phone, tablet and desktop, below the 12px Jack allowed for labels. *Fix, no choice:* 12px. *Second check:* CONFIRMED. Owner setup 17 dismissed text sizes only down to 12px.

**L3 — What's behind "Stock written off" isn't drawn.** On `rp-margin`, every "See the counts" and "See the products" line, including "Adjusted · Damaged" (Jo's adjustment in this story), says "Not drawn yet". It's already in `mockup-gaps.md`; this walk notes it ends story 3. *Second check:* CONFIRMED. Nothing to add for Jack beyond the gaps list.

**L4 — Story mode guides only step 1, and Person stays as chosen.** The same mockup issue as walk-3 story 1 L2. It's also how M1 happens: the Person box stays "Owner" for Jo's steps.

## Second-walk findings seen again, not raised again

- Walk-2 H1 (invoice check drawn as normal): `rs-delivery` is now "A booked-in delivery" with no invoice row. Fixed in the drawings.
- Walk-2 M1 (owner's strip on Reports): drawn ("Takings £[£] | Margin £[£] · [%] | Shop North Street Cycles, Bolton ›").
- Walk-2 M3 ("Cost went up? Change it"): answered, and a text line under `rs-delivery`. The mockup can't show text lines.
- Walk-2 M5 (counting on a phone): `tk-count`, `rs-receive` and the stock pages now have phone drawings.
- Walk-2 M6 (held-pads warning): now reads "selling it leaves Maya's job waiting for parts".
- Walk-2 L1 (`st-adjust` drawn as the owner): still so; part of M1's fix.
- Walk-2 M2 pattern: "Open job WH-1042" on `st-product` opens "Job · expected", the wrong moment.

## Persona checks

- **Jack Lewis:** Reports opens with the strip; Margin and stock value is one click. Passes the owner checks.
- **Jo:** receiving takes 4 clicks plus scans; counting takes 1 plus scans; adjusting takes 3. M1 is what's wrong.
- **Alex:** "Part arrived" on the block, one tap to the job, one to carry on.
- **Saturday worker:** the till warning is in words, and selling is never blocked.
- **Screen reader and keyboard:** not checked beyond labels; the diary block names "part arrived" in words.
- **Low vision:** L2.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | stock pages, booked-in | Jo sees cost and margin; Staff pages link to the owner's | No |
| M2 | rs-order → rs-order-ordered | "Mark as ordered" shows the pads already arrived | No |
| M3 | tk-hub, tk-diff | Starts one count, checks another | No |
| L1 | rs-job-arrived | Block's stage and time change behind the job | No |
| L2 | rp-margin | Chart labels 11px | No |
| L3 | rp-margin | Write-off drill-downs not drawn | Already in `mockup-gaps.md` |
| L4 | mockup story mode | Same as story 1 L2 | No |

Counts: 0 High, 3 Medium, 4 Low.

## Verification

- **Walked:** all 29 steps at desktop, tablet and phone, with every control's target. I also opened `rs-delivery`, `st-list-staff`, `st-product-staff`, `tk-hub-staff` and `rs-booked-staff`, and every situation of `st-list`, `st-product`, `rs-order`, `tk-hub`, `rs-delivery` and `rp-home`.
- **Read:** the script, personas, walk-2 report 3, the second-walk decisions, `mockup-gaps.md`; decisions Receiving stock (later changes 3 Oct), Reports and accounts (later changes 3 Oct), Owner setup 17 and its 1 Oct later change, Stock control 5 and 11; `consolidate/j12.mjs` and `j13.mjs` for the text lines.
- **Not checked:** rendered layout; a real screen reader or keyboard; text-only situation lines (the mockup doesn't show them).

## Second check

Re-read on 3 Oct against the drawings at all three sizes and the decisions. Kept: 7. Dropped: 2.
1. "Cost went up? Change it" not visible: it's a recorded text line (Receiving stock, 3 Oct), not a gap.
2. `rs-receive-marked` adds a bike row that wasn't on `rs-receive`: the situation's own title says so ("a bike with its frame numbers"), so it's on purpose.

## Questions for Jack

None. Every finding applies a recorded decision, or is already in `mockup-gaps.md`.
