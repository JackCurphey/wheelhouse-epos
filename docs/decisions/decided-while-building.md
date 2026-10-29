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

### 21 Oct 2026: sales in pence, step A (`openspec/changes/wp-1-6-sales-in-pence` task 1.4)

No screen: server only.

1. **A typed price finer than a penny is rounded to the penny once, per
   unit, and the line is that times the quantity.** The pounds written
   beside it come from the pence, so the old app now sees £0.33 and £0.99
   for 3 at £0.333 where it used to store £0.333 and £0.999. Prices typed
   to the penny are unchanged. *Pattern:* design.md Decision 2 (pence is the
   authority, pounds worked out from it) and the money contract's
   `ROUND(x * 100)`.
2. **An order's `total_pence` has no group discount on it; `paid_pence` is
   what the sale took.** So a group customer's converted order reads paid
   less than its total. *Pattern:* the order's pounds total already left the
   group discount to `createSale`; the totals check holds `paid_pence` to
   the converted sale's total (design.md Decision 7).
3. **The amount due (`GET /api/sale-documents/:id/due`) also gains `…Pence`
   fields** beside its pounds. *Pattern:* the money contract (Decision 6):
   an endpoint that returns pounds adds the pence beside them.

### 22 Oct 2026: held work on an ended booking

5. **Held work can't be resumed on a cancelled, declined or expired booking,
   and hold stays refused on all of them.** Jack's "block both" (22 Oct)
   left the resume gap to Mark. The server doesn't record whether held work
   had started, so allowing hold on started work would trap it with no
   resume. Work under way can still be finished or marked waiting for parts;
   held work stays held and the bike can be collected. A "started at"
   column would allow the finer rule (schema change, not made). Change
   `ended-booking-resume`. *Pattern:* start's refusal.

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

### 25 Oct 2026: a declined date change sends its message (`openspec/changes/date-change-declined-message`; audit item 23; Mark's answer, 25 Oct)

1. **The declined wording is the second box of the Date change answered
   row, as drawn (`bk-msg-change`), not a row of its own.** One On/Off covers
   both wordings, and the row's subject is shared. *Pattern:* the drawing.
2. **[New day and time] in the declined wording is the day the customer asked
   for**, read before the decline clears the request. *Pattern:* Offer
   another time's "the time the customer asked for".
3. **The Settings box's two wordings are labelled "If the shop accepts" and
   "If the shop can't"** as drawn; the preview shows the first wording only,
   as the drawing's one example does.
4. **`decline-change` was missing the shop id the other answers pass**; it
   is passed now (a message needs it).

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

### 28 Oct 2026: till PINs and the PIN check-in (WP-1.7, `openspec/changes/pins-and-checkin`)

1. **Guessing PINs is slowed, never locked** (`till-pin-wrong`; Jack
   confirmed it 28 Oct, `2026-10-28-answers.md` answer 1). After 10 tries at
   a shop within 10 minutes each further try waits 3 seconds before it's
   checked. Every try is counted before its PIN is checked, and a right one
   is taken off the count, so a burst can't slip through. The wait is one at
   a time per sign-in and browser: a second try from the same browser while
   one waits gets "Wait a moment, then try again", and another till isn't
   held up. "Give me a different one" is limited to 10 PINs a sign-in in 10
   minutes, with the same words. Offers are counted on their own, not with
   the shop's tries, so setting up the staff's PINs never slows the tills.
   *Pattern:* the till's own token check (`server/till/failure-limiter.js`).
2. **PINs are kept as a slow, salted hash** (PBKDF2, 100,000 rounds), the
   format the offline till already uses (`server/till/pin.js`), so it can
   check PINs without the internet later. The PIN just offered is kept the
   same way until it is kept or replaced; an offer lasts 15 minutes.
   *Pattern:* migration 036's `pin_hash`.
3. **A check-in lasts the shop's day, on that browser, under that sign-in**,
   until Switch or someone else checks in there. Until "Set up this till"
   (step C), the till is the browser, and "Checked in today" lists everyone
   who checked in at the shop today, not one till's. *Pattern:* the float
   check's one-a-shop-a-day until named tills. *Later (28 Oct, till-setup
   entries 4 and 5):* on a set-up till a check-in belongs to that till, and
   Checked in today is that till's.
4. **The Owner gets a team member when they first get a PIN**, marked as
   taking payments, since a PIN belongs to a team member (till-only people
   have no sign-in). A staff sign-in with no team member can't get a PIN
   until the Owner adds them. *Pattern:* the team's existing "attach roles"
   for a login-only Owner (`server/team.js`).
5. **Clearing a PIN is the Owner's until roles, never their own**, with the
   server only; the button and its pop-up (`set-staff-person`,
   `set-staff-clear-pin`) come with Staff and roles. *Pattern:* the 19 Oct
   owner-only rule; roles and switches 5.
6. **The offline core's `PUT /api/employees/:id/pin` is removed** (Jack,
   28 Oct, answer 2): Wheelhouse picks every PIN.
6a. **Known limit, for Jack and Mark: the till's offline copy carries every
    cashier's PIN hash** (`server/till/snapshot.js:33`), so the till can
    check PINs without the internet (signing in 3). Anyone holding a till's
    token could fetch that copy and try all 10,000 four-digit PINs against
    the hashes on their own computer in minutes; the slow-down above can't
    stop that. Not changed here: it is step C's design (the offline till).
    Worth settling when step C is built, for example by keeping the token
    to the till and treating a PIN as "who's serving" only.
6b. **Clearing a PIN also ends that person's check-in** on any till that day.
7. **No till bar yet, so "Serving: [name]" is a button at the top right of
   the till** (`till-checkin`, tillBar's "Serving: Jo Taylor — switch who’s
   serving"); pressing it goes back to Enter your PIN. *Pattern:* Close the
   day's entry, in a strip on the till until the till bar is built.
8. **Enter your PIN says only what works today**: no "It works even when
   the internet is down" until the till works offline (step C), and "No PIN
   yet? Sign in on your phone." without "or ask the owner or a manager to
   give you one here" until giving a PIN at the till (`till-give-pin`) is
   built. No start-up status line until step C. *Pattern:* 20 Oct, Settings
   frame 6, show only what works.
9. **"Get your PIN" in Your settings opens the first-time "Your till PIN"**
   (Welcome …, Skip for now), as drawn for someone with no PIN; Keep and Skip
   go back to Your settings. Change PIN opens "Your new till PIN" with its ✕.
   *Pattern:* the drawing's links (`yourSettingsDialog` → `pin-first`,
   `pin-change`).
10. **A check-in that fails for any other reason says "Wheelhouse couldn’t
    check that PIN. Try again in a moment."** and clears the dots, so it is
    never mistaken for a wrong PIN. *Pattern:* the float check's "couldn’t
    save that" line.
11. **The pay box's "Who’s serving?" no longer comes up at the till**: the
    person checked in is serving. *Pattern:* signing in 4, the PIN says who
    you are.
12. **A sale that's open stays on the till** (review, 28 Oct): if the
    check-in ends mid-sale (the day ends, or the PIN is cleared) or the till
    can't re-check who is serving, the sale and its pay box stay, still under
    the name they started with, and Enter your PIN comes once the sale is
    paid or cleared. The Serving button and the float check wait for a
    check-in. *Pattern:* the pay box's own "can't close while saving".
13. **The PIN pad answers keys only when nothing else has them**: not in a
    box like the header search, not with Ctrl, Alt or Cmd held, and not a key
    held down. *Pattern:* none built; the review's item 2, 28 Oct.

### 28 Oct 2026: giving a PIN at the till (WP-1.7, `openspec/changes/give-pin-at-till`, `till-serving-menu`, `till-serving-menu-several`, `till-give-pin-pick`, `till-give-pin`; Jack's answers 28 Oct, 3 to 5)

1. **Only the Owner gives a PIN, until roles.** The drawings say the Owner,
   a Manager, or anyone with "Give everything a Manager can do" (roles and
   switches 1). Neither the Manager role nor that switch is stored anywhere
   yet (WP-1.1, Staff and roles), so the Serving menu and the server's check
   are the Owner's alone, and Managers join the same check
   (`giverHere`, `server/routes/till-pins.js`) when roles are built.
   *Pattern:* clearing a PIN and closing the day, Owner only until roles.
2. **"The Owner" is the person checked in at the till by PIN, not the
   computer's sign-in.** A till signed in as Jo still lets Jack give a PIN
   once he types his; a till signed in as Jack doesn't let Jo. *Pattern:*
   signing in 4, the PIN says who you are.
3. **Keeping the PIN ends the Owner's check-in on that till**, so the till
   goes back to Enter your PIN (as drawn) and the person the screen is turned
   to is never left serving as the Owner. Closing without giving a PIN leaves
   him serving. *Pattern:* Switch.
4. **Who counts as "no PIN"**: active team members with no PIN, never the
   person giving and never the Owner (the drawing's note). This includes
   people who have a sign-in but no PIN yet, as Jo Taylor on the drawing. A
   cleared PIN counts as none. *Pattern:* the drawing's comment, "a cleared
   PIN counts as none".
5. **The labels under a name**: "Staff" or "Mechanic" from the team's
   mechanic switch, with " · till only" for someone with no sign-in
   ("[Name] Staff · till only" on `till-give-pin-pick`). The one-person menu
   line reads "Till only · no PIN yet" for a till-only person, as drawn, and
   "[Staff or Mechanic] · no PIN yet" for someone with a sign-in, which isn't
   drawn. *Pattern:* the drawn tiles.
6. **A name's round badge shows its first letter; the drawing's [Name] has
   a person icon** because a placeholder has no letter, so a name that
   doesn't start with a letter shows the icon too. *Pattern:* the workshop
   computer's name tiles (`till-checkin-workshop-names`).
7. **"No PIN yet?" now reads as drawn**: "Sign in on your phone, or ask the
   owner or a manager to give you one here." (replaces 28 Oct item 8's
   shorter line). It says "a manager" as drawn, though only the Owner can
   until roles.
8. **Giving a PIN shares Your settings' limit**: 10 PINs shown a sign-in in
   10 minutes, counted together, so a till can't be used to see PINs faster.
   *Pattern:* the 28 Oct limit on "Give me a different one".
9. **The PIN pop-up is one piece for both**: Your settings' "Your new till
   PIN" and the till's "[Name]’s till PIN" share their buttons, focus and
   Escape. With a ✕, Escape closes it like the ✕; the first-time version
   still ignores Escape. *Pattern:* the float check's Escape and focus fixes.
10. **Adding a till-only person** (`set-staff-invite-till-only`, the note
    on setup.mjs:280) isn't built: Staff and roles isn't in the new app yet,
    and the team's add route (`POST /api/team`) needs an email and password,
    so today only team members made before sign-ins were linked (migration
    013's roster-only staff) have no sign-in. Until Staff and roles, the menu
    mostly gives first PINs to people with a sign-in who haven't got one.
11. **Close without giving a PIN withdraws the PIN shown** (review, 28 Oct),
    so it can't be kept afterwards; Escape does the same. *Pattern:* the
    drawing's own words, "Close without giving a PIN".
12. **The Serving menu by keyboard**: the first item has the focus, also in
    the phone's sheet; the arrows move it; Escape and Tab close the menu with
    the focus back on Serving (review, 28 Oct). *Pattern:* the diary's job
    menu, except Tab, which there leaves the focus where the page puts it.

### 28 Oct 2026: Who's in and Tills on Today, and the first PIN by itself (`openspec/changes/whos-in-and-first-pin`, `op-today`, `op-today-staff`, `op-today-late`, `op-today-short`, `op-today-seen`, `pin-first`, `pin-cleared`; WP-1.10, WP-1.7 3.2)

1. **Who's in lists everyone who checked in today, even after Switch**, at
   the time of their first check-in that day: checking in only records who's
   in and when (opening the shop decision 5, no check-out). A check-in covers
   the whole shop until tills have names (28 Oct, PINs entry 3). *Later
   (28 Oct, till-setup entry 5):* check-ins belong to a till now; Who's in
   still lists every till's, as who is at work.
2. **Who's due is a mechanic with time in today's diary**: their working
   days, the shop's hours that day, and time off, as the diary and booking
   count them. "Due in at" is when that time starts (the shop's opening time,
   or later after a morning off). Till staff have no working hours in
   Wheelhouse yet, so only mechanics are ever "Not in yet". *Pattern:* the
   diary's capacity (`server/capacity.js`).
3. **"Not in yet" turns "Late" by the page's own clock**, without a reload.
   *Pattern:* Today's Book in, which appears when a booking is due.
4. **Role words are Owner, Mechanic or Staff**: the Owner's own team member,
   a team member marked mechanic, everyone else. *Pattern:* giving a PIN's
   "Who's getting a PIN?" (Mechanic or Staff), with Owner as drawn.
5. **Nobody checked in and nobody due: "Nobody has checked in yet."** in the
   empty-list style. *Pattern:* Workshop today's "Every bike booked for
   today is in."
6. **Tills is one line headed "Till"**, no number, until tills have names
   (27 Oct, float check entry 2). *Later (28 Oct, till-setup entry 6):* a
   line per till, "Till B1"; "Till" with no number only for a browser that
   isn't a set-up till. It reads "Open · float checked by [Name]
   at [time]" (drawn); before the float is checked, or with no float set,
   "Open · [Name] checked in at [time]" from the day's first check-in; and
   "Not open yet" before anyone has. "Float short" (warning) and "Float
   short · seen by [Name]" (grey) are drawn; no "All sales sent" or "sales
   waiting to send": the till has no send queue until step C. *Pattern:* the
   drawn line, saying only what's true (20 Oct, Settings frame 6).
7. **No "Closed" on Tills yet**: after Close the day the line still says
   how the day opened. Not drawn; left for Jack. A day nobody checked in on
   stays "Not open yet" even when the Owner's look at closing recorded a
   float check: "Open" needs someone to have checked in that day (review,
   28 Oct).
8. **Staff see Who's in beside Workshop today, in two columns**, as
   `op-today-staff` draws it (decision 4). Tills stays the Owner's, as Needs
   attention is, until roles.
9. **"Your till PIN" by itself is for team members, not the Owner's own
   sign-in**: the drawing is Jo's first sign-in after her invite, and the
   Owner made the shop rather than joining it. *Pattern:* walk-through 4 H1.
10. **Asked once**: Skip for now or Keep this PIN records it on the sign-in
    (migration 098); clearing the PIN asks again in the cleared words, even
    for someone never asked before. Someone already on the team with no PIN
    is asked the next time they open Wheelhouse after this is built.
11. **It opens over whatever page they land on and leaves them there** ("then
    she lands in her room", walk-through 4 H1), not the mockup's links to the
    till or Today. *Pattern:* the drawing, over the diary.
12. **If recording the ask fails**, the pop-up still closes; they're asked
    again next time. *Pattern:* none built; a lost record costs one more
    ask, while keeping the pop-up open would block the page.
13. **It never opens over another pop-up, an open sale or the pay box**
    (review, 28 Oct): it waits until the screen is clear, for example once
    the sale is paid or cleared or the float check is answered, then opens.
    On the till it also waits while the till is still finding out who's
    serving and whether the float check is due. *Pattern:* the float check
    waiting for the check-in (28 Oct, PINs entry 12).
14. **"Late" only once the start time has passed**: at the minute itself
    it still says "Not in yet" (review, 28 Oct).
15. **Keep refused because "Give me a different one" was pressed in another
    window says "Your PIN was offered in another window. Pick again."** in
    Your settings and the first-time pop-up (review, 28 Oct); an offer that
    ran out still says "Ask for a new PIN", and giving a PIN at the till
    keeps "Ask for a new PIN". *Pattern:* the pop-up's other refusals, in
    the server's words.

### 28 Oct 2026: Set up this till, check-ins per till, the till's name (`openspec/changes/till-setup`, `till-setup`, `set-till-tills-owner`, `op-float-check`, `op-float-count`, `op-float-matched`, `op-today`, `op-today-short`; WP-1.7 task 3.4)

1. **The shop switcher and "Where are you working today?" (`auth-site`)
   aren't built.** Stage-1 gaps decision 23 (Jack, 7 Oct) puts switching
   shops in WP-5.2, "when a shop can have more than one"; it also needs the
   shop on the sign-in (WP-1.4). Not reopened.
2. **One float check and one close a shop a day stay.** Cash-up decision 6
   says each till closes on its own, but neither sales record knows which
   till a sale was on (26 Oct, a sale from a customer's history, entry 2), so
   a till's own drawer can't be worked out yet. The float check now records
   the till it was counted at, so its pop-ups and Today say "Till B1"; Close
   the day keeps no till name, since it counts the whole shop's cash. When
   sales carry their till (WP-1.7 task 3.8, step C), the float and close go
   per till. *Pattern:* the 27 Oct float check entry 2.
3. **The computer keeps its till in a cookie of its own**, apart from the
   sign-in, holding a key of the browser's own (only its hash is stored),
   for 400 days, the longest a browser keeps one, renewed each time the till
   is read. Signing out or someone else signing in leaves it the till;
   another shop's sign-in, or a till switched off, sees no till. *Pattern:*
   the check-in's own cookie (28 Oct, PINs entry 3). *Review, 28 Oct:* it
   first held the offline till's own key, which opens the till's copy of
   every customer and PIN hash, and takes sales, with no sign-in; now the
   browser's key only says which till a signed-in browser is, and never
   opens those. How the offline till gets its own key is step C's.
4. **A browser that isn't set up still works as the till, as before**, with
   check-ins that belong to no till, and Today shows it as "Till" with no
   number. Only Set up this till makes a numbered till; making it the only
   way waits for step C. *Pattern:* show only what works; nothing that works
   today stops.
5. **A check-in belongs to the till it was made on.** "Checked in today" on
   the PIN screen is that till's. After "Make this computer Till B1",
   whoever was checked in on that browser checks in again. Who's in on
   Today stays the whole shop's: it's about who is at work.
6. **Today's Tills has a line per till**, by code, "Till B1"; plus "Till"
   with no number when no till is set up, or something was done today on a
   browser that isn't one. The day's float check shows on the line it was
   checked at. The short float reads "Till B1’s float was [£] short this
   morning" when counted on a set-up till.
7. **Till numbers as pills: 1 to 3, or one past the highest in use**,
   whichever is more, taken ones "In use", the lowest free one chosen. That
   gives both drawings: Bolton with none taken (B1, B2, B3) and [Second
   site] with 1 and 2 taken ([code]3 chosen). A till switched off keeps its
   number in use, as the server keeps codes unique.
8. **Set up this till says only what works**: "This computer becomes a till:
   staff check in with their PIN." without "it stays signed in, works
   offline" (step C), and the name has no hint about receipt numbers
   (receipts aren't numbered by till yet). "computer" at desktop width,
   "device" narrower, as drawn. *Pattern:* 28 Oct, PINs entry 8.
9. **The setup offers only a till**, not "a till or a workshop computer"
   (stage-1 gaps 4): the workshop computer is WP-1.7 task 3.6.
10. **A business with no shop set up yet** (WP-1.4 gives every business its
    first) sees no "Make this computer a till", and the setup page says
    "This business has no shops set up in Wheelhouse yet, so a till can’t
    be added here." Not drawn. New businesses have no site until WP-1.4;
    the test shop has Bolton.
11. **Staff opening the setup page see "Only the owner can add or remove
    tills."**, the drawn note from `set-till-tills`; on a computer that is
    already a till the page goes to the till. Registering a till needs the
    Owner's own sign-in, never a PIN (roles and switches 2).
12. **The till's name sits in the till's strip**, "Till B1" over "Bolton ·
    North Street Cycles", on the left, as the till bar draws it; the
    charcoal till bar itself (Online, Past sales) isn't built. *Pattern:*
    28 Oct, PINs entry 7.
13. **Tills in Settings shows the tills ("Till B1") or "None yet"**, and on
    a computer that's already a till only the drawn note. The list with
    Rename and Remove is WP-5.1. *Pattern:* `set-till-empty`'s "None yet".
14. **A name is up to 60 characters**; a blank one is none.
15. **Decided here, for Jack to overrule: nobody else checked in sets up a
    till** (review, 28 Oct). When someone other than the Owner is checked
    in by PIN on that computer, "Make this computer Till B1" is refused,
    even though the Owner is the one signed in: they switch to the Owner
    first. *Pattern:* giving a PIN at the till (`giverHere`); roles and
    switches 2. **For Jack (second review, 28 Oct), not changed:** a staff
    member can still get round this by ending their own check-in (Switch)
    first, then the Owner's sign-in sets up the till as before. That is
    design decision 7 as written (the Owner's sign-in is what's needed);
    whether to tighten it, for example by asking for the Owner's PIN too, is
    Jack's call.
16. **Re-claiming a till number is on the server only** (review, 28 Oct):
    the Owner can make a new computer Till B1 again, for a lost cookie or a
    replaced computer, and the old one stops being Till B1. The drawing's
    taken numbers are "In use" and can't be picked, so the screen waits for
    a drawing.
17. **A till switched off today keeps its line on Today**, with what
    happened on it; tills go in number order, B2 before B10, on Today and
    in Settings; the Owner's look at closing records no till (review, 28 Oct).
    It also records no person checked in, only the Owner's sign-in (its
    name is the same), so it adds no "Till · Not open yet" line to Today
    when every till is set up (second review, 28 Oct). *Pattern:* the float
    check's own "the sign-in's own name for a look at closing".

### 28 Oct 2026: the shared workshop computer, first part (`openspec/changes/workshop-computer`, `till-checkin-workshop`, the Working bar, `till-setup`; WP-1.7 task 3.6; walk-through 8 decisions 1, 3 and 4; build plan Q6; stage-1 gaps 4 and 10)

1. **This is the first playable part of task 3.6.** Built: a computer
   becomes a workshop computer, Enter your PIN with no till number,
   "Working: [name] · Switch" on every page, and back to Enter your PIN
   after 10 minutes idle. Listed as later tasks in the change: trust PIN and
   its settings (the two lines on `set-till-quick`), "Who's working?"
   (`till-checkin-workshop-names`), the Working pills
   (`workshop-working-pills`), the till's Serving pills
   (`till-serving-pills`), Owner and Manager pages asking for a PIN (stage-1
   gaps 1), and the diary's "Me" as the person working. The whole of 3.6
   was about 1,800 lines, over one piece.
2. **Trust PIN isn't built, so it is off for every shop**, which roles and
   switches 9 says means a workshop computer always goes back after 10
   minutes. Nothing about trust PIN shows yet. *Pattern:* show only what
   works (20 Oct, Settings frame 6).
3. **The server enforces the 10 minutes.** Each check-in on a workshop
   computer records when it was last used; 10 minutes later the server ends
   it, whatever the screen does, so nothing more is done as that person. The
   screen counts a press, click, tap, key or scroll as using it and tells
   the server at most every 30 seconds; it also goes back to Enter your PIN
   by itself at 10 minutes, and reads the check-in every minute. Just
   looking at the screen doesn't count as using it. Tills never go back by
   themselves. *Pattern:* the check-in's own day (28 Oct, PINs entry 3).
4. **A workshop computer is kept apart from tills**, in its own table and
   its own cookie (`wh_workshop`, 400 days, renewed when read, only its hash
   stored), so tills' numbers, float checks and Today's lines don't change.
   A computer is a till or a workshop computer, never both. *Pattern:* the
   till's own browser key (28 Oct, till-setup entry 3).
5. **Before anyone is working, Enter your PIN takes the place of every
   page**, with the bar and no sidebar, as drawn. The address stays, so the
   PIN opens the page that was asked for; the front page opens the diary
   (third walk, answer 8). Anything on screen that wasn't saved isn't kept
   when it goes back: pages save as they go. *Pattern:* the till's PIN
   screen in place of the till.
6. **The workshop PIN screen says only what works.** The bar reads
   "Workshop computer", "Bolton · North Street Cycles" ("Bolton" on a
   phone) and "Nobody working — enter your PIN" ("Nobody working" on a
   phone), with no Online pill (the till bar's isn't built either). The
   drawn line "What you do on this computer is recorded under your name and
   role." isn't shown: until task 3.8 the server records the sign-in, not
   the person working. No "Checked in today" and no "No PIN yet?", as drawn.
   *Pattern:* 28 Oct, PINs entry 8.
7. **"Working: Alex Morgan · Switch" runs across the top of every page**
   (stage-1 gaps 10), above the page's header, as the job pop-up draws it.
   Switch ends the check-in and goes back to Enter your PIN; a screen reader
   hears "Now working: Alex Morgan" (second walk, answer 10).
8. **Set up this computer offers "A till" or "A workshop computer"**
   (Jack approved it, 29 Oct, `docs/decisions/2026-10-29-answers.md`
   answer 1) (stage-1 gaps 4 says it offers both;
   not drawn) as pills under "This computer becomes", the till first and
   chosen. With the workshop computer chosen: the heading "Set up a
   workshop computer", the line "This computer becomes a workshop computer:
   staff work on it with their PIN.", the shop pills, "Name (optional)" and
   "Make this computer a workshop computer"; no till number. The name is
   kept but shown nowhere yet, as a till's. *Pattern:* the setup's own shop
   pills.
9. **Settings › Till › Tills doesn't offer "Make this computer a till" on a
   workshop computer**; its drawn note keeps its words ("It doesn’t show on
   a computer that’s already a till."). Opening the setup page there goes
   to Enter your PIN.
10. **Decided here, for Jack to overrule: on a workshop computer, Owner
    pages are the Owner's only while the Owner is the person working**
    (the lead, 28 Oct; it stands in for stage-1 gaps 1, an Owner or Manager
    PIN pop-up every time, until roles are built). A workshop computer is
    usually signed in as the Owner. There, the Owner's sign-in counts as the
    Owner only while the person checked in by PIN is the Owner; with nobody
    working, someone else working, or the Owner gone idle, it counts as
    staff. The server refuses every Owner-only route (`ownerOnly` and the
    routes' own Owner checks alike), and the screens show exactly what a
    staff sign-in sees: the Staff rooms in the menu, and "Settings aren’t
    part of your role" on Settings. When the Owner types his PIN, the Owner's
    pages are back. Tills and other browsers are unchanged. **For Jack:**
    the menu's footer still names the sign-in, so while Alex works on a
    computer the Owner signed in it reads "Jack Lewis · Staff"; Your settings
    belonging to the person working is walk-through 8 M3, a later task. *Pattern:*
    giving a PIN at the till (`giverHere`, 28 Oct entries 1 and 2: the PIN
    says who you are), and a staff sign-in's own pages. The Till page still
    opens on a workshop computer, as on a browser that isn't a till; whether
    a workshop computer may sell isn't decided. **Known limit, for Jack:**
    the rule rests on the workshop computer's own cookie. Someone who
    deletes that cookie from the browser, or pastes in a till's, makes the
    computer an ordinary browser again with the Owner's pages. It stops
    casual use, not a determined person; the lasting fix is the Owner or
    Manager PIN every time (stage-1 gaps 1) with roles.
11. **Giving a PIN is the till's**: the Serving menu's "Give a PIN" isn't
    offered on a workshop computer, and the server refuses it there.
12. **Someone else's PIN and settings can't be changed from a workshop
    computer** (the review, 29 Oct: staff working on the Owner's workshop
    computer could get the Owner a new PIN, then check in as the Owner).
    There, "Your till PIN" (see it, get one, keep it, and the first-time
    pop-up) and changing Your settings are refused unless the person
    working is the sign-in's own team member. Your settings can still be
    read, since every page uses them. On the screen, the Till PIN block
    doesn't show and "Your till PIN" never opens by itself for someone
    else. *Pattern:* walk-through 8 decision 3, no "Change PIN" on a shared
    computer.
13. **A workshop computer is no till on Today**: its check-ins are in
    Who's in and never make a "Till" line with no number (the review,
    29 Oct).
14. **The screen and the server end together** (the review, 29 Oct): the
    screen's 10 minutes run from the last time it told the server someone
    was using it, and a use it hasn't told yet is told within 30 seconds.
15. **If the computer can't read who is working, it shows no pages**: "Wheelhouse
    couldn’t check who is working on this computer. Try again in a
    moment." Who's signed in says whether the browser is a workshop
    computer, so this holds even when the check-in can't be read.
    *Pattern:* the frame's own "Wheelhouse couldn’t check who is signed in."
16. **"Now working: [name]" is said from one status region** kept from the
    PIN screen to the page, empty until the PIN, and Switch is a full-size
    target (44 pixels high) (the review, 29 Oct).
17. **Your settings on someone else's sign-in says so plainly** (the second
    review, 29 Oct). When a switch is changed on a workshop computer signed
    in by someone other than the person working, the page says "Your
    settings change only on your own sign-in. Change them on your own phone
    or computer." in the page's plain-message style (not the red "couldn’t
    save" line), the switches become unavailable, and "Changes apply
    straight away." goes. *Pattern:* Settings' "Only the shop’s owner can
    change settings for now." **Question for Jack, default taken:** should
    Your settings on a workshop computer belong to the person checked in by
    PIN (walk-through 8 M3) rather than the sign-in? Default until roles:
    the sign-in's settings, changed only by its own team member there.
18. **No float check on a workshop computer with nobody working** (the
    second review, 29 Oct), not even the Owner's look at closing:
    ownAccountHere's rule.
19. **Who's signed in says "workshop computer" only when the browser isn't
    also a till**: a till's key wins, as everywhere else.
20. **Known gap, for task 3.8: work done on a workshop computer is recorded
    under the sign-in's login**, not the person working: stock changes,
    stock takes, customer messages, receipt emails and no-shows, among
    others. Recording it under the person working is task 3.8.

### 29 Oct 2026: Today's stock warnings (`openspec/changes/stock-warnings-on-today`, `st-today-adjust`, `st-setting-adjust`, `st-today-below`; stock control decisions 6, 9 and 11; day answer 11; stock take task 4.2)

1. **"The manager's Today" is the Owner's, until roles** (WP-1.1), as the
   rest of Needs attention is (opening the shop decision 4). The setting,
   the two lines and Seen are the Owner's only. *Pattern:* the float's Seen.
2. **Worth is at cost** (`st-setting-adjust` says "At cost"): how many the
   adjustment moved times the product's cost, in whole pence, worked out
   when it is made and kept on the line, so a later change of cost doesn't
   change what Today says.
3. **Up as well as down.** A big Found goes to Today as a big Damaged does;
   decision 6 says "worth more than" without a direction, and the drawing
   shows the down case.
4. **Decided when it is made.** Whether an adjustment goes to Today is
   settled against the amount set at that moment. Setting or changing the
   amount later neither brings old adjustments onto Today nor takes lines
   off. "More than" is strict: worth exactly the amount stays off.
5. **Not set until the Owner sets it**, as the float: with no amount, no
   adjustment goes to Today, and the fold says "Not set yet". From £0.00 to
   £100,000.00, on the shop's row until the settings store (WP-1.2). The
   save takes the settings-saves-dont-clash lock (the shop's row read
   `FOR UPDATE`); it is one column, so this only keeps the save in the shape
   the other settings saves have.
6. **Settings gets its Stockroom room**, after Workshop as drawn, with only
   Stock adjustments in it. The area's words are cut to "Stock
   adjustments." until Categories (decision 10) is built. The fold's box is
   saved when it is left, as the Float box is.
7. **Only adjustments count**, not stock received, sold or counted: those
   aren't "adjustments" in decision 6.
8. **The line's words**: "Stock adjusted: [Product] −[n] · £[value]" as
   drawn, "+[n]" going up; the sub-line is the reason, then the note in
   quotes when there is one (as the float's reason), then "by [Name] at
   [time]", with the day too for an earlier day's (as the messages line).
   "By" is the sign-in that made it, as the product's history shows; on a
   workshop computer that is the sign-in, not the person (entry 20 above).
9. **Count them opens the below-zero count already counting**, if there
   is one, rather than starting a second; otherwise it starts one and opens
   its counting page (decision 11: "starts the count at once"). A refusal
   ("Nothing is below zero") shows in Needs attention's alert line.
10. **"[n] products below zero" counts what the below-zero count would
    count**: products on sale with stock under 0. "1 product" in the
    singular. The line stays while a count is under way, and goes when none
    are below zero (decision 9).
11. **See them opens Stock with Below zero picked**
    (`/workshop/stock?show=below-zero`), the filter decision 9 names.
12. **Order**: the two stock lines come after the lines Needs attention
    already had, below zero first, then adjustments oldest first, as the
    drawing's order puts below zero above the adjustment.
13. **A negative cost counts at its size** (the independent review, 29
    Oct). The product form saves a negative cost, and adjusting such a
    product failed; its value is now worked out from the cost's size (−£14
    counts as £14), chosen over counting it as £0 so a mistyped cost still
    warns. The product's cost itself is left as typed.
14. **Seen pressed already in another tab** is treated as done: the line
    goes, with no "couldn't record that" (review).
15. **Count them reads Today again first**, so a count finished since the
    page loaded isn't reopened; if the one remembered is no longer
    counting, a new below-zero count starts (review).
16. **Emptying the Stock adjustments box clears the amount**, back to "Not
    set yet", rather than saying "Pounds and pence" (review).

### 29 Oct 2026: trust PIN on the workshop computer (`openspec/changes/trust-pin-workshop`, `set-till-quick`, `till-checkin-workshop-names`; WP-1.7 task 3.6, later tasks 2.1 and 2.2; roles and switches 3 and 9; stage-1 gaps 9 and 10)

1. **The Signing in fold, no row drawn** (`set-till-quick` has the two
   lines only; stage-1 gaps 9 put them in their own fold after Tills): the
   settings pages' own switch, "Trust PIN", with "Once someone has typed
   their PIN on a workshop computer today, they tap their name instead. The
   owner still types theirs. One setting for the whole business."; with it
   on, "Go back to the start when left alone" as pills, "5 minutes", "10
   minutes", "15 minutes", "30 minutes", "Off", each saved when chosen; with
   it off, "Workshop computers go back to Enter your PIN after 10 minutes
   left alone." The summary: "Trust PIN off", "Trust PIN on · back after
   [n] minutes" or "Trust PIN on · never goes back". The drawn line's tills
   ("on a workshop computer or a till") wait for the till's pills (task
   2.4). *Pattern:* "Show prices on the booking page" for the switch, "Bikes
   are booked in for" for the pills.
2. **A time chosen with trust PIN on is kept when it is switched off**, and
   comes back when it is switched on again; while off, it is 10 minutes
   whatever is kept. *Pattern:* "A fixed amount" kept while the deposit is
   off (deposit settings).
3. **Stored on the shop's row**, as the float and the stock amount, until
   the settings store (WP-1.2).
4. **The Owner's own check-in on a workshop computer ends after 10 minutes
   left alone at most**, or the shop's time if that is shorter, whatever
   trust PIN's time is set to, Off and 30 minutes included (the review, 29
   Oct). Otherwise an Owner who walked away would leave the Owner's pages
   open to whoever is next. It lasts until Owner pages ask for a PIN every
   time (task 2.5). *Pattern:* trust PIN off's own 10 minutes (build plan
   Q6).

5. **The Owner is never a name to tap on "Who's working?"; the Owner types
   their PIN** (`till-checkin-workshop-names`). Roles and switches 3 says
   Owner and Manager pages still ask for that person's PIN every time; that
   isn't built yet (task 2.5), and on a workshop computer the Owner's pages
   follow the Owner working (workshop-computer design 9). A tap making the
   Owner the one working would open the Owner's pages, trust PIN's own
   setting among them, with no PIN. The server refuses a tap for the Owner
   too. Managers aren't stored yet. *Pattern:* the till's "Who’s getting a
   PIN?", which never lists the Owner (28 Oct, giving a PIN entry).
6. **"Who's working?" drops the drawn "Owner and manager pages still ask
   for your PIN."** until those pages do (task 2.5); the line is "You’ve
   typed your PIN here today, so just tap your name." Each name shows
   Mechanic or Staff from the team list, as the drawing's do, until roles.
   *Pattern:* show only what works (workshop-computer entry 6).
7. **Only a typed PIN puts someone on the names.** A check-in made by a
   tap doesn't count as having typed a PIN there, and a PIN cleared since
   takes them off until they type their new one. *Pattern:* clearing a PIN
   ends that person's check-ins (28 Oct, PINs entry).
8. **"Who's working?" shows after Switch too**, not only after the
   computer is left alone (stage-1 gaps 10: "Switch opens the existing
   Enter your PIN screen (with trust PIN on, the names to tap)"). With
   nobody on the names yet today, it is Enter your PIN.

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
10. **Undo puts back only what the merge changed, and only where nobody has
    changed it since**: a correction made after the merge stays.
11. **Undo goes newest first**: an older merge into the same record waits
    until a later one is undone. Undo also says so when the kept record has
    been switched off.
12. **A hidden record comes back only through Undo**, not by switching it on.
13. **A till that was offline finds the kept record**: its sales for the
    merged-away customer go to the one kept, and that customer sent again
    isn't made a second time, before and after the 30 days.

### 24 Oct 2026: the shop's deposit settings (`openspec/changes/deposit-settings`, `bk-settings-deposits`)

1. **The rows under "Take a deposit when booking" show only while it's on**
   (not drawn off), as "Drop off before the booking" shows only for set times.
2. **Deposits can be switched on before "How much" is filled in**, since its
   row only shows once they're on; until it is, no deposit is taken and the
   fold says "no deposit".
3. **A deposit is never more than the price shown**, for a fixed amount too:
   a £20 deposit on a £12.50 booking takes £12.50. A free booking takes none.
4. **"How much" is a whole percentage** (1 to 100), and amounts are typed in
   pounds and pence, from £0.01 to £10,000.
5. **Deposits only switch on while a payment provider is connected** (the
   website settings' "booking deposits are off, until you connect [payment
   provider]"); until a real account exists that is the pretend one, and
   only where it's asked for (`PAYMENTS_PROVIDER=pretend`: the tests, a
   developer's computer, the hosted test copy), never by a shop running for
   real (review).
6. **"For: Every booking / Chosen services" waits for the service editor**,
   which the new app doesn't have yet; until then every booking takes it.
7. **The note about declining shows only while automatic confirming is off**,
   as its own words say ("With automatic confirming off, …").

### 24 Oct 2026: paying a booking's deposit, the server (`openspec/changes/deposit-payments`, `bk-details-deposit`, `bk-checking-payment`)

1. **The card is held when the customer pays, and the money taken only once
   the booking is saved** (Stripe's held card payments). A booking that can't
   be saved, say the time went, lets the hold go, so nothing is taken and
   there's nothing to refund.
2. **The deposit is worked out by the server on the stored prices**, never
   from the booking page, and checked again as the booking is saved: if it
   has changed meanwhile, the customer is asked to pay it again.
3. **The pretend provider answers as Stripe's test cards**: 4242 4242 4242
   4242 is accepted, 4000 0000 0000 0002 is declined, anything else is "Check
   the card number". Its card form exists only while it's the provider.
4. **"Free to cancel until" is worked out at booking and kept on it**: the
   booked start less the shop's hours, in the shop's time zone; for a
   whole-day booking, from the start of the day.
5. **A hold with no booking an hour later is let go**, and a deposit the
   provider couldn't take as the booking was saved is taken, the next time
   deposits are held or booked (no timer yet) (review).

### 24 Oct 2026: paying the deposit on the booking page (`openspec/changes/deposit-pay-screen`, `bk-details-deposit`, `bk-card-failed`, `bk-checking-payment`)

1. **The pretend card form is one "Card number" box** in the drawn card
   form's place, saying plainly that payments are pretend while Wheelhouse is
   being built, nothing is taken, and which test numbers pay or decline.
2. **Pressing Pay with no card number says "Enter the card number"** and pays
   nothing, as the other boxes say what's missing.
3. **Once the deposit is paid, the button reads "Send request"** ("Book" when
   the shop confirms automatically), with "Paid. It's held until your booking
   is sent." in place of the card box, so a retry or a refresh never pays
   twice. The drawings don't show this state.
4. **A declined card can be tried again on the same payment**, as Stripe
   allows: typing another number and pressing Try again pays with it.
5. **"Free to cancel until" on step 4 is worked out in the shop's clock** from
   the booked time less the shop's hours, as the booking shows times; the
   booking itself keeps the exact moment.
6. **If the deposit can't be got ready** (no connection as step 4 opens), the
   page says "We couldn't get the deposit ready - please check your
   connection and try again" and its button reads Try again, sending nothing
   (review).
7. **A hold let go meanwhile** (an hour on, or a refused booking) is asked
   for again, saying "The deposit needs paying again — please press Pay."
   (review).

### 24 Oct 2026: the deposit on the booking page (`openspec/changes/deposit-booking-page`, `bookingLines`, `bk-request-deposit`)

1. **"Deposit paid" and "Free to cancel until" sit after When, before Your
   repair**, the drawing's order; the built page has no Extra work row there.
2. **The request's sentence joins the built page's own**: "Please wait for
   the shop to confirm … Check this page to see when it does. If we can't
   fit you in, your deposit comes back in full."
3. **Shown while the booking stands**; a cancelled or declined booking's
   deposit words come with refunds (part 3).

### 24 Oct 2026: refunding the deposit, the server (`openspec/changes/deposit-refunds`, `bk-cancel`, `bk-cancel-late`, `bk-declined`, `bk-staff-decline`)

1. **The shop cancelling a booking refunds the deposit automatically**, as
   declining and an expired request do: the customer was told it comes back
   in full if the shop can't fit them in. The decisions only cover declining.
2. **A late cancel needs the customer's own choice**: a cancel sent after the
   cut-off without "Cancel and lose the deposit" is refused, so a page left
   open from before the cut-off can't lose the deposit unawares.
3. **A refund owed is recorded with the cancel or decline**, then made, so a
   refund the provider can't make at once is made later, never lost; the
   booking page counts it as on its way back.
4. **The cut-off is judged by the server's clock**, as every other time rule.
5. **A moved booking's "Free to cancel until" moves with it**: the same hours
   before its new start, in the shop's time, however it was moved (review).
6. ~~A request the shop hasn't confirmed yet, cancelled after the cut-off,
   keeps the deposit.~~ **Overruled by Jack, 24 Oct**: a request the shop
   hasn't confirmed always gets its deposit back
   (`docs/decisions/2026-10-24-request-deposit-refund.md`).

### 24 Oct 2026: the deposit on the customer's pages (`openspec/changes/deposit-refund-pages`, `bk-cancel`, `bk-cancel-late`, `bk-cancelled`, `bk-declined`)

1. **Past the cut-off, "Free to cancel until" isn't shown** on the booking
   page, so it never reads as still free; the cancel pop-up says it instead.
2. **The late pop-up names the shop's number when the shop has one**, else
   says "call the shop".
3. **The green "will be refunded" note uses the page's "Booking confirmed"
   colours**; there's no separate success colour.

### 24 Oct 2026: the diary job's deposit, the server (`openspec/changes/deposit-diary-server`, `bk-staff-deposit…`, `bk-staff-no-show…`)

1. **"Didn't come" is a mark on the job, not a new booking state**: who and
   when; the booking otherwise stays as it was, and Undo clears the mark.
2. **Any signed-in member of staff can refund a deposit by hand**, as other
   job actions; the job shows who did it. The reason is needed, up to 200
   characters, and the whole deposit goes back (the drawing has no part
   amount).
3. **A deposit is "kept" once taken and the booking was cancelled late or
   marked Didn't come**; refunding it by hand afterwards makes it
   "refunded".
4. **Booking the bike in after all clears "Didn't come"**, and the deposit is
   then simply paid, as for any booking (review).

### 24 Oct 2026: requests and the cut-off (`openspec/changes/deposit-request-refund`)

1. **A booking confirmed at once by automatic confirming keeps its own
   cut-off**, without Jack's 1-hour window: it isn't a request, and the
   customer saw "Free to cancel until" when booking.

### 24 Oct 2026: the diary job's deposit, the job pop-up (`openspec/changes/deposit-diary-screen`, `bk-staff-deposit…`, `bk-staff-no-show…`)

1. **"Didn't come" is offered once the booked day has gone by the shop
   computer's own date**, as the diary reads today.
2. **The Undo bar after "Didn't come" stays until the job is closed**, as
   answer 9 has nothing close by itself; the drawing's note said "for a few
   minutes".
3. **Opened again later, a job marked Didn't come offers Book in** (the bike
   came after all, which clears the mark), not Put on hold.
4. **"Not come in" shows on any booking whose day has gone with the bike not
   in**, with or without a deposit; the deposit line shows only when it took one.
5. **The Undo on the "Marked Didn't come" bar is underlined text**, as the
   job's "Bike ready" Undo already is, rather than the drawing's lighter
   button: the colours stay the app's own named ones.

### 24 Oct 2026: Larger text (`openspec/changes/larger-text`, `ys-text`)

1. **Every text size is on one scale, 14 to 17 with Larger text on**, the
   same step for every size; the registry's controls too, so the app's copies
   still match them.
2. **The diary's hour column grows by the same step**, so its times aren't cut
   off; the days are then a few pixels narrower. Blocks keep their place down
   the day and their height.
3. **The page's own heading grows with the text**, so the diary starts a
   little lower on the page; nothing inside it moves.
4. **The preview's two lines stay at 14 and 17** whichever is on, so it always
   shows the difference.

### 24 Oct 2026: Don't close things by themselves, the screens (`openspec/changes/dont-close-screens`, `ys-wait`, `job-finished-wait`, `job-finished-sent`, `till-receipt-wait`)

1. **A held Bike ready shows again when the job is opened again.** The
   drawings show the strip just after marking the job ready. Without this,
   closing the pop-up first would leave Bike ready waiting with no Send now
   anywhere. The strip comes from the job's messages, and anyone who opens the
   job can press Send now or Undo.
2. **The sent line lasts while the pop-up is open**, as the minute's strip
   does; when the job is opened again, Messages still shows that it went.
3. **The job's Messages says a held Bike ready "waits until you press Send
   now"**, beside its Waiting label (pattern: "goes at 10:15"). It isn't
   checked every few seconds the way a message in its minute is.
4. **The till's switch is the signed-in person's**, as all of Your settings
   is until PINs; the cashier picked on the till doesn't change it.

### 24 Oct 2026: the test shop on the hosted copy (`openspec/changes/add-hosted-copy`, tasks 3.6a and 5.1)

1. **The test shop's four grouped services are bookable online**: Standard
   service, Brake service, Gear adjustment and Safety check, the ones the
   booking page draws (`book.mjs:48`, `:51`). Otherwise the online booking
   page would offer nothing on the test copy. Gear service, which only the
   diary's week uses, isn't. **Gap for later:** no screen lets a shop say
   which services can be booked online. Only the settings API sets it, so a
   shop that signs up can't take online bookings until that screen exists.
   It needs a drawing.
2. **The loader reads a snapshot of the drawings** (`scripts/dev/test-shop-drawings.json`),
   kept exact by a test (pattern: the route-list snapshot), because the app's
   image can't carry the 169 MB drawings folder.

### 24 Oct 2026: a Done tick and a note on each line (`openspec/changes/line-done-notes`, `job-overview`, `job-mechanic`, `job-waiting-parts`, `job-finished`)

The drawings show the Done and Note columns but not how they behave; each
follows the job checklist, the closest pattern built.
1. **Anyone signed in ticks or writes a note, and the latest change wins**;
   who ticked isn't recorded (waits for PINs, WP-1.7).
2. **Neither changes once the work is finished**, until it's reopened, with
   "Reopen the work to change its Done ticks and notes." under the table.
   The drawings show ticks on `job-finished`, as a picture of the state.
3. **A note is added with "+ Add note"** and saved when its box is left; a
   note already there is pressed to change it. Nothing is drawn for editing.
4. **A line starts unticked**, even one approved on a quote. The drawings
   draw approved lines ticked, but ticking is the mechanic saying the work is
   done.
5. **The phone keeps the existing table**, which scrolls sideways, rather than
   the drawn row cards, which aren't built for any column yet.

### 24 Oct 2026: the till's Email receipt button (`openspec/changes/till-email-receipt`, `till-receipt`, `cp-receipt-address`)

1. **The row is Print · Email · No receipt.** The drawn Text button waits
   for texting, which has nothing on the server yet.
2. **"Save to a customer record" and its "Add a customer" pop-up come
   later**, as a piece of their own; the till can't add a customer yet. With
   no customer on the sale, the address is used for this receipt only, as the
   decision says.
3. **Sending, sent and a failure aren't drawn.** "Send receipt" reads
   "Sending…" while it sends (pattern: the booking page's buttons). A
   refusal shows in the pop-up in the server's words, and a bad address shows
   under the box.
4. **Once sent, the next sale starts**, as the drawing goes to the empty till.
   With "Don't close things by themselves" on, Paid stays and says "Receipt
   sent to [address]." (pattern: Print with the setting on).
5. **Cancel lets the countdown carry on** from where it stopped.
6. **The pop-up says "Sale [n]"**, not the drawn "B1-[0000]", as the printed
   receipt does until the sale records a receipt number.
7. **The browser's own email check is off**, so the drawn "That doesn't look
   like an email address — check it" shows instead of the browser's pop-up.

### 24 Oct 2026: a deposit paid online comes off at the till (`openspec/changes/till-online-deposit`, `till-job-balance`)

1. **The deposit is recorded as its own payment, "Deposit paid online"**, as
   the receipt drawing shows it (`collect.mjs:204`). The server works it out
   from the payment record; anything the till claims is ignored.
2. **Only a deposit taken counts.** A card only held isn't charged yet, and
   a refunded, owed or kept deposit doesn't come off.
3. **The line reads "[date] · online"**, where `till-job-balance` draws
   "[date] · card" for a deposit taken at the till, which isn't built yet.
   Total and Take payment show what's left, as the discounts already do.
4. **A deposit larger than the bill** (work declined after booking) counts
   up to the bill, and the till says "The deposit is more than the bill:
   [£n] isn't paid back here yet." **Gap for later:** paying the difference
   back needs a decision.
5. **The day's takings** count the deposit once, in the sale, under its own
   name. Nothing else counts the online payment.
6. **A deposit card only held, never charged, is let go when the job is paid
   in full at the till** ("Paid in full at the till"), so it can't be charged
   on top later (review).
7. **A refund pressed while the till takes payment waits its turn**, so a
   deposit is never both counted and refunded (review).

### 24 Oct 2026: Save to a customer record from the till (`openspec/changes/till-save-customer`, `cp-receipt-address`, `cp-receipt-address-save`)

1. **The new customer isn't attached to the sale.** The decision doesn't say,
   and nothing can attach a customer to a finished sale yet, so the sale stays
   with no customer. Jack to overrule.
2. **Closing Add a customer (Escape or outside it) counts as Not now**: the
   receipt stays sent and no one is added.
3. **A customer with the same email may already exist**; Add the customer
   adds a new record anyway, as the customer form does, and Customers' Merge
   joins them.

### 24 Oct 2026: "You didn't finish booking" (`openspec/changes/booking-draft-resume`, `bk-resume`)

1. **An unfinished booking is kept on the customer's device for 7 days**,
   then thrown away. The decision says "coming back later" without a time.
   7 days keeps a shared computer from holding someone's name and number for
   long. Jack to overrule.
2. **It comes back on the step it was left on**, as drawn, and only on a new
   tab or visit: a refresh in the same tab carries on without the banner, as
   it always has.
3. **Photos aren't kept**, as before; the bike step already says they need
   adding again.

### 24 Oct 2026: workshop amounts in pence, the screens' totals (`openspec/changes/wp-1-6-sales-in-pence`, task 2.2; `job-quote`, `dq-quote`, `dq-in-shop`)

1. **The job page's Proposed total comes from the server**, worked out from
   the pence: the order, any booked service not on it yet, and the quote's
   lines not on the order yet (waiting for an answer, or said yes to one at a
   time before the whole answer adds them). For a draft that is the whole bill the
   limit is checked against, as before. For a sent quote the screen used to
   add only the order and the waiting lines, so a quote sent before the
   booked service joined the order showed less than its draft had; it now
   counts the booked service too, the same bill either way.
2. **The customer's Approve total is added up in whole pence**: what was
   agreed before (now sent in pence too) and each ticked line's pence, which
   the server worked out. Their ticks change it as they go, so the server
   can't send one figure for every choice; adding whole numbers is exact.
3. **Work agreed's total on the booking page comes from the server**: its
   lines' pence summed, none with prices hidden online, as each line's price
   is hidden.
4. **A price is under £1,000,000** (fresh review): the pence are whole
   numbers that stop at £21,474,836.47, so a service's price, a quote line's
   price or total, or a quote's lines together, of £1,000,000 or more is
   refused in plain words rather than failing; no bike shop charges that. A quoted part needs a quantity of 1 or
   more, so a part isn't quoted at £0.00 and then charged as one.

### 25 Oct 2026: saying yes to service reminders when booking (`openspec/changes/reminder-consent`, `ac-book-remind`)

1. **Not ticking isn't a "stop".** A customer who said yes before and books
   again without ticking keeps their yes; "Stop these" and the account are
   where it goes off (decision 6). The tick always starts unticked, as drawn.
2. **The yes is kept with when and where** (booking or collection), so a
   yes to being contacted can be shown later.

### 25 Oct 2026: Settings › Workshop › Services, the list and the box (`openspec/changes/services-room`, `set-workshop-services`, `ac-service-edit`)

1. **Edit and Remove always show**, as Checklists' rows do, rather than on
   hover at a desk as drawn.
2. **No "+ Add a group" and no handle to move services yet.** The groups
   are the two kinds the app has, and the server lists services by name;
   neither is drawn beyond its button. Both are for later.
3. **"+ Add a service" opens the same box empty, titled "New service"**, in
   the group chosen, with "Customers can book this online" on (not drawn;
   as Checklists' "New checklist", and the walk-through's "on unless
   switched off").
4. **Remove doesn't ask first**, as Checklists' Remove doesn't. The service
   is only switched off: it leaves the list and online booking, and past
   jobs keep it. There is no way to bring one back on screen yet.
5. **An empty price is refused** with the shop's own words ("A service
   needs a price of zero or more"), rather than saved as £0.00.
6. **This is where a shop now chooses which services can be booked online**,
   the gap logged on 24 Oct, using the walk-through's line for the box.

### 25 Oct 2026: when each service's reminder is due (`openspec/changes/service-reminder-months`, `ac-service-edit`, `ac-services`)

1. **Months from 1 to 60, or empty for none.** 60 (five years) is a ceiling
   chosen here to catch a slip of the keyboard; 0 is refused, as empty
   already means no reminder.
2. **The box's drawn line "The wording is in Settings › Messages › Service
   reminder." waits** until that message exists, so it doesn't point at
   nothing.

### 25 Oct 2026: sending service reminders (`openspec/changes/service-reminder-send`, `ac-reminder-wording`, `set-msg-list`; Jack's answers 1 to 4 of `2026-10-25-morning-questions.md`)

1. **The email's subject isn't drawn**: "Your [Bike] is due its [Service]
   — [Shop name]", as the other messages' subjects read.
2. **"Stop these: [link]." keeps the full stop** the drawn preview ends
   with, after the shop's wording, on every reminder and in the preview.
3. **Both links read "[link]" while sending is pretend**, as every pretend
   message's do; the booking landing and the stop page are the next pieces.
4. **A shop open no day of the week** sends on the due day at its usual
   opening time; otherwise the first open day within a week.
5. **A job with no bike keeps its own reminder** (one per bike can't match
   it), and when it's due it is still checked for the customer's yes, the
   message being on and the job still collected.
6. **The shop removing a service's months** before it's due means the
   reminder doesn't go, as no service names it any more.

### 25 Oct 2026: "Stop these" for service reminders (`openspec/changes/stop-reminders`, `ac-stopped`, `ac-stopped-on`; Jack's answer 5)

1. **The page that asks first isn't drawn**: "Stop service reminders?",
   "We’ll stop sending you service reminders from [Shop name]. Job updates
   about a bike that’s with us still come as usual.", and one button, "Stop
   service reminders", laid out as the drawn stopped page.
2. **A link that doesn't work** says "This link doesn’t work" and "Check you
   opened the whole link from your message.", showing nothing about anyone,
   as the photo step's spent code does.
3. **The heading sits above the round tick**, as the booking pages' frame
   and the photo step's finished page lay it out, rather than under it as
   drawn.
4. **The drawn "Sign in to your account" line waits** for the customer's
   account (the emailed-code sign-in, WP-1.7).
5. **A stop link never runs out** (a reminder can be months old) and can be
   used again: stop, turn back on, stop. Stopping turns off service
   reminders only; review requests will have their own stop.
6. **The link is made when the reminder is set up and kept with it**, as
   the timer that sends it has no web address to make one from; while
   sending is pretend it reads "[link]", as every pretend link does.
### 25 Oct 2026: the reminder tick on the in-shop ready page (`openspec/changes/ready-remind-tick`, `ac-collect-remind`, `cp-summary-said-yes`; Jack's answer 8)

1. **It ends the "To pay when you collect" card, above a line**, as drawn in
   the pay-online card; the paid card has none, as drawn.
2. **Ticking saves at once**: the card has no button to send it with.
   Unticking says no, the customer's own answer on this page (unlike not
   ticking when booking).
3. **The tick stays in front of the customer once ticked**, rather than
   turning into the said-yes line under their finger; the said-yes line
   shows the next time the page opens.
4. **Change shows the tick, ticked, in place**; the drawing doesn't say
   where Change goes.

### 25 Oct 2026: merging two customers keeps a yes (`openspec/changes/merge-keeps-yes`; Jack's answer 9)

1. **When and where the yes was given** come from the record whose yes to
   service reminders it is, else the one whose yes to review requests it
   is, the kept record first when both did.
2. **A kept record that stopped reminders still becomes yes** if the other
   record says yes, as the answer reads: a stop doesn't record when it
   happened, so there's no telling which came later.
3. **Undo puts the four answers back together or not at all**: once the
   customer has changed any of them since the merge, they stay as they are,
   so a yes never loses its date.

### 25 Oct 2026: review requests, the message and when it goes (`openspec/changes/review-requests`, `ac-review-first`, `ac-review-setting`; decision 5)

1. **The days start at 2**; the drawing shows "[n]". From 1 to 60.
2. **It goes when the shop opens** on the day those days after collection
   come round (or the next open day), as service reminders do (Jack's
   answer 4).
3. **Clearing the review page while review requests are on is refused**:
   "Switch review requests off first."
4. **The email's subject isn't drawn**: "Thanks for coming to [Shop name]".
5. **The stop page for review requests isn't drawn**; it reads as service
   reminders' does, with review requests' own name (audit M5): "Stop review
   requests?", "Review requests stopped", "We won’t ask you for reviews any
   more…", "Review requests are on again", "We’ll ask for a review after you
   collect your bike…".
6. **A review page must be a whole web address** starting http:// or
   https://; anything else is refused with "Paste the whole link to your
   review page, starting https://".

### 25 Oct 2026: the review request's box in Settings › Messages (`openspec/changes/review-box`, `ac-review-first`, `ac-review-setting`)

1. **The switch can go on once the page box has something in it**, typed
   or saved; the drawn line ("Add your review page first, then switch this
   on.") shows until then.
2. **Clearing the page while it's on switches it off as it saves**, so the
   shop never refuses the save.
3. **A refusal shows the shop's own words**, in the box and from the
   message's own On switch in the list ("Add your review page first, then
   switch this on."), rather than "Wheelhouse couldn’t save that".
4. **Only a text preview**, as drawn; the plain wording box also shows an
   email preview.

### 25 Oct 2026: a bike's own page (`openspec/changes/bike-page`, `cs-bike`; Jack's answer of 15 Oct, not-drawn pages 7 and 8)

1. **The bike's Edit box isn't drawn**; it follows the customer page's Edit:
   "Edit bike", "Nothing changes until you save", Make, Model, Colour, Frame
   number and Note, Cancel and Save, the server's refusal shown in the box.
2. **The Warranty block is left off** until a bike can be bought here:
   nothing records a bike's purchase yet, so there is no date to show.
3. **New job from a bike's page opens with that bike chosen** as well as its
   owner, as New job from a customer's page opens with them.
4. **The jobs list is "Jobs on this bike"**, split as the customer page's
   history is: "Open now", then "Earlier, newest first", eight shown with
   "Show all ([n])".

### 25 Oct 2026: finding a bike in the header search (`openspec/changes/bike-search`, `staff-search`; Jack's answer of 15 Oct, not-drawn pages 7 and 8)

1. **The Bikes group isn't drawn**; it comes after Customers, its rows as
   theirs are: the bike's name, opening its page, with "[Owner] · [Colour] ·
   [Frame number]" under it, leaving out what's blank.
2. **The box is now named "Search jobs, customers and bikes"**, saying what it
   finds so far, as it did before; the drawing's name lists orders and
   products too, which join as they're built.
3. **A bike is found by make and model or frame number, not by its owner's
   name**: the owner is found under Customers. A removed bike, or a removed
   customer's, isn't found.

### 25 Oct 2026: customers sign in with a code sent by email, the server (`openspec/changes/customer-code-signin`, `cust-signin`, `cust-code`, `cust-code-expired`; signing-in decision 5)

1. **A wrong code isn't drawn**; it reads as the drawn expired one does:
   "That code isn’t right. Check it, or send a new one".
2. **The fifth wrong try uses a code up**; after that it reads as expired,
   with "send a new one".
3. **A switched-off account is refused** once its code is right: "This
   account can’t sign in. Ask the shop".
4. **Too many asks or tries**: "Too many codes asked for. Wait a few minutes,
   then try again" (5 per email, 10 per network, in 15 minutes) and "Too many
   tries. Wait a few minutes, then try again" (30 checks per network).
5. **With no sign-in provider connected** (until WorkOS is), asking for a code
   says "Signing in by email isn’t switched on yet", as deposits stay off
   with no payment provider.
6. **A first sign-in makes a customer with no name**, only the email, as
   password sign-up makes a new customer and never joins one the shop already
   has. For Jack: these show on the Customers page with a blank name until
   the account pages ask for one.

### 25 Oct 2026: the sign-in screens (`openspec/changes/customer-signin-screens`, `cust-signin`, `cust-code`, `cust-code-expired`)

1. **In the booking pages' frame, not the website's**: the shop's website
   frame, with Account in its header, isn't built yet, so sign-in sits in the
   frame the stop page uses (the shop's name at the top).
2. **"Send a new code" says "We sent a new code to [email]"** and empties the
   boxes; not drawn.
3. **The keyboard lands on "Enter your code", not in the boxes**, as on every
   booking page (d2: the frame puts focus on each new heading). For Jack: on a
   phone that is one tap on the boxes before typing; putting the keyboard
   straight in the boxes would change d2 for this page.
4. **With no page to return to, or one that isn't this shop's own**, sign-in
   goes on to the shop's booking page, `/book/[shop]`.

### 25 Oct 2026: staff sign in through WorkOS, the server (`openspec/changes/staff-signin-workos`; signing-in decision 2; WorkOS only, Jack 25 Oct)

1. **WorkOS's sign-in comes back to `/api/auth/workos/callback`**, and starts
   at `/api/auth/workos/start`, not `/callback`: only `/api/` addresses
   reach the sign-in routes. For Jack: WorkOS's Staging Redirects need these
   two addresses (on `localhost:8080`).
2. **A sign-in lands on the staff app, `/workshop`**, not the old app at
   `/`, whose password box no longer works. Signing out goes to WorkOS's
   sign-out and back, or to `/workshop`. **A failed sign-in goes back to the
   staff app with its reason**:
   `off` (nothing connected), `failed` (a link this browser didn't start, or
   a code WorkOS refused), `unchecked` (WorkOS hasn't checked the email),
   `not-on-staff` (no active person with that email, or the person is linked
   to someone else: one answer for all), `busy` (10 tries per network in 15
   minutes). The wording on screen comes with the screens change, following
   `auth-signedout`.
3. **The pretend WorkOS page** asks only for an email, with "WorkOS has
   checked this email" ticked, for building and tests without the internet.
   It never runs in production.
4. **Password sign-in answers "Staff sign in through WorkOS now"**, the route
   kept so the old app and the label printer helper get a clear answer.

### 25 Oct 2026: the staff sign-in screens (`openspec/changes/staff-signin-workos-screens`, `auth-signedout`, `auth-expired`)

1. **A failed sign-in's words** (not drawn), in the drawn frame, one button
   each, following the customer sign-in's messages:
   - "That email isn’t on a staff list": "Sign in with the email your shop
     has for you, or ask the shop’s owner to add you." · Sign in again
   - "Check your email first": "WorkOS sent you an email to check it’s yours.
     Open it, then sign in again." · Sign in again
   - "Too many tries": "Wait a few minutes, then try again." · Try again
   - "That sign-in didn’t work": "Please try again." · Try again
   - "Signing in isn’t switched on yet": "Ask whoever runs Wheelhouse for
     your shop." No button: it would only come back here.
2. **Opening the staff app when not signed in goes straight to WorkOS's
   page**, with no "You're signed out" first, and back to the page opened
   after signing in (fewest clicks). "You've signed out" shows only after
   signing out, and "Please sign in again" only when a session has run out.
3. **"You've signed out" has its own address, `/workshop/signed-out`**, where
   WorkOS's sign-out comes back. For Jack: add
   `http://localhost:8080/workshop/signed-out` as a Sign-out URI in WorkOS's
   Staging Redirects.
4. **No logo** on these pages: the frame's logo slot shows the word
   Wheelhouse only, as no logo file exists.

### 26 Oct 2026: the customer's account, the server (`openspec/changes/customer-account-server`; Jack's answers in `2026-10-26-customer-account.md`)

1. **A repair opened from the account doesn't expire for its owner.** The
   private link stops working 30 days after collection; a signed-in customer
   can still open their own past repairs from the account.
2. **Cancelling from the account links the cancellation message to the
   account** (`/book/[shop]/account`), not to the job, since a job's
   account address only opens for its signed-in owner. While sending is
   pretend, every message's link reads "[link]".
3. **A repair's total in the history** is what was paid, or else Work
   agreed's total; with Show prices off it is left out, as on the repair page.
4. **Purchases** list what was bought, comma-separated, from either sales
   record; a till sale carries its receipt number, an old sale none.
5. **After the review:** an action through the account (not a page load) from
   another website is refused; account answers are never kept by the
   browser; loading one's own repairs doesn't count toward the private links'
   "too many attempts" limit. An email staff type in, or change, is marked
   as not the customer's own (Jack's option 2), so a code sign-in never joins
   that customer.

### 26 Oct 2026: the customer's account, the screens (`openspec/changes/customer-account-screens`, `ac-account`, `ac-account-repairs`, `ac-account-new`)

1. **Left out until their pieces are built:**
   - "Ask the shop a question";
   - store credit;
   - the warranty and "next service due" lines;
   - "+ Add a bike";
   - Edit and Change for details and contact choices;
   - a purchase's receipt;
   - Your data.

   Each part shows only when its server work exists, so nothing on the page
   is a button that does nothing.
2. **A purchase's number** is the till's receipt number, or "No. [id]" for
   an old sale. The drawn "B1-[0000]" waits for till receipt codes.
3. **A repair's chip** is the tracker's current step: Booked, In the shop,
   Being worked on or Ready. Its past line is "[date] · collected", or
   cancelled, declined or request expired.
4. **Signing in with no page to return to** now lands on the account
   rather than the booking page.
5. **The account is the only customer page wider than a phone.** It has two
   columns from 1024px, as drawn. Every other customer page stays
   phone-width.
6. **With nothing earlier yet**, the history leaves out the "Earlier, newest
   first" heading. An empty name or mobile shows as a blank row.
7. **Still to do:** a repair opened from the account still says "Keep this
   link to check your booking" with Copy link. That link only works for the
   signed-in owner.

### 26 Oct 2026: a sale from a customer's history (`openspec/changes/customer-sale-dialog`, `cs-sale`)

1. **"Refund at the till" is left out** until refunds exist; Close stands in.
2. **"Till B1"** isn't on the pop-up: neither sales record holds which till
   a sale was on yet.
3. **A till sale has no "Print the receipt"** until the new record's receipt
   exists (step C); its pop-up shows the lines, total and how it was paid.
4. **The history lists till sales too**, with their receipt number ("Sale 12"),
   alongside the old record's ("Sale [id]").

### 26 Oct 2026: customer groups in Settings (`openspec/changes/customer-groups-settings`, `cs-groups`)

1. **Settings › Front desk › Payments shows only Customer groups** for now
   (stage 1 drawing gaps decision 6, "show only what works"): the card
   machine and ways to pay come with their pieces.
2. **The group's box isn't drawn**: Name and "% off", Save, and "Remove
   group" for an existing one, following the Services box.
3. **Removing a group** leaves its customers in no group, as the server
   already did; no confirmation step, as Services' Remove has none.
4. **With no groups** the fold's summary reads "No groups yet".

### 26 Oct 2026: booking search and "Online booking is unavailable" (`openspec/changes/booking-search-unavailable`, `bk-service-many`, `bk-unavailable`)

1. **The search box shows when a shop has more than 8 single jobs**, about
   one phone screen of cards. The drawing shows the box but not when it
   appears.
2. **A job matches when its name has every word typed**, in any order,
   ignoring case. Full services always show. A ticked job stays ticked
   while the search hides it.
3. **With nothing matching**, a line reads "No single jobs match “[what was
   typed]”." Not drawn.
4. **No "Show all [n] individual services" link.** The built list already
   shows every job, and the search narrows it.
5. **"Online booking is unavailable just now"** replaces "We couldn't load
   this shop's services". "Try again" stays. The drawn shop name, address
   and phone can't show: they come with the services that failed to load.

### 26 Oct 2026: a shop's own automatic messages, the server (`openspec/changes/own-messages-server`, `set-msg-new`; Jack's answers in `2026-10-26-receipt-and-own-messages.md`)

1. **They only go while the shop is open.** Anything that comes due
   overnight goes when the shop opens, as service reminders do.
2. **Only things that happen after a message is set up count.** The same
   goes after its timing changes or it's switched back on. Otherwise a new
   "6 months after collection" message would go to everyone from the last
   six months at once. New words alone don't restart the count.
3. **Which way it goes:**
   - the customer's own way, if the message goes that way (text covers
     WhatsApp);
   - otherwise the message's other way, if the customer has it;
   - otherwise not at all.
4. **"Before a booked job"** counts only confirmed bookings and ones waiting
   on a date change, and only while the bike isn't collected.
5. **The limits:** 1 to 365 days, or 1 to 24 months.
6. **The stop page,** for one of these messages, reads "Stop “[name]”?",
   following the review request's page; its button is "Turn it back on".
7. **After the review:**
   - a stop moves with a customer merge, and Undo takes it back;
   - "Before a booked job" also reaches a booking made after the message was
     set up;
   - a change that leaves out On or Off keeps it as it was;
   - once sending is real, the job's link is made only after the message is
     saved.

### 26 Oct 2026: a shop's own automatic messages, the screens (`openspec/changes/own-messages-screens`, `set-msg-new`)

1. **Each own message is a row under "Your own messages"**, after the
   built-in ones. The row reads like this: "6 months after a job is
   collected · by email". It has Edit and On or Off, as the built-in rows
   do.
2. **Edit opens the drawn box again,** with Remove, Cancel and Save (Jack's
   answer 4). The drawing shows only adding.
3. **The number's label** reads "How long before" when "Before a booked
   job" is chosen.
4. **No preview.** None is drawn for this box; the built-in messages' box
   has one.

### 26 Oct 2026: a repair opened from the account (follow-up to `customer-account-screens`)

1. **A repair opened from the customer's account** (`job-<id>`) no longer
   says "Keep this link to check your booking" or offers Copy link. That
   link works only for the customer, signed in. It shows "Your account"
   instead, a way back to the account, as the question page's back link
   is drawn (`ac-question`).

### 26 Oct 2026: adding a bike (`openspec/changes/add-a-bike`, `cs-page`, `ac-account`; not-drawn pages 16, 17 and 23)

1. **Staff "+ Add" beside Bikes** opens "Add a bike". It has the new-job
   dialog's fields (Make, Model, Colour, Serial number), with Cancel and Add
   bike.
2. **The account's "+ Add a bike"** opens "Add a bike". It has the booking's
   fields ("Make and model", "Colour, or anything that helps us spot it").
   The make and model are saved as one, as the booking's guest bike is.
3. **The account's add-bike route** refuses another website, as the
   account's job actions do.

### 26 Oct 2026: next service due on the account (`openspec/changes/next-service-due`, `ac-account`, audit L10)

1. **The date shown** is the day the bike's waiting service reminder goes:
   its collection date plus the service's months, moved to the first open
   day, in the shop's time zone. If a bike has more than one waiting, the
   soonest is shown.
2. **The year always shows** ("Wed 17 Mar 2027"), since a next service is
   months away.
3. **Nothing shows while the customer's service reminders are off.** The
   server sends no date then either.
4. **After the review:** no date shows for a reminder the sender will undo
   when its day comes, because the bike has been booked or collected again
   since.

### 26 Oct 2026: how we contact you (`openspec/changes/how-we-contact-you`, `ac-contact`, `ac-contact-changed`; account and reminders decision 6)

1. **Text or WhatsApp with no mobile on record** is refused: "We don’t
   have a mobile number for you, so we can’t text you." The account can't
   add a mobile yet, as editing details isn't built.
2. **The status line** after each change says what changed. "Service
   reminders are off" is drawn. "… are on" and "Job updates will come by
   email" follow it.
3. **Saying yes to reminders or review requests here** is recorded as a yes
   from the account (migration 086).
4. **The stop page's "Sign in to your account" line** shows once anything
   is stopped: service reminders, review requests, or one of the shop's own
   messages.
5. **After the review:**
   - "WhatsApp" keeps its capital in a sentence;
   - a yes is stamped only when both switches were off, so an earlier yes
     keeps when and where it was given;
   - the buttons stay focusable while a change saves;
   - a sign-in that has run out says "Please sign in again to change this."

### 26 Oct 2026: the diary's legend as a box (`openspec/changes/diary-legend-box`; Jack's option 2, "Legend", per person)

1. **Below 1024px wide,** where the left-hand column is folded away (an
   upright tablet), the legend sits under the toolbar, along a line or two.
   It isn't at the bottom of the diary any more.
2. **No "Show the diary legend" switch on a phone,** where the diary has no
   legend, as with Folded sidebar.



### 26 Oct 2026: the stock list and product page (`openspec/changes/stock-list`, `st-list`, `st-product`, `st-product-staff`, `st-product-bike`; slice C, WP-2.1, the 26 Oct defaults)

1. **Prices are shown, not edited**, until products move to pence (WP-1.5).
2. **Left out because they change things:** + Add a product, the tick
   boxes and their bar, Edit, Adjust stock and Send to another shop. Adjust
   stock is the next piece, so its button is left out rather than linked to
   nothing.
3. **Left out until WP-1.5:** the Category pill, each category's details
   (the Details box and detail columns), and sizes and colours.
4. **Who sees what:** everyone signed in sees Stock and a product's page.
   Margin, Cost and Show on website show to the Owner only, as roles aren't
   built (stock decision 11 says Owners and Managers). The product page's
   read sends no cost to anyone else. The list still reads the existing
   `/api/products`, which sends cost to every signed-in person, as it did
   before; hiding it there waits for roles (WP-1.1).
5. **The search** finds a name, barcode, the product's code (`sku`, shown
   where the drawing has the supplier code) or the supplier. Its
   placeholder doesn't mention measurements, which can't be searched yet.
   The scan icon is left out: a scanner types into the box.
6. **Running low** is the Overview's rule: a low-stock level above 0, and
   stock at or under it. Below zero is anything under 0.
7. **Margin** is on the price before VAT, at the product's own VAT rate, as
   the old app worked it out; rounded to a whole percent. No price shows
   "—".
8. **The list shows 50 products**, then "Show all ([n])", as the bike page
   does with its jobs. Every heading sorts; Product, A to Z, to start.
9. **Nothing to show:** "Nothing matches “[what was typed]”" with "Check
   the spelling, or try a supplier code or a supplier."; "No products yet"
   with no buttons (both drawn buttons add products); "Nothing is running
   low" and "Nothing is below zero".
10. **The product's page** follows the bike and customer pages: "‹ Stock",
    the product's name as the heading, and Stock in the page's title bar
    (the drawing puts the name there).
11. **In stock** names the shop, not a site, since stock is one count for
    the shop. The "held for a job" line is left out: nothing holds stock
    for a job yet.
12. **The photo** shows only when there is one. No "[Photo]" box.
13. **Stock history** names each line by what happened (Sold, Returned,
    Received, Booked in, Adjusted, or Stock changed), with its note and
    when. Who did it isn't recorded, so it isn't shown, and no line links
    anywhere yet (there's no sale, delivery or count page). Price changes
    aren't recorded, so that filter is left out. Returns count under Sold;
    Booked in under Received.
14. **A bike's page** is a product's page: nothing records a stock bike's
    frame numbers yet, so "Bikes by frame number" is left out.
15. **A product taken off sale** still opens, with "Taken off sale" under
    its name.
16. **After the review:** a product with no cost recorded (saved as 0) shows
    no margin ("—"), not 100%. A product's page shows its newest 200 stock
    movements. "%" and "_" in a stock search are searched for as
    themselves.

### 26 Oct 2026: adjusting stock (`openspec/changes/adjust-stock`, `st-adjust`, `st-adjust-faulty`; slice C, WP-2.1, the 26 Oct defaults)

1. **Who can adjust:** anyone with the Stock page, every adjustment
   recording who, the reason and when (Jack's answer, 26 Oct:
   `2026-10-26-day-answers.md` section 11).
2. **The change starts at −1, as drawn,** and "In stock after" shows the
   count it leaves; typing either sets the other. − and + step the change.
3. **Adjust is greyed and says why,** as UX walk-through 3 L4 draws for no
   reason: "Type the change" (none, or 0), "Stock can’t go below zero",
   "Pick a reason to adjust", "Write a note for Other", checked in that
   order.
4. **A reason that doesn't fit the new sign is unpicked** when the change
   flips (Damaged going up); Other, which fits both, stays.
5. **Below zero:** an adjustment can't take stock under 0, as the old
   route refused. Going up is always allowed, so Found works on a product
   already below zero.
6. **Faulty — to return to supplier is recorded as the reason only.** The
   To return list in Deliveries and orders isn't built, so the box leaves
   out both lines that promise it (the note under the reasons, and the
   panel in `st-adjust-faulty`).
7. **"big changes show on the manager’s Today" is left out** of the last
   note: it waits until Today's stock warnings are built (section 11 of
   `2026-10-26-day-answers.md`), with its Settings › Stockroom amount.
8. **After Adjust** the box closes and the page shows the new stock and
   the new history line; no toast, as none is drawn.
9. **History lines:** an adjustment with a reason reads "Adjusted ·
   Damaged", its note "Note: [note]", then who and when, as `histRow`
   draws. Lines from before this piece, and sales and till sync (Mark's
   step C), record no one, so they show no name.
10. **The old app's booking in** (`type: intake`) through the same route
    needs no reason and records who, but only adds stock; any other type is
    refused (review, 26 Oct).
11. **The change is a whole number up to 100,000 either way**, and a note
    up to 500 characters (review, 26 Oct). No count in a bike shop comes
    near 100,000; the cap keeps a mistyped number from reaching the
    database.
12. **"In stock after" sends a change, worked out when the box opened.** A
    sale made while the box is open makes the result one lower than typed.
    Kept, not built around: sending a change is what lets two adjustments
    at once both count (review, 26 Oct).
### 26 Oct 2026: the print agent removed (`openspec/changes/drop-print-agent`; Jack's decision in `2026-10-26-day-answers.md` section 5)

1. **Removed:** the label printer helper (`print-agent/`), its four
   `/api/print-agents` routes and their test. Nothing was kept in a table,
   so no migration.
2. **The old app's stickers** still print, through the browser's print box
   only: its "Send straight to" printer choice and the dashboard's
   "Connected printers" panel are gone, as the old app is a placeholder.
3. **The id check's test** that a non-id param is left alone now uses a
   message template's name (`shop_reply`), since the print job id it used
   is gone.
4. **Kept as history:** decisions, reviews, older plans and the drawings
   that name the helper. The go-live checklist and both plans say it was
   removed. The `job-book-in` drawing still shows "Bike tag sent ·
   Acknowledged"; the built bike tag follows `2026-10-21-bike-tag.md`.

### 26 Oct 2026: company customers (`openspec/changes/company-customers`, `cs-add-company`, the VAT invoice in `collect.mjs`; customer service review 3; leftover screens H2; day answers 26 Oct, 3)

1. **A company's name is the customer's name.** So the customers list, the
   header search, the customer's page, the till and the diary show the
   company's name, as they show any customer's, with nothing added. The
   list has no company drawn; nothing new is shown there.
2. **The contact name is needed for a company**: it is the one box on the
   drawn company form not marked "(optional)" beside the name. Missing, it
   says "Add the contact’s name."; a missing company name says "Add the
   company or club’s name.", after Add's "Add their name.".
3. **"Send invoices to" is checked as an email address**, with the
   receipt's words: "That doesn’t look like an email address — check it".
   The VAT number is free text up to 30 characters, with no format check,
   since the invoice is a generic one for any shop.
4. **Edit** has the same "This is" choice and boxes, with Edit's labels
   (no "(optional)", as Edit's Address and Note). Choosing "A person" there
   clears the contact name, VAT number and "Send invoices to".
5. **The customer's page shows nothing new.** The contact name, VAT number
   and "Send invoices to" are seen in Edit only; none is drawn on `cs-page`.
6. **The VAT invoice email** is the built receipt with "VAT invoice" as its
   first line and subject, and "Invoice to" after the shop's details: the
   company's name and address (address and postcode joined with a comma,
   as the merge pop-up joins them), then "VAT number [n]". It still says
   "Sale [n]" and has no VAT line, as the built receipt does, because the
   sales it reads have never recorded VAT. The contact name isn't on it
   (not drawn).
7. **The till's "Email the receipt"** fills in "Send invoices to" for a
   company, or its email when that is blank (H2: "default to the
   contact's email"). Its note names the company in full: "From [Company
   name]’s customer record."
8. **Left out:** the printed receipt, the text receipt page and its PDF;
   finding a company by its contact's name; comparing company details in
   "The same person?".
9. **Headed "Invoice", not "VAT invoice", until sales record VAT** (Jack's
   answer that day, day answers 10): a VAT invoice without its VAT amount
   isn't one. It becomes "VAT invoice", with its VAT line, once Mark's step C
   records VAT on each sale.
10. **After the review:** a merge moves a company's details (company or
    person, contact name, VAT number, invoice email) together with its name,
    and Undo puts them back. A line break typed into a company's details
    stays on its line in "Invoice to".

### 26 Oct 2026: the customer's conversation with the shop, the server (`openspec/changes/ask-the-shop-server`, `ac-ask`, `ac-question`, `ac-account-asked`; Jack's answers in `2026-10-26-day-answers.md` 2 and 8)

1. **Where messages are kept.** A general message sits with the repair notes
   (`job_notes`), marked with its customer instead of a repair (migration
   091, numbered 087 until 088 reached main). A repair note's customer is always its repair's, so a repair moved to
   another customer takes its notes with it. Merging customers moves general
   messages too, and Undo puts them back.
2. **A note on a repair with no customer** is in nobody's conversation. It
   stays on the repair's own page, as now.
3. **"Needs a reply"** is the inbox's rule as before, across the whole
   conversation: the customer's message is the newest. A shop reply about
   anything answers it.
4. **The staff reply box** replies about the repair of the customer's newest
   message (a note on that repair, "Reply from the shop", linking to the
   repair), or as a general message when theirs was general ("Reply to a
   message", linking to the conversation). The screens follow this.
5. **"Reply to a message"** is its name in Settings › Messages, "When staff
   reply to a customer’s message". Its email subject isn't drawn: "[Shop
   name] replied to your message". While sending is pretend its link reads
   "[link]", as every message's does. The address is
   `/book/[shop]/messages`, which asks for sign-in first.
6. **A message is up to 1,000 letters**, as a repair note is; longer or
   empty says "Write a message of up to 1,000 letters."
7. **The conversation holds every repair of the customer's**, however old.
   "About WH-1042" opens the repair through the account, which works for its
   signed-in owner after the private link has run out.
8. **The history's one row** is dated by the newest message, and says the
   shop replied when the newest message is the shop's.
9. **30 days from the last visit:** a sign-in used with less than 29 days
   left is renewed to 30 days, and the browser's cookie with it. So it is
   written about once a day at most.
10. **Today's "Customers' messages waiting"** counts customers, as the inbox
    now does.
11. **The old inbox list** (`/api/job-notes/conversations`) stays until the
    inbox screen moves to the new one. The screens change removes it.
12. **After the review:** a customer can send 30 messages to the shop in
    15 minutes; after that they're asked to try again in a few minutes, so
    nobody can flood the inbox. A reply about one repair answers the whole
    conversation (one conversation per customer), so it leaves "Needs a
    reply"; a test now pins that down.


### 26 Oct 2026: the customer's conversation with the shop, the screens (`openspec/changes/ask-the-shop-screens`, `ac-ask`, `ac-account-question-sent`, `ac-question`, `ac-account-asked`, `ac-inbox*`; Jack's answers in `2026-10-26-day-answers.md` 2 and 8)

1. **The conversation page's width** is the drawing's 720px column on a
   computer, between the booking steps' phone width and the account's two
   columns. "Your account" is the frame's back link, with its own words.
2. **"About WH-1042 ›"** shows under every message about a repair, the
   shop's replies about it too, as drawn for Jo's reply.
3. **An empty box sends nothing**, as on the repair page's notes. A message
   the shop refuses (too long, or 30 in 15 minutes) shows the shop's own
   words; a sign-in that has run out says "Please sign in again to send
   this."; anything else says "Wheelhouse couldn’t send that. Try again in a
   moment."
4. **The history's Messages row** shows under Everything only, as drawn.
   Waiting for a reply it sits under Now, as `history()` draws it; once the
   shop has replied it moves to Earlier, by its date. Its date reads as the
   repairs' do ("Fri 18 Sep"). Replied is green, Sent grey, as drawn.
5. **The inbox, redrawn one row per customer** (Jack approved one
   conversation per customer, day answers 8.2): a row's second line is the
   newest message's bike and job number, or "From their account" for a
   general message. The open conversation shows the customer's name, phone
   and "Customer page"; "Open the job" and "On the job’s page · started by
   Maya" go, since each repair note now carries "About WH-1042", which
   opens the job in the diary.
6. **The reply box says what the reply is about:** "About WH-1042: goes to
   Maya the way they chose, with a link to reply on the job’s page.", or
   "Goes to Maya the way they chose, with a link to their messages." for a
   general message. After sending, a general reply says "…with a link to
   their messages.", or "Saved in the conversation, but no text went: …".
7. **"See the text Maya gets"** for a general reply reads the newest "Reply
   to a message" from `/api/messages?customerId=`, which gives each
   message's kind, rather than `/api/customers/:id/texts`, which doesn't.
8. **The old inbox list `/api/job-notes/conversations` is removed** (236
   routes). Its tests now read the per-customer list.
9. **The mockup's coverage checks** for walk 10 M1's "Question from her
   account" row now check the redrawn row instead, since day answers 8.2
   replaced it.
10. **After the review:** the "Sent." and reply status lines are on the page
    from the start, empty, so screen readers announce them when they fill.
    A customer whose sign-in runs out after the page has loaded keeps the
    page and what she's typed; sending then says "Please sign in again to
    send this." with a "Sign in again" link back to the page.
### 26 Oct 2026: the stock list and product page (`openspec/changes/stock-list`, `st-list`, `st-product`, `st-product-staff`, `st-product-bike`; slice C, WP-2.1, the 26 Oct defaults)

1. **Prices are shown, not edited**, until products move to pence (WP-1.5).
2. **Left out because they change things:** + Add a product, the tick
   boxes and their bar, Edit, Adjust stock and Send to another shop. Adjust
   stock is the next piece, so its button is left out rather than linked to
   nothing.
3. **Left out until WP-1.5:** the Category pill, each category's details
   (the Details box and detail columns), and sizes and colours.
4. **Who sees what:** everyone signed in sees Stock and a product's page.
   Margin, Cost and Show on website show to the Owner only, as roles aren't
   built (stock decision 11 says Owners and Managers). The product page's
   read sends no cost to anyone else. The list still reads the existing
   `/api/products`, which sends cost to every signed-in person, as it did
   before; hiding it there waits for roles (WP-1.1).
5. **The search** finds a name, barcode, the product's code (`sku`, shown
   where the drawing has the supplier code) or the supplier. Its
   placeholder doesn't mention measurements, which can't be searched yet.
   The scan icon is left out: a scanner types into the box.
6. **Running low** is the Overview's rule: a low-stock level above 0, and
   stock at or under it. Below zero is anything under 0.
7. **Margin** is on the price before VAT, at the product's own VAT rate, as
   the old app worked it out; rounded to a whole percent. No price shows
   "—".
8. **The list shows 50 products**, then "Show all ([n])", as the bike page
   does with its jobs. Every heading sorts; Product, A to Z, to start.
9. **Nothing to show:** "Nothing matches “[what was typed]”" with "Check
   the spelling, or try a supplier code or a supplier."; "No products yet"
   with no buttons (both drawn buttons add products); "Nothing is running
   low" and "Nothing is below zero".
10. **The product's page** follows the bike and customer pages: "‹ Stock",
    the product's name as the heading, and Stock in the page's title bar
    (the drawing puts the name there).
11. **In stock** names the shop, not a site, since stock is one count for
    the shop. The "held for a job" line is left out: nothing holds stock
    for a job yet.
12. **The photo** shows only when there is one. No "[Photo]" box.
13. **Stock history** names each line by what happened (Sold, Returned,
    Received, Booked in, Adjusted, or Stock changed), with its note and
    when. Who did it isn't recorded, so it isn't shown, and no line links
    anywhere yet (there's no sale, delivery or count page). Price changes
    aren't recorded, so that filter is left out. Returns count under Sold;
    Booked in under Received.
14. **A bike's page** is a product's page: nothing records a stock bike's
    frame numbers yet, so "Bikes by frame number" is left out.
15. **A product taken off sale** still opens, with "Taken off sale" under
    its name.
16. **After the review:** a product with no cost recorded (saved as 0) shows
    no margin ("—"), not 100%. A product's page shows its newest 200 stock
    movements. "%" and "_" in a stock search are searched for as
    themselves.

### 26 Oct 2026: deliveries and purchase orders (`openspec/changes/deliveries-orders`, `rs-hub`, `rs-order`, `rs-order-ordered`, `rs-order-close`; WP-2.3)

1. **Receiving is left out, not routed nowhere:** "A delivery arrived?" with
   "Receive a delivery", "Receive against this order", To return, Products to
   add and Recent deliveries come with the next piece (`rs-receive`,
   `rs-problem`).
2. **Who, before roles:** everyone signed in opens Deliveries and orders;
   only the Owner sees Orders and New order, and only the Owner can make,
   change, mark as ordered or close an order (the server refuses anyone else,
   "Only the shop's owner can order stock"). "Can order stock" waits for
   WP-1.1 roles (receiving decision 4). Anyone can still read an order and
   receive against it. Staff see "Orders are for the shop’s owner for now."
   on the page, which the drawing (`rs-hub-staff`) doesn't have.
3. **The restock list is left out** (`rs-restock` and the hub's Restock list
   section): it needs answers on "selling fast", the suggested count, the
   basket file's format, matching a product's typed supplier name to a
   supplier, and where "For customers" comes from.
4. **Orders lists open orders only:** drafts, ordered and partly delivered,
   newest first. Delivered and closed ones leave it.
5. **Suppliers as pills:** the one ordered from last first, then by name;
   three, then "Other…" shows the rest. The built pill group stands in for
   the drawing's dark pills. With no suppliers, "No suppliers yet." (adding
   one waits for the Suppliers screen, receiving later change of 2 Oct).
6. **Adding a product:** Enter adds an exact barcode or code match, or the
   only match; a click adds any match; a product already on the order goes
   up by one. An unknown barcode adds nothing ("Add this product" comes with
   receiving).
7. **A line's cost** is its count × the product's cost (a product with no
   cost counts as £0.00); the total is summed in whole pence on New order.
   Once saved, the order shows the server's `totalCost`, in pounds, as
   stored. Nothing converted.
8. **"for job WH-1042"** isn't on order lines: they don't record a job yet.
9. **Close the order always asks first,** since no job link exists to decide
   when to ask; the note under the order loses "If a job is waiting for any
   of it, you’re asked first." An order something has arrived from has no
   Close: the server refuses to cancel it, and dropping what's still to come
   needs a new write.
10. **A draft's page** (not drawn) shows "[Supplier] · draft", the Draft tag,
    Close the order and Mark as ordered. Editing a draft isn't drawn and
    isn't built.
11. **The header** keeps "Deliveries and orders" on New order and an order,
    as a customer's page keeps "Customers"; each sub-page has the drawn way
    back and its own heading.
12. **After the review:** a product with no cost recorded (none, or 0 as the
    old app saves it) is no cost, following the stock list's "no cost is no
    margin": on New order its line shows "No cost recorded" and a box to
    type one, instead of counting as £0.00 (replacing that part of 7).
    "Mark as ordered" says "Type a cost for every line first." until every
    line has one; "Save as draft" still saves, at £0.00. A count stops at
    100000.

### 26 Oct 2026: receiving a delivery (`openspec/changes/receive-delivery`, `rs-receive`, `rs-problem`; WP-2.3)

1. **Against an order only, for now:** the receive route books in against
   one order, so "From" lists the orders still to come (ordered or partly
   delivered), newest first, named by supplier ("[Supplier] · ordered
   [date]" when a supplier has two). The drawing's supplier pills and "Works
   with or without an order" wait for a write that adds stock without an
   order; the hub's note says only "Scan each item as it comes out of the
   box." With none: "No orders are waiting for a delivery." (not drawn).
2. **Left out, as asked:** frame numbers (`rs-frame`) and a part a job is
   waiting for ("Job WH-1042 is waiting for 1", holding it): order lines
   and stock record neither a job nor a frame. Also left out: Add this
   product (an unknown barcode says "Nothing in Wheelhouse has the barcode
   [code]"), the booked-in board and labels (`rs-booked`, `rs-labels`),
   and the hub's To return, Products to add and Recent deliveries.
3. **Scanning** follows New order's box: Enter looks the code up itself (a
   scanner presses Enter before any search comes back), taking an exact
   barcode or code, or the only match; a click takes any match. Not on the
   order: "[name] isn’t on this order". Each scan says "Added [name] · 1"
   (the drawing's announcement, without the job).
4. **A count stops at what's still to come** on its line ("All [n] [name]
   still to come are counted"); the server refuses more anyway. − at 1
   takes the line off, without the audit's Undo; a line with a problem
   marked can't go below what's set aside.
5. **Problems:** recorded in a new table (migration 092, numbered 090 until 091 reached main,
   `delivery_problems`) with the order line, kind, how many and a note (up
   to 500 characters). Damaged and wrong come out of what was scanned and
   aren't booked in; the line stays to come on the order, as qty_received
   counts only what went into stock. Missing is on top of what was scanned,
   up to what's still to come, and changes no count. Marking the same kind
   again replaces it. A missing one reads "Missing · [n]" on the line (not
   drawn). Who marked it isn't recorded yet.
6. **Book in** sends one request; the page then says "[n] items booked in ·
   stock updated" (the booked-in board's words), empties the list and
   refreshes the order. Changing From empties the list.
7. **Atomic and counted once:** the order is locked while what's still to
   come is checked, and stock is added in the update itself, so two people
   booking the same line at once can't both get it, and bookings of one
   product on two orders both land. An order with only problems marked
   keeps its status.
8. **"Receive against this order"** shows on an order still to come, for
   anyone, beside Close the order; "Receive a delivery" is on the hub for
   everyone (decision 4).
9. **After the review:**
   - **Damaged and wrong items are off what's to come** (replacing that
     part of 5, and following decision 9, where they go on "To return to
     [Supplier]" and only missing ones stay "to come"). What's still to
     come on a line is what was ordered, less what's booked in, less what's
     set aside, counting problems marked in earlier deliveries too. So the
     two together never pass what was ordered, and a line can't be marked
     damaged again and again. **A replacement for a damaged or wrong item
     is booked on a new order line or a new order**, not on this line. An
     order with nothing left to come is received, even if some of it was
     set aside; one with only problems marked and nothing in stock keeps
     its status (so it can still be closed).
   - **An order that isn't waiting** (all in, or `?order=` naming a draft
     or a received one) shows "This order is all in." (not drawn) and
     picks nothing in From, so the person chooses; the page no longer
     moves on to another order by itself. After booking in, the page stays
     on that order, so booking the last of it says the same.
   - **A booking the server refuses** fetches the orders again, so the
     counts shown are the server's.
   - **A problem marked by mistake is undone with the controls already
     there:** "Problem?" opens on what's marked for that kind (its count
     and note), and − at 1 takes it off, as − at 1 takes a scanned line
     off. No new button or words.
   - **Stock is updated in product order,** as a sale does, so two
     deliveries with the same products can't deadlock.



### 26 Oct 2026: the note-and-coin counter (`openspec/changes/note-coin-counter`, block 18, `eod-count` and `op-float-count`; cash-up decisions 2 and 3, opening the shop 2)

1. **Built on its own**, with no server and no page: the float check and
   Close the day each place it when they are built.
2. **One counter for both**: `op-float-count` draws a read-only "Counted"
   line where `eod-count` has the "Cash counted" box that can be typed over.
   The one-canvas plan merges them ("drawn once", `consolidate/j10.mjs`), and
   decision 3 says the total can be typed over, so both get the box.
3. **A box keeps only digits, five at most**: a letter or minus sign typed
   into a box is dropped, as nothing can be counted in parts or below none,
   and a keystroke that changes nothing leaves a typed total alone. A count
   too big to add up exactly counts as nothing counted.
4. **The last thing typed wins**: a typed total takes over from the boxes
   (decision 3); changing a box after that goes back to adding up the boxes.
   *Revised after review, 26 Oct:* emptying the typed total no longer snaps
   straight back to the boxes' sum, which fought anyone retyping it; the sum
   comes back when they leave the total box empty.
5. **A total that isn't pounds and pence** (more than two pence digits,
   letters, or commas that don't group thousands) gets the red edge and the
   words "Pounds and pence, like 208.70" below it, and counts as nothing
   counted, so "Done counting" stays off. *Pattern:* the email receipt's
   wrong address (`src/screens/till/email-receipt.tsx`): `aria-invalid`, the
   `--wh-danger-hover` edge and words, linked with `aria-describedby` (with
   the hint too). Unlike it, the words sit in a polite live region rather
   than an alert, so they don't interrupt someone mid-typing. "£", spaces,
   thousands commas ("£1,234.50"), a trailing point ("12." is £12.00) and
   one or two pence digits are fine ("208.7" is £208.70); a lone "£" is
   empty, not wrong.
6. **Each box's worth** (the drawing's "£120.00" beside 6 × £20) shows once
   that box has more than 0, on a computer or tablet, not a phone, as drawn.
7. **Keyboard focus** is the shared text box's outline
   (`src/components/ui/input.tsx`), so it looks like the rest of the app.

### 26 Oct 2026: How much waits while the kind of deposit is saving (`openspec/changes/deposit-amount-waits`, `bk-settings-deposits`)

1. **While the deposit switch or the kind is saving, "How much" is greyed
   out**, as the switch and the two kind buttons beside it already are. The
   drawing doesn't show a saving state; this follows theirs. Without it, a
   pick of "A fixed amount" followed at once by typing 15 saved 15%.

### 26 Oct 2026: receiving a delivery without an order (`openspec/changes/receive-without-order`, `rs-receive`, `rs-problem`, `rs-hub`; WP-2.3)

Replaces item 1 of "receiving a delivery" above: the drawing's supplier
pills and "Works with or without an order" are built.

1. **From is the supplier, as drawn.** The supplier with the newest order
   still to come first, then by name; three, then "Other…" (New order's
   pills). The drawing's "the one used last" would be the last delivery, which
   isn't recorded, so the newest order still to come stands in. With no order
   asked for, the first pill is picked only when it has an order still to
   come; otherwise none ("pick the supplier if you like", decision 3). Once
   picked, a pill can't be un-picked (the built pill group has no "none");
   a supplier with nothing on order books in the same way. No suppliers:
   "No suppliers yet." (New order's words) and scanning still works.
2. **A supplier with more than one order still to come:** its orders are
   received together. A scan counts against the order asked for
   (`?order=`) first, then the oldest; "Still to come on the order" lists
   every line of them, under the drawn heading.
3. **Not on an order** is any product with no line still to come on the
   picked supplier's orders, or any product when no supplier is picked:
   "[code] · not on an order", one per scan, a count with no top. A product
   whose order lines are all counted still says "All [n] [name] still to
   come are counted" and adds nothing (item 4 above), rather than adding an
   extra not on an order: a double scan is likelier than an over-delivery,
   and − and + still change it.
4. **Problem? not on an order** offers Damaged and Wrong item only (the
   drawing's note: Missing is "offered only when there's an order"). They're
   kept with the supplier, or with none when none was picked, for To return
   later; the job's Missing with no order (`rs-problem-missing`) waits for
   jobs waiting for parts.
5. **One Book in for the whole delivery:** a new route,
   `POST /api/deliveries/receive`, books order lines and lines not on an
   order in one transaction; the order route keeps working for the old app
   and shares its code. Stock not on an order is recorded as "Booked in" on
   the product's history (the existing `intake` type), noted "Delivery from
   [Supplier], not on an order".
6. **Who booked it in** is recorded on every stock movement from a delivery,
   on an order or not (migration 094 adds `stock_movements.login_id` the same
   way `jack/adjust-stock`'s 093 does, so either can run first). It isn't
   shown yet. The route reads who is signed in with `currentSession`, which
   relies on main's `rememberSession` (the session the dispatcher found for
   the request), so it takes no second database connection.
7. **After Book in** the supplier stays picked; when its orders are all in,
   "Still to come on the order" goes (replacing "This order is all in."
   after booking, item 9 above). "This order is all in." stays for
   `?order=` naming an order that isn't waiting, and scanning still works
   there.
8. **After the review (26 Oct):**
   - **From is set once,** when the suppliers and orders first load, so a
     refresh of the orders (window focus, or after a refused booking) can't
     move it to another supplier mid-delivery.
   - **A scanned line whose order line has gone** (its order all in, or
     nothing left to come on that line, booked in elsewhere) becomes a line
     not on an order when the orders refresh, keeping its count and its
     Damaged and Wrong item marks; a Missing mark goes, as Missing is only for
     an order. Merged with any line for the same product. Without this, Book
     in was refused on every retry.
   - **A problem's count has the same top as a line's** (100000); past it,
     "A problem needs how many, a whole number above 0".
   - **An order line sent with no supplier picked** is refused with "Pick
     the supplier this order is from." (was "That line is on another
     supplier’s order"). The screen doesn't send one; the old wording was
     wrong for it.

### 27 Oct 2026: closing an order that has partly arrived (`openspec/changes/close-part-delivered`, `rs-order-ordered`, `rs-order-close`; Jack's answer 1, `docs/decisions/2026-10-27-answers.md`)

The drawings show "Close the order" on a partly delivered order, and its box,
but no closed order. Decided here, for Jack to overrule:

1. **A closed order's line says "[n] not coming"** where the rest didn't
   come, in the same grey tag as "[n] to come" (Jack's words: "marks the rest
   as not coming"). A line that all arrived still says "All arrived". The
   order's tag says "Closed", as a closed order with nothing in already did.
   No buttons, as before.
2. **Stored as a status, nothing per line:** a partly delivered order closes
   to `closed`; one with nothing in is still `cancelled`. The lines keep what
   arrived; "not coming" is worked out from ordered − arrived − set aside. No
   migration.
3. **Two new refusals** on a close that can't happen: "This purchase order is
   already closed", and "Everything on this purchase order has arrived" (it
   used to say "already has items booked in and cannot be cancelled", which is
   no longer the reason). The screen doesn't offer Close the order on either,
   so they're seen only when two people act at once.
4. **The note "Closing the order drops anything still to come."** shows under
   every open order for the Owner, as `rs-order-ordered` draws it; the job
   warning in `rs-order-close` waits until jobs are linked to order lines.

### 27 Oct 2026: opening the shop with a float check, the server (`openspec/changes/opening-float-check`, `op-float-check`, `op-float-check-first`, `op-float-short`, `op-today-short`, `set-eod`; WP-3.3, slice B; opening the shop decisions 2, 4 and 8)

1. **"First in" is the first person to open the till page that day who
   takes payments**, signed in as themselves, since the PIN check-in (WP-1.7)
   isn't built. One float check a shop a day, the shop's own date. When the
   check-in arrives it becomes the trigger. Jack chose it, 27 Oct
   (`docs/decisions/2026-10-27-answers.md`, answer 3).
2. **No till name** ("Till B1") until tills have names in the new app (Mark's
   step C); a shop has one float check a day, not one a till. *Later (28
   Oct, till-setup entry 2):* the check records the till it was counted at;
   still one a shop a day until sales carry their till.
3. **"Takes payments" is the Owner, or a team member marked as a cashier**
   (the team's existing switch), until roles (WP-1.1). *Pattern:* UX
   walk-through 2 M1's "Staff, Manager, Owner" read as the switches there are.
4. **The float is set in Settings › Front desk › End of day › Float**
   (`set-eod`, drawn; planned in WP-5.1), built here as that one fold since
   the check has nothing to check without it. Stored on the shop's row, as
   the receipt words are, until the settings store (WP-1.2). From £0.00 to
   £100,000.00. With no float set there is no float check.
5. **No activity log entry yet** (WP-1.2 isn't built): the float check
   itself records who, when, what the drawer should have had, the count and
   the reason; Seen records who and when.
6. **The first day on Wheelhouse is "no float check yet"** for the shop,
   until the move (journey 9) can say so more precisely. The server refuses
   Looks right that day, as the drawing offers only Count it.
7. **A short float stays on Today until the Owner presses Seen**, whatever
   day it was counted: the safer reading of decision 8 H3 ("one click clears
   it"), so a short float nobody saw can't drop off overnight (review, 27
   Oct). Oldest first. Today's says "this morning"; an earlier day's says
   "on [date]", as the uncollected bike line gives its date.
8. **An over float isn't listed on Today** until Close the day exists:
   decision 8 H1 lists an over float only when yesterday was closed, and no
   day is closed yet. `op-float-check-unclosed` waits for Close the day too.
9. **No lock**: nothing here reads a row and writes it back (one column for
   the float, one insert that keeps the day's first check, one update for
   Seen), so the settings-saves-dont-clash lock isn't used.

### 27 Oct 2026: opening the shop with a float check, the screens (`openspec/changes/opening-float-check`, `op-float-check`, `op-float-check-first`, `op-float-count`, `op-float-matched`, `op-float-short`, `op-float-over`, `op-today-short`, `set-eod`)

1. **The pop-ups have no "Till B1"** (*later, 28 Oct, till-setup entry 2:*
   on a set-up till they read "Till B1 · first in today to take payments",
   "Till B1 · count every note and coin", "Float checked · Till B1 ·
   counted by Jo Taylor", and Today "Till B1’s float was [£] short"): the subtitles read "first in today to
   take payments", "first in on the first day on Wheelhouse", "count every
   note and coin" and "counted by Jo Taylor", and the message "Float
   checked · counted by Jo Taylor". Today's line reads "The float was [£]
   short this morning". Till names come with step C.
2. **The count uses the built note-and-coin counter**, with its "Cash
   counted" box that can be typed over (26 Oct entry 2), not the drawing's
   read-only "Counted" line. It never shows the float (blind counting).
3. **"Float checked · …" stays until "Close the message"**, in the drawing's
   dark colours. *Pattern:* the diary's floating message (20 Oct, entry 1),
   since the drawing doesn't say when it goes and Jack's "Don't close things
   by themselves" (24 Oct) keeps messages from going by themselves.
4. **Start the day after a difference shows no message**: none is drawn;
   the pop-up closes and the till is ready.
5. **"Any idea why?" has no placeholder**: the drawing's "[reason]" is a
   placeholder for an example, not words to show.
6. **If someone else checked the float first**, the pop-up just goes (the
   day is checked). A save that fails says "Wheelhouse couldn’t save that.
   Try again in a moment." in the pop-up. *Pattern:* the settings boxes.
7. **The Float fold's summary is the float, or "Not set yet"**; the box
   takes pounds and pence ("£150", "150.00") and saves when it's left, as
   the Receipts box. A wrong amount says "Pounds and pence, like 150.00",
   the counter's words. *Pattern:* the Receipts fold.
8. **End of day is the fourth area of Front desk**, after Messages, as the
   drawn rooms order it; only its Float fold is built.
9. **After the review (27 Oct):**
   - **Escape never closes a float check pop-up.** A page can stop Escape
     only once without a click in between, so if the browser closes the
     pop-up anyway it opens again at once.
   - **Each step is its own pop-up with the focus in it**: Count it puts the
     focus in the £50 box, a difference puts it in "Any idea why?", so a
     second Enter can't press the next step's button and a screen reader
     hears the new title.
   - **The till reads the float check again every minute and when it comes
     back into view**, so a till left open overnight asks the next morning.
     *Pattern:* Today's Needs attention.
   - **A count the server refuses shows the server's words**, as the
     settings boxes do.
   - **An earlier day's short float reads "The float was [£] short on [date]"**
     ("on Mon 31 Aug"), as the uncollected bike line gives its date.

### 27 Oct 2026: Close the day, the server (`openspec/changes/close-the-day`, `eod-count`, `eod-count-result`, `eod-banking`, `eod-paidout`, `eod-finish`, `eod-z`; WP-3.4, slice B; cash-up decisions 2 to 6; opening the shop decision 8 H1)

1. **One close a shop a day, no till name**, as the float check: tills get
   names with Mark's step C, and a shop has one drawer until then. *Later
   (28 Oct, till-setup entry 2):* tills have names now, but sales don't
   carry their till, so the close stays the shop's, with no till name.
2. **Only the Owner closes the day and takes cash out**, until roles
   (WP-1.1) bring managers and "Can close the day" (decision 5; roles answer
   6 of 5 Oct). *Pattern:* Needs attention and Seen.
3. **What the drawer should hold is this morning's float, plus the cash
   sales since the float check, minus cash taken out since it**
   (walk-through 2 M2's rows; Jack's answer 9, "trust the morning check",
   which replaced "the day's cash sales" after the second review found cash
   counted twice). This morning's float is what was counted, or the shop's
   float when it looked right. "Since the check" is by the server's clock:
   the old record's saved time, and a till sale's time received, or its
   till's own clock only when it was made offline (third review, 27 Oct),
   so an online till whose clock is wrong doesn't move its cash. There is no "minus cash refunds" yet: the till has no refunds
   (WP-3.1).
4. **The day can't close without this morning's float check**, so the
   expected figure starts from a real one. The Close the day page asks for
   the float check first, as the till does.
5. **A count under the float banks nothing**, and the close says how much
   to put in to make the float up (`topUpPence`), so the float is left
   either way. Settled by Jack's answer 5 (27 Oct,
   `docs/decisions/2026-10-27-answers.md`), replacing "leave what was
   counted".
6. **The close keeps its figures as they were**: the float, cash sales,
   cash taken out, expected, counted, reason, banked, and the takings by
   card, cash and everything else. A sale made after closing doesn't change
   the report.
7. **"Yesterday" for an over float is the last day the till opened** (the
   last day with a float check before it), so a shop shut on Sundays looks
   back to Saturday. A shop's first day has no yesterday, so an over float
   that day isn't listed (decision 8 H1 lists it only when yesterday was
   closed). Seen clears an over float as it does a short one.
8. **"Close the day" shows an hour before closing** (`set-eod-close` draws
   "1 hour before" chosen) until that setting is built, all day on a day
   the opening hours say the shop is shut, and not once the day is closed.
9. **Cash taken out needs what it was for** (1 to 100 characters), as the
   drawing has no "(optional)" on it, and takes an optional note up to 500.
   From 1p to £100,000. Not once the day is closed.
10. **The close and cash taken out lock the shop's row** before they read
    and write (the settings-saves-dont-clash pattern), so two closes keep
    one and cash taken out at the moment of closing is counted in it or
    refused. The lock is `FOR NO KEY UPDATE`, so a sale being saved at the
    same moment isn't held up (review, 27 Oct).
11. **A close counts every sale no close has counted yet** (Jack's answer
    6), and marks each one with its own id (`day_close_id` on both sales
    records, migration 096) under the shop's lock; the report comes from
    exactly the sales it marked. No sale is placed in a day by its time
    (second review, 27 Oct): a sale still being saved at the close is left
    for the next close, and a till whose clock runs fast or slow still has
    each sale counted once. Counting starts at the start of the shop's
    first close's day, by the server's clock (a till sale by when the
    server received it), so the history from before Close the day isn't
    swept into the first close; a sale from before that never counts.
    Cash taken out is listed and taken off from the morning's check on
    (entry 3). A sale still being saved at the close shows tonight as over
    and lands in the next day's report, so its cash is counted once but the
    difference is split across two days (third review, 27 Oct). A sale can
    only point at its own shop's close: the database refuses another's.
12. **Closing after midnight isn't handled** (review, 27 Oct: logged, not
    fixed). The day is the shop's date when the close is made, so a close
    made at 00:30 closes the new day, and the evening's sales after the
    last close count in it. *For Jack to decide.*
13. **The close can carry the expected figure the screen showed**; if a
    sale or cash taken out changed it meanwhile, it's refused with the new
    figure ("The till’s figures changed while you were counting. Check the
    difference again."), so the owner sees the new difference before the
    day closes (review, 27 Oct).
14. **Online money is kept beside the takings, not in them** (Jack's answer
    7): the old record's `Shopify` and `Deposit paid online` tenders. Till
    sales have no online tender. Takings is card + cash + other, so it
    always adds up (review, 27 Oct).
15. **At closing, a float nobody checked is looked at, never counted**
    (Jack's answer 8), on the first day on Wheelhouse too. The server
    allows that look only for the Owner, only when the close page asks for
    it, and only while "Close the day" is showing (second review, 27 Oct);
    anywhere else the first day is still counted.
16. **The report and the drawer can differ on purpose**: the report's Cash
    is every cash sale this close counted, the drawer's figure only those
    since the morning check (both kept on the close). Cash from a day
    nobody closed is in the report and shows in the drawer as over.

### 27 Oct 2026: Close the day, the screens (`openspec/changes/close-the-day`, `eod-entry`, `eod-count`, `eod-count-result`, `eod-count-exact`, `eod-banking`, `eod-banking-none`, `eod-paidout`, `eod-finish`, `eod-z`, `op-today-short`)

1. **Three steps, numbered 1 to 3**: Count the cash, Paid-outs and banking,
   End-of-day report. The drawing's other three (the till has sent its
   sales, Needs attention, the card machine check) wait for what they stand
   on (step C, Park, a connected card machine), so they aren't shown, and
   the steps that are shown are numbered in order rather than 3, 4 and 6.
2. **No "Till B1 · Bolton"** beside the title: the date only ("Tuesday 1
   September"), until tills and sites have names. *Later (28 Oct,
   till-setup entry 2):* still none, since the close counts the whole
   shop's cash until sales carry their till. The report reads "Day
   closed" and "[date] · closed by [Name]", without "saved to Reports"
   until Reports exists.
3. **The page is at `/workshop/till/close`**, inside the till's folded
   frame, so the header still says Till; the page's own heading is "Close
   the day".
4. **The count is always blind** (the drawings assume blind; decision 2's
   setting isn't built), with the built note-and-coin counter and its
   "Cash counted" box, as the float check.
5. **The count's status shows as soon as the count is done** ("Spot on" or
   "Counted", as `eod-count-exact` and `eod-count-result` draw it); "Keep
   this count and go on" opens Paid-outs and banking. "Banking bagged —
   next step" stays off until the count is kept.
6. **"How the till worked it out" has no "minus cash refunds" row**: there
   are no refunds yet. Its float row reads "Float this morning · looked
   right · [Name] at [time]", or "counted by" for a count, with "[£] short,"
   first for a short count (the j16 line on `eod-z`).
7. **Leave in the drawer and Bank show once the cash is counted**, worked
   out from the count. Leave in the drawer is always the float. A count
   under the float banks £0.00 and adds "Put £[n] in to make the float up to
   £[float]" under them (Jack's answer 5), in the warning colours of the
   page's other notices. *Pattern:* the till's stock warning.
8. **Cash taken out** (`eod-paidout`): "What it was for" is a box to type
   in, since Settings › Till › Reasons isn't built (the drawing's "Other…");
   the subtitle is "From the drawer" and the button "Take it out", as there
   is no cash drawer to open from Wheelhouse yet. A wrong amount says
   "Pounds and pence, like 5.00" (the counter's words); a missing reason
   says "Say what it was for." Each paid-out lists "[time] · [Name]" and its
   note.
9. **The report** shows Takings, Card, Cash, "Gift cards, store credit,
   customer accounts, other", Float at the start, Cash difference and
   Banked, and "Online money is not in this till’s takings: £[n] today"
   (walk-through 11 H2; Jack's answer 7), without the drawing's "see
   Reports" until Reports exists. Cycle to Work, Refunds, Voids, Discounts
   given, VAT and "Email it" wait for what they stand on. Print uses the
   till's own printing (the receipt's).
10. **A closed day** opens with every step done and "Show the report" under
    End-of-day report, so the report can be seen again. *Pattern:* none
    drawn; the smallest way back to `eod-z`.
11. **"Close the day" on the till sits in a strip above the sale on every
    size**, "The shop closes at [time]" with the button, since the new till
    has no till bar yet; the drawing gives this strip to a phone. It reads
    "closes at" rather than "It's after", as it shows from an hour before.
    Only the Owner sees it, until roles.
12. **The float check comes first on Close the day** when it's due, and
    saving it refreshes the day's figures. It offers Looks right only, even
    on the first day (Jack's answer 8): "Hello, [first name]", "the float
    wasn’t checked this morning" (the subtitle isn't drawn), "The drawer
    should have [£ float]", "The shop’s float", and no note, since the
    till's note asks for a count.
15. **Done counting reads the till's figures again** before showing the
    difference. If a sale or cash taken out changes them before the close,
    the close is refused: Count the cash opens again with the new
    difference and the server's words ("The till’s figures changed while
    you were counting. Check the difference again.") in the warning
    colours, and the count is kept again and the banking bagged again
    before closing (review, 27 Oct).
13. **Someone who isn't the Owner** opening the address is told "Only the
    shop’s owner can close the day."; with no float set the page says "Set
    the shop’s float in Settings › Front desk › End of day first: Close the
    day leaves it in the drawer and banks the rest."
14. **An over float on Today** reads as the short one: "The float was [£]
    over this morning", "Counted by [Name] at [time]", the reason, and Seen.

### 28 Oct 2026: stock take (`openspec/changes/stock-take`, `tk-hub`, `tk-hub-staff`, `tk-start`, `tk-start-category`, `tk-count`, `tk-count-below`, `tk-diff`, `tk-applied`; WP-2.2, slice C; stock control decisions 5, 9 and 11)

1. **Starting, checking and applying a count is for the Owner** until roles bring "Can order
   stock" (the 5 Oct later change to decision 5). *Pattern:* Deliveries and
   orders' owner-only orders. Staff see "Starting a count, and checking and
   applying it, are for the shop’s owner for now." where the drawing says
   "are for managers" (Deliveries' "Orders are for the shop’s owner for now").
2. **Decided here, for Jack to overrule: what "allowed for" means.** Decision
   5 and the drawings say anything sold, booked in, used, sent or adjusted
   during a count "is allowed for", but not how. There were two ways:
   1. *From when the count started.* Expected is the stock when the count
      began, and applying adds the difference to stock as it is then. Right
      when a pad is sold after it was scanned; one too few when it was sold
      between the count starting and the shelf being scanned.
   2. *From when each product was counted.* Expected is the stock at the
      moment that product was last counted, and anything after that is
      added on top. Right in both cases for one counter; when two people
      count the same product at different times, a sale between their counts
      can't be placed.
   **Taken: option 2, at the product's last count** (the lead's default
   while Jack works without being asked, 28 Oct). The check page names what
   was allowed for under each product ("1 sold during the count, allowed
   for"). Stock held for online orders or jobs isn't left out of Expected
   yet: nothing holds stock.
3. **Who is counting** on the hub line: "[n] items counted · Jo Taylor and
   Alex Morgan counting", or "everyone has finished" once everyone who joined
   has pressed I’ve finished my part. A count nobody has joined isn't ready.
   Counting again after finishing puts the person back to counting.
4. **No counts in progress** says "No counts in progress." (Deliveries' "No
   orders." pattern; not drawn).
5. **"Started [time]"** is the time today, or "Tue 1 Sep, 10:30" on an
   earlier day, as a count can run over days.
6. **Areas used before** are the last five area names, newest first, as
   buttons that fill "Which area". **A category is picked by searching**
   (decision 11): the box lists matching categories under it, as the scan
   boxes list products. The kind starts on "An area", as `tk-start` draws.
7. **A category count takes only that category's products, and a below-zero
   count only the products below zero when it started**; scanning anything
   else says "[Product] isn’t in [Category]" or "[Product] isn’t below zero"
   and isn't counted ("and nothing else is compared"). A below-zero count is
   refused when nothing is below zero.
8. **The counting page**: the room's title stays "Stock take"; the card is
   headed with the drawn page title ("Counting [Area]", "Counting: below
   zero", "Counting the whole shop") and the drawn box title under it ("Scan
   what’s here", "Find and scan these"), with "‹ Stock take" to go back
   (receiving's pattern). Two people counting the same product each keep
   their own number. Typing 0, or − at 1, takes the person's line off.
9. **The below-zero note** reads "Started by [Name]. …" without "from
   Today": Today's Count them isn't built yet.
10. **Check it and Join** both show to the Owner on a count in progress (the
    drawing shows Check it on a ready count only); Staff have Join only.
11. **Recount** takes the line's counts away, shows it on every counter's
    page as "Recount asked by [Name]" with an empty box, and puts everyone
    back to counting. A recount nobody did is left as it is when applied.
12. **Count them as none** counts each product the count covers that nobody
    counted as 0: the whole shop's products, the category's, or the
    below-zero list. **An area count has no "Not counted" list**: decision 5
    compares only what's scanned in an area, and a product doesn't belong to
    an area. The Not counted line folds open to list them by name.
13. **"Apply to [n] products"** counts the products that differ; applying
    works the differences out again at that moment, under lock, so a count
    or sale since the page loaded is included. A count is applied once;
    counting, joining or applying again afterwards is refused.
14. **Undo** is in the dark "Count applied" bar straight after applying, as
    drawn, and stays until the page is left (Jack's "don't close things by
    themselves"). Opened later from Finished counts, the page has no Undo.
    Undo takes each change off with a "Count undone" history line and puts
    the count back to checking.
15. **Finished counts** (Owner only, as they carry costs): the last 20,
    "Applied [date] by [Name] · [n] products changed · £[value] under, at
    cost", with Open ("Open the whole-shop count from [date]").
16. **Download the count** is a spreadsheet (CSV): product, supplier code,
    expected, counted, difference, at cost.
17. **A product's history** reads "Counted" with the note "Stock take of
    [Area] · counted [n], expected [n] · counted by [Name]" and "applied by
    [Name]"; the line doesn't link to the count yet.
18. **On a phone**, the differences show the product and its difference
    only, as drawn; Recount is on the tablet and computer layouts.
19. **Later, not built here:** held stock left out of Expected (nothing
    holds stock yet), sizes and colours on a line (WP-1.5), Today's
    below-zero line, and sending stock to another shop.

From the independent review, 28 Oct:

20. **Drawn words shortened until true** (the PIN screen's precedent). The
    drawings say anything "sold, booked in, used on a job, sent or adjusted"
    is allowed for, that "stock held for online orders or jobs isn't
    expected on the shelf", and that Cycle to Work bikes are counted. Jobs
    don't move stock, nothing is sent between shops, and nothing holds stock
    yet, so Start a count, the counting page and Check the count say only
    "Anything sold, booked in or adjusted … is allowed for." The drawn words
    come back as each of those is built.
21. **A later scan by the same person moves "last count" on.** Jo scans one
    shelf of pads, a pad sells, then she scans another shelf an hour later:
    the sale falls before her last count, so it's taken as already counted,
    though the second shelf never had it. Logged, not changed; the fix would
    be to keep each scan's time, not just the first and last.
22. **Undo is refused once a later count has counted the same product**
    ("A later count has corrected [Product]; undo that one first."), even a
    later count that found it right, since taking the earlier change off
    would leave stock wrong. Undo the later count first.
23. **Till sales are timed as Close the day times them**: a sale made online
    from when it reached Wheelhouse, so a till with a wrong clock can't move
    it; a sale made offline from when the till says it was made, so one made
    before the count and synced after is already in the count, but never
    later than when it arrived.
24. **The counting page searches only the count's own products** (the
    category, or the below-zero list), with names and codes only.
25. **Arrow keys and Enter** pick from the category picker's matches and the
    counting page's matches; a category typed in full counts as picked.
26. **Download the count** puts a ' before a name or supplier code that starts
    like a spreadsheet formula (=, +, −, @), so it opens as text.

### 28 Oct 2026: a Shopify refund's stock (`openspec/changes/shopify-refund-stock`; no screen)

1. **A refund line Shopify marks `no_restock` leaves Wheelhouse's stock
   alone.** Shopify's refund carries `restock_type` on each line, and
   `no_restock` means "Refunding these items won't affect inventory"
   (shopify.dev, Refund resource); the money goes back but the item doesn't
   go back on the shelf. Other lines (`return`, `cancel`, or none given) are
   put back as before.
2. **Noted for Jack, not changed: importing a supplier item has no stock
   history line.** Stockroom's import from a supplier's catalogue
   (`server/routes/suppliers.js:147-150`) starts the new product's stock at
   the supplier's own stock figure, and writes no line in the product's stock
   history. Stock control decision 6
   (`docs/decisions/2026-10-01-stock-control-review.md`) has every change to
   stock in the history; a product made with stock and no line may not fit
   it, and the figure is the one in the supplier's own feed, not a count of
   the shop's shelf. Adding a product by hand with stock does write a line
   (`server/routes/products.js:170-173`). Left as it is for Jack to say.
