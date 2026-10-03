# Wheelhouse

Software for independent bike shops: the till, the workshop, the stockroom and the office, plus each shop's customer website. This system is **Soft sand** — soft sand paper, a charcoal sidebar (the one dark surface) and a small amber highlight used sparingly — chosen by Jack on 28 September 2026 ("Soft sand, dark rail", sans-serif throughout). It replaced **Fjell**, the first look (27 September).

Styling is **Tailwind reading these tokens**, applied to the **shadcn** components in the Wheelhouse registry. Token names match the CSS variables in `src/styles/theme.css`, so a design drawn here and the built app share one source. Changing the theme later means changing these values; nothing may use a raw colour, font or radius.

## Voice

- Plain English, written from the shop floor. Name things by what staff and customers recognise: *booking link*, not *portal*; *Front desk*, not *POS module*.
- A control says exactly what happens: "Take payment", "Book in", "Send quote". Confirmations say what happened: "Payment taken".
- Errors say what went wrong and what to do next, without apology.
- The product is **Wheelhouse**. Staff roles are **Owner, Manager, Staff, Mechanic**. The shop's online presence is its **website**.

## How the staff app is organised

The sidebar is grouped by the rooms of a shop, so people find things where they would stand:

| Room | Pages |
| --- | --- |
| Front desk | Till, Online orders, Customers |
| Workshop | Jobs, Diary, Booking requests |
| Stockroom | Stock, Deliveries and orders, Stock take |
| Office | Today, Reports, Website, Settings |

*Till* is the selling screen and the till computer (for example "Till B1"); *Front desk* is the area. Each role sees only its rooms: a mechanic sees Workshop.

## Colour

- `background` is the ground of every screen; `card` lifts panels, inputs and the header off it.
- `primary` is the **only** action colour. One main action per screen uses a filled `primary` button; the rest are outline or ghost.
- `highlight` (amber) marks where you are — the active sidebar item's text — and rare emphasis. On a fill it always carries `highlight-foreground` text; it is never used for body text.
- `sidebar` is the dark rail of the staff app; `sidebar-active` (a lighter charcoal) fills the current item.
- `destructive` is for void, delete and errors only. Delete buttons are outlined in it, never filled.
- Status colours (`status-*`) carry meaning across the whole product — awaiting confirmation, booked in, waiting for parts, on hold, ready — and are the same in every theme. Never use them decoratively.

## Type

- **Public Sans** for everything, headings included; **DM Mono** for figures people compare or read back: prices, SKUs, receipt numbers (B1-1042), job numbers (WH-1042), counts.
- Sentence case everywhere. Overline labels (`overline`) are the only uppercase text, with letter spacing.
- Page titles use `page-title`; section headings `section`; body `body`.

## Shape and space

- Buttons, inputs and sidebar items use `radius-md` (6px); cards and dialogs `radius-lg` (10px); status badges `radius-pill`.
- Cards separate with a hairline `border` outline and no shadow (`shadow-card` is `none`).
- Spacing steps are 4, 8, 12, 16, 24, 32, 48. Desktop pages pad `space-8`; phone pages `space-4`.
- Touch targets are at least 44px tall; the till's keys are 64px.

## Responsive

Every screen works on desktop and phone. On a phone the staff sidebar becomes a menu behind the top bar; tables become stacked rows; the main action pins to the bottom of the screen.

## Logo

There is no official Wheelhouse logo file yet. Designs show a marked "LOGO" slot; never approximate one with styled text or shapes.

## Accessibility

Text meets 4.5:1 on its ground in both themes; input borders meet 3:1 against cards; focus shows a 2px `primary` ring. Colours that must be told apart also differ in lightness.
