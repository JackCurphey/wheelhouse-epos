# Proposal: Show status symbols

## Why

Workshop day 57 (`docs/decisions/2026-09-27-workshop-day-review.md`): status
is colour alone by default, with a per-person switch that adds a shape, so a
colour-blind mechanic scanning the diary still tells the statuses apart. Your
settings is built with its first switch (#442); this adds the second.

## What Changes

- **Your settings** gains "Show status symbols", first as drawn, with its hint
  and the drawn preview of two week blocks (`your-settings`,
  `diary.mjs` `symbolsPreview`).
- **With it on**, the diary's week blocks (where the status word doesn't fit)
  and every request carry the status's shape in the top-right corner, and the
  legend's swatches carry it too (`diary.mjs` `STATUS_SHAPE`, `jobBlock`,
  `pendingBlock`, `diaryLegend`). Day view and a phone already spell the
  status out. The shape is hidden from screen readers, which hear the word.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `your-settings`: a second accessibility switch.

## Lane, work package, drawings and decisions

- **Work package:** WP-1.11, Jack (overnight queue, 23 Oct). Stacked on #442.
- **Risky areas:** none.
- **Drawings:** `your-settings`; the diary's blocks and legend (`diary.mjs`
  :89–113, :777, :883–884, :1327).
- **Decisions:** workshop day 57; layout audit H1/S1, H2 (the shapes).

## Out of scope

- Don't close things by themselves, Folded sidebar, Larger text.

## Impact

`src/screens/diary/status-shape.tsx` (new), `diary-tiles.tsx`, `diary-page.tsx`
(legend), `src/screens/your-settings/your-settings-page.tsx`. No server change:
the switch is already kept (#442).
