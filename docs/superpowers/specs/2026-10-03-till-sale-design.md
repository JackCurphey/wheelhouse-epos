# The till: a sale and taking payment (piece 1)

**Journey 11, "Selling at the till"**, decided 29 Sep
(`docs/decisions/2026-09-29-selling-at-the-till-review.md`) and drawn by
`docs/design/user-journeys/generator/till.mjs`. This is the full Wheelhouse
till. A Lightspeed-connected shop has no Till (journey 21), and nothing here
changes that. Built under Jack's "keep going" for this session.

## Intent

Staff can ring up a sale in the new staff app and take the money: search or
scan items, tap a workshop service, change a price or quantity, then take
payment by card, cash, or both. The sale is saved and stock comes off.

## What this piece builds

- **The till page** at `/workshop/till`.
  - **Left side:** search or scan, the same search as Add item. Under it,
    the **Workshop** quick buttons are the shop's active services, each with
    its price and minutes. They are real data, not placeholders.
  - **Right side, the Sale basket:**
    - each line shows its name and a second line ("Part · SKU" or
      "Labour · 30 min");
    - each line shows its price;
    - a part has a − / + quantity stepper, and its price each shows when the
      quantity is above 1;
    - **Clear** empties the sale;
    - **Total**, then **Take payment · £…**. With nothing in the sale, the
      basket says "Nothing in the sale yet" and Take payment is disabled.
  - **Decision 5:** a part sold past its stock is never blocked. Its line
    says "Stock says 0 — sold anyway", or "Stock says N — sold anyway" when
    the quantity is more than the N in stock.
- **Tap a line (decision 3):** a pop-up in the middle with **Price each**
  ("The usual price is £…"), **Remove from sale**, Cancel and Done.
- **Take payment:**
  - Title "Take payment · £…", with "Jo Taylor serving · 3 items" under it.
  - **Card · £…** is the main button. Then **Cash**, then **Split**.
  - **Card:** the card machine isn't connected yet (decision 6's provider is
    still unchecked). So the card step is the drawing's own fallback: "Key
    £… into the card machine", then **Card approved** once the machine says
    so, or Back.
  - **Cash:** buttons for the amount handed over (the exact amount, then the
    next round £5, £10, £20 or £50), or type it. Then **Change to give**, and
    **Cash taken**. It is "Cash taken" and not "· open the drawer", because
    nothing opens a drawer yet.
  - **Split:** take part in cash and part by card. The cash part is typed;
    the card part is the rest. "Still to pay" shows what remains.
- **Paid (decision 7):** a tick, the amount, how it was paid, the change to
  give, and **No receipt**. "Next sale starts in 5 seconds" counts down,
  then the basket clears for the next sale.
- **Who's serving:** the signed-in person, when their login is linked to a
  staff member who can take sales. Otherwise Take payment first asks
  "Who's serving?" from the shop's staff who can take sales.

## Server

- `GET /api/auth/me` also returns `employee: { id, name, isCashier }`: the
  active staff member the login is linked to (migration 013), or null. The
  field is only added; nothing existing changes.
- `POST /api/sales` takes `sellPastStock: true`. With it, a part with too
  little stock is sold anyway and its stock goes below zero (decision 5).
  Without it, nothing changes: the old app and Shopify orders still refuse.

No database change.

## Not in this piece (each needs more work, most of it database)

- A **discount** with a reason, on a line or the whole sale, and a line's
  **note**. There's nowhere to keep the reason or the note yet.
- **Gift card or credit, On account, Deposit, Other**, refunds and voids
  (decisions 8–15).
- **Print, Email or Text receipts**, and a receipt number.
- The **card machine link**.
- **Park**, adding a **customer**, quick-button groups the shop sets up,
  **sizes and colours**, frame numbers, and paying for a **workshop job**
  from the till.
- The **VAT line** under the total. Products carry their own VAT rate and
  services don't yet, so a single figure would be a guess.
- Each part of a split is saved together at the end, not "as it goes".

## Tests first

- Server (`tests/till-sale-server.test.js`):
  - `/api/auth/me` with and without a linked staff member;
  - `sellPastStock` sells past stock and the stock goes negative;
  - without it, the sale is still refused.
- Screen (`tests/screens/till-page.test.js`):
  - quick buttons from services, and adding by search or scan;
  - the stepper, the stock warning, and Clear;
  - the line pop-up's price and Remove;
  - card, cash (the note buttons and change) and split, each saving the
    right amounts to `POST /api/sales` with `sellPastStock`;
  - the Paid pop-up clears the sale;
  - Who's serving when the login isn't linked.
- A browser test through the real server: a card sale and a cash sale save,
  and stock comes off.
