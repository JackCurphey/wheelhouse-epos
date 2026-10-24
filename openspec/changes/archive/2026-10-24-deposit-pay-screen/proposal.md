# Proposal: paying the deposit on the booking page

## Why

Part 2b of online deposits (Jack, 24 Oct answers 1–5; 23 Oct answer 2).
2a (`deposit-payments`, #455) holds a booking's deposit and takes it once the
booking is saved; this is the customer's side of it on step 4, as drawn in
`bk-details-deposit`, `bk-card-failed` and `bk-checking-payment`
(`book.mjs` lines 196–216, 409–414). The booking page's later lines ("Deposit
paid", "Free to cancel until", `bk-request-deposit`) are 2c.

WP-4.4 (deposits), Jack. **Risky area: money** (it sends the payment the
booking needs), so `/review` runs before merging. No migration.

## What Changes

- Step 4 shows the drawn deposit part when the shop takes one: "Deposit ·
  £[deposit]", "We take the deposit now, and it comes off the bill when you
  collect. **If the shop can't fit you in, it comes back in full** within 5 to
  10 working days." (answer 5), "Free to cancel until [date and time]. After
  that, or if you don't come, the shop keeps it.", and the card form.
- The card form is the pretend provider's stand-in for "[The payment
  provider's secure card form]": a Card number box, saying plainly that it's
  pretend, nothing is taken, and which test numbers to use.
- The button reads "Pay £[deposit] and send request" ("Pay £[deposit] and
  book" when the shop confirms automatically). Pressing it pays, then sends.
- A declined card: "The card didn't go through. Nothing was taken and nothing
  is booked yet. Try again, or use another card.", button "Try again".
- A dropped connection after paying: "We're checking whether your payment went
  through — please don't pay again. Your connection dropped while sending.
  Nothing will be taken twice.", button "Check again", which sends the same
  booking again without paying again.
- The summary box gains "Deposit to pay now £[deposit]".

## Capabilities

### Modified Capabilities

- `book`: the customer pays the shop's deposit on step 4 before the booking
  is sent.

## Out of scope

- The booking page after sending (2c), refunds (part 3), the diary job (part 4).
- A real provider's card form (Stripe's), which replaces the pretend one later.

## Impact

`src/screens/book/details.tsx`, `details-rules.ts`, `draft.tsx`, `send.ts`, a
new `deposit.tsx`; `server/routes/deposit-payments.js` (the hold's answer
adds the shop's hours); tests.
