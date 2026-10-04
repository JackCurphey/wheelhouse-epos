# Coverage cell 8: Jo records Maya's quote answer from a phone call

Stage W coverage check (`../coverage-check.md`, "Empty cells", 8), 4 Oct 2026. Journey 4 (Drop off and approve the quote) × Jo Taylor. Kept screen: `dq-record-answer` (record their answer, from a phone call). Walked on the clickable mockup's build (`generator/out-mockup/`), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, Jo's checks in `../personas.md`, and issue #116's three changes.

## The story

Story 9 (Jo on the phone), at an earlier moment than its own steps: WH-1042's quote has been sent and is waiting ("Proposed £123.00"). This is the phone version of story 1's `dq-quote` step.

1. Maya rings about the quote. Jo, at the front desk with the phone in one hand, types "maya" in the search (`staff-search` on a staff page, `till-search` on the till).
2. She opens WH-1042 (the job with the quote out, `dq-job-sent`'s moment: "Record their answer", "Withdraw quote").
3. She presses **Record their answer** (`dq-record-answer`). The ticks start as Alex recommended: brake pads and fitting ticked, gear cable not. Maya says yes to those two.
4. She presses **Save: yes to 2 lines, no thanks to 1** (`dq-job-answered`: "Approved £111.00", gear cable "Declined"). Maya gets a text with what was agreed.

The other way in: if Maya hasn't answered by the time the shop sets, Today shows "WH-1042 · Maya Patel — no answer to the quote yet" with her number and "Record their answer" (`dq-today-no-answer`).

## Clicks and screens

| Person | Size | As the mockup clicks today | As it should go (with M1) | Kept screens on the way |
|---|---|---|---|---|
| Jo Taylor | Desktop | Search row → `job-overview` ("Status Expected", no Record their answer): stuck. Only reached by sending the quote first (`dq-job-quote` › Send quote) | 3 (WH-1042 row, Record their answer, Save), plus typing "maya"; ticks need no change; 4 boards | 3 (`staff-app` search, `job-overview`, `dq-record-answer`) |
| Jo Taylor | Tablet | the same | the same | the same |
| Jo Taylor | Phone | the same | 4: the search is a button first | the same |
| Jo, from Today's flag | any | not reachable: nothing leads to `dq-today-no-answer` | 2 (Record their answer, Save) | 2 |
| Maya | phone | 0 | 1 (the text with what was agreed) | — |

Issue #116's question, "could this be a line?": `dq-record-answer` is already a box over the job page, not a page. One press with the ticks pre-set is as short as it can be while still reading back what's saved.

## High

None.

## Medium

**M1 — Jo can't reach "Record their answer" from where she'd look while on the phone.**
- *Screens:* `staff-search`, `till-search`, `dq-diary-waiting` → `job-overview`; `dq-today-no-answer`; `dq-job-sent` (all sizes).
- *What happens:* the search's "WH-1042 · Maya Patel" row opens `job-overview`: "Status Expected", one £65.00 line, "Bike is here", no quote and no Record their answer. The diary drawn for this moment (`dq-diary-waiting`, WH-1042 "Quoting") also opens `job-overview`. Today's flag (`dq-today-no-answer`) has Record their answer, but no board links to it, nor to `dq-diary-waiting`. The only click into `dq-record-answer` from the job is after pressing Send quote yourself (`dq-job-quote` → `dq-job-sent`).
- *Why it matters:* Jo's first check is "find a job from one search box while on the phone". Here the search finds the job and shows it at the wrong stage, with no way to record what Maya is saying.
- *Fix, no choice:* in the mockup, for this story's moment, the search's WH-1042 row and the WH-1042 block on `dq-diary-waiting` open the job with the quote out (`dq-job-sent`, or the same job page without its Undo bar); and the story's Today step is `dq-today-no-answer` itself (Jo's everyday Today, `op-today-staff`, has no quote flag, so the story names the situation, as stories already do for other moments). Story 9 gains these steps. Nothing new to draw.
- *Decision it touches:* Drop off and approve the quote 4 ("Record their answer" lets staff tick what the customer agreed on the phone); second walk answer 11 (one set of status words).
- *Second check:* CONFIRMED. `staff-search` and `till-search` have `data-go="job-overview"` on the WH-1042 row at all three sizes; `dq-diary-waiting`'s WH-1042 block does too; a search of every `data/*.json` finds no `data-go` to `dq-today-no-answer` or `dq-diary-waiting`. Walk-3 story 9 M1 fixed the "In the workshop" stage's links; the quote-waiting stage wasn't in its story, so this isn't the same finding.

**M2 — After a phone answer, the job page says Maya answered online.**
- *Screens:* `dq-record-answer` → `dq-job-answered` (all sizes); against `dq-answered-by-phone`.
- *What happens:* the box promises "Saved as answered by phone, taken by Jo Taylor at [time]". Save opens `dq-job-answered`, whose note reads "Maya answered the quote online at [time]". Maya's own page, for the same answer, says "answered by phone with Jo Taylor at [time]" (`dq-answered-by-phone`).
- *Why it matters:* the record of what was agreed, and who took it, is what the shop points to if Maya later says she never agreed to £111.00. Staff and customer pages disagree about how the answer came.
- *Fix, no choice:* a phone answer's note on the job reads "Maya answered by phone at [time] · taken by Jo Taylor", as the box promises and Maya's page says. A situation line on `job-overview` beside "The job page once answered", and the mockup's Save shows it as a note.
- *Decision it touches:* Drop off and approve the quote 4 ("saved with who took the call and when").
- *Second check:* CONFIRMED. `dq-job-answered`'s text at desktop, tablet and phone has "Maya answered the quote online at [time]."; `consolidate/j04.mjs` has the customer's "answered by phone with Jo Taylor at [time]". No `job-overview` situation line covers a phone answer.

## Low

**L1 — The box doesn't say the fitting goes with the pads.** Maya's quote shows "Fit & adjust brakes … Goes together with the new pads", and the staff job shows "Goes with: Shimano brake pads"; on Maya's page the two tick and untick together. `dq-record-answer` lists the three lines with only "Needed" or "Optional". If Maya says "just the pads", Jo has nothing to tell her the fitting comes with them. *Fix, no choice:* the box shows the same "Goes with" under the fitting, and the pair ticks together, "as if answered online" (the box's own words). A line on `dq-record-answer`. *Touches:* Drop off and approve the quote 2 (pairs) and its audit M2 ("staff choose which lines go together"). *Second check:* CONFIRMED: no "Goes" in `dq-record-answer`'s text at any size; `dq-quote` has "Goes together with the new pads".

## Seen, not raised

- The diary behind the open job reads WH-1042 "approved £111" while the job says "Quoting · Proposed £123.00". This is the backdrop leftover the second-walk decisions note ("Left: `job-overview`'s backdrop block still reads 'approved £111'"), and walk-3 story 3 L1.
- Answers are final once saved, with no Undo (Jo's "is it obvious how to undo a mistake?" check). Settled: quote line decisions are final (2026-09-23), Drop off and approve the quote 2; the button reads back what's saved before Jo presses it (audit M5).

## Persona checks

- **Jo, on the phone:** one search box finds Maya's job, her order and her page by typing "maya" (once M1 routes the row). The box opens with the recommended ticks, so the usual "yes to what Alex recommends" is one press. The Save button reads back "yes to 2 lines, no thanks to 1", so Jo can read it to Maya before pressing. Labels are shop words.
- **One-handed:** the box is ticks and one button; no typing.
- **Screen reader and keyboard:** each tick box is inside its label, rows 48px tall. Not checked in a browser.
- **Low vision, phone:** only "Quote for WH-1042 · answered by phone" is under 14px (13px).

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | staff-search, till-search, dq-diary-waiting → job-overview; dq-today-no-answer | Record their answer can't be reached from the search, diary or Today | No |
| M2 | dq-record-answer → dq-job-answered | Phone answer recorded as "answered online" | No |
| L1 | dq-record-answer | "Goes with" missing; the pair doesn't tick together | No |

Counts: 0 High, 2 Medium, 1 Low.

## Questions for Jack

None. Each finding applies a recorded decision.

## Verification

- **Walked:** the story at desktop, tablet and phone, with scratchpad scripts listing each board's text, every control and target, and text under 14px; searches of every `data/*.json` for links into `dq-record-answer`, `dq-job-sent`, `dq-job-answered`, `dq-today-no-answer` and `dq-diary-waiting`.
- **Boards read:** `staff-search`, `till-search`, `dq-diary-waiting`, `job-overview`'s situation lines, `dq-job-sent`, `dq-job-quote` (its Goes with), `dq-record-answer`, `dq-job-answered`, `dq-today-no-answer`, `dq-quote`.
- **Decisions read:** Drop off and approve the quote 1–8 and later changes (3 Oct "Ask me before any extra work"); quote line decisions are final (2026-09-23); the second- and third-walk decisions; walk-3 story 9's report.
- **Not checked:** rendered layout and focus order; who besides Jo may record an answer (the box is drawn for Staff).

## Second check

Re-read against the built data at three sizes and the decisions. Kept: 3. Dropped: 1.
1. "The diary block says approved £111 while quoting": dropped as already recorded (second-walk decisions' "Left" note; walk-3 story 3 L1).
