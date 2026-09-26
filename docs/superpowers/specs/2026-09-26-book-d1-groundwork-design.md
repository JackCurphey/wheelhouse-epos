# Book screens piece (d1): groundwork for the six screens

**Date:** 2026-09-26. **Follows:** piece (c) (#74). **Parent:** plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`), piece (d).

## Piece (d) is five parts (Jack, 26 Sep)

Each part gets its own spec, plan and pull request:

1. **(d1) Groundwork** (this spec): controls installed into the app, the
   booking in progress, the screen frame, the shop's name, the guard.
2. **(d2)** `service` and `service-list`.
3. **(d3)** `problem`: bike, description, service questions, photos.
4. **(d4)** `date`: calendar, diary, mechanics, drop-off mode.
5. **(d5)** `details`, sending the booking, `pending` (the private link page),
   and the Playwright journey test against the real database.

Chosen over three parts (a large middle PR mixing two screens' design calls)
and one PR (several thousand lines).

## Intent

After d1, a screen can be written by using installed controls, reading and
writing one shared booking-in-progress, and sitting inside one frame; nothing
customer-visible changes yet (the six screens stay placeholders).

## Decisions (Jack, 26 Sep)

1. **Shop's name comes from `/services`.** `GET /api/portal/:shopSlug/services`
   gains `shopName`. Chosen over a new shop-details route (same look, one more
   request and route) and no name (no sign of whose shop it is).
2. **The booking in progress survives a refresh in that tab.** Kept in the
   tab's `sessionStorage`, per shop, until the booking is sent or the tab is
   closed. Photos are kept in memory only (files are too large to store), so
   after a reload they must be re-added; the photo screen (d3) says so. Chosen
   over keeping nothing (a phone call can wipe a half-done booking) and keeping
   it across tab closes (leaves name, phone and bike on a shared phone).
3. **Screen frame: pinned button.** Shop name at the top, a back link, "Step n
   of 4" with a progress bar, the screen, and the main button pinned to the
   bottom of the viewport. Chosen over the button at the end of the page (out
   of reach on long screens) and a minimal frame (no sense of progress).
   `pending` has no step count or back link.

## Approach

- **Controls in the app.** `npx shadcn add ./public/r/<name>.json --yes`
  installs an item into `src/components/ui/` (checked 26 Sep with
  `--dry-run`). Install: `button`, `input`, `label`, `checkbox`, `textarea`,
  `choice-card`, `pill-group`, `photo-picker`, `month-calendar`, `day-diary`.
  None of these imports a sibling registry item, so no import rewriting is
  needed. A test asserts each installed file is byte-identical to its
  `registry/**/<name>.tsx` source, so a registry change that is not
  re-installed fails the suite. Screens import only from `@/components/ui/...`
  (existing lint rule).
- **Shop's name.** The `/services` route adds `shopName: shop.name` (the
  dispatcher already resolves the shop from `:shopSlug`, as `/booking-links`
  uses). No other field changes.
- **Booking in progress** (`src/screens/book/draft.tsx`): a React context
  with a typed `BookingDraft` and `update(patch)` / `clear()`. Fields: chosen
  service (`serviceId` or `notSure`), service minutes, answers, bike (new make,
  model, colour), description, photos (`File[]`, memory only), date, mechanic,
  start time, name, phone, email, update channel, terms, marketing permission.
  Everything but photos is saved to `sessionStorage` under
  `wh-book-draft:<shopSlug>` on every change and read back on load. If storage
  throws (private modes) the draft still works in memory. `clear()` removes the
  stored copy.
- **Frame** (`src/screens/book/frame.tsx`): `BookFrame({ step?, title,
  back?, action?, children })`. Shows the shop's name (from the `/services`
  query, shared through React Query), a back link when `back` is given, "Step
  n of 4" and a progress bar when `step` is given, the title as the page's
  `h1`, the children, and `action` (label, onClick, disabled) as a full-width
  button pinned to the bottom of the viewport, with bottom padding on the page
  so it never covers the last field. Styled with theme tokens and installed
  controls only.
- **Guard** (`src/screens/book/require-draft.tsx`): a screen declares what it
  needs (e.g. `date` needs a chosen service); with it missing the screen
  redirects to `/book/<shopSlug>`.
- **Where screens live.** `src/screens/book/<id>.tsx`, as plan 4a and the
  phase-4 contract (item 2) say, registered in the `SCREENS` map in
  `src/customer/app-shell.tsx`. The draft provider wraps the customer router.

## Out of scope

- Any screen's content (d2-d5). No screen is registered in d1.
- Styling beyond the frame; copy for each screen.

## Tests (first, each watched failing, each with a break step)

- `tests/customer/installed-controls.test.js`: each installed file equals its
  registry source.
- Server: `/services` returns `shopName` equal to the shop's name, and a
  second shop's slug returns that shop's name.
- `tests/customer/draft.test.js` (jsdom): an update is saved to
  `sessionStorage` under the shop's key; a new provider reads it back; photos
  are never written to storage; `clear()` empties it; a storage that throws
  still lets updates work in memory; two shops' drafts don't mix.
- `tests/customer/frame.test.js`: shows the shop's name and "Step 2 of 4";
  the back link goes where `back` says; the action button calls its handler
  and is disabled when told; without `step` there is no step count.
- `tests/customer/require-draft.test.js`: a screen needing a service,
  opened with an empty draft, ends up at `/book/<shopSlug>`; with a service
  chosen it renders.

## Done when

`npm test`, `npm run typecheck`, `npm run lint`, the registry drift check and
`npm run test:browser` pass locally, the break steps have been seen to fail,
and a pull request is open for Jack with CI run on its final commit.
