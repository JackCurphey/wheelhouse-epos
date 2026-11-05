# Design

## 1. Where the key lives

`sales.request_key_hash` and `request_body_hash`, nullable, with a partial unique index per business, as `deliveries` has. `request_job_warning` holds what the first answer to an order's payment warned about, so a repeat gets the same answer. Nullable columns need no rewrite; the index reads the table once under a lock that blocks writes: 212 ms for the migration on 1,000,000 made-up sales, with a write waiting 58 ms at most.

## 2. A sale

In one transaction: the stock limit (`limitLockWait`), an advisory lock on the key so two sends at once queue, look for the key, then either answer or make the sale and store the key on it, and reply after `COMMIT`.

| Sent | Answer |
|---|---|
| A key not seen | 201, the sale |
| The same key and details | 201, the first sale, changing nothing |
| The same key, different details | 409 `reused_key` with `saleId`, saying the sale was recorded |
| A refused or failed attempt, then the same key | as new: nothing was kept |
| No key | as before |

Details means everything sent but the key, as `readRequestKey` hashes it.

## 3. An order's payment

The order's row is already locked first. The key is stored on the sale it makes. If the order is already converted and the sale it points at has this key and these details, that's a lost answer: 201 with the first sale and its warning, and nothing moves, so the till carries on to its usual after-paid step. Anything else on a converted order stays `already_converted`, which is now true to say: it was someone else's payment, or this one with different details.

## 4. The till

The key belongs to the sale on the till, not to one press: `TillPage` holds it and passes it to `PayDialog`, so Back, another payment method, or closing and reopening the dialog keep it. Next sale and Clear start a new one. If the basket really changed after a lost answer, the server's 409 says the sale was recorded. A job's payment keeps one key for as long as its page is open.

`reused_key` shows the server's words with no reversal advice, as the sale exists. A reload loses the key: known, and logged.

## 5. The old till

Simple enough to include. One key for the sale in progress, replaced on success or on a `reused_key` refusal, as that sale is done with. Each order's Convert box has its own. No browser test drives the old app, so this is checked by a source test only, as the old app's others are; it's a placeholder to be deleted.

## 6. Keys are kept with the sale

A key is only ever looked up by its own hash, within one business, so there's nothing to clear. Row-level security applies to the look-up, and the unique index includes `shop_id`, so one business's key says nothing about another's.
