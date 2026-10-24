# The till may take a deposit before the work is finished (Jack, 24 Oct 2026)

**Question** (Mark's, open in `openspec/changes/wp-1-6-sales-in-pence/design.md`
before WP-3.1): may the till take a deposit on a job whose work isn't
finished, or hasn't started, as at drop-off? The paying-for-finished-work
decision (`2026-10-08-paying-for-finished-work.md`) refuses payment for work
that isn't finished.

**Jack's answer:** "Yes, deposits only".

**What it means:**
- A deposit can be taken at the till at any stage of the job, as Selling at
  the till decision 11 draws it (`till-job-deposit`).
- The payment that pays the rest, and so finishes the job, still needs the
  work finished, exactly as the 8 Oct decision says.
- **This narrows** the 8 Oct decision for deposits only, by Jack's own
  choice.

**Built:** not yet. It's paying an order in parts, which Mark's sales in
pence design (decision 8) builds into the till's sales after his step B.
