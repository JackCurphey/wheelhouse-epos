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
   per table, the added memberships, and the kept record's fields before are
   written to `customer_merges.moved` (JSON).
3. **Hidden, not removed**: the other gets `active = 0` and `merged_into_id`, so
   every list and search leaves it out. **Undo** (30 days, once) moves the
   recorded rows back where they still belong to the kept, removes the added
   memberships, restores the fields and makes the other active again.
4. **Removed for good after 30 days**: a merged record older than 30 days with
   nothing pointing at it is deleted when merges are next read or made (no
   timer); the merge record stays, its other id cleared.
5. **"They're different people"** writes the pair to `customer_not_duplicates`,
   which possible duplicates leave out both ways.
6. **Possible duplicates**: the same UK number (the customers-list rule) or the
   same email, active, not dismissed; with each one's jobs and sales counted
   and when it was added.
7. **The 30-day Undo line on the kept page** (not drawn; its place is stated:
   "from the customer's page"): "Merged with [name] on [day] · can be undone
   until [day]", with Undo the merge, in the duplicate notice's style.
