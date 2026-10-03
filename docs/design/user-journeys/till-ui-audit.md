# Journey 11 — UI audit (desktop, Soft sand)

Audited 29 Sep 2026 by the designer helper from the 28 desktop renders,
against `docs/decisions/2026-09-29-selling-at-the-till-review.md`
(decisions 1–10), journeys A and B, the offline spec §3, and the rules for
every journey. Verdict: card sale, cash sale, discount and receipt are clean
and consistent; touch targets and button styling are right almost
everywhere. Checked in the main session before bringing to Jack:

- **H1 — kept.** The destructive button swaps sides: "Remove from sale" and
  "Remove discount" sit left, "Void sale" sits right. Fix: safe action on the
  left, the confirming action on the right, everywhere.
- **H2 — kept.** Nothing on the sale screen leads to Find a past sale,
  Refund or Void. Needs an entry point.
- **H3 — kept.** Missing states: empty basket, search with no results, a
  refund of a cash sale.
- **M1 — kept, as a question.** The offline pill and notice use the pale
  amber "warning" colours on the same screen as the amber "you are here"
  marker on the rail (Workshop day decision 48: amber only for active).
- **M2 — kept.** The frame-number field shows a tick before anything is
  scanned. Fix: a scan icon.
- **M3 — kept.** The £/% switch defaults to % on a line and £ on the whole
  sale. Fix: one rule — remember the last one used, starting with £.
- **M4 — kept.** Click and collect is drawn with the items already ticked;
  it should start unticked.
- **L1 — kept.** The gift card search hint is cut off. Fix: shorter wording.
- **L2 — no change.** "No receipt" is the filled button on purpose: it is
  what happens if nobody taps (decision 7).
- **L3 — note for building.** Tick boxes are 22 px but the whole row is the
  tap target; the build must keep it that way.
