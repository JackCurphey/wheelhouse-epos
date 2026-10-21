# Proposal: a quote always shows its prices

## Why
Jack, 21 Oct (`docs/decisions/2026-10-21-quote-prices.md`): a quote shows its
prices even when "Show prices on the booking page" is off, because the
customer is approving an amount. The spec didn't say so.

## What changes
- The shop-details spec says the switch never hides a quote's prices.
- A test pins it. The app already behaves this way; no app code changes.

Not one of the four risky areas.
