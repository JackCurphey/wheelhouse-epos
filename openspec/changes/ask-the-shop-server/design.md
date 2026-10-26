# Design: "Ask the shop a question", the server

Follows `docs/decisions/2026-10-26-day-answers.md` sections 2 and 8 and the
approved drawing (`account.mjs`: `conversationPage`, `ac-ask`,
`ac-account-question-sent`, `ac-question`, `ac-account-asked`; the inbox
`ac-inbox*` is redrawn by the screens change).

## 1. Storage: `job_notes` holds both kinds (migration 087)

A message is a row in `job_notes`, as a repair note already is:

- `workshop_job_id` becomes optional; `customer_id` (to `customers`, removed
  with the customer) is added;
- a check says exactly one of the two is set: a **repair note** has the job,
  a **general message** has the customer;
- an index on `(shop_id, customer_id, id)` for general messages.

A repair note's customer is still read through its job, never copied onto the
note, so moving a job to another customer (or merging customers) moves its
notes with it and nothing can disagree. Existing notes are untouched and the
repair page's routes read them exactly as before. Row-level security is the
table's own, unchanged.

Why not a new table: the conversation is one list ordered by time across
both kinds, the inbox already reads `job_notes`, and the rule "needs a reply
while the customer spoke last" is the same for both. One table keeps that one
query.

Merging customers moves general messages (`job_notes` joins the merge's
`MOVED` list, so Undo puts them back too).

## 2. The customer's conversation

`GET /api/portal/:shopSlug/messages` and `POST /api/portal/:shopSlug/messages`:

- signed in at this shop only (`401 { error: 'Not signed in' }` otherwise,
  including another shop's session);
- `Cache-Control: no-store` on every answer;
- the `POST` is refused from another website (`sec-fetch-site` not
  `same-origin` or `none`): `403 { error: 'This can only be done from the shop’s own pages' }`,
  checked first, as the `/bikes` `POST` does;
- the `POST` body is `{ text }`: trimmed, 1 to 1,000 letters, else
  `400 { error: 'Write a message of up to 1,000 letters.' }`. It adds a
  general message from the customer. A customer adds a note to a repair from
  the repair page, as now.

Both answer (`200`, or `201` after a `POST`):

```json
{
  "shopName": "North Street Cycles",
  "items": [
    { "id": 1, "fromCustomer": true, "from": "You", "text": "…", "at": "2026-09-01T09:00:00.000Z",
      "about": { "jobId": 42, "reference": "WH-1042" } },
    { "id": 2, "fromCustomer": false, "from": "North Street Cycles", "text": "…", "at": "…", "about": null }
  ]
}
```

Oldest first, by time. `about` is the repair a note belongs to, `null` for a
general message; the screen links it to the repair's page by `job-<jobId>`
(`/book/:shopSlug/booking/job-<jobId>`), which opens for its signed-in owner.
The shop's `from` is the shop's name, with the staff member's name in front
("Jo Taylor, North Street Cycles") only when the shop shows who signed off to
customers, as on the repair page. Every repair of the customer's at this shop
is included, however old.

**The conversation page's address is `/book/:shopSlug/messages`.** The reply
message links there; the screen sends a signed-out customer to sign-in first
and back.

## 3. The account's history

`GET /api/portal/:shopSlug/history` gains, when the customer has any message
or note, one item:

```json
{ "kind": "messages", "at": "<newest message's time>", "shopReplied": true }
```

`shopReplied` is true when the newest message is the shop's ("North Street
Cycles replied", Replied), false when it is the customer's ("waiting for a
reply", Sent). It sorts with the rest by `at`.

## 4. The staff inbox, one conversation per customer

Staff routes (any signed-in staff member, the shop's own customers only;
another shop's customer is `404 { error: 'Customer not found' }`):

- `GET /api/customer-conversations?filter=needs-reply|all` (anything else is
  All):

  ```json
  { "count": 1, "items": [
    { "customerId": 7, "customerName": "Maya Patel", "lastText": "…", "lastAt": "…", "needsReply": true,
      "about": { "jobId": 42, "reference": "WH-1042", "bikeLabel": "Trek Domane AL 3" } }
  ] }
  ```

  One row per customer with any message or repair note; `about` is the
  newest message's repair, `null` when it is a general message. Needs a reply
  while the newest message is the customer's; waiting first, then newest.
  `count` is how many need a reply. A note on a job with no customer is in no
  conversation (it stays on the job's own page).
- `GET /api/customer-conversations/:customerId`:
  `{ customerId, customerName, phone, items }`, `items` as in design 2 but
  with `from` the staff member's name (or `null`) for the shop's messages and
  `null` for the customer's, and `about` carrying `bikeLabel` too. `404` when
  the customer isn't found; a customer with nothing yet has an empty
  `items` list.
- `POST /api/customer-conversations/:customerId/messages` with
  `{ text, jobId? }`, 1 to 1,000 letters:
  - with `jobId`, a repair of this customer's (else `404 { error: 'Job not found' }`):
    exactly what `POST /api/workshop-jobs/:id/notes` does (a note on the
    repair, "Reply from the shop" linking to the repair page, nothing sent
    while the repair's page has closed);
  - without, a general message from the shop, and "Reply to a message" is
    queued the customer's chosen way, linking to `/book/:shopSlug/messages`.

  Answers `201 { items, message }`, `message` as the job reply's:
  `{ status: 'sent', channel, to, pretend: true }` or
  `{ status: 'not_sent', reason }` (switched off, or no phone or email).

Today's "Customers' messages waiting" line counts these conversations.

## 5. What changes for the screens

- **Inbox** (`src/screens/messages/messages-page.tsx`):
  - list: `/api/job-notes/conversations` → `/api/customer-conversations`;
    key rows by `customerId` (`?customer=` in the address instead of
    `?job=`); the row's second line from `about` (bike and reference, or the
    general-message wording the redrawn row shows);
  - thread: `/api/workshop-jobs/:id/notes` → `/api/customer-conversations/:customerId`,
    marking each repair note with `about.reference`; the header's phone comes
    with the thread;
  - reply: `POST /api/customer-conversations/:customerId/messages`, the
    answer's `items` (was `notes`) and `message` as before. The reply is
    about the repair of the customer's newest message (send its
    `about.jobId`), or general when that was a general message;
  - "See the text … gets" reads `/api/messages?jobId=` for a repair reply;
    for a general reply the newest `message_reply` is in the customer's
    messages (`/api/customers/:id/texts` excludes only receipts);
  - then delete `GET /api/job-notes/conversations` and `conversations()`.
- **Account** (`src/customer/`): the "Messages with [shop]" row from the
  `messages` history item; the conversation page at `/book/:shopSlug/messages`
  reading and posting `/api/portal/:shopSlug/messages`.
- **Settings › Messages** lists "Reply to a message" with the others.

## 6. Signed in for 30 days from the last visit

`getCustomerSessionContext` renews a session used with less than 29 days
left: `expires_at` becomes now plus 30 days. So it writes at most about once a
day per device, not on every request. `currentCustomerSession(req, res)`
then sets the cookie again with its full 30 days (the cookie's own
`Max-Age` would otherwise end it 30 days after sign-in). Every portal route
passes `res`. An expired session is still deleted and refused.

## 7. "Reply to a message"

Key `message_reply`, in `TEMPLATES` and `LIVE_KEYS`:

- name "Reply to a message", when "When staff reply to a customer’s message";
- wording "[Shop name] replied to your message: [Link to your messages]";
- subject "[Shop name] replied to your message";
- tap-ins Shop name, Link to your messages.

The link is the page's address (it needs sign-in, so nothing is issued for
it). While sending is pretend it reads "[link]", as every message's link
does (`messageLink`). Settings' preview shows "[link]".
