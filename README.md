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

## Remote access (optional)

The app itself only ever listens on your PC - it isn't reachable from the
internet unless you deliberately expose it. If you do (e.g. via a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
so you can reach it from your own domain), run `npm run gateway` alongside
`npm start` and point the tunnel at the gateway's port (8080 by default)
instead of the app's port (4000) directly. The gateway is a second, much
simpler process whose only job is to proxy through to the real app when it's
up and show a friendly "offline" page when it isn't - something the app
can't do for itself once it's the thing that's crashed or not running.

```
npm run gateway
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
