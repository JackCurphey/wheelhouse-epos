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
   with the server's own message is shown as is (d5). A clearer customer
   message, with the shop's contact, is for Jack to word.

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
