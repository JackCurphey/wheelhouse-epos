# Journey 3 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 26 desktop renders of the
Book a repair boards (1280 x 800: `bk-service`, `bk-service-many`, `bk-bike`,
`bk-bike-signed-in`, `bk-not-sure`, `bk-when`, `bk-when-full`,
`bk-when-dropoff`, `bk-details`, `bk-details-deposit`, `bk-sending`,
`bk-card-failed`, `bk-not-sent`, `bk-resume`, `bk-request`, `bk-confirmed`,
`bk-page`, `bk-change`, `bk-change-pending`, `bk-cancel`, `bk-cancel-late`,
`bk-cancelled`, `bk-declined`, `bk-expired`, `bk-unavailable`, `bk-settings`),
against `docs/decisions/2026-10-01-book-a-repair-review.md` (decisions 1-11),
`generator/book.mjs` (`site`, `stepDone`, `stepOpen`, `summaryBox`, `fullCard`,
`tick`, `limit`, `strip`, `earliest`, `time`, `detailsBody`, `bookingLines`,
`requestReceived`, `confirmedNow`, `bookingPage`, `cancelDialog`, `cancelled`,
`declined`, `onlineOpen`), `generator/ui.mjs` (`C`, `field`, `button`),
`generator/settings-frame.mjs` (`pill`, `popup`, `rowSwitch`, `workshopFolds`),
`generator/app-map.mjs` (`siteDesktop`), the neighbouring boards they have to
agree with (`generator/diary.mjs` request pop-ups, `generator/setup.mjs`
Messages list), the related decisions (Workshop day 7, 12, 15, 19, 41-43;
Collect and pay H2; Owner setup 11, 13, 14, 19; Signing in; App map 3, 10) and
the rules for every journey in `HANDOVER-next-journey.md`. Tablet and phone are
not drawn yet, so nothing here covers them.

**Scope.** The shop website's header and footer (`siteDesktop`) are shared
frame from journey A: only how the booking pages sit inside it is audited.
`bk-settings` uses the approved Settings frame: only the new Online booking
section is audited. `bk-request` and `bk-declined` are looked at from the
customer's side; the staff side (the diary's request pop-up) is a different
journey's board and is only raised where it has to agree with this one (M1).

**Not raised, on purpose.** The [bracketed] placeholders (including
`£[deposit]` and `[date and time]`). The unselected-pill border contrast
(parked as a design-wide fix). 12-13px text that is only a label or a second
line. A pop-up's ✕ being a link (parked design-wide). The shop logo slot. The
scroll areas the renderer clips. The boards from step 2 onwards showing the page
scrolled to the open step, with answered steps off the top and "Your booking"
pinned at the side. Real example data: the dates (Thursday 17 September),
Maya's details and the Release 1 fixture are as the file header of `book.mjs`
lists them. None of Jack's 11 decisions is reopened: redrawing the whole flow,
one page with a summary at the side, optional online deposits, a refund up to a
cut-off, every service at once, signing in offered but not required, a
two-week strip with Earliest first, confirming automatically as a shop setting,
nothing typed lost, changing and cancelling on the booking's own page, and one
Online booking section in Settings.

**Verdict.** The look is right and most of the basics hold. Soft sand
throughout, one dark main button per board, safe choice on the left and
confirming action on the right in every pop-up and in "Keep Thursday / Ask for
this date", every button, pill, day card and time button at least 44px tall,
every status in words (Waiting for the shop to confirm, Booking confirmed, New
date waiting for the shop, Full, Closed, "taken" read out on a used time, On /
Off beside every Settings switch). Contrast, worked out by hand from `ui.mjs`:
grey text about 5.5:1 on cards, 4.9:1 on the page and 4.7:1 on the grey "Full"
and "Closed" cards; amber warning text about 5.3:1 on its background. Error
messages use `role="alert"`, the sending line uses `role="status"`, and the
pop-ups are real dialogs with a named heading. The problems are mostly in the
money, and in what the customer is told at each moment. The refund cut-off that
decision 4 says the booking page and confirmation must carry is on the
confirmation only, and not on the booking page, the request screen or the
change-date screens. The page the texted link opens has no state for a
request still waiting. The cancelled screen says the deposit is coming back even
after the late-cancel pop-up said it was lost. A customer pays a deposit before
the shop has said yes, and nothing on the payment step says it comes back if the
shop can't fit them in. Findings are ranked; where a fix is a real choice the
options are numbered.

Checked against the source, not just the pictures: `bookingLines()` has no
"Free to cancel until" row and `bookingPage()` only ever draws two states
(`pending-change`, or Booking confirmed for everything else); `cancelled()` is
one fixed refund wording; `requestReceived()`, `confirmedNow()` and
`bookingPage()` all pass `deposit: true`, so the shop with no deposit (the
default, decision 3) never sees its own confirmation drawn; the `detailsBody()`
failed-send message adds "No money has been taken." whenever there is a deposit;
`tick()` rows are 44px but the terms row in `detailsBody()` has no `min-height`;
`limit()` has a 40px amount box; `field()` has no `autocomplete`; `time()` and
the step "Change" link hide words with `position: absolute; left: -9999px`; the
`pill()`, `fullCard()`, `bikeCard()`, `strip()` and `earliest()` choices are all
`aria-pressed` buttons; `requestNewBody()` in `diary.mjs` has no deposit,
spending limit or contact method; the Messages list in `setup.mjs` has one
booking row, "Booking confirmed", with Text off and Email on.

---

## High

**H1 — `bk-request`, `bk-confirmed`, `bk-page`, `bk-change`, `bk-change-pending`,
`bk-details-deposit`: the refund cut-off appears on the payment step and the
confirmation only, not on the request, the booking page or the change screens,
and the deposit is explained in different words each time.**
Decision 4 says "The booking page and the confirmation say 'Free to cancel
until [date and time]'". Where it actually appears:
- `bk-details-deposit` (payment step): yes, twice (the step, and the 13px line in
  the summary box).
- `bk-confirmed`: yes, but as a small grey line (14px) under the table, beside
  "We've texted you a link to this page."
- `bk-request`: no. It only says "If we can't fit you in, your deposit comes
  straight back."
- `bk-page` and `bk-change-pending`: no. They show "Deposit paid £[deposit]" and
  nothing about when it stops coming back.
- `bk-change`: no, and moving the date moves the cut-off, which the page does not
  say. The note reads only "Your booking stays on Thursday until the shop
  confirms the new time."
"Taken off the bill when you collect" (the part that tells the customer the
deposit is not an extra cost) appears only on the payment step. The confirmation
and booking page show a bare "Deposit paid £[deposit]".
*Why it matters:* the cut-off is the one date that decides whether Maya gets her
money back. She is most likely to look for it on the page she opens from the
text, on the day she wants to cancel. The one board that has it hides it in the
smallest text on the card.
*Fix:* make the deposit three rows in the same table on every one of those
boards (a real row, not a footnote), in this order: "Deposit paid £[deposit] —
taken off your bill when you collect", then "Free to cancel until [date and
time]". Before the cut-off the second row is plain text; after it the row
changes to "Deposit no longer refundable" in the warning colour (the words
already used in `bk-cancel-late`). On `bk-request` add the same row, so a
request and a confirmed booking read alike. On `bk-change`, add under the strip:
"If you move to [new date], you can cancel for free until [new cut-off]." and keep
"Your booking stays on Thursday until the shop confirms the new time." Use one
wording everywhere; the step 4 sentence and the summary box sentence are the
model.

**H2 — `bk-page`, `bk-cancelled`, and states with no screen: the link in the
text has nothing for a request still waiting, the cancelled screen contradicts
the late-cancel pop-up, and four things the customer will be told have no board.**
Verified in `bookingPage()`: any state other than `pending-change` draws the
green "Booking confirmed" chip. So the link texted from `bk-request` ("so you can
check it, change the date or cancel") opens a page that says the booking is
confirmed when it is not. Also the page's own wording, "Your booking · WH-1042",
calls it a booking before the shop has accepted it, against the names decision
(a request is a "booking request" until confirmed).
`bk-cancel-late` ends with the button "Cancel and lose the deposit". The only
cancelled screen (`bk-cancelled`) then says "Your £[deposit] deposit is on its
way back to your card." The late cancel is drawn, and the confirmation of it
says the opposite.
Missing, each of which the decisions say the customer meets:
- the shop **offers another time** (Workshop day 15). `bk-declined` has only
  "Choose another date"; nothing shows an offered time with an Accept button.
- the shop **declines a change**. `bk-change-pending` shows the wait, but no
  screen shows the answer, and whether the booking stays on Thursday.
- **no deposit** (the default, decision 3). `bk-request`, `bk-confirmed`,
  `bk-page` and `bk-cancel` are all drawn only with a deposit; the plainest
  version of each is never seen.
- **a drop-off day** booking. Decision 10 says the page shows "any mechanic
  picked"; `bookingLines()` has no Mechanic row and no drop-off window, and
  `bk-confirmed` still says "Arrive at 09:30".
- **Your bookings**, where a signed-in customer opens a booking (decision 10).
  No board shows the list, what it says for each booking, or how a waiting
  request, a confirmed booking and a past one differ. The Account link in the
  header leads to the sign-in boards only.
*Why it matters:* the most common customer visit to the page is "did they
confirm yet?" and today the drawn answer is wrong. A customer who loses a
deposit after being told it was coming back is a dispute and a one-star review.
*Fix:* draw, on the same address: a request-waiting state (purple "Waiting for
the shop to confirm" chip, heading "Your booking request", "Change the date" and
"Cancel request" as the two buttons, nothing about "Booking confirmed"); a
cancelled screen with two wordings chosen by the cut-off ("Your deposit is on its
way back" and "Your £[deposit] deposit was kept because it was after [date and
time]"); the offered-time screen ("[Shop] suggests [new day and time]. Accept /
No thanks, cancel my request"); a change-declined notice at the top of the page
("The shop couldn't do [new date]. Your booking is still [Thursday 17
September]"); and the same boards for a shop without a deposit, with a drop-off
shop's mechanic row. Draw "Your bookings" as a list of cards: bike and service,
date, the status chip, and "Open" on each.
*Decision for Jack:* how the customer answers an offered time.
1. A button on the booking page ("Accept this time" / "Cancel my request"), opened
   from the text link. Matches the rest of the journey and costs one click; needs
   the offered-time screen.
2. Replying to the text. Nothing to draw on the website; but a reply has to be
   read and matched by a person, and fails for anyone who chose email.
Recommend 1.

**H3 — `bk-details-deposit`, `bk-not-sent`, `bk-not-sure`, `bk-declined`: the
deposit is taken before the shop says yes, and nothing on the payment step says
what happens then; one error message could tell a customer something untrue.**
Three separate problems in the same moment.
- *Paid before accepted.* With "Confirm bookings automatically" off (the
  default), the button reads "Pay £[deposit] and send" and takes the money, then
  the shop decides. The payment step explains the cut-off and what the shop
  keeps ("After that, or if you don't come, the shop keeps it."), but not the
  most important sentence for a request: if the shop says no, it comes back in
  full. That sentence appears only after paying, on `bk-request`. The refund
  time is also inconsistent: `bk-cancel` says it "can take [n] working days to
  show", while `bk-declined` and `bk-cancelled` say "on its way back" with no time.
- *"No money has been taken."* In `detailsBody()` the "Not sent yet — check your
  connection" message adds "No money has been taken." for a deposit booking.
  That is only true if the connection failed before paying. If it dropped just
  after the card went through, the sentence is false, and the natural next move
  is to press Try again and pay twice. No deposit version of this board is drawn
  (`bk-not-sent` has no deposit), so it has never been looked at.
- *"Not sure" with a percentage deposit.* `bk-not-sure` shows Price "—", and the
  Settings page sets the deposit as "A percentage of the price", for "Every
  booking" or "Chosen services". A percentage of nothing is nothing, so the
  customer pays no deposit, or the page breaks. No board or setting says which.
*Why it matters:* it is the customer's money, and each of these is a point where
a customer stops, rings the shop, or disputes the charge.
*Fix:* above the card form (and in the summary box under "Deposit to pay now"),
when bookings are requests: "We take the deposit now. If the shop can't fit you
in, it comes back in full within [n] working days." Use the same "[n] working
days" wording on `bk-declined` and `bk-cancelled`. For the failed send with a
deposit: "We're checking whether your payment went through. Please don't pay
again." with a "Check again" button, and the rule from decision 9 (pressing
twice books once) shown to apply to the payment too. Draw that board.
*Decision for Jack:* the deposit on a "Not sure" booking.
1. A fixed amount for these, set in Settings next to the percentage ("If the
   price isn't known: £[n]"). Best for shops that want money up front; costs one
   more row in Settings.
2. No deposit until the price is agreed. Simplest, nothing to set; shops with
   no-show problems get no protection on the bookings most likely to be vague.
Recommend 1.

---

## Medium

**M1 — `bk-request`, `bk-details-deposit`, Messages and the diary: what the shop
sees and what the customer is sent do not match what this journey asks the
customer for.**
The customer is asked for a deposit, a spending limit, a contact method, and can
add photos. The staff request pop-up (`requestNewBody()` in `diary.mjs`, board
`request-new`) shows the name, bike, note, service, requested day and mechanic
pills, and none of those four. Accept, Offer another time and Decline are decided
without seeing whether money is held. The Decline pop-up says "Declining
releases the request's reservation. The customer is told not to travel for this
request." and does not mention the refund that decision 3 makes automatic. The
spending limit is on the job page (Workshop day 42) but not on the request that
becomes the job.
The messages the customer receives are the same kind of gap. This journey sends
a request-received text, a confirmation, an offered time, a decline with the
shop's own message, a date-change answer and a cancellation (decision 9 says the
text arrives "whatever the customer does next"). The Messages list in Settings
has one booking row, "Booking confirmed", with Text switched off and Email on,
while this journey says "We've texted you" (see M2) and decision 6 makes text the
default.
*Why it matters:* staff cannot see that a deposit is waiting, so a Decline
surprises them with a refund, and the shop cannot edit or turn off five of the
six texts it sends.
*Fix:* two lines in the request pop-up ("Deposit paid £[deposit]" and "Customer
OK up to £200" as a small tag, as on the job page), and one more sentence in the
Decline pop-up: "Their £[deposit] deposit is refunded automatically." In
Messages add a group "Booking messages" with a row for each of the six, drawn in
the same row style, each with its wording draft for Jack to approve. Make the
Text / Email choice in those rows say "Customer's choice" instead of fixed
switches, since the customer picks the channel at step 4. (Journey 8 and
diary pop-ups are approved boards: these are additions, not a redraw.)

**M2 — `bk-bike`, `bk-request`, `bk-confirmed`, `bk-cancelled`, `bk-details`:
wording that says two different things on the same board, or says something the
customer did not choose.**
- *Extra work.* The summary box reads "Extra work — Go ahead up to £200" and, on
  the line below it, "Extra work is always agreed with you first." The first line
  is Maya saying the shop need not ask; the second says it always will. Under
  decision 43 (Workshop day) work within the limit goes ahead without a quote.
  "Go ahead up to £200" is also ambiguous: £200 on top of the £65, or £200 for the
  whole bill. The step 2 option says "Go ahead if it all comes to no more than £",
  which is the whole bill.
- *Text, whatever they chose.* `bk-request`, `bk-confirmed`, `bk-change-pending`
  and `bk-cancelled` say "We'll check the workshop diary and text you",
  "We've texted you a link" and "We've texted you to confirm". Step 4 lets the
  customer pick Text, WhatsApp or Email; someone who picked Email is told a text
  was sent.
- *The send button.* It reads "Send booking request" on every board. If the shop
  has switched on "Confirm bookings automatically", the customer is told it is a
  request and then sees "Booking confirmed".
- *Receipt.* The email box says "For your receipt" even when there is no deposit,
  so no receipt. If the customer picks Email for updates, it is also where
  updates go.
*Why it matters:* a customer who has agreed a limit should not be told the shop
will always ask; and a customer who chose email should not be told a text came.
*Fix:* summary box row "Extra work — OK if the whole bill is up to £200" or "We'll
call you first" for the other choice (the row is currently missing for that
choice), and a footnote change to "Anything above that is agreed with you
first." Replace "texted" with "[text / WhatsApp message / email]"
placeholders chosen from the customer's pick (one wording, drawn once on
`bk-request`). Button labels "Send booking request" (request) and "Confirm
booking" (automatic), and "Pay £[deposit] and send" / "Pay £[deposit] and book".
Email hint "For updates and your receipt".

**M3 — all choice boards: single choices are built as "pressed" buttons, the
steps do not say which of four they are, and focus after "Next" is not
described.**
Checked in `book.mjs`: the full-service cards (`fullCard`), the bike cards
(`bikeCard`), the day cards (`strip`), the times (`time`), the mechanic and
update-method pills (`pill`) and the Earliest card are all `aria-pressed`
buttons. A screen reader announces "Standard service, toggle button, pressed",
which says nothing about the other two cards being one-of-three, and arrow keys
do not move between them. The tick boxes for single jobs are correct.
Also:
- The step number circles (`num()`) are `aria-hidden`, so a screen reader hears
  "When?" but not "step 3 of 4". Sighted customers see the number.
- Pressing "Next" closes one step and opens the next; nothing moves keyboard
  focus to the new heading, so a keyboard user stays at the old button which has
  just disappeared up the page.
- The "Fully booked" tooltip (`role="tooltip"`) is shown on hover or tap
  (decision 7), has no link to the day card, and nothing says it also appears on
  keyboard focus. The Full and Closed cards are `aria-disabled` but still
  reachable; the visible word "Full" is read, the explanation is not.
- `bk-request`, `bk-confirmed`, `bk-cancelled` and `bk-declined` wrap the whole
  card, buttons and links included, in `role="status"`. A status region is meant
  to announce a short message that appears; a whole page inside one is read in
  full or not at all, and nothing moves focus to the heading.
*Why it matters:* Jack's first rule is accessibility. These are the screens
where a person with a screen reader either can or cannot book a repair.
*Fix:* make the single-choice groups real radio groups (`role="radiogroup"`
with the choices as `role="radio"`, arrow keys move, Tab leaves the group), keep
the tick boxes for single jobs. Read the step as "Step 3 of 4: When?" in
hidden text. After "Next", move focus to the new step's heading. Link the Full
tooltip to its card (`aria-describedby`) and show it on focus. On the answer
pages keep `role="status"` on one short line only ("Request sent" or "Booking
confirmed") and move focus to the heading.

**M4 — `bk-details`, `bk-details-deposit`, `bk-bike`: the terms box is already
ticked, its row is about 22px tall, and one box is under 44px.**
The terms line "I agree to North Street Cycles' booking terms and privacy notice."
is drawn ticked. A box that is ticked in advance is not agreement a customer
gave, and the board never shows it unticked or what happens if it stays that way.
Its row has no height, so the whole target is about 22px tall (measured in the
render at 612-634px) against the 44px rule; the box itself is 20px. The "most
the work can come to" amount box (`limit()`) is 40px tall (`min-height: 40px`)
where every other box is 44px. The fields have no `autocomplete` names (name,
phone, email), so the browser cannot fill them in for the customer.
*Why it matters:* a pre-ticked agreement is weak legal ground for the shop, and
a 22px target is the one a customer with shaky hands misses.
*Options:*
1. Remove the tick box and put a sentence beside the button: "By sending, you
   agree to our booking terms and privacy notice." One click fewer and nothing to
   miss; the shop should check the wording against its own terms.
2. Keep the box, unticked, 44px tall, and say in words when Send is pressed
   without it ("Please tick to agree to the booking terms"). Safer for some
   shops' lawyers; costs a click for every booking.
Recommend 1. Either way: 44px for the amount box, and `autocomplete="name"`,
`"tel"`, `"email"` on the details fields.

---

## Low

**L1 — `bk-when`, `bk-when-dropoff`: the Earliest card never shows it has been
taken, and taking it needs a second click.**
`earliest()` is drawn `aria-pressed` false on `bk-when` while Thu 17 and 09:30 are
already chosen below it, and unlike the service card there is no "Chosen" mark.
"Take it" (36px, but inside a card that is about 62px tall, so the target
itself is fine) is the same dark button as "Next: your details", so the main
button of the step and a button inside a card compete. Jack's fewest-clicks rule
makes "Earliest" the one-click path; today it is "Take it" then "Next: your
details", two.
*Fix:* when the earliest is chosen, show the check and "Chosen" like the service
card. Option for fewest clicks: "Take it" moves straight to step 4 with Change
still on the answered step. Wording: "Earliest you can have" and "Book this time"
is clearer than "Take it".

**L2 — `bk-service`, `bk-bike`, `bk-not-sure`, `bk-when-dropoff`: the summary box's
empty and half-full states.**
- Empty rows show a bare "—", which a screen reader skips or reads as "dash".
  "Price —" on `bk-not-sure` gives no reason; the customer does not know whether
  it is free, unknown or broken.
- On `bk-bike` the make, model and colour are typed in, but the Bike row is "—"
  until Next is pressed.
- The deposit appears only on step 4 boards. A shop that takes a deposit shows it
  to the customer at the very last step, though the summary box exists so the
  customer is never surprised (decision 2 lists "any deposit").
- The drop-off summary says "Thu 17 Sep, drop-off" without the window (09:00-18:00)
  or the mechanic picked.
- What the box shows when two single jobs are ticked, or a full service and
  singles together, is not drawn; there is one "Service" row and one price.
- Money formats differ: "£65" on the cards and answered steps, "£65.00" in the
  summary box and no pence anywhere else.
*Fix:* "Not chosen yet" in grey instead of "—" (or hidden text "not chosen yet");
"Price — we'll agree it with you first" for Not sure; fill the Bike row as
typed; show "Deposit £[deposit] at the end" in the box from the first step in
deposit shops (draw one board); window and mechanic on drop-off; one "£65" or
"£65.00" style; one rule for full service plus single jobs, shown in the summary
as a list.

**L3 — `bk-when`, `bk-when-full`, `bk-change`: the day strip.**
- "Earlier" is drawn in the grey text colour at the start of a strip whose
  earlier days (Mon 14 to Wed 16) are already past and are not shown, so the link
  looks switched off but is still a link.
- Eleven days are drawn (Thu 17 to Sun 27) and ten fit in the box (792px). The
  last card (Sun 27, Closed) is cut off with no cue, and the strip sits in a
  sideways scroll area with no keyboard focus. `bk-change`, at 1000px wide, shows
  all eleven.
- A day card reads as "Thu 17 [n] times", with no month, so a screen reader user
  cannot tell Thu 17 September from another month.
- In `bk-change` the day the booking is on (Thu 17) looks like any other card.
*Fix:* remove "Earlier" while there is nothing earlier, or mark it disabled in
words; show ten cards and "Later weeks ›", or add a visible edge cue; read each
card as "Thursday 17 September, [n] times"; mark the current booking "Your
booking" on the change page.

**L4 — `bk-change-pending`: "Keep Thursday instead".**
It withdraws the date change but the words do not say that. "Instead" of what?
*Fix:* "Cancel my date change", with "Cancel booking" kept as the second button.

**L5 — `bk-settings`: order and clarity of the Online booking section.**
- The section's one-line summary reads "Exact times · 2 hours' notice · each
  booking a request" and leaves out the deposit, though "Take a deposit when
  booking" is On. Folded, a manager cannot see that money is being taken.
  (Journey 5's audit made the same point about the Collection line.)
- "How much" has "%" built in as the unit. The board shows "A percentage of the
  price" chosen, but no board shows "A fixed amount" with "£" instead, and the
  boxes show `[n]`.
- "For: Every booking / Chosen services" does not say where the services are
  chosen. The answer is in a note at the very bottom ("Which services can be
  booked online is set on each service") and applies to a different thing
  (what can be booked at all).
- "Earliest booking — How soon a customer can book from now" with "hours" is a
  notice period; "Notice" or "Book at least [n] hours ahead" would match
  decision 11, which calls it "notice".
- The note about "Which services … who can be booked …" is placed after Terms, so
  a manager looking for who can be booked online reads three sections first.
- The Deposits block does not say that, with automatic confirming off, the
  customer pays before the shop has said yes.
*Fix:* summary line "Exact times · 2 hours' notice · deposit [n]% · each booking a
request"; swap the unit when the choice changes; "For: Chosen services" gets
"(choose on each service)"; move the services-and-people note to the top; add the
refund sentence from H3 as a note under the cut-off.

**L6 — all boards: how hidden text is made, and form hints not tied to their field.**
The extra words for screen readers (" taken" on a time, " change your bike" on
Change) are made with `position: absolute; left: -9999px`. It works in English
but can create a sideways scroll bar in a right-to-left language and is not the
standard technique. The hints "For your receipt", "Optional" and the grey line
under each textarea are not linked to their fields (no `aria-describedby`), so
they are not read with the field.
*Fix:* one shared "visually hidden" style (clipped to 1px, not moved off the
page) and `aria-describedby` for every hint.
**L7 — small wording.**
- A finished step shows the question above the answer ("When?" over "Thu 17 Sep,
  arrive 09:30"). The question under a tick reads oddly; the next step down the
  page uses the same words as its heading.
- `bk-declined` has "Choose another date": it does not say that Maya's bike,
  service and details are kept (decision 9). "Choose another date — we've kept
  your details".
- "Add a note for the shop" is a link next to two bordered buttons on every
  booking page; it looks like a different, lesser action. Decision 10 makes it
  the way to change the service, so it deserves the same button.

---

## Answers to the specific questions

- **Deposit, refund cut-off and request versus confirmed, across steps, summary
  box, confirmation and booking page:** not consistent. See H1 (cut-off missing
  from the request, booking page and change screens), H2 (a waiting request drawn as
  "Booking confirmed"; late cancel says refund), H3 (paying before the shop says
  yes; the failed-send line).
- **What a customer needs that is missing:** the offered-time screen, the
  change-declined state, a no-deposit version of each answer page, a drop-off
  version, "Your bookings", and the five Messages rows (H2, M1). The staff
  request pop-up does not show the deposit (M1).
- **Keyboard and screen reader:** `aria-pressed` used for single choices, no
  step count, no focus move, tooltips not linked, whole pages in a status region
  (M3); hidden-text technique and hints not linked (L6). Good: the dialogs, the
  alert and status lines, the headings (h1, then an h2 per step and for "Your
  booking"), 44px on almost everything.
- **Touch targets:** all buttons, pills, times, day cards and Settings switches
  pass. Under 44px: the terms row (about 22px) and the amount box (40px) (M4).
- **Contrast:** everything drawn passes 4.5:1 (about 4.7 to 5.5:1 for the greys).
- **Earliest, empty states, change-date page, settings order, data consistency:**
  L1, L2, L3-L4, L5. Dates, times and names agree across boards (Thursday 17
  September, 09:30, Maya Patel, Trek Domane AL 3, WH-1042). The one slip is the
  money format (£65 and £65.00, L2).
- **Fewest clicks:** signing in is optional, the saved bike and details are
  filled in for a signed-in customer, Text is the default channel, and the
  Earliest card exists. Where clicks can be cut: the terms tick (M4, option 1),
  "Take it" going straight to the details (L1).

---

## Summary of what to decide

1. Where the refund cut-off lives: as a row in the table on every answer board
   (H1). No options needed; a yes from Jack.
2. How a customer answers an offered time: a button on the booking page, or a
   reply to the text (H2, options 1-2).
3. The deposit on a "Not sure" booking: a fixed amount in Settings, or none until
   the price is agreed (H3, options 1-2).
4. The terms line: a sentence by the button, or an unticked box (M4, options
   1-2).

Nothing here changes a decision. The rest (the missing boards and wording in
H1 to H3, the staff pop-up lines and Messages rows in M1, the wording in M2, the
radio groups, step count and focus in M3, and all the Lows) need only a yes from
Jack. No file other than this one was edited.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | request, confirmed, page, change, change-pending | The "Free to cancel until" line is missing from the request, booking page and change screens, and worded differently where it appears | Yes |
| H2 | page, cancelled and missing states | A waiting request opens as "Booking confirmed"; late cancel says "on its way back"; no offered-time, no-deposit, drop-off or Your bookings screens | Yes (option 1-2) |
| H3 | details-deposit, not-sent, not-sure, declined | Deposit taken before the shop says yes with no word on refund; "No money has been taken" can be untrue; Not sure plus percentage has no answer | Yes (option 1-2) |
| M1 | request pop-up (diary), Messages | Staff cannot see the deposit or limit; five of six booking texts have no row | Yes |
| M2 | bike, request, confirmed, cancelled, details | "Extra work" contradicts its own footnote; "texted" whatever the customer chose; "request" button on automatic shops | Yes |
| M3 | all choice boards, answer pages | Single choices built as pressed buttons; no step count; no focus move; whole pages in a status region | Yes |
| M4 | details, bike | Terms already ticked and 22px; amount box 40px; no autocomplete | Yes (option 1-2) |
| L1 | when, when-dropoff | Earliest never shows it is taken; two clicks | Yes |
| L2 | service, bike, not-sure, when-dropoff | Summary box: bare dashes, late deposit, missing window and mechanic, mixed money formats | Yes |
| L3 | when, when-full, change | Strip: dead "Earlier", hidden last card, no month read out, current booking unmarked | Yes |
| L4 | change-pending | "Keep Thursday instead" does not say it cancels the date change | Yes |
| L5 | settings | Folded line leaves out the deposit; unit stuck on %; "Chosen services" has no pointer; note at the bottom | Yes |
| L6 | all | Off-screen hidden text technique; hints not linked to fields | Yes |
| L7 | various | Question over a finished answer; details kept not said; Add a note looks lesser | Yes |

## Verification (1 Oct 2026)

Checked in the main session against the source before Jack chose: the
"Booking confirmed" badge on the page of a request still waiting
(`bookingPage`), "is on its way back" on the only cancelled screen, "No money
has been taken" in the deposit "Not sent yet" message, the pre-ticked terms
box, the 40px amount box, and "Extra work is always agreed with you first"
under "Go ahead up to £200" all held. Jack took every recommendation (Book a
repair decision 12), with option 1 in H2, H3 and M4. The staff request and
decline pop-ups with a deposit are new boards on journey 3's canvas; the
diary's own request boards were rebuilt and are unchanged.
