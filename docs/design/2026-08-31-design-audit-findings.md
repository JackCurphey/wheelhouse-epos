# Design Audit — Findings

**Date:** 2026-08-31
**Commit audited:** `943fbc5` (master)
**Surfaces:** `public/` (staff EPOS), `public-portal/` (booking portal), `public-storefront/` (shop storefront), `public-demo/` (demo page)
**Volume reviewed:** 10,565 lines of HTML/CSS/JS
**Remediation plan:** [`docs/superpowers/plans/2026-08-31-design-remediation.md`](../superpowers/plans/2026-08-31-design-remediation.md)

## Method and its limits

This is a **static code audit**. No browser was driven and no screenshots were
taken — the repo has no browser automation, and standing up Postgres plus four
hosts for a visual walkthrough was out of scope. Every finding below is tied to
markup or CSS actually present in the files, cited by `path:line`.

Contrast ratios are computed from the declared token hex values using the
WCAG 2.1 relative-luminance formula. They are exact for the token pair, but do
**not** account for runtime overrides applied by `applyShopTheme()`
(`public/app.js`), which replaces `--brand`, `--accent` and `--modal-bg` per
shop. A shop on a non-default theme preset has an unmeasured palette.

**What this audit cannot tell you:** anything that only appears at render time —
actual reflow behaviour, real focus order, whether a layout breaks under long
content, or how any of this behaves on a real tablet. Browser-driven
verification is deferred (see `DEFER-001` in `.agents/deferrals.md`).

Two claims raised during review were checked and **did not hold**; they are
recorded here so they are not re-raised:

- *"Form labels are never associated with their inputs."* False. 83 of 110
  `<label>` tags in `app.js` carry `for=`, and the portal is 12 for 12. Only 18
  bare labels remain (see P5).
- *"Images are missing alt text."* False. `app.js` renders zero `<img>` tags at
  all; the storefront's three all have alt text.

---

## 1. The core problem: four surfaces, four design systems

The single largest issue is not any individual defect — it is that the product
has no shared design layer. A customer crossing from the storefront to the
booking portal changes font stack, button shape and corner radius with no cue
they are still on the same shop's site.

| Surface | Route | Stylesheet | Tokens | Font stack | Btn radius | Breakpoints | Dark mode |
|---|---|---|---|---|---|---|---|
| Staff EPOS | `/` | `styles.css` (1,540 ln) | ~25 | Apple / Segoe / Roboto chain | 8px | 3 | none |
| Booking portal | `/book` | `styles.css` + `portal.css` (114 ln) | ~25 | inherited | 8px | 0 own | none |
| Storefront | shop subdomain | `storefront.css` (76 ln) **only** | 3 | `system-ui` | 4px | 0 | none |
| Demo page | `/sdbdemo` | inline, self-contained (938 ln) | ~18 | Bricolage Grotesque + Work Sans + IBM Plex Mono | 999px | responsive | **full** |

`public-demo/sdbdemo.html` is a fully-realised design for the *same booking use
case* as `/book` — custom SVG bike mark, a three-face type system, a
paper/brass/moss palette, working dark mode (`sdbdemo.html:31`) and
reduced-motion support (`:350`). It shares zero tokens, zero CSS and zero markup
with the portal it demos. Every quality bar the product could hit is already
written down in that file and shipped to nothing.

---

## 2. Phase 1 — Critical

Hierarchy, accessibility, responsiveness and correctness defects. These change
what a user can do, not just how it looks.

### C1 — No ARIA anywhere, on any surface

**Surfaces:** EPOS, Portal, Storefront

Zero `aria-*` attributes and zero `role=` attributes across all three production
front-ends (the two `role=` hits in `app.js` are URL query params
`?role=mechanic` / `?role=cashier`, not attributes). No `aria-live` on `#app`,
on the toast container, or on the loading regions — so every status message,
error and content swap in the product is silent to a screen reader.

- `public/app.js` — 0 aria attributes
- `public-portal/portal.js` — 0 aria attributes
- `public-storefront/storefront.js` — 0 aria attributes
- `public/styles.css:1440` — `.toast` has no live-region role

### C2 — Modals have no Escape key and no focus trap

**Surfaces:** EPOS

Twenty-one modals are dispatched from `renderModal()` and none wires an Escape
listener, sets initial focus, traps Tab, or returns focus to the trigger on
close. Dismissal is backdrop-click only, via `wireModalDismiss()`. Escape is
handled in exactly two unrelated places — the till search box and the job
context menu.

- `public/app.js:4616-4642` — the 21-case modal dispatch
- `public/app.js:6791-6795` — `wireModalDismiss()`, backdrop click only
- `public/app.js:435` — Escape, till search only
- `public/app.js:2193-2194` — Escape, job context menu only

### C3 — Three token pairs fail WCAG AA for body text

**Surfaces:** EPOS, Portal

Computed from declared hex values. The `--brand` failure matters most: white on
orange is the primary button treatment for every commit action in the product.

| Pair | Used for | Ratio | Verdict |
|---|---|---|---|
| `#ffffff` on `--brand #d9581e` | `.btn-primary` label | **3.91** | fails AA |
| `--status-complete-paid-ink #6b9484` on `--bg` | Paid/collected job badge, 9.5px | **3.21** | fails AA |
| `--muted #6b7570` on `--bg #f4f5f3` | All secondary text on page ground | **4.36** | fails AA |
| `--muted #6b7570` on `--panel #fff` | Same text inside cards | 4.77 | passes |
| `#ffffff` on `--accent #1f6f5c` | `.btn-accent` | 6.02 | passes |
| `#ffffff` on `--accent-dark #164f42` | Topbar text | 9.41 | passes |
| `#ffffff` on `--danger #c0392b` | `.btn-danger` | 5.44 | passes |
| `#dfeee9` on `--accent-dark` | Idle nav labels | 7.86 | passes |
| `--warn-ink #8a6100` on `--warn-bg #fff7e0` | On-hold badge | 5.18 | passes |
| `--status-scheduled-ink` on its bg | Scheduled badge | 6.91 | passes |
| `--status-waiting_parts-ink` on its bg | Waiting-parts badge | 5.45 | passes |

`--muted` is the most-reused de-emphasis pattern in the app. It passes inside
white panels and fails on the page ground — the worst kind of near-miss, because
it looks fine in isolation.

- `public/styles.css:1-44` — token block
- `public/styles.css:182` — `.btn-primary`
- `public/styles.css:36-37` — complete-paid tokens

### C4 — The booking picker requires horizontal scrolling on every phone

**Surfaces:** Portal

`portal.css` has zero media queries of its own. The week grid it depends on sets
`min-width: 760px` with an `overflow-x` wrapper, so the primary conversion flow
— pick a slot — is a sideways-scrolling seven-column table on any phone, with no
single-day mobile alternative anywhere in the code. Slot rows are 48px tall
snapped to 30-minute intervals: a fine-motor target on touch.

- `public-portal/portal.css` — 0 `@media` queries
- `public/styles.css:859` — `.week-grid { min-width: 760px }`
- `public/styles.css:849` — `.week-grid-scroll { overflow-x: auto }`
- `public-portal/portal.js:50` — `WORKSHOP_ROW_PX = 48`

### C5 — Responsive coverage is three single-component breakpoints

**Surfaces:** EPOS

The entire staff app has three breakpoints, each collapsing exactly one grid:
700px for the cart, 900px for the dashboard two-column, 980px for the workshop
feed. Nothing below 700px exists at all. The topbar, nav, every data table, and
all 21 modals (fixed at `94vw`/`92vh`) have no narrow-viewport handling — data
tables rely on inline `overflow-x:auto` wrappers hand-typed at eight separate
call sites.

- `public/styles.css:306` (700px), `:753` (900px), `:813` (980px)
- `public/styles.css:1256-1262` — `.modal.job-modal` fixed `94vw`/`92vh`
- `public/app.js:2585, 2810, 2973, 3292, 3515, 3599, 3773, 3790` — inline scroll wrappers

### C6 — Touch targets fall below the 24px AA floor on a tablet-first product

**Surfaces:** EPOS, Portal

This is a till and workshop diary — tablet is the expected device. `.btn-sm`
(5px padding + 13px text ≈ 23px tall) is used for every header and nav action in
the booking flow: log in, my bookings, log out, week prev/next. The most-tapped
controls in the customer flow are the smallest in the system.

| Component | Declared | Approx. height |
|---|---|---|
| `.btn-sm` (`styles.css:191`) | `padding: 5px 10px; font-size: 13px` | ~23px |
| `.qty-control button` (`styles.css:610-611`) | `width: 26px; height: 26px` | 26px |
| `.remove-btn` (`styles.css:622-629`) | `font-size: 16px; padding: 2px 4px` | ~22px |
| `.icon-btn` (`styles.css:1454-1460`) | `padding: 5px 9px; font-size: 13px` | ~23px |
| `.month-more-btn` (`styles.css:1184-1192`) | `padding: 1px 5px; font-size: 10.5px` | <20px |
| `.weekday-check` (`styles.css:227-240`) | `padding: 6px 2px; font-size: 12px` | ~24px |
| `.modal-close` (`styles.css:1332`) | `font-size: 22px; padding: 4px` | ~30px |
| `.nav button` (`styles.css:109-117`) | `padding: 8px 14px; font-size: 14px` | ~30px |

`.btn-sm` usage in the customer flow: `public-portal/portal.js:328-330`
(log in / my bookings / log out), `:465`, `:467` (week prev/next).

### C7 — Buy button lies about its state and allows silent double-adds

**Surfaces:** Storefront

On success the label is set to `Added` and never reverts, but
`finally { btn.disabled = false }` re-enables it. A second click adds another
unit to the cart while the button still reads "Added" — the customer gets no
signal that quantity changed. The failure path uses a blocking native `alert()`,
the only synchronous unstyled dialog in the customer experience.

- `public-storefront/storefront.js:121-135`

### C8 — Booking flow state is lost on refresh, with no way back

**Surfaces:** Portal

The chosen date, slot and mechanic live in module-level JS variables, not the
URL. A refresh at any point drops the customer back to `boot()` with the
selection gone and no resume. Cancelling the booking form does the same in one
click with no confirmation. There is no progress indicator, and the auth step is
conditionally skipped for a returning guest, so the flow's depth is
non-deterministic and invisible in advance.

- `public-portal/portal.js:31-33` — `pendingDate` / `pendingSlot` / `pendingMechanicId`
- `public-portal/portal.js:529` — conditional auth step
- `public-portal/portal.js:678-684` — cancel discards silently

### C9 — The Front Desk, the most-used screen, has no primary action

**Surfaces:** EPOS

"New sale" and "Orders" are both plain grey `.btn`. The brand-orange primary
does not appear until the cart and tender screens. Meanwhile `.btn-primary` is
applied to dismissive actions — `Close` and `Done` — in at least four modals, so
the one colour that means "commit" is missing where it is needed and present
where it inverts the meaning.

- `public/app.js:410-411` — Front Desk actions, both plain `.btn`
- `public/app.js:5309, 5510, 5794` — `Close` as `.btn-primary`
- `public/app.js:6782` — `Done` as `.btn-primary`

### C10 — Success and failure look identical

**Surfaces:** EPOS, Portal

`showToast()` is called 129 times and always renders the same dark pill with the
same 2.6-second timeout. "Sale completed" and a server error are visually
indistinguishable, with no colour, icon or `role="alert"`. Route-level failures
use a separate red `.error-banner` idiom used exactly once — so the app reports
errors two different ways depending on where they occur. Field validation is a
third way again: only two places render inline `.field-error`; everything else
funnels form-validation failures into the same undifferentiated toast.

- `public/app.js:147-159` — `showToast()`
- `public/app.js:383` — the sole `.error-banner` use
- `public/styles.css:1431-1438` — `.error-banner`
- `public/styles.css:214` — `.field-error`
- `public/app.js:6050, 4731, 1319, 1358, 6614` — validation via toast

### C11 — Destructive confirmations leave the design system entirely

**Surfaces:** EPOS

Fourteen native `confirm()` calls — deleting products, customers, jobs, team
members, purchase-order lines. These are the highest-stakes moments in the app
and they render in unstyleable browser chrome, next to a product that has 21
hand-built modals available.

- `public/app.js:440, 2743, 3324, 3466, 3681, 3815, 3915, 4001, 4477, 4507, 6344, 6466, 6598, 6699`

---

## 3. Phase 2 — Refinement

Spacing, typography and structure. None of these break a task; together they are
why the product reads as assembled rather than designed.

### R1 — There is no spacing scale, only literals

`:root` defines colour, one radius and one shadow. No spacing token exists, so
every padding, margin and gap is a hand-tuned literal: `9px 16px`, `8px 14px`,
`6px 13px`, `6px 14px`, `7px 10px`, `5px 10px`, `5px 7px`. Neighbouring
components differ by one or two pixels for no recoverable reason. Nine
independent grid systems use gutters of 12, 14, 16, 18, 20, 24 and 28px with no
shared constant.

- `public/styles.css:1-44` — token block, no spacing
- `public/styles.css:173, 113, 458, 510, 560, 191, 688` — sample literals
- Grids: `:300` `.cart-split`, `:748` `.two-col`, `:851` `.week-grid`, `:900`
  `.week-diaries.split`, `:1106` `.month-grid`, `:1474` `.detail-grid`,
  `:1341` `.wj-body-grid`, `:730` `.stat-grid`, `:466` `.payment-split-row`

### R2 — 19 font sizes, no ratio, half-pixel steps

97 `font-size` declarations resolve to 19 distinct px values: 8.5, 9, 9.5, 10,
10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 20, 22, 28. The
recurring half-pixel increments are the tell — these were nudged by eye, not
derived. `app.js` adds further sizes inline that never appear in the stylesheet.
Five weights are in use (400-800), with 700 and 800 both doing "emphasised
number" duty under no stated rule. Only three `line-height` declarations exist
in 1,540 lines; everything else runs at browser default, which is tight for the
9-11px type used throughout job cards and calendar chips.

- `public/styles.css` — 97 declarations, 19 distinct values
- `public/styles.css:413, 1313, 1425` — the only three `line-height` rules
- `public/app.js:477, 974, 2580, 3595, 4217, 5354, 6547, 6571` — inline sizes

### R3 — Two unrelated colour systems that only agree by coincidence

`THEME_PRESETS` hardcodes five full colour trios as raw hex, bypassing the
`--brand` / `--accent` / `--modal-bg` custom properties it duplicates. The CSS
default and the JS preset agree only for "forest" — and the CSS file carries a
comment explaining the duplication exists to avoid a colour flash. Two sources
of truth, documented as such. Separately, `.badge.card`, `.badge.other` and
`.btn-danger:hover` are raw hex in a file where every other badge variant is
tokenised.

- `public/app.js:6892-6896` — `THEME_PRESETS`
- `public/styles.css:38-41` — the documented duplication
- `public/styles.css:707, 709, 189` — untokenised hex
- `public/app.js:2535` — `fill="#000"` on the barcode SVG

### R4 — 21 hand-duplicated modal shells and 106 inline styles

Every modal builds its own backdrop, chrome, header and close button by
copy-paste. They match today only because each was cloned from the last; any
change to modal chrome is a 21-site edit. The same pattern repeats at smaller
scale — 106 inline `style=` attributes in `app.js`, with "space between stacked
panels" (`margin-top:14px`) re-typed at a dozen call sites instead of a single
`.panel + .panel` rule, and "flex row, gap 8" hand-written at least eight times
instead of a utility class.

- `public/app.js:3339, 4017, 4665, 4876, 4999, 5055, 5141, 5197, 5296, 5322,
  5342, 5407, 5496, 5571, 5628, 5675, 5724, 5784, 5821, 6499, 6740` — modal shells
- `public/app.js:3045, 3273, 3767, 3950, 4096, 4195, 4202, 4206, 4210, 4563` — `margin-top` literals
- `public/app.js:807, 1066, 1072, 2960, 2976, 3276, 3433, 3751` — hand-typed flex rows

### R5 — The storefront re-implements the design system badly, in 76 lines

Three custom properties against the app's ~25, and it never loads `styles.css`
at all. Roughly ten hardcoded hex values fill the gap. It invents a second
spacing scale in `rem` (8/16/24/32/48) unrelated to the px scale used elsewhere,
sets no `font-size` on `h1`, `h3` or `p` so hierarchy is whatever the UA
stylesheet decides, and defines no `:focus` rule of any kind.

- `public-storefront/storefront.css:2-6` — only 3 tokens
- `public-storefront/storefront.css:11, 37, 48, 65, 70-75` — hardcoded hex
- `public-storefront/storefront.css:10` — `system-ui` only
- `public-storefront/storefront.css:17, 25, 55, 61` — the rem spacing scale
- `public-storefront/storefront.js:86-119` — no type sizes set

### R6 — Focus is styled for text inputs and nothing else

Three focus rules exist across all three production stylesheets, all for form
fields. No `:focus-visible` anywhere. Buttons, pills, badges, job cards, nav tabs
and modal-close all fall back to browser default — inconsistent next to a
product that replaces defaults elsewhere. Interactive elements are at least real
`<button>` elements throughout, so the keyboard path exists; it is just
invisible.

- `public/styles.css:208-211, 554, 598` — the only three focus rules
- `public-storefront/storefront.css` — 0 focus rules

### R7 — Public pages ship placeholder metadata

The storefront's title is the literal string `Shop` — never updated, even though
the JS fetches the real shop name and uses it for the `<h1>`. `document.title`
is never assigned anywhere in any of the three front-ends. No meta description,
no favicon link, no Open Graph tags: a storefront link shared to WhatsApp or
Slack renders with no preview card and a default browser icon. The portal has a
favicon, but it is the same generic bike emoji for every shop regardless of
branding. Storefront heading order also skips a level — `h1` then `h3` on every
product card, no `h2` on the page.

- `public-storefront/index.html:6` — `<title>Shop</title>`
- `public-storefront/storefront.js:94, 107` — h1 then h3
- `public-portal/index.html:6-7` — static title, generic favicon
- `document.title` — 0 assignments across all three front-ends

### R8 — Emoji is standing in for the brand

The bicycle emoji is the app's logo in the topbar, on the auth screen, in the
portal header and as the favicon on both. There is no SVG mark or wordmark asset
anywhere in the repo — except in the demo page, which has a real custom bike
glyph drawn as inline SVG. Iconography elsewhere is Unicode characters: `✕` for
all 21 close actions (uniform, at least), `+` and `−` as literal button text,
`‹ ›` for week navigation. No icon set, no icon font.

- `public/app.js:339, 6813` — emoji as logo
- `public-portal/portal.js:321` — emoji as logo
- `public-demo/sdbdemo.html:360-365` — the real SVG mark that exists

---

## 4. Phase 3 — Polish (out of scope for the current plan)

Recorded for completeness. Not scheduled — see `DEFER-002`.

### P1 — Zero transitions in the entire product

One `@keyframes` exists across all three production stylesheets —
`workshop-flash-highlight`, which flashes a job card three times when jumped to
from the pending feed. Every hover, every modal open and close, every dropdown,
every toast is a hard instant cut. `showToast` toggles `display` with no fade.
`prefers-reduced-motion` is honoured only in the demo page.

- `public/styles.css:807-811` — the only keyframes
- `public/app.js:147-159` — `showToast` display toggle
- `public-demo/sdbdemo.html:350` — the only reduced-motion guard

### P2 — No skeletons, no spinners, and loading looks like empty

The only loading indicator in the product is the literal text `Loading…`, used
on route change and in two workshop panels. Everything else renders blank until
the fetch resolves, then snaps to full. In the portal it is worse than absent:
loading text is rendered inside the `.empty-state` class, so a slow network and
"there is nothing here" look identical.

- `public/app.js:375, 5932, 5943`
- `public-portal/portal.js:418, 610` — loading rendered as `.empty-state`

### P3 — No dark mode, despite a working one sitting in the repo

No `prefers-color-scheme` query, no `[data-theme]` hook, no alternate palette in
any shipped stylesheet. The theme system only swaps brand accent, topbar and
modal background — ground, panel, ink and border are fixed light values.

- `styles.css` / `portal.css` / `storefront.css` — 0 matches
- `public-demo/sdbdemo.html:31-56` — a complete dark palette, unused

### P4 — Status colour is doing most of the work at 9px

The six-state job status system is well-built — every state has a bg/border/ink
trio applied consistently across four card types. But the accompanying text
labels render at 8.5-9.5px, small enough that across a dense week grid colour is
what a user actually reads. Combined with the failing 3.21 contrast on the
paid/collected variant, the state that most needs to recede is also the hardest
to read when you do look at it.

- `public/styles.css:978-993, 1216-1229` — two near-identical badge rule blocks
- `public/styles.css:36-37` — the failing pair

### P5 — Eighteen labels in the staff app are not associated with their input

Better than first reported: 92 of 110 `<label>` tags in `app.js` carry
attributes and 83 use `for=`; the portal is 12 for 12. But 18 bare
`<label>Text</label>` tags remain, breaking both screen-reader association and
click-to-focus. Separately, the portal's job-type validation error has no
`aria-describedby` tying it to the select it describes.

- `public/app.js` — 18 bare `<label>` tags
- `public-portal/portal.js:643-647` — unlinked field error

---

## 5. What is already right

Four things in this codebase are genuinely systematic. Remediation must preserve
them rather than rewrite through them.

- **Empty states, everywhere.** All ~19 enumerated lists and tables have a
  written empty state, all via `.empty-state` / `.empty-cart`. Not one list
  renders blank. The strongest dimension in the product.
- **The six-state status token set.** `pending` / `scheduled` /
  `waiting_parts` / `on_hold` / `complete` / `complete-paid` each carry bg,
  border and ink tokens, reused consistently across four card types
  (`styles.css:16-37`). The "paid and collected recedes" decision is documented
  inline at `:31-34`.
- **Real buttons, no div-buttons.** Interactive elements are genuine `<button>`
  throughout — no fake-button pattern in either the staff app or the customer
  surfaces.
- **One error path, not five.** Around 90 error sites funnel through a single
  `showToast(err.message)`, with zero `alert()` calls in the staff app. The
  plumbing is right; only the visual differentiation is missing.

---

## 6. Design system: tokens that must exist

| Token group | Currently | Needed for |
|---|---|---|
| Spacing scale `--space-1…8` | Does not exist — all literals | R1, R4 |
| Type scale `--text-xs…3xl` + line-heights | Does not exist — 19 ad-hoc values | R2, P4 |
| Contrast-safe `--muted` | 4.36 on page ground | C3 |
| Contrast-safe `--brand` | 3.91 white-on-orange | C3 |
| Focus ring `--focus-ring` + global `:focus-visible` | Three input-only rules | R6 |
| Motion `--ease`, `--dur-fast/base` | Does not exist | P1 (deferred) |
| Semantic feedback `--toast-ok` / `--toast-err` | Single `--ink` pill for both | C10 |
| Dark palette | Exists only in `sdbdemo.html` | P3 (deferred) |
| Shared stylesheet for the storefront | Loads none | R5, section 1 |

## 7. Out of scope for a visual pass — flagged

Four items need functional changes and sit outside pure visual remediation. They
are in the plan because the audit found them, but each touches behaviour:

- **C7** — the buy-button state machine
- **C8** — booking flow state in the URL
- **C11** — replacing native `confirm()` with an in-app modal
- **R7** — setting `document.title` per shop

**R8 (emoji logo) is flagged, not actioned.** Replacing it needs a real brand
asset. One must not be improvised from styled text or a redrawn shape.
