# Book screens piece (b): the customer app shell at `/book`

**Date:** 2026-09-25. **Follows:** piece (a) (#72). **Parent:** plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`), "Decided 25 Sep"
item 3. **Decision:** J1 in
`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`, as changed
25 Sep.

## Intent

A customer React app exists alongside the staff app, served at every `/book`
address, with a route for each of the six book screens. The screens
themselves are placeholders; pieces (c) and (d) fill them in.

## Decisions (Jack, 25 Sep)

1. **The new app takes all of `/book` now.** Nobody uses the old booking
   page, so J1's "old page keeps serving until the journey is green" is
   dropped. Chosen over claiming only built addresses (a server-side address
   list kept in step with the app) and a temporary `/book-new` address
   (private links broken until a switch-over).
2. **Stop serving the old page; delete its files later.** `public-portal/`
   and the things that still point at it (Dockerfile copy, lint config,
   `tests/portal-copy.test.js`, `tests/design-tokens.test.js` portal checks,
   `public-demo/sdbdemo.html`, comments in four server files) are left for a
   later clean-up. Only `tests/portal-copy-served.test.js`, which asserts the
   old page is served, goes now.
3. **Addresses:**

   | Screen (atlas id, number) | Address |
   |---|---|
   | `service` (01) | `/book/:shopSlug` |
   | `service-list` (02) | `/book/:shopSlug/services` |
   | `problem` (03) | `/book/:shopSlug/problem` |
   | `date` (04) | `/book/:shopSlug/date` |
   | `details` (05) | `/book/:shopSlug/details` |
   | `pending` (06) | `/book/:shopSlug/booking/:code` |

   `pending` and the private link are one page: the address is the one the
   server already issues (`server/booking-link.js` `linkPath`). After
   booking, piece (d) sends the customer to it.

## Approach

Follow the staff app's shape; share nothing that is staff-specific.

- **Front end** (`src/customer/`):
  - `routes.ts`: `CUSTOMER_ROUTES`, the table above, `as const`, with a
    `CustomerScreenId` type. Journey plans add customer screens here and
    nowhere else.
  - `app-shell.tsx`: the same structure as `src/staff/app-shell.tsx`
    (`createBrowserRouter`, a `SCREENS` map that starts empty, a "Not built
    yet: <id>" placeholder, a `/book/*` catch-all showing "There is no screen
    at this address.", an error boundary, a QueryClient that does not retry
    4xx). Unstyled, like the staff shell. No staff session (`use-session.ts`
    is staff-only).
  - `main.tsx`: imports `../styles/theme.css`, mounts on `#wh-book-root`.
- **Build:** `vite.config.ts` gains the input `book: src/customer/main.tsx`.
  `vite.test.config.ts` excludes `src/customer/main.tsx` as it does the staff
  one.
- **Page:** `public/book.html`, like `public/workshop.html` (a
  `#wh-book-root` div and an `<!--WH_ENTRY-->` marker). Title "Book a
  service".
- **Server** (`server/server.js`):
  - `workshopEntryTags` becomes an entry-tag builder that takes the manifest
    key (`src/staff/main.tsx` or `src/customer/main.tsx`); its error messages
    name the entry that is missing.
  - `/book` and `/book/*` serve `book.html` with the customer entry's tags
    (`no-store`, same as `/workshop`), on the main host and on storefront
    subdomains. The old `serveStatic(..., PORTAL_DIR)` calls for `/book` go.
  - No build: 500 with a "not built" message, as `/workshop` does.
- **Unchanged:** every `/api/portal/*` route; the staff app and its routes;
  the five customer edge screens still in the staff `ROUTES` (their move is a
  later follow-on).

## Out of scope

- Real screens, styling, shop colours (pieces (c) and (d)).
- Deleting `public-portal/` and its references (later clean-up).
- Moving the edge screens out of `/workshop`.
- The screen-trace check (`scripts/ci/assert-screen-trace.mjs`) for customer
  routes: it covers server API routes, not front-end addresses.

## Tests (first, each watched failing, each with a break step)

- `tests/screens/customer-routes.test.js`: the keys are exactly the six
  `book` ids in `docs/design/release-1-journey/screen-index.json`; every path
  starts `/book/`; no two paths are the same; `pending` is
  `/book/:shopSlug/booking/:code`.
- `tests/screens/customer-app-shell.test.js` (jsdom, like
  `tests/screens/app-shell.test.js`): `/book/demo` shows "Not built yet:
  service"; `/book/demo/booking/<64 hex>` shows "Not built yet: pending";
  `/book/demo/nope/nope` shows "There is no screen at this address."
- Server test (new file): `/book/<slug>` and a deep link
  `/book/<slug>/booking/<code>` return the book page with the customer
  entry's script tag and `no-store`; the same on a storefront subdomain host;
  a missing manifest entry gives 500 naming the customer entry. Existing
  `tests/workshop-entry-tags.test.js` and `tests/workshop-page.test.js` keep
  passing (updated only for the builder's new argument).
- `tests/browser/smoke.spec.ts`: `/book/<slug>` mounts `#wh-book-root` with
  no page errors and shows "Not built yet: service".
- Remove `tests/portal-copy-served.test.js`.

## Done when

`npm test`, `npm run typecheck`, `npm run lint` and `npm run test:browser`
pass locally, the break steps have been seen to fail, and a pull request is
open for Jack with CI run on its final commit.
