## Context

Rows needing a look wait in `move_rows` with `state = 'look'` and a reason (`citrus-import-customers`, design 14, 19, 22, 23). `forgetForMove` removes or changes them inside a deletion, which locks every move file first. `bringBatch` takes the same files first, then the batch's products or customers.

## Decisions

1. **Migration 113.** `move_rows.state` also allows `left_out`. `move_files` gets `rows_left_out` and `rows_fixed`. `move_rows` gets who and when (`sorted_by_login_id`, `sorted_by_employee_id`, `sorted_at`) and a request key and body hash, one key per shop. `move_help_requests` holds what was asked until a real inbox exists, with row-level security. Additive and safe to run twice.

2. **One order of locks.** BEGIN, `lock_timeout`, every move file in id order, then the row `FOR UPDATE`, then what `lockForBatch` takes for that report (products in id order; a bike's owner `FOR SHARE`), COMMIT, reply. It's the batch's and the deletion's order, so they can't deadlock. A wait that runs out or a deadlock says try again (503), with nothing changed. The appliers' stock rule doesn't change: `priceListRow` still only inserts a new product and never adds to an existing one.

3. **Seen.** The list gives each row a `seen` code: a hash of its reason, link and data. A fix or leave-out sends it, and it's compared under the lock. A row gone says `row_gone`; one that isn't needing a look any more, or differs, says `row_changed`. So a deletion, a batch or a second tab landing while the pop-up is open can't be undone by the save.

4. **Fix applies the row in the file's own way.** Only the fields for that report may change (design 6). The corrected row goes through the same `ROW_APPLIERS`, with the deleted-customer codes read under the lock. If the answer is still `look`, the transaction rolls back, nothing is stored, and the reply is 422 with the reason. So a fix can't leave half a row, and typed corrections aren't stored until they fit.

5. **What a person decides.** `decided` on a fix: `shared` (a tick: not the deleted customer) and `notSameAs` (a tick: not this customer, by id, so it can't carry over to someone else the corrected details fit). A row whose stored reason is the shared one always needs the `shared` tick, even if the fix removed the email and phone: it may really be the deleted person's (answer 6). A deleted customer's account number is `skipped` whatever is ticked. `bringBatch` never passes `decided`, retries never touch these rows, and there's no route for more than one row.

6. **What Fix asks** (second walk 4d: left for the build, logged for Jack). Customers: first name, last name, account number, email, phone. Products: code, description, price, cost, VAT rate, stock, reorder level. Barcodes: product code, barcode. Bikes: description, frame number, customer name, email, mobile, phone. Other columns stay as they came. An empty box is an empty cell. Another store's stock row can't be fixed to be this shop's: it says why, and Leave it out is the way.

7. **Request keys.** Both buttons send one, as stock changes do. Stored on the row when it commits. The same key on the same row with the same body replies with the row's outcome and changes nothing; otherwise 409. A refused fix stores nothing. `settle` also clears the row's customer link now, so a sorted row points at nobody.

8. **Counts.** `addCounts` takes minus ones for `rows_look` and `stock_look`. Fix adds to `rows_in`, `rows_same` or `rows_skipped` as the row turned out, plus `rows_fixed`. Leave it out moves it to `rows_left_out`. Every row is one of waiting, in, same, skipped, look or left out, so the sum is `rows_total`.

9. **A fix brings waiting rows along.** A customer or product that's just come across sends back to waiting only the bike or barcode rows it could fit (`NO_CUSTOMER` with their email, phone or exact name; `NO_PRODUCT` with that code), not every such row, so the list doesn't jump.

10. **A deletion and left-out rows.** `forgetForMove` includes `left_out` rows: their own go and `rows_left_out` follows; those only sharing take answer 3's reason, as needing-a-look rows do, and stay left out. Leave it out clears the row's customer link.

11. **Who.** `whoIsBooking` from purchase orders, exported: the person checked in, or the sign-in on an ordinary browser; on a till or workshop computer with nobody, `check_in_first`. A fixed price list row's stock history line uses that login. The route's `refused` keeps it to the Owner.

12. **The list.** `GET /api/move/look` gives the first 200, oldest first, and the total; as they're dealt with the next ones show. A file of another store's stock could otherwise send 100,000 rows to the page.

13. **Which board.** After `mv-progress`: the list while the owner is looking and rows remain (it stays there while a fix's bikes go round); `mv-sorted` when nothing needs a look and any row was fixed or left out; otherwise the summary. Done for now goes to the summary (the mockup link goes to `mv-sorted`, but `mv-sorted` is drawn for "when every row is fixed or left out", and it would say Everything's sorted with rows waiting).

14. **See them and Your data.** `mv-sorted` links to Settings › Office › Your data, which isn't built, and whose drawing doesn't show left-out rows. See them isn't shown until it does something, as with the earlier pieces. The drawn sentence would be untrue today, so it reads "are kept, and will be listed under". Left-out rows keep their details for it.

15. **Ask us to help.** `server/move/help-inbox.js`, as the message senders: one `send()`, pretend until Jack says yes to a real inbox, nothing leaves the server. The request is recorded and committed first, then sent, so a failed send can be tried again with the same key without a second record. It carries what was written, the card, who and the shop, and their email for the reply; nothing from the rows.

16. **A slim drop zone stays on `mv-sorted`,** as on the summary (`citrus-import-screens`, design 6), since the owner may still have files to send.

## Risks

- Leaving out one by one is slow for a big second store's file. No bulk button is drawn, and none is added here. Noted for Jack.
- A row left out comes back as needing a look if the file is sent again. Nothing remembers the choice. Logged for Jack.
