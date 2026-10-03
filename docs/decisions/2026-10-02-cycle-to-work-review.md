# Journey 6, Cycle to Work — Jack's decisions (2 Oct 2026)

Journey 6 is how the shop handles a bike sold through a Cycle to Work
scheme. **What Jack means by "his own version"** (Jack, 2 Oct): "we are not
running a scheme, just a way in the system to record and put aside bikes
that are being sold through cycle to work, and record everything thats
happening. Currently in citruslime there is no way to handle it, so we have
to create a special order and keep on top of it ourselves. basically as
citrus and lightspeed dont have any baked in way to organise and deal with
cycle to work stuff, I want something that can, which can also act a
differentiator." So Wheelhouse doesn't run a scheme or talk to scheme
providers as a provider; it organises the shop's side — the quote, the bike
put aside, where the paperwork has got to, the handover and the provider's
payment. This replaces the Release 2 plan's "Jack's own design, to be
explained" (Release 2 design §7, piece 8).

Background, not reopened here: "Other" on Take payment lists less-used ways
to pay, Cycle to Work schemes among them (Selling at the till 15); stock is
held per shop and can be moved between shops (Multiple sites 1, Stock
control); customer orders for parts ordered in are noted for later
(handover, 1 Oct); Today's Needs attention, cleared with "Seen" (Opening the
shop 3, 4); the activity log records what staff do (Management oversight
1). Real example data only: North Street Cycles, Bolton, "[Second site]",
Jack Lewis (Owner), Jo Taylor (Staff), Maya Patel (customer); scheme
providers, bikes, prices, dates and reference numbers are bracketed
placeholders — no provider's name or process is drawn as fact. Own canvas:
https://claude.ai/artifact/6NR9hm3Gnc3kX1i57xcRgt, desktop first, then
tablet and phone. Rules for
every journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 —
as few clicks as possible).

1. **A Cycle to Work sale is its own kind of order, with stages** (Jack, 2
   Oct: "1"). Quote given → Waiting for the certificate → Certificate
   received (bike put aside) → Ready to collect → Collected → Paid by the
   provider. Each stage records the date, who did it and what matters —
   the provider, the certificate number, the amount, any commission. The
   bike comes off sale once it's put aside. Anything stuck (a quote with no
   certificate after [n] days, a payment not received) shows on Today.
   Chosen over an ordinary customer order with a label, and a note and a
   reserved bike on the customer's page.
2. **Its own sidebar item: Front desk › Cycle to Work** (Jack, 2 Oct:
   "1"). A list grouped by stage, as Online orders is, with a count on the
   sidebar item when something needs doing. The sidebar gains the item on
   every staff screen in every journey (a mechanical rebuild of the
   canvases). Chosen over one "Orders" page with tabs, and no list of its
   own.
3. **A bike in stock is held from the quote, for days the shop sets, then
   firmly from the certificate** (Jack, 2 Oct: "1, but we also need to
   figure out a way to deal with bikes that are getting ordered. some shops
   may want to only order it with a deposit if they havent got a voucher,
   some may be ok with ordering once the customer has applied for the
   voucher, and other ways"). The order shows "Held until [date]"; a
   reminder before the hold ends offers "Hold longer" or "Release the
   bike"; the certificate makes the hold firm until collection; "Don't hold
   this one" for an easy-to-replace bike. Chosen over holding only from the
   certificate, and staff choosing each time. Bikes that have to be ordered
   in are the next question.
4. **A bike that isn't in stock is ordered by a rule the shop picks, with
   a recorded override** (Jack, 2 Oct: "1"). In Settings the shop chooses:
   once the certificate arrives; once the customer has applied (staff tick
   "Applied", or note the application reference); or straight away with a
   deposit (an amount or percentage). The order shows the next step ("Waiting
   for a £[£] deposit before ordering", "Ready to order from [supplier]"),
   and ordering creates the supplier order in Deliveries and orders
   (journey 13). "Order now anyway" on one order needs a reason and shows in
   the activity log. The shop also sets what happens to a deposit —
   refunded when the certificate arrives or counted toward the price — and
   if the customer pulls out. Price-based rules can be added later. Chosen
   over staff deciding each time, and rules by price now.
5. **The shop lists its providers once; Wheelhouse works out what's owed
   and chases it** (Jack, 2 Oct: "1"). In Settings each provider has its
   name, commission (% or £), roughly how many days it takes to pay, and
   notes (how it wants the handover confirmed). Each order picks its
   provider and shows "Expected: £[£] by [date]". At collection the bike
   goes through the till, paid by "Cycle to Work · [provider]" (Selling at
   the till 15), which uses the order's provider. "Mark paid" records the
   amount received and flags any difference; overdue payments show on
   Today, and there's an "Owed by Cycle to Work providers" list. Real
   providers' terms are the shop's to fill in. Chosen over typing the
   provider on each order, and leaving it to the accounts software.
6. **A proper quote to send off, then messages at each step** (Jack, 2
   Oct: "1"). The quote is a printable and emailable document — shop
   details, the bike, size, price and any accessories, the quote number
   and "valid until" — sent from the order in one press. Then short
   messages from Settings › Messages, each switchable off: "Your bike is
   put aside", "Certificate received", "Ready to collect" and "Your hold
   ends on [date]". The order also shows in the customer's account on the
   website. **A Cycle to Work page on the website, where customers ask
   for a quote, is noted for later** (Jack, 2 Oct: "but i would also like to
   remember 2 for the future") — kept in the handover's "Noted for later". Chosen over adding that page now, and the
   quote only.
7. **UI audit: every recommendation taken** (Jack, 2 Oct: "go ahead with
   them all"). From `design/user-journeys/c2w-ui-audit.md`:
   - **No provider's process is stated as fact** (H1). The hand-over
     checklist is one box per line of the provider's own note in Settings,
     none ticked to start, and the history records which were ticked. The
     certificate shows "Certificate £[£] · quote £[£]" and flags a
     difference without saying why. The quote and email say "Quote number
     [quote number]", plus a "How to apply" line the shop writes once.
     Settings › Payments no longer says "the scheme pays the shop".
   - **A "Who pays what" block** on the order and the hand-over (H2): the
     total, any deposit already paid, what the provider pays, and what the
     customer pays at collection, worked out from those; anything over
     £0.00 opens the till with a second payment line. A certificate for
     less offers "Change the order to match" or "Keep the order; Maya pays
     the difference". Each provider says whether accessories are inside
     what it pays.
   - **Staff without "Can see costs and margin" don't see the bike's cost
     or the commission** (H3); they still see what's expected.
   - **Money steps are for owners, managers and Staff with "Can close the
     day", and each is logged** (H4): Mark paid, Save as part paid, Close
     with a reason, cancelling an order that holds a deposit, and Order now
     anyway. These are new kinds of line in the activity log, approved
     here. The customer steps (quote, hold, release, certificate, hand
     over) are for everyone at the front desk.
   - **The quote's closing paragraph is built from the order** (H5): the
     hold, or what makes the shop order the bike, and the shop's deposit
     rule. Staff see the sentence in the New order pop-up first.
   - A tick in New order, "Email the quote to maya@example.test now" (M1).
     The list has a top line, "[n] holds ending soon · [n] payments late";
     Today stays for owners and managers, and the setting reads "Remind the
     shop" (M2). The sidebar count is what's due or late: holds ending,
     bikes ready to order, quotes with no certificate after [n] days,
     payments late (M3).
   - A held bike shows "Held for [name] until [date]" in Stock and the
     till's search, and as sold out on the website; New order won't hold
     it twice (M4). "Order from [supplier]" stays one press, with "Undo"
     (M5). The owed page opens from a line at the top of the list, for
     people who may see the money, and from a Reports card (M6). A
     customer's view of the order in their website account, with no
     commission, provider payment or staff names (M7).
   - The missing steps drawn: Applied and the application reference, the
     deposit taken, a bike on order arriving, a released bike when the
     certificate comes, part paid (M8). The More menu, a revised quote, the
     first time with no providers, and cancelling an ordered bike; "Quotes
     are valid for [n] days" is its own setting (M9). "What's happened" is
     one list that only grows (M10). Buttons named for their customer,
     labels tied to their boxes, headings in order, the hold choices
     grouped (M11).
   - L1–L7: one reminder number everywhere, and the message keeps its
     decision 6 name, "Your hold ends on [date]"; 44px-wide links and
     outlined buttons; a £ / % switch on commission and deposit, and new
     terms apply only to new orders; Today's workshop tile reads "Repairs
     ready to collect"; Jack drawn as the Owner throughout; the overview's
     "waits on Jack's explanation" wording replaced; "Hold longer" on Today
     holds at once with Undo, and "Add the certificate" sits on the list
     row.
8. **Tablet and phone drawn; approved and copied into the big canvas**
   (Jack, 2 Oct: "1", then "1"). On a tablet the screens keep the desktop
   layout with the icon rail; on a phone the order page is one column with
   "Next" first and the six stages two to a row, pop-ups fill the screen,
   and the More menu opens from the left. 39 screens, 117 boards. In the big
   canvas (customers and the website) journey 6 replaces its two
   placeholders. Carried into other journeys: the Front desk › Cycle to Work
   sidebar item on every staff screen; Settings › Front desk's Cycle to Work
   tab; the four messages in Settings › Messages ("19 on"); the Payments
   wording "Recorded at the till against a Cycle to Work order"; Today's
   workshop tile "Repairs ready to collect" (audit L4); Reports' "Owed by
   Cycle to Work providers" card (M6); and on Stock's bike page a frame
   "Held for [Customer] until [date] · Cycle to Work — not for sale" (M4).
   Not drawn yet: a held bike in the till's search, and shown as sold out on
   the website (M4).

**Later change (3 Oct 2026, walk-through 12 M4, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". The Cycle to Work email's "See your order" is a private link that opens the order with no sign-in, like a repair's link; the order is also in the website account for a signed-in customer. Adds to decision 7. Chosen over keeping it in the account only. A line on `cw-customer-view`; not drawn yet.

**Later change (3 Oct 2026, walk-through 5 second walk L4):** Jack, 3 Oct: "1". Staff can cancel a Cycle to Work order that holds no deposit, from "More"; with a deposit held they see "A deposit is held: ask a manager to cancel". Owners, managers and anyone with "Can close the day" can cancel either (decision 7's money-step rule, unchanged). Chosen over cancelling only for those who can do money steps. A line on `cw-order-held`'s More; not drawn yet.
