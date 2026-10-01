# Journey 4 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 15 desktop renders of the
Drop off and approve the quote boards (1280 x 800: `dq-in-shop`, `dq-quote`,
`dq-quote-photo`, `dq-quote-untick`, `dq-quote-confirm`, `dq-answered`,
`dq-answered-phone`, `dq-quote-newer`, `dq-waiting-part`, `dq-ready`,
`dq-job-quote`, `dq-job-sent`, `dq-today-no-answer`, `dq-record-answer`,
`dq-messages`), against `docs/decisions/2026-10-01-drop-off-and-quote-review.md`
(decisions 1-6), `generator/quote.mjs` (`page`, `tracker`, `agreed`,
`quoteLine`, `quoteCard`, `quotePage`, `confirmDialog`, `photoDialog`,
`answered`, `withToast`, `recordDialog`), the staff pieces it borrows
(`job-page.mjs`: `needToggle`, `photoBtn`, `finalWorkAndPartsBody`,
`jobPhoneSections`; `diary.mjs`: `quoteJobBoards`, `LINES_QUOTE_BUILD`;
`opening.mjs`: `today({ noAnswer })`; `setup.mjs`: `msgListOpen`), the ready
page it hands over to (`collect.mjs`, journey 5, approved: only the hand-off is
checked), the related decisions (Quote line decisions are final; Workshop day
20, 41-43, 58 and 68; Book a repair 10 and 12; Collect and pay) and the rules
for every journey in `HANDOVER-next-journey.md`. Tablet and phone are not drawn
yet, so nothing here covers them.

**Scope.** `dq-job-quote`, `dq-job-sent` and `dq-record-answer` use the approved
staff job page: only the quote parts (Needed / Optional, Add photo, the Send
quote bar, Record their answer) are audited. `dq-today-no-answer` uses the
approved Today page: only the new line, and whether the rest of the board agrees
with it. `dq-messages` uses the approved Settings frame: only the "Quote to
approve" row. `dq-ready` is journey 5's page: only whether it reads as the same
page the customer was already on (H4).

**Not raised, on purpose.** The [bracketed] placeholders (`[time]`, `£[price]`,
`£[total]`, `[shop phone]`, `[n]`). That this example has no spending limit
(stated in the header of `quote.mjs`; under a limit no quote would be sent,
Workshop day 43). The scroll areas the renderer clips (the foot of the quote
card, the "Work agreed" card). The shop logo slot. The unselected-pill border
contrast (parked as a design-wide fix). Tablet and phone. 12-13px text that is
only a label. Real example data: Maya Patel, WH-1042, Trek Domane AL 3, the
lines and prices, Alex Morgan, Jo Taylor and North Street Cycles are as the
header of `quote.mjs` lists them. None of Jack's six decisions is reopened: one
page per job, ticks set the way the mechanic recommends with one button, photos
on each line, a reminder then a flag for staff and a recorded phone answer,
sending in one click with Undo, and a four-step tracker with the expected ready
time.

**Verdict.** The decisions are carried out and the look is right: Soft sand,
one dark button per board, the quote card picked out by its 2px border, the
tracker in four plain words, every status in words as well as colour (Needed /
Optional, Awaiting approval, "not now" beside a struck-through price), safe
choice on the left and confirming action on the right in both pop-ups, every
customer-side button and tick row at least 44px, and the quote and its total on
screen together at 1280 x 800 with no scrolling. Contrast follows the shared
tokens (grey text about 5.5:1 on cards). The problems are at the edges of the
quote, not in it. The one thing the quote asks for is a final answer, yet the
page it sits on gives no number to ring and no note button, and the warning that
the answer is final sits behind the first click. Declining everything, which the
tick design makes possible, is not drawn and the button and the pop-up cannot
describe it. A deposit paid at booking disappears from the page. The journey 5
page the customer lands on at the end looks like a different site section. The
staff controls that build the quote are 26px high. Findings are ranked; where a
fix is a real choice the options are numbered.

Checked against the source, not just the pictures: `quotePage()` is
`quoteCard()` plus `tracker()` and nothing else (no `shopLines`, no "Add a note
for the shop" button; both live only in `agreed()`); `quoteCard()` always
labels the button `Approve ${money(total)}`; `confirmDialog()` is fixed text
("Yes: Shimano brake pads, Fit & adjust brakes / Not now: Replace gear cable"),
not worked out from the ticks; the checkbox `<label>` wraps the line name, badge
and reason but not the price (the price is a sibling of the label); there is no
`aria-live` anywhere in `quote.mjs`; `needToggle()` and `photoBtn()` default to
`min-height: 26px` and `font-size: 12px` (the phone and tablet calls pass 44);
the Done box in `finalWorkAndPartsBody()` is 34px high (`doneH = 34`, decision 58
S2); `today({ noAnswer: true })` leaves WH-1042 in "Still to arrive" with a
"Book in" button; `collect.mjs` `pay('deposit')` subtracts a deposit
(`WORK_TOTAL_APPROVED * 0.25`, so £27.75 off £111.00, £83.25 to pay) but
`quote.mjs` has no deposit row on any board; `collect.mjs` has no photo and no
tracker; `siteDesktop('sand', '', body)` gives the ready page no highlighted
header link, where `quote.mjs` passes "Book a repair"; no board or source line
draws a "Withdraw quote" control (decision 4) or a reminder, withdrawn or
no-answer state on the customer's page.

---

## High

**H1 — `dq-quote`, `dq-quote-untick`, `dq-quote-confirm`, `dq-answered`:
declining everything, or declining a "Needed" line, is allowed by the design but
never drawn, and the button and the pop-up cannot say it.**
Every line has a tick box, "Needed" lines included. Decision 2 only sets the
starting ticks. If Maya unticks all three, `quoteCard()` still prints "Approve
£65.00" (65 is the booked service, already agreed), which tells her she is
approving something. The confirm pop-up is fixed text, so it would still say
"Yes: Shimano brake pads, Fit & adjust brakes". The page that follows
(`dq-answered`) reads "Thanks, Maya — Alex is carrying on / We've saved your
answers. The work you agreed is going ahead." and shows the pads and fitting as
struck out. None of that is drawn. The pair is also not drawn: `dq-quote-untick`
only ticks the optional cable, so unticking the pads (and the fitting going with
it) is never shown. Nothing says what unticking a "Needed" line means: the
mechanic has told her the rear brake needs it.
*Why it matters:* "what the customer sees after declining everything" is the
most likely place for a wrong answer to be sent (a button that says Approve when
nothing is approved), and the answer is final (decision 2, and Quote line
decisions are final). A customer who declines a brake repair should be told once,
in plain words, what that means. The mechanic needs to be told too.
*Fix:* make the button, the pop-up and the answered page follow the ticks.
Button: "Approve £111.00" when anything new is ticked; "Decline the extra work"
(still the dark button) when nothing new is ticked, with "New total" left at
£65.00. Pop-up lists only what applies ("Yes" row hidden when empty, "Not now"
row hidden when empty). Under a ticked-off "Needed" line show, in the warning
colour: "Alex recommends this. [What happens without it, in the mechanic's own
words, e.g. 'The rear brake stays worn.']" Answered page for all declined:
"Thanks, Maya — Alex will carry on with the service. You didn't add any extra
work." Draw three boards: the pair unticked (pads and fitting together, total
£65.00, button "Decline the extra work"), the pop-up for it, and the answered
page for it. The staff reason text for each "Needed" line is a new field on the
job page (see M2).

**H2 — `dq-quote`, `dq-quote-confirm`: the page asks for a final answer, but the
final-answer warning is behind the first click, and the customer has no phone
number or note button on the page to ask a question first.**
In `dq-quote` the only thing about finality is nothing: the footnote reads
"Untick anything you don't want. Prices include VAT; nothing is paid now." (13px,
grey). "You can't change these answers afterwards — call us on [shop phone] if you
change your mind." appears only in `dq-quote-confirm`, after pressing "Approve
£111.00". Before that, a customer who is unsure why the pads are needed has
nowhere to go: `quotePage()` has no shop phone and no "Add a note for the shop"
(`agreed()` has both, so every other board of the page has them, which makes the
quote the one board without). The decision text (2) says the warning comes
"before sending". It does not require a pop-up.
Clicks: tick, then Approve, then "Send my answers" is one more click than the
customer needs if the pop-up only repeats the ticks.
*Why it matters:* it is the one place on the page where a wrong tap costs money
and cannot be undone, and the one place with no way to ask. Fewest clicks is
Jack's rule; but this is also where one confirmation click is most defensible.
*Fix (either option):* put the contact line inside the quote card, directly
under the button: "Not sure? Call [shop phone], or add a note for the shop."
(the same button as on `agreed()`, "Add a note for the shop"). Make the first
line the customer meets say that the answer is final: "Your answers are final
once sent." (14px, ink colour, not the grey footnote), above the button.
*Decision for Jack:* whether the pop-up stays.
1. Keep "Send your answers?" as the second step. A mis-tap cannot be undone, so
   the extra click is a safety. Costs one click on every quote; most useful on a
   phone, where a thumb can hit the button by accident.
2. Remove the pop-up. The final-answer line and the button that spells out the
   total ("Approve £111.00") sit together; one click sends. Saves a click on
   every quote and matches decision 2's "one button"; costs the safety net, and
   the "Yes / Not now" read-back disappears (the ticks above the button are the
   read-back). Tablet and phone have not been drawn: if this is chosen, decide
   again whether the phone keeps the pop-up.
Recommend 2 on desktop with the contact line added, and a re-check when the
phone is drawn.

**H3 — `dq-in-shop`, `dq-quote`, `dq-answered`, `dq-waiting-part`, `dq-ready`: a
deposit paid at booking disappears from the page after drop-off, then comes back
as a smaller "To pay" on the ready page.**
Book a repair carried "Deposit paid £[deposit]" and "Taken off your bill when you
collect" through the booking page (H1 of that audit). On this page the "Work
agreed" card shows the lines and a total (`£65.00`, then `£111.00`) and nothing
about a deposit; the quote card says "nothing is paid now" and "New total
£111.00" and nothing about money already paid. Journey 5 does handle it
(`cp-summary-deposit`: "To pay £83.25 · Deposit paid £27.75 · [date]"), so a
customer with a deposit sees "Total £111.00" for days and then £83.25 on the
last page, with no explanation in between. No deposit version of any board here
is drawn (the example is the no-deposit shop, as in journey 3's boards before
its audit). The cancel rule has the same gap: "Free to cancel until" and the
cancel and change buttons were on the booking page; once the bike is in, none
of them is shown and nothing says the deposit now counts toward the work.
*Why it matters:* a customer who paid £27.75 and is shown "Approve £111.00"
will ask whether they are about to pay £111.00 on top. That is a call to the
shop, or a decline of the extra work, on a screen whose job is to make the answer
easy.
*Fix:* in the "Work agreed" table (and the quote card's total area) add two
rows below the total when a deposit was paid: "Deposit paid £[deposit] — taken
off when you collect" and "Still to pay £[balance]". In the quote card the total
row reads "New total £111.00" with the same two rows beneath, so the customer
can see £111.00 less the deposit before answering. Change "nothing is paid now"
to "Nothing to pay today. The rest is due when you collect." where a deposit was
paid. Draw one deposit board for the quote (`dq-quote-deposit`) and one for
the in-shop / answered boards. Use the same words as the ready page ("Deposit
paid", "To pay").

**H4 — `dq-answered`, `dq-waiting-part`, `dq-ready`: the ready page does not
read as the same page the customer has been on, though decision 1 says it does.**
The first board of the journey 4 page and the last board of journey 5 differ in
every visible way:
- Width and layout: a 720px centred column against a full-width two-column
  layout (pay card on the right).
- Title: "Your booking · WH-1042" with "Trek Domane AL 3 · Standard service" against
  "Your Trek Domane AL 3 is ready" with "Job WH-1042 · Maya Patel".
- Header: "Book a repair" is highlighted on every journey 4 board and not on
  `dq-ready` (the source passes `''` for the active link).
- The four-step tracker, the thing decision 6 gives the customer to anchor on,
  is missing; the customer has seen "Ready" greyed as step 4 and never sees it
  lit.
- "Add a note for the shop", present on `dq-in-shop`, `dq-answered`,
  `dq-waiting-part`, is gone.
- Decision 3 says the same photos show on the "Ready to collect" summary. `dq-ready`
  has the "What we did" rows with the mechanic's reason and no photo.
*Why it matters:* a customer who opens the same link on the day the bike is
ready should see the page they already know, with one more thing on it. At
present it looks like a new page, and the pads photo they were shown before
approving has gone.
*Fix:* keep journey 5's approved content and order, change how it is dressed:
same "Your booking · WH-1042" line, "Book a repair" highlighted, the tracker with
all four steps done and "Ready" lit at the top (shortened to one line on the
wide layout), the pay card first (journey 5's own audit L1), the pads photo on the
"Shimano brake pads" row (96px, tap to enlarge, as on the quote), and "Add a note
for the shop" under the shop details.
*Decision for Jack:* how far to move the ready page.
1. Same page, same column. The ready page becomes the 720px column of the quote
   boards (tracker, then "To pay", then "What we did"). It reads as one page on
   every size and is simplest to build once (one layout); costs a redraw of
   journey 5's approved desktop boards, and the pay card loses its place at the
   side.
2. Keep journey 5's two-column layout, align everything else (the list above:
   label, tracker strip, photo, note button). Journey 5's boards change only a
   little; costs one layout for the "while the bike is in" states and another for
   "ready", so the page changes shape once, at the moment the bike is ready.
Recommend 2.

---

## Medium

**M1 — `dq-job-quote`, `dq-job-sent`: the Needed / Optional toggle and the Add
photo / "1 photo" buttons are 26px high on desktop, under the 44px rule and
shorter than the Done box next to them.**
`needToggle()` and `photoBtn()` default to `min-height: 26px`, 12px text and 8px
side padding; the phone and tablet versions of the job page already pass 44.
The Done tick on the same rows is 34px (decision 58 S2: a 44px row times four
lines did not fit under the customer strip). So on every quoted job the staff
control that matters most to the quote, and used by a mechanic with gloved hands
on a workshop tablet or a laptop, is smaller than the control beside it, and
the "26px" is not a decision anywhere. In `dq-job-quote` the table ends at about
y 650 and the Send quote bar starts at about y 712, so about 60px is free at
1280 x 800.
*Why it matters:* the accessibility rule is Jack's first. A segmented toggle
whose two halves are 26px by about 60px is easy to mis-hit, and a wrong
Needed / Optional tells the customer the wrong thing about a brake part.
*Fix:* raise both to the same height; the two options below differ in how far.
*Decision for Jack:* how tall.
1. 34px, matching the Done box. No cost to the page height; still under 44px
   like the Done box, so it repeats an already accepted shortfall.
2. 44px. Meets the rule. Each of the three quoted rows grows by about 10px,
   about 30px in all; by eye from the render there is room at 1280 x 800, but
   on a shorter laptop screen the table would push the Send quote bar and the
   job page would scroll (decision 58). Needs a real build to confirm.
Recommend 2, then check on a 1366 x 768 screen; fall back to 1 only if the page
scrolls there. "Add photo" can be 44px too since it shares the row.

**M2 — `dq-job-quote`, `dq-quote`: the customer sees reasons and pairs that no
staff board lets anyone enter, and the pair wording repeats itself.**
Decision 2 has staff mark lines Needed or Optional "when building the quote",
and lines that make sense together tick as a pair. Customer side: the reason
("Rear pads worn — replacing", "Goes with the new pads", "Cable still
serviceable") and "· goes together with fitting". Staff side: there is a Needed
/ Optional toggle and a photo button, and that is all. The reason for the pads
sits in the Note column; for the fitting the Note column has only "Add photo",
so the reason "Goes with the new pads" has nowhere to come from; for the cable
the reason is in the name cell ("Optional · cable still serviceable"), the
other lines have it in the Note column. No control says "this line goes with
that one". On the customer's card the fitting line then repeats itself: "Goes
with the new pads · goes together with the pads" (render `dq-quote`; source:
the reason, plus an automatic `· goes together with…` suffix).
*Why it matters:* a pair decides whether the customer is allowed to untick a
line on its own, which is a money decision, and a wrong or missing pair is not
something the customer can fix.
*Fix:* make the Note cell the one place for the reason on every line ("Reason
for the customer" placeholder when empty). Add a small "Goes with…" control to
a line, which fills in "goes together with the pads" automatically. When a
reason repeats the pair ("Goes with the new pads"), drop the automatic suffix.
Staff boards to draw: the line's note cell (`dq-job-quote`) and the Goes with
choice.
*Decision for Jack:* how the pair is set.
1. Staff choose it, from the labour line ("Goes with: Shimano brake pads").
   One extra click, only when a line is paired, and the pairing is never a
   guess. Pre-fill the suggestion when a labour line is added straight after a
   part.
2. Automatic: a labour line added straight after a part is paired with it,
   shown with a link icon, and can be unlinked. No clicks, but a wrong guess
   locks two prices together on the customer's side.
Recommend 1.

**M3 — `dq-quote`, `dq-job-sent`, `dq-today-no-answer`: a reminder, "no answer",
a withdrawn quote and Undo are all in the decisions and none of them is on the
customer's page; and the Today board contradicts itself.**
- *Reminder and no answer, customer side.* Decision 4 sends one reminder after
  [n] hours and then flags the job for staff. The customer's quote card
  (`dq-quote`) is the same card before and after: no "Sent [day, time]", no "We
  sent a reminder". Nothing says the shop is now chasing, or that Maya can
  simply answer.
- *Withdrawn.* Decision 4: "staff can withdraw it." No board or source line has
  a Withdraw control on the job page, and no board shows what the customer's
  link says after it (the quote disappears? a notice?).
- *Undo.* `dq-job-sent` says "Quote sent to Maya by text" with an Undo button
  that works for a minute (decision 5). If Undo can work, the text cannot have
  gone yet, so "sent" is not true during that minute. And "by text" is fixed
  wording; the customer chose a way at booking (text, WhatsApp or email).
- *Today.* `dq-today-no-answer` shows "WH-1042 · Maya Patel — no answer to the
  quote yet", yet the same board lists WH-1042 · Maya Patel under "Still to
  arrive" with a "Book in" button, and counts "3 still to arrive". A job awaiting
  a quote answer is a bike already in the shop (and the customer page says
  "booked in Thu 17 Sep at 09:12"). The phone number on that line also breaks
  across two lines ("07700 / 900 142") in the render, and is plain text, not a
  call link.
*Why it matters:* the customer is told nothing during the days the quote is the
slowest thing in the shop, staff cannot take a quote back, and the manager's
Today page shows the same bike as arrived and not arrived.
*Fix:* customer card: add a line under the heading: "Sent [day, time]" and, after
the reminder, "We sent a reminder at [time]". Staff job page: a small
"Withdraw quote" text button beside "Record their answer" once the quote is
sent, with a pop-up (safe choice left, "Withdraw quote" right) and the customer's
page for it ("Alex has withdrawn this quote. Nothing to answer. Call [shop
phone] if you have a question."). Undo bar: "Sending quote to Maya by [text,
WhatsApp or email] in 1 minute · Undo" and "Quote sent to Maya by [method]" once
it has gone. On the Today board remove WH-1042 from "Still to arrive" and fix
the counts when the no-answer line is shown; put the number in a tap-to-call
link that does not break mid-number (non-breaking spaces).
*Decision for Jack:* whether the customer is told the shop will ring.
1. Show only the facts: "Sent [day, time]", "We sent a reminder at [time]", and
   the shop number. Promises nothing; the shop rings when it chooses.
2. Also say "We'll ring you if we don't hear by [day]". Reassuring, and what
   staff in decision 4 will do anyway; but it is a promise the shop has to keep
   and the Settings page has no setting for it.
Recommend 1.

**M4 — `dq-quote`, `dq-quote-untick`, `dq-answered`, `dq-job-quote`, `dq-in-shop`:
keyboard and screen reader gaps in the checkbox pairs, the total, the photo
button and the tracker.**
Checked in `quote.mjs` and `job-page.mjs`. Good: the quote is a labelled list;
each checkbox is wrapped in its own `<label>`; the two pop-ups are real dialogs
with a named heading; the tracker is an ordered list with `aria-current="step"`
and hidden "done / now / to come" text; the staff toggle is a `radiogroup` with
a name ("Shimano brake pads: needed or optional"); the photo button names its
line; the headings go h1, then an h2 per card.
Gaps:
- *Price not read.* In `quoteLine()` the price is outside the `<label>`, so a
  screen reader hears "Shimano brake pads, Needed, Rear pads worn — replacing,
  goes together with fitting, checkbox, checked" and no £28.00. The price is the
  thing being agreed.
- *Total is silent.* No `aria-live`. Ticking and unticking changes the total and
  the button label ("Approve £111.00" to "Approve £123.00"), and nothing is read
  out. When the pair moves together, the other box changes with no notice.
- *Pair is only in words.* The two boxes are not linked in the page structure;
  a screen reader user unticking the pads is not told the fitting went too.
- *Focus after sending.* After "Send my answers" (and "Save her answer", and
  Undo) nothing says where focus goes; the page re-draws as "Thanks, Maya —
  Alex is carrying on" with no named place to land.
- *Photo name.* `aria-label="Photo: rear pads worn — replacing — tap to
  enlarge"`: does not say which part (it is only the reason), and "tap" on a
  desktop page.
- *Tracker words.* The current step reads as "Being worked on, now" and is also
  `aria-current`, so it is announced twice.
- *Toggle keys.* `needToggle()` has `role="radio"` on separate buttons but no
  note that arrow keys move between them and only one is in the tab order, which
  is what a radio group is expected to do.
*Why it matters:* Jack's first rule is accessibility; these are small, and each
sits on the screen where a customer decides about money.
*Fix:* price inside the label (or `aria-describedby` pointing at it); the total
and button in one `aria-live="polite"` region ("New total £111.00"); on a pair
change add a hidden "Fit & adjust brakes unticked too" line to that region;
after sending move focus to the "Thanks, Maya" heading (`tabindex="-1"`, as the
page already does for its h1); photo name "Photo of Shimano brake pads: rear
pads worn — open larger photo"; drop the hidden ", now" when the step is
`aria-current`; real arrow-key behaviour for the toggle. These are build notes for
`frontend`; the drawing needs no change.

**M5 — `dq-record-answer`: staff record a phone answer with the boxes already
ticked, no read-back of what is being saved, and wording that assumes the
customer is a woman.**
`recordDialog()` ticks the two "Needed" lines and leaves the optional one
unticked, as on the customer's page. A phone answer is the customer's own, not
the mechanic's recommendation: pressing "Save her answer" without touching
anything records "Yes" to the pads and fitting whether Maya said so or not.
Under decision 2 an answer is final once saved, so a wrong answer needs a new
revision from the shop. The words say "Her answers are final once saved, as if
she'd answered online." and the button says "Save her answer": these are fixed
text and will be wrong for any other customer. "Maya gets a text with what was
agreed." is fixed to text.
*Why it matters:* the boxes are the record of what a customer agreed to spend,
and a ticked box is the easiest answer to record by mistake.
*Fix:* say it as it is: the dialog and button name the outcome, and the
pronoun goes. "Tick what [Maya] agreed to on the phone. These answers are final
once saved." Button: "Save: yes to 2 lines, not now to 1" (counts follow the
ticks). Message line: "[Maya] gets a [text / WhatsApp message / email] with what
was agreed."
*Decision for Jack:* the starting ticks.
1. Keep the recommended ticks, and add the read-back button. Zero clicks in the
   common case ("yes to what Alex recommends"); costs the chance of saving a
   recommendation the customer did not give, only protected by the button words.
2. Start every box unticked. Staff must tick each line the customer said yes
   to, so the saved answer is always one a person chose; costs one to three
   clicks per recorded answer, and a "Save" that is unavailable until at least
   one answer is given.
Recommend 1, with the read-back button.

---

## Low

**L1 — `dq-answered`, `dq-quote-newer`, `dq-quote-confirm`, `dq-job-sent`: words
that say different things for the same thing.**
- "not now" against "final". The customer is told "You can't change these
  answers afterwards", and then every board uses "Not now" ("Replace gear cable ·
  not now", "You said not now", "Not now" in the pop-up, "Not done — you said
  not now" on the ready page). "Not now" reads as "ask me later", which decision 2
  rules out. "No thanks" or "Not wanted" would match.
- Three names for the same send: "Approve £111.00" (the button), "Send your
  answers?" / "Send my answers" (the pop-up), "Save her answer" (staff). The
  main button says approve even when it is a decline (H1).
- Staff call the booked line "Booked" (`dq-job-quote`, the Customer approval
  column); the customer's page calls it "Already agreed". The same line is
  "Approved" on journey 5's data.
- "Where your bike is" with "Waiting for your answer" and "Alex found more to do":
  three headings for one moment; "more to do" can mean "more wrong".
*Fix:* "No thanks" everywhere the customer answered no; one noun for the send
("Send my answers" on the pop-up and on the button if H2 option 2); "Agreed" on
the staff line and "Already agreed" on the customer's.

**L2 — `dq-quote`, `dq-quote-photo`: the photo does not look tappable.**
The thumbnail (96 x 72) sits between the line text and the price with 12px text
inside it. A real photo has no visible cue: no magnifier icon, no caption, no
focus ring shown. The only mention of "tap to enlarge" is in the screen-reader
name. The enlarged view is a fixed 360px box whatever the photo's shape, and
its only control besides the cross is "Close".
*Fix:* a small magnifier badge on the corner of the thumbnail and a caption
("Photo") beside the 44px area; the thumbnail itself at least 44px on its short
side (it is 72); the pop-up sizes to the photo, with "Close" on the left as
today.

**L3 — `dq-quote`, `dq-quote-untick`: the most useful instruction is the
smallest text on the card.**
"Untick anything you don't want. Prices include VAT; nothing is paid now." is
13px grey, at the foot of the card, below the button. It is the only line that
tells the customer the ticks are theirs to change. The card's other body text is
15px or 16px.
*Fix:* "Untick anything you don't want." moves above the list at 15px; the VAT
and payment line stays at 13px under the button (see H3 for the wording when a
deposit was paid).

**L4 — `dq-in-shop`, `dq-job-sent`, `dq-today-no-answer`: small visual slips.**
- The tracker's step labels do not line up: "Booked" and "In the shop" sit 2px
  higher than "Being worked on" and "Ready" (circles with a 1px border are 30px,
  circles with a tick are 28px; render `dq-in-shop`).
- The Undo bar in `dq-job-sent` sits 28px from the bottom and covers the whole
  of the footer button ("Record their answer") for the minute. The button is
  the next thing staff may want.
- The one-minute length of Undo is not shown anywhere on the bar.
*Fix:* fix the circle size (border-box) so labels align; lift the Undo bar above
the footer bar; add "(1 minute)" to the Undo label or a small count.

**L5 — `dq-messages`: the "Quote to approve" row cannot be edited as drawn, and
the channel column disagrees with the decision.**
- "Edit wording" is shown only on the hovered "Bike ready" row. The "Quote to
  approve" row, the new one, is drawn without it even on hover, so decision 5's
  "the wording is set once in Settings › Messages" has no visible door. Hover-only
  controls also need a keyboard and touch way.
- One row stands for two messages: the quote and its reminder ("reminder after
  [n] hours with no answer"). The reminder has its own text, but no row to open
  it and no box to set the [n] hours.
- "Quote to approve" says "Customer's choice" (right, decision 6 of Book a repair),
  while "Bike ready" and "Bike still waiting" still show fixed Text on / Email off
  switches, though both are about a booked bike whose channel the customer
  chose.
*Fix:* "Edit wording" on every row on hover and on focus, with a visible "Edit"
beside it on touch; a second line in the row for the reminder ("Reminder after
[n] hours" with a small number box) and its own wording; "Customer's choice" on
"Bike ready" and "Bike still waiting".

**L6 — `dq-waiting-part`, `dq-job-sent`: two staff steps that drive the customer's
page are not drawn.**
- "Waiting for a part — we'll update you." and "Expected ready: Sat 19 Sep,
  16:00" appear on `dq-waiting-part`. The job page has no board for the staff
  step that sets this status (a "waiting for a part" choice, a new ready time).
  Decision 6 says the tracker "moves by itself as staff use the job page": the
  steps (book in, start work, finished) are on the job page, "waiting for a part"
  is not named.
- After sending, `LINES_QUOTE_SENT` strips the Needed / Optional toggle and shows
  "Awaiting approval" on three lines, so staff no longer see which lines were
  Needed. When the customer answers, nothing shows how the table changes
  (Approved / Declined chips) or what the Proposed £123.00 tag becomes.
*Fix:* name the status on the job page's status list ("Waiting for a part", with
a ready time and a short note to the customer), draw one board; keep "Needed" /
"Optional" as small grey text beside the "Awaiting approval" chip; draw the
answered job page once (Approved / Declined chips, "Approved £111.00").

---

## Answers to the specific questions

- **One continuous page from booking to ready:** headings and the shop block
  agree between the booking page and the quote boards ("Your booking · WH-1042",
  the bike and service as the title, "Add a note for the shop" as a bordered
  button, one purple chip for the waiting state). Where it breaks: the deposit and
  "Free to cancel" carry no further than the booking page (H3), the ready page is
  a different layout, title, header highlight, no tracker, no photo (H4).
- **Quote clarity:** the lines, "Needed" (amber) and "Optional" (grey) are in words,
  the total follows the ticks (£111.00, £123.00), the pair is stated, the booked
  service is a clear "Already agreed" row. Gaps: nothing for declining everything
  (H1), the final-answer line only in a pop-up (H2), the pair wording repeats
  itself (M2), the photo has no visible cue (L2), no deposit (H3).
- **Deposit:** disappears from this page (H3); journey 5 handles it.
- **After declining everything:** not drawn (H1).
- **Reminder and "no answer" on the customer page:** not reflected at all (M3).
- **Staff control sizes against 44px:** customer side all 44px or more; staff
  Needed / Optional and photo buttons are 26px (M1); the pop-up and footer buttons
  are 44px.
- **Keyboard and screen reader:** M4 (price outside the label, silent total, pair
  and focus, photo name, tracker words, toggle keys). Good: dialogs, list and
  heading structure, tracker list, named toggle.
- **Wording:** L1, M3 ("sent" while Undo works), M5 ("her"), L5.
- **Data across boards:** Maya Patel, WH-1042, Trek Domane AL 3, Alex Morgan, Jo
  Taylor, £65.00, £28.00, £18.00, £12.00, £111.00 and £123.00 agree on every board
  where they appear. Times agree (booked in Thu 17 Sep at 09:12, ready by
  Thu 17 Sep, Sat 19 Sep 16:00 for the delayed pads). One mismatch: Today lists
  WH-1042 as still to arrive (M3). The job page's "Diary time Thu 17 Sep
  11:30-13:00" is a workshop slot against the customer's 09:12 drop-off, not a
  clash. The staff line "Booked" and the customer's "Already agreed" differ in words only (L1).
- **Fewest clicks:** the ticks start in the recommended state, the total updates
  as the customer goes, sending the quote is one click, "Record their answer" is
  one button on Today. Where clicks can be cut: the second step of the pop-up
  (H2), nothing else on the customer side. Staff pairing is one click only when
  there is a pair (M2).

---

## Summary of what to decide

1. Whether the "Send your answers?" pop-up stays, or the final-answer line sits
   by the button and one click sends (H2, options 1-2).
2. How far the ready page moves toward the quote page's layout (H4, options 1-2).
3. How tall the Needed / Optional and photo buttons are on the staff job page:
   34px or 44px (M1, options 1-2).
4. How a pair is set: chosen by staff or automatic (M2, options 1-2).
5. Whether the customer is told the shop will ring when there is no answer (M3,
   options 1-2).
6. The starting ticks when staff record a phone answer (M5, options 1-2).

Nothing here changes a decision. The rest (the missing boards and wording in
H1 and H3, the Withdraw control, the Undo wording and the Today fix in M3, the
build notes in M4, and all the Lows) need only a yes from Jack. No file other
than this one was edited.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | quote, untick, confirm, answered | Declining everything or a "Needed" line is allowed but not drawn; the button still says Approve | Yes |
| H2 | quote, confirm | The "final" warning only appears after the first click; no phone or note button on the quote page | Yes (option 1-2) |
| H3 | in-shop, quote, answered, waiting-part, ready | A deposit paid at booking vanishes, then returns as a smaller "To pay" | Yes |
| H4 | answered, waiting-part, ready | The ready page has a different layout, title, header highlight, no tracker, no photo | Yes (option 1-2) |
| M1 | job-quote, job-sent | Needed / Optional and photo buttons are 26px | Yes (option 1-2) |
| M2 | job-quote, quote | Reasons and pairs have no staff control; pair wording repeats | Yes (option 1-2) |
| M3 | quote, job-sent, today-no-answer | No reminder, withdrawn or Undo wording on the customer side; Today lists Maya as still to arrive | Yes (option 1-2) |
| M4 | quote, untick, answered, job-quote | Price not read, silent total, pair, focus, photo name, tracker, toggle keys | Yes |
| M5 | record-answer | Ticked by default, no read-back, "her" and "text" are fixed words | Yes (option 1-2) |
| L1 | answered, newer, confirm, job-sent | "Not now" against "final"; three names for the send; Booked / Already agreed | Yes |
| L2 | quote, photo | Photo has no visible cue; fixed-size enlarged view | Yes |
| L3 | quote, untick | The only tick instruction is 13px grey below the button | Yes |
| L4 | in-shop, job-sent | Tracker labels 2px off; Undo bar covers the footer button | Yes |
| L5 | messages | Quote row cannot be edited as drawn; reminder has no row; channel column disagrees | Yes |
| L6 | waiting-part, job-sent | Staff step for "waiting for a part" not drawn; Needed / Optional lost after sending | Yes |

## Verification (1 Oct 2026)

Checked in the main session before Jack chose: the button and pop-up text
fixed regardless of the ticks, "nothing is paid now" with no deposit rows,
the 26px toggle and photo buttons, "Goes with the new pads · goes together
with the pads" on the fitting line, and WH-1042 under "Still to arrive" with
"Book in" on the no-answer Today board all held. Jack took every
recommendation (decision 7) with options 2, 2, 2, 1, 1 and 1 for H2, H4, M1,
M2, M3 and M5. Built: at 44px the staff quote table fits the 1280 × 800
board once the note cell stays on one line; a 1366 × 768 screen was not
checked. L6's "waiting for a part" staff step already existed as the diary's
`job-waiting-parts` board and is shown, not redrawn.
