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

### 18 Oct 2026: printing a receipt (`docs/decisions/2026-10-18-print-receipt.md`)

1. **Print receipt on a cancelled order is greyed "Order cancelled"**, besides
   the drawn "Not paid yet". *Pattern:* Open in the till's reasons.
2. **If the diary can't fetch the receipt: "Wheelhouse couldn't get this
   job's receipt to print. Try again in a moment."**, in the diary's message
   box. *Pattern:* the diary's move-refused message.
3. **Discount rows on the receipt read "Discount" and the customer group's
   name** (for example "Blue Light (10%)"), as the till's job basket shows
   them. *Pattern:* the till's discount rows (#267); the receipt email's
   "Discount · [reason]" waits for discount reasons.
4. **A part bought more than once reads "Shimano brake pads 2 × £28.00"**, as
   the receipt email's till-sale lines do. *Pattern:* `collect.mjs` tillLines.
5. **A tender the shop added (the old app's extra payments, for example a
   gift card) prints as "Paid by [its name]"**, so the payments add up to
   the total on a reprint. *Pattern:* "Paid by card" and "Paid by cash"
   (fresh review).

### 18 Oct 2026: the mechanic sign-off, piece 1 (`docs/decisions/2026-10-16-mechanic-sign-off.md`)

1. **"Who's signing this off?" on a tablet or phone is the same pop-up**, at
   the job page's pop-up sizes; only the computer size is drawn. *Pattern:*
   Change details and the other job page pop-ups.
2. **"Signed off by [name] · [day], [time]" sits in a strip under the
   customer strip**, since the built job page has no finished strip yet.
   *Pattern:* the drawing's place, under the finished strip.
3. **A job finished before the sign-off existed, or paid at the till, shows
   no "Signed off by" line.** *Pattern:* nothing shown that wasn't recorded.
4. **If the mechanics can't load: "Wheelhouse couldn't load the mechanics.
   Try again in a moment."**, and Sign off waits. *Pattern:* the job page's
   load messages.
5. **At the till the pop-up keeps "Sign off and mark ready"**, then the
   payment opens; Cancel takes nothing. *Pattern:* the decision's "uses the
   same pop-up" (answer 5).
6. **A sign-off that's no longer valid when the payment lands doesn't refuse
   it: "Paid and finished, but not signed off: that mechanic isn't active any
   more."** on Paid; the same for a till left open on finished work that was
   reopened meanwhile ("…the work was reopened while the till was open").
   *Pattern:* the till's job-changed warning (the card is taken first; #267).
7. **The first Settings page shows only Workshop › Mechanics' sign-off
   switch**, without the drawn area list or the other sections, until the
   rest of Settings is built (WP-5.1). Switching saves at once; if it can't:
   "Wheelhouse couldn't save that. Try again in a moment." *Pattern:* the
   drawn set-workshop-sign-off, cut to what's built.
8. **Today's booking link shows "Checked by [name]" as a line in its summary
   box**, since its drawn ready page (cp-summary) isn't built; ready or
   collected only. *Pattern:* cp-summary-checked's line.
9. **The till's receipt names the mechanic picked in its pop-up, or the
   job's sign-off if the work was already finished; a reply warning that it
   wasn't signed off names nobody.** *Pattern:* nothing shown that wasn't
   recorded.

### 18 Oct 2026: Shop details (`docs/decisions/2026-10-18-shop-details.md`)

1. **Each box saves when it's left, if it changed, and says "Saved."**; a
   failed save says "Wheelhouse couldn't save that. Try again in a moment."
   and keeps what was typed. No Undo yet. *Pattern:* the settings pages save
   as you go; the sign-off switch's messages.
2. **The email is kept but not printed**, since the receipt drawing doesn't
   show it. *Pattern:* till-receipt-paper-details.
3. **"Shop and sites" shows only Shop details** until opening hours and
   Sites are built (WP-5.1, WP-5.2). *Pattern:* the drawn page, cut to
   what's built, as Workshop on the same page.

### 19 Oct 2026: words at the bottom of receipts (`docs/decisions/2026-10-19-receipt-words.md`)

1. **With the shop's details also at the bottom, the words go after the VAT
   number and just above the barcode.** *Pattern:* set-till-receipts'
   preview, words directly above the barcode.
2. **"Till" on the Settings page shows only Receipts, with only the words**
   until the Paid box's choices and the other Till sections are built,
   and without the drawn live receipt preview beside it (printing a receipt
   shows the real thing). Saving works as in Shop details; the box stops at
   500 characters. *Pattern:* the drawn page, cut to what's built.

### 19 Oct 2026: opening hours in Settings (`docs/decisions/2026-10-19-opening-hours.md`)

1. **"Opening hours", not "Opening hours · Bolton"**, since they're one set
   for the whole business until sites. *Pattern:* Shop details' answer 1.
2. **The times are picked from whole hours (05:00 to 23:00)**, as the server
   and the diary need, where the drawing shows boxes. *Pattern:* the
   server's "Opening hours must be on the hour".
3. **A day turned Open starts at the shop's usual hours** (the opening and
   closing times the old app set). Each change saves at once; a time chosen
   while a save is on its way goes next, so the pickers stay usable; a
   refusal shows its words and the week goes back. *Pattern:* the server
   keeps a reopened day at the usual hours.
4. **Only the drawn note's second sentence shows** ("Online booking only
   offers mechanics on the days they're in, set on each person."), since
   End of day's Close the day isn't built. *Pattern:* nothing shown that
   isn't there.

### 19 Oct 2026: Settings for the Owner only (`docs/decisions/2026-10-19-owner-only-settings.md`)

1. **The not-part-of-your-role card for Settings reads "Settings aren't part
   of your role", "Only the shop's owner can change settings for now. Ask
   the owner if you need something changed.", and "Go to the till"**, since
   there are no Managers yet and a non-owner's landing page is the till.
   *Pattern:* auth-noaccess (Reports), its words fitted.

### 19 Oct 2026: telling the customer when to drop the bike off (`docs/decisions/2026-10-19-retire-old-workshop-settings.md` answers 3 and 7)

1. **The line shows once the booking stands (confirmed, or a change to it
   waiting), not while a request waits for the shop or once the bike is
   in.** *Pattern:* bk-confirmed shows it; the request pages don't.
2. **The lead reads "half an hour", "an hour", "an hour and a half", else
   "[n] hours" or "[n] minutes"; with none, "Drop your [bike] off at your
   booking time, [time]."; with no bike named, "bike".** *Pattern:*
   bk-confirmed's "half an hour before".
3. **A whole-day booking's page says "Drop your [bike] off between [from]
   and [to]."**, only when the shop books bikes in for the whole day; a
   set-time shop's job with no time gets no line. *Pattern:*
   bk-when-dropoff's words.
4. **"Drop off before the booking" shows only while bikes are booked in for
   a set time**, 0 to 240 whole minutes. *Pattern:* bk-settings-reserve,
   where it shows with A set time.
5. **bk-confirmed's second sentence ("Please bring the lock key, and tell
   us about any accessories.") isn't on the booking page yet**, since no
   shop setting holds it; only the drop-off line is built. *Pattern:*
   nothing shown that isn't the shop's own.

### 19 Oct 2026: notice in hours or days (answers 4 and 8)

1. **Hours are whole hours from 0 to 168, days whole days from 1 to 28
   (the booking page shows dates only to the end of next month);
   choosing the other unit saves the box's number in that unit**, and the
   note follows the unit chosen. *Pattern:* bk-settings-notice-days, and
   the server's existing notice limit of a week.
2. **Days count from the start of the day that many days after the shop's
   today, in the shop's time zone.** *Pattern:* Jack's 3pm-for-tomorrow
   example.

### 19 Oct 2026: switching between a set time and the whole day (answers 9 and 10)

1. **Changing to a set time reads "Book bikes in for a set time?", "Bookings
   already made keep their days. From that day, customers book a time and
   drop their bike off before it."**, and its coming-change line "…keep
   their days."; only the whole-day direction is drawn. *Pattern:*
   bk-settings-mode-change, turned round.
2. **The drop-off window shows once the whole day is the shop's mode**, as
   bk-settings-mode-scheduled draws it (not while the change is only
   coming; until then the shop's window, 09:00 to 10:00 to start, applies);
   times every half hour from 05:00 to 22:00. *Pattern:*
   bk-settings-whole-day and bk-settings-mode-scheduled.
3. **The day is picked with the device's own date picker, tomorrow at the
   earliest; the button reads "Change from…" and waits until a day is
   picked; changing the date of a coming change starts from the date
   already chosen.** *Pattern:*
   bk-settings-mode-change's date box.

### 19 Oct 2026: the additional note on the confirmation (`docs/decisions/2026-10-19-confirmation-note.md`)

1. **Every shop, new or already set up, starts with the drawn sentence**;
   emptying the box shows no note. *Pattern:* Jack's "starting with the
   drawn sentence"; the receipt words box, where empty prints nothing.
2. **Up to 300 characters, trimmed.** *Pattern:* the receipt words box's
   limit (500), shorter since it sits in a sentence on a phone.
3. **The note shows once the booking stands (confirmed, or a change to it
   waiting), also when there's no drop-off line**, not while a request waits
   or once the bike is in. *Pattern:* the drop-off line's own rule
   (19 Oct item 1 above).
4. **The box shows in both booking modes, after the drop-off row.**
   *Pattern:* bk-settings, where the drawing puts it.

### 19 Oct 2026: Preview what the customer sees (`docs/decisions/2026-10-19-booking-preview.md`)

1. **For a shop that books bikes in for the whole day, the preview says the
   drop-off window and its When row shows the day without a time.**
   *Pattern:* the booking page's own whole-day line (bk-when-dropoff).
2. **The preview shows saved settings; a note being typed saves as the box
   is left, which pressing Preview does first.** *Pattern:* "with your
   settings as they are now" in the drawing; the settings boxes save when left.
3. **The pop-up has the drawn ✕ and Close, and Escape closes it.**
   *Pattern:* the mode change pop-up.
4. **The preview draws the confirmed page as `bk-confirmed` draws it**
   ("Booking confirmed", "See you on…", Service, Bike, When), which the
   customer's booking page doesn't fully match yet: today it heads
   "Confirmed" and lists a reference and the services. The drop-off sentence
   and the note, what the preview is for, are the same on both. *Pattern:* the
   approved drawing; the two come together when bk-confirmed is built (fresh
   review).

### 19 Oct 2026: the confirmed booking page, to its drawing (Jack, 19 Oct: "1: the confirmed page's look and rows with the data the server already sends; the rest later")

1. **Only the confirmed stage takes the drawn layout**; waiting, change
   requested, in the workshop, ready, collected, cancelled, declined and
   expired keep the first release's page until their own pieces.
   *Pattern:* Jack's scope.
2. **The heading names the bike, else "Your bike", and the work: one
   service's name, "[first] and [n] more", or "Repair".** *Pattern:* bk-page's
   "Trek Domane AL 3 · Standard service".
3. **The Bike row is the make and model, then the customer's own words about
   the bike ("Trek Domane AL 3 · green"); the saved colour, the mechanic, Extra work, Deposit paid, Free to
   cancel until, the shop's address and phone, and the sign-in line wait for
   Mark's server to send them.** *Pattern:* nothing shown that isn't sent.
4. **Prices read "£65", as everywhere else on the booking pages, not the
   drawing's "£65.00"; the Settings Preview now writes them the same way.**
   *Pattern:* the booking pages' `formatMoney`.
5. **"Keep this link", Copy link and "Need to change or cancel? Contact
   [shop]" stay below the card, and what the customer told the shop stays
   inside it, until Change the date and Cancel booking are built.**
   *Pattern:* the first release's page; nothing taken away before its
   replacement exists.
6. **The heading keeps the booking pages' own size, not the drawing's
   larger one.** *Pattern:* every booking step's heading (fresh review).

### 20 Oct 2026: Cancel booking on the booking page (Jack, 19 Oct: Change the date and Cancel booking next)

1. **The pop-up says "There's nothing to pay or refund."**, since no shop
   takes deposits yet; the deposit wording comes with deposits. *Pattern:*
   bk-cancel-ls, the drawn pop-up for a booking with no deposit.
2. **"We've sent you a text to confirm." is left off the pop-up and the
   cancelled page**: no texts are sent yet. *Pattern:* nothing said that
   isn't true.
3. **Cancel booking shows under the card, only while the booking can still
   be cancelled online; Change the date and Add a note for the shop come
   later, and the contact line reads "Need to change the date? Contact
   [shop]" meanwhile.** *Pattern:* bk-page's button row, built a button at a
   time.
4. **Cancel request on a request's page waits for that page's own piece.**
   *Pattern:* the confirmed page first (19 Oct).
5. **A refusal (the bike already with the shop, or the booking no longer
   cancellable) shows the server's words in the pop-up.** *Pattern:* the
   settings pop-ups' refusals.
6. **Every cancelled booking shows "Your booking is cancelled", whoever
   cancelled it**: the booking link doesn't say whether the customer or the
   shop did. *Pattern:* bk-cancelled; the words are true either way (fresh
   review).

### 20 Oct 2026: Change the date on the booking page (Jack, 20 Oct: "1: build the server additions for Change the date yourself, merge once checks pass, and flag them for Mark.")

1. **"Choose a new date" opens under the card, in place of the buttons**,
   rather than inside the card in place of its rows. *Pattern:* bk-change's
   section, kept apart from the booking as it stands.
2. **The strip shows ten days from today; "Later weeks ›" moves it on a week,
   and "‹ Earlier weeks" back once moved on; the days come once, today to
   61 days on.** *Pattern:* bk-change's strip and "Later weeks"; the
   booking's own day range (fresh review: one request, not one per week).
3. **A drop-off day with room reads "Free", and says "Drop off between
   [start] and [end]" once chosen.** *Pattern:* bk-when-dropoff's window.
4. **Ask for this date stays off until a free day (and, on a timed day, a
   time) is chosen, and while it's the booking's own day and time.**
   *Pattern:* the booking flow's pinned button, off until a choice is made.
5. **A change waiting keeps the drop-off line and the note, and its buttons
   are Cancel my date change and Cancel booking; "— we'll send you a text"
   is left out** (no texts yet). *Pattern:* bk-change-pending; the drop-off
   line's own rule (19 Oct item 1 above).
6. **A declined change reads "The shop couldn't do the new date you asked
   for. Your booking is still [day, time]."**: the declined date isn't kept,
   so it isn't named. *Pattern:* bk-change-declined's notice.
7. **Once the page offers both Change the date and Cancel booking, the
   "Contact [shop]" line goes.** *Pattern:* the line was there only until
   these were built.
8. **The strip starts on the booking's own day if the device's clock is
   ahead of it.** *Pattern:* the server offers nothing before its own
   earliest moment, so starting earlier only shows days it marks full.

### 20 Oct 2026: the waiting-for-the-shop page, to its drawing (Jack, 20 Oct: "1")

1. **"We'll send you a text when the shop confirms." reads "Please wait for
   the shop to confirm before bringing your bike in. Check this page to see
   when it does."**: no texts are sent yet. *Pattern:* nothing said that
   isn't true.
2. **Changing a request's date says "Your request moves to the new date
   straight away; the shop still needs to confirm it." and the button reads
   "Move my request"**, since the server moves a request at once (piece 12).
   *Pattern:* bk-change, worded for what happens to a request.
3. **Cancel request asks "Cancel this request?" with Keep my request / Cancel
   request**, and then shows the cancelled page. *Pattern:* bk-cancel-ls,
   worded for a request; bk-page-request's "Cancel request".
4. **bk-request, the thank-you card straight after sending ("Thanks, Maya —
   your request is with us"), waits**: the page isn't sent the customer's
   name. *Pattern:* nothing shown that isn't sent.

### 20 Oct 2026: a shop's own booking terms (`docs/decisions/2026-10-08-not-drawn-pages.md` row 95, answer C)

1. **"Use your own" opens a box under the row, filled with Wheelhouse's
   standard terms to edit from, labelled "Your booking terms", with "Customers
   agree to these when they book. A copy is kept with each booking."**
   *Pattern:* the Additional note on the confirmation's box.
2. **It saves when left, only if the words differ from what customers get
   now; leaving the standard words untouched saves nothing.** *Pattern:* the
   settings boxes, saved when left if changed.
3. **With own terms, the row reads "Your own terms · a copy is kept with each
   booking" and offers "Go back to Wheelhouse's standard terms".** *Pattern:*
   Messages' "Go back to Wheelhouse's wording".
4. **The Terms row sits at the end of Online booking, after Show prices**:
   deposits, which the drawing puts between them, aren't built. *Pattern:*
   bk-settings' order.

### 20 Oct 2026: Offer another time, the staff side (`docs/decisions/2026-10-20-offer-another-time.md`)

1. **An offered booking is drawn in a request's purple, labelled "Time
   offered"; it isn't in Waiting for you, has no Accept or Decline, can't be
   dragged, and its till entry says "Not booked yet".** *Pattern:* a booking
   request's block, since the customer hasn't said yes yet.
2. **The pick bar reads "Click a free time in the diary to offer [customer] ·
   [n] minutes." ("Tap a free time…" on a phone) with Cancel back to the
   request; New job isn't shown as pressed while offering.** *Pattern:*
   request-offer-pick; New job's pick bar.
3. **Picked in a mechanic's own column, the offer goes to that mechanic;
   otherwise to the request's mechanic, or the freest that day. With nobody
   to take it, the pop-up says so and can't be sent.** *Pattern:* New job's
   pick (decision 18); the server needs a mechanic (fresh review).
5. **The pick bar says "Tap" only on a phone, and doesn't say "Esc to
   cancel."**: New job's pick bar doesn't either. *Pattern:* the built pick
   bar.
4. **The offer pop-up's footer is Offer this time and Keep request, stacked,
   as drawn; Keep request goes back to the request.** *Pattern:*
   request-offer.

### 20 Oct 2026: Offer another time, the customer's page (`docs/decisions/2026-10-20-offer-another-time.md`)

1. **The offered page follows `bk-offered`**: "Your booking request", "The shop
   has suggested another time", "[Shop] can't do [day] at [time]. They
   suggest:", the time large, the shop's message as a quote (none if it left
   none), Accept this time and Cancel my request, and the When row as the
   first time "— not available". *Pattern:* bk-offered.
2. **Cancel my request asks "Cancel this request?" first**, as Cancel request
   does. *Pattern:* the request page (20 Oct).
3. **Too late to accept (the bike in, or the day gone), Accept isn't
   offered.** *Pattern:* Cancel and Change shown only while allowed.
4. **"Need to change the date? Contact [shop]" stays under an offer**: the
   date can't be changed online while a time is offered. *Pattern:* the
   contact line where the page can't do it.
5. **Accept this time and Cancel my request sit under the card**, not inside
   it above the rows as drawn. *Pattern:* the request and confirmed pages'
   buttons, under the card (fresh review).
6. **Cancelling an offer shows the cancelled page for the suggested time**
   ("[suggested day], [service] for your [bike]"), the booking the customer
   was answering. *Pattern:* bk-cancelled (fresh review).

### 20 Oct 2026: declining with a message (Workshop day 15; Jack, 20 Oct: "2")

1. **The message starts "Sorry, we can't fit this service in on [the weekday
   asked for]. Please try another day, or call us and we'll help find one."**
   The drawing's example suggested a particular day; the shop now types that
   itself. *Pattern:* request-decline's message, without a day the shop
   hasn't chosen.
2. **"Decline & notify customer" keeps the drawn name**: the customer sees the
   message on their booking page now, and by text once the messages engine
   is built. *Pattern:* request-decline.
3. **The declined page leaves off the deposit line and "— we've kept your
   details"** (no deposits yet; the booking flow doesn't keep the details);
   with no message, there's no quote. *Pattern:* bk-declined, saying nothing
   that isn't true.
4. **The declined page has no grey warning icon above "Not booked"**: the
   booking pages draw none of their big icons yet. *Pattern:* the cancelled
   page (fresh review).
5. ~~**Staff can't yet decline a booking that's waiting on an offered
   time**~~: built 20 Oct (offered-decline-reoffer; item 6 below). It still
   isn't in Waiting for you; its block opens it.
6. **`request-offered`: no "Time offered today at [time]" line**: nothing
   records when an offer was made, so the line waits for that. The offered
   block is a button that opens its pop-up but can't be dragged; the
   decline's message box starts empty, as drawn. On a phone the button
   reads "Offer a different time", not the drawn "Another time", as the
   pending request's already does. Opened from a stack, the menu's Open job or
   the overview, it opens the same pop-up. *Pattern:* only what has a source
   is shown; a request's own pop-up (fresh review: request-offered).

### 20 Oct 2026: the messages engine (`docs/decisions/2026-10-20-messages-engine.md`)

1. **Settings › Messages lists only what sends today (Quote to approve, Bike
   ready); each other message's row comes with its trigger.** *Pattern:*
   stage 1 drawing gaps decision 7.
2. **A tap-in with nothing to fill is left out, with the gap tidied; the
   shop's own words and the values filled in are never changed.** *Pattern:*
   a customer never sees brackets (Q9).
3. **Date change answered's second wording ("If the shop can't …") comes with
   that message's trigger**: only the "accepts" wording is stored for now.
   *Pattern:* bk-msg-change, built when it's sent.
4. **Every message goes the customer's chosen way for now; the shop choosing
   text or email per message (owner setup 14) comes later.** *Pattern:* the
   booking messages' "Customer's choice".
5. **The reply line ("Replies to this number aren't read — reply on your
   page") waits for a page to reply on.** *Pattern:* nothing said that isn't
   true.
6. **(Changed 20 Oct, booking-message-triggers: while sending is pretend no
   link is issued and the message shows "[link]", so the customer's own link
   keeps working; the rest of this entry applies once real sending is on.)**
   **Bike ready's "[Link to the job]" is the job's booking link, issued
   afresh when it's queued, and only when it will go** (switched off, or no
   phone or email, keeps the customer's link). *Pattern:* sending a quote
   (journey 4 decision 5: only the newest link works). An undone Bike ready
   leaves the older link stopped too; before real sending is switched on,
   links should be issued when the message actually goes. Reopening the work
   stops a Bike ready still waiting its minute.
7. **"[Opening hours]" reads "Mon to Fri 9:00 to 18:00, Sat 9:00 to 16:00"**:
   Monday first, days in a row with the same hours run together, two days as
   "Tue and Wed". *Pattern:* the booking messages' times ("Thu 17 Sep, 11:30").
8. **"[Amount to pay]" is "Nothing" when the order is paid or empty**, so Bike
   ready reads "Nothing to pay on collection." *Pattern:* the reminder's paid
   version, "Paid — nothing more to pay" (`collect.mjs`).
9. **`job-finished`: a customer with no phone or email gets the line "“Bike
   ready” didn’t go: [name] has no phone number or email on file."; switched
   off in Settings says nothing.** *Pattern:* the quote panel's "no text
   went" line. Undo after the minute shows "It’s already gone".
10. **The quote panel says how it went: "Quote sent to Maya Patel by email."**
   *Pattern:* the drawn "by [text]" in the Bike ready strip.
11. **The old app's one-off text shows as "sent", though it's pretend**: the
   old Customers page is being replaced, and the outbox will show it as
   pretend. *Pattern:* every message goes to the outbox (Jack, 20 Oct).
12. **`set-msg-list` is a "Messages" section of the one Settings page, with
   no folds: no "[n] on" summary, and no "How messages are sent" fold until
   real sending has a sender name and address.** *Pattern:* every Settings
   section built so far is a heading and boxes, not folds.
13. **`set-msg-edit` adds the email preview under the text bubble.**
   *Pattern:* the booking messages' editor (`book.mjs` bkMsg; stage 1 drawing
   gaps decision 24: a text preview and an email preview).
14. **The hovered row's Edit reads "Edit", not "Edit wording".** *Pattern:*
   every row can be edited and is named "Edit the wording of [message]" for
   screen readers (Drop off audit L5); the hover word comes with hover
   states elsewhere.
15. **A preview that can't load says "Wheelhouse couldn’t show the preview.
   Try again in a moment."; a failed save says so inside the edit box.**
   *Pattern:* the Settings page's "Wheelhouse couldn’t save that" lines.
16. **`job-messages`: states the drawing doesn't show.** "Sent" (green) once
   real sending is on; "Sending" ("going now"); "Undone" ("stopped with
   Undo"); "Not sent" with the reason; "Not sure it went" ("the server
   stopped while sending it"); and "No messages yet." for a job with none.
   *Pattern:* the drawn Waiting and Pretend badges, and the engine's states.
17. **`job-messages`: the Message button shows only for a job with a
   customer; Email and Notes, drawn beside it, come later.** *Pattern:* the
   drawing's header buttons, built one at a time as each has something to do.

### 20 Oct 2026: the booking messages staff answers send (booking-message-triggers)

1. **They go at once, with no Undo.** *Pattern:* the quote's message, which
   the answer itself already confirms; no Undo is drawn for these answers.
2. **A declined date change sends nothing yet**: its wording isn't stored
   (messages engine item 3). Request received and Booking cancelled wait for
   the customer's side, in Mark's booking server.
3. **[Service] is the job's services, else its title; [Booked day and time]
   reads "Thu 17 Sep, 11:30"; the drop-off sentence follows the booking
   page's rule in `bk-msg-confirmed`'s words.** *Pattern:* the approved
   wordings' examples.
4. **A message that can't be queued is logged, and the answer stands.**
   *Pattern:* nothing the customer is sent is worth refusing a staff answer
   for.
5. **Staff aren't told when a booking message didn't go** (switched off, or
   no phone or email): the drawings are silent, and these answers' pop-ups
   close. *Pattern:* none drawn; Bike ready's "didn't go" line is a later
   follow-up if wanted.
6. **Settings' Date change answered row still reads "When the shop accepts or
   declines a new date"**, though only accepting sends for now (item 2).
   *Pattern:* the approved wording, kept until the decline wording is built.
7. **Before real sending is switched on:** issue the link only once the
   message is queued, and isolate a failed message from the answer when the
   database runs one transaction per request (`DB_TENANT_SCOPE=transaction`).
   Neither can happen while pretend.

### 20 Oct 2026: choosing the mechanic as a request is accepted (Workshop day decision 62)

1. **`request-new`'s pills show each mechanic's full name, without the drawn
   initial badges.** *Pattern:* Change details' mechanic pills, already
   built (#261).
2. **A mechanic busy at the booked time is refused with the job save's own
   words**, and the request stays waiting. *Pattern:* the job's save.
3. **Every active mechanic has a pill, including one not working that day**;
   accepting for them is refused with the save's "does not work that day".
   *Pattern:* Change details' pills. (Arrow keys and one Tab stop per group:
   built 20 Oct, pill-keys.)

### 20 Oct 2026: the Settings frame (WP-1.3, first part)

1. **On a computer Settings opens on Front desk**, the first room drawn;
   a phone opens on the list of rooms. *Pattern:* the drawn room order.
2. **A room opens with its first fold open, and each fold then opens and
   closes on its own.** *Pattern:* "one section open" (Owner setup decision
   17) read as how a room starts.
3. **Fold summaries say only what's set up**: Receipts "Words at the bottom"
   or "Nothing at the bottom yet"; Online booking "Set times · 2 hours’
   notice"; Mechanics "Who signed off: staff only"; Opening hours "Closed
   Sundays". *Pattern:* setup audit H3 and M2; the drawn summaries' style.
4. **Rooms are addressed `?room=front-desk|workshop|office`.** *Pattern:* the
   till's `?job=`.
5. **No "Saved · Undo" yet**: the boxes keep their own "Saved." until Mark's
   change record is in (WP-1.2).
6. **The phone's room lines and the Messages summary come from what's built**
   ("Till, messages"; "[n] on" counting the messages that send and are on),
   not the drawn full lines. *Pattern:* decision 6, show only what works.
7. **Jump to's pills don't yet mark where the page is** (`aria-current`),
   and a fold stays in place once opened, hidden while closed, so nothing
   typed is lost. *Pattern:* the drawing's Jump to; the boxes' own "keeps
   what was typed".

### 20 Oct 2026: New job's + Add a bike (not-drawn pages row 22)

1. **`new-job`: "+ Add a bike" opens Make, Model, Colour and Serial number
   under the Bike list, with Cancel and Add bike, which saves the bike to the
   customer and chooses it; it waits for a customer.** *Pattern:* the old job
   form's new-bike fields (`public/app.js`), as the old diary's features were
   brought across (`2026-10-18-old-diary-features.md`); answer C.

### 20 Oct 2026: New job's note for the customer (`docs/decisions/2026-10-20-new-job-customer-note.md`)

1. **The receipt prints "From the customer: [words]" straight under the job
   and bike.** *Pattern:* the job page's "From the customer"; the receipt
   drawing has no such line, and "Checked by" sits there too.
2. **New job's "Notes" box is labelled "Staff notes", as drawn; it stays one
   box, without who wrote each note and when, until WP-1.7; it stays under
   Note for the customer rather than at the foot of the right column.**
   *Pattern:* `staffNotesBlock` in the drawing, with its hint "Internal only —
   not shown to the customer."
3. **What the customer told us can't be changed after the job is saved**, as
   with online bookings already. *Pattern:* the job page shows it read-only.
4. **Online bookings' messages print on their receipts too**, being the same
   thing. *Pattern:* the decision's answer 1.

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
