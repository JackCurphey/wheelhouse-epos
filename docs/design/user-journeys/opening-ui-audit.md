# Journey 10 — UI audit (desktop, Soft sand)

Audited 30 Sep 2026 by the designer helper from the 9 desktop renders of the
Opening the shop boards (1280 x 800: `op-float-check`, `op-float-count`,
`op-float-short`, `op-today`, `op-today-short`, `op-today-waiting`,
`op-today-staff`, `op-today-late`, `op-today-unclosed`), against
`docs/decisions/2026-09-30-opening-the-shop-review.md` (decisions 1-7),
`generator/opening.mjs`, `generator/settings-frame.mjs`, `generator/ui.mjs`,
`generator/diary.mjs` (the staff frame) and the rules for every journey in
`HANDOVER-next-journey.md`. Tablet and phone are not drawn yet, so nothing here
covers them.

**Not raised, on purpose.** The [bracketed] placeholders. Browser-blue links and
the fallback font for numbers in the renders. The unselected-pill border
contrast (parked as a design-wide fix). 12-13px text that is only a label or a
second line (this includes the 12px status chips). None of Jack's 7 decisions is
reopened: the one-tap float check, Today as the start-of-day page, Staff seeing
only Who's in and Workshop today, check-in recording only who is in, "Not in
yet" / "Late" staying grey with no alert, and an unclosed day being flagged on
Today rather than blocking the till.

**Verdict.** The look is right. Soft sand throughout, amber only in the sidebar
"you are here" marker, pop-ups in the middle with the careful choice on the left
and the confirming one on the right, every button and link 44px tall, and every
status carries a word (In, Not in yet, Late, All sent, Float short), with a tick
or alert icon on the green and amber ones. The grey chips pass contrast
(worked out from the colours in `ui.mjs`: "Not in yet" about 4.7:1, the green
chip about 6.5:1, the amber chip about 5.3:1). The problems are in what the
boards leave out. The morning count only draws one of its three outcomes, the
page contradicts itself when sales are waiting, and the two buttons a manager
is told to press ("Check", "Close it") lead nowhere drawn and never clear.
Findings are ranked; where a fix is a real choice the options are numbered.

Checked against the source, not just the pictures: "Needs attention" is chosen
by a single either-or (`short ? ... : unclosed ? ... : empty`), so waiting
sales never reach it; the float pop-up always draws the ✕ (it comes from the
shared `popup()`); the stat boxes and job rows are plain `<div>`s, only "Book
in" and "Open the diary" are clickable; rows in `line()` have a minimum height
but no padding; the count boxes are `min-height: 40px`.

---

## High

**H1 — `op-float-count`, `op-float-short`: only "the float is short" is drawn;
a count that matches, or is over, has no screen.**
"Done counting" can lead to three places: the count matches, it is short, or it
is over. Only short is drawn, with the title "The float is short". A match
presumably goes straight to the till, but nothing says so. "Over" is likely on
days that aren't unusual: a shop that never closed yesterday (decision 7) still
has yesterday's takings in the drawer, so "The drawer should have [£ float]" is
wrong that morning and whoever counts will be over by a day's money. Nothing
stops someone pressing "Done counting" with every box empty either.
*Why it matters:* this is the first thing a person does each morning. If the
screen has no answer for "it's right" or "it's too much", staff will make one up.
*Fix:* draw two more boards. Match: no extra screen, the pop-up closes, the till
is ready, and a small "Float checked" note shows (same note as Owner setup
decision 4). Over: the same pop-up as short, titled "The float is over", with
"Difference [£] over" in words. "Done counting" stays off until at least one box
has a number.
*Decision for Jack:* what "over" does.
1. Treat it like short: record it, show it on Needs attention for managers.
   Simple and consistent; costs a false alarm after an unclosed day, when the
   day is already flagged.
2. Record it, but only flag it on Needs attention when yesterday was closed
   (when it wasn't, "Wednesday 16 September wasn't closed" already explains it).
   Fewer false alarms; costs one more rule to build.
Recommend 2.

**H2 — `op-today-waiting`: Needs attention says "Nothing needs you right now"
while the Tills card shows a warning.**
The amber "[n] sales waiting to send" chip is on the same page, 120px below a
tick and "Nothing needs you right now". Decision 4 lists sales waiting as money
news for managers, but nothing decides that it belongs in Needs attention, so the
page argues with itself. A manager who trusts the top card will miss it.
*Options:*
1. Add a line to Needs attention: "Till B1 has [n] sales waiting to send" with a
   "Try again" button. Best for trust in the top card and for fewest clicks (the
   fix is in the place you are looking). Costs: it will show every time the
   internet drops for a minute, so it needs a short delay (for example only after
   [n] minutes).
2. Keep it only on Tills, and make the top card's empty words honest: "Nothing
   needs you right now" only appears when no chip on the page is amber. Costs:
   the top card is silent about something the page itself calls a warning.
Recommend 1, with the delay.

**H3 — `op-today-short`, `op-today-unclosed`: "Check" and "Close it" have no
destination drawn, and the item never clears.**
"Check" does not say what it does (open the count? show the reason? mark it
seen?). "Close it" is worded by decision 7; what is missing is where it lands
(presumably journey 16's cash-up, for Wednesday 16 September) and what the page
looks like afterwards. For the short float nothing says how the line goes away:
if it stays all day, Needs attention stops being a list of things to do. The
Tills chip "Float short" has the same problem.
*Why it matters:* a manager presses a button, something happens, and they can't
tell whether anyone has dealt with it. Staff can't either.
*Fix:* for "Close it", draw the landing (yesterday's cash-up) and the page after
(line gone, "Wednesday 16 September was closed by [name] at [time]" kept for the
day is optional). For the short float, options:
1. One click: rename "Check" to "Seen". It clears the line at once and records
   who and when, and the Tills chip changes to "Float short · seen by Jack
   Lewis". The line already shows the amount, who counted and their reason, so
   there is little to open. Best for fewest clicks.
2. "Check" opens a small pop-up with the count and reason and one "Seen" button
   on the right. Costs a second click for nothing new to read.
Recommend 1.

---

## Medium

**M1 — `op-float-check`: the ✕ lets someone leave without answering, and
Today assumes the check always happened.**
The pop-up has only two real answers, "Count it" and "Looks right", but the ✕
is drawn too (it comes from the shared `popup()` and is not removed here).
Nothing says what pressing it does. Today then says "float checked by Jo Taylor
at [time]" on Till B1 every time, so there is no state for "not checked".
*Options:*
1. No ✕ on this one pop-up. "Looks right" is already one tap, so nothing is
   gained by skipping, and Today's "checked by" line stays true. Best for fewest
   clicks and least to build.
2. Keep the ✕ and let the till open unchecked; Today shows "Float not checked"
   on the Tills row with a grey chip. Costs a new state and lets the check be
   dodged.
Recommend 1. Escape and the browser back button should do nothing either.

**M2 — `op-today`, `op-today-short`, `op-today-unclosed`: Needs attention looks
the same whether it is empty or full.**
Same white card, same 17px heading. When something needs you, the line has no
alert icon and no warning colour; the only amber on the page is the Tills chip
lower down. The rule is that real warnings keep the warning colour, and the top
card is where a manager looks first. Also, the code draws only one line at a
time, so two things at once (a short float and an unclosed day, which can
happen together) is not drawn.
*Fix:*
1. Put a count in the heading only when there is something: "Needs attention · 1"
   (words, so it reads out to a screen reader too).
2. An alert icon at the start of each line, in the warning ink, with the text
   unchanged.
3. Draw two lines once, to show how they stack.
4. Empty state: keep the tick, but shrink it to a single 48px line so the page's
   real content starts higher; or leave as is (Low either way).

**M3 — `op-today` and all others: Workshop today is hard to read and nothing on
it opens.**
- The three rows are the bikes still to arrive (3 still to arrive), but no
  heading says so. The "4 ready to collect" bikes are not listed at all, so a
  shop worker can't tell what is on the list or why.
- The right-hand end of each row is three different things: a time, the word
  "Drop-off", and a "Book in" button, with nothing saying why only Maya's
  job has the button. A bike arriving is the same act for all three.
- The two stat boxes and the job rows look like plain text. Only "Book in" and
  "Open the diary" do anything. The stats are the natural doors to the diary
  (Expected today, Ready to collect) and each job row should open its job.
*Fix:* a small heading above the rows, "Still to arrive"; every row gets the
same right-hand pattern: the time or "Drop-off" as grey text under the job and a
"Book in" button on all three (the button is the one click that matters when the
bike walks in); the two stat boxes and the job rows become whole 44px-tall
buttons with a chevron. Note that the same three rows sit on the approved
Workshop Overview (`stage2.mjs`), so change both together or say Today follows
the Overview's pattern.

---

## Low

**L1 — `op-float-short`: the problem is carried by words only, and a few small
things.**
"Difference [£] short" is in words, which is enough to pass, but nothing in the
pop-up carries the alert icon the Today page uses for the same thing. "Count
again" is a ghost button (no outline), so it reads as plain text; the same
applies to "Back" on `op-float-count`. The first row ("Should have") has a rule
directly under the header's own edge, which shows two lines. The example in the
reason box ("e.g. change taken for the window cleaner") is invented text, not
from the approved example data; use "e.g. [a likely reason]".
*Fix:* alert icon beside "Difference"; give the safe button the thin outline
used on "Count it" on `op-float-check`; drop the first rule; bracket the
example.

**L2 — `op-float-count`: boxes and the "should be" line.**
The number boxes are 40px tall (`min-height: 40px`) inside 48px rows; the row is
a label so tapping anywhere works, but the box itself is under the 44px rule.
Make it 44px and the row 52px. Second, the subtitle "should be [£ float]" shows
the expected amount, while Owner setup has a choice to count first and only then
see the difference. The morning pop-up has already shown the amount on the
previous screen, so the choice can't apply here. Say so in the spec, or remove
the subtitle.

**L3 — `op-float-check`, `op-today`: wording and spacing.**
"Good morning, Jo" is fixed text; if the first person in arrives after noon it is
wrong. Use "Hello, Jo". "The shop's float, left in last night" is not true after
an unclosed day (see H1); say "The shop's standard float". On Today, "All sent"
on Tills doesn't say what was sent; use "All sales sent". And rows with two lines
of text touch the rule above them (`op-today-waiting`: "Till B1" sits right
against the divider), because `line()` has a minimum height but no padding; add
8px above and below.

**L4 — every Today board: the page has no structure a screen reader can use.**
Good: a main heading ("Today"), a named navigation, and each card title is a
real heading. Missing: the cards are plain `<div>`s, not sections named by
their heading; Who's in and the workshop rows are not lists, so a reader can't
hear "list, 3 items". Tie each card to its heading (`<section aria-labelledby>`)
and mark the rows up as lists. No change to how it looks.

**L5 — pass-ons from the shared frame and the example data.**
- The user block wraps on every Manager render ("Jack / Lewis", "Sign / out").
  Already raised in the Owner setup and Customer service audits.
- "Today" and "Reports" use the same bar-chart icon in the sidebar; Today
  could use a sun or calendar, so the two are not confused (this is a frame
  matter, `diary.mjs`).
- The close ✕ on every pop-up is an `<a href="#">`, where a button is
  correct.
- In the diary (`diary.mjs`) WH-1045 Jamie Brooks is on Friday 18 September at
  11:00 and Maya's WH-1042 at 11:30 today; the Workshop Overview and Today say
  Thursday 17, 10:30. The two approved journeys disagree on the same jobs. Pick
  one and republish the other (like the Maya email item in the handover).

---

## Answers to the specific questions

- **Status by words, not only colour:** yes everywhere (In, Not in yet, Late,
  All sent, Float short, Open). Gap: the line in Needs attention has no icon
  (M2), and the pop-up for a short float has no icon (L1).
- **44px targets:** all buttons and links pass. Not passing: the count boxes at
  40px (L2). Not clickable but should be: the stats and job rows (M3).
- **Contrast:** the chips and the grey text on both the cards and the page
  background pass 4.5:1 (about 4.7 to 6.5:1).
- **Fewest clicks:** "Seen" clears the short float in one click (H3); "Book in"
  on every arrival (M3); the float check is one tap on the usual path, and the
  match case should add no further screen (H1).

---

## Summary of what to decide

1. What a float that is over does (H1, option 1 or 2).
2. Sales waiting: a line in Needs attention, or only on the Tills card (H2).
3. The short float: "Seen" in one click, or a pop-up first (H3).
4. The float check's ✕: remove it, or allow skipping and draw "not checked"
   (M1).

Nothing here changes a decision. No file other than this one was edited.

---

## Verification and outcome (30 Sep 2026)

Each finding was checked against the source before going to Jack:
H2 confirmed (the `waiting` flag only set the Tills chip); M1 confirmed (the
✕ came from the shared `popup()`); M3 confirmed the rows copy the approved
Workshop Overview, so only the heading was taken; L2 confirmed (40px inputs;
Owner setup decision 6 has blind counting on by default); L5 confirmed
`diary.mjs` puts WH-1045 on day 4 (Friday 18) at 11:00. Jack took every
recommendation (decision 8 in the opening-the-shop review). The shared
`popup()` gained an optional `{ close: false }`; every other journey was
rebuilt and compared, and only build timestamps differed. The two clip
reports on the till and close-the-day boards are the same on the approved
boards they reuse.
