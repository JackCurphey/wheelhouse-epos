# The coverage walks — Jack's answers (4 Oct 2026)

Stage W's coverage check (`docs/design/user-journeys/coverage-check.md`,
WP-W.5 in the build plan) found 12 journey-and-person pairs no walk-through
had covered. All 12 were walked on the clickable mockup
(`docs/design/user-journeys/walk-4/`). Jack answered their five questions on
4 Oct from a checklist, every one with option 1. The full options are in each
walk file's "Questions for Jack".

1. **The customer website's phone menu button says "Menu" beside the three
   lines** (coverage walk 1, L2). The staff app's menu stays as it is.
2. **"Start with every product online, or nothing?" is asked once, in the
   website's set-up** (coverage walk 5). Changes Buy online decision 3 (its
   4 Oct later change): `on-settings-start` and its two "answered"
   situations go; connecting payments turns buying online on.
3. **Maya's question from her account is a line on staff Messages**
   (coverage walk 10): "A question from the account: no bike or job;
   'Question from her account'; the reply 'Sent to Maya by text, with a link
   to her question'". This settles the `mockup-gaps.md` entry "Another
   customer's question, opened in Messages".
4. **Maya can ask to delete her account while her bike is in the shop; it
   waits until the bike is collected** (coverage walk 12, Q1). Her pop-up
   reads "We'll delete your account once your bike has been collected", and
   staff see "Can be deleted once the bike is collected".
5. **One way of saying "can't delete yet" on privacy requests** (coverage walk
   12, Q2): every request shows "Still in the way: …" on its row, with Delete
   held back until it's clear. `cs-privacy-blocked` goes.

## Taken without a question

Every finding a walk file marks as following a recorded decision is fixed as
that decision says (for example, coverage walk 4's "Turn it on" banner during
a move, which breaks the switch-over decision).
