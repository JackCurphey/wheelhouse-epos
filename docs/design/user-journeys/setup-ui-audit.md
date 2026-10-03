# Journey 8 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 34 desktop renders
(1280 × 800), against `docs/decisions/2026-09-30-owner-setup-review.md`
(decisions 1–16), `generator/setup.mjs`, `generator/settings-frame.mjs`, and
the rules for every journey in `HANDOVER-next-journey.md`. Tablet and phone
are not drawn yet, so nothing here covers them.

**Not raised, on purpose.** Browser-blue links and the serif fallback for the
number font in the renders. Journey 12's Diary blocks and Storage slots
content on `set-workshop-diary`. The [bracketed] placeholders. The three
original layout options `so-onepage`, `so-hub` and `so-hub-area` (decision 3
chose `so-list`). None of Jack's 16 decisions is reopened.

**Verdict.** The look is right: Soft sand throughout, no thick coloured left
edges, amber only in the sidebar's "you are here" marker, outlined
destructive buttons on the Tills board, pop-ups in the middle with the safe
choice on the left, buttons at least 44 px tall, and On/Off states that carry
a tick and a word, not just a colour. The problems are mostly in what is
missing. The boards show a shop that is already full of data, but the first
thing a new owner sees is empty lists, and the Getting started checklist
points at screens that aren't drawn. Findings are ranked; where a fix is a
real choice, the options are numbered.

Checked against the source, not just the pictures: the body text and grey
summary text on the sand colours pass 4.5:1 (about 5.5:1 on white, about 4.9:1
on the page background). The exception is the thin borders, see M6.

---

## High

**H1 — `set-till-tills`: actions only an owner may do are drawn live for a
manager, and "Remove" a till has no "are you sure" pop-up.**
The board is drawn for Jack Lewis (Manager). The note under the buttons says
"Only the owner can add a till", yet "Make this computer a till" and "Remove"
are both drawn as ordinary working buttons. Staff and roles handles the same
rule by not drawing an Add button at all. Removing a till is also a much
bigger step than removing a quick button, which is why "Clear a forgotten
PIN" gets a confirming pop-up and removing a till does not.
*Why it matters:* a manager taps Remove, then gets "not allowed" (or worse,
it works). One board says one thing and the next says another, and the builder
has to guess.
*Fix:* for anyone who isn't the owner, hide the two buttons and keep the note.
For the owner, "Remove" opens a middle pop-up: "Remove Till B1?" with "Keep
the till" on the left and an outlined red "Remove the till" on the right. Draw
the owner's version of this board once, because the first-run step 2 depends on
it.

**H2 — `fr-today`, `fr-step`: the checklist can't be built from what is drawn.**
Three gaps.
1. Nothing says what makes each step tick itself. "Add your staff" ticks when
   one other person exists? "Quick buttons for the till" when one button
   exists? "Float and closing up" when both the float and the time are set?
   "Check the messages customers get" has nothing to fill in, so what ticks
   it, opening the page?
2. Step 4, "Add your staff", opens Staff and roles, but the only Staff and
   roles boards are drawn as a manager, and none of them has an "Add a person"
   button (adding is owner-only, decision 10). The step points at a control
   that doesn't exist on any board. What happens after adding (an invitation
   sent, waiting to accept) isn't drawn either.
3. Only step 3 has a drawn destination (`fr-step`). Steps 1, 2 and 5–8 land in
   Settings boards drawn for a manager, with data already in them.
*Why it matters:* "ticks itself when done" is the core of decision 16, so this
is the part a builder needs most.
*Fix:* add a short "A step ticks when…" line per step to the spec (list it in
the decision file or on the board), draw the owner's People list with "Add a
person" and a waiting-to-join state, and draw at least one more step landing
(suggest step 6, Quick buttons, since it is the emptiest).

**H3 — every `set-*` board: no empty states, and a new shop starts empty.**
Every list is drawn full. A brand-new shop, which is exactly who the checklist
is for, will see: no quick-button groups and no buttons (`set-till-quick`), no
reasons in any of the four lists (`set-till-reasons`, decision 5 chose no
starting set), no services (`set-workshop-services`), no other ways to pay, no
tills before step 2 (`set-till-tills`), one person only, no settings changes
yet (`set-data-history`), and a "Tills" fold summary reading "Till B1" when
there is no till. Fold summaries such as "Discount, void, refund, paid-out"
would claim four kinds of reason exist while every list is empty.
Two more dead ends:
- `set-till-quick-add`: the pop-up shows one search result. There is no "nothing
  found" state, and a new shop with no stock has nothing to find, so step 6
  leads nowhere until stock exists (see M12 on the import link).
- Adding a reason or a way to pay that already exists, or a quick button for
  a product that is already there, has no drawn response.
*Fix:* one empty-state pattern used everywhere: a short plain sentence and
the same outlined Add button, e.g. "No discount reasons yet. Staff can still
type their own with Other…" plus "Add a reason". Draw it once for quick
buttons and once for reasons, and list the rest in the build notes. Change
summaries so they describe what is set up ("No reasons yet", "3 reasons").

**H4 — saving: "Saved · Undo" appears on one board only, and nothing says what
happens when saving fails.**
Decision 4 says every change saves with a short "Saved" note and an Undo, but
the note is drawn only on `set-till-quick-saved`. Nothing else shows it: not
the On/Off pills (Ways to pay, Messages, hours), not typed fields (shop name,
float, credit limit, closing time), not anything inside a pop-up. The
toast also can't appear over a pop-up (the person and message pop-ups have
none), so switching someone's permissions is silent. Not drawn at all: a save
that fails or a shop working offline, a value that is wrong (a float below zero,
a time that isn't a time, an email with no @).
*Why it matters:* money and access changes (float, credit limit, "Give
everything a Manager can do", blind counting) are the ones where an owner most
wants proof it took, and Undo is the only safety net since there is no Save
button.
*Fix, three parts:*
1. On/Off and pill choices: the same bottom note with Undo, one note at a time.
2. Typed fields: save when you leave the box, with a small "Saved" tick beside
   that field, no Undo needed.
3. Inside pop-ups: the note appears at the pop-up's bottom edge, and "Done"
   closes it.
Draw one failed-save state (the field keeps what you typed, with a red
outlined message "Couldn't save — try again") and one invalid-value state.
Keep the toast on screen long enough to read and reach (10 seconds, pausing
while the mouse is on it) and give it to screen readers, which the drawn
`role="status"` already does. Undo on "Clear a forgotten PIN" should not bring
the old PIN back, so say that in the build notes.

---

## Medium

**M1 — the eight areas don't share one fold rule.**
`set-eod` opens all three sections at once (each holds a single line, so the
folds do nothing there). Every other area shows exactly one open. The Workshop
board `set-workshop-diary` shows two open. Nothing says which section is open
when you arrive from the left list, so as drawn every visit starts with a click
to open something.
*Fix:* pick one rule and write it down. Suggested: one open at a time in
every area, and the first section is open on arrival (or the one you had open
last time). For End of day, either leave all three open because each is one
line (say so as the exception), or give it three plain rows with no folds.

**M2 — fold summaries that don't match the open content.**
- `set-eod`: "Counting the cash" says "Blind". That is insider language
  (Jack's rule: plain-English labels), and it doesn't match the pill inside,
  which says "Count first, then see the difference". Use "Count first".
- `set-pay-ways`: "Cash, card and 4 more" is six ways switched on, but the
  reader can't tell that Loyalty points is off. Better: "6 on · 1 off".
- `set-till-reasons`: covered in H3 (lists the four kinds, not what is set up).
- `set-shop-details`: the summary is the shop name only. Suggest "North Street
  Cycles · [phone]" so the summary shows whether the rest is filled in.
- `set-msg-list`: "4 on" is right, but the closed "How messages are sent" summary
  ("Texts from [sender name] · emails from [email address]") is the longest on
  any board and will wrap or collide on tablet.
*Why it matters:* the summary is what stops you having to open every section
to check.

**M3 — the boards disagree about Jo Taylor and the workshop.**
`set-workshop-mechanics` lists Jo (Staff) as a mechanic, "Booked in by staff
only". `set-staff-person` shows Jo with "Works in the workshop" off, and
`set-staff-person-workshop` shows it on. `set-staff` (the list) shows Jo as
just "Staff", while Alex reads "Mechanic · can use the till" in lower case with
no mention of the workshop.
*Fix:* settle on the on version. Staff list rows read "Staff · works in the
workshop", "Mechanic · can use the till" is written the same way as that, and
the base person pop-up starts from the same state as the Mechanics list. Also
show each mechanic's working days on the Mechanics list (decision 13, e.g.
"Tue, Wed, Sat"), which is missing there.

**M4 — closing time lives in two places with wording that disagrees.**
`set-shop-hours` says "Close the day starts from the closing time" (implying it
follows the hours). `set-eod` has its own "[time]" box (the drawn assumption in
decision 13). Neither board says the second is filled in from the first, or
what happens if one changes. Also, opening hours are different for each day
but End of day has one single time.
*Options:*
1. Keep the one time in End of day; say so: "Starts as the closing time in
   Shop and sites (Bolton, weekdays). Change it here."
2. Drop the End of day box and use each day's closing time, with a small "Close
   the day appears at closing time" line. Fewer settings, but no way to close
   the day later than the shop shuts.
Best for the shop that closes at 5:30 and cashes up at 6: option 1.

**M5 — `set-shop-details`: no address.**
The receipts board says "The shop's name and address come from Shop and
sites", but the only fields are name, phone, email and VAT number. The Sites
fold, where the address may live, is never drawn open.
*Fix:* draw Sites open (with an address per site and how a second site is
added, plus how the opening-hours fold picks a site: pills at the top of the
fold are simplest), or add an address line to Shop details. Otherwise the
receipt board points at nothing.

**M6 — `set-till-quick`, `set-staff-person`, `set-msg-list` and others: the
outline of an "off" or unselected pill is almost invisible.**
Unselected pills (Parts, Accessories, Void, Off, the un-ticked Text or Email
chips, Mon–Sun) use the same pale border as cards, about 1.3:1 against the
panel. The 3:1 needed for the edge of a control isn't met. It reads on a good
screen; in a bright workshop or for low vision it doesn't. The words and the
tick carry the meaning, but the shape of a button has to be findable.
*Fix:* use the darker outline already used on text boxes for every unselected
pill and chip, and keep the pale border for cards and dividers only.

**M7 — information set in 12–13 px text.**
Rule: 14 px for body, 12 px only for labels. Under that rule these are too
small because they explain something: the second line on quick-button rows
("Labour · 60 min", 12 px), on services ("60 min in the diary", 12 px), on
"Other ways to pay" (the finance and Cycle to Work explanations, 12 px), the
grey text under names on every list (13 px), and the fold summaries (13 px).
*Fix:* 14 px for anything that explains or that a person needs to read to
decide; keep 12–13 px for tags like "Part" or "Labour" only.

**M8 — drag handles are 28 px wide and the only way to reorder is dragging.**
`set-till-quick`, `set-till-reasons`, `set-workshop-services`: the ⋮⋮ button is
44 tall but 28 wide, under the 44 px rule, and no keyboard or touch way to
move things is drawn (the buttons are named "Move …" but nothing shows what
happens).
*Fix:* widen the handle to 44, and say that focusing it lets the arrow keys
move the row, with a "Moved to position 2" note for screen readers.

**M9 — the same kind of row is edited three different ways.**
- Quick buttons and services: Edit and Remove appear on hover (Remove in red
  text, not outlined).
- Reasons and Other ways to pay: a permanent ✕ next to the drag handle, and
  no way to change the wording of a reason at all (delete and re-type).
- People: "Open" on hover, a chevron otherwise. Messages: "Edit wording" on
  hover only.
Red text "Remove" also conflicts with "destructive buttons outlined" (the
Tills board gets this right).
Groups (quick-button pills, service pills) have no way to rename, reorder or
delete a group at all: "+ Add a group" is the only control.
*Fix:* one pattern. Suggested: hover shows "Edit" only, and Remove lives
inside the Edit pop-up as an outlined red button (also covers touch and
long-press, and puts destructive actions one step away from a stray tap). Give
reasons the same Edit. For groups: a small "Edit group" action on the selected
pill that opens rename and delete.

**M10 — pop-up buttons that don't follow the destructive rule.**
- `set-staff-clear-pin`: "Clear the PIN" is a solid dark button. The Void sale
  pop-up on `till.mjs` draws its confirming destructive action as an outlined
  red button. Use the same.
- `set-msg-edit`: "Go back to Wheelhouse's wording" sits in the safe slot on the
  left as quiet text, so it reads like Cancel. It throws away the shop's own
  wording. Make it an outlined button, worded "Use Wheelhouse's wording", and
  put "Done" alone on the right; the Undo note (H4) covers a mistake.
- `set-staff-person` and its variants: the left of the footer is empty and
  "Done" is the only button. That is fine for a pop-up that saves as you go,
  but the corner has no "Cancel"/safe choice, so say in the notes that closing
  with the ✕ or Done are the same thing.

**M11 — `fr-step`: the strip that says where you are in Getting started.**
- It says "step 3 of 8", but the checklist says "do these in any order". A
  number implies a sequence. Say "Getting started · Connect the card machine".
- It sits inside the scrolling page, so it scrolls away on any long section.
  Pin it above the scroll area.
- When the step ticks itself, nothing on this page changes. The owner then has
  to press "Back to the checklist" and then "Start" on the next one, two clicks
  a step. Fix: when the step is done, the strip turns into "Card machine
  connected — Next: Add your staff" with one "Next step" button and a smaller
  "Back to the checklist". That is one click a step.
- If the owner clicks another area in the left list, does the strip stay? Say
  it stays only on the step's own area.

**M12 — `fr-today`: the card is very tall and buries the rest of Today.**
It is about 650 px high, so on a 800 px screen "The rest of Today" starts at
the very bottom edge. Nothing folds. Finished steps keep a full row each
(56 px) and can't be reopened to check or change.
The "Moving from another system? …" link is at the very bottom, but for a
Citrus Lime shop (Jack's own) importing customers and stock is the first job,
and step 6 (quick buttons) needs stock to pick from. The link also vanishes
with the checklist, so after that there is no route to the import.
*Fix:* (1) finished steps fold into one line ("2 steps done"); a "Hide"
chevron collapses the whole card to one row with the count; (2) move the
import link to under the intro sentence at the top; (3) after the checklist
goes, keep the import link in Your data, and show it on `fr-done`.

**M13 — checklist wording that isn't quite true or consistent.**
- "You can sell straight away" isn't true for a brand-new shop if a computer has
  to be made a till first (step 2). Suggest: "Once a till is set up you can sell;
  do the rest in any order."
- Step 2, "Make this computer a till", only works on the computer that will
  be the till (`set-till-tills` says so). The owner is probably looking at
  the checklist on a different computer. Add "Do this on the till's computer" to
  the step's line.
- The lines under steps are inconsistent: "In Settings › Payments", but step 2
  says "Till › Tills", and steps 5–7 name only the area even though they land on
  a section. Name the section on all of them ("Settings › Payments › Card
  machine").
- "Start" on the next step and "Set up" on the others mean the same thing.
  Use "Set up" on all, filled dark on the next one only.
- The list has no receipt printer step, yet the Paid pop-up offers "Print" by
  default (`set-till-receipts`). A shop with no printer connected offers a
  button that can't work. Add "Connect the receipt printer" to step 2, or as its
  own step.

**M14 — roles and switches: what they add up to isn't visible where you choose.**
`set-staff-roles` describes the four roles in words ("The till, customers,
messages, stock and the workshop diary") but never says which of the five
switches each role already has, so an owner can't tell what turning "Can see
reports" on for Jo really adds. In the person pop-up the role pills
(Manager, Staff, Mechanic) have no description at all, so learning what a role
means costs a trip out to another fold.
*Fix:* one grey line under the role pills that changes with the choice ("Staff:
the till, customers, messages, stock and the workshop diary. Can't see
reports."), and list the switches that each role includes in the roles fold.

**M15 — `set-shop-hours`: 12 typed times for a normal week.**
Six open days need twelve boxes filled in by hand, and the times are plain
text boxes with no format hint.
*Fix:* a "Same as Monday" pill on each later row (or "Copy to all open days"
under the last row), and times as a picker or a typed box that shows "09:00"
style. Also worth a question for the build: one-off closures (bank holidays)
have no place in the board, but online booking needs them.

**M16 — `set-workshop-mechanics`: the way to change anything is a detour.**
The only control is "Change in Staff and roles", which lands on the whole
people list; then open a person; then find the switch. Three clicks and a
lost place.
*Fix:* each name opens that person's pop-up straight away (one click), or put
the online-booking On/Off pill on each mechanic's row. "Customers can book
online" is drawn as plain text here but is an On/Off pill on the person
pop-up. Draw it as the same pill.

**M17 — Messages: missing states and a busy row.**
- `set-msg-list`: no drawn row for a message that is off (does it grey out?).
  No rule for a message left on with neither Text nor Email chosen.
- The row carries three different-looking controls: two light chips (the
  choice that matters most) and a dark "On" pill (the least interesting).
  The dark pill draws the eye first.
- The chips change width when ticked (the tick adds space), so the controls
  don't line up in columns from row to row. Fix the chip widths.
- `set-msg-edit`: the preview is text only. Email needs a subject line and a
  separate preview. Texts are normally charged in blocks of about 160
  characters, so a length counter belongs under the box (check the sending
  provider's real rule before wording it).
- `set-msg-new`: "How long after" reads wrong when "Before a booked job" is
  chosen ("How long before"). Nothing shows that "Add the message" needs a
  name and wording first (disabled until both are filled).

**M18 — Your data: what "Download everything" does isn't clear or complete.**
- The four ticked rows (`set-data-export`) look like tick boxes you can clear,
  but are drawn as plain rows. If they're choices, draw them as toggle
  pills so a shop can download just customers; if not, remove the ticks and say
  "Included".
- No states for a big export: preparing, ready to download, failed, and how it
  is delivered if it takes minutes.
- The fold and its button are both named "Download everything". Name the fold
  "Your files".
- `set-data-history`: a busy shop will have hundreds of changes; nothing is
  drawn for a long list (newest 20 with "Show more", a filter by area) or for
  an empty one. There is also no way to undo an old change from here; if that
  is intended, the intro line should say the list is for looking only.

**M19 — printer and card machine: only the happy path is drawn.**
`set-till-printer`: shows "Connected" and no way to choose or change the
printer, no "not connected" state, and no failure after "Print a test receipt".
`set-pay-card` and `fr-step`: "Connect a card machine" has no destination (the
provider is undecided, so a placeholder pop-up is fine), no "trying to connect"
or failed state, and it keeps the same label after connecting (make it "Use a
different card machine"). `set-pay-ways`: "Card" is On while `fr-step` says no
machine is connected; say what the till shows for card in that case.
*Fix:* one small status row pattern (Connected / Not connected / Couldn't
connect, each with the words and a tick or an alert icon as well as the
colour) and one placeholder connect pop-up.

**M20 — person pop-up: states the decisions require aren't drawn.**
- Decision 10: nobody can switch off their own "Can change settings". Draw
  Jack's own pop-up, with that switch locked and a line saying why.
- The Owner's row (can a manager open it? presumably read only).
- Role set to Manager (every switch shows Included) and to Mechanic ("Can use
  the till" becomes a real switch, as decision 9 says).
- After "Clear a forgotten PIN": the line should read "Not set — Jo sets a new
  one at next sign-in" and the button greys out.
*Fix:* draw the four states above (own pop-up, Manager, Mechanic, PIN cleared);
one board each is enough, or a single board with notes.

---

## Low

**L1 — the same sentence on every area.** "Changes save as you make them."
appears under seven of the eight area titles. It is noise after the first time,
and it is the only "saved" feedback for typed fields. Suggest one small
"Saved automatically" in the page header, and use the intro line for what the
area is for.

**L2 — `set-pay-ways`: the ways-to-pay tiles are ragged.** The tiles in the same
row have different heights (Cash is shorter than Card, so their bottom edges
don't line up) and there is a large empty gap under Loyalty points. Make tiles in
a row equal height.

**L3 — `set-staff-person-workshop`: the working-day pills (Mon–Sun) are toggles
but drawn differently from every other toggle** (no tick, narrower). Use the
same "Open" style pill as `set-shop-hours`.

**L4 — pop-up height jumps.** In `set-staff-person-all` the pop-up grows two
lines when the confirmation note appears, so the whole pop-up shifts up about
11 px. Reserve the space for the note. The pop-up is also nearly the full
height of an 800 px screen; on a shorter laptop it needs its own scrolling
inside, with the header and Done staying in place.

**L5 — `set-till-quick-add`: the subtitle "To the Workshop group" goes stale when
the Group pill below is changed, and the Group row is a step most people won't
need** (the active group is already chosen). Drop the row and show "Adding to
Workshop · Change". One less thing to read.

**L6 — `fr-step`: the strip is nearly the same colour as the page** (warm grey on
warm grey), so it reads as part of the background. Fine for a routine notice,
but give it the same thin border as the cards.

**L7 — the user block in the sidebar wraps** on these boards ("Shop / owner",
"Jack / Lewis", "Sign / out"). It belongs to journey A's frame rather than this
journey, but the longer owner label makes it worst on the three Getting started
boards. Worth passing on.

**L8 — `set-till-quick-saved`: the Saved note sits over the last section's
summary** ("[Receipt printer]") and hides it. Put it at the bottom of the page
frame, not over the content, or let the page scroll past it.

**L9 — `fr-done`: "You're all set up" has a close button but no stated rule for
when it goes** (on its own after a day? only when closed?). Decision 16 says
the checklist goes when every step is ticked, so say the note goes when closed
and doesn't come back.

**L10 — `set-till-tills`: "Make this computer a till" shows even on a computer
that already is a till.** Show which computer you are on ("This computer is
Till B1") and hide the button when it applies.

---

## Summary of what to decide

1. Whether an owner-only action is hidden or greyed out for managers (H1).
2. The one fold rule for all eight areas (M1).
3. How the checklist steps tick, and one drawn owner landing for step 4 (H2).
4. Where closing time lives (M4, options 1 or 2).
5. Whether reasons and lists get Edit like quick buttons do (M9).

Nothing here changes a decision. No file other than this one was edited.

## Checked in the main session (30 Sep) and Jack's choice

Claims checked against the source: H1 (owner-only actions drawn live for a
Manager), M5 (no address on Shop details), M6 (unselected border `#E6DFCB`
on panel `#FFFDF7` = 1.31:1), M10 (Clear the PIN solid; Void outlined red)
— all true. Jack adopted every recommendation (decision 17): H1–H4 kept;
M1–M5, M8–M13 kept; M4 settled as "Close the day follows closing time";
M7 dismissed (12–13px only on labels, which the rules allow); M6 parked as
a design-wide token fix; M14–M20 kept as written rules, not drawings;
L1 (repeated intro line) kept, other lows left.
