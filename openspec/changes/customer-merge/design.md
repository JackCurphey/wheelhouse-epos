# Design: Merge

## Decisions

1. **The page's customer is the one kept**; Check opens the comparison for the
   flagged one. For each differing field (name, phone, email, address with
   postcode, note) staff choose this or that; the kept record takes the
   chosen values.
2. **One transaction** moves rows from the other to the kept: customer_bikes,
   workshop_jobs, sales, sale_documents, customer_messages, till_sales,
   till_attention, customer_logins (only when the kept has none; both having
   one is refused), and group memberships the kept didn't have. The ids moved
   per table, the added memberships, and the kept record's fields before and
   after are written to `customer_merges.moved` (JSON), with the other's number
   and till id (`other_was_id`, `other_client_id`), kept after its removal.
3. **Hidden, not removed**: the other gets `active = 0` and `merged_into_id`, so
   every list and search leaves it out. **Undo** (30 days, once) moves the
   recorded rows back where they still belong to the kept, removes the added
   memberships, puts back each field the merge changed that nobody has changed
   since, and makes the other active again. Undo is refused, saying why, past
   30 days (even if the removal hasn't run), once the kept record has itself
   been merged into another or switched off, and while a later merge into the
   same record stands: the later one is undone first. A hidden record can't be
   switched back on by hand. Both records are locked lowest id first, so two
   opposite merges can't deadlock.
4. **Removed for good after 30 days**: a merged record older than 30 days is
   deleted when merges are next read or undone (no timer); anything that has
   come to point at it since (an offline till's sale synced late) moves to the
   kept record first. Each removal is its own transaction; one that fails is
   logged and tried again next time. Removals run oldest first, so merges one
   after another unwind in order, and anything merged into a record being
   removed is pointed on at the record it went into. The merge record stays, its other id
   cleared; if the kept record itself goes, its kept id is cleared, not the
   merge record deleted.
5. **"They're different people"** writes the pair to `customer_not_duplicates`,
   which possible duplicates leave out both ways.
6. **Possible duplicates**: the same UK number (the customers-list rule) or the
   same email, active, not dismissed; with each one's jobs and sales counted
   and when it was added.
7. **The 30-day Undo line on the kept page** (not drawn; its place is stated:
   "from the customer's page"): "Merged with [name] on [day] · can be undone
   until [day]", with Undo the merge, in the duplicate notice's style.
8. **A till finds the kept record.** A till that was offline may still send a
   sale naming the hidden record, by its number or the till's own id for it,
   or send that customer again. The sale goes to the record it was merged into
   (following merges one after another), before and after removal, and the
   customer sent again is answered as already held, not made a second time.
   A sale given this way during the 30 days is noted in each merge it passed
   through, so Undo puts it back with the customer the till meant
   (`server/merged-customers.js`).
