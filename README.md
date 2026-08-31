# Wheelhouse EPOS

A local point-of-sale system for a bike shop: till/checkout, inventory management,
sales history and a dashboard. Runs entirely on your own computer - no internet
connection or npm install required. Each shop creates its own account and signs
in to its own private data.

## Requirements

- [Node.js](https://nodejs.org/) version 22.5 or later (you have this already -
  check with `node -v` in a terminal). It uses Node's built-in SQLite database,
  so there is nothing else to install.

## Running it

Open a terminal (Command Prompt / PowerShell / Terminal) in this folder and run:

```
npm start
```

Then open **http://localhost:4000** in your browser (Chrome, Edge, Firefox all work),
and either create a shop account (shop name, email, password) or log in to an
existing one.

To stop it, press `Ctrl+C` in the terminal. Your data (products, sales, stock)
is saved under `data/shops/` and will still be there next time you run `npm start`.

If port 4000 is already used by something else on your PC, run it on a different
port instead:

```
set PORT=4100 && npm start        (Windows Command Prompt)
$env:PORT=4100; npm start         (Windows PowerShell)
```

## What's included

- **Till** — search or tap products to add them to the sale, adjust quantities,
  apply a discount, take Cash or Card payment (with change calculated for cash),
  and complete the sale. Stock is deducted automatically.
- **Inventory** — add, edit and deactivate products; each has a SKU, category,
  price, cost, supplier and low-stock threshold. Receive stock or make manual
  adjustments from the "Stock" button on each row.
- **Sales History** — every completed sale with a reprintable on-screen receipt.
- **Dashboard** — today's takings and transaction count, low-stock alerts, and
  today's top sellers.

Each shop account starts with an empty inventory - add your own products from
the Inventory screen.

## The gateway, and reaching the app from elsewhere

Everything runs locally in Docker. `docker compose up -d --wait` starts
Postgres, the app, and a gateway, and the gateway is the only one with a
port published to the host:

```
http://localhost:8080
```

The gateway is a second, much simpler process whose only job is to proxy
through to the real app when it's up and show a friendly "offline" page
when it isn't - something the app can't do for itself once it's the thing
that's crashed or not running. Outside Docker, run `npm run gateway`
alongside `npm start` for the same arrangement.

The app's own port is deliberately not published. Reaching the app directly
would bypass the gateway, and the gateway is what makes the client's IP
trustworthy: it overwrites `x-forwarded-for` from the real socket and drops
anything the caller sent in it or in the Cloudflare-style headers. The app
believes those headers only when `TRUST_PROXY=1`, which Compose sets for the
app service precisely because the gateway is the only way in. The per-IP
rate limiter on login and signup depends on this - a client that could
choose its own forwarded address could choose a fresh rate-limit key on
every request.

**This setup is local only.** Nothing here exposes the app to the internet,
and the previous Cloudflare Tunnel arrangement has been removed. Two
features need genuine public reachability and therefore do not work in a
purely local install:

- **Shopify webhooks.** `APP_PUBLIC_URL` must be an internet-reachable URL
  for Shopify to deliver order and refund webhooks. Product and inventory
  pushes still work; incoming webhooks do not.
- **Public storefronts on a subdomain.** `/store/<slug>` works locally;
  `<slug>.wheelhouseepos.com` needs public DNS and TLS.

How the app gets exposed publicly again is an open decision, not an
oversight. Whatever terminates TLS would sit in front of the gateway and
would need to set `x-forwarded-proto` itself, with the gateway taught to
trust it the same way the app trusts the gateway today.

### Public storefronts and `STOREFRONT_BASE_DOMAIN`

Each shop can turn on a public storefront, reachable either at `/store/<slug>`
on the app's own host, or on its own subdomain, `<slug>.wheelhouseepos.com`.
The base domain used for the subdomain form defaults to `wheelhouseepos.com`
and can be overridden with the `STOREFRONT_BASE_DOMAIN` environment variable:

```
set STOREFRONT_BASE_DOMAIN=example.com && npm start        (Windows Command Prompt)
$env:STOREFRONT_BASE_DOMAIN="example.com"; npm start        (Windows PowerShell)
```

Any request whose `Host` header is a subdomain of this base domain is treated
as a storefront slug lookup (e.g. `acme.wheelhouseepos.com` looks up the shop
slugged `acme`), except for a small set of reserved subdomains (`www`, `app`,
`api`, `admin`, `staff`). Because of this, **the staff app itself (or any
other internal service) must never be deployed on a bare subdomain of this
same base domain unless that subdomain is added to the reserved list** in
`server/storefront.js` - otherwise requests to it would be misread as a
storefront lookup and served a storefront "not found" page instead of the
real app.

### Shopify integration: `SHOPIFY_TOKEN_ENCRYPTION_KEY` and `APP_PUBLIC_URL`

A shop can connect a Shopify store (Office > Shopify) to sync products and
inventory and accept online orders. Two environment variables are required
for this to work correctly in production:

- **`SHOPIFY_TOKEN_ENCRYPTION_KEY`** - a secret used to derive the key that
  encrypts Shopify access tokens and webhook secrets before they're stored in
  the database. Without it set, the app falls back to a hardcoded
  development-only key - fine for local testing, but insecure for a real
  deploy since that fallback key is sitting in this repository's source code.
  In production (`NODE_ENV=production`), the app refuses to start at all if
  this isn't set, rather than silently encrypting real shop credentials under
  a key anyone can read.
- **`APP_PUBLIC_URL`** - the app's own public base URL (e.g.
  `https://app.example.com`), used to build the webhook callback URLs
  registered with Shopify (`${APP_PUBLIC_URL}/webhooks/shopify/...`). Shopify
  needs to be able to reach this URL from the internet, so it isn't optional
  for the Shopify integration - connecting a store without it set will fail
  when registering webhooks.

```
set SHOPIFY_TOKEN_ENCRYPTION_KEY=some-long-random-secret&& set APP_PUBLIC_URL=https://app.example.com&& npm start        (Windows Command Prompt)
$env:SHOPIFY_TOKEN_ENCRYPTION_KEY="some-long-random-secret"; $env:APP_PUBLIC_URL="https://app.example.com"; npm start   (Windows PowerShell)
```

## Notes and what's deliberately left out (for now)

- **No per-employee permissions yet.** Each shop's owner can add individual
  employee logins (Office > Edit Shop > Employee Logins), but everyone with a
  login can currently do everything - there's no till-cash-up reconciliation
  or restricted roles yet.
- **No password reset or email verification yet.** There's no email-sending
  set up, so a forgotten password currently has no self-service recovery.
- **No receipt printer or barcode scanner support yet.** Receipts show on
  screen (with a "Print" button that uses your browser's normal print dialog —
  works fine with most USB receipt printers set as your default printer). A
  barcode scanner that types like a keyboard will work with the till search box
  already, since most scanners just "type" the barcode followed by Enter.
- **No card payment processing.** "Card" is just recorded as the payment method
  for your records — you'd still take the card payment on your existing card
  machine.
- **Data lives only on this computer**, one file per shop under `data/shops/`,
  plus `data/accounts.db` holding the login accounts. Back these up
  periodically (copy the whole `data` folder) since there's no cloud sync.

Happy to add any of the above, or things like per-staff logins, password reset,
repair/workshop job tracking, or multi-till syncing, next — just ask.
