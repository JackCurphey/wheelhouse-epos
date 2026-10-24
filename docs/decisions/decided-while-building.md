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

### 22 Oct 2026: input checks (`openspec/changes/input-checks`, audit items 19, 21, 22)

No screen: server only. Touches `docs/decisions/2026-10-16-mechanic-sign-off.md`
(an active mechanic signs off; the till never refuses over it), without
reopening it.

1. **A job's mechanic is sent as a whole number.** Text, a fraction or
   `true` is refused with "Mechanic not found or inactive". *Pattern:* the
   sign-off's `signedOffBy`, which already takes whole numbers only.
2. **A mechanic deleted or switched off while a job is being finished** gets
   "Choose who is signing this off", as if they had gone a moment earlier,
   and nothing moves. At the till the payment stands and the reply warns
   "that mechanic isn’t active any more". *Pattern:* the same refusal and
   warning when the earlier check finds them gone.
3. **The four on/off workshop settings** (Show prices on the booking page,
   Show who signed off to customers, Use storage slots, Confirm bookings
   automatically) take
   only true or false; anything else is refused and nothing is saved.
   *Pattern:* the messages page's `enabled` ("must be true or false").

### 22 Oct 2026: a deleted job's waiting messages (`openspec/changes/delete-job-messages`, audit item 11 on #265)

No screen: server only. Touches `docs/decisions/2026-10-18-attachments-and-delete.md`
(deleting a job) and `2026-10-20-messages-engine.md` (Undo), without
reopening either.

1. **Deleting a job stops its messages that haven't gone yet**, marked
   undone as Undo marks them, even one whose minute is up but which the
   timer hasn't picked up. One already being sent, or sent, is left as it
   is. A refused delete stops nothing. *Pattern:* reopening the work stops a
   waiting "Bike ready" (`undoWaiting`): nothing is sent about work that no
   longer stands.

### 22 Oct 2026: offer another time, three missed checks (`openspec/changes/offer-checks`, audit items 15–17 on #315)

No screen: server only. Item 18 (untimed offers in drop-off mode skip the
day's capacity check) is left: the offer design makes it a staff choice.

1. **A request whose bike is in the shop, or whose work has started, can't
   be offered another time**, in the words "The bike is already in the shop,
   so this can’t be offered another time." and "The work has already
   started, so this can’t be offered another time." *Pattern:* the customer
   link's own "too late" test (`customerTooLate`), so no offer is made that
   nobody can answer.
2. **A time already gone today can't be offered**: "That time has passed -
   please choose a later time." *Pattern:* the day-gone-by refusal beside it.
3. **The offer's message must be text**: "The message must be text".
   *Pattern:* decline's message.

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
   the customer's side, in Mark's booking server. *Since 21 Oct
   (customer-booking-messages):* both send, built by Jack under the working
   agreement.
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

### 20 Oct 2026: telling staff a booking message didn't go (diary-no-message)

1. **The note stays until Close, and a second replaces the first**; it shows
   at the foot on a phone and an upright tablet too. *Pattern:* the diary's
   floating message for a refused move.
2. **Its Close is named "Close the message", as the refused move's is**: with
   both showing, the two buttons share a name. *Pattern:* the drawing's own
   label. A screen reader may not read the note out as it appears (it arrives
   already filled); a standing status area would fix both if wanted.

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

### 20 Oct 2026: an order's workshop job in the new diary (order-job-link)

1. **No drawing for ticking "Show in workshop diary" on an order that
   already has a job, or is no longer open.** *Decided:* an order that
   already has a job opens that job's page; one completed or cancelled says
   "That order is already [status], so it can't go in the diary." and opens
   nothing. *Pattern:* the order refuses a link once it isn't open, and a
   job made first would be left over with no way to delete it yet.
2. **No drawing for any New job (an order's or not) saved but then not booked in or not linked.**
   *Decided:* the form closes and the diary's notice says "The job is saved,
   but couldn't be booked in / linked to the order: [reason]". *Pattern:* the
   diary's notice for a booking message that didn't go; keeping the form open
   would let a second Save make a second job (Jack, 8 Oct).
3. **The old job form is no longer opened from anywhere.** *Decided:* its
   code is removed in its own pull request (rule 5), to keep this one small.

### 21 Oct 2026: the booking page's later stages (booking-page-stages)

1. **`dq-in-shop`'s "Work agreed" and `cp-summary-inshop` /
   `cp-summary-collected`'s "What we did", the amount to pay and the shop's
   address aren't sent by the server yet.** *Decided:* the answered quote and
   the booking's own rows (Service, Bike, When, Your repair, and the
   customer's words where the drawings have "What you told us") stand in their
   place; no checklist until the server sends it; "To pay when you collect" has its wording without
   the amount; the shop line has the name alone. *Pattern:* the confirmed
   page's rows and shop line as built. The data is in Mark's contract
   (`openspec/changes/booking-page-stages/design.md`).
2. **`cp-summary-collected`: the date collected and "until [date]".**
   *Decided:* "Collected", and "keeps working for 30 days after collection"
   in place of the date, until the server sends it.
3. **`bk-request-expired`: the deposit line and "— we've kept your details".**
   *Decided:* left off, as on the declined page as built (no deposits yet;
   the booking flow doesn't keep the details).
4. **The quote card on the ready and collected pages.** *Decided:* shown; once
   answered it lists what was agreed and declined, which is what "What we
   did" draws (fresh review, 21 Oct).

### 21 Oct 2026: the Workshop Overview (workshop-overview)

1. **`overview`: when an arrival gets Book in.** The drawing gives Book in
   to an 11:30 row and the time to a 10:30 one. *Decided:* Book in once the
   appointment is an hour away or past; before then, "[time] appointment".
2. **`overview`: a drop-off (no time) reads "Drop-off" with no action.**
   *Decided:* a drop-off is due all day, so it gets Book in, and its Work
   reads "[work] · drop-off". *Pattern:* every arrival can be booked in from
   the page, as the drawn Book in row can.
3. **`overview`: the Custody column's "Kept on [slot]".** *Decided:* "In the
   shop" until storage slots are built; "Part arrived" waits for WP-2.3.
4. **`overview`: the page's title.** *Decided:* the shell's "Overview", the
   nav label, as Diary and Till have theirs (the drawing's desktop title is
   "Workshop overview").
5. **`overview`: Book in links to the job page in the drawing.** *Decided:*
   it books the bike in on the spot, as the job page's own Book in does, and
   the job's number and name open its page (fresh review, 21 Oct).
6. **`overview`: a waiting-for-parts row's "· Sat 19 Sep 16:00".** *Decided:*
   left off; "· waiting for parts" only. The job page has the times.
7. **`overview`: nothing to show, and while loading.** *Decided:* "Nothing
   here." in the table's place, and "Loading…" while the jobs are read; a
   failed read says so with Try again, and shows no figures.
8. **`overview`: today.** *Decided:* the device's own date and time, as the
   diary uses (`todayIso`); a device set to another time zone than the
   shop's would read another day. Shared with the diary, for later.

### 21 Oct 2026: the bike tag (bike-tag)

1. **`job-bike-tag`: the bike's colour ("Trek Domane AL 3 · green").**
   *Decided:* the tag prints the job's bike label, make and model, as the job
   page shows it; the server's job doesn't send the colour (a change for
   Mark, noted in the change's design). *Since 21 Oct (planned-effort):* the
   job sends it and the tag prints it, as drawn.
2. **`job-bike-tag`: the tag's size.** *Decided:* 54 mm wide, to fit a 62 mm
   label once the print styles' 4 mm margins are off, as the receipt is
   72 mm for 80 mm paper. A template builder replaces it later (Jack).
3. **A job with no number.** *Decided:* no Print bike tag; its id counts
   every shop's jobs and nothing could find it from the barcode.
4. **A job with no customer.** *Decided:* Print bike tag alone at the right
   of the customer row, where Message would be.

### 21 Oct 2026: the old app's job payments (old-app-job-payments)

1. **The old app's order pop-up: Convert to sale on a job's order.**
   *Decided:* it opens the new till without saving what was typed in the
   pop-up, as its Convert never did; the old app is a placeholder (Jack, 21
   Oct).
2. **An old-app till tab left open since before this change**, holding a
   job's order in its cart, can still rewrite that order's lines before the
   server refuses the payment. *Decided:* left; nobody uses the old till, and
   a fresh page can't reach it.

### 21 Oct 2026: confirming bookings automatically, the screens (auto-confirm)

1. **`bk-details-auto`: step 4's off wording.** The drawing's off button is
   "Send booking request"; the built step 4 says "Request booking" (unchanged
   here). *Decided:* on, "Confirm booking", as drawn; off stays as built. The
   built step 4's terms line is the "I agree to the booking terms" tick, not
   the drawing's "By sending…" sentence, so it has no word to change.
2. **The mark in the No time row** (a whole-day shop's bookings have no
   time, so they sit there). Not drawn. *Decided:* the chip shows the bike,
   then the globe and "New online" ("New, booked online" on a phone), as a
   block's one-line form.
3. **The mark on a stack's front card, a stack fanned out, and the month
   view.** Not drawn. *Decided:* not shown there yet; a stack's own job
   blocks show it once opened, and each job's name for screen readers says
   it. For a later piece.

### 21 Oct 2026: the booking page's money and progress (booking-page-money)

1. **`bk-expired`: "booked for [day] and cancelled".** The expired reply
   carries the job's number, not its day. *Decided:* "It was for [number]."
   and the 30-day rule, then Book a repair and the shop.
2. **`dq-in-shop`: "Expected ready: [day], [time]".** *Decided:* the job's
   last day, with no time until staff can set one.
3. **`cp-summary`: the full service checklist.** *Decided:* not shown; no
   checklist is kept yet.
4. **The booking's rows once the work is listed.** *Decided:* the Service row
   gives way to Work agreed / What we did; Bike, When and Your repair stay.
5. **The quote card once the work is done.** *Decided:* only while the bike is
   in the workshop; What we did comes from the job once it's ready. This
   reverses the 21 Oct log's item 4 under the booking page's later stages.
6. **`dq-in-shop`'s tracker card.** The drawing puts the in-shop tracker in a
   card headed "Where your bike is", numbering the steps to come and saying
   ", done" and ", to come" to screen readers. *Decided:* the list is labelled
   "Where your bike is", earlier steps ticked, the current one marked; the
   card, the numbers and the spoken words are for a later piece.
7. **`cp-expired` / `bk-expired`: "Open [opening hours]".** The expired reply
   carries the shop's name, address and phone. *Decided:* no hours there yet.
8. **`dq-waiting-part`: the reason ("Your new brake pads are taking longer to
   arrive").** Not kept for the customer yet. *Decided:* the bold warning
   alone, then the ready day.

### 21 Oct 2026: Request received and Booking cancelled (customer-booking-messages)

1. **Booking cancelled after an offer never accepted.** Not drawn.
   *Decided:* it names the time the customer asked for, as Request declined
   does.
2. **A booking sent with no bike.** Request received reads "on your [Bike]";
   with no bike that tap-in is left out. *Decided:* left as the tidy-up makes
   it, for now.


### 21 Oct 2026: screen tests built from the reply shape (working agreement 3.13)

1. **A job with no number.** Migration 016 added job numbers without filling
   them in for older jobs, so the server can send `reference: null`, and the
   bike tag already hides Print bike tag for one. The screens' type says a
   job always has a number, and a receipt for such a job would print "null"
   before the bike. *Decided:* the reply shape allows an empty number, to
   match the database; the type and the receipt stay as they are, since no
   shop on the new app has a job from before 16 Oct. What a receipt says for
   one is yours to choose if a shop ever brings old jobs across.

### 21 Oct 2026: the New online mark on stacks and in the month view (new-online-on-stacks)

Closes item 3 of the auto-confirm screens entry above. Not drawn; the closest
pattern is the No time chip's "bike · mark".

1. **A stack's front card.** *Decided:* the mark shows when any job in the
   stack is new, on its own line under the bike (beside it when the stack
   has room for one line only, as a short block has it), with the job on the
   third line. Beside the bike on every stack, it pushed the bike's name off
   the card in a week column (seen in a real browser).
2. **A fanned-out stack.** *Decided:* the new job's tile reads bike, job,
   then the mark, as a tall block does.
3. **The month view.** *Decided:* the chip shows the globe alone after the
   bike, since a month chip has no room for words; its name and the day's
   list say "new, booked online" / "New online".

### 22 Oct 2026: service checklists, the server (service-checklists)

1. **Unticked items and Mark ready for collection.** Not drawn or decided.
   *Decided:* they don't stop it. The checklist shows what's done; the
   sign-off stays as it is, as the till never refuses a payment over the
   sign-off.
2. **Who may tick.** The drawings tag the checklist "Mechanic". *Decided:*
   anyone signed in, until roles are built (WP-1.1); a later tick or note on
   the same item wins. The drawn "Keep mine or Keep Alex's" for two people
   changing one line is for a later piece.
3. **A job with more than one service.** *Decided:* the first service that
   has a checklist, in the order booked (an online booking's services, then
   the service lines on its order).
4. **Finished work.** *Decided:* ticks and notes are refused once the work is
   finished, until it is reopened, as the job's other details are (workshop-jobs
   spec, "Finished work is frozen against edits").

### 22 Oct 2026: service checklists, the screens (service-checklists)

1. **Where Checklists sits.** Drawn under Services; Services isn't in the new
   Settings yet. *Decided:* first in Settings › Workshop, so it opens first
   there until Services is built above it.
2. **Remove.** Drawn with no "Are you sure?". *Decided:* as drawn: it goes at
   once. Jobs already begun keep their copy, and the template brings the ten
   items back in one tap.
3. **The bar's words.** Drawn as "Full service checklist". *Decided:* the
   checklist's own name, since each shop names its own (the template's is
   "Full service checklist").
4. **Saving.** *Decided:* a tick saves at once and shows straight away (put
   back if the server refuses); a note saves when its box is left, as Settings'
   boxes do.
5. **Finished work.** *Decided:* the checklist opens to read, its ticks
   greyed, with "Reopen the work to change its checklist.", as the notes say
   "Reopen the job to change its notes."
6. **After the fresh review.** *Decided:* on a computer or tablet the
   checklist is a pop-up over the job, not the drawing's full-screen page; on
   a phone it fills the screen with Done pinned below, as drawn, but closes
   with the cross on the right (the job's Messages pattern) rather than a back
   arrow on the left. Words the drawings didn't give: a new checklist's box
   is titled "New checklist", and one not yet used reads "not used for a
   service yet". "+ Add note" is in the text colour, not the accent.

### 22 Oct 2026: what a diary block shows (diary-block-lines)

1. **The same thing on both lines.** Not drawn. *Decided:* never; choosing
   the other line's choice swaps the two, so one choice is always one tap.
2. **Where it applies.** *Decided:* diary blocks, a stack's front card and a
   fanned stack's tiles. A month chip and a No time chip keep the bike: they
   have room for one word.
3. **Where the fold sits.** *Decided:* after Mechanics, as drawn; Services
   and Storage slots come later.
4. **The stack's chooser and the month's day list.** *Decided:* they keep
   "bike · job": they list every job's details in full, not a block's two
   lines.

### 22 Oct 2026: storage slots, the server (storage-slots)

The drawings show where slots appear but not these rules. *Decided:*
1. **When.** A slot is chosen at book-in only ("no hook until the bike is
   booked in", 3 Oct walk-through answer 11), or as a job is made with the
   bike already here; not required.
2. **Sharing.** Two bikes may share a slot; nothing stops it.
3. **Changing.** While the bike is in the shop it can be moved or taken off a
   slot; the last choice wins (no version check, as nothing else on the job
   changes). Collecting the bike clears its slot; bringing it back in leaves
   it on none until one is chosen.
4. **Removing and switching off.** Removing a slot takes every bike off it.
   Switching slots off hides them everywhere, keeps the list, and refuses new
   ones until they're switched on.
5. **Sites.** Per shop for now; the plan's per-site slots wait for sites in
   the workshop (WP-1.4).

### 22 Oct 2026: storage slots, the screens (storage-slots)

1. **Book in on the job page and the Overview.** Only the till's book-in is
   drawn with a slot (till-book-in). *Decided:* the same box opens from the
   job page's Book in (and its Bike is here switch) and the Overview's Book
   in, when the shop's slots are on; Not now books nothing; with slots off,
   Book in books in at once as before.
2. **Moving a bike.** Not drawn. *Decided:* "Kept on Hook 3" on the job page
   is a button opening the same box, titled "Where the bike is kept"; a bike
   in with no slot shows "Choose where it’s kept". Tapping the chosen slot
   again takes the bike off it.
3. **New job.** *Decided:* "Where the bike is kept" shows only once "The bike
   is here now" is on, with none chosen, then the drawn note.
4. **Settings.** Not drawn: what "+ Add a slot" opens and the off state.
   *Decided:* a box for the name with Add and Cancel; switched off, the note
   reads "Off for this shop. Switch it on to note where each bike is kept."
5. **The diary block.** *Decided:* the slot on the line after the job (after
   the New online mark when that shows), where there's room; a block's name
   for screen readers doesn't say the slot yet.

### 22 Oct 2026: the job page's layout (Jack's answer)

1. **The roomier customer strip.** The tappable "Kept on Hook 3" (44px tall)
   made the strip's second row taller than drawn. Jack, 22 Oct, on seeing it:
   "I like the way it looks now more"; kept as approved.
2. **Notes with more space.** Jack, 22 Oct: "if we can just swap around the
   work/parts section with the notes section, so that the notes have more
   space on the page i think then it would be perfect". The drawing
   (job-page.mjs jobPopupContent) already has this: the job's details (420px)
   beside Notes in the wider column, then Work and parts across the full
   width below. The built page had drifted from it (Work and parts in the
   right column); it now matches the drawing.

### 22 Oct 2026: the quote's drawn words (`openspec/changes/quote-names-and-wording`)

1. **"We" in place of the mechanic's name, with the switch off.** The
   drawings name Alex throughout; Jack's 22 Oct answer puts names behind
   the "Show who signed off to customers" switch. Off, each drawn line takes
   "we": "We recommend more work", "We recommend this.", "Thanks, Maya —
   we’re carrying on", "Thanks, Maya — we’ll carry on with the service",
   "We’ve withdrawn this quote", "You answered by phone at [time]."
2. **"Call the shop" with no phone.** "Not sure? Call [shop phone]" and the
   withdrawn line read "Call the shop" when the shop has no phone in Shop
   details.
3. **The withdraw box keeps "Only the booked work stays agreed."** The drawing
   names the booked Standard service; a job's title is free text, so the
   general words stay.
4. **The Record-answer intro follows How did they answer?** "Tick what Maya
   agreed to on the phone" changes to "in the shop" with the choice, so it
   sits under the choice. Its drawn note ("Maya gets a text … with what was
   agreed") waits for that message (a later WP-4.2 piece) and isn't shown.
5. **The switch's note says it covers quotes:** "Adds “Checked by [name]” to
   their receipt and booking link, and the mechanic’s name to quotes. Off:
   only staff see who signed a job off, and quotes say “we”." The drawings of
   the switch (`set-workshop-sign-off`) keep the older note until redrawn.

### 22 Oct 2026: the checklist on the customer's booking page (customer-checklist)

1. **When.** *Decided:* once the work is finished (the ready and collected
   pages, where it's drawn); not while it's under way.
2. **Its title.** Drawn as "Full service checklist". *Decided:* the
   checklist's own name, as on the job page (the template's is that).
3. **A checklist nobody ticked** (fresh review). *Decided:* the customer sees
   the checklist only once a mechanic ticked or noted something on it, and
   then the job's own copy, so it's fixed and never says "0 of 10 checks done"
   for a service done without the ticks. A note on a check not done isn't
   shown, as drawn.

### 22 Oct 2026: quote lines that go together (`openspec/changes/quote-goes-with`)

1. **Only a labour line goes with something, and only with a part.** The
   drawing (dq-job-quote) puts "Goes with" on the fitting line and offers the
   pads; decision 2's example is pads and fitting. Keeping it labour-to-part
   means a pair never chains and no line goes with itself. "Goes with" shows
   on a draft's labour lines once the quote has a part; Nothing takes it off.
   More than one labour line can go with the same part (fitting and a bleed
   with the pads); the part and all of them tick together (fresh review).
   A group starts ticked if any line in it is Needed, so a Needed part with
   Optional fitting opens ticked together rather than split.
2. **A pair can't be split.** Decision 2 says they "tick and untick as a
   pair": the customer's card and Record their answer move both, and the
   server refuses an answer that splits them. A customer bringing their own
   pads means staff take the pads off the quote, or choose Nothing.
3. **Where staff write what happens without it.** Not drawn; the audit (H1)
   asks for "a new field on the job page". *Decided:* a box under the reason
   on a draft's Needed lines, "What happens without it", saved when you
   leave it, as the reason is. Up to 300 letters.
4. **No words, no box.** The drawing shows "Alex recommends this. [words]"
   only when there are words (dq-quote-decline). The card had shown "We
   recommend this." alone on any unticked Needed line; it now follows the
   drawing.
5. **The older one-line answer refuses a line in a pair** ("This line goes
   with another; answer the whole quote."), so it can't split one either.
6. **Migration 056**, as Mark's sales in pence (#404) has 055.

### 22 Oct 2026: a photo on a quote line (`openspec/changes/quote-line-photos`)

1. **One photo per line.** The decision says "photos"; every drawing shows
   one ("1 photo"). *Decided:* one, as drawn; Replace photo swaps it.
2. **What "view or add" opens.** Not drawn (not-drawn pages, row 83).
   *Decided:* the photo larger in a pop-up, as Files and photos and the
   customer's dq-quote-photo do, with Replace photo, Remove from line and
   Close.
3. **The photo is one of the job's files.** It shows in Files and photos too;
   removing it there takes it off the line. Remove from line leaves the file.
4. **Only while the quote is a draft**, as drawn: the sent boards drop the
   photo button.
5. **JPEG, PNG or WebP only**, checked by the file's bytes, as the booking
   photos are; the customer's photo route sends it as the picture it is.
6. **Left for later:** "Use my phone" (walk-through 8), removing location
   data (CX-2; booking photos don't yet either) and the photo on Ready to
   collect.
7. **Migration 057**, after the goes-with piece's 056.

### 22 Oct 2026: a new quote after the customer says no to everything (`openspec/changes/quote-after-declined`)

1. **"Already agreed" on the newer quote** lists the booking's services, then
   the earlier yeses, with the booking's agreed total, as drawn
   (dq-quote-newer: "Standard service, brake pads, fitting · £111.00").
2. **A second quote after a withdrawn one** has no earlier answers, so it
   reads as a first quote ("Waiting for your answer").
3. **"line" or "lines"**: "Please answer the new line below." follows how
   many new lines there are.
4. **Each line's latest answer counts** (fresh review). Pads said no to on
   one quote and yes to on a later one are agreed: they aren't listed as "You
   said no thanks", on the newer quote or on the finished-work page. Lines
   are matched by their words, as quotes don't link one revision's line to
   the next.
5. **A quote changed before it was answered in full leaves no earlier
   answers**, even a line answered on its own.
6. **The agreed total counts the earlier yeses** (fresh review): the booked
   services plus the lines agreed before, as the drawing's £111.00 does.

### 22 Oct 2026: the spending limit at booking (`openspec/changes/spend-limit-booking`)

1. **The summary line.** Not drawn for a customer who sets a limit (every
   drawn summary asks first). *Decided:* "Extra work: go ahead if the whole
   bill is no more than £200", in the drawing's words; nothing when asking
   first.
2. **Typing an amount chooses Go ahead**, so the box can't hold a limit the
   radio doesn't.
3. **Whole pounds from £1 to £100,000.** The box is drawn numeric, "in
   pounds". Otherwise Continue says "Enter the most the whole bill can come
   to, in whole pounds."
4. **Shown on every booking**, Not sure included, after the photos as drawn.
5. **The job's tag shows on every job**, "Ask before any extra work" when
   there's no limit (staff-made jobs included), as drawn.
6. **Staff can't set or change a limit**: Jack, 22 Oct, "1: only the
   customer sets it, when booking online; staff can't change it"
   (`docs/decisions/2026-10-22-spend-limit-who-sets.md`).
7. **Migration 058.**

### 22 Oct 2026: work within the spending limit (`openspec/changes/spend-limit-within`)

1. **Through Add to quote.** The drawing (dq-job-within) adds the work with
   Add item and shows it Approved. *Decided:* staff add extra work the usual
   way (Add to quote); when the whole bill stays within the limit, the panel
   says so and offers "Save and tell Maya" in place of Send quote. The
   quote's lines are the record of what was added and what the customer was
   told.
2. **The whole bill** is the job's order, plus any booked service not on it
   yet, plus the new work: a booked service counts once.
3. **"Maya will be told what was added."** The drawing says "She’ll"; the
   app doesn't know anyone's pronouns, so it uses the name.
4. **A minute to Undo**, as Send quote, since a message goes.
5. **Over the limit, or with no limit**, the drawn hint "Quotes are sent
   when the customer asked to be called first, or the total is over their
   limit." shows under a draft quote, and Send quote is as before (fresh
   review: the drawing shows it whether or not a limit was set).
8. **Proposed total is the whole bill** the limit is checked against, booked
   work included, so the two never disagree (fresh review).
9. **No shop phone:** the message says "Call the shop", as the customer's
   page does.
6. **The message wording**: drafted, then approved (Jack, 22 Oct: "1: use
   the drafted wording for Work added within your limit").
7. **Migration 059.**

### 22 Oct 2026: the quote reminder (`openspec/changes/quote-reminder`)

1. **No switch of its own.** The drawn reminder row has the hours and Edit,
   no On/Off: it goes when Quote to approve goes (and a quote message that
   doesn't go, for no contact or Quote to approve off, queues no reminder).
2. **Hours from 1 to 168** (a week), whole hours, saved when you leave the
   box; otherwise "Choose from 1 to 168 hours."
3. **A newer quote sent brings its own reminder**; replacing, withdrawing or
   answering a quote stops one still waiting.
4. **The customer's sent line** adds "· we sent a reminder at 10:15" once it
   has gone, as drawn.
5. **Jack approved the wording before reading it** (22 Oct, by the box);
   shown to him straight after, and it's a one-line change.
6. **A job with no bike** reads "on your is still waiting", as Quote to
   approve already reads "on your ." Left for a messages fix.
7. **Migration 060.**
8. **Checked again when due** (fresh review). The reminder waits up to a
   week, so when it's due it goes only if the job is still there, the bike
   hasn't been collected, the booking hasn't ended, the job's newest quote is
   still waiting, and Quote to approve and the reminder are still on.
   Otherwise it's stopped, and the job's Messages don't list it.
9. **Staff Messages say the day** a message waiting past today goes ("goes
   Fri 23 Oct, 10:15").

### 22 Oct 2026: the "Your answers" text (`openspec/changes/your-answers-message`)

1. **Only for answers from a call.** The drawn Settings row says "from a
   call"; recorded "in the shop", the customer was there, so none is sent.
2. **At once**, as booking answers send at once (22 Oct): the answer is
   final and was given on the call.
3. **What it lists:** "Going ahead: …, £46.00. No thanks: …", the cost of
   what's going ahead from the database; with nothing agreed, "Going ahead:
   just the booked work."
4. **Jack approved the wording before reading it** (22 Oct, by the box); it
   was shown to him straight after, and it's a one-line change.
5. **No word on the job page** that it went: not drawn; the job's Messages
   show it.

### 22 Oct 2026: notes with the shop, the server (`openspec/changes/notes-with-the-shop`)

1. **Where the notes live.** A job's own conversation (`job_notes`), the
   words themselves; the text telling the customer of a reply is a message
   like any other. Questions from a customer's account come later.
2. **Needs a reply** while the customer's note is the newest; a staff reply
   clears it (the drawn "Send reply" then "Sent to Maya by text"). No
   separate "No reply needed".
3. **Staff names to the customer** only with "Show who signed off to
   customers" on, as quotes (Jack, 22 Oct); otherwise the shop's name.
4. **Up to 1,000 letters** a note; otherwise "Write a note of up to 1,000
   letters."
5. **The reply's own full stop** goes before the drawn ". Replies to this
   number aren’t read…", so the text never reads "check it..".
6. **Reply from the shop** is listed in Settings › Messages with the other
   messages, in its drawn wording (ac-reply-text).
7. **Migration 061.**
8. **Notes at any stage the page is open** (fresh review). Decision 3 says
   "a job's page"; the drawing shows the box on the in-the-shop page. The
   server takes a note whenever the booking link works; the customer's card
   is placed as drawn. A closed page (30 days after collection, or a
   booking that never came in) takes none.
9. **A reply on a job whose page has closed** is saved, and no text goes
   ("Maya Patel’s booking page has closed, so no text went."): it would
   carry a link that doesn't work.
10. **Before real sending is switched on:** every message with a link issues
    the customer a new one and the old stops working (one link per job). A
    conversation would do that on every reply. To settle before real
    sending: keep more than one live link per job, or reuse the one they
    have. Pretend sending issues none, so nothing breaks today.
11. **A reply ending "?" or "!"** reads "…come in?. Replies to this
    number…": only a full stop is taken off. Left as is.
12. **For the customer's card:** the booking link's guess limit (30 a
    quarter hour) counts every read, so the card mustn't re-read the thread
    on a timer.

### 22 Oct 2026: the Notes with the shop card (`openspec/changes/notes-card`)

1. **On the in-the-shop, ready and collected pages** (fresh review). Drawn on
   the in-the-shop page; the recorded decisions (collect-and-pay review;
   drop-off review decision 7, H4) put "Add a note for the shop" on the ready
   page too, and a staff reply's text links the customer back to their page.
   On ready and collected it sits after What we did and the checklist.
2. **"Let you know", not "text you".** The drawing's "we’ll text you" is
   Maya's choice; a customer may have chosen email or WhatsApp, and nothing
   is really sent yet. Pattern: nothing said that isn't true (cancel, item 2).
   "We’ll reply here and let you know when we do." / "Sent. [Shop] will reply
   here, and we’ll let you know when they do."
3. **Read once.** No re-reading on a timer or on focus: every read counts
   against the booking link's guess limit. A read that fails says
   "Wheelhouse couldn’t load your notes." with Try again.
4. **Bubbles as drawn:** yours light with a border on the right, the shop's
   on the panel on the left.

### 22 Oct 2026: the staff Messages inbox (`openspec/changes/messages-inbox`)

1. **No "Customer page" link yet.** Drawn beside Open the job; the Customers
   page isn't built, so it would open a placeholder. Added with Customers.
2. **The hint before sending** says "Goes to Maya the way they chose, with a
   link to reply on the job’s page." The drawing shows "Sent to Maya by
   text…" under the box before sending; that line is now said after
   sending, with the way it really went (text, email or WhatsApp), or why
   no text went ("Saved on the job, but no text went: …").
3. **Read again every 30 seconds** while Messages is open: there are no live
   updates between devices yet (WP-1.9).
4. **The open conversation is in the address** (`?job=`), so Back works and
   a link can open one.
5. **"You (Jo Taylor)"** for your own replies, as drawn; another member of
   staff's by their name.
6. **A reply half typed is kept** per conversation while Messages is open
   (fresh review), so checking another one doesn't lose it.
7. **After sending, the drawn bar**: green with a tick when the text went;
   amber, "Saved on the job, but no text went: [why]", when it didn't (the
   drawing has only the green one).
8. **A conversation that won't load**, or a job that's gone, says
   "Wheelhouse couldn’t load this conversation." with Try again, and offers
   no reply box.

### 22 Oct 2026: "Add a note for the shop" from the quote (`openspec/changes/quote-note-button`)

1. **The button goes to the Notes with the shop box on the same page, cursor
   in it** (dq-quote, dq-in-shop). The mock-up sends it to the job's page
   with its note box (ac-job-note); since #422 that box is a card on the
   booking page itself, so the button moves to it rather than opening
   anything new. With notes already there, the box is "Reply".
2. **No button where the page has no notes card.** Before the bike is in,
   the quote card says "Not sure? Call [shop phone]." as before: a button
   that went nowhere would be a dead end. Pattern: the notes card's own
   stages (notes-card, item 1).
3. **The Ready to collect card's button (collect.mjs) isn't in this piece**;
   the notes card is already under it on that page.

### 22 Oct 2026: "No answer yet" after the quote reminder (`openspec/changes/quote-no-answer`)

1. **Today isn't built yet, so its line waits for it.** When Today (WP-1.10)
   is built, its list carries the drawn dq-today-no-answer line: "WH-1042 ·
   Maya Patel — no answer to the quote yet", "Sent [time] · reminder sent
   [time] · [phone]", and Record their answer. The job read already carries
   what it needs (`quote.sentAt`, `quote.reminderSentAt`; the phone from the
   customer).
2. **In the diary, "No answer yet" is the job's word in place of "Quoting"**
   (decision 4 names no other place). It shows where the diary already
   shows the word: a wide block's line, the month view's day list, and what
   a screen reader hears for every block and chip. The colour stays
   Quoting's teal; a narrow week block, with no room for the word, looks as
   before. Pattern: the New online mark's words (new-online-on-stacks).
3. **The customer's number is on the job's page**, in the Today line's words
   above Withdraw quote and Record their answer: "No answer to the quote
   yet", "Sent Mon 5 Oct, 10:15 · reminder sent Tue 6 Oct, 10:15 ·
   07700 900142" (a phone link). The job page's own stage still reads
   Quoting.
4. **Only the current quote's own reminder counts**, sent at or after that
   quote was sent, and only while it waits: answering, withdrawing or a new
   quote ends it. The same rule as the customer's "we sent a reminder"
   (quote-reminder).

### 23 Oct 2026: automatic updates of the hosted copy (`openspec/changes/add-hosted-copy` task 3.4, Mark's design Decision 3)

1. **The health check gets 5 minutes** to show the new commit before the
   update counts as failed and the version before is started again (the
   design's `[n]`). Starting the app and running a migration take well under
   that on the test copy; task 3.5 measures the real time.
2. **The deploy key can only run the update script.** Root's
   `authorized_keys` ties it to `/opt/wheelhouse/deploy.sh` with
   `restrict,command=…`, so it can't open a shell, and the script accepts
   only `deploy <full commit>` or `rollback` and starts only this
   repository's images. The design says the key "is used for nothing else";
   this makes the server enforce it.
3. **The setup script hands GitHub its settings** (with `gh`): the deploy
   key as a secret, and the server's address, web address and host key as
   repository variables, so Jack doesn't copy keys by hand. The host key is
   read from the server over the setup script's own login.
4. **The version before is put back only when the new one went on.** A
   failed download changes nothing on the server, so the workflow doesn't
   roll back after it (it would replace a working version with an older
   one). A new version that won't start is swapped back by the script
   itself.
5. **The first automatic update fails once, by design**, until Jack has run
   the setup script and made the package public: the package only exists
   after the first push. The runbook's "Automatic updates" says so.

### 23 Oct 2026: the quote's pinned answer bar (`openspec/changes/quote-pinned-bar`, `dq-quote`)

1. **"Tablet or phone" means a touch screen, or a window narrower than a
   computer's** (`(pointer: coarse)` or under 1024px wide). The drawings
   tell desktop from tablet by device: the tablet board is 1180 wide and
   still has the bar. *Pattern:* the diary reads touch screens and "narrower
   than a computer" the same way (`diary-page.tsx`, `diary-bits.tsx`).
2. **A failed send's message shows in the bar**, above the button, where the
   customer tapped, and the room kept under the bar grows to fit it.
   *Pattern:* the quote card's own message beside its button.
3. **With the bar pinned, only the bar announces the new total** to screen
   readers, so a tick isn't read out twice; the quote's own "New total" line
   stays on screen, as drawn.
4. **No deposit in the bar yet.** The drawn "· deposit £[deposit] paid"
   (`dq-quote-deposit`) comes with deposits, which aren't built.
5. **The bar looks like the booking page's own pinned area**: a full-width
   strip with a top border, the total and the line above a full-width
   button. The drawing's `quoteBar` is a rounded box with a dark border and
   the button beside the text on a tablet. *Pattern:* decision 8's "as 'Your
   booking' does on the booking page", which is that strip
   (`data-book-pinned` in `frame.tsx`).
6. **The room kept under the bar is the bar's measured height**, so a
   longer message never covers the end of the page.

### 23 Oct 2026: photos lose their location when uploaded (`openspec/changes/photo-location-data`, CX-2)

No screen: server only.

1. **Every hidden detail goes, not only the location**: the time taken, the
   camera or phone (make, model, serial number) and any embedded text too.
   Nothing in Wheelhouse reads them, and they say as much about a customer as
   the place does. *Pattern:* CX-2's purpose, privacy.
2. **What a photo needs to look right stays**: which way up it goes (a phone
   saves an upright photo turned and says so) and its colour profile. The
   picture itself is copied byte for byte, never recompressed.
3. **Nothing after the picture's end is kept**, such as the short video some
   phones add to a photo ("motion photos"), which can carry its own location.
4. **A picture too damaged to clean is refused** rather than saved with its
   details: a booking photo gets "A photo could not be read — please try
   adding it again" (the existing words); a staff attachment gets "That
   picture couldn’t be read. Try adding it again." A file that isn't a JPEG,
   PNG or WebP picture is saved as it was sent, as before.
5. **iPhone HEIC pictures aren't cleaned yet.** Customers can't send them (the
   booking page takes JPEG, PNG and WebP, and iPhones convert to JPEG for
   it), nor can quote lines; only the job page's "Add file or photo" can
   save one, usually a photo taken in the shop. **Jack, 23 Oct: leave HEIC
   out**: "if iPhone converts photos automatically then it's fine, as long as
   iPhone users can upload photos." Safari converts a picked photo to the
   first type the button accepts (JPEG for both photo buttons), per WebKit's
   bug tracker; not yet tried on a real iPhone.

### 23 Oct 2026: Use my phone, the screens (`openspec/changes/use-my-phone`, `job-photo-choice` to `phone-photo-expired`)

1. **A code that runs out on the computer** (not drawn): the pop-up says
   "This code has expired." and "Make a new one to try again.", with Close
   and "Make a new code". *Pattern:* the phone's own expired page, which
   sends you back to the computer for a new one.
2. **"Making the code…"** shows for the moment before the code arrives.
   *Pattern:* the screens' other "Loading…" lines.
3. **The address under the code is the full one**, in the code font (the
   drawing's `[link]`), so it can be typed exactly as shown.
4. **The phone refuses a photo over 10 MB, or a file that isn't a photo,
   before sending**, in the booking page's words ("pads.jpg is over 10 MB.").
   *Pattern:* the booking page's photo picker, with the same limit.
5. **If the phone can't reach the shop**, it says "We couldn’t open this
   code" with Try again. *Pattern:* the booking page's failed loads.
6. **The QR code is drawn with `qrcode-generator`**, a small library with
   nothing else of its own, rather than `qrcode`, which brings a
   command-line tool and a PNG library the app doesn't need.
7. **Cancel, Close or Escape switch the code off** at once (a staff route,
   `DELETE /api/workshop-jobs/:id/quote-photo-codes/:codeId`), and however
   the pop-up closes the quote is read again, so a photo can't arrive unseen
   and a later save can't take it off the line (fresh review). Closing once
   the photo has come is the same as Done.
8. **If the code can't be made**, the pop-up offers Try again. *Pattern:*
   the screens' failed loads.

### 23 Oct 2026: Today (`openspec/changes/today-page`, `op-today` and `op-today-staff`)

1. **A drop-off still to arrive has Book in beside "Drop-off"**, where the
   drawing shows "Drop-off" alone. *Pattern:* the Workshop Overview, where a
   drop-off is due all day, so the two pages agree (design decision 4).
2. **The date line has no town** ("North Street Cycles, Bolton" in the
   drawing): Wheelhouse doesn't record a shop's town yet, so the line is the
   day, the shop's name and its hours.
3. **The hours are today's opening hours from Settings**; on a day the shop
   is closed the "open [opens]–[closes]" part is left out rather than made up.
4. **Who's in and Tills are left out** until check-ins and the till's float
   exist (WP-1.7; Jack, 23 Oct, "1"). Staff see Workshop today alone.
5. **No "Seen" on the lines yet**: the two kinds built (a quote with no
   answer, messages needing a reply) go by themselves once the quote is
   answered or the message replied to; "Seen" comes with the kinds that need it.
6. **Needs attention reads again every minute** and when the window comes
   back, until live updates (WP-1.9). *Pattern:* the diary's refresh.
7. **"Every bike booked for today is in."** when Still to arrive is empty,
   and "Loading…" while the jobs come. *Pattern:* the Overview's empty and
   loading lines.
8. **The lines' buttons are links** (Record their answer opens the job in
   the diary, Open Messages opens Messages), drawn as buttons, so they can be
   opened in a new tab. *Pattern:* the Overview's "Open job".
9. **A message waiting since an earlier day shows the day too** ("oldest
   from Maya Patel at Tue 20 Oct, 16:20"); today's shows the time alone, as
   drawn (fresh review). *Pattern:* the quote line's "Sent Mon 19 Oct, 10:15".
10. **A quote on a cancelled, declined or expired booking isn't listed**,
    since nothing on Today could clear it (fresh review).

### 23 Oct 2026: the bike on Waiting cards (`openspec/changes/waiting-bike`, `diary`)

1. **A request with no bike has no bike line**, rather than "No bike" or
   "Bike"; the card is its label, the customer and the detail, as before.
   *Pattern:* the bike tag, which leaves the line out.
2. **The computer's Waiting column shows the bike too**, not only the tablet
   and phone cards: the drawing's desktop card has the same line
   (`waitingCard` in `diary.mjs`).

### 23 Oct 2026: a bike left uncollected, the server (`openspec/changes/uncollected-bike`, `cp-setting`, `cp-today-uncollected`)

1. **New shops start at 3 days for the reminder and 7 for Today** (the
   drawing shows `[n]`). 7 follows the build plan's flag for uncollected
   online orders (Q8, `2026-10-03-build-plan-questions.md`); 3 comes before
   it. The reminder can be 1–60 days, Today 2–90, and longer than the
   reminder.
2. **One reminder**, as buy online decision 7 says of uncollected bikes.
3. **It follows Bike ready**: switched off, undone in its minute, or with no
   way to reach the customer, no Bike still waiting either. *Pattern:* the
   quote reminder, which only follows a quote that went.
4. **What's left to pay is worked out again when it goes**, so a payment or
   a changed bill in the days between is right; a paid bike is reminded with
   "Paid — nothing more to pay", as drawn.
5. **Contacted records who and when and takes the line off Today**; marked
   ready again (after reopening), it counts afresh. The decision says what
   the line shows and that it goes at hand-over, not what Contacted does.
6. **The email subject is "Your bike is still waiting — [Shop name]"** (not
   drawn). *Pattern:* Bike ready's "Your bike is ready — [Shop name]".
7. **Owner only, until roles**, as the rest of Needs attention (the hint
   says "for owners and managers").

### 23 Oct 2026: a bike left uncollected, the screens (`openspec/changes/uncollected-bike`, `cp-setting`, `cp-today-uncollected`)

1. **Leaving either day box saves both as they read**, so raising the
   reminder past Today's count works by raising Today next; a refused save
   keeps what was typed and says why (server review). *Pattern:* the other
   number boxes, which save when left.
2. **The fold's summary is "Reminder after 3 days"**, without the drawing's
   "· hand-back reminders off", since that switch isn't built.
3. **"edit it in Messages" opens Front desk with Automatic messages open**
   (`?fold=`, new: a link can name the fold to open).
4. **Settings › Messages says the shop's days** ("When a ready bike isn’t
   collected after 3 days"), and its edit box adds "— set in Settings ›
   Workshop › Collection", as drawn.
5. **Today's line leaves out "reminder sent" until it has gone**, and the
   bike when the job has none.
6. **Months are three letters** ("Sep"), as drawn and as the server's
   messages say them: the browser's British dates say "Sept", which the
   quote's "Sent …" line also showed in September.

### 23 Oct 2026: Your settings › Accessibility, first part (`openspec/changes/your-settings-accessibility`, `your-settings`)

1. **Saved in a table of its own, per login** (`login_preferences`), as Jack
   decided (23 Oct, answer 1); every switch is off until turned on.
2. **The pop-up opens at `/workshop/your-settings`**, where your name already
   linked, over an empty frame rather than over the page you were on;
   Close or Escape goes back to that page (the desk when opened directly).
   The drawing shows it over the diary.
3. **Only the switches built show**: Reduce motion now. Show status
   symbols, Don't close things by themselves, Folded sidebar and Larger
   text come with what they act on; the Till PIN with PINs; Show graphs with
   reports. With no Till column, the pop-up is one column (560px) on a
   computer, the whole screen on a phone.
4. **Larger text is held back, a question for Jack.** It was built as a zoom
   of the whole app by 17/14 (text is set in pixels) and taken out after the
   review: checked in a browser, a zoomed page put the diary's drops about a
   fifth too far down and pop-ups beside a block off their marks.
5. **Reduce motion stops every animation and transition**, as the
   computer's own setting does, and the diary's hover card opens at once
   with either.

### 23 Oct 2026: Show status symbols (`openspec/changes/status-symbols`, `your-settings`, the diary's blocks)

1. **Where the drawing puts them**: narrow week blocks and every request,
   and the legend's swatches; not day view or a phone, which spell the
   status out.
2. **An offered time has no shape**: the drawing gives it none.
3. **A tablet's week shows them too**, though the drawing's tablet blocks
   (touchJobBlock) have none: its week columns are as narrow as a computer's,
   and the switch is there for anyone who can't tell the colours apart.
   A phone's job blocks don't (review), as drawn; its requests do.

### 23 Oct 2026: emailing a receipt, the email side (`openspec/changes/receipt-email`, `cp-receipt-email`, `cp-receipt-address`)

1. **The subject is "Your receipt — [Shop name]"** (not drawn). *Pattern:*
   "Your bike is ready — [Shop name]".
2. **As the printed receipt**: "Sale [n]", no VAT line and no "(includes
   VAT)" until the sale records VAT; "Paid by card" and "Paid by cash", the
   printed receipt's words, for the drawing's payment line; the shop's own
   words at the bottom when it has them.
3. **The footer says "give the sale number"** for the drawing's "receipt
   number", until receipts have numbers of their own; "Questions? Call
   [shop phone]." only when the shop has a phone.
4. **A receipt goes to the address typed, the customer's way aside**, and is
   kept with the sale's customer when it has one, so it shows in their
   history later; with no customer it goes all the same.
5. **Nothing is saved to the customer from here** (review answer 3: "for
   this receipt only"); Save to a customer record comes with the till's pop-up.

### 23 Oct 2026: Folded sidebar (`openspec/changes/folded-sidebar`, `foldedRail`, `your-settings`)

1. **The keyboard opens it with Unfold, not by moving into the rail** (the
   drawing opens on focus): opening on focus put it straight back open after
   Escape, so a keyboard user couldn't close it.
2. **After Fold or Escape, resting the pointer doesn't reopen it** until the
   pointer has left the rail, so Escape works with the mouse over it.
3. **A tablet's rail has Unfold too**, as its drawn hint says ("tap Unfold
   to open it").
4. **The panel over the page has the rooms, the shop and your name, without
   the drawn shop switcher**, which comes with more than one shop.
5. **Tapping or clicking the page beside it folds it** (not drawn; review),
   as the phone menu's dimmed page does, so a tablet isn't left half covered.

### 24 Oct 2026: the header search (`openspec/changes/header-search`, `staff-search`)

1. **Results are links, not a list of options** (the later `staff-search`
   drawing, 3 Oct: "a labelled list of rows, not a listbox"); the older
   `cs-search-c2w` drew a listbox with the first row chosen.
2. **"Search jobs and customers"** in the box until orders and products are
   found too (drawn: "Search jobs, customers, orders, products").
3. **A job row reads "Trek Domane AL 3 · Standard service · Expected · Thu 17
   Sep"**: its stage and day (walk-through 9 H1); "approved £…" waits until
   quote totals are read here. **A customer row reads "Customer · [phone]"**.
4. **Five of each, two characters at least, a pause of 250 ms**; a job is found
   by its number, its customer's name or phone (however it's spaced), or its
   bike; a customer by name, phone or email; requests not yet confirmed are
   found, removed customers aren't. A postcode comes with Customers' address.
5. **"Nothing matches “[what was typed]”"** when nothing is found (the till's
   words), said on screen and to screen readers; groups with nothing are left
   out rather than drawn empty.
6. **Escape clears the box on a computer**; on a tablet or phone it shuts the
   search, as Close search does, and the focus goes back to the search button.
7. **The sheet over the page holds the keyboard** (Tab goes round it) and
   tapping the page shuts it, on a tablet as on a phone (review).
8. **"Wheelhouse couldn’t search just now. Try again in a moment."** when a
   search fails (not drawn), as the screens' other failed loads say.

### 24 Oct 2026: Customers, the list and Add a customer (`openspec/changes/customers-list`, `cs-list`, `cs-add`, `cs-add-match`)

1. **Recent** is the latest of a customer's own change, their newest job and
   their newest sale; 25 of them. "No customers yet." when there are none.
2. **The match is by the same phone number (whatever its spaces) or the same
   email**, not by name: many people share a name, and the header search
   finds them. It says "already has this number" or "already has this email
   address", with their phone and bike.
3. **"A phone number or an email — at least one"** is checked in the pop-up,
   with "Add their name." for a missing name; the server's add stays as the
   booking page and the old app use it.
4. **Group appears only when the shop has groups** (set up with WP-5.1).
5. **Left out until built:** a company or club (its VAT invoice waits on the
   accountant), the "Owes" chip (money in pence), Privacy requests.
6. **Adding opens the new customer's page**, as "Use [name]" opens theirs.

### 24 Oct 2026: a customer's page and Edit (`openspec/changes/customer-page`, `cs-page`, `cs-page-new`, `cs-edit`)

1. **History rows**: a job shows its number, the work, its day and mechanic and
   its stage, and opens in the diary; a sale shows "Sale [n]", its day, what was
   bought and its total; a message shows "Text" or "Email", its name and where
   it went. Sales and messages don't open anything until their pages exist.
2. **Eight rows, then "Show all ([n])"**; the filters show only their kind.
3. **A cancelled job reads "Cancelled"** and a collected one "Collected" in the
   history, beside the diary's stage words for the rest.
4. **Offers show On or Off on the page**, changed in Edit, not with a switch
   on the page (the drawing shows the switch): a customer's yes or no is
   changed deliberately, with Save changes.
5. **Bikes are listed without their own pages or "+ Add" yet** (the bike's
   page is next), with their colour when they have one; "No bikes yet."
6. **New job opens the diary's New job with them chosen** (`?customer=`), at a
   time to enter, as an order does.
7. **Left out until built**: "Owes", the account and store credit (money in
   pence), warranty (needs "bought here"), refunds and credit changes in the
   history.
8. **A job never booked in, whose day has gone, isn't "Open now"** (a no-show;
   review), though it still shows under Earlier with its stage.
9. **Edit leaves a customer's groups as they are unless the group is changed**
   there, so someone in two groups (the old app allows it) keeps both (review).
10. **A UK number matches however it's written**: +44 7700 900142, 0044 … and
    07700 900142 are the same (review).

### 24 Oct 2026: possible duplicates and Merge (`openspec/changes/customer-merge`, `cs-page-dup`, `cs-merge`)

1. **The page you're on is the customer kept**; for each field that differs
   (name, phone, email, address with postcode, note) its value is chosen to
   start, and the other's can be picked instead.
2. **Both with an online account can't be merged yet**, with that reason; one
   with an account moves it to the kept record. (Which sign-in survives isn't
   decided.)
3. **The kept record keeps its own "Happy to hear about offers"**, not the
   other's: a yes or no is the customer's, given on that record.
4. **"Merged with [name] on [day] · can be undone until [day]"** with "Undo
   the merge", at the top of the kept page (not drawn; its place is "from the
   customer's page"), in the duplicate notice's style.
5. **Removed for good after 30 days** when merges are next read or undone, not
   on a timer; anything that has come to point at it since (a till sale synced
   late) moves to the kept record first.
6. **"Added on [day] and [day]."** before the 30-day note, without the
   drawing's "on different tills" (where each was added isn't recorded).
7. **Duplicates are found by phone or email, not by name.**
8. **Undo is refused once the kept record has itself been merged** into
   another, saying to undo that one first; undoing in order keeps every job
   and sale on one record.
9. **A name or email differing only in capitals is offered as a choice**, so
   the spelling kept is the one picked.
