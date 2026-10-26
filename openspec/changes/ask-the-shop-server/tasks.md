# Tasks

## 1. Tests first (each watched failing for the right reason)

- [ ] 1.1 `tests/migration-087.test.js`: from an empty scratch database, then
  onto one with a repair note; the note keeps its job; a general message
  needs its customer; a row with both or neither is refused; another shop
  sees none.
- [ ] 1.2 `tests/customer-conversation.test.js`:
  - the customer reads one conversation with their repair notes (marked
    with the repair) and their general messages, oldest first;
  - posting adds a general message; empty or over 1,000 letters refused;
  - signed out, another customer, another shop's session: 401 or only their
    own; from another website: 403 and nothing added; `no-store`;
  - the history's one `messages` item, and `shopReplied`;
  - the staff inbox: one row per customer, needs a reply, All, another
    shop's customer not found;
  - a staff general reply queues "Reply to a message" with its wording; a
    reply with `jobId` is a repair note and queues "Reply from the shop"; a
    job of another customer's is refused; switched off says so;
  - Today's line counts customers.
- [ ] 1.3 `tests/customer-session-renew.test.js`: a session with less than 29
  days left is renewed to 30 days and its cookie set again; one with more is
  not written; an expired one is refused and deleted.
- [ ] 1.4 `tests/messaging-templates.test.js`: `message_reply` is live, with
  its wording.

## 2. Build

- [ ] 2.1 Migration 087 (design 1); merging customers moves general messages.
- [ ] 2.2 `server/workshop/job-notes.js`: general messages, the customer's
  conversation, the per-customer inbox.
- [ ] 2.3 The portal routes and the history item (design 2 and 3).
- [ ] 2.4 The staff routes, sharing the repair reply with the job notes
  route; Today counts customers (design 4).
- [ ] 2.5 "Reply to a message" (design 7) and Settings' preview example.
- [ ] 2.6 Session renewal (design 6).
- [ ] 2.7 Route list, screen-trace comments, `decided-while-building.md`.

## 3. Check

- [ ] 3.1 Break each key rule on purpose and watch its test fail: another
  customer, another shop, another website, the reply's message, renewal and
  expiry.
- [ ] 3.2 The touched tests, the route list, owner-only, the portal, messages
  and inbox tests, and `npm run lint` pass. The full `npm test` and
  `npm run test:browser` run before the pull request, with `/review`
  (migration, sign-in and public routes, messaging core).
