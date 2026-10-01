# Journey 13 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 16 desktop renders of the
Receiving stock and purchase orders boards (1280 x 800: `rs-hub`,
`rs-hub-staff`, `rs-receive`, `rs-add-product`, `rs-frame`, `rs-problem`,
`rs-booked`, `rs-labels`, `rs-job-arrived`, `rs-delivery`, `rs-invoice`,
`rs-invoice-diff`, `rs-invoice-setting`, `rs-order`, `rs-restock`,
`rs-today-restock`), against
`docs/decisions/2026-09-30-receiving-stock-review.md` (decisions 1-9 and
"Noted for later"), `generator/receiving.mjs` (`hubBoard`, `receiveBoard`,
`scannedRows`, `qty`, `tag`, `link`, `line`, `section`, `addProduct`,
`framePopup`, `problemPopup`, `bookedBoard`, `deliveryBoard`, `invoiceBody`,
`invoicePopup`, `labelsPopup`, `orderBoard`, `poLine`, `restockBoard`,
`restockRow`), `generator/settings-frame.mjs` (`settingsPage`, `fold`, `pill`,
`rowSwitch`, `stockFolds`, `SETTINGS_ROOMS`, `popup`), `generator/ui.mjs`
(`C`, `button`, `icon`, `SAND`), `generator/opening.mjs` (`today()` with
`restock`), `generator/diary.mjs` (`partArrivedStrip`, `job-part-arrived`,
`shellDesktop`) and the rules for every journey in
`HANDOVER-next-journey.md`. Tablet and phone are not drawn yet, so nothing
here covers them.

**Scope.** `rs-job-arrived` reuses journey 12's approved job page: only the
"Part arrived" strip and the arrived line in the table are audited.
`rs-today-restock` reuses journey 10's approved Today: only the restock line is
audited. `rs-invoice-setting` is Settings › Stockroom: the Stockroom page is
audited, and the four-room Settings frame (new with decision 7) gets its own
finding (M13).

**Not raised, on purpose.** The [bracketed] placeholders. The unselected-pill
border contrast (parked as a design-wide fix; the − / + number box uses the
same thin border, so it is covered by the same fix). 12-13px text that is only
a label or a second line. A pop-up's ✕ being a link, and Today and Reports
sharing one icon. Supplier basket CSV formats being unknown. "Clipped" reports
from the scroll areas in the renderer. None of Jack's 9 decisions is reopened:
orders built by hand, deliveries scanned in, everyone receives and ordering
needs "Can order stock", the frame number at booking in, the switchable
invoice check, four Settings pages, labels only for what needs one, and
problems marked at booking in. The "Returned" button wording is his (decision
9) and stays.

**Verdict.** The look is right and the basics hold. Soft sand throughout,
amber only for the "you are here" marker and real warnings, one dark main
button per board, every button, pill, select and stepper button 44px tall
(`button()` has `min-height: 44px`; `qty()` buttons are 44 x 44; `pill()` and
`link()` are 44), every status in words (Job WH-1042 is waiting for 1, Not in
Wheelhouse yet, Doesn't match, Draft, Part received, · low, · fast). The
Settings switch is now a real `role="switch"` button with the word On or Off
and a 48px row (`rowSwitch()`), which fixes what the journey 5 audit found.
Contrast, worked out by hand from the colours in `ui.mjs`: grey text about
5.5:1 on cards and 4.9:1 on the page; grey tag text on its pill 4.7:1; green
text and tag 7.7:1 and 6.5:1; amber text on a card 6.3:1 and on its amber tag
5.3:1; white on the dark buttons 14.7:1. The problems are in what the boards
leave out. The part-arrived flag only exists on the job page, so nobody is
told. A quantity cannot be typed, though decision 3 says it can. The happy
ending of the invoice check is not drawn. A delivery with a damaged item would
show "The invoice doesn't match" every time. The Orders rows cannot be opened.
The hub scrolls now, and the two lists that need someone to act sit at the
bottom. Findings are ranked; where a fix is a real choice the options are
numbered.

Checked against the source, not just the pictures: `qty()` draws the number as
a `<span>`, not a field; `hubBoard()` draws the Orders rows with a tag and no
link or button; `deliveryBoard()` takes `'none'` or `'diff'` only, and
`invoiceBody()` has no matching branch; `scannedRows()` has no problem, bike or
removed-line variant; `tag('Invoice to check', 'warn')` in the hub against
`tag('Not checked yet', 'grey')` on the delivery; `restockRow()` draws the
tick box at 20 x 20px inside a 44px cell; the restock column headings are
`aria-hidden`; `supplierPick`, `orderBoard` and `labelsPopup` use `<select>`;
"Part arrived" appears only in `partArrivedStrip()` and `job-part-arrived`
(searched across the whole generator folder, so no diary card, Workshop
Overview or Today board carries it); `settingsPage()` puts the heading and the
Jump to pills outside the scroll area, and draws `pill()` (which has
`aria-pressed`) for them; `problemPopup()` passes the fixed word "Damaged" to
`qty()`.

---

## High

**H1 — `rs-booked`, `rs-job-arrived`: the flag on the waiting job is only on the
job page, so nobody is told.**
Decision 2 says receiving a part flags the job. The only place the flag is
drawn is inside the job itself (the green "Part arrived" strip and "Arrived" in
the In stock column). The booked-in board says "flagged on the job for Alex
Morgan", but no board shows what Alex sees: the diary card, the Workshop
Overview and Today do not change (nothing else in the generator draws it). The
job stays amber "Waiting for parts" until somebody opens it and presses Carry
on with the work.
*Why it matters:* the flag is the whole point of decision 2. A part can sit on
the shelf while the bike sits in the workshop because nobody opened that job.
*Options:*
1. Show the green "Part arrived" badge (words, with its tick) on the job's
   diary card and Overview card until the job is carried on. No extra clicks;
   it is seen at a glance. Changes journey 12's approved boards, so those need
   rebuilding and republishing.
2. As 1, and also a message to the mechanic. No staff message system is
   designed yet, so this adds a new piece.
3. Leave it on the job page only.
Recommend 1. Also in the strip: make "Shimano brake pads B05S-RX booked in" a
link to the delivery (44px), so the job page can show where the part came from.

**H2 — `rs-receive`, `rs-order`, `rs-restock`, `rs-labels`, `rs-problem`: a
quantity cannot be typed.**
Decision 3 says "a quantity can be typed". In `qty()` the number between − and
+ is a `<span>`. A delivery of 24 inner tubes is 23 presses of +; a reorder of
12 is the same. Every count in the journey uses this one control, so it is the
most repeated step in the journey.
*Why it matters:* Jack's fewest-clicks rule, and it contradicts a decision.
*Options:*
1. Make the number a 44px tall number field: tap it, type, done. − and + stay.
   One change in `qty()` fixes all five boards.
2. Keep the span and press-and-hold to speed up. Still slow for exact numbers.
Recommend 1.

**H3 — `rs-delivery`, `rs-invoice`, `rs-invoice-diff`: the normal result of the
invoice check, and what happens after the two buttons, are not drawn.**
Decision 6 says a matching invoice marks the delivery "Invoice checked". That
board does not exist: `invoiceBody()` only draws "Add the invoice" and "doesn't
match". After "Mark as queried with [Supplier]" or "Accept the difference"
nothing is drawn: does the amber box go, who accepted it, can it be undone,
how does a queried delivery ever become checked? The Recent deliveries row in
the hub has no state for any of these either.
*Why it matters:* the matching case is most deliveries, and the one most
likely to be used is the one not drawn. Accept is a money decision with no way
back.
*Fix:* draw four states on the same page: Invoice checked (green tag with its
tick, "Invoice [number] · £[x] · matches", no buttons), Queried (grey,
"Queried with [Supplier] · [date] · Jack Lewis", with the two buttons still
there), Accepted (grey, "Difference of £[z] accepted · Jack Lewis · [date]"),
and the hub row for each.
*Options for Accept the difference:*
1. One click with a "Saved · Undo" note (the same note Settings uses). No
   extra click; recorded with who and when. Matches the trust-over-lock-down
   stance.
2. A small pop-up asking for a reason first. Safer; one more click for every
   accepted difference.
Recommend 1.

**H4 — `rs-delivery`, `rs-invoice-diff` against `rs-problem`: a delivery with a
damaged or wrong item would be reported as "The invoice doesn't match" every
time.**
Decision 9 keeps damaged and wrong items out of stock, so they are not in the
"Booked-in cost, before VAT". Decision 6 compares the invoice with that cost.
If the supplier invoiced the whole box (which Jack can confirm from his own
invoices; nothing in the files says), every delivery with a problem shows a
difference equal to the set-aside items. `rs-delivery` also lists only the
good lines, so the page never shows the problem items at all.
*Why it matters:* "Doesn't match" is a warning. A warning that is wrong every
time a problem is marked stops being read.
*Options:*
1. Keep decision 6 as it is, and show a line on the delivery, "Set aside as
   problems · [n] items · £[w]" (with Damaged / Wrong item in words). When
   the difference is there, say "£[w] of this is items set aside as problems".
2. Compare the invoice with booked in plus the set-aside items. Quieter, but
   changes what decision 6 says it compares.
3. Leave it.
Recommend 1.

---

## Medium

**M1 — `rs-hub`: the hub scrolls, and the two lists that need someone to act
are at the bottom.**
Section order in `hubBoard()`: A delivery arrived?, Restock list, Orders, To
return, Recent deliveries. The first is right. The render shows To return cut
in half and Recent deliveries not at all, and Orders and Recent deliveries
will only get longer. Recent deliveries is where the "Invoice to check" tag
sits, and To return is a list of things to send back: both are jobs to do,
under two lists to browse. Also, decision 2 says many shops never raise an
order in Wheelhouse, so their Orders card would be empty for ever, and no empty
state is drawn for any card.
*Options:*
1. Order: A delivery arrived?, To return, Restock list, Orders, Recent
   deliveries. To return shows only when something is on it; the invoice tag
   stays in Recent deliveries. Nothing extra to learn; quiet days stay short.
2. Keep the order and add a "Jump to" row of pills, like Settings now has.
   Consistent; costs a row at the top, and the work still sits low.
3. Leave it.
Recommend 1. Draw the empty Orders card as "No orders. Shops that order on the
supplier's website can ignore this" with "+ New order" kept.

**M2 — `rs-hub`, `rs-order`: the Orders rows cannot be opened, and an order
with leftovers cannot be closed.**
In `hubBoard()` the two Orders rows have a grey tag and nothing to press
(Recent deliveries has "Open", To return has "Returned"). So a Draft cannot be
carried on, an ordered order cannot be looked at, and there is no way to
receive against it. "Mark as ordered" has no board after it. Missing items
"stay to come on the order" (decision 9), but an order whose last items never
come has no way to end, so "Still to come on the order" lists fill up with old
lines.
*Options:*
1. Each row is "Open". An ordered order offers "Receive against this order"
   (opens Receive with the supplier picked), and one that has arrived in part
   offers "Close the order" with a note "Anything still to come is dropped".
2. Open only, no close. Simpler; the old lines sit there until the order is
   deleted.
Recommend 1. Draw the ordered state of `rs-order`.

**M3 — `rs-receive`, `rs-problem`, `rs-frame`: the scanned list has no way to
show a problem, a bike, a mistake or an unfinished line.**
`scannedRows()` draws only the same four rows. After "Mark as damaged" nothing
on the list says so and "Book in [n] items" is not shown counting only the good
ones. There is no bike row at all (the frame popup opens over a list with none).
Unlike the order lines (`poLine()` has a ✕), a scanned line has no way to
remove a wrong scan. And "Book in" is drawn the same whether or not an unknown
barcode is still waiting ("· 1 to add first" in small grey text beside it).
*Fix:* draw them: a line with "Damaged · 1" in amber with its alert icon, a
bike line with its frame numbers underneath ("Frame [number]" each), − at 1
removes the line with a "Removed · Undo" note, and the Book in button counting
only what will be added.
*Options for an unknown barcode still on the list:*
1. Pressing Book in stops with "Add [barcode] first" and scrolls to that line.
   Nothing gets forgotten; a click more only when it happens.
2. Books in the rest and leaves the unknown on the list as "Not booked in",
   repeated on the booked-in board. Faster; easy to forget.
Recommend 1.

**M4 — `rs-frame`: the frame number pop-up has no mistake states, asks for a
count it cannot know, and promises a warranty.**
No state is drawn for a frame number already in stock (the most likely mistake:
the same sticker scanned twice), or for a number typed wrong. The subtitle "bike
[n] of [n] in this delivery" needs a total that only exists with an order
behind it. "Count this bike" is one more click after the sticker is scanned,
on every bike. And the note says "its warranty starts from the right bike".
Decision 5 says nothing about warranty (it is about the till picking the
bike); the feature catalogue has warranty expiry on a bike record (BIKE-06), so
it is plausible, but nobody approved it for this pop-up.
*Fix:* scanning the sticker counts the bike by itself (a code checks itself,
like a PIN on its 4th digit) and the pop-up closes; typing still has "Count
this bike". Add the "This frame number is already in stock" message, in words,
with the date it was booked in. Subtitle "bike [n] in this delivery" when
there is no order. Take the warranty words out, or ask Jack to approve them.

**M5 — `rs-hub`, `rs-delivery`: one state with two names and two colours, and
"Part received" clashes with "Part arrived".**
The hub tags a delivery waiting for its invoice amber, "Invoice to check"
(`tag(..., 'warn')`). The delivery page tags the same state grey, "Not checked
yet". Nothing needs checking until the invoice is added, and it is a routine
wait, not a warning (amber is kept for real warnings, till 12). Amber on every
new delivery will be ignored by the time one really doesn't match. Separately,
the order tag "Part received" means "partly delivered", but in this shop "part"
also means a bike part, and the job strip says "Part arrived" for that.
*Options:*
1. One word for both boards in grey, "Waiting for invoice" (decision 6 says
   "waiting for their invoice"); amber only for "Doesn't match". "Partly
   delivered" for the order tag.
2. Keep amber on the hub to keep the nag going. Chasing invoices gets more
   attention; the colour loses its meaning.
Recommend 1.

**M6 — `rs-restock`: one download button, but the rows come from different
suppliers; the tick boxes are small; the columns have no names for a screen
reader.**
The footer says "3 ticked · [Supplier]" and one "Download for [Supplier]'s
basket", while each row carries its own "[Supplier]". A basket file is per
supplier, so with two suppliers ticked the button cannot be right. The tick box
is 20 x 20px in `restockRow()` (inside a 44px cell, but the cell is not the
control). The column headings "In stock" and "Sold, last [n] days" are
`aria-hidden`, so the values ("[n] · low", "[n] · fast") have no names. The
pill "Everything" means "all of the low and fast ones", not all stock.
*Options:*
1. Group by supplier: a heading for each, with its own tick-all, Add to an
   order and Download for that supplier. Matches how baskets work.
2. Flat list; Download makes one file per supplier ("Download 2 files"). Fewer
   headings; the footer button changes meaning as you tick.
Recommend 1. Whichever: make the whole 44px cell the tick box (or wrap it in a
44px label), give each value a hidden name ("In stock: [n]"), and rename
"Everything" to "Both".

**M7 — `rs-receive`, `rs-add-product`, `rs-hub`, `rs-invoice`: the same kind of
action is a link in some places and a button in others, and the repeated names
say nothing.**
"Problem?" (link) and "Add this product" (button) both open a pop-up on the
same row. "Find it" and "Choose a file" (links) start a search and open a file
picker. The boards' own rule is right elsewhere: links go somewhere ("Open",
"See the list", "Open the job"), buttons do things. Also `link('See the list')`
appears twice on the hub with no difference, "Returned" once per row, "Open"
once per delivery, "Problem?" once per line: a screen reader list of links
reads "See the list, See the list".
*Fix:* keep the look, make "Problem?", "Find it" and "Choose a file" real
buttons (Space works, and they are announced as buttons). Give the repeated
ones a name that says which row: "Problem with Shimano brake pads", "Returned:
[Product], damaged", "Open delivery from [Supplier], [date]", "See the list of
products running low". Alternatively make the two hub rows one row, since both
open the same page with a different filter.

**M8 — `rs-receive`, `rs-order`, `rs-labels`: dropdowns where the rules ask for
pills, and a printer picked every time.**
Workshop day 62 and 66: pills for short choices, a search box for long lists.
"From" (Receive), "Supplier" (New order) and "Printer" (Print labels) are
native `<select>`s: two presses each, and the list is hidden.
*Options for the suppliers:*
1. Pills when there are five suppliers or fewer, a search box beyond that. One
   press for the usual suppliers; Receive could also start on the supplier used
   last.
2. Keep the dropdown. Fits any number; two presses and hidden.
Recommend 1. For the printer: start on the last one used and only show the
choice when the shop has more than one label printer. Today's Print labels
costs a pick on every delivery for a shop with one printer.

**M9 — `rs-add-product`: measurement names are typed free-hand, which will spoil
the search they exist for.**
Jack's point (Owner setup, Noted for later) is to find a part by its
measurements. `specRow()` gives a free text name, a value, and a unit shown as
plain text `[unit]` (not something you can choose or type). One person types
"Outside diameter", the next "OD", a third "outer dia", and a search for "30 mm
outside diameter" finds one of the three.
*Options:*
1. Suggest names the shop already uses as you type, and keep the unit as a
   small field beside the value. No set-up; the list builds up from what people
   enter.
2. A fixed list per kind of product set up in Settings › Stockroom. Most
   consistent; needs set-up before the first delivery.
Recommend 1.

**M10 — `rs-booked`: the booked-in board is a dead end for what comes next.**
It shows the job flag and two outline buttons, nothing else. It does not say
how many items went to To return or are still to come on the order (the
decision 9 outcome), and "Add the invoice" is not offered, so the invoice is
three presses away (Deliveries and orders, Open on the row, Add the invoice).
None of the three buttons is the main one, although "Print labels" is the usual
next step when any count is above 0.
*Fix:* add two grey lines when they apply ("[n] set aside as problems, on To
return to [Supplier]", "[n] still to come on the order", each a link), an "Add
the invoice" button for people who can order stock when the check is on, and
make "Print labels" the dark button when any label is due (else "Receive
another delivery"). Title the page "Delivery booked in" instead of repeating
"Receive a delivery".

**M11 — `rs-today-restock`: the restock line wraps the button and never
clears.**
The "Restock list" button wraps to two lines and the subtitle to two, so the
row is taller than the others (the same squeeze journey 5's audit found on
"Contact them"). The subtitle repeats the button ("Restock list · Stockroom ›
Deliveries and orders"). Nothing says when the line goes: if it stays while
anything is under its level, Needs attention becomes permanent for any product
the shop never reorders.
*Options:*
1. The line counts what is new since the list was last opened ("[n] new
   products running low or selling fast") and clears when opened or
   downloaded; it comes back when something new crosses its level.
2. Stays until every product is back over its level. Always true; never
   clears for some shops.
3. Once a week, like journey 9's refresh line.
Recommend 1. Either way: `white-space: nowrap` on the button, or the word
"Open" and drop "Restock list ·" from the second line.

**M12 — `rs-hub-staff`, `rs-delivery`: what a member of Staff sees when they
open a delivery is not drawn, and it would show the cost prices.**
Decision 4 lets Staff receive and see Recent deliveries with "Open". The
delivery board is drawn for Jack only, with a cost on every line and "Booked-in
cost, before VAT". Decision 6 hides the invoice card from Staff; nothing says
whether the costs are hidden too. Jo also marks problems (decision 9) but can
never see where they went, because To return is for people who can order
stock, and the note at the bottom of the hub ("Orders and the restock list
are for people who can order stock.") leaves that out.
*Options:*
1. Staff see the lines and quantities, without costs or the invoice. Cost
   prices are commercially sensitive and nothing in the decisions allows
   staff to see them.
2. Staff see everything but the invoice card. Simplest to build and in keeping
   with trust over lock-down; reveals what the shop pays.
Recommend 1. Draw the Staff delivery board, and add "returns" to the note.

**M13 — `rs-invoice-setting`: the four-room Settings frame (new today).**
What works: the room list is a `<nav>` named "Settings" with `aria-current`
and a dot and bold weight (not colour alone), every row is 44px; a room with
one area shows just its folds (Stockroom has no Jump to, correctly); the
switch is the fixed `rowSwitch()`. What needs a decision:
- *Pinned heading and Jump to.* In `settingsPage()` the room heading, its
  intro and the pills sit outside the scrolling area. On Front desk and Office
  (several areas) that is about 110px held on screen, so the content scrolls in
  about 570 of 800px. Acceptable, but no board shows it, because each board
  is drawn "as if scrolled to" its area and only a lower area's own board has
  the pills (for the areas above it, nothing is drawn: `shown` starts at the
  active area).
- *The pills are the wrong control.* `pill()` is a button with
  `aria-pressed`, which tells a screen reader it is a toggle. They are
  navigation: should be links to each area (`#set-till`) with `aria-current`,
  and the highlighted pill has to follow the scrolling (as drawn it stays on
  the one the board was built for).
- *Folds are not headings.* Areas are h3 in a multi-area room, but the
  fold titles are plain button text. In a single-area room (Stockroom,
  Workshop) there is no heading below the room name, so a screen reader's
  heading list cannot reach "Supplier invoices".
*Fix:* draw one Front desk board scrolled to the top, with the pills at the
top and "Till" highlighted, so the frame can be judged whole. Make the pills
links. Put each fold's button inside a heading (h3 in a single-area room, h4
under an area's h3). `fold()` and `pill()` are shared, so every Settings board
and journey 12's `diary-settings` boards are rebuilt and compared.

---

## Low

**L1 — `rs-receive`: four small gaps.**
- The supplier box still says "[Supplier] (optional)" while the "Still to come
  on the order" card and "on your order: [n]" are already drawn. Draw it with a
  supplier picked, or show the card only after one is.
- "Still to come on the order" sits under the Book in button. Someone booking in
  wants to see it before pressing; put it above the button, in the same card.
- Nothing announces a scan. A beep is not enough for someone who cannot see the
  screen: add a hidden `role="status"` ("Added Shimano brake pads, 1") and the
  same line shown briefly.
- The placeholder colour is not set in the source (`scanBox`, `framePopup`), so
  it falls to the browser's grey, about 4.5:1 at best (from memory of browser
  defaults, not measured). Set it to the grey text colour (5.5:1).

**L2 — every board: heading and way-back gaps.**
The page title (h1) and the card title (h2) say the same on Receive a
delivery, New order and Restock list. The sub-pages (Receive, Delivery, New
order, Restock list) have no back link; the sidebar's "Deliveries and orders"
is the only way. Fix: one title each (or make the card's title a real
description: "Scan the box"), and a "‹ Deliveries and orders" link, 44px, at the
top of the four sub-pages.

**L3 — `rs-hub`, `rs-add-product`: two links narrower than 44px.**
"Open" is about 36px wide and "Find it" about 42px (`link()` sets height only).
Add `min-width: 44px` and some side padding.

**L4 — wording and small faults.**
- The invoice difference only says "more" ("· £[z] more"). Also draw "less",
  with a word for which way, so the amber box reads "The invoice is £[z] more
  than you booked in".
- `problemPopup()` gives the stepper the fixed name "Damaged", so a screen
  reader hears "How many Damaged" after you pick Missing. Follow the pill
  chosen.
- The pop-up's note is only drawn for Damaged. Draw Wrong item (same note) and
  Missing ("stays to come on the order"); Missing only makes sense when there is
  an order, so show it only then, or say so.
- Print labels can reach "Print 0 labels" (every item has its own barcode):
  say "Nothing needs a label" and offer only Done.

**L5 — `rs-invoice-setting`: the Stockroom page is thin, and turning the switch
off has no consequence drawn.**
Not a decision to reopen, but nothing says where the supplier list, the
default low-stock level and a default label printer live. They are needed by
this journey's boards (M8, M6, `addProduct`) and Stockroom is the room
decision 7 made for them. When the check is turned off, the Invoice card and
the "waiting for invoice" tags should go from every board, including for
deliveries already waiting: say what happens to those.

**L6 — `rs-today-restock`: who sees the line is not settled.**
Decision 2 says the restock line is for managers on Today; decision 4 says the
restock list shows to owners, managers and anyone with "Can order stock". A
member of Staff with that switch sees the list in Deliveries and orders but,
as drawn, not the line on their Today. Pass to Jack: same rule for both, or
managers only.

---

## Answers to the specific questions

- **Status by words, not only colour:** yes everywhere: tags, "Job WH-1042 is
  waiting for 1", "Not in Wheelhouse yet", "· low", "· fast", "Doesn't match",
  On/Off on the switch, and the room list's dot plus bold weight. The amber
  wrench and alert icons are decoration beside words. Gaps: the states that are
  not drawn (H3, M3), and the Part arrived flag is only on one screen (H1).
- **44px targets:** buttons, pills, selects, − / + buttons, links (in height),
  the Settings rows, folds and the switch row all pass. Not passing: the
  restock tick box at 20px (M6), and "Open" and "Find it" narrower than 44px
  (L3).
- **Contrast:** everything drawn passes 4.5:1 (about 4.7 to 14.7:1). The only
  unknown is the input placeholder colour, which the source does not set (L1).
- **Fewest clicks:** the hub's first card and "Receive another delivery" are
  right (two presses from the sidebar to the first scan). Where clicks can be
  cut: typing a quantity (H2), the frame sticker counting itself (M4), the
  invoice one press from the booked-in board (M10), suppliers as pills and a
  remembered printer (M8), Accept the difference with Undo instead of a
  confirm (H3), a "Jump to" that follows the scroll (M13).
- **Accessibility:** pop-ups are `role="dialog"` with `aria-modal` and a
  labelled title; sections are `<section aria-labelledby>`; lists are real
  lists; the booked-in message is `role="status"`; the switch is fixed. To fix:
  repeated link names (M7), the hidden column names (M6), the Jump to pills
  and fold headings (M13), duplicate h1 and h2 (L2), announced scans (L1).
- **Consistency between boards:** the − / + stepper is one control everywhere
  (`qty()`), which is right, but only order lines can be removed (M3) and none
  can be typed (H2). Tags: one state has two names and colours (M5). Links and
  buttons: three actions drawn as links (M7). Order of things on the hub: M1.
- **The hub's section order:** the first card is right; the rest should put
  what needs doing before what is only listed (M1).
- **Data honesty:** the only real data used is Shimano brake pads B05S-RX, job
  WH-1042 (Maya Patel, Trek Domane AL 3, Alex Morgan the mechanic), Jack Lewis
  and Jo Taylor, the £28.00 figure in the approved job page, and the facts of
  the job page. Everything else is a placeholder. Two things stretch it: the
  frame pop-up's warranty sentence is not in any decision (M4), and the
  restock row for the brake pads is marked "low", a stock fact about a real
  product (harmless as a demonstration; say so, or make it "[n] · low" on a
  placeholder product). Nothing is invented in the labels popup: the 0 and the
  rules come from decision 8.

---

## Summary of what to decide

1. The part-arrived flag: on the diary and Overview cards too, plus a message,
   or job page only (H1, options 1-3; option 1 changes journey 12's approved
   boards).
2. A typed quantity: a number field between − and +, or press and hold (H2).
3. Accept the difference: one click with Undo, or a reason first (H3).
4. A delivery with problems against the invoice check: show the set-aside
   items, compare with them included, or leave it (H4, options 1-3).
5. The hub's order and its empty Orders card (M1, options 1-3).
6. Orders: openable and closable, or openable only (M2).
7. An unknown barcode still on the list at Book in: stop, or book the rest (M3).
8. The frame sticker counting itself, and the warranty sentence: keep it with
   Jack's yes, or remove it (M4).
9. "Waiting for invoice" in grey on both boards, or keep amber (M5).
10. The restock list by supplier, or one file per supplier (M6).
11. Suppliers as pills (or search) and a remembered printer, or dropdowns (M8).
12. Measurement names: suggest from names already used, or a fixed list (M9).
13. How the Today restock line clears (M11, options 1-3).
14. Whether Staff see cost prices on a delivery (M12).
15. Who sees the restock line on Today (L6).

Nothing here changes a decision. The link-and-button fix (M7), the booked-in
board's next steps (M10), the Settings frame's links and fold headings (M13),
the state boards in H3, and the small fixes in Low need only a yes from Jack.
No file other than this one was edited.

---

## Verification and outcome (1 Oct 2026)

Checked against the source before going to Jack: the count between − and +
was a `<span>` in `qty()` (H2); no board drew "Invoice checked" (H3); nothing
outside the job page showed "Part arrived" (H1); the Jump to pills were
`pill()` buttons with `aria-pressed` (M13). One correction: M4 says no
decision covers the frame pop-up's warranty sentence — Customer service
decision 4 (bikes bought at the shop show their warranty) does, so it stays.
Jack took every recommendation (decision 10 in the receiving-stock review).
H1 is drawn as two new journey 13 boards rather than by changing journey
12's approved diary and Overview, whose example week has WH-1042 scheduled,
not waiting. The shared Settings frame change (M13) was checked by rendering
journeys 5, 8 and 15 before and after: every render is byte-identical, so
the change is in the markup only; those boards and the big canvas were
republished to keep them in step with the source. Not drawn as boards: L4's "Nothing needs a label" state and the Undo after
removing a scanned line (described in the audit only).
