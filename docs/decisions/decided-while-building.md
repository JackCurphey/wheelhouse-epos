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

(Nothing yet.)

## Jack's lane

(Nothing yet.)

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
