# Design: the customer's account, the server

## Decisions

### 1. Joining on a code sign-in (`loginForSignedInEmail`, `server/routes/portal.js`)
Inside the existing transaction, before making a new customer:
```sql
SELECT c.id, EXISTS (SELECT 1 FROM customer_logins l WHERE l.customer_id = c.id AND l.shop_id = ?) AS has_login
  FROM customers c
 WHERE c.active = 1 AND c.merged_into_id IS NULL AND lower(trim(coalesce(c.email,''))) = ?
 LIMIT 2
```
If there's exactly one row without a login, the new `customer_logins` row
points at it. Otherwise make a new customer, as now. The `ON CONFLICT` race
guard is kept.

### 2. `job-<id>` in place of a private code (`resolveBookingLink`)
When `code` matches `^job-\d+$`, the server:
1. checks the signed-in customer's session (`currentCustomerSession`) for
   this shop's slug;
2. reads the job with `w.id = ? AND w.customer_id = <their customer>`;
3. gives no expiry check, because the owner can always see their repair;
4. answers 404 for anything else, with the same reply as a bad code.

All twelve repair-page routes go through this function, so they need no
change of their own. `/cancel` builds its message link from the code. For a
`job-` code it uses `/book/:shopSlug/account` instead.

**Not chosen:** twelve new session routes. That's more code and a refactor of
four screens, for the same result.

### 3. `GET /api/portal/:shopSlug/history`
The customer has to be signed in to this shop, or it answers 401.

**Repairs:** `WORKSHOP_JOB_SELECT WHERE w.customer_id = ?`, mapped to:
- `{ kind: 'repair', jobId, reference, title, bikeLabel, stage, jobDate, totalPence, at }`;
- `stage` comes from `bookingStage(row)`;
- `totalPence` is the job's order total in pence, `null` while there's none;
- `at` is the job's moment, as the staff history works it out.

**Purchases:** `all_sales WHERE customer_id = ?`, with what was bought joined
from `sale_items` (old) or `till_sale_lines` (till), mapped to
`{ kind: 'purchase', source, id, receiptNumber, what, totalPence, at }`.

Repairs and purchases are merged newest first.

### 4. The customer's own email (Jack's option 2, after the review)
- **Migration 084:** `customers.email_from_customer BOOLEAN NOT NULL DEFAULT false`.
- **Set true:** by the online booking's update of the customer's email, and
  by the online sign-up and code sign-in inserts.
- **Cleared:** by the staff edit (`PUT /api/customers/:id`) when the email
  changes. The same email in another case keeps it.
- **The join** requires it.

### 5. The review's other fixes
- **Other websites:** a `job-` request that isn't a GET, from another site
  (`Sec-Fetch-Site` not same-origin or none), answers 403.
- **The shop check:** compared with the shop the dispatcher bound
  (`app.current_shop_id`), not with the address re-read.
- **The attempt limit:** a `job-` request is checked before the private
  links' attempt limiter, which counts only a refusal.
- **Caching:** `job-` answers are `Cache-Control: no-store`, a quote photo
  included.

## Risks

- **Joining the wrong person:** two people sharing an email. Jack accepted
  this risk. It's limited to exactly one match with no account.
- **Opening someone else's job:** the shop and customer checks, with tests
  for another customer, another shop and no session.
