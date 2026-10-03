# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Updated:** 2026-10-02. **Merged to `main`:** #90, #91, #92 (names), #93
(Fjell design system). **Current branch:** `feat/workshop-diary-design` (not
pushed, no PR yet) — the Workshop day redesign drawings and Jack's decisions.

**Resume here:** read `docs/design/user-journeys/HANDOVER-next-journey.md` —
Workshop day (journey 12), App map and navigation (journey A), Signing in
and access (journey B), Selling at the till (journey 11), End-of-day
cash-up (journey 16), Owner setup (journey 8), Customer service (journey
15), Opening the shop (journey 10), Moving from Citrus Lime (journey 9) and
Collect the bike and pay (journey 5), Receiving stock and purchase orders
(journey 13), Stock take and stock control (journey 14), Book a repair
(journey 3), Drop off and approve the quote (journey 4), Account, history
and reminders (journey 7), Multiple sites (journey 19), Reports and
accounts (journey 17), Buy online / click and collect (journey 2), Find
the shop and browse the website (journey 1), Website management
(journey 18), Management oversight (journey 20), Cycle to Work
(journey 6) and Lightspeed shops (journey 21) are approved and in the big
canvas — every journey is now drawn; the next journey is
Jack's choice (ask him first). The big canvas is **two canvases** (1 Oct, Buy online
decision 10): the staff app (A, 8–21) on the shared link and customers and
the website (B, 1–7) at https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh —
desktop only, each board linking to its journey's own canvas for tablet and
phone (497 and 330 files of 512 each).

**UX walk-through 7 (an owner with two shops) (2 Oct):** the last story;
every recommendation taken and drawn. All seven walk-throughs are done.
Overview: 823 screens, 820 designed. The staff canvas holds 497 of 512 files
— any more screens there need the canvas split (ask Jack). Next: Jack's
walk-throughs with Mark, then a clickable prototype.
**Published, and the staff canvas split (3 Oct):** walk-through 7 is on
every canvas. The staff big canvas reached 510 of 512 files, so it is now two
(Jack: "1"): shop floor (journeys A, 10, 11, 12, 15, 16, 21) keeps the shared
link, https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j (198 files); back
office (journeys 8, 9, 13, 14, 17, 18, 19, 20) is new and private until Jack
shares it, https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4 (305 files).
`build.mjs` PARTS has three entries; each overview links to the other two.
On a big canvas, a sidebar link to a screen that is now on another big
canvas goes nowhere (each journey's own canvas still has every link).

**UX walk-throughs 5 (Cycle to Work) and 6 (a Lightspeed repair) (2 Oct):**
every recommendation taken and drawn: the Cycle to Work sale at the till,
its own takings line and Reports card, Maya told about certificate
differences and holds; Maya's own pages drawn as a Lightspeed shop, the
Lightspeed customer chosen at book-in, hand-over with no work order.
Overview: 819 screens, 816 designed. The staff canvas holds 493 of 512
files. Next: walk-through 7.

**UX walk-throughs 3 (stock) and 4 (a new shop) (2 Oct):** every
recommendation taken without asking (decision 6) and drawn: held stock for
jobs, stock take allows for held stock and movements, Staff can leave an
unknown product for the owner, a first-time till PIN, the website going on
on switch-over morning, no customer messages during practice. Jack Lewis is
the Owner in every example; manager-view boards show "[Manager]". Overview:
766 screens, 763 designed. The staff canvas holds 471 of 512 files. Next:
walk-throughs 5–7.

**UX walk-through 2, a shop day (2 Oct):** 18 findings, every recommendation
taken and drawn (opening, till, online orders, cash-up, reports): an unclosed
day's cash is counted once, online money has its own line, held stock warns
at the till, offline refunds can be noted for later. Report
`docs/design/user-journeys/ux-walkthrough-2-shop-day.md`. Overview: 725
screens, 722 designed. Next: walk-throughs 3–7.

**UX walk-through 1, the repair story (2 Oct):** the first end-of-project
walk-through, a pilot; 20 findings, every recommendation taken and drawn
across journeys 1, 3, 4, 5, 7, 10, 12 and 19 (and app-wide: the ✕ on
pop-ups, a "Don't close things by themselves" setting, two new message
rows). Report `docs/design/user-journeys/ux-walkthrough-1-repair.md`,
decisions `docs/decisions/2026-10-02-ux-walkthrough.md`, and a reusable
script `ux-walkthrough-script.md` for Jack and Mark. Overview: 713 screens,
710 designed. Next: walk-throughs 2–7.

**Leftover screens (2 Oct):** Jack chose to draw the screens still marked
"not designed" except journey 13's supplier screens, which wait for a later
release. Five decisions in `docs/decisions/2026-10-02-leftover-screens-review.md`:
one receipt email (headed "VAT invoice" for company customers), a text
receipt as a link, a receipt-only address when no customer is on the sale,
the till's start-up status as one line on the PIN screen, and a Returning
customers report. Drawn at all three sizes and copied into the big canvas.
UI audit (`leftover-ui-audit.md`): every recommendation taken (decision 6) —
an email for a sale with no customer, a till-sale receipt, the pop-up's
states, a company's VAT number and "Send invoices to", the PIN line saying
what is up to date. The VAT invoice stays a general one for now (Jack).
Overview: 704 screens, 701 designed, 3 left (the supplier screens).

**Journey 21, Lightspeed shops (2 Oct):** approved at desktop, tablet and
phone and copied into the big canvas; 13 decisions in
`docs/decisions/2026-10-02-lightspeed-shops-review.md` — the workshop only,
Lightspeed doing the money; an approved job becomes a Lightspeed work order
by itself; customers linked where Wheelhouse is sure; parts from Lightspeed's
products (quotable from the last copy when it's down, the approved price
winning if it changed); labour priced in Wheelhouse; Wheelhouse shows when
the work order is paid, with a pop-up and a trace when a bike leaves before
payment shows; the owner connects it in Settings › Office with a checklist
(working / not proven yet); no money through Wheelhouse. UI audit
`lightspeed-ui-audit.md`, every recommendation taken. 38 screens, 114
boards. Own canvas: https://claude.ai/artifact/2qnzyGx8enhxbVN17Brpnf .
Generator: `lightspeed.mjs` + `build-lightspeed.mjs --theme sand`; the
switch is `shop-mode.mjs`. Open: Lightspeed's real capabilities unverified
(no test account); website editor without selling, the Customers page's
Lightspeed link and a Diary marker not drawn.

**Journey 6, Cycle to Work (2 Oct):** approved at desktop, tablet and phone
and copied into the big canvas; 8 decisions in
`docs/decisions/2026-10-02-cycle-to-work-review.md` — not a scheme, the
shop's side of a bike sold through one: its own kind of order with stages
(quote to provider's payment), Front desk › Cycle to Work in the sidebar,
bikes held from the quote, bikes to order by a rule the shop picks, providers
listed once with what's owed chased, a quote built from the order and four
messages. UI audit `c2w-ui-audit.md`, every recommendation taken (no
provider process stated as fact; "Who pays what"; costs hidden from staff;
money steps logged). 39 screens, 117 boards. Own canvas:
https://claude.ai/artifact/6NR9hm3Gnc3kX1i57xcRgt . Generator: `c2w.mjs` +
`build-c2w.mjs --theme sand`. Open: the website Cycle to Work quote page
(noted for later); a held bike in the till's search and as sold out online
(not drawn).

**Journey 20, Management oversight (2 Oct):** approved at desktop, tablet and
phone and copied into the big canvas; 7 decisions in
`docs/decisions/2026-10-02-management-oversight-review.md` — one activity log
in Reports for owners and managers (managers see the owner's lines too); a few
alerts on Today above amounts the owner sets, cleared with "Seen"; signed-in
devices in Settings › Office with "Sign out everywhere" on each person and
"Check out" for a till that waits for the sale; "Send feedback" for everyone
with the screen picture's customer details hidden; staff told what's recorded
and able to see their own lines. UI audit `oversight-ui-audit.md`, every
recommendation taken. 24 screens, 72 boards. Own canvas:
https://claude.ai/artifact/XLYiuhFS1WVjS9ohF7G7gf . Generator: `oversight.mjs` +
`build-oversight.mjs --theme sand`. Open: how long records are kept (LEG-05,
shown as [period]).

**Journey 18, Website management (2 Oct):** approved at desktop, tablet and
phone and copied into the big canvas; 13 decisions in
`docs/decisions/2026-10-02-website-management-review.md` — edited on a live
preview with sections and a Theme tab; changes wait for Publish, nothing is
lost (History keeps discarded drafts); any colour with a readability guard
and a chosen list of fonts; ready-made pages built from sections; Office ›
Website for the website, selling rules and payments staying in Online
orders; tracking tools picked from a list; the shop's own web address drawn
but waiting on the business plan's freeze (ECOM-03, for Jack and Mark);
online payments setup for any provider with a £1 test payment; Shopify kept
as a choice, Wheelhouse in charge and Shopify orders in Online orders; a
three-step start. UI audit `website-ui-audit.md`, every recommendation
taken. 58 screens, 174 boards. Own canvas:
https://claude.ai/artifact/RkyxcQZBCaVYfUa8bqixZM . Generator: `website.mjs` +
`build-website.mjs --theme sand`. Open for Jack and Mark: what happens to
products that are only in Shopify when a shop connects; custom web
addresses (ECOM-03). The website is drawn as one for the whole business.

**Journey 1, Find the shop and browse the website (2 Oct):** approved at
desktop, tablet and phone and copied into the big canvas; 8 decisions in
`docs/decisions/2026-10-02-find-the-shop-review.md` — a home page of sections
the shop arranges; category pages with filters made from each category's own
details, nothing ticked for the customer; a product page with photos, size
and colour, specifications and "Ask the shop"; one search box for products,
categories, repairs and the shop's pages; Our shops and a page per shop;
no cookie pop-up unless the shop adds a tracking tool. UI audit
`browse-ui-audit.md`, every recommendation taken. 35 screens, 106 boards.
Own canvas: https://claude.ai/artifact/7g2TbX8jMauaaTqSkvj5CQ . Generator:
`browse.mjs` + `build-browse.mjs --theme sand`. Carried into every
journey's website pages: a skip link, and the footer's "Collection and
returns" and "Cookies". Left open: filter values are placeholders; the
Contact us, Collection and returns and Privacy pages are not drawn; the
tracking-tool setting belongs to Website management (journey 18); each
page's browser-tab title (audit L5) is for the build.

**Journey 2, Buy online / click and collect (1 Oct):** approved at desktop,
tablet and phone and copied into the big canvas; 10 decisions in
`docs/decisions/2026-10-01-buy-online-review.md` — pay online and collect
from a shop, with room left for delivery; each shop chooses what its
website sells (on the shelf, any of its shops, or also ordered in); the
website starts with everything or nothing, then switches on categories and
products; no account needed to buy; card, Apple Pay, Google Pay, gift cards
and store credit; staff see Online orders in three groups with Mark ready
and Hand over; not collected works as for bikes; the shop is chosen once.
UI audit `online-ui-audit.md`, every recommendation taken. 54 screens, 163
boards. Own canvas: https://claude.ai/artifact/QGRBBPUhHRd5rg94XbgAyS .
Generator: `online.mjs` + `build-online.mjs --theme sand`.

**Journey 17, Reports and accounts (1 Oct):** approved at desktop, tablet
and phone and copied into the big canvas; 9 decisions in
`docs/decisions/2026-10-01-reports-and-accounts-review.md` — six ready-made
reports (Sales, Takings and cash-ups, Workshop, Discounts and refunds, Margin
and stock value, VAT), each with "Change what's shown" and "Save as my
report" (just me, or shared with managers); a graph above every report but
VAT, the table always below, graphs switchable off in Your settings; VAT for
the shop's VAT quarter, not filed from Wheelhouse; Xero or QuickBooks gets
one summary per shop per closed day; two switches on a person, "Can see
reports" and "Can see costs and margin" (carried into every person pop-up).
UI audit `reports-ui-audit.md`, every recommendation taken. 34 screens, 103
boards. Own canvas: https://claude.ai/artifact/NXHvoKd8wY8wpAhBYsPRUt .
Generator: `reports.mjs` + `build-reports.mjs --theme sand`.

**Journey 19, Multiple sites (1 Oct):** approved at desktop, tablet and phone
and copied into the big canvas; 12 decisions in
`docs/decisions/2026-10-01-multiple-sites-review.md` — the whole app works
for the chosen shop, with "All shops" for the owner (and managers at two or
more shops); one business with prices and services that can differ by shop,
set on the item; "Works at" per person with a mechanic's days per shop (a day
at one shop only); booking starts with "Which shop?"; Today across all shops;
"+ Add a shop" with a checklist; every till grouped by shop; a till always
sells for its own shop; the shop named under titles on tablet and phone; a
job booked into another shop's workshop arrives there as a request (Jack's
idea, decision 12). UI audit `sites-ui-audit.md`, every recommendation taken.
22 screens, 67 boards. Own canvas:
https://claude.ai/artifact/LXYUo9UQymsN2VyNSynAcB . Generator: `sites.mjs` +
`build-sites.mjs --theme sand`. The switcher's new name and the tablet/phone
shop line were carried into every staff board.

**Journey 7, Account, history and reminders (1 Oct):** approved at desktop,
tablet and phone and copied into the big canvas; 9 decisions in
`docs/decisions/2026-10-01-account-and-reminders-review.md` — one account
page shaped like the staff customer page (bikes with warranty and next
service, store credit, details and how we contact you; one history of
repairs, purchases and messages; your data under it); service reminders
timed per service, with one unticked "Remind me… and ask me for a review"
box at booking and collection; conversations on the website (notes on a
job's page, "Ask the shop a question") answered from a two-pane staff
Messages inbox, replies going the customer's way with a link back; "Your
data": an instant download, deletion as a request the customer can cancel
until staff confirm (store credit warned, not blocking); review requests
off by default, the same link for everyone; one "How we contact you" with
named switches and a one-click "Stop these" in every optional message. UI
audit `account-ui-audit.md`, every recommendation taken. 42 screens, 125
boards. Own canvas: https://claude.ai/artifact/Hoz1q28Frh9M7hNgV2bo3b .
Generator: `account.mjs` + `build-account.mjs --theme sand`.

**Journey 4, Drop off and approve the quote (1 Oct):** approved at desktop,
tablet and phone and copied into the big canvas; 8 decisions in
`docs/decisions/2026-10-01-drop-off-and-quote-review.md` — one page per job
from the booking link to "Ready to collect" (journey 5's ready page now
carries the same "Your booking" line, the tracker at Ready, the pads photo
and "Add a note for the shop"); a four-step tracker with the expected ready
time; a quote answered with ticks set the way the mechanic recommends,
pairs ticking together, "Your answers are final once sent." beside one
button (no confirm pop-up; on tablet and phone the total and button are a
bar pinned below); photos on quote lines; declining all, deposits carried
through, a changed quote, a withdrawn quote; staff send in one click with
Undo, mark each line Needed or Optional with its reason, "Goes with" and a
photo (44px controls); no answer → a reminder, then Today's "No answer
yet", and "Record their answer" for phone answers; Settings › Messages rows
all editable, with the quote reminder as its own line and "Customer's
choice" on Bike ready and Bike still waiting. UI audit `quote-ui-audit.md`,
every recommendation taken. 23 screens, 69 boards. Own canvas:
https://claude.ai/artifact/XWm8FSLNSWC4de3vcCAKWC . Generator: `quote.mjs` +
`build-quote.mjs --theme sand`. Release 1's message thread and update
preferences stay in "Also in this journey". Noted for later: customer
orders (a part ordered in to collect).

**Journey 3, Book a repair (1 Oct):** approved at desktop, tablet and phone
and copied into the big canvas; 13 decisions in
`docs/decisions/2026-10-01-book-a-repair-review.md` — the whole `/book`
flow redrawn on the shop's website in Soft sand: one page a step at a time
(service, bike, when, details) with "Your booking" alongside (a bar on
phone); every service at once; signing in offered, never required; a
two-week strip of days with "Earliest"; optional deposits (a shop setting,
off by default) refunded up to a cut-off, refunded if the shop declines, a
fixed amount for "Not sure" bookings; confirming automatically as a shop
setting; nothing typed is lost (and a dropped payment is checked, never
re-paid); the booking's own page to change the date, answer an offered time
or cancel; "Your bookings" when signed in; Settings › Workshop › Online
booking (new row on the Workshop settings boards); a "Booking messages"
group in Settings › Messages ("10 on"); the diary's request pop-ups gain
deposit versions. UI audit `book-ui-audit.md`, every recommendation taken.
37 screens, 111 boards. Own canvas:
https://claude.ai/artifact/KxkLMpRgFk23oeFJdfuq95 . Generator: `book.mjs` +
`build-book.mjs --theme sand`. Planned: one UX audit across journeys once
all are drawn.

**Journey 14, Stock take and stock control (1 Oct):** approved at desktop,
tablet and phone and copied into the big canvas; 12 decisions in
`docs/decisions/2026-10-01-stock-control-review.md` — Stock opens on one
search (name, barcode, supplier code or a measurement, "bearing 30 mm") with
filter pills and tick boxes; a product's page leads with stock, then
details, then price and cost, with one linked history; sizes and colours as
one product with a grid; bikes by frame number; prices changed in bulk with
a preview and Undo; stock between shops sent, then received, a short
transfer flagged on Today; blind stock takes a section at a time, with
recounts and "Count them as none"; anyone adjusts stock with a reason, big
adjustments on the manager's Today (amount in Settings › Stockroom);
products below zero on Today with "Count them". Decision 10: **each category
has its own details** (Bearings: inner and outer diameter, height;
Derailleurs: number of gears), set in Settings › Stockroom › Categories,
inherited by sub-categories, filling in when a product is added and becoming
filters — replaces journey 13's free-typed measurements. Staff see no cost
or margin and can't change prices or products. UI audit
`stock-ui-audit.md`. 35 screens, 105 boards. Own canvas:
https://claude.ai/artifact/7oZPudk8GGxqY9L1iXBvbV . Generator: `stock.mjs` +
`build-stock.mjs --theme sand`. Parked: a shared tag helper for journeys 13
and 14; radio-button semantics design-wide.

**Journey 13, Receiving stock and purchase orders (30 Sep–1 Oct):**
approved at desktop, tablet and phone and copied into the big canvas; 11
decisions in `docs/decisions/2026-09-30-receiving-stock-review.md` —
deliveries scanned in (everyone can receive; ordering needs "Can order
stock"); an unknown barcode opens "Add this product" with measurements; a
bike's frame number at booking in (the till then picks it); purchase orders
by hand, and a restock list downloading a CSV per supplier's basket; a part
a job waits for flags the job, diary and Overview; a quick invoice check
(totals, a switch in Settings); labels only for what needs one; damaged,
wrong or missing items marked, with a To return list. Decision 7: **Settings
is four pages, one per room** (Front desk, Workshop, Stockroom, Office) —
every Settings board redrawn. Knock-ons: journey 11's frame-number step
picks from stock; Today's restock line. UI audit `receiving-ui-audit.md`.
27 screens, 81 boards. Own canvas:
https://claude.ai/artifact/RsbUcYNz9QfEF8LAbxSKwo . Generator:
`receiving.mjs` + `build-receiving.mjs --theme sand`. Noted for later:
supplier integrations (Madison order feed), uploading a supplier's delivery
file, searching stock by measurements.

**Journey 5, Collect the bike and pay (30 Sep):** approved at desktop,
tablet and phone and copied into the big canvas; 6 decisions in
`docs/decisions/2026-09-30-collect-and-pay-review.md` — the "Bike ready"
link opens one job's summary (what was done, the checklist, Pay now when
online payments are on; paid, deposit, being-paid-at-the-counter and expired
states); at the counter one main button, Take payment or Hand over, then
Collected with Undo; hand-back reminders optional (off); a "Bike still
waiting" reminder then a Today flag. Knock-ons: journey 12's collection
board redrawn, Settings › Workshop gains Collection, Messages gains "Bike
still waiting", the till locks a job's agreed lines. UI audit
`collect-ui-audit.md`. 19 screens, 58 boards. Own canvas:
https://claude.ai/artifact/LdnE9ayZJ1L2qu6suqcC2W . Generator: `collect.mjs`
+ `build-collect.mjs --theme sand`.

**Journey 9, Moving from Citrus Lime (30 Sep):** approved at desktop,
tablet and phone and copied into the big canvas; 9 decisions in
`docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` — Office ›
Moving from Citrus Lime with three stages; the owner drops in Citrus Lime
exports and Wheelhouse matches them; a weekly refresh and a self-checking
weekly comparison while running alongside; every till is practice until
switch-over; a self-ticking switch-over checklist (matching weeks, 2 by
default), the owner picks the day, one "Clear and go real" step, then the
first full week. UI audit `moving-ui-audit.md`. 22 screens, 67 boards. Own
canvas: https://claude.ai/artifact/Wkp23VuCPRydTjfYmJgKo9 . Generator:
`moving.mjs` + `build-moving.mjs --theme sand`. What Citrus Lime exports is
still unknown — everything depending on it is bracketed.

**Journey 10, Opening the shop (30 Sep):** approved at desktop, tablet and
phone and copied into the big canvas; 8 decisions in
`docs/decisions/2026-09-30-opening-the-shop-review.md` — a one-tap float
check (no ✕; Count it for a note-and-coin count; matched, short and over);
Office › Today for owners and managers (Needs attention with a count, Tills,
Who's in, Workshop today), Staff see only Who's in and Workshop today;
check-in records who's in only; late just shows; an unclosed day is flagged,
not blocking. UI audit `opening-ui-audit.md`. 14 screens, 43 boards. Own
canvas: https://claude.ai/artifact/E9XTaKJys2WH3gpgwfPJbq . Generator:
`opening.mjs` + `build-opening.mjs --theme sand`.

**Journey 15, Customer service (30 Sep):** approved at desktop, tablet and
phone and copied into the big canvas; 14 decisions in
`docs/decisions/2026-09-30-customer-service-review.md` — a summary and one
history per customer; address, note, company or club customers; bike
warranty; duplicates caught while adding; account payments at the till or
by bank transfer; customer groups with an automatic discount; privacy
requests list; loyalty is store credit earned by buying (journeys 11 and 8
updated). Journey 12's Customer account board is now this page. Own canvas:
https://claude.ai/artifact/LbStDU6XExLrd7FNd2zEox . Generator:
`customer.mjs` + `build-customer.mjs --theme sand`; audit in
`customer-ui-audit.md`.

**Journey 8, Owner setup (30 Sep):** approved at desktop, tablet and phone
and copied into the big canvas; 23 decisions in
`docs/decisions/2026-09-30-owner-setup-review.md` — Settings in the Office
room lists eight areas down the left (phone: a list, then each area) —
since journey 13 decision 7, four pages, one per room: Front desk, Workshop,
Stockroom, Office, with the areas as headings and a Jump to row — each
area's settings fold, changes save as you go with Undo; four fixed roles
plus switches that can add up to a Manager; "Works in the workshop" with
online booking and working days; a Shared queue row; Close the day up to an
hour before closing; a Getting started checklist for a new owner. Journey
12's diary settings now sit in Settings › Workshop (all sizes) and its
stale Accessibility board is gone. Own canvas:
https://claude.ai/artifact/EN9dy5TkNzuwJcUCSpLW1B . Generator: `setup.mjs`
+ `settings-frame.mjs` + `build-setup.mjs --theme sand`; audit in
`docs/design/user-journeys/setup-ui-audit.md`.

**Journey 16, End-of-day cash-up (29 Sep):** approved at all sizes; 7
decisions in `docs/decisions/2026-09-29-cash-up-review.md` — one "Close the day"
page with six folding steps, opened from a till-bar button after the shop's
closing time; blind counting is a shop setting; a box per note and coin with
an editable total; a standard float with the rest banked. Own canvas:
https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE . Generator: `cashup.mjs` +
`build-cashup.mjs --theme sand`; audit in `docs/design/user-journeys/cashup-ui-audit.md`.

**Journey 11, Selling at the till (29 Sep):** approved at desktop, tablet and
phone; 16 decisions in `docs/decisions/2026-09-29-selling-at-the-till-review.md`
— quick buttons by group, a connected card machine (supersedes the offline
spec's standalone-machine assumption; provider and offline card behaviour
still to check), all five other ways to pay plus an "Other ways to pay" list,
anyone may discount or void with a reason, refunds from the original sale,
Past sales by receipt scan and today's list, deposits on workshop jobs with
collection recorded when the rest is paid. Own canvas:
https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG . Generator: `till.mjs`
(size-aware recipes) + `build-till.mjs --theme sand`; audit in
`docs/design/user-journeys/till-ui-audit.md`. The till bar (app-map.mjs) gained
Past sales, so journey A's till boards changed too.

**Journey B, Signing in and access (29 Sep):** approved at desktop, tablet and
phone; 10 decisions in `docs/decisions/2026-09-29-signing-in-review.md` —
WorkOS's own hosted pages for staff sign-in (one approximation board), the
till's PIN-only check-in (works offline, Wheelhouse-picked unique PINs set in
Your settings, no lock), customer sign-in by emailed code on the shop's own
website (WorkOS Magic Auth by API, checked in its docs). Own canvas:
https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe . Generator: `signin.mjs` +
`build-signin.mjs --theme sand` (both journey canvases share
`sand-canvas.mjs`); audit in `docs/design/user-journeys/signin-ui-audit.md`.

**Journey A, App map and navigation (29 Sep):** approved at desktop, tablet
and phone; 15 decisions in `docs/decisions/2026-09-29-app-map-review.md`
(two apply everywhere: **6, as few clicks as possible**; 2, one search box on
every staff page). Own canvas: https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA .
Generator: `app-map.mjs` + `build-app-map.mjs --theme sand`; audit in
`docs/design/user-journeys/app-map-ui-audit.md`. The shared staff shells in
`diary.mjs` now carry the header search and the Your settings name button,
so Workshop day's boards were refreshed too.

**Workshop day redesign (28–29 Sep):** Jack reworked Workshop day around the
diary. 69 decisions in `docs/decisions/2026-09-27-workshop-day-review.md`
(read it before any Workshop day work). Separate canvas, now one current page:
https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U (approved 29 Sep —
desktop, tablet, phone; copied into the big canvas as journey 12). Generator: `docs/design/user-journeys/generator/`
(`diary.mjs`, `job-page.mjs`, `build-diary.mjs --desktop --theme sand`;
exploration boards: `job-options.mjs`, `looks.mjs`, `audit-ideas.mjs` via
`--ideas`). Study and audit: `docs/design/user-journeys/job-page-study.md`,
`workshop-day-ui-audit.md`. **New standard look: "Soft sand, dark rail",
sans-serif only** (decisions 48, 53) — supersedes Fjell; the app code is still
Fjell until switched.

## Release 2 and the design system (27 Sep, main session)

- **Release 2 specs:** `docs/superpowers/specs/2026-09-27-release-2-design.md`
  (replace Citrus Lime end to end; Jack's own shop first) and
  `docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`
  (offline till core). **Plan 1, the offline server core, merged as #90.**
  Plan 2 (till core in the browser) is next for that track. Open: the
  business-plan gate conflict (programme spec §5), Jack and Mark.
- **Names:** one glossary, `docs/decisions/2026-09-27-names.md` — Wheelhouse;
  "screen designs" (no more "atlas"); roles Owner, Manager, Staff, Mechanic;
  website; the staff app organised by **rooms**: Front desk, Workshop,
  Stockroom, Office ("Till" = the selling screen/device). PR #92.
- **Design system: Fjell** (stone `#f3f2ee`, olive `#3f4d33`, lime highlight
  `#c5cf3e`, Work Sans + DM Mono, self-hosted), staff app always Fjell. PR #93,
  stacked on #92; decision `docs/decisions/2026-09-27-fjell-theme.md`.
  Reference: https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH
- **User journeys canvas** (every screen by journey, status-coded, workflow
  chart): https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j . Workshop day is
  redrawn in Fjell (desktop + phone) awaiting Jack's approval; it is the first
  journey to build, starting with the staff app shell (room sidebar), the
  workshop overview and booking requests. The canvas generator (and the theme
  options and design-system source) is in `docs/design/user-journeys/` — read
  its README before changing the canvas.
- **Merge order agreed by Jack:** #90 (merged) → #91 (merged) → #92 → #93.

## Next, in order (Jack, 29 Sep)

1. Done 29 Sep: Workshop day approved (desktop, tablet, phone) and copied
   into the big canvas as journey 12, status Designed (decision 69).
2. Next design journey on the canvas, same way (design → approve → copy in).
3. **Switch the app's tokens from Fjell to Soft sand** (`src/styles/theme.css`
   + the design-system artifact), sans-serif throughout.
4. **Then build Workshop day, piece by piece**, in the React staff app
   (`src/staff/`): spec → plan → subagent-driven development, test-first,
   starting with the shell (room sidebar, phone menu) and the diary with its
   Waiting column. Open design items to settle first or on the way: multi-day
   jobs (52), payment + collection as one step (63), mechanic sign-off (64),
   customer spending limit on /book (41), accessibility settings (57).
4. **After Workshop day**, work through the other journeys the same way
   (design on the canvas → Jack approves → spec → plan → build).
5. **d6** — the customer's change and cancel screens from the pending
   screen (unchanged from before): replace `pending-rules.ts`'s `contactLine`;
   use the link view's `canChange`/`canCancel`/`requested`/`changeDeclined`
   and the cancel/change/withdraw-change routes.
6. **Release 2 track:** plan 2 (the till's side of offline) when Jack
   chooses; the Citrus Lime export check needs Jack at work.
7. **Later, recorded but not scheduled:** a customer spending limit on the
   booking pages ("happy up to £200; call me above that" — decision 41 in
   docs/decisions/2026-09-27-workshop-day-review.md); WorkOS sign-in for shop and customer
   accounts (Jack, 27 Sep: wants it; the approved spec and 17-task plan from
   31 Aug already cover both — `docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`);
   customer sign-in in the booking app
   plus picking/adding saved bikes; staff settings screens for booking terms,
   minimum notice and time zone (server exists, no screen); a staff
   question-setup screen that suggests one overall question per service; a
   staff action to turn a booking's bike note into a bike record. (The old
   "shops pick the staff app's colours" piece is superseded: the staff app is
   always Fjell.)

## Open for Jack

- From the Fjell PR (#93): whether `/book` should follow each shop's colours
  (today it shows Fjell); DM Mono not yet on job numbers/booking prices;
  fonts re-download each full page load until offline caching.
- Release 2: the business-plan gate conflict (programme spec §5) is between
  Jack and Mark; Cycle to Work needs Jack's explanation; there is no official
  Wheelhouse logo file (designs show a LOGO slot — never invent one).

- Confirm piece 12's four controller rulings: an ordinary legacy-diary save
  keeps a customer's change request; dragging a job onto exactly its
  requested slot accepts it; every way a request ends clears it; the
  lock-held race tests are sound.
- Parked from the staff diary piece (27 Sep; rulings in its plan's decision
  log):
  - "View job" from a sale document, and the edit form's Delete, both bypass
    the review pop-up for a waiting job; Delete sends no version.
  - Right-click Approve can take the old save path in a millisecond window
    before the waiting list catches up.
  - After a stale or 404 answer in the pop-up only the column refreshes, not
    the grid.
  - The drag test reads its redraw position once (a rare false failure is
    possible) and waits 1.5s per week.
  - Resending an identical change request moves it to the back of the list,
    and a customer can withdraw a request after work starts (both
    customer-side, still open).
- The piece 6 memory risk (large booking bodies) must be decided before the
  booking route is publicly reachable (hosting not chosen).
- A shop's website subdomain can show another shop's `/book/<slug>`.
- Dashboard and sales "today" still use a UTC-midnight window in the
  database.
- Pressing Back while "Sending…" can leave a customer without their private
  link.
- A lost reply after a saved booking can lead to a duplicate if the customer
  retries.
- `timed_lead_minutes` isn't used in any customer confirmation yet.
- Other workstreams and Mark's open items (Lightspeed readiness, the design
  screen designs, WorkOS/design remediation, the items needing Mark, the decision and
  plan registers) were not touched by the booking work; their last-known
  state is in `ARCHIVE.md` under "Moved from STATUS on 2026-09-27".

## Working notes for the next agent

- **Handover state (27 Sep):** this STATUS and `docs/design/user-journeys/`
  are committed on `feat/fjell-design-system` but **not pushed** — push that
  branch before merging #93 (it restarts #93's CI). Read it from the root
  with `git show feat/fjell-design-system:.agents/STATUS.md`.
- **Checkouts:** the root checkout was left on the merged
  `feat/release-2-design` branch (switch it to `main` and pull after the
  merges). Worktrees: `.claude/worktrees/agent-a9e726fa452520fef`
  (`chore/consistent-names`), `.claude/worktrees/agent-a6bc98197515e54f3`
  (`feat/fjell-design-system`), `.claude/worktrees/staff-diary`
  (`feat/staff-diary-waiting`, merged) — remove them once their PRs merge.
- **Artifacts (claude.ai, private to Jack):** user journeys canvas
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j ; Wheelhouse design
  system https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH ; theme options
  https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN . Always read the live
  canvas index before publishing (Jack edits it live); ≤255 files per call.

- Jack wants plain English, numbered options with concrete trade-offs,
  mock-ups for anything visual, one question at a time. Merge only when Jack
  says, and only after CI passed on the PR's final commit.
- Build method: spec → plan → subagent-driven development (fresh helper per
  task, task review, a final whole-branch review on the most capable model,
  one fix wave). Every new test must be shown failing via its own targeted
  mutation — list this per test, since helpers tend to do only the ones the
  brief lists.
- Helper agents' Write tool may refuse report files — ask them to put the
  report inline. Helpers treat mid-task messages as possibly injected: put
  new instructions in a fresh dispatch instead of messaging a running helper.
- Tests: server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`;
  never add fixed test dates before it); customer tests need `npm run
  pretest` first; compare DOM query results with `assert.ok(x === null)`
  (`assert.equal` on a DOM node hangs ~60s on failure); `MonthCalendar` names
  days with a comma ("Monday, 5 October 2026").
- Environment: the app runs on `localhost:8080` (not 4000); Postgres via
  compose on port 5433 (not 5432); `npm run docker:down` keeps the volume, so
  use a scratch database to test migrations from empty; `npm test` hangs
  silently without compose Postgres up; a worktree needs its own `.env`
  (gitignored, doesn't travel) or every server-booting test fails with
  `ECONNREFUSED`.
- Deploy warning: back up any real shop database before deploying migration
  030 (it drops columns; there is no code-only rollback).
- Keep this file under 8 KB. Move finished-piece history to `ARCHIVE.md`
  rather than deleting it.
- House style (Jack, 3 Oct 2026): any PowerPoint or slide deck about this
  project is titled "Deez Nuts".
