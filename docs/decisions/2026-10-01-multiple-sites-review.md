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
9. **UI audit: every recommendation taken** (Jack, 1 Oct: "yeah go ahead with
   them all"). From `design/user-journeys/sites-ui-audit.md`: **the owner
   always sees every shop; a manager gets "All shops" only when they work at
   two or more shops, and it combines just those; someone with one shop sees
   no switcher** (H1, option 1); **a till always sells for its own shop** — if
   the sidebar shows another shop, the Till page says "This till is Bolton's.
   Sales here are Bolton's." (H2, option 1); on Today's "All shops" rows the
   shop name ("Work in Bolton") and the till status are separate targets (H3,
   option 1); **a day taken at another shop is greyed out there and says
   where ("Thu · Bolton") — untick it at Bolton first to move it**, and
   unticking a shop warns about jobs booked there (H5, option 1); "Add a
   shop" shows the copied hours in one line and a placeholder for any cost
   (M2, option 2); the one-shop sidebar and a manager's Shop and sites are
   drawn, the staff switcher described (M4); lists show the chosen shop's
   price beside the all-shops one (M5, option 1); **booking's "Which shop?"
   has nothing chosen unless the customer came from that shop's page, and
   tapping a shop goes straight on** (M8, option 1); **"shop" wherever staff
   read it ("Switch shop"), "Sites" only in Settings** (M12, option 2); the
   "All shops" Today lists [Second site] lines only, so it agrees with
   Bolton's own Today (M13, option 1). Also: the switcher's name, open state
   and focus; a code suggestion and a duplicate-code error; "Now working in
   [Second site]" after a switch; the "not offered" state; Works at inside the
   real person pop-up; the shop in "Your booking" and what changing it
   resets; tills grouped under clearer shop headings with "+ Add a till";
   checklist buttons that say what they do; and the Lows (one grid for
   Today's shop rows, the shop tag in ink, Jack Lewis as Owner, "[Second
   site]" on reused boards, "Copy hours from Bolton", "Price differs").
10. **Tablet and phone drawn** (Jack, 1 Oct: "yeah go ahead with that").
    Every board is now at desktop, tablet and phone. On tablet and phone the
    shop switcher sits in the unfolded sidebar and the menu sheet, so
    choosing a shop opens "Choose a shop" as a pop-up (full screen on a
    phone). On a phone Today's shop rows stack: the shop's name with its till
    status beside it, then sales, bikes expected and ready on one line.
    Pop-ups fill the screen; staff boards use the app's own tablet and phone
    layouts. Open: on tablet and phone the chosen shop's name shows only in
    the menu, not on every page as decision 1 asks — to settle when journey
    19's switcher is carried into every journey.
