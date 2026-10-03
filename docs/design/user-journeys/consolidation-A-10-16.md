# Consolidation — journeys A, 10, 16

Read-only analysis for issue #116 step 1, 3 Oct 2026. The screen counts come from `generator/journeys.mjs` (A at :66, 10 at :649, 16 at :958), checked by count: 13, 21 and 15. The board counts come from running the three modules. Anything marked *(inferred)* is my reading and was not stated in a file.

## 1. Counts

There are **49 screens** in `journeys.mjs`: 13 in A, 21 in 10 and 15 in 16. 48 are drawn in these modules. The 49th, `desk`, is only a link to an old journey 12 board (`stage2.mjs:375`). The 48 drawn screens make **135 boards** across desktop, tablet and phone.

| Class | A | 10 | 16 | Total |
|---|---|---|---|---|
| Real screen | 6 (`map`, `staff-app`, `till-rail`, `till-search`, `your-settings`, `site`) | 4 (`op-float-check`, `op-float-count`, `op-float-short`, `op-today`) | 4 (`eod-count`, `eod-check`, `eod-paidout`, `eod-z`) | **14** |
| Situation | 6 (Mechanic view, two phone menus, rail open, shop's own theme ×2) | 10 (matched, over, short, seen, waiting, two, staff, late, Cycle to Work, Lightspeed staff) | 8 (`eod-entry`, attention, result, exact, banking, banking-none, card, finish) | **24** |
| Edge case | 1 (`your-settings-no-pin`) | 5 (`-check-unclosed`, `-check-first`, `-today-banked`, `-today-unclosed`, `op-close-yesterday`) | 2 (`eod-waiting`, `eod-waiting-banked`) | **8** |
| Settings | – | – | 1 (`eod-count-shown`, the blind-count switch, Cash-up 2) | **1** |
| Deferred by the 3 Oct answers | – | 1 (`op-today-practice`, dropped: `2026-09-30-moving-from-citrus-lime-review.md:123`) | – | **1** |
| Link only | – | 1 (`desk`) | – | **1** |

There are two more possible deferrals *(inferred)*:
- `site-ocean` and `site-ocean-menu` show a shop's own theme. The theme editor is now "later" (`2026-10-02-website-management-review.md:208`, which defers decision 3 at :47).

## 2. Persona walks

| Task | Who | Clicks | Screens | Source |
|---|---|---|---|---|
| Open the till, float looks right | Jo, desktop | 4 PIN digits + 1 | 3 (PIN screen, float check, till) | `ux-walkthrough-2-shop-day.md:17-18` |
| …counting, and it's short | Jo | +3 clicks, up to 12 boxes typed | 5 | same |
| See and clear a short float | Jack Lewis | 0 to land on Today, 1 "Seen" | 1 | WT2:19 |
| Close the day on a clean night | Jack | 4 PIN digits + 6, count typed | 3 (till, Close the day, report) | WT2:25 |
| Close yesterday from Today | Jack | about 4 *(inferred, `cashup.mjs:105-116,146-150`)* | 3 | – |
| Check in as a mechanic | Alex | 4 PIN digits, no float check | 1 | `opening.mjs:34-36` |
| Turn on Larger text | anyone | 3 *(inferred)* | 2 | `app-map.mjs:101,161-190` |

**Where people get lost:**
- **The owner on Today.** They look for takings and find none.
- **The Saturday worker** who is first in after a day nobody counted. Their only choice is "Count it", and that count becomes the earlier day's count (`opening.mjs:49`).
- **Alex on a shared computer.** See H1.

The 3 clean-night screens are drawn as 15 boards.

## 3. Merge table

| Ids | Becomes | Saved | Decision it touches (all kept) |
|---|---|---|---|
| `op-float-check`, `-unclosed`, `-first` | One float-check box, 3 situations | 2 | Opening 2, 7; WT2 H1(b); WT4 M4 |
| `op-float-count` | The note-and-coin counter, drawn once (with `eod-count`) | 1 | Opening 2; Cash-up 3 |
| `op-float-matched` | A message: "Float checked" | 1 | Opening 8 H1 |
| `op-float-short`, `-over` | One difference box | 1 | Opening 8 H1; WT2 L3 |
| `op-today` + 11 Today variants | **One Today page.** Its situation list holds the Needs attention lines, the Staff view and the Lightspeed shop view | 11 | Opening 3, 4, 6, 7, 8; WT2 H1(a), L2; WT5 M3, H2; WT6 M1 |
| `op-today-practice` | Dropped | (counted in the row above) | Moving, 3 Oct note |
| `op-close-yesterday` | A situation of Close the day: "an earlier day, opens at banking" | 1 | Opening 8 H3; WT2 H1 |
| `eod-waiting` … `eod-finish` (11 ids) | **One Close the day page.** Each step's states go in its situation list | 10 | Cash-up 2–6; WT2 H1, L5 |
| `eod-entry` | A control the till bar hides by role and time (a line in journey 11's list) | 1 | Cash-up 5 |
| `staff-app-mechanic`, `staff-app-menu` | Situations of the staff frame (hidden by role; phone menu) | 2 | App map 11, 14 |
| `till-rail-open` | A situation of the till frame | 1 | App map 4, 5 |
| `your-settings-no-pin` | A situation of Your settings | 1 | WT4 H1 |
| `site-menu`, `site-ocean`, `site-ocean-menu` | Situations of the website frame | 3 | App map 3, 10 |

**What stays a drawing:** `eod-check`, `eod-paidout` and `eod-z`, because each opens a box over the page and changes the layout.

**Against a decision:** turning `site-ocean` into a list line goes against App map 3's "one extra board" (`2026-09-29-app-map-review.md:24-29`). That's Jack's call. With the theme editor now later, the board proves something that isn't in the first release yet.

**Not drawn twice (rule 5):** `staff-app` is journey 12's diary board reused (`app-map.mjs:231`), so it becomes a link to journey 12.

## 4. Reduced count and building blocks

**48 drawn → 13.** That is 35 fewer, about 73%:
- **A (6):** map, staff frame, till frame, search, Your settings, website frame
- **10 (3):** float check, difference box, Today
- **16 (4):** Close the day, check a sale, paid-out, end-of-day report

The 13 screens need 12 building blocks.

**From Mark's list (9):**
- 2 Settings row (Your settings switches)
- 5 Report page (the end-of-day figures)
- 6 Today cards
- 7 Step-by-step checklist (the steps that fold and open the next one by themselves)
- 9 Form box
- 10 Saving/failed/undo message
- 11 Empty list ("Nothing needs you right now", "No cash taken out today")
- 12 Controls hidden by role
- 13 Shop switcher

Blocks 1, 3, 4, 8, 14 and 15 aren't needed here.

**Not in Mark's list (3):**
1. **The app frame.** This is three frames: the staff sidebar (with the tablet rail and phone menu), the till bar with its folded rail, and the website header and footer. Every screen on every canvas sits inside one of them.
2. **Search with grouped results** (`app-map.mjs:45-54`). This is Jo's main check in `personas.md:47-48`.
3. **Note-and-coin counter.** It is currently written twice, with different column rules: `opening.mjs:57-58` and `cashup.mjs:74-84`.

The pop-up box is also written twice (`settings-frame.mjs:171`, `cashup.mjs:173`). Mark's block 9 should cover both, including the "no ✕" version.

**The biggest single saving is Today.** One function with about 33 switches (`opening.mjs:99`) draws 12 boards here, and 13 other modules call it 23 more times. The build plan already treats it as one skeleton (`2026-10-03-release-2-build-plan.md:179-181`).

## 5. Persona findings

**High**

1. **Alex's shared computer isn't drawn in the frame.** Walk-through 8 decided on a workshop computer with "Working: [name] · Switch", a rail foot reading "Check out", and Your settings that follow the PIN person (`2026-10-03-ux-walkthrough-8.md:15-24,58-62`). None of it is drawn yet (:69-72).
   - The map still lists three places and says "Signed in with email and password" (`app-map.mjs:350`).
   - The rail foot still says "Sign out" (`app-map.mjs:101`).
   - Fix: add one situation line to the staff frame, plus a fourth box on the map. Only the PIN takeover screen (journey B) needs a drawing.

**Medium**

2. **The map promises takings on Today, and Today has none.** The map says the owner lands on Today for "Takings, workshop, anything needing attention" (`app-map.mjs:360`, approved as drawn by App map 11). Today has no takings figure (`opening.mjs:99-216`; Opening 3 lists four parts, none of them takings). Jack's own check is "first thing, no clicks" (`personas.md:115-116`).
   1. Reword the map line. Nothing to build, but takings stay one click away on Reports.
   2. Reuse the 3-figure strip from Reports on the owner's Today. No clicks, but it touches Opening 3.
3. **Banking breaks when there is less cash than the float.** "Bank [£ counted − float]" goes negative (`cashup.mjs:123-124`). This case and a cash refund bigger than the drawer are still undrawn (WT2 L6, `ux-walkthrough-2-shop-day.md:172`). Each should be a situation-list line.
4. **Nobody tells Staff when the day hasn't been closed** *(inferred)*. Only owners, managers and people with "Can close the day" see Close the day (Cash-up 5; Opening 4). If none of them is in, as can happen on a Saturday, Staff at closing time are told nothing. The next first-in has to do a full count. This needs one line on the till after closing time.

**Low**

5. Journey A is in no walk-through story (`build-plan.md:99-101`). Only walk-through 8 touches it.
6. Your settings' "Send feedback" and "What Wheelhouse records about you" (`app-map.mjs:179-181`) are later by Q5 (`2026-10-02-management-oversight-review.md:117`). *(Inferred)* "See my own activity" stays, because the activity log stays.
7. The morning and evening counters lay out differently on a tablet (`opening.mjs:58` vs `cashup.mjs:78`). Building one counter block fixes this.
8. Not checked: what Escape does on the float check, which has no ✕.
