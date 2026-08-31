# Workshop service catalogue and labour lines — design

**Date:** 31 August 2026
**Status:** design agreed, not yet planned or implemented
**Catalogue entries closed:** JOB-12 (labour lines), JOB-13 (service menus)
**Catalogue entries affected:** BOOK-04 (Partial → Have), CAL-05, CAL-07

## Why this exists

A bike shop cannot bill for its own time. Today labour can only be faked as a
product row — a product with `category = 'Services'` — and that fake is broken
on the server: `createSale` decrements `stock_qty` and writes a
`stock_movements` row for a Services product exactly as it would for a chain.
So a shop either invents stock for its labour or the sale fails at tender.

Nothing customer-facing works around this. The catalogue names JOB-12 as one of
three features gating the most: no invoice (DONE-04), no itemised pricing
(DONE-03), no estimate (INS-03) without it.

## What was decided

Five decisions, taken 31 August 2026, in the order they were asked.

1. **A labour line is a typed price, not a computed one.** The shop types what
   the work costs. Time is recorded alongside it but never multiplies out to
   the price. There is no hourly-rate concept anywhere in this design.
2. **Prices come from a per-shop saved service catalogue.** A shop defines
   "Standard service £55, 60 min" once and picks it at the bench. A one-off
   line can still be typed freehand.
3. **A service's duration sizes the diary slot and drives online booking.**
   The same list the shop prices from is the list a customer books from.
4. **A job line snapshots name, price and minutes, and also keeps
   `service_id`.** History is frozen on the line, so repricing a service never
   rewrites a past job; the link survives for reporting. Services therefore
   deactivate rather than delete.
5. **Existing `category = 'Services'` products convert by shop-initiated
   import.** Nothing changes under a shop's feet, and no historical sale line
   is rewritten.

### Consequences recorded deliberately

- **JOB-13 stops being a separate feature.** The catalogue lists it as
  depending on JOB-12; decision 2 builds it. Issue #16's answer for JOB-13
  changes accordingly.
- **BOOK-04 goes Partial → Have** via decision 3. It is Partial today only
  because job types and durations are fixed in code rather than per shop.
- **The Services stock bug survives this work.** Decision 5 chose import over
  fixing `createSale`'s treatment of Services-category products, so until a
  shop runs the import the live defect persists. It needs its own issue; it is
  explicitly not closed here.
- **Internal pricing becomes customer-visible.** Decision 3 puts the service
  list on the public booking page. Which services are offered online, and under
  what name, must be per-service choices — not automatic.

## Scope of this document

This design covers the first sub-project only: **0 + A + B**.

| | Piece | In this spec | Depends on |
|---|---|---|---|
| 0 | Fix `testShop.js` teardown | Yes — prerequisite | — |
| A | Service catalogue: table, RLS, management screen | Yes | 0 |
| B | Labour lines on job orders | Yes | A |
| C | Duration sizes the diary slot | No — own spec | A |
| D | Service list drives public booking (BOOK-04) | No — own spec | A |
| E | Import existing Services products | No — own spec | A + B |

0 → A → B is the spine: nothing bills labour until B lands. C, D and E are
independent of each other once A exists and are named here so they are not
lost, not because they are deferred indefinitely.

## The ground this is built on

Verified against the code on 31 August 2026, not taken from the plan.

- **`sale_document_items.product_id` is already nullable**
  (`server/migrations/001_init_schema.sql:275`), as is `sale_items.product_id`
  (`:233`). The line already snapshots `name`, `sku`, `unit_price`, `qty`,
  `line_total` as its own columns. The table shape needs very little.
- **`qty` is `INTEGER`** on both tables (`:237`, `:279`). Decision 1 means this
  never needs to change: a labour line is `qty = 1`.
- **Three write paths hard-require a valid active product** and are near
  identical: `server/server.js:1457` (`createSale`), `:1760`
  (`POST /api/sale-documents`), `:1865` (`PUT /api/sale-documents/:id/items`).
  A fourth at `:769` is the purchase-order path and is out of scope.
- **Stock deduction assumes every line has a product.** `createSale` rejects on
  `product.stock_qty < qty` (`:1461`), then unconditionally updates
  `products.stock_qty` and inserts a `stock_movements` row (`:1528-1533`).
  `stock_movements.product_id` is **`NOT NULL`** (`:292`), so a labour line
  reaching that loop is a constraint violation, not a soft bug. This is the
  load-bearing guard.
- **The job ↔ order link is `sale_documents.workshop_job_id`**, a nullable FK
  on the order side. Every job auto-creates a £0 placeholder order
  (`server.js:2176-2180`).
- **Parts are written through by full replace.** `PUT /api/sale-documents/:id/items`
  (`server.js:1849-1911`) deletes every line for the document and re-inserts
  the list. There is no add-one-line endpoint. Line IDs do not survive an edit.
- **VAT needs no work.** It is display-only, client-side, 20% inclusive
  (`public/app.js:95`). Labour inherits it.
- **The live staff UI is vanilla JS**, `public/app.js` (~7,000 lines,
  template-literal rendering with `data-*` delegation). The Vite/React/shadcn
  stack in `src/` is a scaffold with nothing built in it. This work targets
  `public/app.js`.
- **Migrations are forward-only plain SQL**, `NNN_snake_case.sql`, applied in
  filename order. **Next number is `014`.**
- **Tenancy is enforced by RLS, not by WHERE clauses.** Every shop-scoped table
  carries `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int`
  plus `ENABLE`/`FORCE ROW LEVEL SECURITY` and a `_shop_isolation` policy with
  both `USING` and `WITH CHECK`. Inserts never name `shop_id`.

### Two facts that shape the testing

- **There is no test coverage at all** for jobs, orders, `sale_documents`,
  `sale_document_items`, `createSale`, or any pricing logic. All 89 existing
  tests cover auth/team, Shopify sync, storefront, gateway headers and static
  caching. This work writes the first tests in the area.
- **`tests/helpers/testShop.js` cannot clean up an order.** `deleteTestShop`
  deletes `sale_documents` but never `sale_document_items`, so the first
  order-creating test leaks rows and then fails teardown on a foreign key. It
  also misses `sales`, `sale_items`, `stock_movements` and `workshop_settings`.
  This is why piece 0 exists.

## Piece 0 — fix the test helper

Not a feature. `deleteTestShop` in `tests/helpers/testShop.js` gains deletes
for `sale_document_items`, `sale_items`, `sales`, `stock_movements`,
`workshop_job_attachments` and `workshop_settings`, ordered so children go
before parents. `sale_document_items` must precede `sale_documents`, and
`sale_items` must precede `sales`.

Done when a test can create a shop, build an order with lines, tender it, and
tear the shop down cleanly — proven by a test that does exactly that and that
fails against the current helper.

## Piece A — the service catalogue

### Data

Migration `014_workshop_services.sql`.

```sql
CREATE TABLE workshop_services (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_services_shop ON workshop_services(shop_id, active);
ALTER TABLE workshop_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_services FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_services_shop_isolation ON workshop_services
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

`active` is `INTEGER` 0/1, matching `products.active` and `employees.is_mechanic`
on the ported-from-SQLite tables, because the surrounding SQL compares with
`= 1`. Decision 4 means services are deactivated, never deleted — a job line
keeps its `service_id` and must not dangle.

`minutes` is nullable: a service may be priced without a stated duration. The
columns that make a service publicly bookable (an online flag, a public name)
belong to piece D and are deliberately absent here.

### API

`GET/POST/PUT /api/workshop-services`, and `DELETE` mapped to setting
`active = 0`. Validation inline at the top of each handler in the house style:
trim the name and require it non-empty, price finite and `>= 0`, minutes either
absent or a positive integer. Failures return `badRequest(res, 'sentence')`.
Serialisation via a `serializeWorkshopService(row)` function returning camelCase.

### UI

A management screen in `public/app.js` under settings: list, add, edit,
deactivate. Follows the existing settings-screen patterns rather than
introducing a new one.

## Piece B — labour lines on job orders

### Data

Same migration `014`. Both line tables get the same three columns —
`sale_document_items` for the editable order, `sale_items` for the immutable
receipt written at tender:

```sql
ALTER TABLE sale_document_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;

ALTER TABLE sale_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;
```

Existing rows default to `'product'`, which is correct for every one of them.

Three CHECK constraints put the invariants in the database rather than trusting
three call sites to hold them, added to both tables:

```sql
ALTER TABLE sale_document_items
  ADD CONSTRAINT sale_document_items_line_type_valid
    CHECK (line_type IN ('product','labour')),
  ADD CONSTRAINT sale_document_items_labour_has_no_product
    CHECK (line_type <> 'labour'  OR product_id IS NULL)  NOT VALID,
  ADD CONSTRAINT sale_document_items_product_has_product
    CHECK (line_type <> 'product' OR product_id IS NOT NULL) NOT VALID;
```

**`NOT VALID` on the two `product_id` constraints is deliberate and
load-bearing.** A plain CHECK validates every existing row at migration time.
`product_id` has been nullable since `001` with nothing enforcing it, and
migrations here are forward-only with no down-migration — so a single legacy
row with a null `product_id` would abort the migration with no way back. All
three insert sites (`server.js:1524`, `:1790`, `:1889`) pass a fetched
product's id, so live data is very probably clean, but "probably" is not a
basis for an irreversible migration. `NOT VALID` enforces the rule on every new
and updated row while leaving history unscanned. A later migration can
`VALIDATE CONSTRAINT` once the existing rows have been checked in place.

The `line_type` constraint needs no such treatment: the column is created in
the same statement with a `DEFAULT 'product'`, so every existing row satisfies
it by construction.

A labour line is therefore: `line_type = 'labour'`, `product_id NULL`,
`service_id` set or null, `name` = the description, `sku` null, `unit_price` =
the typed price, `qty = 1`, `line_total = unit_price`, `minutes` optional.

`qty` stays `INTEGER` and stays 1. No numeric widening, and no rounding
exposure, because decision 1 means no price is ever derived from a division.

### Server

The three near-identical guards at `server.js:1457`, `:1760` and `:1865` are
extracted into one shared `loadDocumentLine(it)` that returns a normalised line
and throws `ValidationError`. The labour branch is then written once rather
than three times. This extraction is part of the work, not a separate refactor:
adding the branch three times is how the paths drift.

For a labour line it validates a non-empty description, a finite price `>= 0`,
minutes absent or a positive integer, and — if `serviceId` is given — that the
service exists and is active. Name, price and minutes are snapshotted from the
service at creation and are freely overridable, per decision 4.

In `createSale`, labour lines skip three things:

- the `stock_qty < qty` check (`:1461`)
- the `UPDATE products SET stock_qty` (`:1528`)
- the `INSERT INTO stock_movements` (`:1533`) — the `NOT NULL` violation

The return/refund path (`server.js:1611-1616`) has the same shape and needs the
same guard.

`serializeSaleDocument` (`server.js:1676`) gains `lineType`, `serviceId` and
`minutes` on each line, or the client never sees them.

### Client

Two independent line-editing UIs both need this, because the job modal and the
till cart are separate implementations of the same idea.

**Job modal** (`renderWjItemsList`, `public/app.js:6138`): an *Add labour*
control beside the existing add-part control. Pick a saved service or type a
one-off. The line renders with its description, price and — where set — its
minutes, visually distinct from a part.

**The till round-trip is the main risk in this piece.**
`loadOrderIntoCart()` (`public/app.js:1228`) rebuilds each cart line by looking
up `products.find(p => p.id === it.productId)`, which returns `undefined` for a
labour line, and the cart is re-serialised as only `{ productId, qty, unitPrice }`
at `:1036`, `:1324` and `:1379`. All four sites must carry `lineType`, `name`,
`serviceId` and `minutes` through, or a job order loaded into the till and
tendered silently turns its labour back into a broken product line. This is the
single most likely place for a defect and is covered by an explicit test rather
than a careful read.

`changeQty()` (`public/app.js:1253`) must not apply its stock cap to a labour
line. A labour line's quantity is not editable at the till; the price is edited
on the job.

The existing `category === 'Services'` special-casing (nine call sites in
`public/app.js`) is left alone, per decision 5.

## Testing

Test-first. Each test is watched failing for the right reason before the code
that satisfies it is written, and each is mutation-checked — the covered code
is deliberately broken to confirm the test goes red, and the mutation is
verified to have actually landed before it is reverted. A test that stays green
when its subject is broken is not testing it.

Runner is Node's built-in test runner (`npm test` → `node --test`), against a
live Postgres via `docker compose up -d --wait`, with `DATABASE_URL` pointing at
the non-superuser `epos_app` role — a superuser bypasses RLS and would silently
void every isolation assertion. `tests/team.test.js` is the pattern to follow.

Coverage:

- **Piece 0:** a shop with an order, lines, and a tendered sale tears down
  cleanly. Fails against the current helper.
- A service is created, listed, edited and deactivated; a deactivated service
  no longer offers itself for selection but an existing job line keeps working.
- A labour line saves, reloads and totals correctly on a job order.
- A labour line snapshots name, price and minutes from its service, and
  repricing the service afterwards does **not** change the saved line.
- **Tendering an order containing a labour line moves no stock and writes no
  `stock_movements` row.** The load-bearing test.
- **The job → till → tender round-trip preserves description, price,
  `serviceId` and minutes.** The round-trip defect test.
- A refund of a sale containing a labour line does not restock anything.
- The CHECK constraints hold: a labour line cannot carry a `product_id`, a
  product line cannot have a null one.
- Shop B can neither read nor modify shop A's services or labour lines (RLS),
  following the `tests/team.test.js` isolation pattern.

## Not in this piece

Named so they are not lost. Each gets its own spec.

- **C — duration sizes the diary slot.** Writes `workshop_jobs.end_time` from
  the service duration. Interacts with drag-and-resize (CAL-05) and with the
  overlap rules, which are browser-only for staff routes today (JOB-23 is
  Partial for that reason).
- **D — service list drives the public booking page.** Closes BOOK-04. Adds the
  per-service online flag and public naming, and makes internal pricing
  customer-visible, which needs care.
- **E — import existing Services products.** Shop-initiated, per decision 5:
  create service rows, set `products.active = 0`, leave every historical sale
  line untouched.
- **The Services stock bug.** `createSale` moves stock for Services-category
  products. Pre-existing, not closed by this work, needs its own issue.
- **Per-line discounts and per-line notes.** There is no column for either
  today and none is added here.
- **JOB-20 time tracking.** Minutes on a labour line is a recorded figure, not
  a clocked one.
