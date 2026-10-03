# The staff app shell: rooms sidebar and phone menu

**Asked for by Jack, 3 Oct 2026** ("just continue building if you can"),
as the second build piece (STATUS "Next, in order", step 4: "starting with
the shell (room sidebar, phone menu)"). The design is already approved:
journey A (`docs/decisions/2026-09-29-app-map-review.md`) and Workshop day
decision 68, drawn by `shellDesktop`, `shellTablet` and `shellPhone` in
`docs/design/user-journeys/generator/diary.mjs`.

## Intent

`/workshop` gets the frame every later screen sits in: the charcoal sidebar
grouped by the rooms of a shop on a computer, the icon rail on a tablet, and
the top bar with a menu on a phone. Each item opens its page; pages not built
yet show the existing "Not built yet" placeholder inside the frame.

## Approach

- **One list of rooms**, `src/staff/nav.ts`, copied from `ROOMS_DIARY` in
  `diary.mjs`. A test checks the two match, so the app cannot drift from the
  drawings. Icons are the drawings' own stroke paths (`ui.mjs`).
- **Routes:** each item gets `/workshop/<key>`. The route test accepts these
  keys as well as screen-index ids.
- **Sizes**, as drawn: 248px sidebar at 1024px wide and up; 84px rail with
  labels from 768px; below that a 56px top bar with "Open menu", and a 300px
  menu over a dimmed page. The selected item has the lighter charcoal fill
  and the amber edge (`aria-current="page"`).
- **The menu on a phone** closes with its Close button, the backdrop, Escape
  or choosing an item. Focus goes to Close when it opens and back to "Open
  menu" when it closes.
- **Footer:** your initials, name and role, linking to Your settings (a
  placeholder page for now), and Sign out (`POST /api/auth/logout`, then
  back to the sign-in page at `/`).
- **Where you land at `/workshop`** (decision A11): Owner → Today, everyone
  else → Till. Mechanics → Diary once the server says who is a mechanic.
- Signed out: a short message with a link to sign in.

## Decided here, for Jack to overrule

- **Roles.** The server only says whether someone is the Owner; there is no
  Manager role yet, and mechanics aren't marked in `/api/auth/me`. So the
  Owner sees every room and everyone else sees the Staff rooms. Manager and
  Mechanic filtering arrive with roles (the sidebar list already carries them).
- **Unbuilt pages** show the placeholder inside the new frame rather than
  sending people to the old app's screens.
- **Left out until they work:** the search box (nothing to search with yet),
  the shop switcher (one-shop businesses see the shop's name, as drawn),
  counts on items, hiding items for Lightspeed shops, and folding the rail.
  No logo mark is drawn: there is no official logo file.

## Tests first

Shell tests in jsdom (`tests/screens/staff-shell.test.js`): rooms and items
per role, `aria-current`, the menu's open/close and focus, sign out, landing,
signed out. `tests/screens/nav.test.js`: `nav.ts` matches the drawings.
Each watched failing first.

## Done when

`npm test`, typecheck, lint, build and the browser tests pass, and the shell
is checked in a browser at desktop, tablet and phone widths.
