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

Details means everything sent but the key, in any order of fields (`anyFieldOrder`, for these two routes only, so a booking's stored hashes don't change). A line's position in the list counts.

## 3. An order's payment

The order's row is already locked first. The key is stored on the sale it makes. If the order is already converted and the sale it points at has this key and these details, that's a lost answer: 201 with the first sale and its warning, and nothing moves, so the till carries on to its usual after-paid step. Anything else on a converted order stays `already_converted`, which is now true to say: it was someone else's payment, or this one with different details. On an open order, a key already on another sale or order is refused as a sale's is, with nothing paid. The order queues on its key after its own row, as a sale queues before its products, so neither waits on the other's lock and two sends with one key can't both go in.

## 4. The till

The key belongs to the sale on the till, not to one press: `TillPage` holds it and passes it to `PayDialog`, so Back, another payment method, or closing and reopening the dialog keep it. It goes with the basket: however the basket empties, the next sale has a new one, except that while the last answer is lost (what `pay-dialog` calls "Lost touch": no answer at all), removing every line by hand keeps it, so correcting a one-line sale can't record it twice. Clear, Next sale, a sale going through and a refusal end that; busy, a server fault and `reused_key` don't, as they don't say the sale isn't there. If the basket really changed after a lost answer, the 409 says the sale was recorded and how to get out: close the box (the drawn ✕, which wasn't built) and press Clear. A job's payment keeps one key for as long as its page is open.

`reused_key` gives no reversal advice, as the sale exists. A reload, or Clear, after a lost answer loses the key: known, and logged.

## 5. The old till

Simple enough to include. One key for the sale in progress, replaced on success or when the basket's emptied (checked where the basket's drawn, so every route to empty counts). A refusal keeps it, or the next press would make a second sale; the toast says the sale was recorded, and emptying the basket gets out. Each order has its own key, by its id, and each Convert box too. No browser test drives the old app, so `tests/old-app-sale-key.test.js` runs its payment functions with everything around them stubbed.

## 6. Keys are kept with the sale

A key is only ever looked up by its own hash, within one business, so there's nothing to clear. Row-level security applies to the look-up, and the unique index includes `shop_id`, so one business's key says nothing about another's.
