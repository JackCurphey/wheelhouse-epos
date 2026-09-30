# Journey 5 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 10 desktop renders of the
Collect the bike and pay boards (1280 x 800: `cp-summary`, `cp-pay`, `cp-paid`,
`cp-summary-inshop`, `cp-ready-unpaid`, `cp-till`, `cp-ready-paid`,
`cp-today-uncollected`, `cp-setting`, `cp-messages`), against
`docs/decisions/2026-09-30-collect-and-pay-review.md` (decisions 1-4),
`generator/collect.mjs`, `generator/diary.mjs` (`job-ready-unpaid`,
`job-collection`, `handOverFooter`, `takePaymentFooter`, the two strips),
`generator/settings-frame.mjs` (`workshopFolds`), `generator/opening.mjs`
(`today()` with `uncollected`), `generator/setup.mjs` (`msgListOpen`),
`generator/app-map.mjs` (`siteDesktop`), `generator/job-page.mjs`
(`CHECKLIST_10`), `generator/till.mjs` (`jobBasket`), `generator/ui.mjs` and the
rules for every journey in `HANDOVER-next-journey.md`. Tablet and phone are not
drawn yet, so nothing here covers them.

**Scope.** `cp-ready-unpaid` and `cp-ready-paid` reuse journey 12's approved job
page: only the strip at the top and the footer are audited. `cp-till` is
journey 11's approved board: only the job being loaded is audited.
`cp-messages` is journey 8's approved board: only the new "Bike still waiting"
row is audited.

**Not raised, on purpose.** The [bracketed] placeholders. The unselected-pill
border contrast (parked as a design-wide fix). 12-13px text that is only a
label or a second line (this covers the 12px notes beside the footer buttons
and the 12px chips). The design-wide parked items: a pop-up's ✕ being a link,
and Today and Reports sharing one icon. The till sidebar clip report. Maya's
email differing between journeys and WH-1045's diary time (both already open
items). The shop website's own header and footer links (shared frame from
journey A, not changed here). The dark "Bike is here" button on the job page
(journey 12's; it looks like a second main button next to Take payment or Hand
over, but it is approved and unchanged). The "Bike ready" message wording
(Owner setup 23, which still says "to pay on collection" while the link now
offers Pay now; the wording is decided, so only the new message is raised,
under M6). None of Jack's 4 decisions is reopened: Pay now on the summary when
online payments are on, one main button at the counter, the two hand-back ticks
becoming optional, and a reminder then a flag on Today.

**Verdict.** The look is right and the accessibility basics hold. Soft sand
throughout, amber only as the "you are here" marker, one primary button per
board, every button, pill and number box 44px tall (`button()` has
`min-height: 44px`; the days boxes are 44px), every status in words (Ready for
collection, To pay, Paid, All working well, Needs attention · 1). Contrast,
worked out from the colours in `ui.mjs`: grey text about 5.5:1 on the cards and
4.9:1 on the page; the green "All working well" about 7.7:1; the green "Paid"
chip about 6.5:1; the amber "To pay" chip about 5.3:1. The one control that
falls short is the Hand-back reminders switch (M5). The problems are in what the
boards leave out. The customer's link is only drawn for the one moment before
paying, so it would still say "Pay £111.00 now" after the bill is paid. Money
is shown as £111.00 even when a deposit has already been taken. Nothing stops
the customer and the counter both taking the same payment. "Contact them" goes
nowhere and never clears. Findings are ranked; where a fix is a real choice the
options are numbered.

Checked against the source, not just the pictures: `pay()` and both strips use
`WORK_TOTAL_APPROVED` with no deposit path; `paid()` has no `<h1>` (its title is
an `<h2>` from `h()`) and no `role="status"`; the desktop pay card comes after
the whole left column in the markup; `box()` returns a plain `<div>` card;
`jobBasket()` draws the job lines without `fixed`, so the − / + steppers show
(the `fixed` flag that hides them already exists and the deposit line uses it);
the desktop switch in `toggleSwitch()` is a `<span role="switch">` with a
`<label for>` pointing at it, no On/Off word, and a 26px track;
`collectionStripCompact()` says only "Payment already taken."; `opening.mjs`
draws the Contact them line with no second state; `set-msg-edit` exists only for
"Bike ready".

---

## High

**H1 — `cp-summary`, `cp-pay`, `cp-paid`, `cp-summary-inshop`: the link only has
a screen for "before paying", so reopening it later still offers Pay now, and a
failed card has no screen.**
The text message link is the only way back to this page. `cp-paid` is only
reached straight after paying. If Maya taps the link again that evening (to
show the receipt, or to check), the drawn summary says "To pay £111.00" with
"Pay £111.00 now". The same happens after she has collected the bike. A card
that fails (declined, cancelled) has no board either: `cp-pay` shows the form
and "Pay £111.00" only. Nor does anything say how long a link with her name,
bike and note stays open, when it needs no sign-in.
*Why it matters:* a customer can be invited to pay a bill they have already
paid, which is the worst thing a payment page can do. A failed card with no
message is where people give up or pay twice.
*Fix:* draw three more states on the same address: paid (the summary stays, the
"To pay" card becomes "Paid £111.00 on [date]" with the green Paid chip and no
button), collected ("Collected on [date]"), and a card that didn't go through
(a message above the form, in words, "Your card wasn't charged", with "Pay
£111.00" still there).
*Decision for Jack:* what the link does once the job is finished.
1. Stays live for [n] days after collection, then says "This link has expired —
   contact North Street Cycles, Bolton". Best for customers who want proof of
   what was done; costs one expiry setting and one more board.
2. Stops working as soon as the bike is paid. Simplest, and the page holds
   personal details for less time; costs a dead end for anyone who opens it
   again, and the record of what was done is gone from the customer's side.
Recommend 1.

**H2 — `cp-summary`, `cp-summary-inshop`, `cp-ready-unpaid`: a job with a
deposit still shows, and would charge, the full £111.00.**
Selling at the till 11 (already decided) leaves the balance to pay at
collection, and journey 11 draws that balance (`till-job-balance`). In this
journey both the customer's "To pay" card and the counter's "To pay" strip use
the job total (`WORK_TOTAL_APPROVED`), and "Pay £111.00 now" takes all of it.
*Why it matters:* the customer would pay the deposit twice over, online.
*Fix:* draw one deposit variant of the summary and of the strip. Summary: "To
pay" becomes "Balance to pay", the big figure is [£ balance], a line above says
"Deposit paid [£ deposit] of £111.00", and the button reads "Pay [£ balance]
now". Strip: "To pay [£ balance]" with "Deposit [£ deposit] paid" in the
grey text where "Customer told the bike is ready." sits now. The till already
draws this case; only the two boards here are missing it.

**H3 — `cp-ready-unpaid`, `cp-till`, `cp-summary`: nothing handles the customer
paying online while staff are taking payment at the counter.**
The counter strip is fixed text. Two people can be on "Pay" for the same job:
Maya pays on her phone while Jo has the job open in the till, or the job page
has been open in another window since before she paid. Nothing on the job page
or the till notices, so a second payment can go through.
*Why it matters:* a double charge costs the shop card fees and the customer's
trust, and staff cannot see it coming.
*Options:*
1. Counter side only. The strip updates by itself to "Paid online · just now"
   and the main button turns into Hand over; pressing Take payment on a job that
   has since been paid stops with a small pop-up "This was paid online at
   [time]", with "Back" on the left and "Hand over" on the right. No extra clicks
   on the normal path; leaves a small gap if Maya is mid-payment when Jo finishes.
2. Both sides. As option 1, and once a till sale for the job is started, the
   customer's Pay now shows "Being paid at the shop" in words until it is
   finished or cleared. Closes the gap; costs one more state on the summary and
   a rule for when a parked sale releases it.
Recommend 2, since it involves money.

**H4 — `cp-today-uncollected`: "Contact them" has no destination and the line
never clears.**
The button does not say what it does (show a phone number? open the customer?
send the reminder again?). The reminder has already been sent, so texting again
adds little. After it is pressed nothing says how the line goes away: if it
stays until the bike is collected, Needs attention becomes a list of old
problems rather than things to do. This is the same gap journey 10's audit
found on "Check".
The button is also squeezed: "Contact them" wraps to two lines and the heading
wraps to two, so the row is taller than the others on Today.
*Options:*
1. Show the customer's phone number on the line ([phone]) and replace the button
   with "Contacted". One click clears it, records who and when, and brings it back
   after [n] days if the bike is still there. Best for fewest clicks, and the
   number is readable at the desk.
2. "Contact them" opens a small pop-up with the number and the reminder text, and
   one "Noted as contacted" button on the right. One click more, for little to
   read.
3. Leave the button, draw only where it lands (the customer page). Cheapest to
   draw; the line still never clears.
Recommend 1. Either way the line leaves by itself when the bike is handed over,
and the button gets `white-space: nowrap` (or a shorter word) so it stays on one
line.

---

## Medium

**M1 — `cp-summary`, `cp-summary-inshop`: the customer reads advice that
contradicts the work, and a "Full service checklist" that hides two items.**
Under "What we did", the brake pads line carries the staff note "Rear pads worn
— replacing", in the present tense, next to a finished job. In the checklist,
"Brakes bled & adjusted" shows "The rear pads are worn. We recommend replacing
the pads and adjusting the brake." That is a quote-time recommendation, yet
both the pads and the brake fit are listed as done above it. Also, the list is
filtered to ticked items (`CHECKLIST_10.filter((c) => c.checked)`): "Cables &
housing" and "Bolts torqued" are silently left out, so a card called "Full
service checklist" lists 8 of 10 with no mention of the other two. Journey 12's
job page says "8 of 10 done", so the customer sees less than staff do.
*Why it matters:* a customer can think the pads were not replaced. A
half-shown checklist on a "full" service invites the question.
*Fix, for the notes:* label them as the mechanic's note, not as a finished
statement: a small "Mechanic's note" label above the brakes text, and on the
pads line show the same note as "Why: Rear pads worn" or hide it on this page
(the work line already says what was done).
*Fix, for the two missing items, options:*
1. A grey line under the list: "8 of 10 checks done." Honest and short; does not
   say which.
2. List the two with the words "Not checked this time". Clearest; shows the shop
   the moment a mechanic skips something.
3. Leave it (decision 21 only covers ticked items).
Recommend 1. Ask Jack before wording anything that admits a skipped check.

**M2 — `cp-till`: the job's agreed work can be edited like any basket.**
The three lines from the job (Standard service £65.00, Shimano brake pads
£28.00, Fit & adjust brakes £18.00) each have − / + steppers, and the Workshop
tab right beside shows "Replace gear cable £12.00", the line Maya declined, as
one tap to add. The job page says "Anything beyond these lines needs a new
approval." The basket already has a `fixed` setting that hides the steppers
(used for the deposit line), but `jobBasket()` does not use it.
*Why it matters:* the till total can quietly stop matching the £111.00 the
customer approved and saw online.
*Options:*
1. Lock the job lines (no − / +). Anything extra goes back through the job's
   approval. Strict and matches the job page; costs a detour for a small extra.
2. Lock the job lines, but let staff add more items in a group called "Added at
   the counter", recorded against the job with who added it. Matches the "trust
   over lock-down" stance and keeps the agreed work safe.
Recommend 2.

**M3 — `cp-ready-paid`, `cp-ready-unpaid`: the strips say little that helps, and
the footer button changes width.**
"Paid £111.00 · Payment already taken." does not say how or when, so when a
customer says "I paid online" the only check is to leave the page. The unpaid
strip's "Customer told the bike is ready." says nothing about payment, such as
whether the customer was sent a pay link, or whether online payments are on.
Separately, the main button is 909px wide on `cp-ready-unpaid` and 1007px on
`cp-ready-paid`, because the grey note beside it wraps differently; the primary
button moves between two boards of the same page.
*Fix:* paid strip: "Paid online · [date], [time]" or "Paid at the till ·
[date]", with the receipt as a link (44px). Unpaid strip: "Customer told the
bike is ready · [date]" and, when
the shop has online payments on, add "They can also pay online". Give the note
a fixed width (for example 240px) so both primary buttons end at the same place.

**M4 — `cp-ready-paid`, `cp-ready-unpaid`, `cp-till`: what happens after the one
button is not drawn, and Hand over has no way back.**
Take payment goes to the till (drawn) and paying records collection, but
nothing shows the result: what the till says when it finishes, or how the job
reads afterwards. Hand over is one tap with no confirmation (right for fewest
clicks), but there is no sign it worked and no way to undo a mis-tap, which
would record a bike as gone and could trigger messages.
*Fix:* draw the job page after Hand over: status "Collected", the strip reading
"Handed over · [date], [time] · Jo Taylor", the footer button gone, and a short
confirmation at the bottom of the screen with "Undo" for [n] minutes. Add a
line to the till's finished screen (journey 11's receipt): "Bike collected ·
WH-1042" in words.
*Options for the undo:*
1. "Undo" in the confirmation for [n] minutes. No extra click on the normal
   path; a mis-tap is fixed in one.
2. A confirm pop-up before recording. Safer against mis-taps; adds a click to
   every handover, against the fewest-clicks rule.
Recommend 1.

**M5 — `cp-setting`: the Hand-back reminders switch has no word for its state
and is under the touch target; the days boxes need two words each.**
Verified in `toggleSwitch()`: on desktop the switch is a `<span role="switch">`
with a 44 x 26px track. The label is attached by `<label for>`, which does not
work on a span, so the switch has no name for a screen reader and the label
itself is not clickable. The state is told by the thumb position and colour
only; the word "off" appears only in the fold's summary line. Jack's rule is
status in words and targets of 44px.
On the days boxes: "Show it on Today after [n] days" does not say after what.
Decision 4 says the flag comes after a longer wait than the reminder, but
nothing on the page says so or stops the flag being set earlier. The fold's
summary line ("Reminder after [n] days · hand-back reminders off") leaves out the
flag's days. And the two hand-back ticks, when on, are described in words but
not drawn: neither the job page nor the till after paying shows them.
*Fix:* keep the days boxes (labelled, 44px, good). Add hint text "Counted from
the day the bike was ready. Longer than the reminder." and a message if the flag
is set shorter. Summary line: "Remind after [n] days · Today after [n] days ·
hand-back reminders off".
*Options for the switch:*
1. Use the "On" / "Off" toggle pill that Messages and the till pill already use
   for this control. Word and 44px height built in; one control looks
   different from the other switches on the page.
2. Keep the switch, add the word "Off" / "On" beside it, make the whole row a
   44px button and fix the label. Keeps every Settings switch alike, and fixes
   them all because `toggleSwitch()` is shared (journey 12's Accessibility tab
   changes too, for the better).
Recommend 2.
*Also draw (one board):* the job page footer with the two reminders on, as two
ticks above "Hand over" (not a pop-up): the button stays grey until both are
ticked, costing two taps for the shops that choose it. The same two ticks
belong on the till's finished screen after paying.

**M6 — `cp-messages`: the new "Bike still waiting" row has no wording, and no
link to the days setting.**
Only "Bike ready" has an edit-wording pop-up (`set-msg-edit`). Decision 4 makes
"Bike still waiting" an editable message, but what it says is nowhere drawn,
including whether it carries the job link, which is the one click from text to
Pay now. The row reads "after [n] days" as plain text while the days live in
Settings › Workshop › Collection, so changing it means leaving the page and
finding the fold. Collection links to Messages, but Messages does not link back.
*Fix:* draw the edit pop-up as a starting draft for Jack to approve, using the
existing placeholders: "Hi [Customer's first name], your [Bike] is still ready
to collect from [Shop name]. [Amount to pay] to pay, online or on collection.
See what we did: [Link to the job]. Job [Job number]. We're open [Opening
hours]." Make "[n] days" in the row a link to the Collection fold (44px).

---

## Low

**L1 — `cp-summary`, `cp-paid`, `cp-pay`: structure a screen reader can use, and
a board that hides half the page.**
On `cp-summary` the three cards are plain `<div>`s, not sections named by their
heading (the same thing journey 10's audit fixed on Today). The pay card comes
last in the markup, after the whole checklist, so a screen reader reads
everything before the amount and button (on phone it is first). `cp-paid` has no
`<h1>` and its confirmation is not announced (no `role="status"`), so nothing
tells someone using a screen reader the payment worked. The render also cuts
the checklist off mid-row at the bottom and never shows "What you told us", the
card with Maya's booking note, on any board.
*Fix:* `<section aria-labelledby>` for each card; put the pay card first in the
markup and leave it on the right with the grid's order; give `cp-paid` an `<h1>`
"Paid — thank you, Maya" and mark it as a status message. Build the real page as
one normal scrolling page, not a box that scrolls inside the page (the drawn
inner scroll area has no keyboard focus); show one taller board or tighten the
summary so every card is visible once.

**L2 — `cp-summary-inshop`, `cp-paid`, `cp-today-uncollected`: small gaps.**
- The shop version says "Pay at the counter by card or cash." but not what to
  say when they arrive; `cp-paid` says "just give your name". Use the same
  line on both, with the job number WH-1042 to quote.
- `cp-paid` drops the address and phone that `cp-summary` shows under the shop
  name; repeat "[Shop address] · [shop phone]" so a customer who has just paid
  can find the shop.
- On `cp-today-uncollected`, the same customer and bike appear twice on one
  page: WH-1050 Aisha Khan, Cannondale Quick, Safety check (ready since Mon 14
  Sep) in Needs attention, and WH-1047 Aisha Khan, Cannondale Quick, Safety
  check (Drop-off) under "Still to arrive". WH-1050 comes from decision 4 and
  WH-1047 from the approved Today, so neither is changed; it is a pass-on to
  settle with Jack, the same kind of item as Maya's email.
- Colour alone is not carrying anything here, but the Needs attention line says
  only "ready since Mon 14 Sep". Adding "3 days waiting" is optional, from the
  two dates on the board.

---

## Answers to the specific questions

- **Status by words, not only colour:** yes on every board (To pay, Paid, Ready
  for collection, All working well, Needs attention · 1, "Not done — you said not
  now"). Gaps: the Hand-back reminders switch (M5), and `cp-paid`'s confirmation
  is not announced (L1).
- **44px targets:** all buttons, links, pills and the days boxes pass. Not
  passing: the Hand-back reminders switch at 26px tall (M5).
- **Contrast:** everything drawn passes 4.5:1 (about 4.9 to 7.7:1).
- **Fewest clicks:** one main button at the counter is right. Where clicks can be
  cut further: "Contacted" clears Today's line in one click (H4), undo instead of
  a confirm on Hand over (M4), and the hand-back ticks inline rather than in a
  pop-up (M5). Pay now is two steps for the customer (the button, then the card
  form); that depends on the payment provider, which is not chosen yet, so it is
  not a finding.

---

## Summary of what to decide

1. How long the customer's link lives after the job is finished: [n] days, or
   dies when paid (H1, option 1 or 2).
2. Double payment: guard the counter only, or both sides (H3, option 1 or 2).
3. Today's "Contact them": show the number and "Contacted", a pop-up, or only
   draw where it goes (H4, options 1-3).
4. What the customer sees of the checklist's two unticked items: a count, the
   two named, or nothing (M1, options 1-3), and whether the mechanic's note
   gets a label.
5. Job lines in the till: locked, or locked with "Added at the counter" (M2).
6. Hand over: undo for [n] minutes, or a confirm first (M4).
7. The Hand-back reminders switch: On/Off pill, or keep the switch with the word
   (M5).

Nothing here changes a decision. The deposit states (H2), the link states
(H1), the wording for "Bike still waiting" (M6) and the small fixes need only a
yes from Jack. No file other than this one was edited.

---

## Verification and outcome (30 Sep 2026)

Checked against the source before going to Jack: the till's job lines had
steppers while `fixed` lines already existed (M2); the Hand-back switch's
label pointed at a `<span>` (M5); Today's "Contact them" had no destination
(H4). Jack took every recommendation (decision 5 in the collect-and-pay
review). Knock-on: journey 12's "Ready for collection" board (strip wording,
button width) and journey 11's three job boards on the till (lines locked)
were rebuilt, compared and republished; the till balance board no longer
clips. The customer summaries scroll by design; the job-page clip reports
match the approved boards they reuse.
