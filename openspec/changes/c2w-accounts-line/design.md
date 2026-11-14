## Context

`buildSummary` in `server/accounts/summary.js` adds up a closed day's payments from both sales records and files each by `moneyBucket(tender)`: cash, card, online (Shopify and the deposit paid online), customer accounts (any tender naming an account), and Gift cards for everything else. A Cycle to Work hand-over records the provider share as a payment with tender "Cycle to Work · [provider]" (`C2W_TENDER`, `server/c2w/hand-over.js`), so it fell to Gift cards. `accountLines()` in `server/accounts/lines.js` lists the lines a shop chooses accounts for. `GET /api/accounts` counts recorded lines with no choice, and `sendClosedDay` holds a day back when a line it uses has no choice. Choices are rows in `accounts_choices (shop_id, provider, line_key, ...)`.

## Goals / Non-Goals

**Goals:** Cycle to Work money goes to its own line, "Cycle to Work (owed by providers)", in the summary and in the account choices (Jack, 14 Nov, merge-c2w Q1 option 2).

**Non-Goals:**
- Commission and shortfall lines (cycle-to-work spec, still that change's).
- Any change to days already sent.
- Any screen code change.

## Decisions

1. **`moneyBucket` returns `c2w`** for a tender that, trimmed and lower-cased, starts with "cycle to work · ", the same test `hand-over.js` uses. It is checked before the "account" test, so a provider named "… Account" still goes to Cycle to Work.
2. **The line is `money:c2w`, "Cycle to Work (owed by providers)"**, listed after Gift cards and before Online sales. The drawing lists it after Gift cards and has no online row, so the built online row stays last.
3. **No migration.** A new line key is new rows only. A connected shop is told one more line needs an account, through the existing "No Xero account chosen" pattern. No existing row or sent day changes, so the 14 Nov rule about database changes that alter existing data doesn't apply.
4. **Recorded and required like the other money lines** (`recorded: true`): a day with Cycle to Work money waits for its account, as a day with online money does.

## Risks / Trade-offs

- A shop that has chosen every account sees "1 line needs an account" after this change. Before any shop uses real accounts software (the service is a pretend one until Jack says yes), this affects test data only.

## Contract

`GET /api/accounts`: the "money" group's lines are Cash, Card, Customer accounts, Gift cards, Cycle to Work (owed by providers), Online sales (paid on the website). `PUT /api/accounts/choices` accepts `money:c2w`. A sent summary's lines may include `{ key: 'money:c2w', label: 'Cycle to Work (owed by providers)', group: 'money' }`. No field is added or removed.
