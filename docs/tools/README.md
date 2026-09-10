# docs/tools

Single-file pages that support a decision. Not product code.

## hubtiger-ranking-board.html

The ranking board for GitHub issue #47. Generated on 2026-09-10 from the 317
rows of `docs/decisions/2026-09-10-hubtiger-feature-comparison.md`; the rows
are embedded as JSON inside the file, so it must be regenerated if that
document changes.

Two ways to run it:

- **As a Claude Code artifact (preferred).** Publish this file with the
  Artifact tool declaring `capabilities: {db: {}}`. The page saves the ranking
  to the artifact's shared store and survives refresh and republish. Whoever
  publishes it owns it; a Claude Enterprise sharing restriction stopped Mark's
  copy being shared with Jack, which is why Jack publishes his own.
- **As a plain file.** Open it in Chrome. Without the artifact runtime it
  saves in that browser only and says so in the header.

Either way the output is the **Stack rank as markdown** button. Paste that on
the issue.
