# One canvas, one drawing per real screen (issue #116 step 3)

Jack, 3 Oct 2026: "start step 3". Source: issue #116 step 3, the six rules in
`docs/design/user-journeys/README.md` (step 2), and the seven
`consolidation-*.md` reports (step 1).

## Intent

Today the drawings are 823 screens over three canvases (staff shop floor,
back office, customers), each near the 512-file limit. Step 3 puts the whole
product on **one canvas** at the shop floor link people already have
(https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j), with **one board per real
screen** and the other situations written as a list under it. Nothing is
redrawn: every board shown is an existing drawing. No decision changes.

## Approach

1. **A plan for every screen id.** A new folder `generator/consolidate/` holds
   one file per journey. Each screen id in `journeys.mjs` gets exactly one
   entry:
   - `keep`: it stays a board. It names its building block (README list) and
     the sizes shown (desktop by default; rule 3's exceptions add more).
   - `into: <id>`: it becomes a line in that kept screen's situation list,
     possibly in another journey (rule 5). Optional `decision` reference.
   - `later: <reason>`: deferred by the 3 Oct answers, or held back by the
     build plan. Listed in a "Later" note on its journey, not drawn.
   The splits come from the step 1 merge tables. Where a report's merge would
   go against a recorded decision (it says so), the screen is **kept**, and
   the decision log below says which.
2. **A check that fails until the plan is whole**
   (`generator/consolidate/check.test.mjs`, run with `node --test`): every id
   in `journeys.mjs` has exactly one entry; every `into` points at a kept id;
   every kept screen names a block from the README list; no more than 450
   boards.
3. **`build.mjs` writes one canvas.** One part instead of three. For each
   journey, its rows of kept boards; under each board a note with its
   situation list (situation = the old drawing's title from `journeys.mjs`,
   who sees it, decision); a "Later" note per journey. Links to a merged
   screen are pointed at the board it merged into, so they stay live. Prev and
   Next follow the kept boards.
4. **Publish** to the shop floor link, removing the boards the new build no
   longer makes (they stay in git and on each journey's own canvas). Add a
   "Moved — see [link]" note at the top of the back-office and customers
   canvases; their boards are left as they are. Jack is asked once before
   publishing.
5. **The step 3 fixes:** the README's Fjell/Work Sans paragraph; the
   `/Users/jackcurphey` paths in `fitcheck*.mjs`, `shoot*.mjs`, `text.mjs`,
   `tools/shoot.mjs`; a fitcheck that renders every board on the new canvas.

## Done when

- `node --test docs/design/user-journeys/generator/consolidate/` passes, and
  was seen failing first.
- `node build.mjs` writes one canvas of at most 450 boards, with no link
  pointing at a board that isn't on it.
- The new fitcheck runs on every board and passes, from a path other than
  Jack's Mac's.
- The canvas is published at the shop floor link and the two other canvases
  carry the "Moved" note.

## Decision log

Kept in this file as the work goes.

- Situation lists are canvas notes (plain text), not extra boards: the
  canvas only has text notes (`build.mjs:297, 344`), and boards cost files.
- Deferred screens are listed, not drawn, so nothing decided is lost.
- Journey 21 (Lightspeed, after the trading week) is consolidated like the
  rest and stays on the canvas.
- The plan files were written per journey group by subagents from the step 1
  reports (each file says which). Cross-journey lines point only at a fixed
  list of owner screens (job page, diary, Today, till page, customer page,
  the Settings pages, Reports home, account, booking, website home and
  product page, activity log), so the groups agree.
- Two merges the reports suggested were not made, because they go against a
  recorded decision: `site-ocean` stays a board (App map 3) and `ready` stays
  a board (Collect 6).
- Repointed after the groups finished, to screens that turned out to be kept:
  `dq-job-withdraw` → staff job page (it is a staff action, not the
  customer's cancel); the old pictures `customer-message` → `cp-summary` and
  `preferences` → `ac-contact`; `rs-overview-arrived` → `overview`;
  `ac-privacy-requests` → `cs-privacy`; `ws-shopify-order` → `on-orders`;
  `cs-search-c2w` → `till-search`; `ms-book-shop*` → `bk-service`;
  `ms-till-setup` → `till-setup`.
- Rule 3's extra sizes: diary, Day view and the job page at desktop, tablet
  and phone; the till page at desktop and phone.
- Result of the first build: 823 screens → 198 kept (205 boards with the
  extra sizes), 562 situation lines, 63 later; 207 files with the overview and
  the workflow chart; 304 notes.
- The 1–2 new screens the back-office report says the fixed website needs
  (editing text and photos) are not drawn: drawing new screens is outside
  step 3 and changes the design, which is Jack's to approve.
