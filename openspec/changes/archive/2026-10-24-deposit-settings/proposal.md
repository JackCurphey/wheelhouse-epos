# Proposal: the shop's deposit settings

## Why

Jack's 24 Oct answers (`docs/decisions/2026-10-24-morning-questions.md`
answers 1–5) and 23 Oct answer 2 (`docs/decisions/2026-10-23-overnight-questions.md`:
deposits built now, behind a pretend payment provider) start online deposits.
Before a customer can pay one, the shop has to be able to say whether it
takes a deposit and how much: the Deposits part of Settings › Workshop ›
Online booking (`bk-settings-deposits`). This is the first of four pieces:
this one (the settings and the amount), then paying it when booking, then
refunds on cancelling and declining, then the diary job's deposit (drawn
first for Jack's approval).

WP-4.4 (deposits) in the build plan, taken by Jack (`.agents/STATUS.md`).
**Risky area: a migration** (069), so `/review` runs before merging. It
touches no money moving yet; the amount is only worked out.

## What Changes

- Settings › Workshop › Online booking gets the drawn **Deposits** part:
  "Take a deposit when booking", "Deposit" (A fixed amount / A percentage of
  the price), "How much", "If the price isn't known", "Free to cancel until …
  hours before", and the note about a declined request's refund. The fold's
  summary says "deposit [n]%" (`settings-frame.mjs` line 192).
- The server keeps those settings (migration 069) and works out a booking's
  deposit: the percentage of the shown price, several services added first,
  a "from" price used as it stands, rounded to the nearest penny (answer 1).
- Deposits can only be switched on while a payment provider is connected
  (`website.mjs` line 440: "booking deposits are off, until you connect
  [payment provider]"); here, the pretend one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `settings`: the shop sets whether it takes a deposit when booking, and how
  much.

## Out of scope

- "For: Every booking / Chosen services (choose on each service)": the new
  app has no service editor yet; every booking takes the deposit until it does.
- Paying, refunding, the booking page's deposit lines, the diary job's
  deposit, and the till's deposit (after #404, answer 4).
- A real payment provider (Stripe), which waits for Mark's account.

## Impact

`server/migrations/069_deposit_settings.sql`, `server/routes/workshop-settings.js`,
a new `server/workshop/deposit.js` and `server/payments/provider.js`,
`src/screens/settings/settings-page.tsx`, tests.
