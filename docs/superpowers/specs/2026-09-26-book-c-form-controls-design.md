# Book screens piece (c): the form controls

**Date:** 2026-09-26. **Follows:** piece (b) (#73). **Parent:** plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`), "Decided 25 Sep"
item 3. Phase 4 contract items 9 and 12
(`docs/superpowers/plans/2026-09-20-phase-4-screens.md` Task 7): new
components go in the registry, and every visual decision is Jack's.

## Intent

The registry gains the seven controls the six book screens need, each drawn
the way Jack approved on 26 Sep, and the existing text input stops reading
colour names the React app does not define. The controls show what they are
given and report what the customer picks; they never call the server.
Wiring them to real data is piece (d).

## Decisions (Jack, 26 Sep)

1. **Built on the browser's own controls; the calendar and diary are
   hand-built.** No new dependency. Chosen over react-day-picker for the
   calendar (a dependency plus restyling) and a full library such as Radix
   (reverses the no-Radix choice; custom dropdowns are worse on phones).
2. **Seven controls, no dropdown.** Every list on the book screens is short;
   a dropdown is added if a long one appears.
3. **Card style, as in the atlas mock-ups.** Selected = 2px border in the
   shop colour plus a pale fill; short single choices are pills side by side;
   tick boxes are the phone's own, coloured with the shop colour.
4. **Month grid for choosing a day.** Unbookable days greyed, struck through
   and not tappable; no "Full"/"Closed" label (the server never says why).
5. **Exact-appointment shops pick a time on a one-day mechanic diary**,
   brought over from the pre-31-Aug booking page (`public-portal/portal.js`
   at `7fe7e8a`, `buildMechanicGridHtml`): mechanic pills (several can be
   compared side by side), hours down the side, booked time as grey
   "Unavailable" blocks with no details. One day at a time, not the old
   week view: a week is under 40px per column on a phone. Drop-off shops
   have no times: month calendar plus a mechanic choice.
6. **Large text box and photo picker as shown.** Photos only (JPEG, PNG,
   WebP); the atlas's video option is dropped because the server refuses
   video.

Colour: "shop colour" is the existing `--accent` / `--accent-dark` tokens
(`src/styles/theme.css:30-31`; `--accent-dark` is the atlas's `#164f42`).
No new colour tokens.

## The controls

All are registry items (`registry/`, shadcn registry format, like the
existing primitives), built on native elements, styled only with
`src/styles/theme.css` tokens (no raw hex; the lint gate enforces it), with
touch targets at least 44px tall.

| Item | Kind | Props (outline) | Behaviour |
|---|---|---|---|
| `choice-card` | primitive | `title`, `detail?`, `price?` (preformatted text), `selected?`, native button props | A `<button>` card; `aria-pressed` when `selected` is given. Never formats or totals money. |
| `pill-group` | primitive | `legend`, `options: {value, label}[]`, `value: string \| string[]`, `multiple?`, `onChange` | A `<fieldset>` of visually-pill native radios (single) or checkboxes (`multiple`). Arrow keys follow native radio behaviour. |
| `checkbox` | primitive | `label`, native checkbox props | Native `<input type="checkbox">` with `accent-color: var(--accent-dark)`, label beside it, 18px box, row at least 44px tall. |
| `textarea` | primitive | native textarea props | Same look as `input`, min 80px tall, resizes vertically. |
| `photo-picker` | pattern | `value: File[]`, `onChange(files)`, `max` (5), `maxBytes` (10 MB) | "Add photos" opens the phone's chooser (`accept="image/jpeg,image/png,image/webp"`, `multiple`). Thumbnails with a remove button each; "n of 5 added". A file of the wrong type, over `maxBytes`, or beyond `max` is refused with a message naming it and the rule; accepted files are kept. Turning files into base64 for the server is piece (d). |
| `month-calendar` | pattern | `month` (`YYYY-MM`), `onMonthChange`, `available: Set<string>` of `YYYY-MM-DD`, `value?`, `onChange(date)` | One month, Monday-first weeks, arrows to move month. A date not in `available` is shown greyed and struck through, `aria-disabled`, and does nothing when pressed. Arrow keys move between days (one focusable day at a time), Enter/Space picks. Dates are handled as plain `YYYY-MM-DD` strings so no time zone can shift a day. |
| `day-diary` | pattern | `open`, `close` (`HH:MM`), `columns: {id, name, busy: {start, end}[], startTimes: string[]}[]`, `value?: {columnId, time}`, `onChange` | One column per mechanic, hours labelled down the side. Busy spans are grey "Unavailable" blocks with no other text. Open time is made of one button per allowed start time (labelled with the time, e.g. "Sam, 10:30"), so any tap lands on a time the server allows and a keyboard or screen reader can reach each one. The picked time is filled in the shop colour. |

The mechanic pills above the diary are a `pill-group` with `multiple`;
keeping at least one selected is screen logic (piece (d)).

## The colour fix

`registry/primitives/input.tsx` reads `--ink`, `--danger` and `--muted`.
The React app's only stylesheet is `src/styles/theme.css`, which defines no
`--ink` or `--danger`, and whose `--muted` is a background shade (checked
26 Sep). So input text colour and the error border currently fall back to
defaults, and placeholder text is drawn in a background shade, which is
near-invisible. Point it at `--wh-ink`, `--wh-danger` and `--wh-muted`. Any other
registry item reading names that `theme.css` lacks gets the same fix.

## Tests (first, each watched failing, each with a break step)

- The registry sources are not in the test build today
  (`vite.test.config.ts` builds `src/` only). The test build gains
  `registry/` so each item can be rendered in jsdom with Testing Library,
  as the screen tests are.
- One test file per new item, covering what it renders and what a tap or
  key press reports. At minimum:
  - `choice-card`: `aria-pressed` follows `selected`; a click calls the handler.
  - `pill-group`: single mode reports one value; `multiple` reports the set;
    it is a labelled group.
  - `checkbox` / `textarea`: label is linked; change is reported.
  - `photo-picker`: accepts a JPEG; refuses a PDF, an 11 MB file, and a
    sixth photo, each with a message; remove drops that file.
  - `month-calendar`: an unavailable day does nothing when pressed; an
    available day reports its date; arrow keys move focus; the month
    buttons report the next and previous month; a month starting on a
    Sunday lays out Monday-first.
  - `day-diary`: busy spans show "Unavailable" and nothing else; pressing a
    start time reports `{columnId, time}`; a time not in `startTimes` has no
    button.
- A test that every colour name the registry items read is defined in
  `src/styles/theme.css`, so the colour bug cannot come back.
- `npm run registry:build` output committed (CI's drift check compares it).

## Out of scope

- Using the controls on screens, loading availability, sending photos
  (piece (d)).
- The server returning a day's opening hours, which `day-diary` needs as
  `open`/`close`: `/availability` does not return them today. Piece (d).
- A dropdown; dark mode; per-shop colour at runtime in the React app.

## Done when

`npm test`, `npm run typecheck`, `npm run lint`, `npm run registry:validate`
and the registry drift check pass locally, the break steps have been seen to
fail, and a pull request is open for Jack with CI run on its final commit.
