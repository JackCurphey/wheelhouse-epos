# Handover — designing the next journey (written 29 Sep 2026)

For the agent who picks up journey design after Workshop day. Read this, then
`.agents/STATUS.md`, then `docs/decisions/2026-09-27-workshop-day-review.md`
(69 decisions — most are Workshop-day specific, but the look, accessibility
and interaction rules apply to every journey).

## Where things stand

- **Workshop day (journey 12) is approved** at desktop, tablet and phone and is
  in the big user-journeys canvas as Designed:
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j
- Its working canvas (one current page, 88 boards):
  https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U — shared "anyone with the
  link" by Jack. The big canvas is private.
- **Journey A (App map and navigation) is approved** (29 Sep) and in the big
  canvas as Designed; its own canvas: https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA ,
  decisions in `docs/decisions/2026-09-29-app-map-review.md` (6 — as few
  clicks as possible — and 2 — search on every staff page — apply to every
  journey).
- **Journey B (Signing in and access) is approved** (29 Sep) and in the big
  canvas as Designed; its own canvas: https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe ,
  decisions in `docs/decisions/2026-09-29-signing-in-review.md`.
- **Journey 11 (Selling at the till) is approved** (29 Sep) and in the big
  canvas as Designed; its own canvas: https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG ,
  decisions in `docs/decisions/2026-09-29-selling-at-the-till-review.md`.
- **Journey 16 (End-of-day cash-up) is approved** (29 Sep) and in the big
  canvas as Designed; its own canvas: https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE .
- The overview counts each screen once: 253 screens — 146 designed, 0 for
  review, 6 built, 14 old app only, 87 not designed yet.
- **The big canvas is desktop only** (Jack, 29 Sep; journey 16 decision 8):
  a Design canvas holds at most 512 files, so each redesigned screen appears
  once — desktop, the one-off large board, or a phone-only screen's only
  size (`bigSizeOf` in build.mjs) — with a "Tablet and phone ↗" link on its
  strip to its journey's own canvas (`SAND_CANVAS`). Add the new journey's
  canvas to `SAND_CANVAS` when copying it in. 257 files after the switch.
  A publish carries at most 255 files, so a big change goes in two rounds:
  changed boards with canvas.json first, then removals.
- **Drawing all three sizes at once:** `till.mjs` defines each screen with
  `def(id, () => …)` and helpers read `CUR` (desktop / tablet / phone) — a
  pattern worth reusing for the next journey rather than drawing each size
  by hand. Renders: set a font-wait timeout; macOS has no `timeout` command.
- **A new journey's own canvas:** write `<name>.mjs` (screens as
  `{desktop, tablet, phone}` or `single`, plus `TITLES` and `ROWS`) and a
  three-line `build-<name>.mjs` calling `buildSandCanvas` from
  `sand-canvas.mjs`; add `out-<name>-sand/` to the generator's `.gitignore`.
- Branch `feat/workshop-diary-design` holds all of this, committed, **not
  pushed, no PR**. Ask Jack before pushing / opening a PR.
- **Which journey is next is Jack's call** — ask him first (one question,
  numbered options). The other journeys are still drawn in Fjell; the "for
  review" ones (journeys A, B and the till/customer ones) and the many "not
  designed yet" items are the candidates.

## Rules that now apply to every journey (Jack's decisions)

- **Look: "Soft sand, dark rail"** (decision 48), **sans-serif only** —
  Public Sans everywhere, DM Mono for numbers/prices (53). Charcoal sidebar,
  amber only for "you are here". Destructive buttons outlined (53). Thin
  borders all round, never a thick coloured left edge (45, 67). Tokens in
  `generator/ui.mjs` (`--theme sand`); the app code (`src/styles/theme.css`)
  is still Fjell until switched (STATUS "Next").
- **Accessibility first** (57): colour-only status by default with a per-person
  "Show status symbols" setting; Reduce motion; Larger text; ≥44px touch
  targets, ≥14px body, ≥12px labels, 4.5:1 contrast.
- **Interaction patterns Jack chose:** pop-ups in the middle, not side panels
  (15, 16); one page, sections may fold, never a separate page (30); pills —
  and branching pills — instead of dropdowns for short/grouped choices, search
  boxes for long lists (62, 66); toggle pills for on/off states (50); hover
  previews as an extra with right-click/long-press kept (65); no mechanic
  dropdowns where position decides (32, 54).
- **Process Jack likes:** a separate canvas per section; **desktop first**
  (25), then a look/content settle, then tablet and phone; before/after boards
  for bigger ideas; an expert UI audit before calling a section done (55);
  then copy into the big canvas.

## How the Workshop day canvas was built (reuse this)

- Generator: `docs/design/user-journeys/generator/`. `diary.mjs` (screens),
  `job-page.mjs` (shared job page), `ui.mjs` (tokens, `--theme sand`),
  `build-diary.mjs` (`--desktop` for desktop-only, `--theme sand`, `--ideas`
  for the old audit row), `fitcheck-diary.mjs` (`--strict` checks inside
  overflow:hidden), `diary-titles.mjs` (board titles). Exploration files kept
  for the record: `job-options.mjs`, `looks.mjs`, `audit-ideas.mjs`.
- For a new journey, make a sibling module the same way (screens as
  `{desktop, tablet, phone}` markup) and a build script writing
  `out-<name>-sand/project/*.dc.html` + `canvas.json` for its own new Design
  canvas (quickstart → Design type → publish with `type_url`).
- **Copying into the big canvas:** `build.mjs` reads every Soft sand journey
  from its own build via `SAND_SOURCES` (journey 12 = `diary`, journey A =
  `app-map`). For the next journey: add its source there, list its screens in
  `journeys.mjs` with a marker like `sa()` (sizes are read from whichever
  boards its canvas has), and the mismatch guard checks order and rows.
  Cross-journey links are relinked automatically.
  Always refresh `generator/live-canvas.json` from the live big canvas first,
  publish only changed boards + `Main.dc.html` + `canvas.json` (≤255 files per
  call; `canvas.json` last), old files as `null`.

## Gotchas that cost time

- **Fonts:** never write `&quot;` inside a `<style>` block — it isn't decoded
  and the font silently falls back to serif. Set the font on
  `body, button, input, select, textarea`. Fixed in all three builders.
- **Artifact publishing:** read `project/canvas.json` right before any layout
  publish and merge onto it (Jack sometimes moves things); when a publish is
  refused for "not read", `list` the files (scope `files`) — listing counts as
  seen. Publish only files that changed.
- **Quick previews:** my ad-hoc Playwright renders strip `<helmet>` and
  sometimes show serif — the canvas is fine; verify fonts with
  `getComputedStyle` rather than trusting a screenshot.
- **Example data:** only reuse names/bikes/prices already in the generator;
  anything without a source gets a bracketed placeholder. Keep example facts
  consistent across boards (times, ready-by = diary day, etc.).
- **Helpers:** give each a self-contained brief (file paths, decision numbers,
  what "done" means, where PNGs go) and ask for the report inline; brief them
  to render and look at their own output and to hash boards they must not
  change. Heavy redraws went well on the `frontend` agent with the opus model;
  the `designer` agent (no Bash) is good for studies and audits from PNGs.
  Don't message a running helper — stop it and re-dispatch.

## Open items carried forward (not blocking the next journey)

- Multi-day jobs and unplanned carry-over (decision 52).
- Payment and collection as one step, with deposits (63).
- Mechanic sign-off (64).
- Customer spending limit on the `/book` pages (41).
- Tap the phone number to see texts — needs inbound SMS (49).
- WorkOS sign-in for shop and customer accounts (STATUS "Later").
- The work-and-parts "Done" tick is 44×34 on desktop (full 44 on tablet).
