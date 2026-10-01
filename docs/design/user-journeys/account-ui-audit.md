# Journey 7 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 32 desktop renders of the
Account, history and reminders boards (1280 x 800, `ac-account`,
`ac-account-lower`, `ac-account-repairs`, `ac-account-new`, `ac-receipt`,
`ac-job-note`, `ac-job-note-sent`, `ac-job-note-answered`, `ac-ask`,
`ac-question`, `ac-account-asked`, `ac-inbox`, `ac-inbox-sent`, `ac-inbox-all`,
`ac-reply-text`, `ac-today`, `ac-book-remind`, `ac-collect-remind`,
`ac-services`, `ac-service-edit`, `ac-messages`, `ac-reminder-wording`,
`ac-reminder-landing`, `ac-review-setting`, `ac-contact`, `ac-stopped`,
`ac-download`, `ac-delete`, `ac-delete-blocked`, `ac-delete-sent`,
`ac-privacy-requests`), against
`docs/decisions/2026-10-01-account-and-reminders-review.md` (decisions 1-7),
`generator/account.mjs` (`accountPage`, `history`, `contactSummary`,
`contactDialog`, `switchRow`, `stopped`, `dataDialog`, `jobThread`, `askDialog`,
`questionPage`, `inbox`, `serviceDialog`, `reminderDialog`, `reviewDialog`), the
pieces it borrows (`settings-frame.mjs`: `remindBox`, `rowSwitch`, `popup`;
`book.mjs`: `detailsRemindAt`; `collect.mjs`: `summaryRemindAt`; `quote.mjs`:
`inShopAt`; `opening.mjs`: `today`; `customer.mjs`: `cs-privacy`; `setup.mjs`:
`msgListOpen`, `wordingBox`), the rendered HTML of each board for the
accessibility checks, and the rules for every journey (accessibility first, fewest
clicks, plain English, no invented data). Tablet and phone are not drawn yet, so
nothing here covers them.

**Scope.** `ac-book-remind`, `ac-collect-remind`, `ac-reminder-landing`,
`ac-services`, `ac-messages`, `ac-privacy-requests` and `ac-today` use approved
pages from earlier journeys: only the new parts (the tick, the reminder line, the
Messages rows, the two Today lines) and whether the rest of the board agrees with
them are audited. `ac-job-note*` use journey 4's job page: only the Notes card
and the header.

**Not raised, on purpose.** The [bracketed] placeholders (`[date]`, `£[credit]`,
`£[total]`, `[n]`, `[Maya's note to the shop]`, `[shop phone]`, `[link]`). The
scroll areas the renderer clips (the foot of each page, the foot of
`ac-account-lower`). The shop logo slot. The unselected-pill border contrast
(parked as a design-wide fix). Tablet and phone. 12-13px text that is only a label.
Real example data: Maya Patel, 07700 900 142, maya@example.test, Trek Domane AL 3,
WH-1042, Jo Taylor, Alex Morgan, Oliver Chen, North Street Cycles, Bolton are as the
header of `account.mjs` lists them. None of the seven decisions is reopened: one
account page shaped like the staff customer page, a reminder time per service with
one yes from the customer, conversations on the website, "Your data" as an instant
copy plus a deletion request, an automatic review request that is off by default,
one "How we contact you" section with "Stop these" in every optional message, and
a two-pane staff inbox.

**Verdict.** The decisions are carried out and the look is right: Soft sand, one
dark button per board, the account page really does mirror the staff customer page
(bikes and warranty on the left, one history on the right, "Now" then "Earlier,
newest first"), every history row and filter pill is at least 44px, the job's
conversation reads like a messaging thread with who and when on each line, the
text Maya receives carries the decision's exact "Replies to this number aren't
read" line, the blocked-deletion pop-up leads with the decision's sentence, and
the "Stop these" page says what happened and what still arrives. Body text uses
the shared tokens (muted grey is about 5.5:1 on cards; by hand about 4.7:1 on the
sand dialog body). The problems are at the edges of the decisions: the one yes the
customer gives to reminders is pre-ticked and the yes for review requests is
nowhere, the main controls of "How we contact you" cannot be named by a screen
reader, a deletion request leaves no trace on the account, and the customer is
told "we'll text you" whatever channel they chose. The account page is also about
two screens tall on the left with its two privacy sections at the bottom.
Findings are ranked; where a fix is a real choice the options are numbered.

Checked against the source, not just the pictures: `remindBox(checked = true)`
renders `<input type="checkbox" checked>` on both the booking and ready boards;
`switchRow()` renders `offer(on ? 'On' : 'Off', on)`, a `<button aria-pressed>`
whose only content is "On" or "Off" (the label is a sibling `<span>`), while
`reviewDialog()` uses `rowSwitch()`, which renders `role="switch"` with a label;
`jobThread()`, `askDialog()` and `questionPage()` hard-code "text you" in the hint
(`We'll reply here and text you when we do`, `we'll text you when it does`,
`We'll text you when the shop replies`); `dataDialog('sent')` returns a pop-up and
`accountPage()` has no parameter for a pending request; `history()` only builds
`ROWS_NOW.repair` and `ROWS_NOW.message` (no job-note row); `stopped()` writes
"Sign in to your account" as plain text, not an `<a>`; `convRow()` marks "needs a
reply" with an `aria-hidden` dot and no words; `accountPage()` gives
`siteDesktop('sand', 'Account', ...)` but the rendered header has no
`aria-current` and no underline on any link (`ac-job-note*` underline "Book a
repair"); `link()` is `<a href="#">` for "Edit", "Change", "Download a copy of your
data" and "Ask us to delete your account"; `wordingBox(...)` holds the "Stop these:
[Link to stop]" text inside the editable box in `REMINDER_WORDS` and
`REVIEW_WORDS`; `today({ noAnswer: ... })` is not used here, yet `ac-today` still
lists WH-1042 under "Still to arrive" with "Book in" while `ac-account` says "In
the workshop". Nothing was run: this environment had no shell, so the HTML was read
with search, and contrast numbers are hand calculations from the token values.

---

## High

**H1 — `ac-book-remind`, `ac-collect-remind`, `ac-review-setting`, `ac-messages`,
`ac-contact`, `ac-account-new`: the customer's "yes" to reminders is pre-ticked,
and the "yes" to review requests is not drawn anywhere.**
Decision 2 says the customer "ticks" the box. Both boards draw it already ticked
(`remindBox(checked = true)`). The shop-side text says "Only customers who said
yes get it" on the Messages section, the service dialog and the review dialog.
For review requests no board has a customer saying yes: Maya's account shows
"Review requests · On", a brand-new account shows "Off", and neither the booking
nor the ready page asks. So the same account page shows two different starting
states and the shop is told something the screens do not do. Decision 5 says
customers "can turn these off", which reads as on by default; decision 2's reminder
reads as opt-in. The two are treated differently with no sentence saying why.
*Why it matters:* a ticked box the customer never touched is not a yes, and the
shop owner reading "only customers who said yes" will rely on it. The ICO says
consent needs a step the person takes themselves and pre-ticked boxes do not count
(ico.org.uk, "What is valid consent?"); whether a service reminder to a customer
who just booked a service needs consent at all is a question for the shop's lawyer,
not for the design, so the safe drawing is the one that does not depend on the
answer.
*Fix, choose how far:*
1. Untick the box on both boards, keep its words. One extra tap for a customer who
   wants reminders; fewer reminders sent overall. Matches "ticks" in decision 2
   and every "said yes" line on the shop side. Review requests then need their own
   tick, or a sentence under this one ("We'll also ask for a review after you
   collect. Stop any time."), so decide which of the two is the customer's yes.
2. Keep the box ticked, and rewrite the shop-side notes to "Customers can say no
   at booking and at collection". Fewest clicks and the most reminders sent;
   moves the legal risk to the shop and contradicts "customers say yes once".
3. Untick, and add the review tick as a second row under it, drawn in both places
   ("Ask me for a review after I collect my bike"). Most explicit; two rows on a
   page that has one tick today.
Recommend 1 with the sentence version of the review line, and one new board per
tick showing the result on `ac-account` (reminders On, reviews On) and on
`ac-account-new` (both Off). Check with the shop's lawyer before the review
sentence is final.

**H2 — `ac-contact`, `ac-account`, `ac-account-lower`: the On/Off buttons in "How
we contact you" have no name, and are not marked as switches.**
In `ac-contact` each of Service reminders, Review requests and Offers and news is a
`<button aria-pressed="true">` whose only content is "On" (or "Off"). The row's
label sits in a separate `<span>`. A screen reader reads "On, toggle button" three
times with nothing to say which is which. The same pop-up's Job updates choice
uses `role="radio"` correctly, and `ac-review-setting` uses `role="switch"` with a
label for the same kind of control, so this is the odd one out. "Changes save
straight away" is also silent: nothing announces that a switch changed. The
account summary card behind it (`Service reminders · On`) is plain text and fine.
*Why it matters:* this is the control decision 6 exists for, the customer's way
of turning off optional messages, and accessibility is Jack's first rule. A
customer using VoiceOver cannot tell which message they just switched off.
*Fix, choose how far:*
1. Name each switch ("Service reminders", from the row label) and give it
   `role="switch"` with `aria-checked`, the same markup as `rowSwitch()`. No visual
   change. Meets the labelled-controls rule.
2. As 1, plus a polite announcement when a switch changes ("Service reminders
   are off"), shown to everyone as a short line under the pop-up title for two
   seconds. Costs a small new element; makes "saves straight away" visible for
   everyone, not just screen-reader users.
Recommend 2. Use `switchRow` and `rowSwitch` from one shared function so the
shop and customer sides cannot drift apart again.

**H3 — `ac-delete-sent`, `ac-account`, `ac-today`: after asking to delete, the
account shows nothing, so the customer can ask again and cannot take it back.**
`ac-delete-sent` is a pop-up that closes on "OK". `accountPage()` has no pending
state: the page behind it is the ordinary page with "Ask us to delete your account"
still there as a link, and no banner, no date, no way to withdraw. The staff side
(Today) has the request; the customer does not see what they asked for once the
pop-up is gone, which in practice means a second request, or a call to the shop.
*Why it matters:* a deletion cannot be undone ("This can't be undone" in
`ac-delete`), and a customer who changes their mind in the next hour has no
visible way to stop it.
*Fix:* draw one board, `ac-account-delete-pending`: a banner at the top of the
account in the same style as `ac-download`, with a warning icon rather than a tick:
"You asked us to delete your account on [date]. We'll finish by [date].", with a
"Cancel my request" button; in the "Your data" card the delete link is replaced by
the same line. "Cancel my request" is one click and says "Request cancelled" in
the same banner. Staff then see a withdrawn request on Today and the customer
page (see M11).
*Decision for Jack:* whether a customer can cancel.
1. Yes, until staff confirm. One click; the shop must check the request is still
   live before deleting.
2. No, ask them to call. Simplest build; a customer who changed their mind has to
   ring.
Recommend 1.

---

## Medium

**M1 — `ac-job-note`, `ac-job-note-sent`, `ac-job-note-answered`, `ac-ask`,
`ac-question`: the customer is told "we'll text you" whatever way they chose.**
Decision 3: each reply goes by the customer's chosen channel (text, WhatsApp or
email, decision 6). Every customer-side hint says text: "We'll reply here and text
you when we do", "The answer comes to your account, and we'll text you when it
does", "We'll text you when the shop replies", and "Sent. North Street Cycles will
reply here, and we'll text you when they do." Staff-side boards (`ac-inbox`) handle
this correctly: "Sent to Maya by text".
*Why it matters:* a customer who picked email is told to expect a text, and may
then not check their email. It is also the one sentence the customer reads right
before they leave the page.
*Fix:* "We'll reply here and [text / WhatsApp / email] you when we do", worked out
from the customer's choice. Where no way is known (a signed-out customer who
reached the page from a link), "We'll reply here and let you know when we do."
Draw nothing new; change the four strings.

**M2 — `ac-account`, `ac-account-lower`, `ac-account-new`, `ac-account-asked`: the
left column is about two screens tall, the two privacy sections are at the
bottom, and the history is left with a gap.**
At 1280 x 800 the first screen shows Your bikes, Store credit, and the top of Your
details. "How we contact you" starts about 820px down the column and "Your data"
about 1,060px (from `ac-account-lower`). The History card on the right ends at
about 650px, so on `ac-account-lower` the right half of the page is empty while
the left keeps going. The page has no way to jump to a section, and the new-account
board (`ac-account-new`) is the same shape.
*Why it matters:* decisions 4 and 6 are about letting the customer control their
messages and data, and the account page is the one place they do it. Both sit
where a customer has to scroll to find them, and the space beside them is unused.
*Fix, choose how far:*
1. Leave the layout. Add a "Jump to" row under the title ("Your bikes · Your
   details · How we contact you · Your data") of plain links. No redesign; one
   more row on a page that has plenty; solves finding them, not the gap.
2. Merge "Your details" and "How we contact you" into one card with two parts
   (details first, then the four rows), and move "Your data" to a one-line card
   under History on the right. Left column about 300px shorter, both sections
   within one scroll, the right half no longer empty. Costs a redraw of three
   boards.
3. Make the left column stick while the history scrolls. Keeps everything where
   it is; on a short laptop the sticky column would be taller than the screen and
   cut off.
Recommend 2. Decision 1 puts "their details and how they get updates" on the left;
this keeps that, and puts "Your data" with the history it lets them download.

**M3 — `ac-account-asked`, `ac-job-note-answered`, `ac-account`: job notes are not
in the history, and every question reads "Your question".**
Decision 3: both the job's conversation and "Ask the shop a question" "show in the
account history". `history()` only draws a "Message · Your question" row. A note
on WH-1042 has no row, so Maya can find it only from the job's page. The row's
title is a fixed "Your question", so after two questions the history reads "Your
question", "Your question". It also sits under "Now" even once answered, with no
date other than `[date]`.
*Why it matters:* the history is the one page the customer uses to find
something again; a conversation with no row there is lost.
*Fix:* draw a "Message" row for a job note ("Note on WH-1042 · [date] · North
Street Cycles replied" with "Replied" or "Sent" chip, opening the job page at the
Notes card) and title questions with their first line (`[Maya's question]`,
cut to one line). Move answered messages to "Earlier" when the customer has read
the reply; keep "Now" for something waiting. One new board
(`ac-account-job-note`) or add the row to `ac-account-asked`.

**M4 — `ac-account`, `ac-account-repairs`, `ac-job-note*`, `ac-today`: one job,
three status names, and Today disagrees with the account.**
`ac-account` shows WH-1042 as "In the workshop" (blue chip) and "In the shop now"
on the bike. The job's own page (`ac-job-note*`) shows the four-step tracker
"Booked · In the shop · Being worked on · Ready" with "In the shop" current. So the
customer is told "In the workshop" in one place and "In the shop" in the other, and
"Being worked on" is a third step name. `ac-today` lists the same WH-1042 under
"Still to arrive" with a "Book in" button, while the account (same example,
same canvas) has the bike in the shop.
*Why it matters:* the customer follows the history row to the job page and is
asked to compare two names. The Today line is the same inconsistency journey 4's
audit raised (M3) and the journey 7 board inherits it.
*Fix:* use the tracker's four words as the chip ("In the shop", then "Being worked
on", "Ready"), so the chip is the tracker's current step; and on `ac-today` (and
the bike line "In the shop now"), draw WH-1042 as arrived: "In the shop" in the
expected list, no "Book in". No new boards.

**M5 — `ac-stopped`: "Sign in to your account" is not a link, only one kind of
"Stop these" is drawn, and turning it back on is not shown.**
The page confirms in plain words and says what still arrives, as decision 6
requires. Below the button, "Want to change anything else? Sign in to your account
— 'How we contact you'." is plain text (the source has no `<a>`), so the next step
for a customer who wants to change something else has no way to take it. Only
"Service reminders stopped" is drawn; review requests and offers each end with
their own "Stop these" and there is no board for how they read. "Turn them back
on" has no result (is it one click, and what does the page say after?). The page
itself has no mention of whose shop it is beyond the header.
*Why it matters:* this is the one page a customer can reach without signing in, so
it has to work on its own.
*Fix:* make "Sign in to your account" a link (44px, same style as "Show more").
Draw the page once with the generic form ("[Review requests] stopped", "We won't
send you [review requests] any more…") and one board for "Turned back on" ("Service
reminders are on again. Stop these any time with the link at the end of each
one."). Keep the heading as the status message; it already is.

**M6 — `ac-ask`, `ac-receipt`, `ac-review-setting`, `ac-inbox`, `ac-download`:
states that follow an action are missing.**
- `ac-ask`: only the empty pop-up is drawn. After "Send question" nothing says it
  went, and the account behind it does not show the "Sent" row (`ac-account-asked`
  shows the answered version only). The job's page does draw its "sent" state.
- `ac-receipt`: "Email it to me" and "Download (PDF)" have no result.
- `ac-review-setting`: the switch is drawn On with every field filled. The first
  time a shop opens it the switch is Off (decision 5: off by default) and the
  review page is empty; switching On with an empty page is not covered, and the
  Messages row (`ac-messages`) shows "Off" with an "Edit wording" link that opens
  this.
- `ac-inbox`: no board for "Needs a reply" with nothing in it, which is how staff
  will see it most days.
*Why it matters:* the happy path is drawn; the moments a person is unsure whether
something worked are not.
*Fix:* draw four small states, reusing the pieces already on the canvas: the
account after "Send question" (the "Sent" row and the green status bar of
`ac-job-note-sent`), a green line on the receipt pop-up ("Sent to
maya@example.test"), the review pop-up with the switch Off and fields empty, and
the inbox with "Nothing needs a reply. All conversations are under All." If the
review page is empty, the switch cannot go On: "Add your review page first."

**M7 — `ac-inbox`, `ac-inbox-all`: a conversation that needs a reply is marked by
a purple dot and nothing else.**
In the list each row's state is an 8px purple dot (`aria-hidden`) before the last
line. On "Needs a reply" every row has one, so it adds nothing. On "All" the dot
is the only thing separating a waiting conversation from a finished one, and
nothing in the row says it in words; "You:" before the last line is the only text
clue, for answered ones. The colour is the shop's purple used elsewhere for
"waiting".
*Why it matters:* colour alone, and invisible to a screen reader. Accessibility
is the first rule.
*Fix:* on `All`, put the words "Needs a reply" in the row (13px, in place of the
dot or after it), and put the dot back in the accessible name ("Needs a reply:
Maya Patel, ...").

**M8 — `ac-reminder-wording`, `ac-review-setting`: the box lets the shop delete
"Stop these", and the buttons beneath it do not fit the message.**
Both wording boxes contain "Stop these: [Link to stop]" as ordinary text, and a
note says "'Stop these' is always added at the end, and can't be taken off". If it
is in the box, the shop can delete it; if it is added after, the box and the
preview should not show it twice. The buttons under the box ("+ Customer's first
name, + Bike, + Job number, + Amount to pay, + Link to the job, + Shop name, +
Opening hours") are the same seven as for "Order ready to collect": the reminder
has no job and no amount, and the two links it needs ("Link to book", "Link to
stop") have no button. "Go back to Wheelhouse's wording" is clear, but this dialog
has Done only and no Cancel, while `ac-review-setting` has Cancel and Save.
*Why it matters:* the one-click stop is a promise to the customer (decision 6) and
the wording box can break it.
*Fix:* take "Stop these: [Link to stop]" out of the editable text and show it as a
fixed grey line under the box ("Always added: Stop these: [link]"); show only the
buttons that fit (first name, bike, service, shop name, link to book); give both
dialogs Cancel and Save/Done together.

**M9 — `ac-account`, `ac-account-lower`: "Edit" and "Change" cannot be told apart
by a screen reader, and actions are marked as links.**
The card links read "Edit" and "Change" (`<a href="#">`), so a list of the page's
links reads "Edit, Change, Show more", with no hint of which part. They are 44px
high but only about 28-45px wide (the visible word). "Download a copy of your
data" and "Ask us to delete your account" are links too, but one starts a file
download and the other opens a pop-up.
*Why it matters:* screen-reader users move through links by list, and a link that
opens a pop-up announced as a page is a surprise.
*Fix:* name each link ("Edit your details", "Change how we contact you") with
`aria-label` (the visible words stay), pad the visible tap area to at least 44px
wide, and make the download and delete rows buttons. No visual change. (Delete can
stay a link if it opens a page; it does not.)

**M10 — `ac-job-note-sent`, `ac-question`, `ac-ask`, `ac-delete-sent`: "sent" and
"saved" messages are not announced.**
`ac-job-note-sent` shows "Sent. North Street Cycles will reply here…" as a plain
`<p>`. Only the staff reply (`ac-inbox-sent`, `role="status"`), the download banner
and the stop page heading are announced. A customer who sends a note with a screen
reader hears nothing, and the textarea is emptied.
*Why it matters:* screen-reader announcements are in Jack's rules for every
journey.
*Fix:* `role="status"` on the "Sent" line and on the pop-up's result line; focus
returns to the new message in the thread.

**M11 — `ac-today`, `ac-privacy-requests`: the staff side of deletion cannot say
where a request came from or what blocks it.**
`ac-today` says "[Customer name] asked us to delete their account · From their
account on the website". `ac-privacy-requests` lists the same request as "Delete
their details" with the red button, no source and no blocker. Decision 4: the
blocker ("We can delete your account once your bike has been collected") is shown
to the customer up front; staff are not shown it. The red button is the same for a
customer with a bike in the shop. The customer page (decision 4: "shown on Today
and the customer page") is not drawn.
*Why it matters:* the button deletes someone's details, and staff are the last
check.
*Fix:* add the source ("From their account") and the blocker to both rows ("Bike
still in: WH-1042", "Store credit £[credit]"), disable the red button with the
reason, and draw the request on the customer page (one line under the summary:
"Asked to delete their account on [date] · answer by [date]").

**M12 — `ac-delete`, `ac-delete-blocked`: store credit is shown as a blocker
without being named as one.**
`ac-delete-blocked` leads with "We can delete your account once your bike has been
collected." then lists "Bike with us" and "Store credit £[credit] — use it or ask
for it back". The title says one thing blocks it; the list shows two. `ac-delete`
(no bike) says nothing about credit, so a customer with £[credit] can ask to
delete and lose it. Neither pop-up says what happens to the credit.
*Why it matters:* money the shop owes the customer, and the one thing in this
flow that is not undone by a copy of their data.
*Fix, choose:*
1. Credit blocks too. The pop-up leads with "We can delete your account once your
   bike has been collected and your store credit is used or paid back." Simple;
   some customers will be stuck with a small balance.
2. Credit does not block, but is named in `ac-delete`: "You have £[credit] of
   store credit. It will be lost when your account is deleted." Fewer blocked
   customers; the customer chooses.
Recommend 2 for the customer, and tell staff on the customer page when credit is
being deleted (M11).

---

## Low

**L1 — `ac-receipt`: "Download (PDF)" and "Email it to me" are not in plain
English or tied to the receipt.**
"PDF" is jargon for a bike-shop customer. "Email it to me" does not say which
address. Repair rows show no "receipt" word in the history (only the shop and
online purchases do), so a customer looking for their repair receipt does not know
whether it exists.
*Fix:* "Download receipt" and "Email me this receipt (maya@example.test)"; add
"· receipt" to the repair rows or say once at the top of History "Tap a row for
its receipt".

**L2 — `ac-account`, `ac-question`, `ac-stopped`, `ac-download`: the header does
not show where you are.**
`siteDesktop('sand', 'Account', ...)` is called, but no link is underlined and no
link has `aria-current`, so "Account" is not marked on any account board. The job
page boards underline "Book a repair" and carry `aria-current`. The account link's
visible word is "Account" while its accessible name is "Your account"; the visible
text is inside the name, so this passes, but the two read differently.
*Fix:* underline "Account" and add `aria-current="page"` on every board of the
account (and its question page); call it "Your account" in both.

**L3 — `ac-delete`: "This can't be undone" is in the middle of grey 14px text.**
The warning is the last words of the second paragraph, in muted grey.
*Fix:* its own line, ink colour, 15px: "This can't be undone." above the buttons.
"Ask to delete" stays the red outline button; "Keep my account" stays on the left.

**L4 — `ac-reminder-landing`, `ac-account`: the link does not say why bike and
service are chosen, and the bike is named two ways.**
The board is the ordinary "When?" step with step 1 and 2 scrolled off, so nothing
on it says "this is your reminder". The bike here is "Trek Domane AL 3 · green"; on
the account it is "Trek Domane AL 3 · green · black mudguards".
*Fix:* a line above step 3, "Booking a Standard service for your Trek Domane AL 3.
Change", and use the account's full bike name on every board.

**L5 — `ac-collect-remind`: the tick says "the way you chose above" and nothing is
above it.**
`remindBox()` is shared with the booking page, where "Send me updates by" is
directly above. On the ready page the tick sits under the pay button.
*Fix:* "One message, the way you chose when you booked. Stop any time." on the
ready page, or "[by text]" worked out from the choice.

**L6 — `ac-messages`: "Edit" and "Edit wording" are used for rows that open the
same kind of pop-up.**
Service reminder says "Edit" and opens its wording (and the "set on each service"
line). Review request says "Edit wording" but the pop-up also holds the review
page, the switch and the days. Both say "Customer's choice".
*Fix:* "Edit" on both, matching every other row.

**L7 — `ac-inbox-sent`, `ac-reply-text`: after replying, there is no way to reply
again, and "What Maya gets" has no visible way in.**
The reply box is replaced by the green bar. `ac-reply-text` is a pop-up with no
button on the board that opens it.
*Fix:* keep a short reply box under the bar ("Reply again") and put "See the text
Maya gets" as a link in the bar.

**L8 — `ac-today`: two different counts of "2".**
"Needs attention · 2" lists two rows, one of which reads "Needs a reply · 2" (two
messages). Both numbers are right and mean different things.
*Fix:* "Needs attention" without the count, or "2 messages need a reply" in the row.

**L9 — `ac-download`: the banner does not say what or where.**
"Your data is downloading — details, bikes, jobs, purchases, messages and what you
agreed to." gives no file name or type, and no failed state.
*Fix:* add the file name ("maya-patel-data.zip") and "Check your Downloads" if it
does not start; draw a failure line once.

**L10 — `ac-account`: nothing says when the bike's next service is due.**
Decision 2: customers can switch the reminder off from their account, which they
can, but the bike card never says "Next service due [date]" so the customer cannot
see what the reminder is for.
*Fix:* a line on the bike card: "Next service due [date]" (hidden when there is no
reminder time or the customer has switched it off).

---

## Answers to the specific questions

- **Decision 1, one account page:** carried out; shape, "Now" and "Earlier", filters
  and 60px rows are right. Gaps: layout length (M2), job notes missing from the
  history (M3), status names (M4), the header (L2), the bike's next service (L10).
- **Decision 2, reminders:** the service dialog and wording are clear. Gaps: the
  tick is pre-ticked (H1), the ready-page sentence (L5), the reminder wording box
  (M8), the landing line (L4).
- **Decision 3, conversations:** the thread and sent states read well. Gaps: "text
  you" for every channel (M1), history (M3), announcements (M10), missing ask state
  (M6).
- **Decision 4, your data:** instant copy and blocked pop-up are clear. Gaps: no
  pending state (H3), credit (M12), staff side (M11), banner detail (L9).
- **Decision 5, review requests:** off by default and "same link for everyone" are
  in the pop-up. Gaps: no customer yes (H1), first-time state (M6).
- **Decision 6, how we contact you:** one section as drawn. Gaps: unnamed switches
  (H2), stop page (M5), wording box (M8).
- **Decision 7, inbox:** two panes and the reply line as drawn. Gaps: dot only (M7),
  follow-up and preview (L7), empty state (M6).
- **Keyboard and screen reader:** H2, M7, M9, M10. Good: dialogs have role, label
  and Close; headings run h1, h2, h3; the history filter is a pressed-state group;
  the job thread is a labelled list; the staff list has `aria-current`.
- **Touch targets:** every button, pill and row on the customer side is 44px or
  more; links are 44px high but narrow (M9).
- **Wording:** M1, M12, L1, L3, L5, L6. Plain English is kept throughout; "PDF" is
  the one piece of jargon.
- **Data across boards:** Maya Patel, 07700 900 142, maya@example.test, WH-1042,
  Jo Taylor and North Street Cycles agree on every board where they appear. The
  bike's colour text differs (L4) and WH-1042's status differs (M4).
- **Fewest clicks:** tick at booking and at collection, stop in one click, download
  instantly, reply in one pop-up. Costs to cut: the extra tap if the tick is
  unticked (H1, accepted), nothing else on the customer side.

---

## Summary of what to decide

1. Whether the reminder tick starts unticked, and where customers say yes to review
   requests (H1, options 1-3).
2. Whether switches announce a change on screen as well (H2, options 1-2).
3. Whether a customer can cancel a deletion request (H3, options 1-2).
4. How the account page is arranged (M2, options 1-3).
5. Whether store credit blocks deletion (M12, options 1-2).

Nothing here changes a decision. The rest (the missing states in H3, M3, M5, M6
and M11, and the wording, markup and Lows) need only a yes from Jack. No file
other than this one was edited.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | book-remind, collect-remind, review-setting, messages, contact, account-new | The reminder yes is pre-ticked and the review yes is never drawn | Yes (option 1-3) |
| H2 | contact, account, account-lower | The On/Off buttons have no name and are not switches | Yes (option 1-2) |
| H3 | delete-sent, account, today | A deletion request leaves no trace on the account and cannot be cancelled | Yes (option 1-2) |
| M1 | job-note, job-note-sent, job-note-answered, ask, question | Customer is told "we'll text you" whatever they chose | Yes |
| M2 | account, account-lower, account-new, account-asked | Left column two screens tall, privacy sections at the bottom | Yes (option 1-3) |
| M3 | account-asked, job-note-answered, account | Job notes not in the history; every question is "Your question" | Yes |
| M4 | account, account-repairs, job-note, today | Three status names for one job; Today says not yet arrived | Yes |
| M5 | stopped | "Sign in" is not a link; one kind drawn; turn-back-on not drawn | Yes |
| M6 | ask, receipt, review-setting, inbox, download | Missing states after sending, emailing, first setup, nothing to answer | Yes |
| M7 | inbox, inbox-all | Needs a reply shown by a dot only | Yes |
| M8 | reminder-wording, review-setting | "Stop these" can be deleted; wrong buttons; Cancel missing | Yes |
| M9 | account, account-lower | "Edit" and "Change" unnamed; actions marked as links | Yes |
| M10 | job-note-sent, question, ask, delete-sent | "Sent" is not announced | Yes |
| M11 | today, privacy-requests | Staff cannot see source or blocker of a deletion | Yes |
| M12 | delete, delete-blocked | Store credit shown as a blocker without being named | Yes (option 1-2) |
| L1 | receipt | "PDF", unaddressed email, no repair receipt word | Yes |
| L2 | account, question, stopped, download | Header does not show Account | Yes |
| L3 | delete | "This can't be undone" is buried | Yes |
| L4 | reminder-landing, account | No "why" line; bike named two ways | Yes |
| L5 | collect-remind | "The way you chose above" with nothing above | Yes |
| L6 | messages | "Edit" and "Edit wording" | Yes |
| L7 | inbox-sent, reply-text | No follow-up reply; preview has no way in | Yes |
| L8 | today | Two different "2" counts | Yes |
| L9 | download | Banner has no file name or failure | Yes |
| L10 | account | No next-service-due line on the bike | Yes |

## Verification (1 Oct 2026)

Checked by reading: all 32 renders; `account.mjs`, `settings-frame.mjs`
`remindBox`, `collect.mjs` line 72 and `book.mjs` lines 204-207; the rendered HTML of
`ac-account`, `ac-contact`, `ac-job-note-sent`, `ac-inbox-all`, `ac-stopped`,
`ac-review-setting`, `ac-messages` and `ac-collect-remind` for roles, labels, headings
and state attributes. Not checked: tablet and phone; keyboard order and focus
(nothing run in a browser); a screen reader; contrast beyond hand calculation of
`#6E6752` on `#FFFDF7` (about 5.5:1) and on `#F0EADC` (about 4.7:1). ICO source for
H1: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/

Re-checked in the main session (1 Oct 2026) against the built files: H1 — the
booking tick is drawn `checked`; H2 — the contact pop-up's On/Off controls are
`aria-pressed` buttons whose only text is "On"/"Off"; M4 — `ac-today` still lists
"WH-1042 · Maya Patel" under Still to arrive with "Book in". All three confirmed.
M1 is right as a rule, though Maya herself chose text, so her boards' words are
correct for her.
