# Design

## Context

What exists today (main at `4c9829d0`, checked 11 Nov 2026):

- **Old website settings.** `storefront_settings` (`server/migrations/010_storefront.sql`):
  one row per shop, made the first time it is read — `enabled`, `tagline`,
  `description`, `logo_url`, `hero_image_url`, `theme_preset`. Served by
  `server/routes/website.js` (`GET/PUT /api/storefront-settings`, PUT is
  `ownerOnly`; `POST /api/storefront-settings/logo` and `/hero` through
  `readUploadedImage` with the 5 MB cap). `server/storefront.js` resolves
  `<slug>.wheelhouseepos.com` to the shop and serves `/api/storefront/info`
  and `/products` (`server/server.js:397-403`) to the old customer site in
  `public-storefront/`. Products already carry `show_online`, `description`
  and `photo_url` (010).
- **Old Shopify link.** `shopify_connections` (012) holds an Admin API token
  the shop makes itself; `server/shopify.js` sends products, stock and takes
  orders by webhook (`/webhooks/shopify/`, `server/server.js:555`). It is not
  the "approve in Shopify" flow the drawings show, and needs a real Shopify
  account to try.
- **Payments adapter.** `server/payments/index.js` returns the provider for
  `PAYMENTS_PROVIDER` (`pretend` or none) with `hold`, `status`, `take`,
  `release`, `refund`; `server/payments/provider.js` `paymentsConnected()`
  decides whether booking deposits can be on. It is one setting for the
  whole server, not a connection per shop.
- **Frames to reuse.** Settings page (`src/screens/settings/settings-page.tsx`),
  form box (`src/components/ui/dialog.tsx`), photo picker
  (`src/components/ui/photo-picker.tsx`), choice cards
  (`src/components/ui/choice-card.tsx`). No activity list (block 14) and no
  stage strip (block 24) yet.
- **Permissions.** No roles on the server yet (WP-1.1). Every settings screen
  is "Owner only until roles are built" through `ownerOnly(req, res)`
  (`server/lib/owner-only.js`).
- **Today.** Needs attention is a list of source functions
  (`server/routes/today.js:205`), each returning its items.
- **The move.** No switch-over checklist and no "this shop is moving" state
  yet; both arrive with WP-8.1.

## Goals / Non-Goals

**Goals:**

- One website model — a draft and a published version, with history — that
  the later editor (the "Later" list) can grow into without a second model.
- Customers only ever see the published version, from the first pull request.
- Each outside service (payment provider, Shopify, tracking tools) behind an
  adapter with a pretend version, so every drawn situation can be reached in
  tests and on a developer's Mac with no real account.
- Build first everything that needs none of Mark's unbuilt pieces.

**Non-Goals:**

- The editor, themes, extra pages and the own-address screens.
- The customer-facing shell, cookie banner and checkout (WP-6.2, WP-6.3).
- Real Stripe or Shopify accounts.

## Decisions

### 1. The website model: one row per shop, plus saved versions

New migration (number taken at build time; 130 at the time of writing):

```sql
-- One per shop, made on first read, like storefront_settings.
CREATE TABLE website (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT CHECK (kind IN ('wheelhouse', 'shopify')),   -- null = not set up yet
  set_up_at TIMESTAMPTZ,
  is_on BOOLEAN NOT NULL DEFAULT false,
  draft JSONB NOT NULL,             -- the content below
  draft_saved_by INTEGER REFERENCES staff(id),
  draft_saved_at TIMESTAMPTZ,
  published JSONB,                  -- null = never published
  published_at TIMESTAMPTZ,
  published_by INTEGER REFERENCES staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Published versions and discarded drafts, for History.
CREATE TABLE website_versions (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN ('published', 'discarded')),
  content JSONB NOT NULL,
  changed TEXT[] NOT NULL,          -- the part keys that differed from the version before
  made_by INTEGER REFERENCES staff(id),
  made_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_published BOOLEAN NOT NULL DEFAULT false
);
```

Both get row-level security on `shop_id` like every shop table. The
`staff(id)` reference follows whatever the existing tables use for "saved
by" (checked at build time).

**Content** (`draft` and `published`) is one JSON object:

```json
{
  "parts": {
    "headline":      { "text": "…", "checked": true },
    "about_line":    { "text": "…", "checked": true },
    "big_photo":     { "photo": "url", "description": "…", "decoration": false, "checked": true },
    "workshop_words":{ "text": "…", "checked": true },
    "shop_words":    { "text": "…", "photo": "url", "description": "…", "decoration": false, "checked": true },
    "collection_returns": { "text": "…", "checked": false },
    "privacy":       { "text": "…", "checked": false }
  },
  "logo": "url or null",
  "main_colour": "#2A2822",
  "tracking": [ { "tool": "google_analytics", "id": "G-…", "on": true } ]
}
```

`checked: false` is "Check this": true once that part is saved once.

*Why one JSON draft rather than a table per part:* publish, discard and "go
back" each copy one whole version, which is one assignment with JSON and a
multi-table copy otherwise; the later editor adds keys, not tables. *Why a
new table rather than more columns on `storefront_settings`:* the old row
mixes draft and live (one `tagline` field customers see as soon as it is
saved), which is exactly what decision 2 forbids. On first read, `website` is
seeded from `storefront_settings` (tagline → `about_line`, description →
`shop_words`, logo, hero → `big_photo`) so a shop that already set those keeps
them; `storefront_settings.enabled` keeps being written from `is_on` until the
old customer site is replaced by WP-6.2, so the old site obeys Turn it on and
Turn off.

**Two people saving different parts at once both stay** (the settings spec's
rule): a part is saved with one `UPDATE website SET draft = jsonb_set(draft,
'{parts,<key>}', $1)`, never a read-modify-write of the whole draft.

**Changed parts** are worked out by comparing the draft's parts with
`published`'s, part by part, so the count and list on the Website page are
always true and need no separate record. The page names in the list come
from a fixed map of part → page (Headline, A line about the shop, The big
photo → Home page; The workshop's words, The shop's own words and photo →
About us; Collection and returns; Privacy).

**History keeps 90 days.** A daily clean-up removes `website_versions` rows
older than 90 days except the one matching what customers see now. 90 days
is a default taken overnight on 12 Nov under Jack's answer, for him to
overrule (`docs/decisions/2026-11-12-website-defaults-taken.md`, item 3). The drawn "[n] days" shows 90.

### 2. Routes (the contract)

All under `server/routes/website.js`, staff session, every write
`ownerOnly` (decision 8 changes this after WP-1.1). Each returns the whole
Website page state, so the screen never assembles it from several calls.

| Method and path | Does |
|---|---|
| `GET /api/website` | Page state: `kind`, `isOn`, `neverPublished`, `changes` (list of `{ page, parts }`), `photosWithoutDescription`, `savedBy`, `savedAt`, `parts` (each with `checked`), `ready`, `productCounts` (`goOnline`, `noPhoto`, `noPrice`), `payments` (summary row), `tracking` summary, `address`, `shopify` (when connected) |
| `POST /api/website/set-up` | `{ kind, startWith: 'every' \| 'nothing', logo?, mainColour }` — makes the website, sets `show_online` per step 3, once only (409 if already set up) |
| `PUT /api/website/parts/:key` | Saves one part to the draft; marks it checked |
| `POST /api/website/logo`, `/parts/:key/photo` | Image upload through `readUploadedImage`, as today |
| `PUT /api/website/colour` | `{ colour }` — refused with the reason if it fails the reading check |
| `POST /api/website/publish` | Copies draft → published, keeps the old one in `website_versions`, writes the old site's fields |
| `POST /api/website/discard` | Keeps the draft in `website_versions` as `discarded`, copies published → draft |
| `POST /api/website/turn-on` | Publishes too if never published; sets `is_on` |
| `POST /api/website/turn-off` | Clears `is_on` |
| `GET /api/website/history` | Versions in the last [n] days, newest first |
| `POST /api/website/history/:id/restore` | Keeps current changes as a discarded draft if any, then puts that version in the draft |
| `PUT /api/website/tracking/:tool` | `{ on, id }` — saves to the draft; a wrong ID is kept but the tool reports `waiting` |
| `GET /api/online-orders-settings` / `PUT …` | `buyingOnline` (refused while payments aren't connected) and the Paying online state |
| `POST /api/online-payments/connect` | Asks the adapter for the provider's page address, returns it |
| `GET /api/online-payments/return` | Where the provider sends the shop back; records connected or failed |
| `POST /api/online-payments/test-payment` | Starts the £1 test payment; the result comes back on the same return route |
| `POST /api/shopify/connect` | `{ address }` → the adapter's approval address |
| `GET /api/shopify/return` | Records connected or "Couldn't connect" |
| `GET /api/shopify/preview` | The counts for "Ready to send to Shopify" and the only-in-Shopify list |
| `POST /api/shopify/send`, `/pause`, `/resume`, `/switch-to-wheelhouse` | As drawn |

**Customer side.** `/api/storefront/info` reads `website.published` (never
`draft`) for words, photos, logo and colour, and `is_on` for whether to
answer at all. The tracking tools it reports are the published ones whose ID
is valid, each with its kind, for WP-6.2's cookie choice. This is a public
route, so its pull request is a risky-area one.

### 3. The fixed parts and their starting wording

The seven parts and their order are a constant list in the server, the same
list the screen reads. Starting wording: Headline, A line about the shop and
The workshop's words start from the shop's own details where there are some
(the shop's name, its town); Collection and returns and Privacy start from a
fixed wording and `checked: false`. That fixed wording is not in the
drawings and Privacy needs checking against the law. Default taken 12 Nov
(`docs/decisions/2026-11-12-website-defaults-taken.md`, item 1): for now the starting wording is bracketed gaps like
`[How long customers have to collect]`, so nothing invented reaches a
customer, and "Check this" stays until it's saved. A checked standard
wording replaces the gaps later, as its own change.

The form box for each part is not drawn. It follows the closest built
pattern — the Settings form box with a text box, and the photo picker with a
description field and a "This photo is only decoration" tick (audit M6).
Logged as decided while building.

### 4. Logo and colour

- **Suggested colours** are taken from the logo in the browser (draw the
  image on a canvas, group its pixels, take the two commonest strong
  colours). No new dependency. Each suggestion is named by the nearest
  plain colour name ("Dark blue", "Green") from a short fixed list.
- **The reading check** is the standard contrast rule: white text on the
  colour must reach a contrast of at least 4.5 to 1. The server repeats the
  check on save, so a colour can't get in another way. The screen offers
  only colours that pass, and says why a chosen one doesn't.
- Soft sand charcoal #2A2822 is always offered (drawing).

### 5. Tracking tools

A fixed list in the server: `{ key, name, kind, idCheck, idHelp }`.

| Tool | Kind | ID check |
|---|---|---|
| Google Analytics | Statistics | starts `G-` (from the drawing) |
| Microsoft Clarity | Statistics | letters and numbers, about 10 characters (from memory — check Microsoft's docs when building) |
| Meta (Facebook) Pixel | Marketing | 15–16 digits (from memory — check) |
| TikTok Pixel | Marketing | 20 letters and numbers (from memory — check) |

Only the Google Analytics rule comes from the drawing; the other three are
from memory and are flagged to be checked against each company's own help
pages before the pull request merges. No pasted code is accepted anywhere
(decision 6). A tool with a wrong ID is saved but reported as `waiting`, so
"Switching a tool off keeps its ID" holds and the shop can correct it.
Undo on the toast puts back the tool's previous state.

### 6. Online payments: a connection per shop, through the adapter

New table in the same migration:

```sql
CREATE TABLE online_payment_account (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'failed', 'needs_details')),
  connected_by INTEGER REFERENCES staff(id),
  connected_at TIMESTAMPTZ,
  needs_details_by DATE,
  needs_what TEXT,
  test_paid_at TIMESTAMPTZ,
  payout_last4 TEXT,
  payout_timing TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE online_order_settings (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  buying_online BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`online_order_settings` holds only Buying online here; WP-6.3 adds its other
settings to the same table (default taken 12 Nov, `docs/decisions/2026-11-12-website-defaults-taken.md`, item 4:
this piece builds the Online orders page with only Buying online and Paying
online).

The adapter gains four calls, each with a pretend version in
`server/payments/pretend.js`:

- `connectStart({ returnTo })` → the provider's page address. Pretend: a
  local page with "Finish" and "Cancel", so both outcomes can be reached.
- `connectFinish(query)` → `{ connected, payoutLast4, payoutTiming }` or
  `{ connected: false }`.
- `accountState()` → `{ needsDetailsBy, needsWhat }` or nothing. Pretend:
  set from a test helper, so `ws-pay-more` and `ws-today-pay-more` can be
  shown.
- The £1 test payment reuses `hold`, `take` and `refund` — one payment of
  100 pence, taken and refunded at once — with a key per shop so pressing
  twice makes one payment.

`paymentsConnected()` becomes per shop: the server's provider is set **and**
this shop's `online_payment_account.status` is `connected` or
`needs_details`. That is the switch that turns booking deposits and "Pay now"
on, so it is the money part of this change: every caller
(`server/workshop/deposit.js`, `booking-deposit.js`, `routes/portal.js`,
`routes/workshop-settings.js`) is changed and tested in the same pull
request. Connecting sets `buying_online` on (buy online coverage walk 5).

The refund wording waits for the provider (audit M10): the screen shows the
drawn `[what the provider charges on a refund]` placeholder until there is a
real provider to quote.

### 7. Shopify through an adapter

`server/shopify/` gains an adapter with the calls the drawings need —
`connectStart(address)`, `connectFinish(query)`, `preview()` (counts and the
only-in-Shopify list), `send(products, onProgress)`, `pause()`, `resume()` —
and a pretend version that keeps its own pretend Shopify shop in a table, so
"Couldn't connect", the counts, sending progress and the three drawn problem
kinds can each be produced in tests. The existing token-based code in
`server/shopify.js` is left as it is for the old app; the new screens never
call it. Switching a real shop over to the new flow needs a real Shopify app
account, which is Jack's to create.

"Products in Shopify that aren't in Wheelhouse: [what happens to them]" is
audit H7. Default taken 12 Nov (`docs/decisions/2026-11-12-website-defaults-taken.md`, item 2): they are
left alone in Shopify, and "Ready to send" lists them under the drawn "See
the list of products", with the line "Products in Shopify that aren't in
Wheelhouse: left as they are in Shopify". The pretend version does the
same.

Sending is a background job (the existing job pattern used by the move's
file reading), so "You can leave this page — it carries on" is true.

### 8. Who can change it

Now: `ownerOnly` on every write and on `GET /api/website`; the sidebar hides
Website for non-Owners; a non-Owner opening `/website` gets `ws-no-access`,
whose names are the shop's Owners.

After WP-1.1 (pull request 7): the website routes check "Can
edit the website"; online payments and online orders settings check "Can
change settings"; Shopify connect checks both. `ws-no-settings` appears for
someone with the first and not the second.

### 9. Today

A new source function in `server/routes/today.js` returns the "[payment
provider] needs more details by [date]" item when `online_payment_account`
says so (refreshed from `accountState()` when Today or the settings page
loads, and by the provider's notice when a real one exists).

### 10. Moving from Citrus Lime

`websiteReady(shopId)` (set up, and every part `checked`) is built in the
first pull request and used for the "Check this" rows. The three moving
situations — `ws-page-moving`, `ws-page-switch-over`, `ws-pay-tested-moving` —
need WP-8.1's "this shop is moving" state and switch-over checklist, so they
are the last pull request and wait for it.

### Decided while building (to log in the builder's own month file)

1. History is a list in a form box over the Website page, not the Activity
   list (block 14 isn't built).
2. "SET UP YOUR WEBSITE · STEP n OF 3" is a plain heading line until the
   stage strip (block 24) exists.
3. The Published toasts and the Discard box sit on the Website page, not in
   the editor.
4. The form box fields for each fixed part (not drawn).
5. "View website" opens the old customer site until WP-6.2 replaces it.
6. (Moved to the defaults decision file: History keeps 90 days.)
7. Tracking ID checks for Clarity, Meta and TikTok, checked against each
   company's help pages.

### Sending each change to Shopify as it happens (Jack's answer to Q2, 12 Nov evening)

`ws-shopify-on` says products are "sent as you change them in Wheelhouse".
Jack chose option 1: each change goes on its own, through the pretend
adapter until a real Shopify account exists.

- **The database keeps the list** (migration 150, `shopify_changed`, one row
  per shop and product, with RLS like `shopify_link`). Triggers on
  `products` (insert, or a change to SKU, name, price, photo, stock, "Show on
  website" or active) and on `stock_frames` (a bike held, sold, put back or
  moved) queue the product. That catches every way stock moves (sales,
  refunds, receiving, counts, holds) without touching that code. A product is
  queued only when the shop has a link that isn't stopped and the product is
  active and shown online. A failure to queue is a warning in the log, never
  a failed sale.
- **The background job sends it** (`server/shopify/sending.js`, `liveRound`):
  every 30 seconds (`WH_SHOPIFY_LIVE_MS`) it looks at every shop. While the
  link is idle it sends up to 10 queued products. Paused, changes wait for
  Resume; during a full Send, they wait for it to finish. A product goes
  off the queue only if it didn't change again while it was with Shopify.
- **Problems** work like Send's. A price of 0 isn't sent ("no price"); a
  refusal is listed; Shopify not answering lists the rest of the batch as
  "no answer" for Try sending again, and isn't retried by itself. Each
  product's problem is replaced by how its latest send went.
- **Connecting again or switching to Wheelhouse's website** empties the
  queue.
- **The connected page** goes back to the drawn line, "sent as you change
  them in Wheelhouse". "See what will change" shows only before the first
  Send.
- **Not changed:** a product switched off "Show on website" after it was sent
  stays in Shopify as it was (gap entry 60).

## Risks / Trade-offs

- **The money switch.** Making `paymentsConnected()` per shop changes when
  booking deposits are on for every shop. A shop that has deposits on today
  through the server-wide pretend provider would see them go off until it
  connects. Mitigation: the migration marks every shop that has deposits on
  as connected to the provider already set (only developer and test copies
  can have one), and the pull request's tests cover each caller.
- **The old and new website side by side.** Until WP-6.2 replaces the old
  customer site, publishing writes both `website.published` and the old
  `storefront_settings` fields. A shop that edits the old app's Website
  panel meanwhile would write only the old row; rule 5 lets that old panel
  go once this piece's Website page is merged, and the first pull request
  removes it.
- **JSON content.** Harder to query part by part than columns; acceptable
  because nothing queries one part on its own, and the later editor adds
  keys rather than migrations.
- **Pretend Shopify is not real Shopify.** The drawn counts and problems are
  modelled on what Shopify reports, from memory; the real adapter will need
  checking against Shopify's documentation when an account exists.
- **Starting wording.** Until a checked standard wording exists, the
  Collection and returns and Privacy pages hold bracketed gaps. Turn it on still
  works (the drawing allows turning on with starting wording) and names the
  two pages, so a shop can't miss them.
