# Design: two settings saved at once both stay

1. **Lock the shop's row, don't narrow the write.** The workshop save checks
   fields against each other and against what is stored (closing after
   opening, Today's days after the reminder's, the deposit switch against
   whether it was already on, the review page against review requests). A
   one-statement write of only the sent columns would check those against a
   row another save is changing. So the save runs in a transaction and reads
   the row `SELECT … FOR UPDATE`, the pattern in
   `server/workshop/checklists.js` and `server/routes/workshop.js`. A second
   save waits on the lock, then reads what the first wrote.
2. **The body is read before the lock.** `readJsonBody` waits on the
   network; holding the row while a slow request uploads would make every
   other save wait for it.
3. **The checks are unchanged.** In `server/routes/workshop-settings.js` the
   checks and the write moved, unchanged, into `saveWorkshopSettings` inside
   `register()`; it returns `true` once written. A refusal still sends its 400
   (or the 409 for deposits with no payment provider) from where it did, and
   the PUT then rolls back, having written nothing. The 200 is sent only after
   `COMMIT`.
4. **Shop isolation is unchanged.** The locked read is the same
   `SELECT * FROM <table> LIMIT 1` under the request's row-level security,
   with `FOR UPDATE` added; it can only see, and lock, the session's own row.
5. **Label settings and website settings** take the same lock. The row is
   still created on first touch (`getOrCreate…`) before the transaction;
   `updateStorefrontSettings` checks the theme first, then locks, writes and
   returns the stored row, so the logo and hero uploads that call it are
   covered too. The row is made with
   `INSERT … ON CONFLICT (shop_id) DO NOTHING` and then read, so two first
   saves at once share the one row instead of the second failing on the
   one-row-per-shop rule (`/review`, 26 Oct).

## Not covered

Looked at and left, because they already change only what was sent in one
statement, so two saves at once can't undo each other:

- `PUT /api/your-settings`: one upsert merging the sent switches into the
  stored JSON (`accessibility || EXCLUDED.accessibility`).
- `PUT /api/message-templates/:key` (messaging settings): one upsert setting
  only the sent columns.
- `PUT /api/shop-details`: one `UPDATE` of only the sent columns.
- `PUT /api/shop-theme`: one field; the later save winning is right.
- `PUT /api/own-messages/:id`: the screen sends the whole message each time,
  in one statement.

Not looked at in this change: the other read-then-write saves outside these
settings, such as `PUT /api/workshop-services/:id` and
`PUT /api/customer-groups/:id`.

## Decision log

- Lock rather than narrow the write: cross-field checks need a stable row (1).
- Body before lock (2), so the lock is held only while the database works.
- `updateStorefrontSettings` now checks the theme before creating a missing
  row rather than after; the check itself is the same, and GET still creates
  the row.
- Label and website settings fixed here rather than listed: each is a few
  lines, and each failed the same test 30 rounds in 30.
