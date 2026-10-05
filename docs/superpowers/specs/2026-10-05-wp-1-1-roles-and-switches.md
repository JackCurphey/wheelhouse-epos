# WP-1.1 Roles and switches — the table (issue #132)

**Intent.** Before WP-1.1 starts, one table says who can do what: the four
roles, the nine switches, their defaults, what existing logins become, what a
person working by PIN can do, and which server routes check which switch.
Codex finding 6 (`docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md`
line 49) found the plans said "eight switches" and the server knew only the
owner flag. Jack's answers on 5 Oct are in
`docs/decisions/2026-10-05-roles-and-switches.md` (cited below as **R1–R10**).

This is the table WP-1.1's contract builds on. Mark writes the contract and
builds the server half (split plan §4.3, §6); route guards marked
*(proposed)* are his to confirm or change in that contract, and Jack's to
overrule. Everything else comes from a recorded decision.

Sources, shortened: **OS** Owner setup (`2026-09-30-owner-setup-review.md`),
**SI** Signing in and access, **WT8** walk-through 8
(`2026-10-03-ux-walkthrough-8.md`), **RA** Reports and accounts, **MO**
Management oversight, **Q6** `2026-10-03-build-plan-questions.md`.

## 1. The four roles

Fixed; no shop-made roles (OS 8). "Staff" is the till role the old auth
spec calls `cashier`.

| Role | Can do | Lands on | Who gives it |
|---|---|---|---|
| Owner | Everything, including adding and removing people and tills (OS 10, 17) | Office › Today | One per shop: the person who set the shop up (`server/auth.js`) |
| Manager | Everything except adding and removing people and tills, making Managers, the alert amounts and signing out the Owner's devices; every switch, always on (R5) | Office › Today | Only the Owner (R5) |
| Staff | The till, customers, messages, stock and the workshop diary, plus the switches given | Front desk › Till | The Owner adds them; switches change as §3 says |
| Mechanic | The workshop diary and jobs, plus the switches given | Workshop › Diary | The Owner adds them; switches change as §3 says |

Where each role lands after signing in: App map 11.

## 2. The nine switches

All per person, on the person pop-up in Settings › Office › Staff and roles
(OS 20). Owner and Manager have switches 1–7 by role. "Give everything a
Manager can do" turns on 1–7 **and** everything kept for Managers in §4
(R1).

| # | Switch | Staff default | Mechanic default | Notes |
|---|---|---|---|---|
| 1 | Can use the till | Included by role | Off; on for a Mechanic added "till only" (Staff and roles drawing, `setup.mjs`) | |
| 2 | Can see reports | Off | Off | Reports without costs (RA 5) |
| 3 | Can see costs and margin | Off | Off | Turning it on also turns on 2 (OS later change; RA M14) |
| 4 | Can close the day | Off | Off | Also: Today's Tills and Needs attention; Cycle to Work money steps; reopening a closed day (R6) |
| 5 | Can order stock | Off | Off | Orders, suppliers, the restock list; also starting and applying a stock take (R6) |
| 6 | Can edit the website | Off | Off | Connecting Shopify needs 6 and 7 |
| 7 | Can change settings | Off | Off | Includes Staff and roles and clearing a forgotten PIN (§3); nobody switches off their own (OS 10) |
| 8 | Works in the workshop | Off | On | A diary column, can be picked on a booking, has "Me" (OS 11). Off by default for Owner and Manager *(proposed)* |
| 9 | Customers can book this person online | Off | On | Shown only when 8 is on (OS 11) |

No tenth switch: a "Can give till PINs" switch was turned down (SI, later
change), and so was limiting stock adjustment to switch 5 (Stock control 6).

## 3. Who can change what

- Only the Owner adds or removes people, registers or removes tills, and
  makes or unmakes a Manager (OS 10; R5).
- Managers, and anyone with switch 7, change other Staff and Mechanics'
  switches. Nobody changes their own role or switches (R5). Moving someone
  between Staff and Mechanic follows the same rule *(proposed)*.
- Only Owners and Managers turn switch 7, or "Give everything a Manager can
  do", on or off for someone (R7). Someone with switch 7 changes the other
  switches only, so two colleagues can't promote each other.
- PINs: anyone changes their own (SI 6). Clearing a forgotten PIN: Owner,
  Manager or switch 7 (OS 10). Giving a first or new PIN: Owner or Manager
  (SI later changes), or "Give everything" (R1). Never your own, and
  never someone above you *(proposed: otherwise someone could give the
  Owner a PIN they know and open the Owner's pages on a workshop
  computer)*. The order runs Owner, then Managers and anyone with "Give
  everything", then every other Staff and Mechanic. So a Staff member with
  switch 7 clears other Staff and Mechanics' PINs, only the Owner clears or
  gives a Manager's, and nobody else touches the Owner's.
- A Manager gives only the shops they work at; the Owner gives any shop
  (second walk 9d). Which shops a person works at is a per-person list, not a
  switch; WP-1.4 keeps it and checks it on every request
  (`specs/2026-10-05-wp-1-4-shops-and-sites.md` §2, §3).
- Adding or removing people, changing roles or switches, and registering or
  removing tills need an email sign-in; they are never offered by PIN on a
  till or workshop computer (R2).

## 4. Kept for Owners and Managers (and "Give everything a Manager can do")

No single switch gives these; a Staff member gets them only with "Give
everything a Manager can do" (R1): the activity log (MO 5); the three Today
alerts (MO H4); Cycle to Work on Today (Cycle to Work review) and the
"Owed by Cycle to Work providers" report (RA, later change); "All shops" (Multiple sites 1); giving a first or
new till PIN (SI later changes); Owner and Manager pages on a workshop
computer (WT8 3). Owner only, always: the alert amounts (MO M7) and signing
out the Owner's devices (MO M6).

## 5. What existing logins become (R4)

| Today | Becomes |
|---|---|
| The Owner's login (`logins.is_owner`) | Owner |
| A login whose staff member is ticked as a mechanic (`is_mechanic`) | Mechanic, switches 8 and 9 on |
| Any other login | Staff |
| A staff member with no login | A "No email — till only" person: Mechanic if ticked as a mechanic, else Staff; switch 1 on; a mechanic also works at a workshop computer by PIN (R8) |

Nobody becomes a Manager automatically; the Owner makes Managers after the
move. For every role *(proposed, beyond R4)*: a staff member ticked as a
cashier (`is_cashier`, who can sell today) keeps switch 1, so a mechanic who
also serves at the till can still sell; one ticked as a mechanic keeps
switch 8, so an Owner who works on bikes stays in the diary. Two routes are unguarded today and get guards here:
`PUT /api/employees/:id` and `DELETE /api/employees/:id/permanent` (§7.7).

## 6. Working by PIN

| Where | Who | Can do |
|---|---|---|
| Till, nobody checked in | — | The PIN screen only (WT8 M6 part 1) |
| Till, a person checked in | Their role and switches | Selling needs switch 1; the rest of the shop as that person, except §3's sign-in-only changes (R2). With trust PIN on, anyone checked in on that till today takes over by tapping their pill, no PIN (R10) |
| Till, a "till only" person | Staff or Mechanic, switch 1 on | The till, Front desk › Online orders, booking a bike in, handing over a repair paid online — nothing else (WT8 8 and its later change, walk-through 10 M1); checked on the server (§7) |
| Workshop computer, nobody working | — | The PIN screen; with trust PIN on, the names of today's people to tap (R3) |
| Workshop computer, a person working | Their role and switches, including a Mechanic with no email (R8) | Workshop pages; Owner and Manager pages (Settings and §4's pages) only after the PIN of an Owner, Manager or someone with "Give everything", every time (WT8 3; R3), so a Staff member with switch 7 uses Settings from their own phone or the office computer *(proposed)*; no "Change PIN"; not §3's sign-in-only changes (R2). With trust PIN on, anyone who typed their PIN there today takes over by tapping their pill, no PIN (R9) |
| Own phone, laptop or office computer, email sign-in | Their role and switches | Everything their role and switches allow |

**Trust PIN** is one setting for the whole business, covering workshop
computers and tills (R3, R10; #133, S1), off to start *(proposed)*.

**Idle:** a workshop computer left alone for 10 minutes (Q6) goes back to
"Enter your PIN", or with trust PIN on to "Who's working?", which shows
everyone who typed their PIN on it today; a person taps their own name and
carries on (R3). With trust PIN on, the business can change the time
(choices 5, 10, 15 or 30 minutes *(proposed)*) or switch it off (R9). With trust PIN off it is always 10 minutes (R9,
Jack 5 Oct: "1").
The list starts empty each day *(proposed)*.

**Pills:** with trust PIN on, every workshop page ends in a "Working:" strip
of today's people as pills, and the till shows a "Serving:" row of everyone
checked in on it today. Tapping your own makes you the person working or
serving, on the same page, with no PIN (R9, R10); on the till the sale on
screen moves to you too *(proposed)*. With trust PIN on, the strip takes
the place of block 26's "Working: [name] · Switch" bar *(proposed)*, so a
page never has both. Tills already stay checked in until someone checks
out.

**For the contract (Mark).** In plain words: the server has to know who is
working at a shared computer, not just which computer it is. Today a till's requests carry only the till's
token, so the server never learns who is working (`server.js` till
dispatcher). Every request from a till or workshop computer has to carry the
person working, so the server checks their role and switches and records
them (Mark ready as sign-off, Q3). The till's offline copy has to include
the PIN hashes, role and switches of everyone who may check in, not only
`is_cashier` staff (`server/till/snapshot.js`). PINs are 4 digits picked by
Wheelhouse (SI 7); `server/till/pin.js` accepts 4–6 today. With trust PIN
on, a request naming a person who took over by a pill is accepted only if
that person typed their PIN on that device today, checked by the server and
by the till's offline copy *(proposed)*, so a device can't simply claim to
be anyone.

## 7. Which routes check what

161 routes on `main` (the list in `tests/fixtures/route-list.txt`, #150).
**Any staff** = every role, signed in or working by PIN, but not a "till
only" person. The one exception: a till only Mechanic working at a workshop
computer counts as any staff there (R8). A till only Staff member is till
only everywhere. **Till only** = the routes a till-only person may also use
(§6, WT8 8), so the "nothing else" is checked on the server, not just on
screen *(proposed list)*:

- the till: `GET /api/till/:shopSlug/snapshot`, `POST /api/till/:shopSlug/sync`,
  `GET /api/sales`, `GET /api/sales/:id` (refunds start from the sale);
- finding the customer and their bike: `GET /api/customers`,
  `GET /api/customers/:id`, `GET` and `POST /api/customers/:id/bikes`;
- the job: `GET /api/workshop-jobs`, `GET /api/workshop-jobs/:id`, and its
  `book-in`, `collect` and `reopen-custody` actions;
- printing the bike tag or receipt: `POST /api/print-agents/:deviceId/jobs`;
- online orders, when they exist.

Mark confirms in the contract whether a walk-in with no booking
(`POST /api/workshop-jobs`) and a new customer at the till
(`POST /api/customers`) belong on this list.

Each of these is tagged "any staff or till only" below. Numbers are the
switches in §2. *(proposed)* = no decision names it; Mark confirms in the
contract. WP-1.1's route test should require every route to declare one of
these guards, so a new route can't be left open by accident.

### 7.1 Sign-in (4)
`POST /api/auth/signup`, `/login`, `/logout`: public (replaced by WorkOS in
WP-1.7). `GET /api/auth/me`: any staff; returns the role, the nine
switches, the linked staff member and the shops they work at.

### 7.2 Stock (21)
- Any staff: `GET /api/categories`; `POST /api/products/:id/stock` (anyone
  adjusts stock, with a reason, Stock control 6);
  `POST /api/purchase-orders/:id/receive`, and reading the orders waiting
  for delivery (`GET /api/purchase-orders`, `GET /api/purchase-orders/:id`)
  without costs, so they can find and receive one (everyone receives, and
  Staff see "recent deliveries", Receiving 4) *(proposed: the list shows
  only orders waiting for delivery unless 5)*.
- `GET /api/products`: any staff, with `cost` removed unless 3 or 5.
- Switch 5: purchase orders (every order in the list, create, edit, mark
  ordered, cancel; Receiving 4); suppliers and the supplier catalogue *(proposed)*;
  creating, editing, deleting products and their photos *(proposed)*.
- A delivery's costs show only with 3, or 5 *(proposed: whoever orders
  sees the prices they order at)* (Receiving: "Staff see a delivery without costs").

### 7.3 Customers, bikes, texts (17)
Any staff for customers, bikes, their history and texts; any staff or till
only for finding a customer and their bikes, and adding a bike (§7). Switch 7 for
customer groups and a customer's credit limit *(proposed)*. Deleting a
customer: Manager or 7 *(proposed)*.

### 7.4 Till and sales (13)
- Switch 1: `POST /api/sales` and the sale-document routes *(proposed)*.
- Any staff or till only: `GET /api/sales`, `GET /api/sales/:id` (refunds
  start from the sale).
- Switch 4: `GET /api/till-attention`, `POST /api/till-attention/:id/resolve`
  (opening the shop 4).
- Till device, with the person checked in (any staff or till only): `GET /api/till/:shopSlug/snapshot`,
  `POST /api/till/:shopSlug/sync` (each sale's person needs switch 1)
  *(proposed)*.

### 7.5 Workshop jobs and quotes (38)
Any staff, including the 18 job-action routes and the staff quote routes:
the workshop is every role's (Staff: "the workshop diary"). Switch 8
decides who can be given a job, not who can open one. Any staff or till only: the job list,
one job, and booking a bike in and handing it over (`book-in`, `collect`,
`reopen-custody`; WT8 8). `finish` is "Mark ready", recorded as the person
working (Q3). `DELETE /api/workshop-jobs/:id`: Manager or 7 *(proposed)*.

### 7.6 Workshop settings (15)
Any staff to read settings, services, categories, unavailability and
capacity. Switch 7 to change workshop settings, services and service
categories. Unavailability: anyone for their own time off; 7 for weekly
hours and other people's *(proposed)*.

### 7.7 People and devices (21)
- Owner only, by email sign-in (R2): `POST /api/team`,
  `/team/:id/deactivate`, `/reactivate`, `/attach-login`,
  `/team/logins/:loginId/deactivate`, `/reactivate`; `POST /api/tills`,
  `/tills/:id/deactivate`; `DELETE /api/employees/:id/permanent`;
  `POST /api/sites` *(proposed: OS 10 names people and tills, not sites)*.
- Switch 7, never one's own, by email sign-in (R2, R5):
  `PUT /api/employees/:id`, `POST /api/team/logins/:loginId/attach-roles`.
  Within those, making or unmaking a Manager is Owner only (R5), and turning
  switch 7 or "Give everything" on or off is Owner or Manager only (R7).
  `GET /api/team`: switch 7 *(proposed)*.
- `PUT /api/employees/:id/pin` is replaced, as §3 says: "change my own PIN"
  for anyone (SI 6); "clear a PIN" for Owner, Manager or 7; "give a PIN" for
  Owner, Manager or "Give everything" (SI later changes; R1, R5); both only
  for someone below you *(proposed)*.
- Any staff: `GET /api/employees`, `GET /api/sites`. Any staff or till only:
  printing (`POST /api/print-agents/:deviceId/jobs`).
- Switch 4 or 7: `GET /api/tills` *(proposed)*. Switch 7:
  `GET /api/print-agents` *(proposed)*. The print agent's own check-in and
  completion: the device *(proposed)*.

### 7.8 Website and shop settings (10)
Any staff to read label settings and the shop theme. Switch 7: label
settings. Switch 6: the theme, storefront settings, logo and hero picture,
reading the Shopify connection. Switches 6 **and** 7: connecting Shopify
(Website H6).

### 7.9 Today (1)
`GET /api/dashboard`: the money parts (takings, top products by revenue)
need 4 or 2; low stock is any staff *(proposed)*.

### 7.10 Customer pages (21)
`/api/portal/:shopSlug/*`: no staff guard; customer session, booking-link
code or public, as today. The mechanics list and online booking use switch
9, not `is_mechanic`. Whether workshop people who can't be booked online
still count toward walk-in capacity: *(proposed)* yes.

### 7.11 Not built yet
Online orders: a "till only" person can open them (WT8, walk-through 10 M1). Reports: switch
2, costs and margin 3. Stock take: 5 (R6). Reopening a day: 4 (R6). Activity
log: §4. Workshop computers: the Owner makes one (WT8 1).

## 8. Left for later


- Which shops a person works at, and how every shop-scoped route checks it:
  WP-1.4 (`specs/2026-10-05-wp-1-4-shops-and-sites.md`, #133).
- Drawn 5 Oct (R3, R8, R9, R10): `till-checkin-workshop-names` ("Who's
  working?"), `workshop-working-pills` and `till-serving-pills` (the pills),
  the Trust PIN and go-back-to-the-start lines on `set-till-quick`, and the
  till-only pop-up's line for a Mechanic. WP-1.7 builds the workshop
  computer; the till's pills come with the till (WP-3.1).
