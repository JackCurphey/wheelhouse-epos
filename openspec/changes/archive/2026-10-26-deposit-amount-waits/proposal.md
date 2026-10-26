# Proposal: How much waits while the kind of deposit is saving

## Why

Settings › Workshop › Online booking › Deposits (`bk-settings-deposits`;
Jack, 24 Oct, `docs/decisions/2026-10-24-morning-questions.md`) saves "A fixed
amount" or "A percentage of the price" as soon as it's picked. Until the
server answers, the "How much" box on screen is still the percentage one, and
it can be typed in. On a slow connection an Owner who picks "A fixed amount"
and types 15 straight away saves 15% instead of £15; the £ box then appears
empty and the fold says "no deposit". The same race made the browser test
`tests/browser/deposit-settings.spec.ts` fail about half the time.

## What Changes

- While the deposit switch or the kind is saving, the "How much" box is
  greyed out (disabled), as the switch and the two kind buttons already are.
  It comes back once the answer arrives, as the box for the kind picked.
- No change to the drawing's look or wording.

## Capabilities

### Modified Capabilities

- `settings`: the deposit requirement gains a scenario for picking the kind
  and typing straight away.

## Touches

Screens only (`src/screens/settings/settings-page.tsx`). No risky area: no
migration, no money or stock code (it's a setting, not a payment), no
sign-in, no `server.js`. Taken by Jack, as a fix to `deposit-settings`.

## Out of scope

- The other two deposit boxes ("If the price isn't known", "Free to cancel
  until") don't depend on the kind and are left as they are.
- The server's save reads the settings and writes them back without a lock,
  so two saves sent at the same moment could lose one; not changed here.
