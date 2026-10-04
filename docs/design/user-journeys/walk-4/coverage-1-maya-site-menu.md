# Coverage cell 1: App map and navigation × Maya, the website's phone menu (clicked on the mockup)

Stage W coverage check (`../coverage-check.md`, "Empty cells", cell 1), walked 4 Oct 2026. I used the method in `../ux-walkthrough-script.md` and Maya's checks in `../personas.md`, with issue #116's three changes: fewer steps rather than more drawings, screens counted as well as clicks, and the joins clicked through the mockup. The mockup was rebuilt first (`node build.mjs && node mockup/build-mockup.mjs`: 763 screens, 0 dead links). Every control's target below is the `data-go` / `data-act` the build wrote into `generator/out-mockup/data/*.json`, read with a scratchpad script. Nothing was saved to the repo.

Kept screens walked: `site` (the website frame, default theme) with its situation `site-menu`, and `site-ocean` (a shop's own theme) with `site-ocean-menu`.

## The story, as the mockup clicks it

Story 12, with Maya walked twice: **Maya, unsure** (not confident with phones) and **Maya, hurried**.

1. On her phone, on a page of the shop's website (`site`), Maya taps the menu button and `site-menu` opens: "Shop, Book a repair, Our shops, Account". She taps "Book a repair" and lands on `bk-service`, the first booking step.
2. She does it again on a shop that picked its own theme (`site-ocean`). The shop chose "Book a repair" as its standout link (App map 10), so the open menu (`site-ocean-menu`) shows it as a big button above the list.
3. At tablet and desktop the header shows the links in a row, and there's no menu to open.

## Clicks and screens

| Size | Person | Taps | Screens | Notes |
|---|---|---|---|---|
| Phone, default theme | Maya (both) | 2 | 3 (`site`, `site-menu`, `bk-service`) | From the home page (`wb-home`) the big "Book a repair" button is 1 tap and 2 screens. **Maya, hurried** takes that, and so does **Maya, unsure** if she's on the home page |
| Phone, shop's own theme | Maya (both) | 2 as drawn | 3 as drawn | In the mockup the menu that opens is the default theme's (M1) |
| Tablet | Maya | 1 | 2 | "Book a repair" is in the header; on `site-ocean` it's a button |
| Desktop | Maya | 1 | 2 | Same as tablet |

Fewer steps: on a phone, "Book a repair" takes 2 taps from any page except the home page, where it takes 1. That's the fewest possible behind a menu. Nothing here needs a new drawing. `site-menu` and `site-ocean-menu` are already situations of their frames, and `site-ocean` itself is the "one extra board" App map 3 asked for.

## High

None found.

## Medium

### M1: On the shop's own theme, the menu button opens the default theme's menu

- **Screens:** `site-ocean` → `site-menu` (phone). `site-ocean-menu` (phone).
- **What happens:** on `site-ocean` (dark blue header, Ocean Blue), "Open menu" goes to `site-menu`, the default Soft sand menu. That menu lists "Shop", "Book a repair", "Our shops", "Account" as four equal rows. The drawing of the shop's own menu, `site-ocean-menu`, has "Book a repair" as a big dark blue button above the list, but no control in the mockup leads to it (a search of every data file finds 0 links into `site-ocean-menu`). The cause is the shared rule in `mockup/links/shared.mjs`: "Open menu" goes by role, to `site-menu` for any customer page.
- **Why it matters:** the second half of this cell's story is the reason `site-ocean-menu` exists. A shop that picks "Book a repair" as its button (App map 10) should see it stand out on a phone. Clicked, Maya gets the other shop's colours and no standout button, so the shop's choice can't be shown in a walk with Jack.
- **Fix, no choice:** in `mockup/links/ja.mjs`, `'site-ocean': { 'Open menu': go('site-ocean-menu') }`. This is a mockup link; no drawing changes.
- **Decision it touches:** App map 3 and 10 (not reopened).
- **Second check:** KEPT. `site-ocean` at phone: `aria-label="Open menu" … data-go="site-menu"`. `site-ocean-menu` has the big button (`background: #1a3f66 … font-size: 17px; font-weight: 700`, "Book a repair" → `bk-service`), and an incoming-link scan over all 69 data files finds none. No walk 2 or walk 3 report mentions `site-ocean`.

## Low

### L1: "Close menu" on the website's phone menu does nothing

- **Screens:** `site-menu`, `site-ocean-menu` (phone).
- **What happens:** "Close menu" is marked `data-act="stay"`. `page.html` has no handler for "stay", so pressing it leaves the menu open with no message. The staff app's phone menu (`staff-app-menu`) has "Close menu" → back (`links/ja.mjs`).
- **Why it matters:** **Maya, unsure** opens the menu by mistake and can't close it. She has to know to use the browser's Back.
- **Fix, no choice:** in `links/ja.mjs`, give `site-menu` and `site-ocean-menu` `'Close menu': BACK`, as `staff-app-menu` has it. This is a mockup link.
- **Decision it touches:** none.
- **Second check:** KEPT. The button is `aria-label="Close menu" aria-expanded="true" … data-act="stay"` on both drawings. It resolves to "stay" because `aria-expanded` matches `NAV_KINDS` in `controls.mjs` before the "close" rule. `page.html` `onClick` handles only back, outside and notdrawn.

### L2: The website's menu button is three lines with no word

- **Screens:** `site`, `site-ocean`, `wb-home` and every website page at phone size.
- **What happens:** the phone header is the logo and shop name, a magnifying glass, a basket, and a button drawn only as an icon (three lines), named "Open menu" for screen readers. It has no visible word. "Shop", "Our shops" and "Account" are reached only through it. "Book a repair" is also on the home page itself.
- **Why it matters:** `personas.md` says to walk Maya as "someone who rarely uses a phone" and that Jack's customers today are mostly older people. The three-line icon is common, but someone who doesn't know it has no word to go on. On the home page she can tap the big "Book a repair". On any other page (a product, the basket, Our shops), the menu is the only way.
- **Fix:** a real choice, because it changes the approved phone header (App map 15). See Question 1.
- **Decision it touches:** App map 14 and 15 (the phone header approved as drawn, 29 Sep, before the personas were written on 3 Oct).
- **Second check:** KEPT, as Low. On `site`, `site-ocean` and `wb-home` (phone), the button's only content is an SVG with `aria-hidden="true"`. No decision file, audit (`browse-ui-audit.md`, `app-map-ui-audit.md`) or walk report mentions the menu button's wording. It's Low, not Medium: nothing breaks, and the screen-reader name is right.

## Seen in passing, not counted

- **Account in the menu opens the account page directly** (`site-menu` and `site-ocean-menu` → `ac-account`). That's right for a signed-in Maya. A signed-out Maya would get the sign-in page (`cust-signin`). The mockup can send a button to only one place, the same limit as the PIN keys in walk 10 L1, which is still open for Jack. Not raised again.
- **The booking pages after `site-ocean-menu` are in the default look.** That's as decided: the first release's fixed design takes the shop's logo and one main colour (Website, later change 3 Oct, "the shop's colour on the fixed design"). The booking pages aren't drawn in a shop's colour, and App map 3 drew only the header in a second theme.

## Persona and access checks

- **Maya, unsure:** two taps with large rows (17px, 52px tall) and one obvious button. She meets L2 (no word on the menu) and L1 (can't close it in the mockup).
- **Maya, hurried:** the home page's "Book a repair" is 1 tap. On the shop's own theme the big button would be the first thing in the menu (M1 stops the mockup showing it).
- **Screen reader:** the menu button is named "Open menu" / "Close menu" with `aria-expanded`. The open list is `<nav aria-label="Website">`. The skip link comes first.
- **Keyboard only:** every row is an `<a>`. I didn't check the focus order or whether focus moves into the open menu (that needs a browser).
- **Low vision:** the menu rows are 17px. Only the placeholder "LOGO" is smaller (9px, a placeholder for the shop's own logo).

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | site-ocean, site-ocean-menu | The shop's own theme opens the default menu; its big "Book a repair" can't be reached | No |
| L1 | site-menu, site-ocean-menu | "Close menu" does nothing in the mockup | No |
| L2 | site, site-ocean, every phone website page | The menu button has no word, only three lines | Yes, Question 1 |

## Questions for Jack

1. **Should the website's phone menu button say "Menu"?** (L2) Some customers, especially people who rarely use a phone, may not know the three lines open the rest of the website.
   1. **Add the word "Menu" beside the three lines, on the customer website only.** Best for customers who don't know the icon. It costs about a word's width in the phone header, so a long shop name runs out of room sooner. The staff app stays as it is, because staff learn it once. *Recommended*, because Jack wants the app as accessible as possible and the website is used by every kind of customer.
   2. **Leave it as drawn.** Most websites do this, and the home page already has a big "Book a repair" button. Customers who don't know the icon can still get stuck on any other page.

## Verification

- **Walked:** `site`, `site-menu`, `site-ocean`, `site-ocean-menu` at phone; `site` and `site-ocean` at tablet and desktop; `wb-home` at phone (its menu button and big "Book a repair"); `bk-service` as the landing page. I read each screen's text and every control with its resolved target, plus the situation lines (`consolidate/ja.mjs`, `situation-lines.mjs`).
- **Mockup code read:** `mockup/controls.mjs` `resolve()`, `mockup/links/ja.mjs`, `mockup/links/shared.mjs` ("Open menu" goes by role), and the click handling and situation choice in `mockup/page.html`.
- **Incoming-link scan:** every `data-go` across the 69 data files. Nothing leads to `site-ocean-menu`, `site-ocean` or `site`. `site-menu` has 158 incoming links.
- **Decisions read:** App map (`2026-09-29-app-map-review.md`, in full, with its later changes); Find the shop (decisions 7–8 and its later change); Website management's later changes of 3 Oct; the second and third walk decisions; `mockup-gaps.md`.
- **Not checked:** anything rendered in a browser (focus order, zoom, what the icon looks like at real size); a real phone.
