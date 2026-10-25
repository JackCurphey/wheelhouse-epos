# The customer's account page: whose history, and opening a repair

The account page (journey 7, `ac-account`, WP-4.5) waited on the emailed-code
sign-in, which is now built (#500, #502). Two things weren't settled by the
drawings or decisions. Jack answered both on 25 Oct, late evening.

## Answers

1. **A code sign-in joins the customer the shop already has, when it's clear
   who that is.** Jack: "2". If the email the code was sent to matches exactly
   one existing customer who has no online account yet, the sign-in joins that
   customer, so their bikes and repairs show straight away. Two or more
   matches, or a match that already has an online account, stay as now: a new
   customer, for staff to join with Merge.

   This changes `2026-10-21-sign-up-joins-by-merge.md` answer 1 for code
   sign-in only. That answer chose joining by hand because automatic joining
   "needs real email sending" to prove the email is theirs; typing a code sent
   to that email proves it. Password sign-up is unchanged.
   Chosen over keeping the join by hand, and over asking the customer "Is this
   you?" (a new screen). The risk accepted: two people sharing one email.

2. **A repair in the account's history opens its own page, let in by the
   sign-in.** Jack: "1". The same repair page the private link opens, for a
   signed-in customer whose job it is. Chosen over a summary inside the account
   only, and over making a fresh private link on each tap.

3. **Store credit** (not asked): decision 1 of
   `2026-10-01-account-and-reminders-review.md` shows it "when the shop uses
   it", and store credit isn't built, so the card is left out until it is.
