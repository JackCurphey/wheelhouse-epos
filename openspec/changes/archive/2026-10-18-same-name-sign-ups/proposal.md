# Proposal: two shops with the same name signing up at once

## Why

Each shop gets a web address made from its name: "Till Cycles" becomes
`till-cycles`, and a second shop with that name gets `till-cycles-2`. The
app looked for a free address first and saved the shop after. When two shops
with the same name signed up at the same moment, both saw `till-cycles` as
free; the second sign-up then failed with a database error instead of
getting `till-cycles-2`. Found while fixing flaky tests (#249), where two
test runs creating "Till Cycles" at once hit exactly this.

## What Changes

- The shop is saved at the first address that is still free, one address at
  a time: if another sign-up has just taken an address, this one moves on to
  the next number instead of failing.
- Addresses still come out as before: the name, then `-2`, `-3` and so on.

## Lane, drawings and decisions

- **Work package:** none; a bug found while fixing flaky tests (#249).
- **Lane:** Mark's (server): `server/auth.js`. Jack's session wrote it while
  Mark is away; it needs Mark's approval (split plan §3).
- **Drawings:** none; no screen changes.
- **Decisions:** none touched.

## Out of scope

- How addresses are made from names (`slugify`) is unchanged.
- Choosing or changing a shop's address after sign-up.

## Impact

- `server/auth.js` (`createShop`), `tests/create-shop-same-name.test.js`.
- A new spec area, `shop-sign-up`, holding just this behaviour for now.
