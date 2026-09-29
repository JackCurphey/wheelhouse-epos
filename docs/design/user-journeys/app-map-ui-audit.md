# Journey A — UI audit (desktop, Soft sand)

Audited 29 Sep 2026 by the designer helper from the eight desktop renders
(app map, staff app ×2, till rail ×2, Your settings, website ×2) and the
generator source (`app-map.mjs`, `diary.mjs`, `ui.mjs`), against
`docs/decisions/2026-09-29-app-map-review.md` (decisions 1–11) and the
Workshop day rules that apply everywhere.

**Verdict:** the frame is consistent; touch targets are ≥44px in source; the
room lists match the map; the website header survives a shop theme. One
real gap, on the Till page.

- **H1 — The Till page has no global search.** The till bar (`tillBar()`)
  has only "Search or scan a product", so a customer or job can't be found
  from the till without leaving it, though decision 2 and the map promise
  search on every page.
- **M1 — The till's "Serving: Jo Taylor" pill and "Till menu" button are
  undecided.** Elsewhere your name opens Your settings (decision 8); on the
  till nothing says what these two open.
- **M2 — The folded rail's avatar loses the cog** that marks "your name opens
  Your settings" (decision 9).
- **Quick win:** update the map's "Search sits at the top of every page" line
  once H1 is settled.
- **Trade-off (not a defect):** decisions 4 and 6 together — the till folds
  away the rooms, so losing search there compounds. The Release 2 theme work
  will have less header width if shops highlight more links (decision 10).
