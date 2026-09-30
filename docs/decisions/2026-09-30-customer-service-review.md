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
