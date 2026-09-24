# Book server work, piece 1: the public service list

**Date:** 2026-09-24. **Approved in session by Jack** (design, 24 Sep).
**Serves:** book screens `service` (01) and `service-list` (02); staff setup
screens `services` (65) and `service-edit` (66).
**Part of:** the server prerequisite work for journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`, item 3 gap table),
split into six pieces: 1 service list (this), 2 booking modes and capacity,
3 the booking request, 4 guest private link, 5 service questions, 6 customer
uploads. Each gets its own spec and plan.

## Decisions this rests on

- **Customers pick from a shop-ticked subset** of the catalogue, one thing,
  plus a "Not sure" escape hatch that books one hour; **prices online are a
  per-shop setting** (`docs/decisions/2026-09-04-booking-mode-and-downtime.md`
  §7, §7.6). Both columns already exist: `workshop_services.bookable_online`
  (migration 015) and `workshop_settings.show_prices_online` (015).
- **Categories are one level deep** (Jack, 24 Sep). Category -> services; no
  subcategories. Closes the "how service subcategories nest" question in
  `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md:102`.
- **The first booking screen has three fixed options** (Jack, 24 Sep):
  1. **Full services** - whole-bike services. Opens a short list of the
     shop's full services (e.g. basic / full / premium tiers).
  2. **Individual services** - single jobs (brakes only, gears only). Opens
     the list grouped by category.
  3. **Not sure** - skips to describing the problem. Not a catalogue entry;
     its one-hour booking belongs to piece 3.

## What changes

### Schema - migration `022_service_categories.sql` (one file)

- **New table `workshop_service_categories`**: `id SERIAL`, `shop_id`
  (default from `app.current_shop_id`, as every shop table), `name TEXT NOT
  NULL`, `position INTEGER NOT NULL DEFAULT 0`, timestamps. ENABLE and FORCE
  row-level security with a `*_shop_isolation` policy, the pattern of
  `014_workshop_services.sql`.
- **`workshop_services` gains**:
  - `kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('full',
    'individual'))`. Existing services become `individual`.
  - `category_id INTEGER REFERENCES workshop_service_categories(id) ON DELETE
    SET NULL`. Only meaningful for `individual`; a `full` service's
    category is ignored and stored as NULL.
  - `position INTEGER NOT NULL DEFAULT 0`.

### Staff routes (signed-in staff, existing dispatcher)

- **`GET/POST/PUT/DELETE /api/workshop-service-categories`**
  (`/:id` for PUT and DELETE). Name required and trimmed; position optional
  integer. Listed by `position, name`. DELETE removes the row; its services
  fall to uncategorised via `ON DELETE SET NULL`.
- **`POST` and `PUT /api/workshop-services`** accept `kind`, `categoryId` and
  `position`. On PUT an omitted field keeps its stored value, as
  `bookableOnline` already does, so the existing staff app keeps working.
  `kind` must be `full` or `individual` (400 otherwise). A `categoryId` is
  looked up through the shop-scoped `db` first and refused with 400 if not
  found: a foreign key check bypasses row-level security, so without the
  lookup a shop could file a service under another shop's category id.
- **`serializeWorkshopService`** adds `kind`, `categoryId`, `position`.
- Each route carries a `// screens: services, service-edit` comment.

### Public route (no login)

**`GET /api/portal/:shopSlug/services`**, run inside the shop's row-level
security context like every portal route. Returns only services that are
`active = 1` and `bookable_online = 1`:

```json
{
  "showPrices": true,
  "full": [{ "id": 4, "name": "Full service", "price": 85, "minutes": 120 }],
  "categories": [
    { "id": 2, "name": "Brakes", "services": [{ "id": 9, "name": "Brake bleed", "price": 25, "minutes": 30 }] }
  ],
  "uncategorised": [{ "id": 12, "name": "Tubeless setup", "price": 20, "minutes": 30 }]
}
```

- `price` is `null` on every service when `show_prices_online` is off. Prices
  are passed through as stored; the page shows them as "From £X"; nothing
  totals money in JavaScript.
- Ordering: `full` by `position, name`; categories by `position, name`,
  services within each by `position, name`; `uncategorised` last (the screen
  labels it "Other").
- Categories with no bookable service are omitted.
- `// screens: service, service-list`.

### CI screen trace

`COVERED` in `scripts/ci/assert-screen-trace.mjs` widens to
`/api/workshop-services`, `/api/workshop-service-categories` and
`/api/portal/:shopSlug/services`, so each of those routes must name its
screens.

## Tests (each written first and seen to fail against a real break)

New `tests/workshop-service-list.test.js`, live server, real database:

1. A service that is inactive, not bookable online, or belongs to another
   shop does not appear in the public list.
2. With `show_prices_online` off every `price` is `null`; with it on, the
   stored price.
3. Full services and categorised individual services land in the right
   groups, in `position, name` order; uncategorised ones in `uncategorised`.
4. A category with no bookable services is omitted.
5. Deleting a category moves its services to `uncategorised`, not deleted.
6. Staff cannot file a service under another shop's category id (400).
7. A PUT that omits `kind`/`categoryId`/`position` keeps the stored values.
8. An unknown shop slug answers 404.

Plus the existing gates: `npm test`, typecheck, lint, RLS coverage (the new
table must show ENABLE and FORCE), screen trace, and a second `npm run
migrate` re-applying nothing.

## Done when

All of the above pass on the branch and in CI, each new test seen to fail
against its named break, and the migration applies on an empty database.

## Not in scope

The React screens themselves (plan 4a); the staff settings UI; "Not sure"
duration (piece 3); service questions (piece 5); service descriptions or
images (not in the atlas).
