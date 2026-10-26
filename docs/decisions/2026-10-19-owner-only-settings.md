# Settings for the Owner only, until roles are built (19 Oct 2026)

Who can change settings is decided (`2026-10-05-roles-and-switches.md`; Owner
setup decision 10): Owners, Managers, and anyone with the "Can change
settings" switch. None of that is built: the server knows only the Owner
(`logins.is_owner`), and Managers and switches are Mark's WP-1.1. Until then
any signed-in staff member could change the shop's name, VAT number,
receipt words and opening hours, by typing the Settings address or through
the server.

1. **Owner-only for now** (Jack, 19 Oct: "1: Owner-only for now, on the
   Settings page and the server routes behind it, until WP-1.1 brings
   Managers and the Can change settings switch. Flag Mark's files"). The
   Settings page shows anyone else the drawn "not part of your role" page
   (`auth-noaccess`), and the routes it saves through refuse them. This
   holds the 5 Oct decision back for Managers and the switch until WP-1.1;
   it doesn't change it. Chosen over building WP-1.1 now and over leaving
   it open.

## Later: the website settings (22 Oct)

Mark's audit (22 Oct, P2 1) found the website settings and the Shopify
connection still open to any staff member. Jack, 22 Oct: "1: make the website
settings and the Shopify connection Owner-only now, like the rest of
Settings." `PUT /api/storefront-settings`, `POST /api/shopify/connection`
and the logo and hero uploads are now Owner only, and
`tests/owner-only-routes.test.js` checks `website.js` with the other files.
