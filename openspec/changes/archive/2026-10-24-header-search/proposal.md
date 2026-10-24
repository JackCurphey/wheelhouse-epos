# Proposal: the header search, for customers and jobs

## Why

Every staff page is drawn with one search in its header, so a name, phone
number or job number can be found from anywhere (app map review 2,
`docs/decisions/2026-09-29-app-map-review.md` :19–23; customer service review
12: one search, the header's, and Customers becomes a recent list). Jack, 24 Oct
(`docs/decisions/2026-10-24-morning-questions.md` answer 7): build it first,
finding customers and jobs, then the Customers list.

## What Changes

- **`GET /api/search?q=`** returns up to 5 jobs and 5 customers matching what
  was typed: a job by its number, its customer's name or phone, or its bike;
  a customer by name, phone or email. Requests not yet confirmed are found;
  removed customers aren't.
- **The header search** (`staff-search`, `app-map.mjs` :275–288; `diary.mjs`
  :169–203): on a computer a box in the header, results dropping down under
  it; on a tablet or phone a search button that opens the box and its results
  over the page, with "Close search". Rows are links, grouped Jobs then
  Customers, as drawn: a job opens in the diary; a customer opens their page
  (built next). A live line says how many were found.
- Orders and products join as they're built; until then the box says "Search
  jobs and customers".

## Capabilities

### New Capabilities
- `header-search`: finding jobs and customers from any staff page.

### Modified Capabilities
- None.

## Lane, work package, drawings and decisions

- **Work package:** WP-1.11 (small shared parts: header search), Jack.
- **Risky areas:** none (a read-only staff route).
- **Drawings:** `staff-search`; the header's box and button (`diary.mjs`
  `headerSearch`, `searchIconBtn`); rows from `searchResultsList` (`app-map.mjs`
  :41–65).
- **Decisions:** app map review 2; customer service review 12; walk-through 9
  H1 (a job row shows its stage); 24 Oct answer 7.

## Out of scope

- Orders, products, Cycle to Work and postcodes (as each is built; a
  postcode arrives with Customers' address).
- The till's own search, which has its buttons.

## Impact

`server/routes/search.js` (new, registered; route list), `src/staff/header-search.tsx`
(new), `src/staff/staff-layout.tsx` (the header).
