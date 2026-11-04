## Context

Rows needing a look wait in `move_rows` with `state = 'look'` and a reason (`citrus-import-customers`, design 14, 19, 22, 23). `forgetForMove` removes or changes them inside a deletion, which locks every move file first. `bringBatch` takes the same files first, then the batch's products or customers.

## Decisions

1. **Migration 113.** `move_rows.state` also allows `left_out`. `move_files` gets `rows_left_out`, `rows_fixed` and `stock_left_out`. `move_rows` gets who and when (`sorted_by_login_id`, `sorted_by_employee_id`, `sorted_at`) and a request key and body hash, one key per shop. `move_help_requests` holds what was asked until a real inbox exists, with row-level security. The two staff columns are `ON DELETE SET NULL`, added `NOT VALID` as 096's are, so removing a staff record still works and the row names nobody. Additive and safe to run twice.

2. **One order of locks.** BEGIN, `lock_timeout`, every move file in id order, then the row `FOR UPDATE`, then what `lockForBatch` takes for that report (products in id order; a bike's owner `FOR SHARE`), COMMIT, reply. It's the batch's and the deletion's order, so they can't deadlock. A wait that runs out or a deadlock says try again (503), with nothing changed. The appliers' stock rule doesn't change: `priceListRow` still only inserts a new product and never adds to an existing one.

3. **Seen.** The list gives each row a `seen` code: a hash of its reason, link and data. A fix or leave-out sends it, and it's compared under the lock. A row gone says `row_gone`; one that isn't needing a look any more, or differs, says `row_changed`. So a deletion, a batch or a second tab landing while the pop-up is open can't be undone by the save.

4. **Fix applies the row in the file's own way.** Only the fields for that report may change (design 6). The corrected row goes through the same `ROW_APPLIERS`, with the deleted-customer codes read under the lock. If the answer is still `look`, the transaction rolls back, nothing is stored, and the reply is 422 with the reason. So a fix can't leave half a row, and typed corrections aren't stored until they fit.

5. **What a person decides.** `decided` on a fix: `shared` (a tick: not the deleted customer; only `true` counts) and `notSameAs` (a list of ids, one tick each, so a tick about one customer can't carry over to another the details fit). A row fitting two live customers asks about each in turn and makes nobody until both are ticked. A row whose stored reason is the shared one always needs the `shared` tick, even if the fix removed the email and phone: it may really be the deleted person's (answer 6). A deleted customer's account number is `skipped` whatever is ticked. `bringBatch` never passes `decided`, retries never touch these rows, and there's no route for more than one row.

6. **What Fix asks** (second walk 4d: left for the build, logged for Jack). Customers: first name, last name, account number, email, phone. Products: code, description, price, cost, VAT rate, stock, reorder level. Barcodes: product code, barcode. Bikes: description, frame number, customer name, email, mobile, phone. Other columns stay as they came. An empty box is an empty cell. Another store's stock row can't be fixed to be this shop's: it says why, and Leave it out is the way.

7. **Request keys.** Both buttons send one, as stock changes do. Stored on the row when it commits. The same key on the same row with the same body replies with the row's outcome and changes nothing; otherwise 409. A refused fix stores nothing. `settle` also clears the row's customer link now, so a sorted row points at nobody.

8. **Counts.** `addCounts` takes minus ones for `rows_look` and `stock_look`. Fix adds to `rows_in`, `rows_same` or `rows_skipped` as the row turned out, plus `rows_fixed`. Leave it out moves it to `rows_left_out`, and any stock in it to `stock_left_out`. Every row is one of waiting, in, same, skipped, look or left out, so the sum is `rows_total`.

9. **A fix brings waiting rows along.** A customer or product that's just come across sends back to waiting only the bike or barcode rows it could fit (`NO_CUSTOMER` with their email, phone or exact name; `NO_PRODUCT` with that code), not every such row, so the list doesn't jump.

10. **A deletion and left-out rows.** `forgetForMove` includes `left_out` rows: their own go and `rows_left_out` follows; those only sharing take answer 3's reason and lose their link, as needing-a-look rows do, and stay left out. Leave it out keeps the row's customer link, so that if they've changed their email and phone since, their own row with their name is still found (the review, 4 Nov; this replaces clearing it).

11. **Who.** `whoIsBooking` from purchase orders, exported: the person checked in, or the sign-in on an ordinary browser; on a till or workshop computer with nobody, `check_in_first`. A fixed price list row's stock history line uses that login, not the file sender's. The route's `refused` keeps it to the Owner.

12. **The list.** `GET /api/move/look` gives the first 200, oldest first, and the total; as they're dealt with the next ones show. A file of another store's stock could otherwise send 100,000 rows to the page.

13. **Which board.** After `mv-progress`: the list while the owner is looking and rows remain (it stays there while a fix's bikes go round); `mv-sorted` when nothing needs a look and any row was fixed or left out; otherwise the summary. Nothing being left to look at ends looking; files sent from `mv-sorted` show the summary until the owner chooses Look at the [n]. Done for now goes to the summary (the mockup link goes to `mv-sorted`, but `mv-sorted` is drawn for "when every row is fixed or left out", and it would say Everything's sorted with rows waiting).

14. **See them and Your data.** `mv-sorted` links to Settings › Office › Your data, which isn't built, and whose drawing doesn't show left-out rows. See them isn't shown until it does something, and the sentence reads "are kept, and will be listed under" (Jack, 4 Nov, answer 1). He accepted that until then a shop can't see which rows it left out. Left-out rows keep their details for it.

15. **Ask us to help.** `server/move/help-inbox.js`, as the message senders: one `send()`, pretend until Jack says yes to a real inbox, nothing leaves the server. **A real inbox is needed before the first real shop** (Jack, 4 Nov, answer 3). `helpInbox(env)` says which: the pretend one only with `WHEELHOUSE_HOSTED_COPY=1` or `NODE_ENV` of `development` or `test`; anything else, an unset `NODE_ENV` included (a shop's own `docker-compose.yml` sets none), is none. Then the route refuses (503, `no_inbox`), nothing is stored, and `GET /api/move` says `helpOffered: false`, so the page doesn't offer it. The request is recorded and committed first, then sent, so a failed send can be tried again with the same key without a second record. It carries what was written, the card, who and the shop, and their email for the reply; nothing from the rows. The form asks people not to include customers' details. `forgetForMove`, inside the deletion's transaction and after the move files are locked, deletes any request holding that person's exact email, phone or name, in any case (answer 2). A name counts only if it's at least two words, as whole words. A phone counts only as the whole number: the digits of a run, with spaces and punctuation allowed in it, must be that number in one of its usual forms (answer 4). Email matching is unchanged. Names and phones aren't looked for in the card, which from the page only ever holds this page's own headings; its email check stays, since the server takes the card as text. The whole row goes, since nothing identifying may stay and the text is all it's for. A misspelt name gets through, and so does a one-word name or a phone typed straight after another number; he accepted those. A request a real inbox has already received can't be called back from here: the real inbox's own piece has to settle that.

16. **A slim drop zone stays on `mv-sorted`,** as on the summary (`citrus-import-screens`, design 6), since the owner may still have files to send.

17. **An account number is the same in any case, with or without spaces around it** (the review, 4 Nov), for the deleted customers' codes, for rows from a file, for "already here", and when a deletion looks for a person's own row. So A1 and a1 are one account. A code made before this kept the number's own case; that form is tried as well, so it still spots that exact number, though not another case of it.

18. **Focus.** Each pop-up gives focus back to what opened it when it goes, by Cancel, Escape or Send, since it's removed from the page rather than closed. The line saying what happened lives with the page, not the board, so "[row] left out" for the last row shows on Everything's sorted and takes the focus there. Look at the [n] and Done for now move focus to the new board's heading.

19. **A row about someone follows them through a merge** (the re-check, 4 Nov). `move_rows` joins the tables a merge moves, so its link goes to the kept record at the merge, comes back at Undo, and anything still on the hidden record moves when that's removed after 30 days. A row's name may not be the kept record's, so a deletion also counts as theirs the names on merges into them (`customer_merges.other_name`, which stays after the hidden record goes). A merge, an Undo and removing a hidden record now take the move files first, the order a batch, a fix and a deletion use: otherwise a merge holding a customer waits for a row a fix holds, while the fix waits for that customer.

20. **Nothing waits for long behind the move files** (the re-check, 4 Nov). A batch stuck on another lock used to sit holding the files, and merges queued behind it with no limit: ten of them used every connection on the server, and other shops got errors. Now a merge, an Undo and Choose another file wait 2 seconds, then answer 503 busy, try again, which the customer's page says plainly. `removeExpired` runs while a customer's page loads, so it asks for the files with no wait and everything else for 100ms, and if it can't have them a later call does it. A batch, storing a file and its last step wait 500ms for any lock, give back with nothing changed, and try again next tick; `bringBatch` returns `busy`, and the round stops rather than trying twenty times.

21. **A batch stops at 250ms** (or 100 rows), in lots of 10 rows, so a slow row can't overrun by much, and the rest wait for the next batch. There's a 25ms breath between batches. Rows sent back when a file finishes go 500 at a time, with the file still coming across until none are left, rather than tens of thousands in one go. Those rows wait behind that file, as customers come before bikes.

22. **The cause of slow rows: row-level security stops expression indexes being used.** `lower(...)` and `regexp_replace(...)` aren't marked leakproof, so Postgres won't run them before the shop check, and migration 112's indexes served nothing: every row read every customer. Migration 113 adds plain generated columns (`email_key`, `phone_key`, `name_key`, `citrus_account_key`) with their own indexes, and the queries compare those with `=`. A row's cost falls from about 20ms to about 6ms on the measuring machine, most of what's left being round trips.

23. **Measured** on Docker on a Mac, on a scratch database, with made-up files, 20,040 customers and 60,000 bikes going round, a merge, a deletion, a leave-out and a customer's merges page every few seconds. The timings are from one run of each, with batches in a plain loop rather than the timer.

| | Before | After |
|---|---|---|
| Batch, customers | p50 2058ms, max 3657ms | p50 258ms, p95 274ms, max 433ms |
| Batch, bikes | p50 5342ms, max 5440ms | p50 260ms, p95 329ms, max 340ms |
| Merge wait, customers | max 836ms | p50 54ms, max 302ms |
| Merge wait, bikes | p50 4211ms | p50 74ms, max 102ms |
| Deletion, customers | 6 of 8 worked | 11 of 11 worked, max 462ms |
| Deletion, bikes | 0 of 3 worked | 9 of 9 worked, max 346ms |
| Fix (leave-out), bikes | 0 of 3 worked | 9 of 9 worked, max 266ms |
| Customer's merges page | about 5ms | about 6ms, max 18ms |

Throughput after: about 165 bikes a second while batches run, so 60,000 bikes in about 6 minutes, and more with the timer's gap between rounds.

## Risks

- Leaving out one by one is slow for a big second store's file. No bulk button is drawn, and none is added here. Noted for Jack.
- A row left out comes back as needing a look if the file is sent again. Nothing remembers the choice. Logged for Jack.
