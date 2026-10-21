# Design

## Screens half (this pull request)
- `pending.tsx` gains an "after drop-off" branch for `in_workshop`, `ready_to_collect` and `collected`, and a `request_expired` branch next to `declined`.
- The after-drop-off page reuses the standing page's rows card: Service with prices, Bike, When, Your repair, the customer's words and the shop's name. It has the "From £" total only while the work isn't done. The drawings put "Work agreed" (`dq-in-shop`) and "What we did" (`cp-summary`) there. Until the server sends the work that was done, the answered quote (from `…/quote`) and the booked work stand in their place (logged in `decided-while-building.md`).
- The tracker is an `ol` labelled "Where your bike is". Its steps are Booked, In the shop, Being worked on, Ready; on the ready and collected pages all four are ticked, with `aria-current="step"` on Ready (`collect.mjs` `trackerDone`). The in-workshop page has no tracker until the server says how far the work is (answer 1).
- The quote card stays on all three pages: once answered it lists what was agreed and declined, which is what "What we did" shows (fresh review, 21 Oct). Once the work is done it is headed "What we did", with no Answered badge, and comes after the pay or Collected card, as the drawings' reading order has it.
- In the workshop, the heading is `pageHeading` (the bike and the work), as `dq-in-shop` draws it. The plain line sits where the tracker will go.
- Checked by shows on the ready page only. `cp-summary-collected` has none.
- The request-expired page follows the declined page as built: no deposit line (no deposits yet), and "Choose another date" goes to the shop's booking start.

## Contract for Mark's server half (later; split plan §4.3)
`GET /api/portal/:shop/booking-links/:code` adds:

| Field | Type | When | For |
|---|---|---|---|
| `workState` | `'not_started' \| 'in_progress' \| 'waiting_parts' \| 'on_hold' \| 'complete'` | always | tracker steps, "Waiting for a part" (`dq-in-shop`, `dq-waiting-part`) |
| `bookedInAt` | ISO time \| null | once in the shop | "We've got your bike — booked in [day] at [time]" |
| `expectedReady` | `{ date, time \| null }` \| null | once set by staff | "Expected ready: …" |
| `work` | `{ name, note \| null, price }[]` and `declined: { name, price }[]` | once a quote is answered, or the job is finished | "What we did" and "Not done — you said no thanks" |
| `toPay` | pounds \| null | ready | "To pay when you collect £…" |
| `checklist` | `{ name, done, note \| null }[]` \| null | a service with a checklist | "Full service checklist" |
| `paid` | pounds \| null | once paid | "£111.00 paid" on the Paid and Collected cards |
| `paidAt`, `collectedAt` | ISO time \| null | once paid, once collected | the Paid and Collected cards, and "until [date]" |
| `shop` | `{ address, phone, openingHours }` | always | the shop lines on every stage |

Prices are in pounds, as the link's `services[].price` and `totalPrice` are today. Like `bookedServices`, they are sent only when the shop shows prices online.

The 410 reply's body adds `{ reference, reason: 'collected' \| 'never_came_in', shop }` for `cp-expired` and `bk-expired`. Under build-plan question 8 (`docs/decisions/2026-10-03-build-plan-questions.md`), the link's 30 days count from collection, or from the booked day if the bike never came in. Today `isLinkExpired` counts from the job's date alone.
