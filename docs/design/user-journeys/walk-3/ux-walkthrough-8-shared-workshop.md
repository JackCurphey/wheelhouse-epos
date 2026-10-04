# Walk-through 8, third walk: the workshop on a shared computer, and several mechanics at once (clicked on the mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup in `generator/out-mockup/` (published at https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi). I followed story 8's 16 steps (`generator/mockup/stories.mjs`) through the drawing the mockup shows and every button's real target. Alex and Jo were walked on the shared desktop, then on a tablet (Alex's own), then at phone size, with the Saturday worker at the till. A scratchpad script listed the text and controls; nothing was saved to the repo. The second walk is `../walk-2/ux-walkthrough-8-shared-workshop.md`. Jack's answers are in `docs/decisions/2026-10-03-ux-walkthrough-8.md` and its 3 Oct later changes; they aren't raised again.

## The story, as the mockup clicks it

1. Alex Morgan types his PIN on the workshop computer (`till-checkin`). On the diary he opens WH-1042, Maya's Trek Domane AL 3 (`diary` › `job-overview`), then its checklist (`job-checklist`), and presses "Switch".
2. Jo Taylor types her PIN and opens WH-1068, Oliver Chen's Brompton (`diary` › `job-overview`). "Working: Jo Taylor · Switch" is a line only.
3. Alex types his PIN again, and on the checklist presses "Mark ready for collection" › `job-finished`.
4. Another day, on a tablet: Alex taps WH-1046 in "No time" on the diary.
5. On Saturday, the Saturday worker types their PIN at the till, finds WH-1042 (`till-search`), and hands it over (`till-hand-over-job` › "Hand over" › `till-empty`). The "Hand over" on the search row is a line only.

## Clicks and screens per person

Counted from the story's named buttons; PIN typing isn't counted.

| Person | Clicks | Different screens |
|---|---|---|
| Alex Morgan (shared desktop, then tablet) | 5, plus 3 PINs | 5 |
| Jo Taylor (shared desktop) | 1, plus 1 PIN | 3 |
| Saturday worker (till) | 1, plus 1 PIN (and the search, which the story bridges) | 4 |

Every step is drawn at all three sizes. "Switch" is drawn on desktop only, and the phone checklist sheet has no "Mark ready". Both are already in `mockup-gaps.md`.

## High

None found.

## Medium

**M1 — On the workshop computer, a PIN opens the till's float check and greets Jo.**
- *Screens:* `till-checkin` › `op-float-check` (all sizes), steps 1, 5 and 8.
- *What happens:* every key on the PIN pad (1 to 9, and 0) goes to `op-float-check`, "First in: a one-tap float check". It reads "Hello, Jo · Till B1 · first in today to take payments" and asks for the drawer's float, whoever typed the PIN. `till-checkin` itself reads "Till B1 Bolton · Nobody serving — enter your PIN", not a workshop computer. The first key press leaves the page, so a whole PIN can't be typed. The workshop computer is drawn only as lines on `till-checkin` ("A workshop computer: Enter your PIN, and what you do is recorded under your name and role"), and the mockup doesn't show lines. The story gets past each PIN with "(Types the PIN)".
- *Why it matters:* the whole point of this story is whose name the work goes under (Alex's check in `personas.md`). Clicked, Alex's PIN says "Hello, Jo" and sends him to count the till's cash.
- *Fix:* a real choice; see Question 2.
- *Decision it touches:* walk-through 8 decisions 1 and 3, and fix M6 part 1. Second-walk answer 10 ("Now working: [name]" announced). Not reopened.

**Second check:** CONFIRMED. I re-read `till-checkin` at all sizes: the digit keys go to `op-float-check`. So do the digit keys on its three situations (offline, stale, wrong PIN), from a search of every data file. `op-float-check` reads "Hello, Jo". The canvas `jb_sit_till-checkin` has the workshop computer lines. No drawing of a workshop computer's PIN screen exists.

**M2 — WH-1042's diary card opens the job at the wrong stage, and WH-1046 opens Maya's job.**
- *Screens:* `diary` › `job-overview` › `job-checklist` (all sizes); step 11's WH-1046.
- *What happens:*
  - Alex taps "Trek Domane AL 3 … WH-1042, In the workshop, 11:30–13:00 · approved £111". The job opens as "Expected" with "Full service checklist 0 of 10 done · 0 notes" and a "Book in" button. He opens the checklist and it says "8 of 10 done · 1 note".
  - On the tablet, Alex taps "WH-1046 · Standard service" in "No time", the shared queue. The mockup opens WH-1042's page.
  - The other filler cards that use Maya's name (WH-1051, WH-1054, WH-1056 and more) also all open WH-1042.
- *Why it matters:* the diary says one thing, the job page another, and the checklist a third, all in two taps. Alex wanted the queued job and got Maya's. Walk-2 M2 asked that "a press switches the one job board to the matching line". That is done for Mark ready (it goes to Finished, with Undo), but not for opening a job from the diary.
- *Fix, no choice:* WH-1042's "In the workshop" card opens `job-mechanic` ("Job · in the workshop (mechanic)", drawn, 8 of 10 done). WH-1046 says "Not drawn yet: WH-1046's page", and the "I'll do this" line on `diary` explains it. Other jobs' cards say "Not drawn yet: this job's page" rather than opening Maya's.
- *Decision it touches:* Workshop day 20 (one job, one set of status words; second-walk answer 11). Walk-through 8 decision 5 (the shared queue). Walk-2 M2.

**Second check:** CONFIRMED. On `diary` (desktop, tablet, phone) the WH-1042 card and "WH-1046 · Standard service" both go to `job-overview`, whose title is "Job · expected" and whose checklist link reads "0 of 10 done · 0 notes". `job-checklist` reads "8 of 10 done · 1 note". `job-mechanic` is drawn, and is where "Start work" already goes.

**M3 — At the till, the paid-online repair can only be paid for again.**
- *Screens:* `till-search` › `till-job`; `till-hand-over-job` (all sizes).
- *What happens:* the Saturday worker searches "maya". The WH-1042 row reads "approved £111.00 · Add to basket" and opens `till-job`, "Pay for a workshop job". The drawn hand-over for a repair already paid online (`till-hand-over-job`: "Paid online £111.00 … Already paid online — nothing to take at the till") is in the mockup, but no button leads to it. The search row's "Paid online · Hand over" is a line on `till-search` only.
- *Why it matters:* Maya paid £111.00 online. Clicked, the only way forward takes her payment again.
- *Fix:* a real choice; see Question 2.
- *Decision it touches:* walk-through 8 decision 8 (the till hands over a paid repair); Collect and pay 5 (H3); walk-2 M3, done as a line.

**Second check:** CONFIRMED. On `till-search`, the WH-1042 row goes to `till-job`. A search of every data file finds no button leading to `till-hand-over-job`. The canvas line "A job paid online: Paid online · [date], with Hand over in place of Add to basket" is on the till search.

**M4 — Almost none of this story's decisions can be seen in the mockup.**
- *Screens:* `till-checkin`, `diary`, `job-overview`, `job-checklist`, `till-search` (all sizes).
- *What happens:* Jack's walk-through 8 decisions are on the canvas as situation lines: the workshop computer and its 10-minute return to "Enter your PIN"; "Working: [name] · Switch" (drawn once, on desktop `job-checklist`); "Who did what" and "Signed off by Alex Morgan · 15:30"; "I'll do this" and "Taken by Jo Taylor"; "Keep mine / Keep Alex's"; the till's paid-online hand-over. The mockup shows drawings and their buttons only. Its "This screen's situations" list holds drawn situations, not lines. None of the words above appear in any mockup page except "Working: Alex Morgan · Switch".
- *Why it matters:* anyone clicking story 8, including Mark, sees an ordinary diary and job page. It looks as if the shared-computer decisions were never made.
- *Fix:* a real choice; see Question 1.
- *Decision it touches:* walk-through 8 decisions 1–8, recorded as lines (walk-2 H1, H2); the one-canvas rule "lines, not new drawings".

**Second check:** CONFIRMED. I searched every `out-mockup/data` file for "Signed off", "Who did what", "I'll do this", "Taken by", "Keep mine", "workshop computer" and "Working: ". Only "Working: " is found, on `j12-desktop`'s `job-checklist`. `build-mockup.mjs` writes no situation lines into `manifest.json`. The lines are in `out/project/canvas.json`.

## Low

**L1 — Alex sees Jo's diary, not a mechanic's.**
- *Screens:* `diary` (steps 2 and 11), `diary-mechanic`.
- *What happens:* Alex's diary step is the Staff drawing: "Everyone · Alex · Jo", Sam Reed's pending request, no "Me". The mechanic's diary (`diary-mechanic`, with "Me") is drawn. Closing a job sends him to one or the other: "Close, back to the diary" goes to `diary` from `job-overview`, and to `diary-mechanic` from `job-mechanic` and the checklist.
- *Fix, no choice:* the same fix as walk-through 7's M3. The mockup applies the chosen person on every page, so a mechanic gets `diary-mechanic`.
- *Decision it touches:* walk-through 8 fix M2 ("Me" for anyone who works in the workshop).

**Second check:** CONFIRMED. The story's diary steps use `diary` (role Staff). `diary-mechanic` is role Mechanic and has "M Me". The Close targets are as stated.

**L2 — The checklist's Close and Done jump to another page instead of going back.**
- *Screens:* `job-checklist` (all sizes).
- *What happens:* from `job-overview` (Expected), the checklist's "Close, back to the job" and "Done" go to `job-mechanic` (In the workshop), not to the page Alex came from.
- *Fix, no choice:* Close and Done go back. This is the same fix as walk-through 6's M1.
- *Decision it touches:* none.

**Second check:** CONFIRMED. Both labels go to `job-mechanic` on `job-checklist` at all sizes.

## Dropped at the second check

- **"Switch" missing on tablet and phone, and "Mark ready" missing on the phone checklist.** Both are already in `mockup-gaps.md`.
- **No workshop-computer setting beside the tills, no "Me" on Jo's diary, no live changes between devices.** Jack answered these (walk-through 8 decisions; the 3 Oct later change, walk-through 8 H3). They are lines, and M4 covers how the mockup shows lines.
- **The book-in note's time.** Jack answered this (3 Oct, walk-through 1 second walk L3: "[time]"). `job-mechanic` reads "Jo Taylor · [time]".
- **The PIN described as till-only.** Fixed: `till-checkin` reads "puts your name on sales and workshop work".
- **The till rail's "Sign out".** Fixed: the till reads "Check out" and goes to `till-checkin`.

## Walk-2 findings, checked in the mockup

| Walk-2 | In the mockup |
|---|---|
| H1 decisions not on the canvas | Lines on the canvas; not visible in the mockup (M4) |
| H2 several devices at once | Lines; not visible (M4) |
| H3 stopping a workshop computer | Answered by Jack (beside the tills); a line |
| M1 dead ends | Fixed: Continue, Sign out, Check out, the PIN pad and the search rows all lead somewhere. Where some lead is M1 and M3 |
| M2 stages as lines | Mark ready → Finished with Undo works; opening from the diary doesn't (M2) |
| M3 till book-in and paid hand-over | The hand-over is drawn but can't be reached (M3) |
| M4 idle line's citation | Not re-checked |
| M5 PIN till-only | Fixed |
| L1 09:05 | Answered: "[time]" |
| L2 "Switch site" | Not re-checked on these boards |

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | till-checkin › op-float-check | Workshop PIN opens the till's float check, "Hello, Jo" | Yes (Q2) |
| M2 | diary › job-overview › job-checklist | Diary card opens the wrong stage; WH-1046 opens WH-1042 | No |
| M3 | till-search › till-job; till-hand-over-job | Paid-online repair can only be paid again | Yes (Q2) |
| M4 | story 8's screens | The story's decisions are lines the mockup doesn't show | Yes (Q1) |
| L1 | diary, diary-mechanic | Alex sees Jo's diary | No |
| L2 | job-checklist | Close and Done don't go back | No |

## Verification

- **Walked:** all 16 steps at desktop, tablet and phone in `generator/out-mockup/` (`data/jb`, `j11`, `j12`). I read each step's text and every control's target, and also `op-float-check`, `diary-mechanic`, `job-mechanic`, `till-job` and `till-hand-over-job`. I searched every data file for links into `till-hand-over-job` and `op-float-check`, and for the decision wording in M4. I read the canvas lines on `till-checkin`, `diary` and `job-overview` (`out/project/canvas.json`), plus `build-mockup.mjs` and `page.html`.
- **Checks run:** `node --test docs/design/user-journeys/generator/mockup/` passes 4 of 4. Bracketed steps ("Types the PIN", "a line only") are skipped by that check, which is where M1 and M3 sit.
- **Decisions read:** walk-through 8 in full with its 3 Oct later changes; the second walk's smaller questions (answers 10 and 11); Workshop day 20; `mockup-gaps.md`; the clickable-mockup spec.
- **Not checked:** the rendered page, a real screen reader, keyboard focus, tablet dragging, the workshop offline.

## Questions for Jack

1. **Should the mockup show each screen's situation lines (M4)?**
   1. Yes: under each drawing, a plain list of that screen's lines from the canvas, read-only. *Good for:* every decision recorded as a line can be read while clicking, with no new drawings. That keeps issue #116's "fewer drawings". *Costs:* the lines are text to read, not things to click.
   2. Draw the lines this story depends on as situation drawings. *Good for:* they can be clicked like everything else. *Costs:* more drawings, against the "fewer drawings" goal, and the other stories' lines stay hidden.
   3. Leave it: the canvas has the lines and the mockup has the joins. *Good for:* no work. *Costs:* anyone walking story 8 by clicking misses nearly everything Jack decided about shared computers.

   Recommend 1.

2. **The two places in story 8 where the clicked path does the wrong thing: the workshop PIN (M1) and the paid-online hand-over (M3).**
   1. Draw both as situations, since both are already decided: a workshop computer's "Enter your PIN" (no till number, keys lead to the diary as that person, "Now working: Alex Morgan"), and the till search with WH-1042 "Paid online · [date] · Hand over" (leading to the drawn `till-hand-over-job`). *Good for:* story 8 clicks right end to end, and nobody is shown taking Maya's money twice. *Costs:* two more drawings.
   2. Keep them as lines, and have the mockup say "a line only — see the situation list" on those buttons instead of going somewhere wrong. *Good for:* no new drawings. *Costs:* the two most important moments of the story still can't be clicked.

   Recommend 1.
