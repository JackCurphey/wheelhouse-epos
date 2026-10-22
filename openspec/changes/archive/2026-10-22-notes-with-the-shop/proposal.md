# Proposal: notes with the shop, the server

## Why
WP-4.5's first part, in Jack's order (22 Oct): "the booking-page note and
the inbox only". Decision 3 and 7 (`docs/decisions/2026-10-01-account-and-reminders-review.md`):
conversations on the website, replies the way the customer chose with a link
back, and a two-pane staff inbox with "Needs a reply". Drawn in
`generator/account.mjs`: the booking page's "Notes with the shop"
(ac-job-note, -sent, -answered), the inbox (ac-inbox, -sent, -all, -list,
-empty) and the text the customer gets (ac-reply-text). The first of three
pieces: this one is the server; the customer's card and the staff inbox
follow.

## What changes
- **Migration 061**: `job_notes`, one row per note or reply on a job (the
  customer's, or a member of staff's), with the shop's row-level security.
- **Customer, no sign-in** (the booking link's code is the key):
  `GET …/booking-links/:code/notes` reads the job's notes; `POST
  …/booking-links/:code/notes` adds one (up to 1,000 letters).
- **Staff**: `GET /api/job-notes/conversations?filter=needs-reply|all` lists
  a conversation per job, newest first, with whether it needs a reply;
  `GET /api/workshop-jobs/:id/notes` reads one; `POST
  /api/workshop-jobs/:id/notes` replies, and tells the customer with the
  drawn "Reply from the shop" text, the way they chose (pretend for now).
- **Messages**: "Reply from the shop" (`shop_reply`), the drawn wording.

## Not in this change
The screens (the next two pieces); questions from a customer's account;
"2 messages need a reply" on Today (WP-1.10).

## Risky areas
A migration, a public route (`/api/portal/*`) and the messaging core. Reviewed.
