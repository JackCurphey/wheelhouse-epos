# An in-shop customer who signs up online

Mark's 21 Oct review fix (#348, working agreement task 3.3) stopped customer
sign-up taking over an existing customer by email: every sign-up now makes a
new customer, so someone who has been in the shop ends up with two records.

## Answer

1. **Staff join the two records by hand.** Jack, 21 Oct: "1: staff join the
   two records by hand with a Merge action when the emails match."

   Not automatic joining after the customer confirms their email (that needs
   real email sending), and not left undecided. This is the drawn merge:
   `cs-page-dup` flags the possible duplicate on the customer's page, and
   `cs-merge` ("The same person? Keep or merge") lets staff pick what to keep,
   with jobs, sales and bikes from both kept together. A new online account
   whose email matches an existing customer is one such possible duplicate.
   The drawings are in the Customers package (WP-3.2), which isn't built yet.

2. **Built with the Customers package, as planned.** Jack, 21 Oct: "1: build
   the merge with the Customers package (WP-3.2), as planned." Not pulled
   forward: until then a sign-up from someone already in the shop stays a
   second record, which can't happen to a real customer before a shop is live.
