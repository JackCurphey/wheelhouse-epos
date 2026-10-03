# User journeys canvas — source

The **Wheelhouse user journeys** canvases (staff shop floor
https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j, staff back office
https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4, customers and the website
https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh) show every screen by journey, colour-coded by status, with a workflow chart.
It is generated from the files here and published with Claude Code's Artifact
tool. Started 27 Sep 2026.

| Folder | What |
| --- | --- |
| `generator/` | The canvas generator |
| `themes/` | The five theme options (https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN); Jack chose Fjell |
| `design-system/` | The files of the Wheelhouse design system (https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH) |

## Generator files

- `journeys.mjs` — the map: every journey, its rows and screens, each with a
  status. `d(id)` = a Release 1 screen design shown as an image; `b(id)` = one
  that is also built; `g(...)` = not designed yet; `o(...)` = only in the old
  app; `r(id, title, role)` = a new drawing (desktop + phone) awaiting Jack's
  review. `sd(id, title, role)` = an agreed Workshop day redesign screen
  (journey 12, decision 69), shown in the Soft sand look at desktop, tablet
  and phone.
- `ui.mjs` — Fjell tokens (`C`) and shadcn-style helpers (button, field,
  card, badge, icon, logo slot). **Keep these values in step with
  `src/styles/theme.css`.**
- `stage1.mjs` — shells (staff app with the room sidebar, till mode, customer
  website), the app map, and the sign-in journey. `ROOMS` is the staff
  navigation: Front desk, Workshop, Stockroom, Office.
- `stage2.mjs` — the first 21 Workshop day drawings (desktop + phone).
  Superseded by the redesign (decision 69) and no longer on the canvas.
- `diary.mjs` / `build-diary.mjs` — the approved Workshop day redesign and
  its own review canvas (`--theme sand` writes `out-diary-sand/`).
  `diary-titles.mjs` holds its board titles, shared with `build.mjs`.
- `workflow.mjs` — the "How the journeys connect" chart.
- `build.mjs` — writes `out/project/*` (the canvas files). It first runs
  `node build-diary.mjs --theme sand` and wraps those boards as journey 12
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
- `fitcheck.mjs` — renders every drawing and fails if a sidebar overflows.
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

## Updating the canvas

1. Read the live `project/canvas.json` from the artifact first. Someone may
   have edited it. Save it as `generator/live-canvas.json` and keep any
   boards or notes you didn't create.
2. `node build.mjs` in `generator/`.
3. Publish `out/project/*` to the artifact: at most 255 files per call. Send
   the boards first and `project/canvas.json` last. Pass `null` for boards
   that no longer exist — the list is `out/removed.json`.

Rules the drawings follow (journey 12 is the exception: Soft sand tokens,
Public Sans, and a tablet size of 1180×820): Fjell tokens only (no raw colours beyond `ui.mjs`),
Work Sans (DM Mono for numbers), room navigation, desktop 1280×800 + phone
390×844, no invented logo (a marked LOGO slot), and the glossary names in
`docs/decisions/2026-09-27-names.md`.
