# Proposal: the till's Email receipt button

## Why

The till's Paid box is drawn with Email beside Print (`till-receipt`,
`till.mjs:286-289`). Email opens "Email the receipt" (`cp-receipt-address`,
`collect.mjs:226-248`). Jack decided the email side first (#443) and the
till's button after Mark's sales in pence (#404), which has merged
(`docs/decisions/2026-10-23-overnight-questions.md` item 3). Also decided
(`2026-10-02-leftover-screens-review.md`, M1): "the till's next-sale countdown
stops while the receipt pop-up is open, the cursor starts in the box and Enter
sends". Jack's lane. The server route exists (`POST /api/sales/:id/email-receipt`)
and sends are still pretend.

## What Changes

- The Paid box gains **Email**, between Print and No receipt (or Start next
  sale with "Don't close things by themselves" on).
- **Email** opens "Email the receipt" with "Sale [n] · [customer]" or "· no
  customer on this sale". The "Email address" box starts with the cursor in
  it, and Enter sends.
  - For a workshop job's customer, it's filled from their record, with "From
    [first name]'s customer record. A change here is used for this receipt
    only."
  - A bad address reads "That doesn't look like an email address — check it".
- While it's open, the countdown stops, and Paid says "Next sale waits until
  the receipt is sent".
- **Sent:** the next sale starts, as drawn. With "Don't close things by
  themselves" on, Paid stays open and says it was sent.

## Capabilities

### Modified Capabilities

- `till`: the Paid box can email the receipt.

## Out of scope

- **Text**, drawn in the same row: there's nothing on the server to text a
  receipt yet.
- **"Save to a customer record"** and its "Add a customer" pop-up: a piece of
  its own, because the till can't add a customer yet.
- **Offline** ("Send when back online"): the till has no queue for it yet.

## Impact

`src/screens/till/pay-dialog.tsx`, a new `src/screens/till/email-receipt.tsx`,
`src/screens/till/till-page.tsx` (the job's customer), tests. No server
change. **Risky area:** the till's Paid box (money), so `/review` runs.
