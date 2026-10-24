# Proposal: "Save to a customer record" from the till's Email receipt

## Why

The till's "Email the receipt" pop-up, with no customer on the sale, is
drawn with a tick "Save to a customer record" (`cp-receipt-address`,
`collect.mjs:233`, `:243`). Ticked, a quick "Add a customer" follows once
the receipt has gone (`cp-receipt-address-save`, `collect.mjs:247-249`).
Jack's decision (`docs/decisions/2026-10-02-leftover-screens-review.md`
decision 3): "a tick, 'Save to a customer record', starts unticked and, if
ticked, opens a quick 'Add customer' with it filled in. Nobody joins the
customer list without agreeing." The Email button itself is #472. Jack's
lane.

## What Changes

- **The tick.** With no customer on the sale, "Email the receipt" has the
  tick "Save to a customer record", with "Leave this unticked and we'll use
  the address for this receipt only." It starts unticked.
- **Add a customer.** Ticked, once the receipt is sent, "Add a customer"
  opens with "Receipt sent to [address]" and:
  - Name ("First and last name"), Email (filled in) and Phone (optional);
  - "Happy to hear about offers", "Only if they say yes. Off to start.",
    unticked;
  - "'Not now' keeps the receipt sent and adds no one.";
  - Not now and Add the customer.
- Add the customer saves them (`POST /api/customers`), then the till carries
  on as after a sent receipt. Not now carries on and adds no one.

## Capabilities

### Modified Capabilities

- `till`: a receipt's address can be saved as a new customer.

## Out of scope

- Attaching the new customer to the sale: not decided, and nothing attaches
  a customer to a finished sale yet. Logged for Jack.
- The Text button's own tick, which waits with Text.

## Impact

`src/screens/till/email-receipt.tsx`, tests. No server change. Depends on
#472 (the Email button).
