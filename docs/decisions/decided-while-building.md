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
   £0.00 too (the products table's default).
2. **Jobs keep the drawn week, Mon 14 to Sun 20 September 2026.** That week
   is in the past now, so the app carries unfinished jobs on by itself: some
   read "Day 1 of 2" on the next day. *Pattern:* the drawings, as drawn.
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
