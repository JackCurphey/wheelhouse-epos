# Brief — Workshop day, diary redesign canvas

Task brief for drawing the redesigned Workshop day as a separate canvas for
Jack's review. Decisions: `docs/decisions/2026-09-27-workshop-day-review.md`
(read it first; items 1–11 are the requirements).

## What to produce

Two new files in `docs/design/user-journeys/generator/`:

- `diary.mjs` — the drawings. Reuse `ui.mjs` (tokens `C`, `button`, `field`,
  `card`, `badge`, `icon`, `logoSlot`, `MONO`) and the helpers/copy in
  `stage2.mjs` (import what it exports; copy small private helpers you need
  rather than refactoring stage2). No raw colours beyond `ui.mjs`, except the
  Wheelhouse status colours below.
- `build-diary.mjs` — writes `out-diary/project/*.dc.html` plus
  `out-diary/project/canvas.json`, in the `.dc.html` shape `build.mjs`'s
  `page()` uses (keep the `<script src="./support.js"></script>` head line,
  the `<x-dc>`/`<helmet>` wrapper, the `data-dc-script` block, and a
  `$preview` equal to the board size). `out-diary/` must be gitignored the
  same way `out/` is (check `.gitignore`; add the line if needed).

Also add an `ICON`s you need to `ui.mjs`'s `P` map (Lucide-style strokes).

## Sizes

Every screen at three sizes: desktop 1280×800, tablet (landscape) 1180×820,
phone 390×844. File names `<screen>-desktop.dc.html`, `-tablet`, `-phone`.

## The shell

- Sidebar grouped by rooms as `stage1.mjs` `ROOMS`, **but the Workshop room
  is now: Diary (main page), Overview.** Remove "Jobs" and "Booking
  requests" from Workshop. Mechanic (role K) sees only Workshop.
- No date/open-until line in the sidebar.
- Tablet: the sidebar collapses to an icon rail (~72px, icon + tiny label,
  room dividers), to leave room for the diary.
- Phone: top bar with menu button, as `staffPhone`.

## Status colours (Wheelhouse design system tokens)

pending (awaiting confirmation) bg `#f1e8fb` ink `#6a3ea1`; scheduled (booked
in) `#eaf1fb`/`#2c5289`; waiting for parts `#fff0e3`/`#a8420f`; on hold /
change requested `#fff7e0`/`#8a6100`; ready/done `#e8f5ec`/`#164f42`. Colours
that must be told apart also differ in lightness; every diary block also
carries a text label, never colour alone.

## Example data

Use only the example names, bikes, job numbers and prices already in
`stage2.mjs` (Maya Patel WH-1042 Trek Domane AL 3, Oliver Chen Brompton,
Sam Reed Specialized Sirrus, Jamie Brooks, Aisha Khan, mechanics Alex Morgan
and Jo Taylor, shop North Street Cycles, Bolton, the £65 standard service and
quote lines). The week shown is Mon 14 – Sun 20 Sep 2026, today Thu 17 Sep,
grid 09:00–18:00. Where something needs a value that has no source, write a
bracketed placeholder like `[time]`. No logo: `logoSlot()`.

## Screens (rows on the canvas, in this order)

**Row 1 — The diary**
1. `diary` (Staff, Jo Taylor): week view; **"Waiting for you" column on the
   left** with three kinds of card — New booking request (pending), Change
   request (amber, "Mon 10:00 → 14:00"), Cancelled by customer (grey) — each
   card a link; an Unscheduled row at the top of the grid; jobs as blocks in
   mechanic/time, each block with status label; Week / Day switch, Prev /
   Today / Next, mechanic filter (Everyone, Alex, Jo). Empty slots show a
   hover "+ New job" hint on one slot to explain click-to-create. Tablet:
   icon rail + narrower column (or collapsible) + 5 or 7 days. Phone: **one
   day** at a time (day strip to switch days), jobs listed down a time line,
   a "Waiting (3)" button at the top that opens the column.
2. `diary-mechanic` (Mechanic, Alex Morgan): same diary opened on "Me"
   (switch Me / Everyone), showing their jobs; no Waiting column unless the
   role can act on requests (mechanics can't accept bookings — omit it).
3. `waiting-open` (phone and tablet only is fine, but still draw desktop as
   the column with a request selected): the waiting list opened as a sheet on
   phone.

**Row 2 — Requests, in the panel** (panel ~480px wide over the right of the
diary on desktop/tablet with the diary visible and dimmed-lightly behind it;
full screen on phone with a back/close control)
4. `request-new`: new booking request — customer, bike, what the customer
   told us (quote), requested day/time, service and price, mechanic select;
   actions Accept (primary), Offer another time, Decline.
5. `request-decline`: decline with a message to the customer (copy from
   stage2 `reject`).
6. `request-change`: customer's change request — from/to times, Accept
   (primary), Decline, Open full job. (Matches the built behaviour: no "Seen"
   on a change request.)
7. `request-cancel`: cancellation — what was cancelled, when; one action,
   "Seen".

**Row 3 — New job from an empty slot**
8. `new-job`: the slot clicked is highlighted in the grid; panel "New job"
   pre-filled "Tue 15 Sep · 10:00 · Alex Morgan" (editable), customer search
   (with "New customer"), bike, work/service, what the customer told us,
   estimated time, Save (primary). Note under the form that bikes with no set
   time go in the Unscheduled row.

**Row 4 — The job, in the panel** (staff panel has tabs Overview, Quote,
Checklist, Messages, History — reuse stage2 copy)
9. `job-overview`: WH-1042 with status and main next action "Book in".
10. `job-book-in`: bike booked in and the bike tag printed — tag preview with
    a **Code 128 barcode**: draw real-looking bars (a simple SVG of bars is
    fine; label it with the job number underneath) — plus print status.
11. `job-quote`: quote lines and "Send quote".
12. `job-mechanic` (Mechanic): **no tabs** — what the customer agreed on one
    side/top, checklist and notes below; on phone tap-to-open rows.
13. `job-waiting-parts`: waiting for parts, delay message.
14. `job-finished`: work finished → **"Take payment"** (primary). Under it a
    small note: "Goes to [this shop's till: the Wheelhouse till or
    Lightspeed], set in Settings." Draw the Wheelhouse till version.
15. `job-collection`: customer collecting — hand-back checklist, paid state.

**Row 5 — Overview page**
16. `overview`: the workshop at a glance (stage2 `desk`), under Workshop ›
    Overview.

## Canvas

- `canvas.json`: `{"v":3,"createdOnFiles":{"v":1,"at":"<now>"},"title":"Workshop day — diary redesign","launch":{"view":"canvas"},"pages":[],"boards":{…},"order":[…],"notes":{…},"designSystems":[{"title":"Wheelhouse","namespace":"wheelhouse","artifact":"https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH","version":null,"copiedAt":"<now>"}]}`
- `Main.dc.html` first (1280×800): the title, one short paragraph saying this
  is the Workshop day redesign for review and the names are examples, and a
  list of the rows with links to each row's first board. No rationale essays.
- Layout: each screen's three sizes side by side (desktop, tablet, phone,
  80px apart), screens in a row left to right, 120px+ between rows; a
  `title1` note ≥223px above each row naming it (`maxW` = row width); give
  every board a `title` like "Diary · desktop".
- Prototype links: diary cards/blocks are `<a href="…dc.html">` to the
  matching board of the same size (a request card → `request-new-desktop`,
  a job block → `job-overview-desktop`, the highlighted empty slot →
  `new-job-desktop`); panel close links back to the diary. Boards with links
  get `"is_interactive": true`.
- Accessibility as drawn: real `<a>`, `<button>`, `<label>`+`<input>`,
  aria-label on icon buttons, touch targets ≥44px, text 4.5:1.

## Done when

- `node build-diary.mjs` runs clean and prints a count of 16 screens × 3
  sizes + Main = 49 boards (or says which screens intentionally differ).
- A fit check like `fitcheck.mjs` (Playwright render of every board) shows
  no content overflowing its board or sidebar; report its output.
- Nothing outside `docs/design/user-journeys/generator/` (and `.gitignore`)
  changed; nothing committed.
