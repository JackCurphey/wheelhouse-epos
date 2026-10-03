# User journeys canvas — source

The **Wheelhouse user journeys** canvas
(https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j) shows the whole product
on one canvas: one board per real screen, its other situations listed under
it, by journey, with a workflow chart (issue #116 step 3, 3 Oct 2026). Every
drawing at every size stays on each journey's own canvas, linked from each
board. The old back-office (https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4)
and customers (https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh) canvases
are kept with a "Moved" note. It is generated from the files here and
published with Claude Code's Artifact tool. Started 27 Sep 2026.

| Folder | What |
| --- | --- |
| `generator/` | The canvas generator |
| `themes/` | The five theme options (https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN); Jack chose Fjell, then Soft sand (28 Sep) |
| `design-system/` | The files of the Wheelhouse design system (https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH) |

## Generator files

- `journeys.mjs` — the map: every journey, its rows and screens, each with a
  status. `d(id)` = a Release 1 screen design shown as an image; `b(id)` = one
  that is also built; `g(...)` = not designed yet; `o(...)` = only in the old
  app; `r(id, title, role)` = a new drawing (desktop + phone) awaiting Jack's
  review. `sd(id, title, role)` = an agreed Workshop day redesign screen
  (journey 12, decision 69), shown in the Soft sand look at desktop, tablet
  and phone.
- `ui.mjs` — the tokens (`C`) and shadcn-style helpers (button, field,
  card, badge, icon, logo slot). `--theme sand` (or `WH_THEME=sand`) gives
  Soft sand, which every journey's drawings use; without it, the older Fjell.
  **Keep these values in step with `src/styles/theme.css`.**
- `consolidate/` — the one-canvas plan: for every screen id, `keep` (a
  board, with its building block), `into` (a line in a kept screen's
  situation list) or `later` (listed, not drawn). `node --test
  consolidate/` checks it covers every screen.
- `stage1.mjs` — shells (staff app with the room sidebar, till mode, customer
  website), the app map, and the sign-in journey. `ROOMS` is the staff
  navigation: Front desk, Workshop, Stockroom, Office.
- `stage2.mjs` — the first 21 Workshop day drawings (desktop + phone).
  Superseded by the redesign (decision 69) and no longer on the canvas.
- `diary.mjs` / `build-diary.mjs` — the approved Workshop day redesign and
  its own review canvas (`--theme sand` writes `out-diary-sand/`).
  `diary-titles.mjs` holds its board titles, shared with `build.mjs`.
- `workflow.mjs` — the "How the journeys connect" chart.
- `build.mjs` — writes `out/project/*` (the one canvas's files), following
  `consolidate/`. It first runs every journey's `build-<name>.mjs --theme
  sand` and wraps those boards (journey 12 is the oldest of them)
  (Soft sand fonts, links rewritten to the `j12-…` file names, links to
  other rooms dropped); it stops if journey 12 in `journeys.mjs` no longer
  matches `diary.mjs` ROWS. It also writes `out/removed.json`: boards on the
  live canvas (`live-canvas.json`) that this build no longer makes. It reads
  `blobs-fjell.json` (image ids already uploaded to the canvas),
  `shots/screens.json` (screen design titles) and `live-canvas.json` (the
  last canvas index read from the artifact: keeps `createdOnFiles`,
  `attachments`, `designSystems`).
- `shoot.mjs` / `shoot-fjell.mjs` — re-render the Release 1 screen designs to
  PNG (the Fjell one swaps the old colours for Fjell tokens). The images are
  already uploaded; only rerun if the screen designs change, then upload the
  new PNGs as canvas assets and update `blobs-fjell.json`.
- `fitcheck-canvas.mjs` — after `node build.mjs`, renders every board on
  the canvas and fails if a page is bigger than its board or a link opens a
  board that isn't there.
- `fitcheck.mjs` — the older check of the stage 1 and 2 drawings' sidebars.
- `text.mjs` — dumps a screen design's text, used as the content source for
  redrawing.

## Rules for drawings from now on

Agreed 3 Oct 2026 from issue #116 step 2 (Mark's proposal, Jack: "yes go
ahead"). They apply to every new or redrawn screen, starting with the move to
one canvas (step 3). Where they differ from "Rules the drawings follow" at the
bottom of this file, these win. The step 1 analysis behind them is in
`consolidation-*.md` next to this file.

1. **One drawing per real screen, not per situation.** Empty, saving, saved,
   failed, Undo, the Staff or Manager view, all shops, Cycle to Work, "while
   moving" and on/off are **lines in that screen's situation list**, not
   drawings. Draw a situation only if it changes the layout a lot, for
   example a box that opens over the page.
2. **Each screen has a situation list**: a small table under it on the
   canvas, or in a markdown file next to the generator.

   | Situation | What's different | Who sees it | Decision |
   |---|---|---|---|
   | Empty | "No deliveries yet" and an Add button | Everyone | Receiving 4 |
   | Staff | Costs and invoice hidden | Staff | Receiving 4 |
   | Problem on a line | Line shows "Damaged · 1" and the job strip | Everyone | Walk-through 3 M2 |

3. **One size per screen on the canvas**: desktop for staff screens, phone
   for customer pages. Tablet and the other size become written rules ("on a
   tablet the list narrows to icons"), not drawings. Draw the other size only
   where the layout really changes: the workshop diary and job page on a
   tablet and phone, and the till page on a phone (`consolidation-12-21.md`,
   `consolidation-11-15.md`).
4. **Every screen says which building block it uses**, from the list below.
   A screen that needs a new block says why, and the block is added to the
   list.
5. **Nothing is drawn twice.** The job page, the diary, Today, Settings,
   Messages and the customer page are drawn once, in their own journey.
   Other journeys link to them and add a line to their situation list.
6. **Walk-through findings become situation-list lines first**, and a
   drawing only when the layout changes. A finding that adds a drawing says
   why a line won't do.

### Building blocks

Mark's 15 from issue #116, then the ones the step 1 reports added. This is a
first list: step 3 merges any that turn out to be the same block.

**Mark's 15:**
1. Settings page (sections, "Saved · Undo", save failed)
2. Settings row
3. Table with search and filters
4. Detail page (product, delivery, order, person, customer)
5. Report page
6. Today cards
7. Step-by-step checklist
8. "Are you sure?" box
9. Form box (invite, person form, add a shop, adjust stock)
10. Saving / failed / undo message
11. Empty list
12. Controls hidden by role
13. Shop switcher
14. Activity list
15. The job page, reused as it is

**Staff app, added by step 1:**

16. App frame: the staff sidebar with its tablet rail and phone menu, the
    till bar, and the website header and footer
17. Search with grouped results (also the parts search on a job)
18. Note-and-coin counter (morning float and close the day)
19. Till page (quick buttons and basket)
20. Payment step (ways to pay, card machine, cash, split, Paid, "who pays what")
21. Pick-one box (size and colour, frame, customer, parked sale)
22. Status line (offline, sales waiting, "Last checked [n] seconds ago")
23. Diary (week and day grid, Waiting column, stacks)
24. Stage strip and its next-step box (job stages, Lightspeed states, Cycle
    to Work order, the move)
25. Quick-look box
26. "Working: [name] · Switch" bar for a shared workshop computer
27. Scan-and-count list (receive a delivery or transfer, stock take)
28. Price at each shop field
29. "You can't open this — ask [name]"
30. Simple text-and-photo editor for the fixed website (question 2)

**Customer pages, added by step 1:**

31. Product card and product list
32. Product page, with its availability line
33. "Which shop?" box
34. Shop card
35. Basket and checkout sections
36. Step-by-step booking, with the day strip and time picker
37. Customer job page (one page per job, all its stages)
38. Quote card
39. Card payment box
40. Message or outcome page (signed out, not found, sent, cancelled, paid)
41. Receipt and printed documents
42. Emailed-code sign-in
43. PIN pad (till and workshop computer)
44. Staff banner on the website
45. Cookie choice
46. Email and text frame
47. Conversation thread with a reply box

## Tablet and phone, written down

Rule 3's written rules, one row per journey (second walk, 3 Oct, answer 8:
a table here, not notes on the canvas). Taken only from recorded decisions in
`docs/decisions/`; "not decided" means none says how that journey's
undrawn sizes behave. Each journey's own canvas still has every size drawn.
Drawn at other sizes on the one canvas: `diary`, `diary-day` and
`job-overview` (tablet and phone) and `till-sale` (phone); customer pages are
drawn at phone only.

For every staff page: tablets are landscape (Workshop day 11); the tablet has
the icon rail with labels and the phone a top bar with a menu (App map,
background); search is a magnifying-glass button (App map 2, 14); hover
becomes a tap (App map 14), or long-press on the workshop's boards (Workshop
day 68); at a business with more than one shop, the shop's name sits under
each page's title, 14px (Multiple sites 11; walk-through 7 L2).

| Journey | On a tablet | On a phone | Decision |
|---|---|---|---|
| A App map | Icon rail with labels; the till page folds to the rail | Top bar with a menu | App map 2, 4, 14 |
| B Signing in | not decided | not decided | — (approved at three sizes, Signing in 10) |
| 1 Find the shop | The header's search button opens a search box across the top, suggestions under it; "Collecting from Bolton · Change" at the top | As tablet; "Filter" opens a full-screen panel with "Show [n] products"; shop cards one to a row | Find the shop 8 |
| 2 Buy online | With two shops, "Collecting from Bolton · Change" under the header | Checkout puts the order at the top and Pay in a bar along the bottom | Buy online 10 |
| 3 Book a repair | Keeps the desktop's two columns | "Your booking" a bar along the bottom; steps in one column; cards and fields one to a row; the day strip scrolls sideways; pop-ups fill the screen | Book a repair 13 |
| 4 Drop off and quote | New total, "Your answers are final once sent." and Approve in a bar pinned along the bottom; staff boards use the job page's layouts | As tablet, no "Send your answers?" pop-up; the tracker stacks; pop-ups fill the screen | Quote 8 |
| 5 Collect and pay | not decided | not decided | — (approved at three sizes, Collect and pay 6) |
| 6 Cycle to Work | Keeps the desktop layout with the icon rail | Order page in one column, "Next" first, the six stages two to a row; pop-ups fill the screen; More opens from the left | Cycle to Work 8 |
| 7 Account and reminders | Staff boards use the app's own layouts; customer pages not decided | Account top to bottom (bikes, history, store credit, details, contact, your data); a history row's kind under its title; the staff inbox is two screens | Account 9 |
| 8 Owner setup | Keeps the desktop layout with a narrower area list | Settings opens on the list of rooms, each its own page with "‹ Settings"; pop-ups fill the screen; no hover-only Edit and Remove (a tap opens the row); checklist steps are whole tappable rows | Owner setup 21; Receiving stock 7 |
| 9 Moving from Citrus Lime | not decided | not decided | — (approved at three sizes, Moving 10) |
| 10 Opening the shop | not decided | not decided | — |
| 11 Selling at the till | Till page folds to the icon rail | Drawn (`till-sale`); offline, the bar has room only for "Offline"; the rest not decided | App map 4; Leftover screens (as drawn); rule 3 |
| 12 Workshop day | Drawn (`diary`, `diary-day`, `job-overview`); other boards not decided | Drawn, as tablet; the job page's rows tap to open | Workshop day 3, 11, 68; rule 3 |
| 13 Receiving stock | not decided ("the same recipes") | The restock list shows stock and sales under each product; receiving: scan at the top, the list fills the screen, "Book in [n] items" at the bottom | Receiving stock 11; Stock control 5, 12; walk-through 3 M5 |
| 14 Stock control | Follows the desktop layouts | Change prices preview stacks each product (Now → New, then Margin); Today's below-zero line puts "See them" and "Count them" under its words; counting: scan at the top, "I've finished my part" at the bottom | Stock control 12; walk-through 3 M5 |
| 15 Customer service | not decided | not decided | — (approved at three sizes, Customer service 14) |
| 16 Cash-up | not decided | The report shows the date and who closed it; the rest not decided | Cash-up 6 |
| 17 Reports and accounts | As desktop | "Change what's shown" and "Download" share a row; tables in smaller type, headings can wrap | Reports and accounts 9 |
| 18 Website management | The editor keeps its side panel, narrower, size buttons as icons | Edit, then preview: Sections, Theme and Preview are tabs, Publish at the top with the save state under it; tables become one card per item | Website management 13 |
| 19 Multiple sites | The switcher is in the unfolded sidebar; choosing a shop opens "Choose a shop" as a pop-up | "Choose a shop" fills the screen; Today's shop rows stack (name and till status, then sales, bikes expected and ready on one line) | Multiple sites 10, 11 |
| 20 Management oversight | Keeps the desktop layout with the icon rail | The log's lines stack (time and name, then what happened); filters two to a row | Management oversight 7 |
| 21 Lightspeed shops | Keeps the desktop layout with a shorter icon rail | The Lightspeed strip at the top of the job, its button full width; pop-ups fill the screen; part-search rows put the name on its own line | Lightspeed shops 13 |

## Updating the canvas

1. Read the live `project/canvas.json` from the artifact first. Someone may
   have edited it. Save it as `generator/live-canvas.json` and keep any
   boards or notes you didn't create.
2. `node build.mjs` in `generator/`.
3. Publish `out/project/*` to the artifact: at most 255 files per call. Send
   the boards first and `project/canvas.json` last. Pass `null` for boards
   that no longer exist — the list is `out/removed.json`.

Rules the drawings follow (with "Rules for drawings from now on" above):
Soft sand tokens only (no raw colours beyond `ui.mjs`), Public Sans (DM Mono
for numbers), room navigation, desktop 1280×800, tablet 1180×820 and phone
390×844, no invented logo (a marked LOGO slot), and the glossary names in
`docs/decisions/2026-09-27-names.md`. A few old Release 1 boards are still
pictures in the earlier look.
