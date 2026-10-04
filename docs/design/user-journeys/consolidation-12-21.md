# Consolidation — journeys 12, 21

Read-only analysis for issue #116 step 1, 3 Oct 2026. Sources: `generator/journeys.mjs:753-791` (journey 12) and `:1206-1260` (journey 21), checked by count. Journey 12 has **28 screens** and journey 21 has **42**, so **70 screens**. Each one is drawn at desktop, tablet and phone (`lightspeed.mjs:248`, `diary.mjs:1601-1605`), which makes **210 drawings**.

## Counts by class

| Class | J12 | J21 |
|---|---|---|
| Real screen | 7 | 5 |
| Situation of another screen | 17 | 15 |
| Edge case | 2 | 9 |
| Settings | 1 | 12 (2 of them real) |
| Already drawn in another journey | 1 | 1 |
| Deferred by the 3 Oct answers | 0 | 0 |

- **Nothing here is one of the six things deferred on 3 Oct.** `ls-office-data` is the activity log, which stays (`2026-10-02-management-oversight-review.md:117`).
- **All of journey 21 is "after the trading week".** Jack chose this in build-plan question 5 (`2026-10-03-build-plan-questions.md:58-61, 113-114`; build plan `:294`). Its 42 screens are counted separately from Release 2's build.

## The job page: 48 checked

By count from the generator, **49 screens are the job page with one strip or button changed**, across 6 journeys:

| Journey | Job-page screens | Where |
|---|---|---|
| 12 | 7 | `diary.mjs:2404-2586` |
| 21 | 24 | 22 from `jobAt` (`lightspeed.mjs:124`), plus 2 part-search boxes drawn over the quote job page (`:217-218`) |
| 4 | 7 | `quote.mjs:185-197` |
| 5 | 5 | `collect.mjs:158-163` |
| 13 | 5 | `receiving.mjs:337-339` |
| 9 | 1 | `mv-practice-job` (`moving.mjs:253`), which goes because practice mode was dropped |

Mark's 48 is in range. The exact total depends on whether the full service checklist and the part-search boxes count. `dq-job-waiting` and `cp-ready-paid` are the very same drawings as `job-waiting-parts` and `job-collection`.

## Merge table

| Ids | Becomes | Saved | Decision touched |
|---|---|---|---|
| `job-overview`, `job-book-in`, `job-quote`, `job-mechanic`, `job-waiting-parts`, `job-finished`, `job-collection` | Job page, with 7 stages in its situation list | 6 | Workshop day 20 already says "the same page with that stage's main action" (`2026-09-27-workshop-day-review.md:82-83`) |
| 14 `ls-job-*` strip states (not connected, sent, changed, price changed, price asked, cancelled, pick, waiting, unsure, ready with no work order, unpaid, paid, fallback, collected unpaid) | One drawing of the job page's Lightspeed strip, with 14 lines | 13 | Lightspeed 2, 3, 6, 10 (H3), 12 |
| `diary-mechanic`, `waiting-open`, `change-selected`, `diary-context-menu`, `new-job-pick`, `diary-stack-hover`, `diary-stack-open` | Diary, with a situation list | 7 | Workshop day 13, 14, 19, 22, 37, 59, 61 |
| `job-quick-overview`, `diary-hover-summary` | One quick-look box (opened by right-click, hover or long-press) | 1 | Workshop day 37, 65 |
| `request-new`, `request-decline`, `request-change`, `request-cancel` | One request box: 3 kinds of request plus the decline step | 3 | Workshop day 15 |
| `new-job`, `new-job-day` | New job box (line: "from Day view, mechanic from the column") | 1 | Workshop day 18, 54 |
| `diary-settings` | The same drawing as journey 8's `set-workshop-diary` (`setup.mjs:323`) | 1 | Owner setup 12 |
| `customer` | The same as journey 15's `cs-page` (`diary.mjs:2728-2732`) | 1 | Customer service 11 |
| `ls-settings-off`, `-on`, `-manager`, `ls-reconnect` | Settings › Office › Lightspeed, with 4 situations | 3 | Lightspeed 7 |
| `ls-connect-signin`, `-shops`, `-shops-two`, `-checks` | One 3-step box; "two shops" becomes a line | 3 | Lightspeed 7, 10 (M5) |
| `ls-disconnect` | A line in the shared "Are you sure?" box | 1 | Lightspeed 10 (L5) |
| `ls-messages`, `ls-workshop-settings`, `ls-office-data` | "Lightspeed shop" lines on journey 8's settings pages | 3 | Lightspeed 10 (M1, M2) |
| `ls-today`, `-today-down`, `-today-person`, `-today-unpaid` | Lines on Today (journey 10); `-person` repeats `op-today-staff-lightspeed` (`opening.mjs:242`) | 4 | Lightspeed 6, 10 |
| `ls-book-in`, `ls-customer-pick` | One customer picker box (the code already shares its rows, `lightspeed.mjs:164-167`) | 1 | Lightspeed 4; walk-through 6 M1 |
| `ls-hand-over-unpaid`, `-unreachable`, `-unchecked`, `-found` | One hand-over box whose words follow the cause (already one function, `lightspeed.mjs:173-178`) | 3 | Lightspeed 10 (H2, L5) |
| `ls-job-check`, `ls-hand-over-no-wo` | One "Link a work order" box. Both use the same field (`:170, :183`); merging them is optional | 1 | Lightspeed 6; walk-through 6 H2 |
| `ls-part-search`, `-down` | Product search box, plus an "as of [time]" line | 1 | Lightspeed 5, 11 |
| `ls-customer-ready` | The same as journey 5's `cp-summary-ls` (`collect.mjs:310`) | 1 | Walk-through 6 H1 |

**Kept as separate drawings:**
- **Journey 12 (8):** diary, Day view (its layout changes, Workshop day 18), quick look, request box, New job, job page, full service checklist, Workshop overview.
- **Journey 21 (8):** Lightspeed settings, the connect steps, part search, customer picker, hand-over box, link a work order, Mark it sorted, and the Lightspeed strip.

**Reduced count: 70 → 16 screens.** About 22 drawings instead of 210, if only the diary, Day view and job page keep three sizes (see the tablet section below).

**Looks too big for a first release:**
1. **All of journey 21** (question 5 above). Lightspeed's behaviour also can't be checked until there's a test account (`lightspeed.mjs:20-21`). Suggestion: turn it into situation lists only and don't redraw it now.
2. **Words appearing live in the notes, and "Keep mine / Keep Alex's" on a clash.** Walk-through 8 decision 2 names its own simpler fallback "if this is too big for Release 2" (`2026-10-03-ux-walkthrough-8.md:29-31`). Choosing it reopens nothing.
3. **Stacked jobs fanning out from the middle on hover** (Workshop day 59, 61). No persona asks for it. The tap-to-choose stack (`diary-stack-open`) could come first. This is a question for Jack, not a change.

## Building blocks

These 70 screens use 11 of Mark's 15 blocks:

| Block | Used by |
|---|---|
| 1 Settings page and 2 Settings row | The Lightspeed and Workshop settings |
| 3 Table with filters | Workshop overview's Arrivals / Shared queue / Needs attention / Ready (`diary.mjs:2711`) |
| 6 Today cards | `today()` is one function with about 35 switches (`opening.mjs:99`) |
| 7 Step-by-step checklist | The connect steps |
| 8 Are you sure? | Disconnect |
| 9 Form box | New job, request, picker, Mark it sorted, hand-over, link a work order |
| 10 Undo message | After Mark ready and Collected (`diary.mjs:2898`) |
| 12 Hidden controls | Manager sees settings read only; "Mark it sorted" for owners and managers only; the mechanic's shorter sidebar |
| 13 Shop switcher | "Which Lightspeed shop is which" |
| 14 Activity list | `ls-office-data` |
| 15 Job page | All job screens |

Blocks 4 (detail page) and 11 (empty list) are needed but not drawn here.

**Blocks not in Mark's list:**
1. **Diary** (week and day grid, Waiting column, stacks, pick mode). This is the largest block, and the list leaves it out.
2. **Stage strip on the job page:** badge, main line, side note, button. It carries every Lightspeed state, every part problem, and paid or unpaid.
3. **Quick-look box.**
4. **Product search box.**
5. **"Last checked [n] seconds ago · Why?" line** (`lightspeed.mjs:46-49`).
6. **"Working: [name] · Switch" bar.** Decided in walk-through 8 decision 1, not drawn.

So 17 blocks cover what are now 70 screens and 210 drawings.

**Tablet:** Mark's expectation holds for the workshop, and phone needs keeping too:
- **Diary on tablet:** its own touch blocks and pop-ups (`diary.mjs:1284`, `:1445-1483`), with hover replaced by long-press (Workshop day 68).
- **Diary on phone:** a different layout (day strip, Waiting as a sheet, `:1489-1569`).
- **Job page on tablet and phone:** its own touch layout (`buildJobPage` `touch`, `:2376`), with rows you tap to open on a phone (Workshop day 3).
- **Journey 21 does not need a tablet drawing:** decision 13 says the tablet "keeps the desktop layout" (`2026-10-02-lightspeed-shops-review.md:150-155`).

## Walking the tasks

| Person | Task | Clicks | Screens | Source |
|---|---|---|---|---|
| Alex, mechanic | See my jobs | 0 | 1 | walk-through 8 report `:19` |
| Alex | Open a job and start | 2 | 2 | `:21` |
| Alex | Parts, ticks, checklist, Mark ready | about 20 | 2 + checklist box | `:22` |
| Alex | Swap people on a shared desktop | 4–6, plus email and password | 3 | `:23-25` |
| Alex | Swap people on own tablets | 0 | 0 | `:29` |
| Jo, front desk | Book in | 2 | 2 | `:20` |
| Jo | Accept a booking request | 3 | 2 | inferred from Workshop day 14, 15 |
| Jo | New job | 3 plus typing | 2 | inferred from Workshop day 22 |
| Jo | Catch up while on the phone | 0 (hover) or 2 (right-click) | 1 box | Workshop day 37, 65 |
| Jo, Lightspeed shop | Hand over before payment shows | 3 | 2 boxes | walk-through 6 report `:24` |
| Jack, owner | Connect Lightspeed | about 4, plus Lightspeed's own page | 1 page + 3-step box | inferred, `lightspeed.mjs:62, 77-79` |

**Where people get lost:**
- **Alex on a shared desktop:** the job pop-up covers the sidebar name, so Alex can't tell whose name the work goes under (walk-through 8 report `:21`, M1).
- **Alex's clicks:** about 20 of them are ticking the checklist and work lines.

## Persona findings

**High**
1. **A mechanic on a shared desktop can't record work under their own name in the drawings.** The PIN takeover and the "Working:" bar are decided (walk-through 8 decisions 1 and 4) but not drawn. Searched every generator module for "workshop computer" and "Working:" and found nothing. Add it as one line on the page frame, not 28 redrawn screens.
2. **Two people working on one job at once isn't drawn** (walk-through 8 report `:39`; decision 2). Make it a job-page situation list, and choose between the full version and the fallback.

**Medium**
1. **The owner has nowhere to turn a computer into a workshop computer.** Walk-through 8 decision 1 says "Signed-in devices lists it" (`:19`), but Signed-in devices was deferred on 3 Oct (`2026-10-02-management-oversight-review.md:117`). The two decisions conflict, so this needs Jack's call.
2. **A Saturday worker who only has the till can't book a bike in or hand one over.** Walk-through 8 decision 8 adds two till screens; they aren't drawn yet. *Inferred:* a Lightspeed shop has no Wheelhouse till (Lightspeed 1, `:27-28`), so this route doesn't exist there.
3. **The same screen is drawn in two journeys** in 4 places (`diary-settings`, `customer`, `ls-customer-ready`, `ls-today-person`). The copies can drift apart.
4. **Alex's main task takes about 20 clicks, mostly the checklist** (walk-through 6 report `:27`). It is set against Jack's "fewest clicks" rule; any shortcut would be a design change for Jack to approve.

**Low**
1. **No empty diary or empty Waiting column is drawn** (searched `diary.mjs`). A new shop's first day needs one line for each.
2. **The sign-off is a line, not a drawing.** "Mark ready" is the mechanic sign-off (question 3), so `job-finished` needs a "Signed off by" line and the folded "Who did what" list (walk-through 8 decision 7).
3. *Inferred:* Waiting for parts is set from the Status choice in the job details (`job-page.mjs:130`). No button says so; it is one step for a mechanic to find.
