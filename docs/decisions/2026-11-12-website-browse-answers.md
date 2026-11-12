# Find the shop and browse (WP-6.2): Jack's answers, 12 Nov 2026

On the evening of 12 Nov, Jack answered the four questions in
`openspec/changes/website-browse/design.md` through the Front desk, choosing
option 1 on each.

1. **Each shop's own address, phone and hours.** Build the two-shop parts now:
   the chosen-shop chip, "Which shop will you collect from?", Our shops and
   each shop's page. The shared address, phone and hours appear on the first
   shop's card only, until Multiple sites (WP-5.2) gives each shop its own.
   No database change.
2. **"Ready at Bolton in [n] days" and which stock the website offers.** The
   website shows only what's on the chosen shop's shelf ("Ready today at
   Bolton" or "Sold out at Bolton"). The setting (Buy online decision 2's three
   choices) and the "in [n] days" and "We order it in" lines are left to
   WP-6.3.
3. **Photos.** Show the photos a product already has: its own photo and the
   photos of its sizes and colours. The viewer shows when there's more than
   one. More photos per product is a later Stock task.
4. **The staff banner on a switched-off website.** It shows at
   `/store/<slug>/` only, where "View website" goes. There is no change to
   sign-in. Staff visiting `<slug>.wheelhouseepos.com` see what customers see.

Status: decided by Jack.
