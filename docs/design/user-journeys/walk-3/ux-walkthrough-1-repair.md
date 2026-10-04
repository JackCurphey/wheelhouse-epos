# UX walk-through 1, third walk: a repair, start to finish (clickable mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup (`generator/mockup/`, built into `generator/out-mockup/`). I followed story 1's 27 steps in `mockup/stories.mjs` through the drawings the mockup actually shows and the targets `controls.mjs` `resolve()` gives each button, at the story's size (phone, Maya) and then at desktop and tablet. A throwaway script in the session scratchpad listed, for each step and size, the screen's text and every control with where it goes. I didn't see the mockup rendered. The second walk is `../walk-2/ux-walkthrough-1-repair.md`; its findings that Jack has answered or that are still open as raised are not raised again (listed at the end).

## The story, as the mockup clicks it

1. Maya Patel, on her phone: `wb-home` › Book a repair › `bk-service` › `bk-bike` › `bk-when` (Thu 17 Sep, arrive 11:30) › `bk-details` › Send booking request › `bk-request`.
2. Jo Taylor, at the front-desk desktop: `diary` › Waiting for you › `waiting-open` › Open › `request-new` › Accept › `diary`. On the morning, `op-today` › Book in › `job-book-in`.
3. Alex Morgan, tablet or shared desktop: adds the worn pads (`dq-job-quote`) › Send quote › `dq-job-sent`.
4. Maya: `dq-quote` › Approve £111.00 › `dq-answered`.
5. Alex: `job-mechanic` › the checklist › `job-checklist` › Mark ready for collection › `job-finished`.
6. Maya: `cp-summary` › Pay £111.00 now › `cp-pay` › Pay £111.00 › `cp-paid`.
7. Jo: `cp-ready-paid` › Hand over › `cp-collected`.
8. Maya: the receipt email `cp-receipt-email` › See it in your account › `cust-signin` › Email me a code › `cust-code` › `ac-account`.

## Clicks and screens, per person (from the mockup's wiring)

| Person | Clicks the story presses | Different screens | Notes |
|---|---|---|---|
| Maya (phone) | 10, plus choosing the time, typing 3 fields and the code | 15 | Same at desktop and tablet; every customer step's button leads on at all three sizes |
| Jo (desktop) | 5 (Waiting for you, Open, Accept, Book in, Hand over) | 6 | The story file brackets Waiting for you and Open; they are real clicks |
| Alex (tablet, shared desktop) | 3 named (Send quote, the checklist, Mark ready), plus the Needed/Optional choices and 8 ticks | 5 | Adding the pads can't be clicked (M1). On a phone Mark ready is one tap further (listed in `mockup-gaps.md`) |

## High

None.

## Medium

**M1 — Adding the worn pads, the step that makes the quote, leads to "Not drawn yet".**
- *Screens:* `job-book-in` (desktop, tablet, phone), `dq-job-quote`, `dq-job-sent`, `job-mechanic`.
- *What happens:* the story's step 11 is "(Alex opens WH-1042 and adds the worn pads)". On every job page the only way to add a line is "Add item", and in the mockup it says "Not drawn yet: The job's Add item search: the shop's services and products". "Scan barcode" stays on the page. So the mockup jumps from a job with only the £65.00 service to a quote with three new lines, and nothing shows how Alex found "Shimano brake pads · B05S-RX" or "Fit & adjust brakes".
- *Why it matters:* this is Alex's main job on the tablet. Without a drawing or a line, the build has nothing to say how a mechanic searches for a part, whether held or out-of-stock parts show, or how many taps it takes.
- *Fix:* already in `mockup-gaps.md` for Jack to decide (draw it, make it a line, or leave it for the build). This walk adds only that it sits on story 1's main path, not on a side branch.
- *Decision it touches:* Receiving stock, later change 3 Oct (walk-through 3 M7: a part with no free stock goes on "For customers" by itself), which assumes this search exists.
- *Second check:* CONFIRMED. All three sizes resolve "Add item" to `notdrawn` on `job-book-in`, `dq-job-quote`, `dq-job-sent`, `job-mechanic`, `job-finished`, `cp-ready-paid` and `cp-collected`. (On `rs-job-arrived` the same label stays on the page instead, so the wiring isn't even consistent.) No decision draws it. Walk-2 didn't raise it. Kept as Medium because a screen the story needs is missing.

**M2 — "See it in your account" on the receipt lands on an account that says the bike is still in the shop, with only the £65.00 service.**
- *Screens:* `cp-receipt-email` → `cust-signin` → `cust-code` → `ac-account` → `dq-in-shop` (phone, also desktop and tablet).
- *What happens:* Maya has just paid £111.00 and collected the bike. She taps "See it in your account" on the receipt, gets a code by email, types it, and lands on `ac-account`. It reads "In the shop now · WH-1042", and under Now: "WH-1042 · … Booked in Thu 17 Sep · expected ready Thu 17 Sep · In the shop ›". Tapping that row opens `dq-in-shop`: "We've got your bike … Work agreed: Standard service £65.00 · Total £65.00". The receipt she came to see isn't in the list. The Earlier rows are bracketed placeholders, and the WH-1042 receipt (`ac-receipt`, which is drawn with £111.00) is reached only from a placeholder purchase row.
- *Why it matters:* the link promised her receipt. Instead she is told her bike is still in the shop, at £65.00. Someone who rarely uses a phone could think the payment didn't go through.
- *Fix:* a real choice; see Questions for Jack, 1.
- *Decision it touches:* Leftover screens 1 (one receipt email with "See it in your account"); Account 1 (one history, past jobs with receipts). Neither says where the link lands.
- *Second check:* CONFIRMED. `ac-account`'s situations (`bk-bookings`, `ac-account-lower`, `ac-account-repairs`, `ac-account-new`, the Cycle to Work ones, the question and data ones) include none for a repair just collected. `ac-account-repairs` shows the same "In the shop" row. Walk-2 didn't raise it: the second walk saw this link as unwired (M1), not where it now goes.

**M3 — Diary blocks on the desktop are 10–11px, and eight other Trek blocks are announced as Maya Patel's.**
- *Screens:* `diary`, `waiting-open`, and the diary behind every job page (desktop); `rs-diary-arrived` in story 3.
- *What happens:* on the desktop week view each block's bike is 11px, its service 10px, the hour labels 10px and "No time" 9px. On tablet and phone they are 12px. Separately, besides WH-1042, eight blocks on the desktop week are labelled for screen readers "Trek Domane AL 3, …, Maya Patel, WH-1051 / 1054 / 1056 / 1059 / 1062 / 1071 / 1074 / 1077 …" (`diary.mjs` lines 407–449), and in the mockup each of them opens WH-1042's page.
- *Why it matters:* Jo works at the desktop, often on the phone, and Alex may share it. 10px is below the 12px Jack allowed for labels. A screen-reader user searching the week for Maya hears nine Maya Patels. Someone clicking through opens WH-1042 from a block that says WH-1077.
- *Fix:* for the text size, a real choice; see Questions for Jack, 2. For the names, no choice: give the filler blocks the other example customers the drawings already use (Oliver Chen, Sam Reed, Jamie Brooks, Aisha Khan) or "[Customer]", and send blocks that aren't WH-1042 to "Not drawn yet" in the mockup.
- *Decision it touches:* Owner setup 17 ("Dismissed: text sizes (labels may be 12px)"); Workshop day's Larger text setting.
- *Second check:* CONFIRMED. The sizes come from the built `j12-desktop` data (bike 11px, service and times 10px); `diary.mjs` lines 400–449 give "Maya Patel · Trek Domane AL 3" to ten jobs, nine of them on the desktop week. Owner setup 17 settles 12px labels, not 10px, so this isn't already decided. Walk-2 didn't raise either part.

## Low

**L1 — `cp-paid` says "paid for job WH-1042".** Every other customer page says "Your repair · WH-1042", but the paid page's heading is "Paid — thank you, Maya" and its line is "£111.00 paid for job WH-1042". *Fix, no choice:* "£111.00 paid for your repair · WH-1042". *Touches:* second-walk answer 13 ("Your repair · WH-1042" everywhere). *Second check:* CONFIRMED at all three sizes; answer 13 settles the wording, so this applies it rather than reopening it.

**L2 — In story mode the mockup only guides the first step, and never changes who you are.** `page.html` shows "Next: …" for step 1 only. After that the hand-overs ("The request reaches the diary", "Maya brings the bike in", "Maya gets the quote by text") have no button and no hint, so someone clicking has to know to jump from `bk-request` to the diary. The Person box stays on "Customer" for the whole story, and the sidebar's Today always opens `op-today`, the Manager view with Tills and Needs attention, though Jo is Staff and `op-today-staff` is drawn. *Fix, no choice:* in story mode, show the current step's "does" line with a "Next step" button, and set Person from each step's `who`. Give Today the same role-based target "Open menu" already uses. *Second check:* CONFIRMED in `page.html` (the story handler only reads `steps[0]`; `pick()` runs only when Person changes) and `links/shared.mjs` (`Today: go('op-today')`). This is the mockup, not the drawings, so no decision is touched.

## Second-walk findings seen again, not raised again

- Walk-2 L6: the only drawn request is still Sam Reed's. Jo opens Sam's request to accept Maya's.
- Walk-2 M2: opening WH-1042 from the diary still shows "Job · expected" with Book in, and its block still reads "approved £111" (left over in the 3 Oct fresh review).
- Walk-2 H1 (shared computer) is now story 8's.
- Mark ready on a phone is one tap further than on a tablet. Listed in `mockup-gaps.md` (story 1, step 17).
- Edge cases 1a and 1c are now lines (second-walk decisions, edge-case lines), so they can't be clicked.

## Persona checks

- **Maya:** no app, no password; every step's button leads on at all three sizes. The one surprise is M2. Fewest taps: 10 plus the code.
- **Jo:** Waiting for you, Open, Accept: 3 clicks to accept a request; Book in from Today is 1. The text size in the desktop diary is M3.
- **Alex:** on a tablet the checklist's Mark ready leads on; on a phone it is one tap further (listed). Adding a part can't be clicked (M1).
- **Screen reader:** M3 (nine Maya Patels). Quote and ready Undo still run on timers, covered by "Don't close things by themselves".
- **Low vision:** M3. 12px labels on phone job pages ("Ask before any extra work", "Approved £111.00") are within the 12px Jack allowed (Owner setup 17).

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | job pages | Adding the pads is "Not drawn yet" | Already in `mockup-gaps.md` |
| M2 | receipt email → account | The receipt link lands on "bike in the shop, £65.00" | Yes (question 1) |
| M3 | desktop diary | 10–11px block text; eight other blocks announced as Maya Patel | Yes, the text size (question 2) |
| L1 | cp-paid | "paid for job WH-1042" | No |
| L2 | mockup story mode | Guides step 1 only; Person never changes; Today always the Manager view | No |

Counts: 0 High, 3 Medium, 2 Low.

## Verification

- **Walked:** all 27 steps of story 1 at phone, desktop and tablet, with every control's resolved target (scratchpad script using `drawings.mjs`, `controls.mjs`, `stories.mjs`). I also opened `waiting-open`, `job-overview`, `job-quote`, `job-collection`, `op-today-staff`, `ac-account-repairs`, `dq-in-shop`, `ac-receipt` and `cp-summary-paid`.
- **Read:** the script, the personas, walk-2 report 1, the second-walk decisions, `mockup-gaps.md`, `page.html`, `links/shared.mjs`; decisions Account 1–2 (and preamble), Leftover screens 1–3, Owner setup 16–17, the 2 Oct walk-through decisions.
- **Not checked:** anything rendered (layout, colour, zoom); a real screen reader or keyboard; the situation lines that are text only (the mockup shows only drawn situations).

## Second check

I re-read each finding against its drawing at all three sizes and against the decisions, on 3 Oct. Kept: 5. Dropped: 4.
1. Text at 12px on phone job pages: settled by Owner setup 17.
2. The shared-computer sign-in: walk-2 H1 and story 8.
3. "Customers sign in with an emailed code, not a link": Account preamble (Signing in B5, B9).
4. Receipt numbers "B1-[0000]" on an online payment: bracketed placeholders by Leftover screens' example-data rule, so nothing is wrong yet.

## Questions for Jack

1. **Where "See it in your account" on the receipt email takes Maya (M2).**
   1. **After the code, open that receipt, with the account behind it.** She sees what she tapped for, with no extra tap. It costs one rule: a sign-in link can carry the page it came from.
   2. **The account, drawn after collection.** WH-1042 moves to Earlier as "collected · receipt £111.00 ›". She taps once more to see the receipt. It costs one line under `ac-account`.
   3. **Make the link open the receipt with no sign-in, as the text receipt's link already does** (Leftover screens 2). That's the fewest taps, but it changes the email's decided wording "See it in your account" (Leftover screens 1).

   Recommend 1.
2. **The desktop diary's 10–11px block text (M3).**
   1. **Raise block text to at least 12px.** It matches the floor you accepted for labels. Short blocks show the bike only, and the service moves into the hover summary and the quick look.
   2. **Leave it, and rely on Larger text in Your settings.** Nothing changes, but everyone who hasn't found the setting reads 10px.
   3. **Taller hour rows, so the blocks fit 12px text with both lines.** Easier to read, but fewer hours fit without scrolling.

   Recommend 1.
