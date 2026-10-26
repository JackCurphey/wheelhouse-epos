# Design: adjust stock, with a reason and who

## Decisions

1. **Migration 089** adds `stock_movements.reason TEXT` (null, or one of
   `damaged`, `lost_stolen`, `used_workshop`, `faulty_return`, `found`,
   `other`, held by a check) and `stock_movements.login_id INTEGER
   REFERENCES logins(id)` (null for lines before it, and for sales and till
   sync, which this piece doesn't touch). `note` already exists.
2. **The reasons follow the sign.** Going down: Damaged, Lost or stolen,
   Used in the workshop, Faulty — to return to supplier, Other. Going up:
   Found, Other. A reason that doesn't fit the sign, an unknown one, none,
   or Other with no note, is refused with 400 and nothing changes.
3. **One atomic update.** `UPDATE products SET stock_qty = stock_qty + ?
   … WHERE id = ? AND (? > 0 OR stock_qty + ? >= 0) RETURNING stock_qty`,
   then the movement row, inside one BEGIN/COMMIT. Two adjustments at once
   both count, and the below-zero check is made on the row as it is when
   the update runs. Going down below zero is refused, as before; going up
   is always allowed, so Found works on a product that's below zero.
4. **Owner only** (`ownerOnly`) until roles (WP-1.1); the button shows to
   the Owner only. The old app's "intake" (booking stock in) through the
   same route needs no reason; it records who too.
5. **The box** (`st-adjust`): the change, with − and +, starting at −1 as
   drawn, and "In stock after" joined to it (typing either sets the other);
   the reasons as radio pills, none picked; a Note; Cancel and Adjust.
   Adjust is greyed (`aria-disabled`) and says why: "Pick a reason to
   adjust", "Type the change", "Write a note for Other", or "Stock can’t go
   below zero". After Adjust the box closes and the page reloads its stock
   and history.
6. **History lines:** an adjustment with a reason reads "Adjusted ·
   [reason]", and its note as "Note: [note]"; every line with a who shows
   the name before when.

## Contract

`POST /api/products/:id/stock` `{ change, type: 'adjustment', reason, note }`
→ 200 the product; 400 `{ error }`; 403 for anyone but the Owner.

`GET /api/products/:id` → history lines
`{ id, type, change, reason: string | null, note, who: string | null, at }`.
