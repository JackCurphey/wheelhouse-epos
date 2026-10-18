# Decided while building

Gaps the drawings and decisions didn't cover, decided while drawing or
building so the work could carry on (project `CLAUDE.md`, "Where things
live"). Each entry gives the screen id, what was decided and the pattern it
followed. Jack can overrule any of them; nothing here reopens a recorded
decision.

From the Release 2 build on, Mark's sessions append under "Mark's lane" and
Jack's under "Jack's lane", so the two never edit the same spot (split plan
§5). Everything before the build stays where it is, below.

## Mark's lane

### 5 Oct 2026: WP-0.2 server half, the booking bugs

1. **A retry gets the same private link as the first reply.** For a
   booking sent with a request key, the link is worked out from the key, so
   the server can send it again without storing it. Only its hash is kept,
   as for every link. The key must therefore be at least 32 characters.
   Issuing a new link on every replay was tried first and dropped: a slow
   first request replaying late would replace the link the customer had
   just been given. *Pattern:* the link's existing hash-only storage
   (`server/booking-link.js`).
2. **The request key is optional for now.** Today's booking screens don't
   send one. Making it required would break them until Jack's half merges.
   Once it has, the key can become required in a follow-up.
3. **On a website, another shop's `/book/<slug>` gets "Storefront not
   found"**, the same 404 as an unknown website, so nothing reveals that the
   other shop exists. *Pattern:* the dispatcher's existing answer for an
   unknown or switched-off website.
4. **Found, not fixed: on a website address `/api/portal/*` returns the
   website's HTML**, so the booking app served there can't reach the booking
   API. No website is live and hosting isn't chosen, so this is left for
   WP-0.5 or the website stage.

## Jack's lane

### 4 Oct 2026: diary piece 5b, as drawn (follow-up to pull request 112)

1. **`diary-stack-open`: which tiles a computer and a tablet get.** The
   drawings show the small tiles (bike; work · start) on a computer and the
   touch tiles (bike; work; number · start–end) on a tablet. The app can't
   tell a tablet from a computer by size alone, so a **tap** on a stack gets
   the touch tiles and a click or Enter gets the small ones. *Pattern:* the
   diary already tells touch from mouse by how the press started (press and
   hold, the touch menu tip).
2. **The chooser box opens above the stack when there's no room below.**
   Not drawn (the drawing's stack sits high on the board). *Pattern:* the
   job menu keeps itself on screen the same way.
3. **A tapped-open fan's tiles show number and times**, as the touch tiles
   do; a mouse-hover fan keeps the drawn number only (`fanTile`).

### 4 Oct 2026: diary piece 5b (pull request 112), after its fresh review

1. **`diary-stack-open`: each chooser tile answers M (move with the arrow
   keys) and the Menu key (Job actions)**, and its name ends with the job's
   state. Not drawn; it keeps the spec's promise that dragging is never the
   only way, which stacking had broken for keyboard and screen-reader users.
   *Pattern:* the same keys as a job block (`diary-move-hint`).
2. **A stacked job being moved by keyboard leaves its stack and takes focus;
   when the move ends, focus goes back to the stack.** *Pattern:* "a job
   being moved leaves its stack" (already built for dragging).
3. **`diary-stack-hover` on touch: press and hold fans the stack out**, as
   drawn (`touchStackBlock`); a tap elsewhere folds it. The tap that ends
   the hold doesn't also open the chooser.

### 4 Oct 2026: till piece 1 (pull request 111), after its fresh review

1. **`till-pay`: the message when the reply to a payment is lost** reads
   "Lost touch with the server, so the sale may have saved. Check the sale
   went through before taking payment again." Was "Couldn't reach the
   server — nothing was saved. Try again.", which wasn't true when the
   server had saved before the connection dropped, and "Try again" then
   sold it twice. *Pattern:* the drawings have no lost-reply state for the
   till yet; the offline till (WP-1.6) replaces this with a proper one.
2. **`till-pay`: while a payment is saving, Escape doesn't close the
   window**, and each step moves keyboard focus to its title. Not drawn;
   follows the accessibility-first rule and the dialog's own Escape
   handling.

### 5 Oct 2026: WP-0.2 screens half, the booking bugs

1. **`details`: Back while "Sending…" doesn't stop the booking.** The
   Back link stays as drawn; if the booking is made after the customer has
   gone back, the app takes them to its private link from whichever booking
   screen they're on, and clears the draft. If it fails after they've gone
   back, nothing is shown and their answers are kept, so pressing Request
   booking again sends the same request key. *Pattern:* success already
   replaces the details screen with the private link.
2. **`details`: the same request key sent again with different details**
   (a lost reply, then the customer changed something and sent again) shows
   the server's own words on the details screen, "This booking was already
   sent with different details". Not drawn. *Pattern:* any other refusal
   with the server's own message is shown as is (d5). It repeats on every
   try, because the key stays (a new key would make a second booking), and
   the booking was most likely made, but the customer has no link to it. A
   clearer customer message, with the shop's contact, is for Jack to word.

### 15 Oct 2026: the change request pop-up (pull request 193)

1. **`request-change`: a side with no mechanic reads "Shared queue".** The
   pop-up now names the mechanic on its From and To sides (Jack, 8 Oct,
   `2026-10-08-diary-fixes.md` item 2), but a customer can ask for no
   mechanic, and the drawing doesn't say what that side shows. *Pattern:*
   the job page reads "Shared queue" for a job with no mechanic.

### 15 Oct 2026: the hosted copy's test shop (WP-0.5, tasks group 1)

The drawings' values, and where each comes from, are listed in
`openspec/changes/add-hosted-copy/design.md` (decision 7). Where they were
silent:

1. **Services drawn "[£ price]" are £0.00.** Safety check, Gear adjustment,
   Brake service and Gear service have no price in the drawings, and a price
   can't hold a placeholder. *Pattern:* a product added without a price is
   £0.00 too (the products table's default). *Jack kept this, 16 Oct
   (`2026-10-16-test-shop-defaults.md`).*
2. **Jobs keep the drawn week, Mon 14 to Sun 20 September 2026.** That week
   is in the past now, so the app carries unfinished jobs on by itself: some
   read "Day 1 of 2" on the next day. *Pattern:* the drawings, as drawn.
   *Overruled by Jack, 16 Oct: the week moves to the week the shop is
   loaded (`2026-10-16-test-shop-defaults.md`).*
3. **The change request keeps its own mechanic.** The drawing's dashed 14:00
   names none. *Pattern:* accepting keeps the same work (the pop-up's
   sentence).
4. **Working days stay at every day.** Owner setup draws Jo Taylor in the
   workshop Tue, Wed and Sat, but the diary week gives her jobs on Mon, Thu
   and Fri too. *Pattern:* the diary, since its jobs are what the copy is
   for.
5. **Waiting for you's three items arrive when the shop is loaded,** a
   second apart, in the drawn order: Sam Reed's request, Oliver Chen's
   change, Aisha Khan's cancellation. The drawings give the order, not the
   times. Sam Reed's request has no booking link. *Pattern:* the drawn order.
6. **WH-1046, with no time, is on Thu 17 Sep,** the drawings' "today". It is
   drawn on every week's no-time row, and a job needs a day. *Pattern:* the
   drawings' today.
7. **No tills, and no Sam Reid.** A till's sign-in belongs to the device that
   sets it up, so B1 is made through "Set up this till". "Sam Reid" on the
   till check-in is left out: the Saturday worker has no name yet
   (`personas.md:122`).

### 15 Oct 2026: the diary's No time row and Waiting cards (issue 192)

1. **`diary`: Enter on a chosen Waiting card only chooses it.** Decision 14
   says a second tap opens it on a touch screen, and says nothing about the
   keyboard; Enter or Open, or a double-click, open it as before. *Pattern:*
   a stack, where "a click from the keyboard is never a tap". A pen counts as
   a mouse, as it does for a stack.
2. **`diary`: the No time chip is the drawn tablet size** (at least 24px
   tall, 12px text, with a border), now that it can be tapped. *Pattern:*
   `unschedRow` in the drawing.

### 15 Oct 2026: New job's "Enter a time instead" (issue 192)

1. **`new-job-entered`: the mechanic stays as pills**, as on every built New
   job form since piece 5a (decision 18), where the drawings show a line,
   "Mechanic: [name]", and "drag the job to another mechanic". *Pattern:*
   the built form.
2. **`new-job`: "Mechanic chosen automatically" goes once staff pick a
   mechanic themselves**, on a grid click too, since it no longer says who
   chose. *Pattern:* the note's own wording.
3. **`new-job`: a job that would run past midnight is refused in plain
   words** ("The job would run past midnight. Choose an earlier start
   time."), not the server's "End time must be in HH:MM format". *Pattern:*
   the form's other refusals.

### 15 Oct 2026: the job page's plain refusals (issue 190, decision 2)

1. **`job-*`: a refused move says where the job is**, one sentence per
   state: "The bike isn't here yet.", "The bike is already here.", "The bike
   has already been collected.", "The work hasn't started yet.", "The work
   has already started.", "The job is waiting for parts.", "The job is on
   hold.", "The work is already finished.", "This is still a booking
   request. Accept it first.", "The booking is already confirmed.", "The
   customer has asked to change this booking. Answer their request first.",
   "This booking was declined.", "This booking expired.", "This booking was
   cancelled." *Pattern:* the request pop-up's refusal words.
2. **`job-*`: a refused quote action** reads "This quote [has been sent /
   has been approved / …], so it can't be [changed / sent / withdrawn].",
   and a sent quote that can't be changed reads "This quote has been sent.
   Withdraw it before changing it." An answer the customer gave first reads
   "This quote has been approved, so it can't be answered." or "This quote
   has already been answered." *Pattern:* Jack's example of 15 Oct.
3. **`job-*`: a cancelled, declined or expired booking's page** can't be
   booked in ("Bike is here" is off and fixed) and has no Add another day,
   as a booking request can't. *Pattern:* the booking request.

### 15 Oct 2026: the other refusals in plain words (issue 190 C, the rest)

1. **`job-*`: work and parts refusals** read "This job has been paid for,
   so its work and parts can't change.", "This job's order was cancelled,
   so its work and parts can't change.", "That service is no longer
   offered. Choose another.", "The work needs a description.", "The work
   needs a price of £0.00 or more.", "The work needs a time of at least 1
   minute.", "Each part needs a quantity of 1 or more.", "That product is
   no longer sold. Choose another." and "This job's order no longer
   exists." *Pattern:* the job page's plain refusals, 15 Oct.
2. **`job-*`: adding or removing a day** reads "That day has already been
   removed." for a day that has gone, and "This job no longer exists." for
   a deleted job. *Pattern:* the request pop-up's "This job no longer
   exists."
3. **`diary`: dropping finished work** reads "Couldn't move [bike]: The
   work is already finished. Reopen the job to change it." *Pattern:* the
   notes box's "Reopen the job to change its notes." Dropping onto a
   mechanic who has just been made inactive reads "That mechanic is no
   longer working here. Choose another."
4. Refusals the server already words in plain English (the diary's rule
   refusals, "A job's first day can't be removed") still show as sent.
### 15 Oct 2026: New job's "won't fit" warning (decision 23, issue 192)

1. **`new-job`: no warning for the Shared queue**, which has no free time of
   its own to compare with. *Pattern:* the server's capacity answer, which
   gives the queue only a total.
2. **`new-job`: a start inside busy time reads "No free time at [time] —
   this job needs [m]. …"** rather than "Only 0 minutes free". *Pattern:*
   the drawn warning's own wording.
3. **`new-job`: "Find the next free [m] minutes" looks 60 days ahead**, and
   with nothing found says "[mechanic] has no free [m] minutes in the next
   60 days." *Pattern:* Add another day's 60 days.
4. **`new-job`: the found time is on the quarter hour**, as a grid click
   snaps to 15 minutes.
5. **`new-job`: a failed search reads "Couldn't find free time — try
   again."** *Pattern:* the form's "Couldn't reach the server — try again."

### 15 Oct 2026: a change request into another week (decision 19, issue 192)

1. **`change-selected`: in a week without the booking, a screen reader
   hears "[customer] asks to move here: [time]"**, as "Waiting for you"
   gives no bike. *Pattern:* the card, which names the customer.
2. **`change-selected`: the chosen request's outline is marked** with the
   chosen block's highlight, and a screen reader hears ", chosen from
   Waiting for you"; with it on screen the booking's own block takes the
   drawing's light grey ring. *Pattern:* the drawing's change-selected;
   decision 19's "highlights the time the customer wants".
3. **`diary`: a job over several days shows its requested time once**, from
   its first day, rather than once per day. *Pattern:* the change request
   pop-up, which moves the booking as a whole.

### 18 Oct 2026: retiring the old diary (`docs/decisions/2026-10-18-retire-old-diary.md`)

1. **The old app's Workshop tab stays, and opens the new diary**, as does
   an old `#workshop` bookmark, rather than the tab going. *Pattern:* the
   old app has no other way into the new app; rule 5 replaces a screen, it
   doesn't strand the people using it.
2. **The old job form, opened from an order, loads the shop's mechanics
   itself**; it used to rely on the old diary having loaded them, so from an
   order its mechanic list was empty. Deleting a job there refreshes the
   orders list. *Pattern:* the order screen's own refresh
   (`refreshDocListAfterChange`).

### 18 Oct 2026: drawings of what only the old diary did (`docs/decisions/2026-10-18-old-diary-features.md`)

1. **`diary-month`: a booking request shows in the month**, purple, at its
   asked-for time (Sam Reed, Fri 18 Sep 10:00); clicking it opens the
   request's pop-up, and in the "+[n] more" list it reads "Booking request,
   no mechanic yet". *Pattern:* the week view's pending block (decision 12).
2. **`diary-shared-queue`: booking requests are not in the Shared queue**,
   which shows jobs with no mechanic; a request is not a job until it is
   accepted, and it stays in Waiting for you. *Pattern:* the week view shows
   requests in Everyone only (decision 12).
3. **Staff can't make a job "pending" in the new diary** (its starting
   statuses, drawn and built, have no Pending), so the old
   menu's "Approve" for a staff-made pending job has nothing to do; only
   the booking request's "Accept or decline" is drawn. *Pattern:* New job's
   starting status pills (decision 66; 3 Oct answer 11).

### 18 Oct 2026: stretching a job (`docs/decisions/2026-10-18-old-diary-features.md` answer 2)

1. **`diary-stretch`: with a mouse, the grip shows on hover**; the bottom
   8px of every job shown on its own stretches it. *Pattern:* decision 59's
   hover-to-widen; the drawing shows the grip on the job being stretched.
2. **A job in a stack has no edge**; its menu's "Change length" stretches
   it (it leaves the stack while it does). *Pattern:* moving a job from its
   stack's chooser.
3. **`diary-menu-job`: "Change length" is in the menu on a computer too**,
   so it can be done from the keyboard (the Menu key, then up and down,
   Enter, Escape), each step read out. *Pattern:* moving with M and the
   arrows; accessibility first.
4. **The times label sits inside the job in the week's last column and on
   a phone**, wrapping in a narrow column, so it doesn't run off the diary
   or over the times. *Pattern:* the phone drawing.
5. **While stretching, the job wears the chosen ring**, not the lifted look
   of a job being moved. *Pattern:* the three stretch drawings.
6. **A job stops at its own day's closing time**, though the grid may run
   later for another day. *Pattern:* the server's opening-hours check. On a day with no opening hours set (closed), it runs to the week's latest
   closing time, as the grid does.

### 18 Oct 2026: month view (`docs/decisions/2026-10-18-old-diary-features.md` answer 1)

1. **`diary-month`: a job with no time sits after the timed ones, reading
   "No time"** in place of its start. *Pattern:* the No time row.
2. **New job from the month goes to the Week view to choose a time**, as
   the month has no times to pick. *Pattern:* "Choose a time" (decision 22).
3. **The month's jobs can't be dragged or stretched**; they open. *Pattern:*
   the feature catalogue, CAL-05 ("month is click-to-open").
4. **A day with no jobs in its list says "No jobs this day."** *Pattern:*
   "Nothing waiting."
5. **The day's list names a job with no mechanic "Shared queue"**, where the
   drawing says "Booking request, no mechanic yet". *Pattern:* answer 5's
   Shared queue, the new app's word for jobs no mechanic has yet.
6. **On a touch screen the date has a 44px tap area** and still opens the
   Day view; the rest of the day is one button that opens its list.
   *Pattern:* decision 68; the drawing keeps the date as its own link.

### 18 Oct 2026: Change details (`docs/decisions/2026-10-18-old-diary-features.md` answer 3)

1. **Not offered for finished work**, which is frozen until reopened.
   *Pattern:* the notes, read-only on finished work (Jack, 15 Oct).
2. **A job over several days changes its title, customer, bike and day 1's
   mechanic here ("Mechanic, day 1"); each day's date and time, and later
   days' mechanics, are changed in the diary.** *Pattern:* moving a later
   day on its own (decision 52).
3. **A new customer's only bike is chosen for them**, and the old customer's
   bike is never sent. *Pattern:* New job.
4. **The customer is shown with "Change customer"**, which opens the same
   search as New job. *Pattern:* New job's chosen customer.
5. **A booking with a change request waiting shows no notice in Change
   details.** Saving exactly the requested day, start and mechanic accepts
   the request, as a diary drop does; any other save leaves it standing.
   *Pattern:* the diary's drop (Jack, 8 Oct). **Settled 18 Oct:** Jack
   chose a note (`2026-10-18-old-diary-features.md`, "A waiting change
   request in Change details").
6. **The note adds "with [mechanic]" when the request also moves the job to
   another mechanic**, as accepting it needs that mechanic too. *Pattern:*
   the change request pop-up's From and To, which name the mechanic.
7. **No note for a request for a drop-off day with no time**, and on a job
   over several days the note ends "Answer it from Waiting for you.", since
   its dates change in the diary and a save here can't accept it.
   *Pattern:* the several-days rule above (item 2).

### 18 Oct 2026: files and photos, and deleting a job (`docs/decisions/2026-10-18-attachments-and-delete.md`)

1. **"Remove" asks "Remove [file]?"**, "It is removed from this job. This
   can't be undone.", with "Keep it" and "Remove". *Pattern:* "Delete [job]?".
2. **"Settle up first" names only what applies**: "Refund what was paid —
   then delete.", "Hand the bike back — then delete.", or both as drawn.
   *Pattern:* the drawing's sentence, cut to the case.
3. **Money paid means the job's order has been paid** (deposits aren't taken
   yet; when they are, a deposit counts too). *Pattern:* the order's paid
   state, as the till shows it.
4. **A file other than a photo downloads under its own name**; a photo
   opens larger in a pop-up. *Pattern:* the server sends files to download.
5. **A quote, sent or answered, doesn't stop a delete**: with nothing paid
   and the bike not in, the job goes and its quote with it. *Pattern:*
   answer 1 names money paid and the bike in the shop, nothing else. For
   Jack to overrule if a sent quote should count as at stake.
6. **A paid job can't be deleted yet**, since the new app has no refund; the
   "Refund what was paid" step arrives with the till's refunds.

### 18 Oct 2026: paying a job's order at the till (`docs/decisions/2026-10-18-till-job-payment.md`)

1. **The till opened with a job shows only its locked lines**, with "To add
   anything to this job, add it in the job's Work and parts." and "Start a
   new sale instead", since paying the order charges its own saved lines.
   *Pattern:* till-job's locked lines; the drawing's extras wait for the
   till paying more than the order.
2. **"Bike collected when paid" shows only while the bike is in the shop.**
   *Pattern:* the server can only collect a bike that's in.
3. **"Open in the till" is greyed "Already paid" or "No order on this job"**
   besides the drawn "Not booked yet". *Pattern:* diary-menu-pending.
4. **On a tablet or phone the hold menu has "Open in the till" too.**
   *Pattern:* the same menu at touch sizes (diary-context-menu).
5. **Work not yet in progress or finished: "The work isn't finished, so
   this job can't be paid yet."** *Pattern:* the 8 Oct rule.
6. **A line the server won't sell (a retired service or part): "This job
   can't be paid here yet: [reason]. Change it in the job's Work and
   parts.", with Take payment greyed**, so the card is never taken first.
   Any refusal after the card step adds "No sale was recorded: if the card
   machine took the payment, reverse it on the machine." *Pattern:* the
   work-not-finished message and its reversal advice (fresh re-review).

## Decided here, for Jack to overrule

### 4 Oct 2026: drawing the coverage walks

From `docs/superpowers/specs/2026-10-04-draw-the-coverage-walks.md`
("Left for Jack", item 1). The answers in
`docs/decisions/2026-10-04-coverage-walks.md` don't give this wording.

1. **`ws-page-moving`, `ws-page-switch-over`: the ready list reads "1 of 2" /
   "2 of 2"** (`generator/website.mjs` line 112; the situation lines in
   `generator/consolidate/j18.mjs` lines 16 and 20). Was "2 of 3" / "3 of 3".
   *Decided:* the payments item ("Payments connected, and the test payment
   worked") is taken out, leaving "Set up: the three steps" and the
   starting-wording item. *Pattern:* Website management, later change 3 Oct
   (walk-through 4 H3): "The website is ready" ticks on one rule, no Words and
   photos row says Check this; coverage walk 5 M2's fix keeps payments as
   their own row, not counted. The set-up item was left in, since it is always
   done when this page shows, rather than redesigning the box.
2. **`ac-delete-blocked`: "Keep my account" and "Ask to delete"** on the
   pop-up while the bike is still in (`generator/account.mjs` line 267). Was
   only "OK". *Decided:* the same two buttons, in the same order and styles,
   as the ordinary delete pop-up `ac-delete` (`generator/account.mjs` line
   274). "Call [shop phone] if you need to talk it through" stays from the old
   wording; "Ask again after that" goes. *Pattern:* answer 4 says "Ask to
   delete" is still there; the rest copies `ac-delete`.
3. **`cs-privacy`: the how-to under a hand-logged request's "Still in the
   way" reads "Take the payment and hand the bike back, then delete"**
   (`generator/consolidate/j15.mjs` line 42). *Decided:* the dropped "Settle
   up first" pop-up's how-to ("Take the payment, use or refund the credit,
   and hand the bike back — then delete", `generator/customer.mjs` line 259),
   without its store-credit part. *Pattern:* answer 5's option names that
   how-to as a line under the row; store credit doesn't block deletion
   (Account and reminders, audit M12; coverage walk 12 M1).
4. **`site-menu`, `site-ocean-menu`: no word on the open menu's ✕.**
   *Decided:* only the button that opens the website's phone menu gains
   "Menu"; the close button stays an ✕ named "Close menu" for screen readers.
   *Pattern:* answer 1 asks for "Menu" beside the three lines; the staff app's
   phone menu has no word on either button.
