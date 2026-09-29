# Journey 16 — UI audit (all sizes, Soft sand)

Audited 29 Sep 2026 by the designer helper from the 30 renders, against
`docs/decisions/2026-09-29-cash-up-review.md` (decisions 1–5) and the rules
for every journey. Verdict: the step page reads clearly at every size and
the statuses are consistent. Checked in the main session:

- **H1 — dismissed.** "The phone report has no title." The render shows
  "Day closed · Till B1" at the top; the phone header does leave out the
  date and closed-by line, which the desktop has — fix that.
- **H2 — dismissed as a defect.** Amber "needs you" on steps beside the
  rail's amber "you are here". Journey 11 decision 12 already keeps the
  warning colour for real warnings (routine notices go warm grey); the
  steps' "needs you" is a warning. Noted, not changed.
- **M1 — kept.** Finishing a step should open the next one by itself —
  about 6 taps for a clean night instead of about 10.
- **M2 — kept.** "Check" on a flagged sale and "Add a paid-out" have no
  drawn destination. Check opens the sale (journey 11's past-sale pop-up);
  a paid-out needs a small pop-up of its own.
- **M3 — kept, partly.** Missing: a count that matches exactly, a night
  with no paid-outs. Rules rather than drawings: each till closes on its
  own; a closed day is reopened by a manager from Reports, with a reason.
- **L1, L2 — no change.** Severity by count; length of the difference
  reason.
