# Fjell is the Wheelhouse design system

Date: 27 September 2026. **Status: decided by Jack in session, built on
`feat/fjell-design-system`.**

## The decision

The staff app and the React apps use one look, called **Fjell**: warm
off-white surfaces, a dark olive primary, a lime highlight for "you are
here", Work Sans for text and DM Mono for numbers. It replaces the old
palette (grey-green surfaces, an orange "primary" button and a
shop-chosen accent colour).

## Why Fjell

Jack was shown five complete themes, each built from the mood of a cycling
brand:

| Theme   | Mood taken from      | Mood                              |
|---------|----------------------|-----------------------------------|
| Chapter | Rapha                | Understated, literary, premium    |
| Hilltop | Trek                 | Confident, friendly, retail-ready |
| Sprint  | Specialized          | Technical, fast, precise          |
| Studio  | MAAP                 | Modern, editorial, exact          |
| Fjell   | Pas Normal Studios   | Quiet, earthy, Scandinavian       |

He chose Fjell. The brands were **inspiration for a mood only**: no brand
logo, name, colour value, typeface or other asset is used. Every Fjell
colour was picked for Wheelhouse and checked for contrast, and both fonts
are open-licence Google Fonts.

## The tokens

`public/tokens.css` is the source of truth; `src/styles/theme.css` carries the
same values for the React apps under `--wh-*` names.

| Role | Value | tokens.css | theme.css |
|---|---|---|---|
| Page background | `#f3f2ee` | `--bg` | `--wh-bg` / `--background` |
| Card / panel, pop-ups | `#fbfbf9` | `--panel`, `--modal-bg` | `--wh-panel` / `--card`, `--modal-bg` |
| Text (ink) | `#1c1e19` | `--ink` | `--wh-ink` / `--foreground` |
| Muted surface | `#e8e7e1` | `--surface-muted`, `--hover-bg` | `--wh-surface-muted` / `--muted`, `--secondary`; `--wh-hover` |
| Muted text | `#56594f` | `--muted` | `--wh-muted` / `--muted-foreground` |
| Border (decorative) | `#dcdbd3` | `--border` | `--wh-border` / `--border` |
| Input border | `#83867a` | `--input-border` (new) | `--wh-input-border` / `--input` |
| Primary (actions) | `#3f4d33`, white text | `--brand`, `--accent` | `--wh-brand`, `--accent` / `--primary` |
| Primary-dark, top bar / sidebar | `#2a3024` | `--brand-dark`, `--accent-dark` | `--wh-brand-dark`, `--accent-dark` / `--sidebar` |
| Text on primary | `#ffffff` | `--on-brand` | `--wh-on-brand` / `--primary-foreground` |
| Sidebar / top-bar text | `#f3f2ee` | `--on-accent` | `--wh-on-accent` / `--sidebar-foreground` |
| Sidebar active | `#3f4d33` | (`--accent`, top-bar hover) | `--sidebar-primary`, `--sidebar-accent` |
| Highlight (active marker) | `#c5cf3e`, dark text | `--highlight`, `--on-highlight` (new) | `--wh-highlight`, `--wh-on-highlight` |
| Destructive | `#a8321f` | `--danger` | `--wh-danger` / `--destructive` |
| Radius | 6px controls, 10px cards | `--radius-sm` 6px, `--radius` 10px | `--radius` 6px (so `rounded-lg` 6px, `rounded-xl` 10px) |
| Text font | Work Sans 400/500/600/700 | `--font-sans` (new) | `--wh-font-sans` / `font-sans` |
| Number font | DM Mono 500 | `--font-mono` (new) | `--wh-font-mono` / `font-mono` |

**Unchanged:** the six job-status colours (pending, scheduled, waiting parts,
on hold, complete, complete and paid), the badge colours, warning and "ok"
backgrounds, the spacing and type scales and the focus ring.

### Choices made where the old palette had a slot Fjell does not name

- **One action colour.** `--brand` used to be orange for the "primary"
  button. It is now the Fjell primary, the same as `--accent`, so every
  action button is olive. `--brand-dark` and `--accent-dark` are both the
  primary-dark.
- **Input border.** `--input` in theme.css used to be the decorative border
  (1.3:1, too faint to show where a field is). It was first set to
  `#8e9185` (3.10:1 on panels but 2.87:1 on the page and 2.59:1 on grey
  panels). Jack compared the two side by side on 27 Sep and approved the
  darker `#83867a`: 3.31:1 on the page, 3.58:1 on panels and 3.00:1 on grey
  panels, so every field clears WCAG's 3:1 wherever it sits. Dark mode's
  border moved from `#6f7366` to `#767a6d` for the same reason.
- **Top bar.** The top bar is primary-dark. The current tab wears the
  highlight with dark text; hovering a tab shows the primary.
- **Pop-ups** used to be tinted with the shop's colour. They are now the
  panel colour; fields inside are told apart by the input border.
- **In-between shades** Fjell does not name are derived from its surfaces:
  table-row hover `#f3f2ee`, "today" cells `#f7f8ea` (panel with a hint of
  highlight), disabled and day-off `#e8e7e1`, day-off stripes
  `#efeee9`/`#e8e7e1`, the clock on the top bar `#c9cbbf`, danger hover
  `#8a2819`, pop-up backdrop `rgba(28, 30, 25, 0.45)` (Fjell ink).
- **Dark mode** (React only, not switched on anywhere yet) has a derived
  Fjell dark palette: background `#161813`, panel `#1f221b`, ink `#f3f2ee`,
  muted text `#a3a698`, muted surface `#2a2e24`, border `#33372d`, input
  border `#767a6d`. Primary, highlight and status colours are as in light.
- **Numbers in DM Mono** so far: the till's search results (SKU, price),
  cart line totals, price inputs and the totals column; in React, the price
  on a `ChoiceCard` and `MoneyInput`. Receipts and stickers keep their print
  fonts. Other numbers (job numbers, prices inside `app.js` markup and the
  booking screens) are not yet switched.

## Fonts are stored with the app

Both fonts are served from `public/fonts/` by the app itself. No page asks
Google for anything, so the offline till keeps its fonts with no internet and
a customer's visit is not reported to Google. Each file is the latin subset
the Google Fonts API serves, with `font-display: swap` and a system-font
fallback (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
for text; `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for
numbers).

| File | Source | Version |
|---|---|---|
| `public/fonts/work-sans/work-sans-latin-wght.woff2` (variable, weights 100-900; 400-700 declared) | `https://fonts.gstatic.com/s/worksans/v24/QGYsz_wNahGAdqQ43Rh_fKDptfpA4Q.woff2`, from `https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap` | Google Fonts `v24`; font "Version 2.012"; upstream `weiweihuanghuang/Work-Sans` commit `b35c810` (google/fonts `ofl/worksans/METADATA.pb`) |
| `public/fonts/dm-mono/dm-mono-latin-500.woff2` | `https://fonts.gstatic.com/s/dmmono/v16/aFTR7PB1QTsUX8KYvumzEYOtbYf-Vlg.woff2`, from `https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap` | Google Fonts `v16`; font "Version 1.000"; upstream `googlefonts/dm-mono` commit `57fadab` |

SHA-256: Work Sans `72cd8f67…a9b197`, DM Mono `0e263db5…6d9f36`. Both are
under the **SIL Open Font License 1.1**; the licence text sits beside each
file as `OFL.txt`, copied from `google/fonts` (`ofl/worksans/OFL.txt`,
`ofl/dmmono/OFL.txt`). The server sends `.woff2` as `font/woff2`. Like every
other unhashed file in `public/`, the fonts are served `no-store`.

## Staff app: always Fjell. Customer pages: the shop's scheme, for now

- **Staff app** (`/`, `public/app.js`; and `/workshop`): always Fjell. The
  "Colour scheme" panel is gone from Edit Shop > Office, and start-up no
  longer fetches `/api/shop-theme` or overrides `--accent`, `--accent-dark`
  or `--modal-bg`.
- **Public website** (`public-storefront`): still uses the scheme the shop
  picks in the Storefront panel's Theme menu (Forest, Ocean, Sunset, Slate,
  Plum), with its own stylesheet, until the Release 2 website theme system
  replaces it.
- **Booking app** (`/book`, React): has never applied a shop scheme
  (`book.html` does not load `app.js`), so it shows Fjell from `theme.css`.
- Kept, unused by the staff app: the `shop_theme` table (migration 009),
  `GET`/`PUT /api/shop-theme`, and `THEME_PRESETS` in `app.js` (the
  Storefront Theme menu's names) and `storefront.js` (the colours).

## How to change the theme later

1. Change the value in **`public/tokens.css`** and the matching `--wh-*` value
   in **`src/styles/theme.css`**. `tests/design-fjell.test.js` fails if they
   disagree, and pins the approved Fjell values - update its `FJELL` table in
   the same change, with the reason.
2. Run `npm test`. The contrast tests (`design-contrast`, `design-fjell`)
   check text at 4.5:1 and field borders at 3:1, in light and dark.
3. Colours in React code must be tokens: `tests/design-tokens.test.js` fails
   on any hex, `rgb()`, palette class like `bg-white`, or `white` inside an
   arbitrary value. Registry components are changed under `registry/`, then
   `npm run registry:build` and `npx shadcn add ./public/r/<name>.json --yes
   --overwrite`; never edit `src/components/ui` by hand.
4. **Fonts and radius change layout, not just looks.** A new font has
   different widths: check the week grid (job blocks sit in 24px slots), the
   till cart, receipts and tables for wrapping or overflow. Replace the font
   files in `public/fonts/` (with their licence and a source note here) and
   the `@font-face` blocks in both stylesheets. A radius change moves every
   control's corners; theme.css derives all Tailwind radii from `--radius`.
5. Update this record.
