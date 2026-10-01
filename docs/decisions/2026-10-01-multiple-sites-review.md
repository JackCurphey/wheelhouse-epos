# Journey 19, Multiple sites — Jack's decisions (1 Oct 2026)

Journey 19 is a business with more than one shop: which shop staff are
working in, what is shared across shops and what each shop sets for
itself, and how owners and managers see every shop at once. Background, not
reopened here: every stock record belongs to a site and data is built for
several sites from day one (Release 2 design, rule 3); each till is
registered to a site, its receipts carry the site's code (B1-1042), and a
manager can see every till from anywhere (offline foundations §5, §8); staff
with one site skip "Where are you working today?" and switch any time from
the sidebar (Signing in 9); Settings › Office › Shop and sites holds each
site's opening hours, and "Close the day" follows the site's closing time
(Owner setup 3, 13, 17–18; Receiving stock 7); a product's page shows stock
at each site, and stock moves between shops by send then receive, with a
short arrival flagged on Today (Stock take and stock control 3, 8, 11) —
journey 19 links to those transfers and does not redesign them. Real example
data: North Street Cycles, Bolton (code B, tills B1–B3), Jack Lewis, Jo
Taylor, Alex Morgan; the second shop has no real name, address or code in
the designs, so it is "[Second site]" throughout. Generator: `sites.mjs` +
`build-sites.mjs --theme sand`. Designed in the Soft sand look on its own
canvas (https://claude.ai/artifact/LXYUo9UQymsN2VyNSynAcB), desktop first,
then tablet and phone. Rules for every
journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few
clicks as possible).

1. **The whole app works for the chosen shop; owners and managers also get
   "All shops"** (Jack, 1 Oct: "1"). The sidebar's shop switcher sets the
   shop for every page — Today, the diary, stock, the till, reports. Owners
   and managers have an extra "All shops" choice that combines the overview
   pages (Today, reports, stock); pages that only make sense for one shop
   (the till, the workshop diary) ask which shop when "All shops" is on.
   Every page says which shop it is showing. Chosen over switching with no
   "All shops", and showing every shop everywhere with a filter on each page.
2. **One business, with a price or a service able to differ by shop** (Jack,
   1 Oct: "2"). Shared across shops: customers with their bikes and history,
   products and their prices, services, staff, messages and most settings.
   Each shop has its own stock counts, tills and cash-up, address, phone and
   opening hours, workshop diary and the mechanics who work there. On top of
   that, a product's price or a service (its price, or whether it is offered
   at all) can be set "only at this shop" — so the second shop can charge
   differently or not offer a service. Chosen over one business with
   everything shared, and each shop run as a separate business.
3. **A different price or service is set on the product or service itself**
   (Jack, 1 Oct: "1"). The price reads "All shops · £65.00" with "Different
   at a shop?"; that adds a line for one shop ("[Second site] · £[price]").
   A service can also be "Not offered at [Second site]". The till, booking
   and quotes each show their own shop's price; lists mark "Differs by shop",
   and the product list can be filtered to those. Chosen over a price list
   per shop in Settings, and a whole-shop percentage with exceptions.
4. **Each person has "Works at" on their page in Staff and roles** (Jack,
   1 Oct: "1"). One role across all their shops; the switcher offers only
   their shops (someone with one shop never sees it); owners always see
   every shop. A mechanic's working days are set per shop (Bolton Mon–Wed,
   [Second site] Thu–Fri), so each shop's diary shows them only on their days
   there — extending Owner setup 13, where working days sit on the person.
   Chosen over a role per shop, and everyone working at every shop.
5. **Booking starts with "Which shop?" when there is more than one** (Jack,
   1 Oct: "1"). Already chosen when the customer came from that shop's page
   ("Book a repair at this shop") or from a reminder for a bike last
   serviced there; they can change it. The rest of Book a repair then uses
   that shop's services, prices and free times; the booking's page, the
   job's page and every message name the shop. A one-shop business never
   sees the step. Chosen over picking a time across both shops, and a
   separate booking link per shop.
6. **Today with "All shops": a row per shop, then one "Needs attention"**
   (Jack, 1 Oct: "1"). Each shop's row shows sales so far, bikes expected,
   ready to collect and its tills; tapping it switches to that shop. Below,
   every shop's "Needs attention" lines in one list, each tagged with its
   shop. Chosen over each shop's Today side by side, and no "All shops" on
   Today.
7. **"+ Add a shop" in Settings › Office › Shop and sites, then a checklist
   on Today** (Jack, 1 Oct: "1"). The Sites section lists each shop (name,
   code, address, phone, hours, tills) — the "Sites" fold Owner setup's
   audit (M5) asked to be drawn open. "+ Add a shop" is a short form: name,
   code (the letter on its tills and receipts, suggested from the name),
   address, phone, opening hours with "Copy Bolton's hours". Saved, Today
   shows the new shop's checklist: register its tills, say who works there,
   get its stock in (send from Bolton, or count it with a stock take) —
   stock starts at zero. If adding a shop changes what Wheelhouse costs, the
   form says so before saving (no price is set yet: Release 2 design notes
   pricing to revisit). Chosen over a full-screen walk-through, and asking
   Wheelhouse to add it.
8. **Every till at every shop: Settings › Front desk › Till › Tills, grouped
   by shop, linked from Today** (Jack, 1 Oct: "1"). The Tills list becomes
   "Bolton · B1, B2, B3" and "[Second site] · [its tills]", each till with
   when it last sent its sales and how many are waiting; a shop's till
   status on Today's "All shops" rows opens it. Chosen over a new Tills page
   in the sidebar, and Today's rows only. Reports and cash-up totals by shop
   follow decision 1 (the chosen shop, or all shops) and are drawn with
   journey 17, Reports and accounts, not here.
