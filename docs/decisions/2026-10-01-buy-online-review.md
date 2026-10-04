# Journey 2, Buy online / click and collect — Jack's decisions (1 Oct 2026)

Journey 2 is how a customer buys from the shop's website: the basket,
checkout, paying, the order confirmation, "ready to collect", and the order's
progress — and the shop's side of an online order. Background, not reopened
here: the website is built into Wheelhouse, not Shopify (Release 2 design §5;
piece 7), called "Website" (Names), drawn in Soft sand with each shop's own
header (App map 15); Release 2 scope is "a deeply customisable website with
click and collect and online payments"; the payment provider is not chosen
(PAY-05 — the business plan never forces a processor); one business with
prices shared and stock held per shop (Multiple sites 1–4), booking starting
with "Which shop?" (Multiple sites 6); collection hours come from each shop's
opening hours (Owner setup 13); the "Order ready to collect" message exists in
Settings › Messages (Owner setup); the till hands over a click and collect
order already paid online (Selling at the till); a customer's account history
lists online orders with receipts (Account, history and reminders 2);
refunds go back the way they were paid (Selling at the till). Real example
data only: North Street Cycles, Bolton, "[Second site]", Maya Patel, Shimano
brake pads B05S-RX (£28.00); other products and every order figure are
bracketed placeholders. Own canvas:
https://claude.ai/artifact/QGRBBPUhHRd5rg94XbgAyS, desktop first, then tablet
and phone. Rules for every journey apply (Workshop day 45, 48, 50, 53, 57,
62, 65–67; A2, A6 — as few clicks as possible).

1. **Pay online, collect from a shop — built so delivery can be added**
   (Jack, 1 Oct: "yeah lets do 1 but it might be worth building the
   framework for shipping things too"). The customer chooses a shop, pays at
   checkout and collects; staff pick the order, mark it ready (which sends
   "Order ready to collect") and hand it over at the till as already paid.
   Room for delivery is left in the design rather than drawn as a feature:
   checkout's "How you'll get it" step is a choice with one option today
   ("Collect from a shop"), so "Delivery to your address" slots in beside it;
   every order records how it reaches the customer; the order's progress
   steps end in "Ready to collect" now and can end in "Sent" later; and the
   staff order list has a column for it. Nothing about postage prices,
   packing or tracking is drawn. Chosen over collect or post from the start,
   reserve and pay in the shop, and the customer choosing pay now or later.
2. **Each shop chooses what its website sells, from three settings** (Jack,
   1 Oct: "I think we should give shops the option choose from all three of
   those options. Some stores may be small and only want to sell whats on
   the shelf, some may be big and can just order things from suppliers more
   frequently"). One setting in the website's settings, with three choices:
   **only what's on the shelf** at the shop the customer picks; **anything
   in stock at any of our shops**, moved across with Stock control's send
   and receive (the product says "At [Second site]: ready at Bolton in [n]
   days", days set by the shop); and **also items we can order in** from the
   supplier (the product says "We order it in: ready in about [n] days").
   Stock is held for the customer once they've paid. Starts on "only what's
   on the shelf", so nothing is promised that the shop hasn't chosen to
   offer. The third choice is also the start of customer orders (handover,
   noted for later): in this journey the customer's side and the order
   arriving at the shop as "To order from [supplier]" are drawn; the
   purchase order itself is Receiving stock and purchase orders (journey
   13).
3. **The shop chooses at setup whether its website starts with everything or
   nothing; switches on products and categories after that** (Jack, 1 Oct:
   "I think during setup a shop can choose if the default is on or of, some
   may want to start with everything, some may want to start fresh"). When
   the website's shop is first turned on, one question: "Start with every
   product online" or "Start with nothing online and add as you go". After
   that, "Show on website" is a switch on each category (which sets every
   product in it) and on each product (which can differ from its category).
   New products follow their category. Chosen over everything always on,
   nothing always off, and categories only.
4. **No account needed to buy; saving details offered afterwards** (Jack, 1
   Oct: "1"). Checkout asks for name, email and phone — filled in for a
   customer who is signed in. The confirmation offers "Save your details for
   next time", which makes the account of journey 7 with no password step
   (signing in as journey B). Orders without an account are found by email
   and phone, like walk-in customers, and join the account's history if the
   customer signs up with that email. Chosen over signing in first, and no
   accounts at checkout.
5. **Card, Apple Pay and Google Pay, plus gift cards and store credit**
   (Jack, 1 Oct: "1"). Checkout takes a card or a phone wallet through the
   shop's payment provider (still to choose, drawn as "[payment provider]").
   A gift card is entered by its code; store credit is offered when a
   signed-in customer has some, and either can pay part, the rest on card.
   "Buy now, pay later" is left for when the provider is chosen. Chosen over
   card and wallets only, and card only.
6. **Staff see online orders in one list, in three groups** (Jack, 1 Oct:
   "1"). Front desk › Online orders: "To get ready", "Ready to collect" and
   "Collected" (recent). Each order shows its items, where each comes from
   (the shelf, "On its way from [Second site]", "To order from
   [supplier]") and the customer. "Mark ready" is one press and sends "Order
   ready to collect"; collecting is the till's hand-over (Selling at the
   till). Today shows "New online orders · [n]" and the sidebar item a
   count. Chosen over a four-column board with a picking stage, and no page
   of its own.
7. **Not collected: a reminder, then staff decide** (Jack, 1 Oct: "1").
   After [n] days uncollected the customer gets one reminder; after [m] days
   the order shows on Today under "Not collected", and staff contact the
   customer or cancel it — a refund the way it was paid, the items back on
   sale. Both days are set by the shop (as uncollected bikes, journey 5).
   Also drawn (no objection when offered): the customer can cancel from
   their order page, with a full refund, until it is marked ready; and staff
   can mark an item "Can't supply this", which refunds that item and tells
   the customer why. Chosen over cancelling automatically, and keeping it
   until collected.
8. **The shop is chosen once and remembered across the website** (Jack, 1
   Oct: "1"). With two or more shops, the header says "Collecting from
   Bolton · Change"; product pages say when each item is ready there
   ("Ready today at Bolton", "Ready at Bolton in [n] days", or "Choose a
   shop to see when it's ready" before one is chosen); checkout confirms it.
   With one shop the shop is named and there is nothing to choose. Chosen
   over choosing at checkout, and choosing item by item.
9. **UI audit: every recommendation taken** (Jack, 1 Oct: "yeah go ahead
   with them all"). From `design/user-journeys/online-ui-audit.md`:
   **stock is checked when the basket opens, at checkout and just before
   payment** — a line that changed says so and nothing is taken for what
   isn't there (H1); paying, the bank's check and "we couldn't confirm your
   payment — don't pay again" are drawn, and gift cards and credit are only
   spent when the order is paid (H2); every order shows **how it was paid,
   and refunds go back the same way** (H3); "Mark ready" holds the email for
   a few seconds with Undo, after which "Not ready after all" offers a sorry
   email (H4); **Ready orders have "Hand over"**, opening the till's
   hand-over (H5); field errors, "Change email" and "Email didn't arrive"
   (H6); the other shop's "To send to Bolton", "Arrived", "Ordered · due
   [date]" (M1); "Cancel and refund" moves into the order with a confirm and
   a reason (M2); the shop chooser has nothing chosen and one tap saves it,
   as booking's "Which shop?" (M3); Collected, cancelled by the shop, and a
   cancel that arrives just after "Mark ready" (M4); **five online-order
   emails in Settings › Messages**, the "ready" email drawn (M5); "we'll
   email you a code" (M6); gift card code errors, money left on a gift card,
   and credit covering the whole order (M7); the places that assume
   collection are listed for when delivery comes (M8): the header's
   "Collecting from", availability lines, the "Collect from" summary row,
   the confirmation's steps, the order page's "Collect from" panel and the
   staff group "Ready to collect"; out of stock here but in stock at the
   other shop says so (M9); "Uncollected" on Today works as for bikes, with
   "Contacted" (M12); a "Buying online" on/off at the top of the settings,
   the "any of our shops" choice hidden for one-shop businesses (M13). Also
   the accessibility pass (M10), the sidebar count and "orders" in search
   (M11), and L1–L5.
10. **Tablet and phone drawn; approved; the big canvas split in two** (Jack,
    1 Oct: "lets get it on the canvas", then "1"). On phone, checkout puts
    the order at the top and Pay in a bar along the bottom, so the button and
    its messages stay in view; with two shops, "Collecting from Bolton ·
    Change" is a line under the header on tablet and phone. 54 screens, 163
    boards. With journey 2 the big canvas would have needed 523 files (a
    canvas holds 512), so it is now two canvases, each with the whole
    overview and a link to the other: **the staff app** (journeys A and
    8–21) keeps the shared link
    https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j, and **customers and
    the website** (journeys B and 1–7) is
    https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh. Chosen over showing
    only journey 2's main path, and turning the big canvas into an index.
    Journey 2 replaces its six placeholders; Website management's "Online
    orders", "Click and collect queue" and "Refund an online order" are now
    drawn here (its "Online payments setup" stays to design). Carried into
    other journeys: the Online orders section in Settings › Front desk; the
    five online-order messages in Settings › Messages ("15 on"); "Show on
    website" on a product's page in Stock. Not carried: "orders" in the
    staff search hint — the longer hint was cut off in the header, so the
    hint stays "Search jobs, customers, products" and search finds orders
    all the same.

**Later change (2 Oct 2026, Find the shop decision 8):** every website page gains a "Skip to the main content" link before the header, and the footer reads Contact us, Collection and returns (was "Delivery and returns"), Privacy and Cookies, its links 44px tall. Nothing else changed.

**Later change (2 Oct 2026, Website management decisions 12 and 13):** a product page with buying online off now reads "Not taking online orders right now. Ask in the shop, or call us, to buy this" — the same words while online payments are not connected. Online payments setup itself is drawn in journey 18 (decision 8 there).

**Later change (4 Oct 2026, coverage walk 5, `docs/design/user-journeys/walk-4/`):** Jack, 4 Oct: "1". Decision 3's question, "Start with every product online" or "Start with nothing online and add as you go", is asked once, in the website's set-up (step 3), and not again when buying online is switched on. Connecting payments turns buying online on, as `ws-pay-connected` shows. `on-settings-start` and its two "answered" situations go. Chosen over keeping both places. Recorded in `docs/decisions/2026-10-04-coverage-walks.md`.
