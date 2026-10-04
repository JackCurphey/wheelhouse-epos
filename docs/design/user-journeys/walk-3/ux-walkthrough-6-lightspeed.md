# Walk-through 6, third walk: a repair at a Lightspeed shop (clicked on the mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup in `generator/out-mockup/` (published at https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi). I followed story 6's steps in `generator/mockup/stories.mjs` through the drawing the mockup shows and the real target of every button: Maya at phone size first, Jo and Alex at desktop, and then each step again at the other two sizes. A scratchpad script listed each step's text and controls; nothing was saved to the repo. The second walk is `../walk-2/ux-walkthrough-6-lightspeed.md`. Journey 21 comes after the trading week (build-plan question 5; Lightspeed shops, 3 Oct later change), so nothing here changes Release 2's build order.

## The story, as the mockup clicks it

1. Maya (phone) books from `wb-home` through `bk-service`, `bk-bike`, `bk-when` and `bk-details` to `bk-request`.
2. Jo accepts the request (`diary`, then `request-new` › "Accept"). Maya's booking page is `bk-page-ls`.
3. Jo books the bike in from Today (`op-today` › "Book in" › `job-book-in`).
4. Alex adds the pads from Lightspeed's products (`ls-part-search` › "Send quote" › `dq-job-sent`).
5. Maya approves on `dq-quote-ls` › `dq-answered`.
6. Alex opens WH-1042 (`ls-job-sent`), works the checklist (`job-checklist`), and presses "Mark ready for collection" › `job-finished`.
7. Maya's ready page is `cp-summary-ls`. Jo sees `ls-job-unpaid`, Maya pays at the Lightspeed till, and Jo presses "Hand over" on `ls-job-paid`.

## Clicks and screens per person

Counted from the story's named buttons. Typing and form choices aren't counted.

| Person | Clicks | Different screens |
|---|---|---|
| Maya (phone) | 6 | 10 |
| Jo (desktop) | 3, plus the Lightspeed till | 6 |
| Alex (desktop and tablet) | 3, plus the checklist ticks | 5 |

Every step is drawn at all three sizes. At phone size, "Send quote" (step 13) and "Mark ready for collection" from the checklist (step 18) aren't on the drawing. Both are already listed for Jack in `mockup-gaps.md`.

## High

None found.

## Medium

**M1 — Mark ready from the checklist leaves the Lightspeed job and offers Wheelhouse's own till.**
- *Screens:* `ls-job-sent` › `job-checklist` › `job-finished` (desktop, tablet). The checklist's "Close" and "Done" go to `job-mechanic` (all sizes).
- *What happens:* Alex opens the checklist from the Lightspeed job page and presses "Mark ready for collection". The mockup opens `job-finished`, the page for a normal shop. It has no Lightspeed strip, and its header tag reads "Approved £111.00" where the Lightspeed pages read "Agreed £111.00". Its main button is "Take payment · Opens the till with this job's lines". The checklist's "Close, back to the job" and "Done" also leave the Lightspeed page: they go to `job-mechanic`, a normal shop's job. The drawn Lightspeed route is one press: "Mark ready for collection" on `ls-job-sent` goes to `ls-job-unpaid` ("Waiting to be paid in Lightspeed").
- *Why it matters:* at a Lightspeed shop, Maya pays at the Lightspeed till ("Pay when you collect · Agreed price £111.00 — pay at the till" on `cp-summary-ls`). Jo is offered Wheelhouse's till on the same job, so the job could be charged in both systems. "Approved" and "Agreed" also swap back and forth between screens.
- *Fix, no choice:* the story presses "Mark ready for collection" on `ls-job-sent`, which is drawn, one press, and goes to `ls-job-unpaid`. The checklist's "Close" and "Done" go back to the screen before. The canvas already has the line "At a Lightspeed shop: the Lightspeed strip under the header, Hand over in place of Take payment, and the header tag reads Agreed" on `job-overview`, so no drawing changes.
- *Decision it touches:* Lightspeed shops 10. Walk-2 L5 (that line) was taken. Not reopened.

**Second check:** CONFIRMED. I re-read `job-checklist`: "Mark ready for collection → job-finished", and "Close, back to the job" and "Done → job-mechanic". On `job-finished` the tag is "Approved £111.00" and the button is "Take payment". `ls-job-sent`'s "Mark ready for collection" goes to `ls-job-unpaid`. The `job-overview` line is in `canvas.json`. Walk-2 couldn't click, so it didn't see this.

**M2 — In the mockup, the Lightspeed pages are islands: shared pages always show a normal shop.**
- *Screens:* `diary`, `op-today`, `job-book-in`, `dq-job-sent`, `ls-job-paid`, plus `ls-today` and `ls-book-in` (all sizes).
- *What happens:*
  - **Nothing leads to `ls-today` or `ls-book-in`.** That is the drawn Today for a Lightspeed shop, and the drawn book-in where Jo picks "Which Maya Patel in Lightspeed?" with Maya at the desk. The story books in from the normal `op-today`, which shows "Tills Till B1 · float checked by Jo Taylor" at a shop whose till is Lightspeed's.
  - **Alex can't reach Lightspeed's products from the booked-in job.** On `job-book-in`, "Add item" says "Not drawn yet: The job's Add item search". Only the `ls-*` job pages lead to `ls-part-search`, and nothing leads to those before approval. The story gets past it with a bracketed step.
  - **"See what Maya sees" on `dq-job-sent` opens the normal shop's `dq-quote`, not `dq-quote-ls`.**
  - **Every diary card for WH-1042 opens `job-overview` ("Expected"),** never `ls-job-sent`. Walk-2 M1 asked for "Job cards on Lightspeed boards open `ls-job-sent`". The mockup didn't do it.
  - **"Hand over" on `ls-job-paid` ends on `cp-collected`, a normal shop's page.** It reads "Approved £111.00", and its Undo goes to `cp-ready-paid`, a repair paid online.
- *Why it matters:* clicking the story shows Jo and Alex a mix of the two kinds of shop. The two moments Lightspeed shops 6 and 10 were built around, linking Maya at book in and reading Lightspeed's products, can't be clicked to.
- *Fix:* a real choice; see Question 1.
- *Decision it touches:* Lightspeed shops 3, 6, 10. Walk-2 M1 was "Fix, no choice", left to the mockup. Build-plan question 5 (after the trading week).

**Second check:** CONFIRMED. I searched every data file for buttons leading to `ls-today` and `ls-book-in` and found none. `ls-job-sent` is reached only from other `ls-*` boxes (`ls-job-price-changed`, `ls-customer-pick`, `ls-job-check`). The `job-book-in` "Add item" target is the not-drawn note. `dq-job-sent` "See what Maya sees → dq-quote". `ls-job-paid` "Hand over → cp-collected", and on `cp-collected` "Undo → cp-ready-paid". The website pages still showing "Basket" was raised by walk-2 (L4), so it isn't counted here.

## Low

None kept.

## Dropped at the second check

- **"Approved £65.00" on the book-in page before any quote** (`job-book-in`). That is the booked service, which Maya agreed to when she booked (Book a repair; the word list's "Work the customer said yes to"). It is right, not a finding.
- **The request Jo accepts is Sam Reed's, not Maya's** (`request-new`). Walk-2 raised this in walk-through 1 L6, and it was settled there.
- **Website pages show "Shop" and "Basket, 0 items"** at a Lightspeed shop. This is walk-2 L4, done as a line on `ja-site`.
- **Status tags on the job page are 12px at phone size** ("Agreed £111.00", "Waiting to be paid in Lightspeed", "Paid in Lightspeed"). This is the same rule as walk-2 story 5 L3 (status text at least 14px), which is still open. Not raised again.
- **Phone: no "Send quote" on the parts sheet, and no "Mark ready" on the checklist sheet.** Both are already in `mockup-gaps.md`.

## Walk-2 findings, checked in the mockup

| Walk-2 | In the mockup |
|---|---|
| M1 no links across the joins | Mostly fixed: Maya's pages, Today, Book in, the quote and the hand-over click through. Not done: job cards opening the Lightspeed job (M2) |
| M2 ready with no work order, three causes | Lines; not on this story's path |
| M3 "rung up by hand" | Answered (option 1); not on this story's path |
| M4 marked as after the trading week | Answered by Jack: tags on the lines; not visible in the mockup, which shows no lines |
| M5 tablet and phone | Fixed: every `ls-*` board on the path is drawn at all three sizes |
| L1–L7 | Lines; not checked by clicking |

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | ls-job-sent › job-checklist › job-finished | Mark ready via the checklist leaves Lightspeed and offers Take payment | No |
| M2 | ls-today, ls-book-in, job-book-in, dq-job-sent, diary, ls-job-paid | Lightspeed pages can't be reached from shared pages; shared pages show a normal shop | Yes (Q1) |

## Verification

- **Walked:** all 22 steps of story 6 at phone, tablet and desktop in `generator/out-mockup/` (`data/j01`, `j03`, `j04`, `j05`, `j10`, `j12`, `j21`), reading every control's target. I also read `ls-today`, `ls-book-in`, `cp-collected`, `job-mechanic`, `waiting-open` and `ls-hand-over-unpaid`, and searched every data file for what leads to `ls-today`, `ls-book-in`, `ls-job-sent`, `dq-quote-ls` and `cp-summary-ls`.
- **Checks run:** `node --test docs/design/user-journeys/generator/mockup/` passes 4 of 4. It checks that each named button leads to the next step; it doesn't check that the next step is the Lightspeed version.
- **Decisions read:** Lightspeed shops (with its 3 Oct later change), build-plan question 5, the second walk's smaller questions (answer 7: Lightspeed edge cases wait), `mockup-gaps.md`, and the `job-overview` situation lines.
- **Not checked:** Lightspeed's real behaviour (no test account), the page rendered in a browser, a screen reader, focus, and zoom.

## Questions for Jack

1. **How should the mockup show a Lightspeed shop (M2)?**
   1. Re-route story 6 only: book in through `ls-book-in`, open the job as `ls-job-sent`, and Mark ready there. The other shared pages stay as a normal shop until Lightspeed is built after the trading week. *Good for:* the story clicks the Lightspeed way, with a few changed steps and links and no new drawings. *Costs:* someone clicking freely from the diary still lands on normal-shop pages.
   2. Add "Lightspeed shop" to the mockup's shop switcher, beside Bolton and [Second site], so shared pages (Today, the diary's cards, the job page, Add item, "See what Maya sees") pick their Lightspeed version wherever one is drawn. *Good for:* the whole mockup behaves like a Lightspeed shop when asked. *Costs:* more wiring now, for a journey that isn't built until after the trading week.
   3. Leave it until Lightspeed is built. *Good for:* no work now, which matches question 5. *Costs:* the published mockup keeps mixing the two kinds of shop in this story.

   Recommend 1.
