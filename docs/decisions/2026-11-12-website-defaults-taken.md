# Website management (WP-6.1): defaults taken overnight, 12 Nov 2026

On 12 Nov Jack answered "1" to the Front desk: overnight sessions may take
the recommended answer on spec questions, marked "default taken, Jack can
overrule", except anything touching money taken at the till, real
accounts, or contradicting a recorded decision.

These four are defaults taken under that answer. **Jack can overrule any of
them**; the plan is `openspec/changes/website-management/`, and the full
questions with their options are in the overnight file `spec-website.md`.

1. **Starting wording for "Collection and returns" and "Privacy"** — option 3.
   For now each page starts with headings and bracketed gaps like
   "[How long customers have to collect]", and says "Check this" until the
   shop saves it. A checked standard wording replaces the gaps later, as its
   own change. Nothing invented reaches a customer.
2. **Products in Shopify that aren't in Wheelhouse** — option 1. They are
   left alone in Shopify (never hidden or deleted), and "Ready to send to
   Shopify" lists them under the drawn "See the list of products".
3. **How long History keeps old versions and discarded changes** — option 2,
   90 days.
4. **Which piece builds the Online orders settings page** — option 1. This
   piece (WP-6.1) builds the page with only "Buying online" and "Paying
   online"; WP-6.3 adds its other sections later.

Status: defaults taken, waiting for Jack to confirm or overrule.

## Jack's answers to the build questions, 12 Nov evening

Four questions came up while building (the overnight file `website.md`, Q1 to
Q4). Jack answered through the Front desk on the evening of 12 Nov ("b all
yes"), approving the design changes in Q1 and Q3.

1. **Q1, "See them" on the Website page** — option 2. See them opens Stock
   filtered to those products, with a line "Showing products with no photo ·
   Show all" (or "no price"), and no new pills on Stock. From the Website
   page it keeps to products switched to show online, as the page counts
   them; from the set-up's step 3 it counts every product, as step 3 does.
2. **Q2, when Wheelhouse sends changes to Shopify** — option 1. Each change
   is sent as it happens: a queue watches sales, stock and product edits and
   sends them through the Shopify adapter (the pretend one until a real
   Shopify account exists). Built as its own pull request; it touches stock
   and sales, so it is treated as a risky area.
3. **Q3, connecting Shopify with the website live** — option 1. One line
   above Connect, only when the Wheelhouse website is on: "Your Wheelhouse
   website will be switched off when Shopify is connected."
4. **Q4, when to archive the change** — option 1. The change stays open
   until pull requests 7 (roles) and 8 (moving) are built, and is archived in
   the last of them.

