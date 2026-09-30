# Journey 9 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 17 desktop renders of the
Moving from Citrus Lime boards (1280 x 800: `mv-start`, `mv-progress`,
`mv-summary`, `mv-fix`, `mv-today-refresh`, `mv-alongside`, `mv-both`,
`mv-check`, `mv-check-result`, `mv-practice-sale`, `mv-practice-card`,
`mv-ready`, `mv-weeks`, `mv-ready-all`, `mv-pick-day`, `mv-morning`,
`mv-week`), against `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md`
(decisions 1-8), `generator/moving.mjs`, `generator/settings-frame.mjs`,
`generator/ui.mjs`, the practice band in `generator/till.mjs`, `today()` in
`generator/opening.mjs`, and the rules for every journey in
`HANDOVER-next-journey.md`. Tablet and phone are not drawn yet, so nothing here
covers them.

**Not raised, on purpose.** The [bracketed] placeholders, including every file
name, count, date and "[Which Citrus Lime export, and where to find it]" (what
Citrus Lime exports is still unknown). The unselected-pill border contrast
(parked as a design-wide fix). 12-13px text that is only a label or a second
line (this includes the 12px status chips and the 13px stage words). The
parked design-wide items: every pop-up's ✕ being a link rather than a button,
and Today and Reports sharing one sidebar icon. The till sidebar clip report,
which is the same on the approved till boards. None of Jack's 8 decisions is
reopened: the owner drops files in and Wheelhouse matches the columns, the
weekly refresh with Citrus Lime winning where both changed, the page under
Office with three stages, the weekly check against Citrus Lime's four figures,
every till in practice until switch-over, the self-ticking checklist then the
owner picks the day, and the owner choosing the matching weeks (2 by default).
The example data stays as it is: Jo Taylor, Alex Morgan, Jack Lewis and an
unnamed shop owner.

**Verdict.** The look is right. Soft sand throughout, amber only as the
sidebar "you are here" marker, pop-ups in the middle with the safe choice on
the left, every button, link, box and pill 44px tall, and every status carries
a word, with a tick or alert icon on the green and amber chips (Done, All in,
Matches, Kept, Not yet, Next, Traded, Today, To come). Contrast passes
everywhere it was worked out from the Soft sand colours in `ui.mjs`: the green
chip about 6.5:1, the amber chip about 5.3:1, the grey chip about 4.7:1, grey
text on the pop-up's sand body about 4.9:1, the practice band about 7.7:1. The
problems are in how the pieces join up. The three stage boxes are labels you
cannot press, so nothing drawn gets an owner from one stage to the next or back
to the refresh. The page tells the owner "nothing you did in Wheelhouse is
overwritten" on the same page that overwrites it. The weekly check never says
what makes a week count, and it is the gate to switching over. And the moments
that matter most, dropping in a refresh, making the tills real, have no drawn
landing. Findings are ranked; where a fix is a real choice the options are
numbered.

Checked against the source, not just the pictures: `stages()` draws the three
boxes as `<li>` with no link or button inside a `<nav>`, and calls any earlier
stage "Done" (`i < STAGE`); `alongsideBoard()` has a note but no drop zone
(`dropZone` is only used by `startBoard()`); `checkHead()` is `aria-hidden`
and `who()` (the spoken "Wheelhouse" / "Citrus Lime" prefix) runs on the phone
only; `checkSection()` draws "Check" enabled with four empty boxes;
`fixRow()` gives every row the same unnamed "Leave it out" and "Fix";
`progressBoard()` calls `section()` with no action, so no "Ask us to help";
no `aria-live` anywhere in `moving.mjs`; `pickDay()` is `<input type="text">`;
`offBtn()` sets both `disabled` and `aria-disabled`; the word "practice"
appears in `moving.mjs` only on the checklist, pick-day, morning and
practice-till boards, never on a Run alongside board.

---

## High

**H1 — every board: the three stages are labels, not links, and the page never
shows how to get between them.**
The stage strip is a `<nav aria-label="Stages of the move">` holding three
boxes that do nothing when pressed. Nothing on `mv-alongside`, `mv-check` or
`mv-check-result` leads to Switch over, and the checklist only exists once the
stage is already "Now", so the owner cannot see "2 of 4 ready" while running
alongside, and cannot tell that the practice-sale and website items need doing
weeks before the day. Going back is not drawn either: in Switch over the only
things on the page are the checklist, the morning steps or the week tracker, yet
the checklist's first item ("matched 2 weeks in a row") can only tick if the
weekly refresh and check carry on. `mv-ready`, `mv-ready-all`, `mv-morning` and
`mv-week` show "Run alongside" as "Done" with a tick while decision 6 keeps
every till in practice, and decision 7 asks for one more refresh that morning.
It is not done, it is still running. A screen reader also finds a navigation
landmark with no links in it.
*Why it matters:* this is the spine of the whole move. An owner in the middle
stage has no button for "what do I do next?", and a stage that says "Done"
while the weekly refresh reminder is still landing on Today teaches them not to
trust the strip.
*Fix:* make each stage box a real link (they are already about 56px tall), and
say what state each is in, in words: Run alongside reads "Still running" once
Switch over has begun, not "Done", until switch-over day. Add one line at the
bottom of the Run alongside page, "Ready to switch over: 2 of 4 · See the
list", which opens Switch over. In Switch over keep the weekly refresh and
check reachable from the checklist's first row ("Go to the weekly check").
*Decision for Jack:* how the owner moves on.
1. Stages are links, "Still running" wording, a "Ready: 2 of 4" line on Run
   alongside. No new buttons to press, everything reachable in one click. Costs
   a little more to build and one more word state.
2. Keep the strip as a read-only progress bar, and add "Next: switch over" and
   "Back to the weekly check" buttons on the pages. Costs a button on every
   page, and the strip stays a landmark that does nothing (drop the `<nav>`
   role).
Recommend 1.

**H2 — `mv-check-result`, `mv-ready`: nothing says what makes a week count, and
"3 of 4 match" reads like progress.**
The note says "3 of 4 match. The weeks that match build up the case for
switching over." Decision 7 gates switch-over on weeks "in a row" where the
check matched, and the checklist asks for 2 in a row (decision 8). So a week
with one figure out cannot count, and probably resets the run. The board never
says that. The footer, "Weeks that matched: [n] of [n]", is a different
measure again (out of how many weeks, not in a row). An owner who sees "3 of 4"
beside a green "build up the case" will reasonably think this week counts.
*Why it matters:* the owner decides when to stop running two tills off this
number. If the rule is fuzzy, they will switch early, or sit for weeks not
knowing why the tick won't come.
*Fix:* say it in words on the result: "This week doesn't count yet. All four
need to match." on any mismatch, and "This week counts. [n] of 2 matching weeks
in a row." when all match (the 2 is the owner's choice from decision 8). Replace
"Weeks that matched: [n] of [n]" with "Matching weeks in a row: [n] of 2".
*Decision for Jack:* what to do about a difference the owner can explain (for
instance a stock value that Citrus Lime works out differently).
1. Every figure must match, no exceptions; "Ask us to help" is the way out.
   Simple, and the tick means exactly what it says. Costs: an owner could be
   stuck on a difference that is not a real fault.
2. The owner can mark one figure "Checked, accept the difference" with a reason,
   and the week counts. Costs a click and a reason box, and weakens what the
   tick proves.
Recommend 1 for now; revisit once Citrus Lime's real reports are known (the
stock value figure is the likeliest to differ).

**H3 — `mv-alongside`, `mv-both`: "nothing you did in Wheelhouse is
overwritten" is not true on the same page.**
The Weekly refresh card says "Only what changed comes across — nothing you did
in Wheelhouse is overwritten." Two boards later the pop-up shows a price and a
phone number the owner changed in Wheelhouse with a line through them and "Kept"
beside Citrus Lime's. Decision 3 is precise about this (never overwrite what was
done in Wheelhouse, such as practice jobs and notes; where both changed the same
thing, Citrus Lime wins). The wording on the card is broader than the decision.
In the pop-up the discarded value is shown only by a strikethrough, which a
screen reader does not announce, and the word "Kept" is attached to Citrus
Lime's value only.
*Why it matters:* the owner reads the first sentence, trusts it, and later
finds a price they set has gone back.
*Fix:* say it the way the decision does: "Nothing you did in Wheelhouse is
overwritten, except where you and Citrus Lime both changed the same thing:
then Citrus Lime's version is kept. You can see each one under Changed in
both." In the pop-up add the words "not kept" after the struck-through
Wheelhouse value (visible text, not just the line through it).
*Decision for Jack:* where the exception is said.
1. In the note on the Weekly refresh card, as worded above. Everyone sees it
   every week, no extra click.
2. Short note on the card ("Only what changed comes across."), with the
   exception only beside the "Changed in both" row and in the pop-up. Cleaner
   card; costs a reader who only skims the card.
Recommend 1.

---

## Medium

**M1 — `mv-alongside`, `mv-today-refresh`, `mv-morning`: a refresh has no place
to drop the files, and the owner is one click further away than they need to be.**
The start board has a drop zone. The weekly refresh card says "Download the same
files from Citrus Lime and drop them in" and then draws two buttons, "Change
day" and "Refresh now", and nowhere to drop. The same button is on Today's Needs
attention line, with no landing drawn. On switch-over day step 1 ("One last
refresh from Citrus Lime") is drawn already Done, so the one morning step that
needs files is never shown in its working state.
*Why it matters:* "drop them in" is the owner's weekly job. With fewest clicks
as the rule, press a button to reach a box to drop onto is a click too many.
*Fix:*
1. Put a slim drop zone on the Weekly refresh card (the same one as the start,
   one line plus "Choose files"), with "Refresh now" becoming that "Choose
   files" button. Today's "Refresh now" opens the page with the zone in view.
   The morning's step 1 reuses it. Fewest clicks, one component everywhere.
2. "Refresh now" opens the computer's own file chooser straight away, and the
   whole page accepts a dropped file. Less on screen; costs: no place to show
   the list of files to download, and nothing for keyboard users to land on.
Recommend 1. Also draw what "Change day" opens (day pills, like the weeks
pop-up).

**M2 — `mv-check`, `mv-check-result`: a button that could be dropped, and
figures with no spoken names.**
"Check" is drawn enabled with all four boxes empty (the same thing the Opening
the shop audit raised for "Done counting"). And the handover rule is that
things check themselves where they can. The column headings "Wheelhouse" and
"Citrus Lime" are `aria-hidden`, and only the phone version adds a spoken
prefix, so on desktop a screen reader hears "Sales total, £[figure]" with no
hint whose figure it is. In the result state the Citrus Lime figure is plain
text with no label at all. The "£" inside each money box is placeholder text
that disappears when you type, and the spoken label does not give the unit.
*Why it matters:* a wrong or half-empty check wastes a week of the "in a row"
count (H2). For screen reader users the table reads as a list of unlabelled
numbers.
*Fix:* give every figure hidden text ("Wheelhouse: £[figure]", "Citrus Lime:
£[figure]") as the phone version already does, or draw a real table; put the £
outside the box so it stays. For the button:
1. Each row checks itself as the owner leaves its box: tick, or the difference,
   appears beside it at once. No Check button. Four typed numbers, zero extra
   clicks. "Check again" becomes changing a box.
2. Keep "Check" but off until all four boxes have a number, with the reason in
   words next to it. One more click, safer against half-filled weeks.
Recommend 1.

**M3 — `mv-fix`: three identical "Fix" buttons and three identical "Leave it
out" buttons, and nothing after them.**
Six buttons, no names: a screen reader user hears "Fix" three times and cannot
tell which row each belongs to. "Fix" does not say what it does, and the
suspected duplicate ("Looks like the same person as [customer name]") is
really a choice between merging and keeping both. "Leave it out" is the
consequential one, but the note only promises "add it by hand later" and nothing
on the board shows where left-out rows can be found afterwards, or undone. No
"all sorted" state is drawn, and "Done for now" stays the dark main button
whether rows remain or not.
*Why it matters:* this is the part of the move where an owner is most likely to
get stuck or throw away a real customer.
*Fix:* give each button the row in its spoken name ("Fix [customer name]",
"Leave out [job number]"). Use verbs that match the problem: a duplicate row
reads "Merge" and "Keep both", a nameless row "Add a name", a job without a
customer "Choose the customer". After "Leave it out" keep the row in place,
grey, with "Left out · Undo" (the same Undo pattern as elsewhere), and show
"Left out: [n]" at the bottom so they can be found. Draw the state where
everything is sorted: "Everything is in" and the main button becomes "Next: run
alongside". Draw one Fix pop-up.

**M4 — `mv-progress`: no help, no failure state, and progress is not announced.**
Decision 2 says anything odd has "Ask us to help". Every other Stage 1 board
has the link; the progress board does not. No row shows a file that cannot be
read or is the wrong kind, or an import that stops partway, which is the most
likely thing to go wrong in a first import. "Bringing across" changes to "Done"
on its own, and there is no live region in the source, so a screen reader user
waiting on the page hears nothing. "Workshop jobs: Not added" here, while
`mv-summary` goes on to show workshop jobs brought across, so the two boards
tell different stories about the same move.
*Why it matters:* a stuck import looks identical to a slow one. The owner has
no way to tell which, and no way to ask for help.
*Fix:* add "Ask us to help" top right, as on the start board. Draw one row in
trouble: a warn chip "Couldn't read this file" with "Try another file" and
"Ask us to help". Put the list in a polite live region so each row change is
read out. Show the same shop's state on the progress and summary boards (either
workshop jobs were added, or were left out and the summary says so).

**M5 — `mv-summary`, `mv-alongside`: pressing "Next: run alongside" quietly
turns every till into a practice till.**
Decision 6 is settled: every till is in practice while the move is at Run
alongside. But nothing on the summary board, where the owner presses the button,
or on any Run alongside board says so. The only place the owner learns it is the
till itself, and the checklist item "Everyone has made a practice sale", three
stages later. The practice band itself is good (words and icon, contrast about
7.7:1), but it is the only sign a till is in practice: the till bar, "Past
sales" and the card pop-up title change nothing else. Whether a practice sale
is marked on "Past sales" and on a printed receipt is not drawn on these boards
(check the till spec).
*Why it matters:* the owner may press Next for a tidy-up reason and find staff
on the till with "not real money" across the top, and no warning. Staff who are
not told may also ring a real customer through a till that does not count the
drawer.
*Fix:*
1. Put one line under the "Next: run alongside" button, and keep it on the Run
   alongside page as a permanent line: "From now, your Wheelhouse tills show
   'Practice: not real money' until you switch over. Keep taking real sales in
   Citrus Lime." No extra click.
2. A small pop-up on that button saying the same, with "Not yet" on the left and
   "Start running alongside" on the right. Impossible to miss; costs one more
   click every time.
Recommend 1. Also mark practice sales "Practice" in Past sales and on any
receipt, in words.

**M6 — `mv-pick-day`, `mv-ready-all`: the date is a typed text box, and the days
between picking and the morning are not drawn.**
"Switch over on" is `<input type="text">` with no format hint, no default and no
guard against a past day or a closed day. "It can be any day the shop is open"
is said on the page behind the pop-up, not in it. After "Switch over on [date]"
nothing is drawn until the morning itself: no version of the page that says
"Switching over on [date]" with a way to change the day, no line on Today for
the day, and no sign of who starts the morning steps or what till staff see if
the owner is not in yet (the tills stay in practice until someone does).
*Why it matters:* this is the biggest day of the move and a typed date is the
easiest thing to get wrong. Nothing tells anyone the day is coming.
*Fix:* pills for the likely days, the next open day selected already, plus
"Another day…" for a calendar (closed days greyed in words). Move "any day the
shop is open" into the pop-up. Draw the waiting page ("Switching over on
[date] · Change the day") and a Today line on the day ("Switch-over day: start
it"), landing on `mv-morning`. Say in the spec who can do the morning steps
(owner only, or a manager too).
*Decision for Jack:* how to pick the day.
1. Pills with the next open day already chosen. Zero clicks for the usual case,
   one for another day.
2. Calendar picker only. Fewer things on screen; costs a click every time.
Recommend 1.

**M7 — `mv-morning`: two steps that are one act, and the heaviest button is
filled.**
Step 2 "Clear them" deletes the practice sales, and step 3 "Make the tills
real" is the moment real money starts. They are drawn as two steps one after
another, step 3 with no button shown. There is no useful state between them:
clear without going real leaves tills in practice with nothing in them. "Clear
them" is drawn as the dark main button; destructive actions are outlined in
Soft sand.
*Why it matters:* the morning has to be quick and before the first sale, and the
risk is that someone stops after step 2.
*Fix:*
1. One button for both: "Clear practice sales and make the tills real", with a
   line under it: "[n] practice sales are deleted. The tills take real money
   straight away." Step 1 (refresh) stays its own step. One fewer click and no
   half-state.
2. Keep three rows, outline "Clear them" as a destructive button, and draw
   step 3's button. Keeps each act separate; costs a click and the half-state.
Recommend 1. Whichever: draw step 1 in its working state (the drop zone from
M1) and draw the page after step 3 ("The tills are real") with the link into
the first-week tracker.

---

## Low

**L1 — `mv-week`: the week can't show a weekend, a shut day, or an ending.**
The boxes read "Day 1" to "Day 7", so the weekend that the finish line depends
on cannot be seen; only the sentence says it. A day the shop was shut is neither
"Traded" nor "To come". Nothing says what makes a day "Traded". The row
"Citrus Lime · Still on" states something Wheelhouse cannot see, and what
happens on day 7 (the finish line) is not drawn.
*Fix:* add the weekday under each day ("[weekday]") and the word "Weekend" on
those days; add a "Shut" state in words; one line for what counts as traded;
replace the "Still on" chip with the sub-line alone, or word it "Keep until
[date]"; draw the day-7 state ("The week is done. You can switch Citrus Lime
off").

**L2 — the Switch over boards: small things.**
1. `mv-ready`: the action and chip are in a different order on different rows
   (item 1 has "Change" before "Done"; the other rows put the chip before the
   link). Pick one.
2. "The website is moved" has "Website" as its second line, which says nothing;
   show what is left ("[n] pages to check") or what it is waiting for.
3. "Everyone has made a practice sale" names Jo Taylor, Alex Morgan and Jack
   Lewis; the owner, who is the one looking, is not named. Say whether the owner
   counts.
4. "Pick the day" is marked both `disabled` and `aria-disabled`, which takes it
   out of the keyboard order, so a screen reader user never meets it. Keep it
   reachable with `aria-disabled` only and a reason ("Waiting on 2 items").
5. `mv-weeks`: the safe button is "Back" on a pop-up whose other button is
   "Save"; use "Cancel". Choosing 3 or 4 is then three clicks (Change, pill,
   Save); the pills could save at once with "Saved · Undo". Draw what the ticked
   list does when the number goes up (the tick and "Pick the day" should go
   back off).
6. "Ask us to help" moves around: top right on the start, morning and week
   boards; bottom left on the summary, fix and checklist boards; missing on
   alongside and check (M4 covers the progress board). Pick one place.

---

## Answers to the specific questions

- **44px targets:** all buttons, links, inputs and pills pass (44px tall). The
  only smaller things are the 26px chips and the stage and day boxes, none of
  which can be pressed today (H1 would make the stages links, already 56px
  tall).
- **Contrast:** passes everywhere it was worked out (about 4.7 to 7.7:1). The
  disabled "Pick the day" is exempt but see L2.4.
- **Status in words, not only colour:** yes on every chip, row and box (Done, All
  in, Not yet, Next, Traded, Today, To come, Matches, Kept). Gaps: a value that
  is discarded is shown by a strikethrough only (H3), and Run alongside says
  "Done" when it is still running (H1).
- **Labels and landmarks:** good: one heading per card, sections named by their
  heading, rows as lists, `aria-current` on the stage and day. Not good: a
  `<nav>` with no links (H1), a check table with no spoken column names (M2),
  six unnamed buttons (M3), and no announcement when the import moves on (M4).
- **Fewest clicks:** a slim drop zone on the refresh card (M1), the weekly
  check checking itself (M2), a default day with pills (M6), and one button for
  the morning (M7).

---

## Summary of what to decide

1. How the owner moves between stages (H1, option 1 or 2).
2. What a week that has one difference does to the "in a row" count (H2,
   option 1 or 2).
3. Where the "except where both changed" line goes (H3, option 1 or 2).
4. Where the drop zone lives for a refresh (M1, option 1 or 2).
5. The weekly check: check itself, or a Check button that waits for all four
   (M2, option 1 or 2).
6. Telling the owner tills become practice: a line or a pop-up (M5, option 1 or
   2).
7. Picking the switch-over day: pills or a calendar (M6, option 1 or 2).
8. The morning: one button or two steps (M7, option 1 or 2).

Nothing here changes a decision. No file other than this one was edited.

---

## Verification and outcome (30 Sep 2026)

Checked against `moving.mjs` before going to Jack: the stages were plain
`<li>`s (H1); the refresh note promised nothing is overwritten while
decision 3 keeps Citrus Lime's version where both changed (H3); the
progress board said workshop jobs were "Not added" while the summary counted
them (M4); Fix and Leave it out buttons had no names (M3). Jack took every
recommendation (decision 9 in the moving-from-Citrus-Lime review). Six new
boards (a file that couldn't be read, everything sorted, change the refresh
day, the go-real confirm, the finished week; the weekly check now fills in
row by row). Every other journey was rebuilt and compared: only build
timestamps differed. The "clipped" reports on the weekly check are the
visually hidden column names for screen readers.
