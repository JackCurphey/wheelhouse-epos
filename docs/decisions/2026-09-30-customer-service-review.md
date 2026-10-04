# Journey 15, Customer service — Jack's decisions (30 Sep 2026)

Journey 15 is the staff side of customers: finding a customer, their page
(details, bikes, jobs, sales, refunds, account, loyalty, messages), and
keeping the customer list tidy. Designed in the Soft sand look on its own
canvas, desktop first, then tablet and phone. Rules for every journey apply
(Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as
possible; Owner setup 4 — changes save as you go).

1. **Journey 15 is next** (Jack, 30 Sep), chosen over Opening the shop,
   Moving from Citrus Lime and Collect the bike and pay.
2. **The customer page is a summary down the left and one history on the
   right** (Jack, 30 Sep): the left holds bikes and an "At a glance" list
   (owes on account, loyalty points, store credit, marketing permission);
   the right is one history of jobs, sales, refunds and messages, newest
   first, filtered by pills (Everything, Jobs, Sales, Messages). Chosen over
   one page of folding sections. Jack adds: "more customer information,
   like address for example" — which details is the next question.
   Board: `cs-opt-timeline` (customer.mjs).
3. **A customer record also holds an address with postcode and a note**
   (Jack, 30 Sep): both optional; the note is for what everyone in the shop
   should know ("prefers texts") and stays factual, since customers can ask
   to see what's held. Not held: a second phone, date of birth. **Company
   or club customers:** Jack wants to be asked "is this a company account"
   when a customer is made — drawn as a Person / Company or club choice on
   Add a customer, which shows a company name. (Jack also floated a shop
   setting for it; drawn without one unless he asks.)
4. **Bikes bought at the shop show their warranty** (Jack, 30 Sep: "you can
   see for example if this bike still has warranty and/or how much longer
   it has"): on the customer's Bikes list, a bike sold by the shop shows
   when it was bought and the warranty left, or that it has ended. The
   warranty length comes from the bike's product record (stock, journey
   14). Bikes brought in from elsewhere show no warranty line.
5. **Possible duplicates are caught while adding, and flagged on the
   customer's page** (Jack, 30 Sep): while typing in Add a customer, a
   match on phone, email or name shows "already has this number — use
   them instead?"; one that slips through (two tills offline) shows a
   notice on the page, "Might be the same as Maya P.", with Check opening
   a side-by-side keep-or-merge comparison. Nothing merges automatically
   (offline spec). The Release 1 example "Maya P." with the same phone is
   the example. Chosen over a Possible duplicates list only and catching
   them only while adding.
6. **The customer page shows only the money features the shop has switched
   on** (Jack, 30 Sep: customer credit "should be an option the business
   owner turns on or off, and if off it doesn't show as an option on the
   customer pages"): the switches already exist in Settings › Payments ›
   Ways to pay (Owner setup 8 — store credit, customer accounts, loyalty
   points); when one is off, its line in At a glance, its history entries
   filter and its buttons don't appear on the customer page (or the till).
7. **Paying off an account: "Take a payment" at the till, or "Record a bank
   transfer" on the page** (Jack, 30 Sep): card and cash go through the
   till (journey 11) with the balance ready to pay, so the drawer, card
   machine and cash-up stay right; money that never touches the till (a
   club's bank transfer) is recorded in a small pop-up. Both open from the
   customer's Account pop-up, which also holds the statement and the
   per-customer limit (Owner setup decision 7). Chosen over the till only
   and a record-a-payment pop-up only.
8. **Customer groups with an automatic discount** (Jack, 30 Sep): the shop
   sets up groups in Settings › Payments › Customer groups (a name and a
   discount, e.g. "[Club name] members · [n]% off"); a customer can be in a
   group, shown in their Details and chosen when adding them; when a group
   member is added to a sale the till gives the discount by itself, with
   the group as its reason, so it shows in the discount reports (till
   decision 4). The old app had groups (CUS-02). Chosen over groups as
   labels only and no groups. Adds a section to journey 8's Payments area.
9. **Privacy requests are handled from a list, with dates** (Jack, 30 Sep):
   each request (a copy of their data, or deleting their details) is logged,
   worked on and marked done, giving a paper trail if a customer complains.
   Deleting keeps sales for tax without the person's name (retention rules
   in the workshop-first build spec). Chosen over actions on the customer's
   page only and both. **The list opens from a "Privacy requests · [n]
   open" link at the top of the Customers page** (Jack, 30 Sep), so no
   sidebar changes; chosen over an Office sidebar entry and a section in
   Settings › Your data. Each request shows when it was asked and when an
   answer is due (one month, UK data protection).
10. **Loyalty is store credit: customers earn store credit by buying**
    (Jack, 30 Sep: "I would like the store credit and loyalty points to be
    the same thing, as in a customer can earn store credit by buying
    things"): no separate points. The shop sets how much comes back ([n]%
    of what's spent) in Settings › Payments › Ways to pay, on the Store
    credit switch, which also covers refunds without a receipt (till 9). The
    customer page shows one "Store credit" line; staff can add or take it
    away with a reason. Knock-on, done the same day: journey 11's basket row
    "[n] loyalty points · Use points" becomes "[£] store credit · Use it"
    (board `till-loyalty`); journey 8's separate Loyalty points switch goes.
    Supersedes the points half of till decision 8 and journey 15 option
    "points per £1".
11. **This customer page replaces journey 12's "Customer account" board**
    (Jack, 30 Sep), once journey 15 is approved — as journey 8 decision 12
    did for the diary settings: one customer page everywhere; the job
    page's customer link opens it. Journey 12's canvas and the big canvas
    are updated then, with a dated note in its decision file.
12. **UI audit fixes adopted, with all five recommendations** (Jack, 30
    Sep; `docs/design/user-journeys/customer-ui-audit.md`): the history is
    newest first with what's open now at the top, then "Show all", and
    shows refunds, messages and store credit changes, with an empty state
    for a new customer; an "Owes [£]" chip beside the name and in the list,
    an over-limit state, and the limit read-only for Staff; whole rows
    clickable at 44px with arrows; a back link to Customers; marketing
    switched in one tap; the merge shows only fields that differ, with each
    record's jobs and sales counted; phone or email (at least one) when
    adding; store credit reasons as pills; an overdue privacy request; the
    bank transfer pre-filled. Missing states (company customer, no email,
    undone merge, no groups, empty filter) are rules, not drawings.
    **Decisions:** (1) a sale that would go over the account limit warns
    and is allowed, with a reason recorded for managers; (2) deleting
    someone who owes money, holds store credit or has a bike in is blocked
    until settled; (3) one search — the header's — and Customers becomes a
    recent-customers list; (4) Edit details keeps its pop-up, button "Save
    changes"; (5) "Add to a sale" shows only on a till — the staff app
    offers "New job". Dismissed after checking: the Add pop-ups don't
    overflow (measured), and the sale pop-up's Refund is the confirming
    action on the right, as the rule says.
13. **Desktop approved; on to tablet and phone** (Jack, 30 Sep: "I've looked
    through the pages, that looks very good").
14. **Journey 15 approved at desktop, tablet and phone** (Jack, 30 Sep:
    "copy it into the big canvas and swap journey 12"): copied into the big
    user-journeys canvas as Designed (desktop there, linking here for
    tablet and phone), and journey 12's Customer account board replaced by
    this customer page (decision 11).

**Later change (30 Sep 2026, Receiving stock decision 7):** Settings now has
four pages, one per room — Front desk (Till, Payments, Messages, End of
day), Workshop, Stockroom (new) and Office (Shop and sites, Staff and roles,
Your data). A room with several areas shows them as headings with a "Jump
to" row of pills; a phone opens on the list of four rooms. Customer groups are now under Settings › Front desk › Payments.

**Later change (1 Oct 2026, Book a repair decision 12):** Settings › Front
desk › Messages gains a "Booking messages" group below the existing rows —
Request received, Booking confirmed (moved here from the top of the list),
New time offered, Request declined, Date change answered and Booking
cancelled — each sent "Customer's choice" (the channel the customer picked
when booking). The Automatic messages summary now reads "10 on" wherever it
shows, including the closed row on the Front desk settings boards. The
Online booking row's summary adds the deposit: "Exact times · 2 hours'
notice · deposit [n]% · each booking a request".

**Later change (1 Oct 2026, Account, history and reminders decisions 4 and 8):**
a customer can ask to delete their account from the website. The request
lands on Privacy requests saying where it came from and what's in the way
(a bike still in, store credit that will be lost), with "Delete their
details" held back until it's clear, and a line on their customer page;
drawn on the journey 7 canvas. The Customers boards here only change where
the Front desk Settings summary shows ("11 on").

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.

**Later change (1 Oct 2026, Buy online decision 10):** Settings › Front desk shows the new "Online orders" Jump to pill on Customer groups. Nothing else changed.

**Later change (4 Oct 2026, coverage walks, answer 5, `docs/decisions/2026-10-04-coverage-walks.md`):** Jack, 4 Oct: "1". One way of saying "can't delete yet" on privacy requests (decisions 9 and 12(2)): every request, from the website or logged by hand, shows "Still in the way: …" on its row, with Delete their details held back until it's clear. The "Settle up first" pop-up (`cs-privacy-blocked`) goes. Store credit is not in the way (Account and reminders, audit M12): it is lost on deletion. Drawn in `docs/superpowers/specs/2026-10-04-draw-the-coverage-walks.md`.
