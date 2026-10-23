# Questions that unlock the next pieces (23 Oct)

Jack answered these on 23 Oct, one at a time, before leaving work to run
overnight. Each answer was option 1 of the choices put to him.

1. **Accessibility settings (WP-1.11, `your-settings`; decision 57 of
   `2026-09-27-workshop-day-review.md`) are saved on the signed-in account
   for now.** Whoever signs in gets their settings on any device; on a till
   everyone shares one login, so they share one set until PINs (WP-1.7),
   when they move to each person.
2. **Deposits (`dq-quote-deposit`, `bk-cancel-late`, `bk-settings-deposits`)
   are built now behind a pretend payment provider**, as every outside
   service is (CLAUDE.md, "How each piece is built"). Real deposits wait for
   a real payments account, which is Jack's to open.
3. **Emailed receipts (`cp-receipt-email`, `cp-receipt-address`): the email
   side now** (the message and the address checks), **the till's button
   after Mark's sales in pence (#404) merges**, since #404 rewrites the till's
   receipt files.
4. **Notes on each line of the job page wait for #404**, with the per-line
   Done ticks: both are stored on the order lines #404 rewrites. They are
   built together afterwards.
5. **Merging customers (WP-3.2, `2026-10-21-sign-up-joins-by-merge.md`)
   doesn't need asking each time.** It is the decided feature, not a
   clean-up: everything moves to the kept record first, then the empty
   duplicate is removed, and the merge is recorded so it can be traced.
6. **The old app goes piece by piece, then completely.** Each old screen is
   removed as its replacement merges (CLAUDE.md rule 5); once the last has
   gone, the rest of the old app is removed in its own pull request without
   asking again. This settles the question waiting in STATUS
   (`2026-10-21-old-app-placeholder.md`).
