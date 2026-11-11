WP: WP-5.1

This change also finishes WP-1.3's last line, the till's quick buttons in Settings. The build board's line for it reads "the till's quick buttons aren't in Settings yet".

## Why

Two board items are partly done.

**WP-1.3, the Settings frame:**
- Its rooms and folds are built (#339).
- The drawn first fold, Front desk › Till › Quick buttons (`set-till-quick`), was never built.
- The till still shows every active workshop service under one "Workshop" heading (`src/screens/till/till-page.tsx:147`). Its header comment says "Not here yet: … quick button groups the shop sets up".

**WP-5.1, Owner setup:**
- Built: shop details, hours, the Stockroom, signing in and tills.
- Still missing, per the build board: staff and roles, ways to pay, end of day.

This change covers quick buttons, End of day, and Ways to pay's Cash card. Staff and roles waits for Mark's roles (WP-1.1). Jack answered the change's three questions on 11 Nov (`docs/decisions/2026-11-11-settings-rest-answers.md`), and they are folded in here. **Nothing is built yet.** A builder session builds from this change.

## What Changes

### Quick buttons (WP-1.3)

Drawings: `set-till-quick`, `set-till-quick-add`, `set-till-quick-saved`, `set-till-empty`.

**The Quick buttons fold.** Settings › Front desk › Till gets this fold, as drawn in `setup.mjs` (`quickOpen`):
- Group pills (drawn: Workshop, Parts, Accessories), with "+ Add a group".
- The chosen group's buttons in order. Each row has:
  - a 44px drag handle, labelled "Move [name] — drag, or use the arrow keys";
  - its name;
  - a line saying what it is ("Labour · 60 min");
  - its price.
- Hovering a row shows **Edit** and an outlined **Remove**. Right-click and long-press show them too.
- "+ Add a button", with the note "Buttons show on the till in this order."

**The Add a quick button box** (`set-till-quick-add`):
- "To the [group] group".
- "Find a product or service".
- The picked item, with its kind and price.
- "Name on the button", filled in with the item's name.
- The note "The price always comes from the product."
- The group pills.
- Cancel and "Add the button".

**Saving.** Changes save as you go. Adding a button shows "Saved · [name] added to [group]" with Undo (`set-till-quick-saved`; owner setup decision 4).

**What a shop starts with:**
- **Shops already using the app** get their active workshop services copied into a "Workshop" group, in their current order, so no till goes blank (Jack's answer 1).
- **A shop that signs up later** starts with none. It sees "No quick buttons yet" and "Add the things you sell most — they'll show on the till, one tap each.", and the fold's summary reads "None yet" (`set-till-empty`).

**The till's left side:**
- Shows the shop's groups as pills, and the chosen group's buttons in the shop's order.
- One tap adds the item to the basket through the till's existing `add()`, at the product's or service's own price (selling at the till decision 2; owner setup decision 5).

### End of day (WP-5.1)

Drawings: `set-eod`, `set-eod-close`, `set-save-failed`.

**The Close the day fold:**
- "Show “Close the day” in the till bar", with three choices: At closing time, 30 minutes before, and 1 hour before.
- The note "Owners and managers see it on every till from then on. Closing time comes from the opening hours.", with "Change opening hours" (owner setup decisions 17 and 18).
- The till's fixed "an hour before" (`server/lib/close-entry.js`) becomes the shop's choice.
- **Every shop starts on 30 minutes before**, including shops already using the app, which move from the old fixed hour. This follows decision 18 and Jack's answer 2.

**The Counting the cash fold:**
- One switch, "Count first", on to start (owner setup decision 6; cash-up decision 2).
- Turned off, Close the day shows what the till expects while the cash is counted.
- It is one setting for the whole business (cash-up review, later change).
- The fold isn't drawn open, so it follows the built switch-row pattern and is logged as decided while building.

**A failed save** shows "Not saved — no internet connection. Your change is kept here." (`set-save-failed`), as every Settings fold already does.

### Ways to pay (WP-5.1)

Drawing: `set-pay-ways`.

- **Now:** the Ways to pay fold gains the drawn **Cash** card, "Always on", with no switch.
- **Later** (Jack's answer 3): Other ways to pay (`set-pay-other`), the Card, Gift cards and Deposits switches, and Store credit's "Customers earn back [n]%". Each comes with the till piece that makes it work, as already logged: "card machine and ways to pay come with their pieces" (`decided-while-building.md` line 3939).

### Not in this change, and why

- **Staff and roles** (`set-staff*`): waits for Mark's roles (WP-1.1).
- **Other ways to pay and the other Ways to pay switches**: these come later, per Jack's answer 3.
- **The card machine** (`set-pay-card`): waits for a real provider account, which is Jack's call (STATUS: Stripe and the S700 reader).
- **The Till fold's other boards** (`set-till-reasons`, `set-till-receipts`' Print/Email/Text, `set-till-printer`): later WP-5.1 pieces.
- **Workshop settings, Your data and Getting started** (`fr-today`): other WP-5.1 pieces.
- **How sales are saved:** nothing changes how a sale, payment, refund or close is saved. Mark's areas stay untouched: Take payment (`src/screens/till/pay-dialog.tsx`), `server/till/**`, sales step C and the till deposit.

## Who and risk

Jack's side, built by one builder session in four pull requests (`tasks.md`).

**The four risky areas:**

1. **Migrations:** touched. PR 1 adds the quick-button tables and copies existing shops' services into them. PR 4 adds two End of day columns. Each needs `/review` and the `risky-area-reviewer` agent.
2. **Money and stock:** not touched. Nothing writes a sale, payment, refund or `stock_qty`. Two places sit beside Mark's money area, and are named so he can agree them:
   - **PR 3 edits `src/screens/till/till-page.tsx`**, the till's left side only. It changes what the quick-button grid reads. It still calls the existing `add()`, which is unchanged. The file isn't on the risky list, but the till's sale screen is Mark's, so **PR 3 waits for Mark's yes**.
   - **PR 4 edits `src/screens/till/close-the-day.tsx`**. When Count first is off, it shows the expected figure while counting. The server already sends that figure, and no close is saved differently. PR 4 also edits `server/lib/close-entry.js`, which decides when the button shows and writes nothing.
3. **Sign-in and public routes:** new routes only call `ownerOnly()`. `server/lib/owner-only.js` is not changed, and nothing goes under `/api/portal/*`.
4. **The core:** `server/server.js` is not changed. Route files are listed in `server/routes/index.js`, as every route file is.

It is not a small piece: it has migrations, and it is well over 200 lines.

## Follows

**Drawings** (in `docs/design/user-journeys/generator/`: `setup.mjs`, `settings-frame.mjs` and `till.mjs`; screen ids in `journeys.mjs` j08):
- `set-till-quick`, `set-till-quick-add`, `set-till-quick-saved`, `set-till-empty`
- `set-eod`, `set-eod-close`, `set-save-failed`
- `set-pay-ways`
- The till's left side in `till.mjs` (`leftSide`)

**Decisions:**
- `docs/decisions/2026-11-11-settings-rest-answers.md`: Jack's answers 1 to 3 for this change.
- `docs/decisions/2026-09-30-owner-setup-review.md`:
  - 4: save as you go, with Undo.
  - 5: a quick button's price comes from its product.
  - 6: Count first starts on.
  - 17: "Count first"; Close the day follows closing time; empty lists are drawn; 44px keyboard-movable handles; outlined Remove.
  - 18: the three choices, and 30 minutes before for a new shop.
- `docs/decisions/2026-09-29-cash-up-review.md`:
  - 2: each shop chooses whether the count is blind.
  - 5: Close the day shows after a time the shop sets.
  - The later change: one setting for the whole business.
- `docs/decisions/2026-09-29-selling-at-the-till-review.md`, decision 2: quick buttons in groups, set up by the shop.
- `docs/decisions/2026-10-19-owner-only-settings.md`: Owner only until roles.
- `docs/decisions/decided-while-building.md`:
  - line 2388: Ways to pay names only what is built;
  - line 3939: card machine and ways to pay come with their pieces;
  - line 4717: Close the day shows an hour before closing until this setting is built.
