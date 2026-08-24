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

## Notes and what's deliberately left out (for now)

- **One set of login credentials per shop, no per-staff accounts yet.**
  Everyone at a shop signs in with the same shop account; there's no
  individual staff permissions or till-cash-up reconciliation yet.
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
