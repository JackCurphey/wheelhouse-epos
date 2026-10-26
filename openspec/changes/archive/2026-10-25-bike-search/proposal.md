# Proposal: finding a bike in the header search

## Why

Jack's answer of 15 Oct (`docs/decisions/2026-10-08-not-drawn-pages.md:109-122`,
#7 and #8): the header search "can open [a bike's page] directly, since it
finds bikes and frame numbers" (second walk 12; stage 1 gaps 22). The bike's
page was built in `bike-page`; this is that change's second pull request.

## What Changes

- **`GET /api/search`** also returns `bikes`: up to five of the shop's bikes,
  by make and model or frame number, each with who owns it.
- **The header search** lists them in a Bikes group after Customers. Each one
  links to the bike's page, showing its owner, colour and frame number under
  it. The count includes them.
- The box's name says what it finds: "Search jobs, customers and bikes".

## Capabilities

### Modified Capabilities

- `header-search`: it finds bikes.

## Out of scope

- Orders and products. They join the search as they're built, as before.
- Removed bikes. They aren't found, just as removed customers aren't; their
  page still opens from the customer's history.
