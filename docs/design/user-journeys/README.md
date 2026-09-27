# User journeys canvas — source

The **Wheelhouse user journeys** canvas (https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j)
shows every screen by journey, colour-coded by status, with a workflow chart.
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
  review. `WR(label)` pulls the Workshop day drawings from `stage2.mjs`.
- `ui.mjs` — Fjell tokens (`C`) and shadcn-style helpers (button, field,
  card, badge, icon, logo slot). **Keep these values in step with
  `src/styles/theme.css`.**
- `stage1.mjs` — shells (staff app with the room sidebar, till mode, customer
  website), the app map, and the sign-in journey. `ROOMS` is the staff
  navigation: Front desk, Workshop, Stockroom, Office.
- `stage2.mjs` — the 21 Workshop day screens (desktop + phone).
- `workflow.mjs` — the "How the journeys connect" chart.
- `build.mjs` — writes `out/project/*` (the canvas files). It reads
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

## Updating the canvas

1. Read the live `project/canvas.json` from the artifact first. Someone may
   have edited it. Save it as `generator/live-canvas.json` and keep any
   boards or notes you didn't create.
2. `node build.mjs` in `generator/`.
3. Publish `out/project/*` to the artifact: at most 255 files per call. Send
   the boards first and `project/canvas.json` last. Pass `null` for boards
   that no longer exist.

Rules the drawings follow: Fjell tokens only (no raw colours beyond `ui.mjs`),
Work Sans (DM Mono for numbers), room navigation, desktop 1280×800 + phone
390×844, no invented logo (a marked LOGO slot), and the glossary names in
`docs/decisions/2026-09-27-names.md`.
