# Opening hours in Settings (19 Oct 2026)

After the receipt words (#279), Jack chose opening hours under Shop and sites
next (Jack: "2", offered as: the drawn opening-hours page, which the booking
pages and diary depend on). Drawn as `set-shop-hours` (`setup.mjs`):
"Opening hours · Bolton", Monday to Sunday, each with opens and closes and
an Open/Closed choice.

1. **Build the opening hours in Settings › Shop and sites** (Jack, 19 Oct:
   "2"). The shop's hours are already kept for the whole business
   (`workshop_settings`: open days and each day's hours, read by the diary
   and online booking, edited today in the old app) and `PUT
   /api/workshop-settings` already takes `openingHours`, so no server change
   is needed. Like Shop details (`2026-10-18-shop-details.md` answer 1),
   they're one set for the whole business until Mark's WP-1.4 gives shops
   their sites, when they move onto the first site.
