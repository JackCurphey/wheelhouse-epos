# Design: Shop details

## Contract

- `GET /api/shop-details` → `{ name, address, phone, email, vatNumber }` for the signed-in shop; the four details are `null` until set.
- `PUT /api/shop-details` with any of those fields. Text is trimmed; blank clears a detail to `null`. The name can't be blank ("The shop needs a name"). Limits: name 120, address 300, phone 40, email 200, VAT number 30 characters. A field left out keeps its value. The reply is the same shape as GET.

## Data (migration 042, additive)

```sql
ALTER TABLE shops ADD COLUMN address TEXT, ADD COLUMN phone TEXT, ADD COLUMN email TEXT, ADD COLUMN vat_number TEXT;
```
`shops` is the tenant table (no row security); the routes read and write the row of the session's shop. When WP-1.4 adds per-site details, address and phone copy onto the first site and the VAT number stays here.

## Screens

- **Settings:** a "Shop and sites" section above Workshop, with a "Shop details" box: five labelled inputs as drawn, the drawn note, each saved when it loses focus if it changed ("Saved." / "Wheelhouse couldn’t save that. Try again in a moment."). A new name refreshes the session so the app shows it.
- **Receipt:** `ReceiptProps.details` (`address`, `phone`, `vatNumber`). Top: name, "Sale [n]", date and time. Bottom, after "Paid by": the details present, then the barcode.
- **Till and diary:** read `['shop-details']` and pass it to the receipt.
