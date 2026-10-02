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
placeholders — no provider's name or process is drawn as fact. Rules for
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
