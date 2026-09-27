# Release 2, Foundations — the offline core

**Date:** 27 September 2026
**Status:** design agreed in brainstorm with Jack; awaiting his review of this written spec
**Parent:** `docs/superpowers/specs/2026-09-27-release-2-design.md` (piece 1,
Foundations; rule 4 "online first, never down")
**Scope:** the offline core the till and customer screens sit on. Not the till
screens (piece 3), not the Citrus Lime import, not the full sites-and-variants
product layout — each gets its own brainstorm.

## 1. The problem

Jack's shop runs Citrus Lime in a web browser and cannot trade when its
internet, or Citrus Lime, goes down. Release 2's till must work online as normal
and keep selling through an outage, for every shop, with nothing to install and
no extra hardware.

The current till is built to be always online (checked 27 Sep 2026):

- a sale is one `POST /api/sales`; every ID is a database `SERIAL`, and the sale
  id is the receipt number (`server/server.js:1774-1885`,
  `server/migrations/001_init_schema.sql:189-296`);
- no protection against the same sale being saved twice (only the button is
  disabled while sending, `public/app.js:1334`);
- a sale is refused when stock looks too low (`server/server.js:1737-1741`);
- money is `NUMERIC(10,2)` pounds with float arithmetic; no VAT is stored;
- staff are picked by tapping a name, no PIN (`public/app.js:480-490`); sign-in
  is a 30-day session cookie (`server/auth.js:17`);
- no site, till or device record in the schema; no service worker, PWA manifest
  or browser storage in the till.

So the offline core is a new way of recording a sale, not a feature added to
the old one.

## 2. Facts about Jack's shop that shape the design

- Two sites, two to three tills each (four to six tills).
- The till runs in a web browser.
- The card machine is standalone Paymentsense: staff type the amount in. The
  till only records "card, £X". Whether the card machine itself can approve
  payments without internet is Paymentsense's and the shop's setup, not
  Wheelhouse's — to be checked at work.

## 3. What the till does offline

**Staff see** a calm banner — "Offline. Sales are being saved on this till and
will send when the connection is back" — and a count of sales waiting. Nothing
else changes.

**Works offline:**
- ringing up sales from the till's copy of the products, at the prices of the
  last update;
- cash, or recording a card payment;
- printing a receipt with a final receipt number (see §5);
- finding a customer from the till's copy and attaching them to the sale;
- adding a new customer (default 1, §7);
- staff checking in with their PIN, and tapping names for each sale;
- credit-account sales and loyalty (default 3, §7).

**Waits for the connection**, shown as "needs the internet", not a silent
failure: refunds and returns, workshop job payments, editing products or
prices, reports.

**No time limit offline** (default 2, §7). After four hours the banner becomes
more prominent, because prices and customer details may be out of date.

**When the connection returns:** waiting sales send by themselves, in order;
the central system accepts each exactly once; stock goes down; anything that
went below zero lands on a "check these" list; the banner clears when the count
reaches zero.

**Wheelhouse itself being unreachable counts as offline** — the till behaves the
same whether the shop's internet or Wheelhouse's servers are down.

## 4. Staff identity

- The till is signed in once (registered, §5) and stays signed in.
- At the start of the day each staff member checks in once with a short personal
  PIN. This records who is in and when. It works offline: the till holds a
  scrambled (hashed) copy of the PINs.
- For each sale, staff tap their name. Only people checked in that day are shown.
- Check-ins reset overnight.
- A short PIN checked on the till is a presence check, not strong security:
  anyone with the till computer could in principle work out a PIN from its
  stored copy. That fits its purpose here; it is not a sign-in for anything
  beyond the till.
- Not a timesheet. Permission checks for refunds and discounts (asking for a PIN
  on those actions only) are decided in piece 3.

## 5. How it works

**The till page loads without internet.** The till is a page in the modern app
(`src/`). A service worker keeps a copy of the page, so a refresh or a restarted
computer during an outage still brings the till up.

**Each till keeps a local copy** in browser storage (IndexedDB) of: products,
prices and VAT rates; customers; staff with hashed PINs; its site and till
letter; its receipt counter; and its queue of sales waiting to send. Online, the
copy refreshes when something changes centrally, plus a regular check every few
minutes.

**Tills are registered.** A manager registers each till computer once (for
example "Bolton, till 1 — B1"). Its credential renews itself while online so it
never lapses mid-outage. A lost or replaced till can be switched off centrally.

**Every sale is born on the till with its own unique ID.** The central system
records a sale once per ID; a repeat is acknowledged and ignored. Each sale
carries the till's clock time and the time the central system received it.

**Receipt numbers** are the till's letter code plus that till's own running
number (B1-1042). Final the moment they are printed, online or offline. The
exact format is settled in piece 3.

**Stock never blocks a sale**, online or offline. Stock may go below zero; every
product that does goes on a "check these" list for staff. The customer holding
the item is the evidence it exists; correcting stock is piece 2's job.

**Room for a hub.** The local copy and the sales queue are built so that an
optional box in the shop could later sit between the tills and the central
system, without changing how the till works. The hub itself is not built now.

## 6. Data changes, made before any shop data is imported

- Money in whole pence (integer), not `NUMERIC` pounds.
- VAT recorded on every sale line.
- New: sites; tills (site, letter code, credential, active flag, last sync);
  staff PINs (hashed); staff check-ins.
- On sales: the till it came from, the till-made unique ID, the receipt number,
  whether it was made offline, the till's clock time and the received time.
- The new sale path has no stock refusal; below-zero products are flagged.

How existing tables and the legacy till (`public/app.js`) move across — new
tables beside the old, or converting the old in place — is decided in the
implementation plan. Converting money to pence touches every place that reads
those columns, including the workshop quotes, so the plan must list them.

## 7. Defaults agreed

1. **New customers can be added offline.** Anyone who may already exist goes on
   a "possible duplicates" list to merge by hand; nothing merges automatically.
2. **No time limit offline**; the banner grows more prominent after four hours.
3. **Credit-account sales are allowed offline** and checked against the limit on
   sync; any over the limit go on the "check these" list. **Loyalty points are
   added on sync**, not at the till.

## 8. When things go wrong

- **Unsent sales are protected.** The till asks the browser for persistent
  storage; it refuses sign-out, unregistering or clearing while sales are
  waiting.
- **A manager screen shows every till** — last sync and how many sales it is
  holding — so a till stuck offline is visible from anywhere.
- **Honest limit:** if a till computer dies during an outage, its unsent sales
  go with it. Printed receipts are the paper trail for re-entering them. A hub
  would reduce this risk.
- **A sale the central system cannot accept is never discarded** (for example
  its product was deleted meanwhile). It still counts in takings and lands on a
  "needs attention" list with the reason.
- **The price charged at the till stands**, even if the central price changed
  while the till was offline.

## 9. Testing

Automated, each written first and watched to fail:
- the same sale sent twice is recorded once;
- sales arriving out of order end up correct;
- an offline sale reduces stock on sync and flags below-zero stock;
- a PIN check works with no connection;
- the till page loads with the network cut;
- receipt numbers never clash between tills;
- a connection dropped part-way through sending neither loses nor doubles a sale.

In the shop, during run-alongside: unplug the internet on the practice tills,
ring up sales, reconnect, and confirm every sale arrived exactly once.

## 10. Decisions taken in this brainstorm (27 Sep 2026)

| Decision | Reason given |
|---|---|
| Offline covers selling and customer lookup | Selling is what loses money in an outage; customer lookup is cheap once products are local; refunds and workshop payments can wait |
| Stock never blocks a sale, online or offline | The item in the customer's hand exists; stock correction is piece 2's job |
| Till signed in once; staff check in with a PIN at the start of the day, tap names for sales | Jack's choice: prove presence once a day, keep the counter quick |
| Receipt numbers per till (letter + own run) | Final when printed, short, no clashes between offline tills |
| Offline in the browser for every shop; a hub is a later, optional upgrade | Jack first proposed a choice of online-only or online-and-offline with a hub; the browser approach gives every shop offline with no hardware, which is the problem Jack's shop has today |
| Defaults 1–3 in §7 | Proposed and kept by Jack |

## 11. Open, for later

- Whether the Paymentsense machine can approve payments without internet (check
  at work).
- Whether Wheelhouse ever sends the amount to the card machine itself — optional;
  not needed for Jack's shop to switch. Piece 3.
- PIN for refunds and discounts: piece 3.
- Receipt number format detail: piece 3.
- Moving existing tables and the legacy till across: implementation plan.
- Hosting (PL-1) — needed before real money is taken.
