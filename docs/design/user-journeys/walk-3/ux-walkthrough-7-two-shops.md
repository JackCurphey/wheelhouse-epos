# Walk-through 7, third walk: an owner with two shops (clicked on the mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup in `generator/out-mockup/` (published at https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi). I followed story 7's 31 steps (`generator/mockup/stories.mjs`) through the drawing shown and every button's real target. Jack and Jo were walked at desktop, then every step again at tablet and phone. A scratchpad script listed the text and controls; nothing was saved to the repo. The second walk is `../walk-2/ux-walkthrough-7-two-shops.md`. Its findings, and Jack's answers to them, aren't raised again.

## The story, as the mockup clicks it

1. Jack Lewis (Owner) picks Bolton at sign-in (`auth-site`) and goes Today › Settings › Office › Sites › "+ Add a shop" › "Add the shop". He lands on `ms-today-new`, the new shop's checklist.
2. From the checklist, "Send from Bolton" › `tr-send` › "Send" › `tr-sites`.
3. Settings › Office › Staff and roles › "Open" (Jo) › `set-staff-person`. Then the shop menu › All shops › "Bolton tills" › "Move to [Second site]…" › "Move Till B3 to [Second site]".
4. Jo (Staff) books Maya's service into [Second site]'s workshop (`ms-job-other-shop` › "Send request to [Second site]"). It is accepted there (`ms-request-from-shop`), and Bolton sees the answer (`ms-request-answered`).
5. Jack goes shop menu › All shops › Reports › Sales, Workshop, Margin and Activity log, returning to All reports between each.

## Clicks and screens per person

Counted from the story's named buttons.

| Person | Clicks | Different screens |
|---|---|---|
| Jack Lewis (desktop) | 26 | 20 |
| Jo Taylor and the person at [Second site] | 2 | 3 |

At phone size, seven of Jack's steps can't be clicked: Settings and Reports aren't in the phone menu, the phone Settings page has no Office tab, and People has no Open. At tablet size, the person page has no shop menu. All eight are already listed for Jack in `mockup-gaps.md`, so they aren't raised again. Every step is drawn at all three sizes.

## High

None found.

## Medium

**M1 — "Choose who works there" can't be done by clicking.**
- *Screens:* `ms-today-new` › `set-staff` › `set-staff-person`; `ms-person` (desktop, tablet).
- *What happens:* the checklist's step reads "Choose who works there · On each person in Staff and roles". Its button "Open Staff and roles at [Second site]" opens `set-staff`, where only Jo's row has "Open". Jo's page (`set-staff-person`) has Role, "Also allowed to", "Works in the workshop" and "Till PIN", but no "Works at" shop ticks. The drawing that has them, `ms-person` ("A person: where they work, and workshop days at each shop"), is in the mockup, but no button anywhere leads to it. The story then leaves Jo's page by the shop menu, and nobody has been given [Second site].
- *Why it matters:* this is the step that lets anyone work at the new shop. On the clicked path, Jack never finds the tick.
- *Fix, no choice:* in a business with two shops, "Open" on a person goes to `ms-person`, the person page with "Works at", which is drawn. The story's step uses it.
- *Decision it touches:* Multiple sites 4 ("Works at" on each person's page) and 9. Not reopened.

**Second check:** CONFIRMED. I re-read `set-staff-person` at all sizes: no "Works at". I searched every data file for a button leading to `ms-person` and found none. `set-staff`'s text has a single "Open" after Jo's row. The canvas line for `ms-person` reads "'Works at' shop ticks; 'In the workshop on' days for each shop". Multiple sites 4 says Works at is on each person's page.

**M2 — The checklist's last step, "Show [Second site] to customers", goes to a page where it can't be done.**
- *Screens:* `ms-today-new` › `ms-sites` (all sizes).
- *What happens:* the button opens Settings › Shop and sites (`ms-sites`). That page lists both shops with "Edit". "Edit [Second site]" says "Not drawn yet: [Second site]'s own shop details". Nothing on the page shows or hides the shop.
- *Why it matters:* the add-a-shop box promises "Customers don't see it until you choose to", and the checklist says "Until then customers don't see it". The one button meant to do that leads to a dead end.
- *Fix:* a real choice; see Question 1.
- *Decision it touches:* the first walk's M3 (a new shop stays hidden until "Show [Second site] to customers"), taken. It doesn't say what the press does.

**Second check:** CONFIRMED. `links/j19.mjs` maps "Show [Second site] to customers" to `ms-sites`. On `ms-sites`, "Edit [Second site]" is the not-drawn note. `2026-10-02-ux-walkthrough.md` (walk-through 7 section) records only that the shop stays hidden until that button. No later change settles it.

**M3 — The mockup forgets who and where Jack is as he clicks.**
- *Screens:* `set-shop-details`, `set-staff`, `set-staff-person` (Manager drawings); `ms-today-new`, `tr-sites` › Today (all sizes).
- *What happens:*
  - **Jack sees manager pages as the owner.** After adding the shop, Settings › Office opens `set-shop-details` (drawn as Manager), which lists "Sites Bolton" only, although `ms-sites` one step earlier listed "Bolton, [Second site]". People (`set-staff`) reads "[Manager] · you" and "Only the owner can add or remove people", said to the owner. The person bar says Owner, but it only picks the owner's version when it is changed, not on each click.
  - **The new shop is lost.** After "Send" Jack is on the product page. The sidebar's "Today" opens Bolton's `op-today`, not [Second site]'s checklist, although the checklist page said "You're now looking at it". The rest of the checklist is out of reach.
- *Why it matters:* Jack reads that he is a manager, that his second shop isn't there, and that he can't add people. The checklist he was working through disappears after one step.
- *Fix, no choice:* the mockup applies the chosen person and shop to every page it opens, as it already does when they're changed in the bar. This is a change to `page.html`; no drawing changes. Owner pages (`ms-sites`, `set-staff-invited`) and [Second site] pages (`ms-today-new`) then come up on their own.
- *Decision it touches:* none. The mockup spec says person and shop "pick the screen's situation for that person or shop where one exists".

**Second check:** CONFIRMED. I re-read `page.html`: `pick()` runs only when the Person or Shop list changes; `show()` doesn't call it. `set-shop-details`, `set-staff` and `set-staff-person` are role Manager. `set-shop-details` reads "Sites Bolton". `set-staff` reads "[Manager] · you". On `ms-today-new`, `tr-send` and `tr-sites`, "Today → op-today". The spec line is in `2026-10-03-clickable-mockup.md`, under "What Mark asked for".

## Low

**L1 — The shop menu does nothing on [Second site]'s Today and on All shops.**
- *Screens:* `ms-today-new`, `ms-today-all` (desktop).
- *What happens:* "Shop: [Second site]. Choose a shop" and "Shop: All shops. Choose a shop" stay where they are. Only "Shop: Bolton. Choose a shop" opens the menu. From All shops Jack can still use "Work in Bolton". From the new shop's Today there's no way back to Bolton except the sidebar.
- *Fix, no choice:* both labels open the shop menu (`ms-switch-open`), like Bolton's.
- *Decision it touches:* Multiple sites 9 (the switcher).

**Second check:** CONFIRMED. Both are "→ stay" on desktop. The shared map has only the Bolton label. Tablet has no shop menu at all, which is already in `mockup-gaps.md`.

**L2 — "Book in" on Today goes to two different places.**
- *Screens:* `op-today`, `ms-switch-open` (desktop, tablet).
- *What happens:* on Bolton's Today, "Book in" beside WH-1042 opens the job's book-in (`job-book-in`). On the same Today, drawn behind the open shop menu, the same button opens the till's book-in (`till-book-in`).
- *Fix, no choice:* both open `job-book-in`, as Today does everywhere else.
- *Decision it touches:* none.

**Second check:** CONFIRMED. `links/j19.mjs` sends "Book in" to `till-book-in` on every journey 19 board. `op-today`'s goes to `job-book-in`.

**L3 — "Move Till B3" returns to a list where nothing moved.**
- *Screens:* `ms-till-move` › `ms-tills` (desktop, tablet).
- *What happens:* after "Move Till B3 to [Second site]" the list still shows "Bolton 3 tills … Till B3" and "[Second site] [n] tills" with Till [code]1 and [code]2. The move box itself says "It becomes Till [code]3. Old receipts keep B3."
- *Fix, no choice:* a line on `ms-tills`: "After a move: Till [code]3 under [Second site], 'Was B3', Bolton 2 tills".
- *Decision it touches:* the first walk's M2 (`ms-till-move`), taken.

**Second check:** CONFIRMED. `ms-till-move` "Move Till B3 to [Second site] → ms-tills". `ms-tills`' text is unchanged, and it has no situation lines on the canvas.

## Dropped at the second check

- **Settings always opens on Front desk › Till,** so Office takes a second click. Settings being one page per room is decided (Owner setup, later change 30 Sep, Receiving stock 7), so this isn't raised.
- **The Reports overview strip.** It is drawn now ("[period] Takings £[£] Margin £[£] · [%]" on `rp-home`), and its takings basis was answered (Reports and accounts, 3 Oct later change, walk-through 11 H2).
- **Margin and Discounts by shop.** Walk-2 M1, done as lines on `rp-margin` ("Margin and stock value for all shops: a shop column").
- **The phone and tablet gaps.** Eight steps, already in `mockup-gaps.md`.

## Walk-2 findings, checked in the mockup

| Walk-2 | In the mockup |
|---|---|
| H1 overview strip | Drawn on `rp-home` |
| M1 margin and discounts by shop | Lines |
| M2 put-off extras still drawn | Not re-checked on these boards |
| M3 joins not clickable | Fixed for every named step; L1 and M1 are what's left |
| M4 Staff board offers All shops | `auth-site` is now drawn for the Owner |
| M5 other shop's line on Today | Drawn on `ms-switch-open` ("[Second site] · 3 things need attention"); `op-today`'s lines not re-checked |
| L1–L4 | Lines; not checked by clicking |

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | ms-today-new › set-staff › set-staff-person; ms-person | "Works at" can't be reached by clicking | No |
| M2 | ms-today-new › ms-sites | "Show [Second site] to customers" dead-ends | Yes (Q1) |
| M3 | Settings pages, Today | Person and shop not kept as Jack clicks | No |
| L1 | ms-today-new, ms-today-all | Shop menu does nothing there | No |
| L2 | op-today, ms-switch-open | "Book in" goes two ways | No |
| L3 | ms-till-move › ms-tills | The moved till doesn't move | No |

## Verification

- **Walked:** all 31 steps at desktop, tablet and phone in `generator/out-mockup/` (`data/jb`, `j08`, `j10`, `j12`, `j14`, `j17`, `j19`, `j20`). I read each step's text and every control's target, searched every data file for links into `ms-person`, and read `page.html`'s `show()` and `pick()`, `links/j19.mjs`, and the canvas lines for `set-staff` and `set-staff-person`.
- **Checks run:** `node --test docs/design/user-journeys/generator/mockup/` passes 4 of 4. It shows each named button leads on. It can't show a step that the story skips, like "Works at".
- **Decisions read:** Multiple sites and Reports and accounts with their 3 Oct later changes; the walk-through decisions' walk-through 7 section; Owner setup's 30 Sep later change; the clickable-mockup spec; `mockup-gaps.md`.
- **Not checked:** the rendered page, a screen reader, focus, zoom, and whether figures agree (all placeholders).

## Questions for Jack

1. **What does "Show [Second site] to customers" do when pressed (M2)?**
   1. One press: the shop shows on the website, in booking and for collecting, straight away. The checklist step ticks, with "Undo" for a moment, like "Hold longer". *Good for:* fewest clicks, and Undo covers a slip. *Costs:* no moment to read what customers will see before it goes live.
   2. A box that says where it will show (website, booking, collecting online orders), with "Show it" and "Not yet". *Good for:* Jack sees exactly what changes before customers do. *Costs:* one more click, and one small box to draw.
   3. It opens the shop's own settings with a "Show to customers" switch (`Edit [Second site]`, not drawn yet). *Good for:* it lives with the shop's other settings, where it can also be turned off later. *Costs:* the most clicks, and a page to draw.

   Recommend 1.
