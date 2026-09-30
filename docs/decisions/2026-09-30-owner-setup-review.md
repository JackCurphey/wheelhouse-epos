# Journey 8, Owner setup — Jack's decisions (30 Sep 2026)

Journey 8 is where a shop's owner and managers set up everything the other
journeys assume: quick buttons and groups, reasons, ways to pay, the float,
closing time, blind counting, staff and roles, clearing a forgotten PIN,
workshop services and mechanics, and a new shop's first-run setup. Settings
lives in the Office room for Owners and Managers only (app map 8); personal
settings stay in Your settings. Designed in the Soft sand look on its own
canvas, desktop first. Rules for every journey apply (Workshop day 45, 48,
50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

Background: approved journeys hand these settings here — till 2, 3, 4, 6,
7, 8, 10, 13, 15; cash-up 2, 4, 5, 6; signing in 6, 9; Workshop day 1, 17,
27, 29, 62, 66. The old placeholder "Set a staff PIN" (manager picks a 4–6
digit PIN) is superseded by signing in 6–7: each person sets their own
Wheelhouse-picked PIN in Your settings; a manager only clears a forgotten
one from the staff list.

1. **Journey 8 is next** (Jack, 30 Sep), chosen over Customer service,
   Opening the shop and Collect the bike and pay.
2. **The Settings page comes first, starting with till and cash-up
   settings** (Jack, 30 Sep): settle the overall shape of Settings, then
   the settings journeys 11 and 16 already rely on, then staff, then
   workshop. First-run setup (the new owner's checklist) comes after, and
   the journey can still split into 8a Settings and 8b First-run setup if
   one canvas gets too large. Chosen over first-run setup first and
   splitting into two journeys straight away.
3. **Settings lists its areas down the left, with the chosen area beside
   them** (Jack, 30 Sep): eight areas — Shop and sites, Staff and roles,
   Till, Payments, End of day, Workshop, Messages, Your data — each one
   click away, the area's settings as folding sections. Chosen over one long
   page of folding sections and a page of area cards. How the list shows on
   tablet and phone is still to draw. Board: `so-list` (setup.mjs).
4. **Settings save as soon as they're changed, with a short "Saved" note
   and an Undo** (Jack, 30 Sep): no Save buttons. Every change is recorded
   (who, when, what it was before). Chosen over a Save button per section
   and confirming only settings that affect money or sign-in.
5. **Each kind of reason has its own list** (Jack, 30 Sep): Till ›
   Reasons holds separate lists for discount, void, refund and paid-out,
   picked by pill; the till's pop-ups show only their own kind, plus
   "Other…". Chosen over one shared list and a Wheelhouse-suggested
   starting set. Board: `set-till-reasons`. Two choices drawn on the Till
   boards stand unless Jack objects: a shop can switch off Print, Email or
   Text in the Paid pop-up ("No receipt" always stays), and a quick
   button's price always comes from its product.
6. **Blind counting starts on for a new shop** (Jack, 30 Sep): settles
   cash-up decision 2's default — staff count first, then see the
   difference; the shop can turn it off in Settings › End of day. Chosen
   over off by default and asking during first-run setup.
7. **Customer accounts have one shop-wide limit, which can be changed for a
   single customer on their page** (Jack, 30 Sep): Payments › Ways to pay
   sets "Most a customer can owe"; a trusted club or regular can be given
   a different limit from their customer page (journey 15). Chosen over one
   limit with no exceptions and a limit set per customer only.
8. **Four fixed roles — Owner, Manager, Staff, Mechanic — plus a few
   per-person switches** (Jack, 30 Sep): each role has a plain
   description of what it can do; a handful of switches on a person cover
   the in-between cases (e.g. a senior mechanic who can see reports). No
   shop-made roles, which also avoids WorkOS's one-way organisation-level
   roles (auth spec §6.2). "Staff" is the till role the auth spec calls
   `cashier`. Which switches exist is the next question. Chosen over fixed
   roles only and a permissions grid.

## Noted for later (not for this journey)

- **Search products by their measurements and specifications** (Jack, 30
  Sep): when stock is booked in, parts can carry bike-specific details —
  a bearing's dimensions, how many gears a derailleur is for — so staff
  can search by them ("bearings with a 30 mm outside diameter") instead of
  by name. Belongs with receiving stock (journey 13), stock control
  (journey 14) and the till and header search.
