# Edge cases written as lines — drafts for Jack to check

From the second walk's smaller questions, answers 1, 4, 6 and 9
(`docs/decisions/2026-10-03-ux-walkthrough-second-walk.md`): "Each follows
the nearest thing already decided; Jack checks the wording before it is
published." Nothing here is on the canvas yet. Each line sits on a kept
screen (`keep()` in `generator/consolidate/`). Where no recorded decision
says what should happen, the case is listed under "No decision to follow"
with the choice it needs, not given a line.

## The drafts

| # | Case | Screen | Line | Who | Decision followed |
|---|---|---|---|---|---|
| 1b | A "Not sure what's wrong?" booking that reaches a quote (walk-through 1 L7) | `dq-quote` | From a Not sure what's wrong? booking: every line is the mechanic's, each Needed or Optional with its reason; a deposit paid shows as Deposit paid £[deposit] and Still to pay when you collect £[balance] | Customer | Booking mode 2026-09-04 §7.4 (the mechanic adds the lines); Book a repair 12 (H3, the fixed "Not sure" deposit); Quote 2, 7 |
| 4a | Where "Fix" on an imported row leads (walk-through 4 L3) | `mv-start` | Fix on a row that needs a look: a pop-up for that one row; new problem rows from a weekly refresh use the same list and Fix | Owner | UX walk-through decision 6 (first walk 4 M5: "Fix drawn as a pop-up on one row"); Moving from Citrus Lime 2, 9 (M3) |
| 4b | Where "Give [name] their PIN" sits (walk-through 4 L3) | `till-sale` | Serving: [name] menu, for the Owner or a manager: Give [name] their PIN, for a till-only person, a first PIN or a cleared one; it opens [Name]'s till PIN, with the screen turned to them | Owner and Manager | UX walk-through decision 6 (first walk 4 M2, option 1) and its 2 Oct as-built note ("the till's Serving menu"); Signing in, 3 Oct (walk-through 4 M3); App map 13 |
| 4c | A weekly refresh with a file that can't be read (walk-through 4 L3) | `mv-start` | A weekly refresh with a file Wheelhouse couldn't read: the same Couldn't read it and Choose another file on the Weekly refresh card, with Ask us to help | Owner | Moving from Citrus Lime 3, 9 (M1, M4) |
| 6a | The internet drops during the Cycle to Work sale (walk-through 5 L5) | `till-sale` | Offline during a Cycle to Work sale: the order is handed over from the till's own copy, marked To send, and the sale waits with the others to send | Staff | UX walk-through decision 5 (walk-through 2 M7, as `till-collect-offline`); Cycle to Work 5 |
| 6b | The card for Maya's part is declined after the provider's line (walk-through 5 L5) | `till-pay` | Card declined for what Maya pays, after Cycle to Work · [Provider]: the provider's line stays and nothing is taken from the card; Try the card again or Pay another way | Staff | Selling at the till 6 (`till-card-declined`); Cycle to Work 7 (H2, two payment lines) |
| 6c | Adding a new customer from New order (walk-through 5 L5) | `cw-new` | Maya isn't a customer yet: + New customer under the Customer box, as on New job, opens Add a customer and puts her on the order; a number someone already has shows [Name] already has this number | Staff | Workshop day 26 (New job, drawn with + New customer); Customer service 3, 5 |
| 9a | Unticking a shop for someone with jobs booked there (walk-through 7 L4) | `set-staff-person` | Unticking a shop in Works at for someone with jobs booked there: it says so first, before it saves | Owner | Multiple sites 9 (H5); `sites.mjs` hint "says so first" |
| 9b | Closing the day at [Second site] while the owner is looking at Bolton (walk-through 7 L4) | `eod-count` | Closing the day at [Second site] while the owner is looking at Bolton: only [Second site]'s tills and count close; Bolton's day stays open | Owner, Manager, or anyone with Can close the day | Multiple sites 2 (each shop has its own tills and cash-up), 9 (H2); Cash-up 6 (each till closes on its own) |
| 9e | A cancelled transfer a job is waiting for (walk-through 7, second check) | `job-overview` | Waiting for a part on a transfer that was cancelled: Banner: Transfer T-[0000] was cancelled on [date] before the Shimano brake pads B05S-RX came · reorder them, or tell Maya | Staff and Mechanic | Stock control 11 (a send can be cancelled while on its way); UX walk-through decision 6 (walk-through 3: a job whose order closed says so, `rs-part-order-closed`) |

Notes on the drafts:
- **1b** says nothing about a charge for looking at the bike; see "No
  decision to follow" 1c.
- **4a** says where Fix leads (a pop-up), not what the pop-up asks for each
  kind of row; see 4d.
- **4b**: where in the Serving menu the row goes (its order) isn't recorded;
  the line only puts it in that menu, as the 2 Oct note does.
- **6a** covers the order and the sale. Whether the card machine can take
  Maya's part with no internet is still to check before building (Selling
  at the till 6), so the line doesn't say.

## No decision to follow

| # | Case | The choice needed |
|---|---|---|
| 1a | A bike marked ready while its quote is unanswered (walk-through 1 L7) | Whether "Mark ready for collection" waits until the quote is answered, recorded by phone or withdrawn (Quote 4 gives staff those three ways), or goes ahead and the unanswered lines count as declined. |
| 1c | Part of 1b: a "Not sure" booking's quote | Whether looking at the bike costs anything, so the quote starts with an agreed line, or every line is new. |
| 4d | Part of 4a: the Fix pop-up | What the one-row pop-up asks for each kind of row (a possible duplicate, a row with no name, a job whose customer isn't in the file). |
| 6d | A bike comes back after the provider has paid (walk-through 5 L5) | Who the refund goes to and how: back to the provider, to Maya, or store credit; and whether the order reopens or a new one starts. Selling at the till 9 says money goes back the way it was paid, which the till can't do for a provider's payment. |
| 9c | A customer collecting at the shop that didn't do the work (walk-through 7 L4) | Whether a job can be collected and paid for at the other shop (the bike moved over first, the sale counting for one shop or the other), or only at the shop that did the work. |
| 9d | A [Manager] at Bolton only adding [Second site] to Jo's Works at (first walk 7 L4) | Whether a manager can give someone a shop the manager doesn't work at, or only the owner can. |

## Ready to paste into `export const lines`

Only the drafts above. Each block goes into the named file's `lines` array,
or starts one where the file has none (`j16.mjs`).

`consolidate/j04.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answer 1).
  { on: 'dq-quote', text: "From a Not sure what's wrong? booking: every line is the mechanic's, each Needed or Optional with its reason; a deposit paid shows as Deposit paid £[deposit] and Still to pay when you collect £[balance]", who: 'Customer', decision: 'Booking mode 2026-09-04 §7.4; Book a repair 12 (H3); Quote 2, 7; 3 Oct (second walk Q1)' },
```

`consolidate/j09.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answer 4).
  { on: 'mv-start', text: 'Fix on a row that needs a look: a pop-up for that one row; new problem rows from a weekly refresh use the same list and Fix', who: 'Owner', decision: 'UX walk-through decision 6 (walk-through 4 M5); Moving from Citrus Lime 2, 9 (M3); 3 Oct (second walk Q4)' },
  { on: 'mv-start', text: "A weekly refresh with a file Wheelhouse couldn't read: the same Couldn't read it and Choose another file on the Weekly refresh card, with Ask us to help", who: 'Owner', decision: 'Moving from Citrus Lime 3, 9 (M1, M4); 3 Oct (second walk Q4)' },
```

`consolidate/j11.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answers 4 and 6).
  { on: 'till-sale', text: "Serving: [name] menu, for the Owner or a manager: Give [name] their PIN, for a till-only person, a first PIN or a cleared one; it opens [Name]'s till PIN, with the screen turned to them", who: 'Owner and Manager', decision: 'UX walk-through decision 6 (walk-through 4 M2); Signing in, 3 Oct (walk-through 4 M3); App map 13; 3 Oct (second walk Q4)' },
  { on: 'till-sale', text: "Offline during a Cycle to Work sale: the order is handed over from the till's own copy, marked To send, and the sale waits with the others to send", who: 'Staff', decision: 'UX walk-through decision 5 (walk-through 2 M7); Cycle to Work 5; 3 Oct (second walk Q6)' },
  { on: 'till-pay', text: "Card declined for what Maya pays, after Cycle to Work · [Provider]: the provider's line stays and nothing is taken from the card; Try the card again or Pay another way", who: 'Staff', decision: 'Selling at the till 6; Cycle to Work 7 (H2); 3 Oct (second walk Q6)' },
```

`consolidate/j06.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answer 6).
  { on: 'cw-new', text: "Maya isn't a customer yet: + New customer under the Customer box, as on New job, opens Add a customer and puts her on the order; a number someone already has shows [Name] already has this number", who: 'Staff', decision: 'Workshop day 26; Customer service 3, 5; 3 Oct (second walk Q6)' },
```

`consolidate/j08.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answer 9).
  { on: 'set-staff-person', text: 'Unticking a shop in Works at for someone with jobs booked there: it says so first, before it saves', who: 'Owner', decision: 'Multiple sites 9 (H5); 3 Oct (second walk Q9)' },
```

`consolidate/j16.mjs` (no `lines` yet: add `export const lines = [ … ];` after the default export)
```js
  // The second walk's smaller questions, 3 Oct (answer 9).
  { on: 'eod-count', text: "Closing the day at [Second site] while the owner is looking at Bolton: only [Second site]'s tills and count close; Bolton's day stays open", who: 'Owner, Manager, or anyone with Can close the day', decision: 'Multiple sites 2, 9 (H2); Cash-up 6; 3 Oct (second walk Q9)' },
```

`consolidate/j12.mjs`
```js
  // The second walk's smaller questions, 3 Oct (answer 9).
  { on: 'job-overview', text: 'Waiting for a part on a transfer that was cancelled: Banner: Transfer T-[0000] was cancelled on [date] before the Shimano brake pads B05S-RX came · reorder them, or tell Maya', who: 'Staff and Mechanic', decision: 'Stock control 11; UX walk-through decision 6 (walk-through 3, rs-part-order-closed); 3 Oct (second walk Q9)' },
```
