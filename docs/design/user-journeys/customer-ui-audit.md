# Journey 15 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 16 desktop renders of the
Customer service boards (1280 x 800), against
`docs/decisions/2026-09-30-customer-service-review.md` (decisions 1-11),
`generator/customer.mjs`, `generator/settings-frame.mjs`, and the rules for
every journey in `HANDOVER-next-journey.md`. Tablet and phone are not drawn
yet, so nothing here covers them.

**Not raised, on purpose.** Browser-blue links and the fallback font for
numbers in the renders. The [bracketed] placeholders. The unselected-pill
border contrast (parked as a design-wide fix). 12-13px text that is only a
label or second line. Maya's email differing from other journeys. "Bought
here" on her bike being illustrative. The two original layout options
`cs-opt-folds` and `cs-opt-timeline` (decision 2 chose the timeline; nothing
to say about them). None of Jack's 11 decisions is reopened.

**Verdict.** The look is right: Soft sand throughout, amber only in the
sidebar marker, outlined red for destructive buttons (Privacy requests, Delete),
pop-ups in the middle with the safe choice on the left (except one, see M8),
and every status carries a word, not just a colour (job states, warranty, On/Off,
the merge choice has a tick). The problems are in what the customer page
actually answers and in states nobody has drawn yet. The page is built like a
filing card (details, bikes, then money at the bottom), but the person at the
counter needs "what happened last time, what's open now, and do they owe us"
within two seconds. Findings are ranked; where a fix is a real choice the
options are numbered.

Checked against the source, not just the pictures: the history sorts jobs
oldest first (`a.day - b.day`), job rows are plain `<div>`s (only the sale row
is a link), and the "At a glance" rows are 40px tall (`min-height: 40px`).

---

## High

**H1 — `cs-page`, `cs-page-dup`, `cs-page-off`: the history is oldest first,
so it does not answer "what happened last time?"**
Decision 2 says newest first. The drawn list starts at Mon 14 Sep and ends at
Wed 16 Sep, then the sale sits at the bottom with no date. Four more things
stop it answering the question at a glance:
1. The five jobs drawn are a mix of "Ready", "Waiting for parts" and
   "Scheduled". Nothing separates what is still open or coming up from what is
   finished, and no finished job is drawn at all, so nobody can see what
   "last time" looked like.
2. The rows say what the job was and when, but not what it came to or whether the
   bike went home. "Ready" could mean ready to collect or already collected.
3. Five of her nine jobs are shown with no "Show more" (the old folds option had
   "Show all 9 jobs"). The Messages pill exists but no message is drawn, and no
   refund or store-credit change is drawn either, though decision 2 lists
   refunds and messages and decision 10 says credit changes show in the history.
4. There is no empty state (a new customer with nothing yet) and no state for a
   filter with nothing in it.
*Why it matters:* this is the most-used page in the app. As drawn, staff read
down a list in the wrong order to find the newest line.
*Fix:* newest first, with the undated sale given its date. Add a short strip at
the top of History, "Open now" (jobs not yet collected, with their status), so
a bike in the workshop is the first thing seen. Add one finished-job row
("Collected [date] · [£]") and one refund row and one message row so the
builder has every kind. Show the newest 10 with "Show older" under them.
Empty state: "Nothing yet. Start a job or a sale for [name]" with the same two
buttons as the header.

**H2 — `cs-page`, `cs-account`, `cs-list`: money is at the bottom, and "over
the limit" has no state at all.**
"Owes on account" and "Store credit" are the last things in the left card, about
575-690px down on an 800px screen, and in `cs-page-dup` (one notice taller) the
last row is already cut off at the bottom edge. Nothing in the header or the
Customers list says she owes money. The account pop-up shows "Owes now" and
"Most Maya can owe" as two unrelated things, with no sign of how close she is,
and no board shows a customer at or over the limit, or one who owes nothing
(is "Take a payment at the till" greyed out?).
*Why it matters:* the moment staff add a sale to an account is the moment this
matters, and Jack's trust-over-lock-down stance means the screen must warn
clearly, since it will not lock.
*Fix:*
1. Move "At a glance" to the top of the left card, above Details. The address
   and note are for occasional reading; the balance is for every visit.
2. Put "Owes £x" and "£x credit" as small chips beside her name in the header,
   and as a chip on her Customers list row. Only when the shop has them switched
   on (decision 6).
3. In the account pop-up draw the limit as "£x of £y" with a plain bar and words.
4. Draw one over-the-limit state with an alert icon and the words "Over her
   limit by £x", in the warning colour (real warnings keep it), and one
   owes-nothing state with the payment button greyed.
*Decision for Jack:* what the till does when a sale would go over the limit
(item 1 in the decisions below).

**H3 — `cs-privacy-delete`: deleting someone has no check for money owed, credit,
or a bike in the workshop.**
The pop-up says what goes and that it can't be undone, which is good. It does
not say what happens if she owes £40, holds £25 store credit, has a bike
waiting for a part, or has a booked job next week. Deleting wipes the name from
the books, and there is no undo.
*Fix:* before the confirm pop-up, check and show a plain list at the top of it:
"Maya owes £x on account", "She has £x store credit", "She has 2 open jobs".
Either block deleting until those are settled, or (simpler) show them in the
warning colour with an alert icon and keep the button live with "Delete anyway"
as its wording. Draw one such state. Also say whether Staff can see the button:
the list is drawn as Jack Lewis (Manager), but the link to it on `cs-list` is
drawn for Jo Taylor (Staff), and the source has no rule about who may delete.
*Decision for Jack:* block, or warn and allow (item 2 below).

**H4 — `cs-list` (and every `cs-*` page): two search boxes that look alike.**
The header box says "Search jobs, customers, products"; the Customers page has
a second box, "Find a customer", 75px below it, same border, same shape. App
map decision 2 puts one search on every staff page, so this breaks it on the
page where it matters. Staff will type in one and wonder why the other is empty.
The page box also tells a different story from the header: it names postcode,
the header doesn't say what it covers. The footnote under the list repeats
the placeholder almost word for word ("Search finds anyone by name, phone,
email or postcode").
*Options:*
1. Remove the page box. The header search stays, and when you are on Customers
   it says "Search customers" and lists customers first, then everything else.
   Best for one search everywhere and for fewest clicks. Costs: the list needs
   a line showing what is shown when nothing is typed.
2. Keep the page box but make it plainly a filter of the list ("Filter the list")
   and keep the header as the global one. Costs: still two boxes, only clearer.
Recommend 1. Either way, delete the repeated footnote, and make sure the
header search finds by postcode and phone (check this is in the spec of A2).

**H5 — `cs-account`: the limit box is live, but the text beside it says only
managers can change it, and the board is drawn as Staff.**
The pop-up is drawn as Jo Taylor (Staff). "Most Maya can owe" is an ordinary
editable box with "managers can change hers" beneath it. Same problem that the
Owner setup audit raised for the Tills board: the screen shows a control the
person may not use. Nothing says when the new limit saves either (no "Saved",
no button for it), and the pop-up's only buttons are Close and Take a payment.
*Fix:* for Staff show the limit as plain text ("Her limit: £x, set by a
manager"); for a manager draw the box with the "Saved · Undo" note from Owner
setup decision 4, and say it saves when you leave the box. Draw the manager
version once.

---

## Medium

**M1 — `cs-page`: the "At a glance" links don't look or behave like buttons.**
Only "Owes on account" and "Store credit" are links (underlined, bold), and only
the words are. The money figure on the right is not part of the link, the row is
40px tall (under the 44px rule) and the link itself is about 20px tall.
"Marketing" looks identical in layout but does nothing, so nothing tells you
which rows open something. "Edit" (Details) is about 26px wide and "+ Add"
(Bikes) about 40px wide: both 44px tall but narrower than 44px.
*Fix:* make each clickable row one whole 44px-tall button across the card, with
a chevron on the right, and leave non-clickable rows plain. Give "Edit" and
"+ Add" side padding so they are at least 44px wide. Underline is not enough of
a cue on its own.

**M2 — `cs-page`: job rows look like plain text but decision 11 says a job opens
the job page; the sale row is a link, the bike row is neither.**
Only the sale row is a link in the source. Nothing on any job row shows it can
be opened, and no board shows where a job goes. The Trek bike row has no action
at all (no way to edit a bike, add a service, or see its jobs).
*Fix:* every history row gets the same chevron and hover highlight, opens the
job page (journey 12) or the sale pop-up. The bike row opens a small pop-up
with its details, warranty and "Start a job for this bike". That last button
saves a click over going to "New job" and then choosing the bike.

**M3 — `cs-edit`: "Changes save when you press Done" versus Owner setup
decision 4. Is it a real problem?**
Partly. Owner setup 4 covers settings (shop, tills, reasons, messages),
which change how the shop works and have an Undo. A customer's details are
records about a person, so a Cancel that throws away typing is reasonable and
does not contradict it in principle. The real problems are smaller:
1. The same word means two things. In the settings pop-ups "Done" only closes,
   because everything has already saved; here "Done" is the save, and the
   bottom-left "Cancel" discards. A person who learnt "Done just closes" will
   lose edits, or assume Cancel keeps them.
2. The On/Off pill for offers sits in the same pop-up as typed fields, yet
   elsewhere in the app a pill saves the moment you press it.
3. Consent changes matter more than an address: turning "Happy to hear about
   offers" off must take effect at once, and be logged with who and when.
*Options:*
1. Keep the pop-up but call the button "Save changes", keep Cancel on the
   left. Smallest change; stops the word clashing.
2. Edit in place in the Details card (each field saves when you leave it, with
   the small "Saved" tick and Undo from Owner setup 4), and drop the pop-up. Best
   for fewest clicks (Edit, change, Done = three clicks becomes click,
   type); costs a longer Details card and more to build.
Recommend 1 now, with the Marketing row fixed as in M4.

**M4 — `cs-page`, `cs-edit`: stopping marketing takes three clicks.**
Marketing on the page is read-only text ("[yes or no]"). To switch it off:
Edit, the pill, Done. A customer saying "stop the offers" at the counter is a
legal request and should be instant.
*Fix:* draw the Marketing row in At a glance as the same On/Off pill used
everywhere (tick plus word), saving at once with "Saved · Undo" and a line
"Agreed [date]" underneath. One click.

**M5 — `cs-list`: the list doesn't help find the right person, and search has no
states.**
- "Most recent first" is not said to mean most recent what (visit, job, added?).
  Rows show name, bike and phone, but no last visit date, no "owes" chip, no
  open-job marker, and no group. Two Maya Patels would look identical.
- Missing states: search with no results; search while typing; a customer with
  no phone (the right-hand column is empty and the row looks broken); a
  customer with no bike (the grey second line is empty); a long list (there is
  no count, sort, or "Show more").
- "No results" is also the best moment to add someone. Fewest clicks: show
  "No one called 'Dan'. Add Dan as a customer" which opens Add a customer with
  what was typed already in the name or phone box.
- Hover: a small "New job" button appearing on the row (hover extra, click keeps
  working) would save the trip into the page. List, page, New job is two clicks
  now; it becomes one.
*Fix:* as listed. Show "Phone or email" so a row always has a way to reach
them; when there's no phone show the email; when neither, "No phone or email".

**M6 — missing states a builder needs, collected in one place.**
Not drawn anywhere, all needed:
1. A customer with no history yet (see H1).
2. No phone (header line reads "07700... · email" and leaves a dangling dot);
   no email (Email the statement must disable or say why).
3. A company or club customer's page (company name, contact name, avatar
   initials of a company, group). Edit doesn't show the Person / Company choice
   either, so a person can't be turned into a club.
4. Store credit switched off (only accounts-off is drawn, `cs-page-off`) and
   both off (At a glance is then only Marketing).
5. A merge that was done and one that was undone (see M7).
6. Account over the limit, or owing nothing (see H2).
7. No groups set up: the "Group" row should not appear on the page or in
   Add a customer when there are none.
8. Customer history filters with nothing in them.
Also build notes for the source: `history()` only handles the "Sales" filter,
so Jobs and Messages would show everything if drawn.

**M7 — `cs-merge`, `cs-page-dup`: the merge comparison makes you click through
things that don't need deciding, and the aftermath is undrawn.**
- Phone is the same on both sides, yet drawn as two choices. Show identical
  values once as "Same". Email and address: one side is "[none]", so the filled
  one should be picked for you. As drawn, the default is "keep Maya Patel" on
  every row. Merge then needs zero clicks beyond the button: Check, Merge.
- There is nothing to help decide which record is the real one: how many jobs,
  sales and bikes each has, and when each was added. Add a line under each
  name ("9 jobs · added [date]" and "0 jobs · added [date]").
- "They're different people" sits in the safe slot on the left, like Cancel,
  but it is a recorded decision (the warning stops coming back). Say what it
  does in a line ("We won't ask again"), and add the ✕ for just closing.
- Not drawn: the page straight after a merge ("Merged with Maya P. on [date].
  Undo" for the [n] days it can be undone), and the page after the undo. The
  pop-up says merging can be undone "from the customer's page" but no board
  shows where.
- The notice says "Might be the same person as Maya P."; decision 5's wording
  is "Might be the same as Maya P.". Either is fine, pick one and use it in the
  spec.

**M8 — `cs-sale`: the footer breaks the safe-choice-on-the-left rule.**
"Print the receipt" sits in the safe slot on the left and "Refund at the till"
is the dark main button on the right. There is no Close button, only the ✕. For
a pop-up that only shows a sale, "Refund" is the heaviest action on it, and it
is the one you want someone to think before pressing.
*Fix:* "Close" on the left, "Print the receipt" as an outlined button in the
body (or next to Refund), "Refund at the till" as an outlined button, not filled.
Draw a partly refunded sale ("Refunded £x on [date]") and one paid with store
credit or on account, since the page now has both. The first line item has a
rule above it that doubles up with the pop-up's header edge (Low).

**M9 — `cs-add`, `cs-add-company`, `cs-add-match`: the form reads as all
required, and overflows.**
- Phone and Email have no "(optional)", while Address, Postcode, Group and Note
  do. The subtitle says "one way to reach them", but the form says both are
  required. Label them "Phone or email (one is needed)".
- In the company and match versions the pop-up is taller than the screen: the
  "Happy to hear about offers" switch is cut off and the pop-up scrolls inside
  with no visible sign. Even the person version leaves 32px of margin. On a
  768px laptop it scrolls.
- Nothing shows the state of "Add the customer" (disabled until a name and a way
  to reach are filled in) or an error ("That's not a phone number").
- Only a phone match is drawn. Email and name matches (decision 5 lists all
  three) are not.
- After "Add the customer", where do you land? Suggest their page with "New
  job" and "Add to a sale" ready.
*Fix:* fold Address, Postcode, Group and Note under one "Add more details"
line (opened for a company? no, closed for both), which fits the pop-up on any
screen and makes the common add a three-field form. Costs a click only when
someone wants them.

**M10 — `cs-credit`: the reason is free text, where other reasons are pills
from the shop's list; nothing shows the result.**
Discounts, voids and refunds use reason pills from the shop's own lists (Owner
setup decision 5, "Other" to type). This is the same kind of thing ("a goodwill
gesture" is the placeholder) but typed from scratch every time, so the reports
will have a hundred spellings. The button reads "Add the credit" and must change
to "Take it away" when the other pill is chosen. Nothing previews the result
("She'll have £x"), or blocks taking away more than she has, and it isn't said
whether the reason is required.
*Fix:* pills for the shop's credit reasons with Other, a preview line, and a
required-reason rule. One more reasons list in Settings > Till.

**M11 — `cs-privacy`: the legal deadline has no emphasis, and two screens are
missing.**
"Answer by [date]" is 13px grey on every row, open or not. A request nearly at
its month has no different look to one asked yesterday, and the top link on
`cs-list` ("[n] open") can't say "2 late". Also not drawn: the "Log a request"
pop-up (who, which kind, date asked defaulting to today), what "Send the copy"
does and sends to (by email? to whom if she has no email?), and the customer
name on a row being a link to their page.
*Fix:* rows sorted by due date, with "Due in 3 days" and an alert icon plus
"Overdue by 2 days" in the warning colour (words and icon, not colour only).
The link on the list reads "Privacy requests · 2 open, 1 late" when needed.
Draw "Log a request" once, and say what "Send the copy" sends.

**M12 — `cs-page`: the header's buttons are unclear and something obvious is
missing.**
"Add to a sale" doesn't say which sale or which till. On the office computer
there may be no sale open. "New job" is clear. There is no way to message her
from here (texts and emails are in the history), and her phone and email are
small grey text, not something you can tap to call, text or email.
*Fix:* "Start a sale for Maya" (and if a sale is open at a till, say so in the
label), a "Send a message" button, and the phone and email as links. Say in the
spec what "Add to a sale" does on a computer that isn't a till.

**M13 — `cs-page`: no way back to the list.**
The privacy page has a "< Customers" link at the top; the customer page, which
replaces journey 12's account board and is opened from job pages too, has
none. Staff would use the sidebar, which also loses the search they just made.
*Fix:* the same back link, and go back to the list as it was (same search).

**M14 — `cs-transfer`, `cs-account`: a stack of two pop-ups with extra typing.**
The transfer pop-up is drawn over the customer page, not over the Account
pop-up it was opened from, so it isn't clear if Account closes. Afterwards
nobody sees the new balance. The Amount box starts empty and the date box is a
placeholder.
*Fix:* keep Account open beneath, go back to it after "Record it" with the new
balance and a "Saved · Undo" note. Pre-fill Amount with what she owes and
Date with today, and check the amount isn't more than owed (or say
"£x will be left as credit").

**M15 — `cs-groups`: only the list is drawn.**
"Edit" and "+ Add a group" have no pop-up; there is no empty state for a new
shop (see the Owner setup empty-state rule), no Remove, and no rule for what
happens to customers in a group that is deleted. In Add a customer, groups are
pills, which is wrong once a shop has ten; use a search box past about five
(rule 62/66).
*Fix:* draw one pop-up (name, discount, Remove as an outlined red button inside
it, and a line "[n] customers are in it") and one empty state. Names of the
customers in it are not needed.

---

## Low

**L1 — `cs-page`: Details rows don't line up.** "Group" is baseline-aligned
with its value while "Address" is stacked above its value; the Note box
touches the Group row with no gap. Use one pattern for every row.

**L2 — `cs-page`: the left card is taller than History** when history is short,
leaving a large empty block under it. Not a problem on its own; it makes the
"Open now" strip (H1) easy to add without changing the layout.

**L3 — dates in History have no year.** "Mon 14 Sep" is fine this month and
wrong for a customer who last came 14 months ago. Show the year when it isn't
this year.

**L4 — `cs-sale`: first line item has a rule right under the header edge**, so
the pop-up shows two lines there.

**L5 — `cs-list`, `cs-page`: avatar circles are 36 and 48px with different
initial sizes**; harmless, but pick one size per use and name it in the spec.

**L6 — `cs-groups`, `cs-privacy`: the user block in the sidebar wraps
("Jack / Lewis", "Sign / out").** Already noted in the Owner setup audit as a
frame matter; repeated here only so it isn't lost.

**L7 — `cs-page-dup`: the notice pushes the last At-a-glance row off the
bottom edge** of an 800px screen. It scrolls, but fixing H2 (money to the top)
also fixes this.

---

## Answers to the specific questions

- **"What happened last time?" at a glance:** no. Oldest first, no open-now
  strip, no finished job drawn, no amounts, five of nine jobs with no more
  (H1).
- **List, page and pop-ups consistent:** names and the phone format match.
  Differences: the list shows no money or group, the page shows money at the
  bottom, pop-ups close with either Close, Cancel or Done (M3, M8), and the
  reason for credit isn't like other reasons (M10).
- **Under 44px or not obviously clickable:** the At a glance rows (40px, label
  only), "Edit" and "+ Add" widths, job rows and the bike row with nothing to say
  they open (M1, M2).
- **Colour-only states:** none found. Job statuses, warranty, On/Off and merge
  choice all carry words or ticks. The new states proposed (over the limit,
  overdue) are to be drawn the same way.
- **Edit details saving on Done vs Owner setup 4:** not a conflict in principle,
  a wording clash in practice (M3).
- **Two search boxes:** yes, a real duplicate (H4).
- **Missing states:** M6 lists them.
- **Click savings:** Marketing toggle on the page (3 clicks to 1), Start a job from
  a bike row or list hover (2 to 1), Add a customer from a failed search, merge
  with pre-filled choices, transfer pre-filled, phone and email as links.

---

## Summary of what to decide

1. When a sale would take her over her account limit: warn and allow (fits
   "trust over lock-down"), or stop until a manager agrees (H2).
2. Deleting someone who owes money, holds credit or has open jobs: block it
   until settled, or warn and allow (H3).
3. One search (header, scoped to Customers) or two with the page one renamed a
   filter (H4, option 1 or 2).
4. Edit details: rename the button and keep the pop-up, or edit in place
   (M3, option 1 or 2).
5. What "Add to a sale" does on a computer that isn't a till (M12).

Nothing here changes a decision. No file other than this one was edited.

## Checked in the main session (30 Sep) and Jack's choice

Checked against the source: the history lists jobs oldest first (true);
the account limit is editable on a Staff board (true); two look-alike
search boxes (true). Not true: the Add pop-ups overflow (measured: they
fit); the sale pop-up breaks safe-left (Refund is the confirming action, on
the right). Jack adopted every other finding and the five recommended
answers (decision 12).
