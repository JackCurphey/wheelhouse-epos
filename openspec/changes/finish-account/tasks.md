# Tasks

Follows Jack's answers of 9 Nov (`docs/decisions/2026-11-09-account-answers.md`); the small defaults 7 to 13 in `design.md` stand unless he overrules one.

Each pull request: tests first, each watched failing for the right reason (break the code it covers, see it go red, restore, and check the break really landed); `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review against these specs and the drawings; and `/review` with a hand-run CI (`gh workflow run test.yml --ref <branch>`), since every pull request here touches customer accounts, sign-in or `/api/portal/*`, and PR 3 is a migration. Every gap decided while building goes in Jack's section of `docs/decisions/decided-while-building.md`. Server tests pin the clock to 1 Sep 2026; customer tests need `npm run pretest`. Aim: 250-600 changed lines each. Pull requests 1→2, 3→4 and 3→6 are stacked; 5 and 7 stand alone (7 needs 3's column).

## 1. Receipts on the server (PR 1, about 400 lines)

- [x] 1.1 Tests first (`tests/portal-receipts.test.js`): `receiptFor` for a till sale ("B1-0000", lines, VAT at each rate, payments in pence) and a company's ("Invoice", Invoice to); `GET …/receipts/till/:id` for her own sale, a merged record's sale, another customer's, another shop's and an old-record sale (each 404 "We can’t find that receipt"); the receipt shows prices with Show prices online off (answer 5); `POST …/email` sends to the account's email whatever the body says, refuses another website, refuses the sixth in an hour; the history's purchase items carry `receipt` for a till sale and null for an old-record sale; a repair's own sale is not also a purchase row. Verify: each fails for the right reason before 1.2.
- [x] 1.2 `server/receipts.js` (`receiptFor`, `receiptText`); the two routes in `server/routes/portal.js` with `// screens: ac-receipt, ac-receipt-sent` and the route-list lines; `repairsAndPurchases` gains `receipt` and leaves out a repair's sale. Verify: 1.1 passes.

## 2. The receipt on the account (PR 2, about 350 lines)

- [x] 2.1 Tests first (`tests/screens/account-receipt.test.js`, `tests/browser/account-receipt.spec.ts`): a till purchase's row is a button reading "· receipt"; an old-record purchase and a repair open no receipt (answer 1); choosing one opens "Your receipt" with "[number] · [date] · North Street Cycles", the body, the note "“Email it to me” sends it to maya@example.test." and one button, "Email it to me" (no PDF, answer 6; no barcode, question 7); pressing it shows "Sent to maya@example.test"; a failure shows "That didn’t go through. Try again."; `?receipt=till-41` opens it on arrival, and one that isn't hers shows "We can’t find that receipt"; signed out, the sign-in returns to the same address and opens it. Verify: each fails first.
- [x] 2.2 `src/screens/book/receipt-dialog.tsx`; `account.tsx`'s purchase rows and the `?receipt=` opening; its header comment (line 30) says what's left: older sales' receipts with step C, and store credit and the warranty line if `finish-customers` hasn't merged. Verify: 2.1 passes.

## 3. The migration and the reminder's link on the server (PR 3, migration, about 500 lines)

- [ ] 3.1 Tests first (`tests/reminder-links.test.js`, `tests/migration-1NN.test.js`, service reminder tests): the migration (`reminder_book_codes`, `customer_logins.pending_email` and `pending_email_at`, `shops.privacy_notice`) from empty on a scratch database, run twice; a code is made when a reminder is set up, only its hash kept; with sending real the reminder's text carries `/book/<shop>/from-reminder/<code>`, while pretend it reads "[link]"; `GET …/reminder-links/:code` gives the service, bike and "Maya P." with "07700 ••• 142", and 404 for a bad code or another shop's; a removed bike or a service no longer booked online comes back empty for that part (question 10); a booking with `reminderCode` and no typed details is made for the code's customer, and with typed details uses those; a bad code is refused with "This reminder’s link has expired. Choose your bike and service to book."; a merge moves the codes; deleting the customer removes them. Verify: each fails first.
- [ ] 3.2 The migration (`1NN_account_links.sql`, the next free number); `server/messaging/reminder-links.js`; `service-reminders.js` replacing its `LINK`; the route in `portal.js` and `reminderCode` on `POST …/bookings`; `server/routes/customer-merge.js` and the deletion step. Verify: 3.1 passes.

## 4. The reminder's landing (PR 4, about 350 lines)

- [ ] 4.1 Tests first (`tests/screens/reminder-landing.test.js`, `tests/browser/reminder-landing.spec.ts`): `/book/<shop>/from-reminder/<code>` opens on "When?" with the service and bike done, the box "From your reminder: booking the next Standard service for your Trek Domane AL 3 · green · black mudguards. Change either above." and "Maya P. · 07700 ••• 142 · Change"; booking from it skips typing details; Change clears them and the details step asks; a missing service or bike opens at that step; a bad code opens Book a repair as for anyone. Verify: each fails first.
- [ ] 4.2 The route and draft filling (`src/screens/book/draft.tsx`, `date.tsx`, `details.tsx`, the router). Verify: 4.1 passes.

## 5. Today's deletion line, and Edit for name and mobile (PR 5, about 400 lines)

- [ ] 5.1 Tests first (today route and screen tests; portal and screen tests for details): an open deletion request shows for the Owner as "Maya Patel asked us to delete their account" with "From their account on the website, [date] · answer by [date]" and Open to Privacy requests (question 11), not for staff, gone once done or cancelled; "Edit" opens Name, Mobile and Email; a changed name or mobile saves at once and shows; a bad mobile, a cleared mobile while updates go by text, and another website's request are refused. Verify: each fails first.
- [ ] 5.2 `server/routes/today.js`, `today-page.tsx`; `PUT /api/portal/:shopSlug/me` (locks the customer's row) and `src/screens/book/details-dialog.tsx` (Email shown, changed in PR 6). Log the Edit box (not drawn) in `decided-while-building.md`. Verify: 5.1 passes.

## 6. Changing the email, confirmed by code (PR 6, sign-in, about 500 lines)

- [ ] 6.1 Tests first (`tests/portal-email-change.test.js`, details screen tests, a browser test): a new email sends a code through the sign-in provider and keeps it pending; the right code changes the login's and customer's email (`email_from_customer` true) and says "Your email is now [new email]. Use it to sign in from now on."; before that, the old email still signs in and gets messages; a wrong, expired or used-up code is refused with the sign-in's words and changes nothing; the sign-in's limiters apply; the same address, a badly formed one, and one used by another login or another customer's own email at the shop ("That email is already used for another account at North Street Cycles. Ask North Street Cycles to help.") are refused before any code is sent; after the change the old address gets "Your email address has changed — North Street Cycles" with the new one's middle hidden and the shop's phone; the new email signs in and the old one no longer does; devices already signed in stay signed in; another website's request is refused. Verify: each fails first.
- [ ] 6.2 `POST /api/portal/:shopSlug/me/email` and `…/confirm` (the customer's row locked for the change); the old-address email; the code step in `details-dialog.tsx`, following the sign-in's code screen. Log the old-address email and staying signed in in `decided-while-building.md` (design § 6). Verify: 6.1 passes.

## 7. The privacy notice, and the walk against the drawings (PR 7, about 300 lines)

- [ ] 7.1 Tests first: Settings › Shop details "Privacy notice", Owner only, saves, changes and removes the shop's words; `GET …/privacy` returns them or 404; Your data shows "Privacy notice" only when there is one, opening `/book/<shop>/privacy` with the words and line breaks as typed. Verify: each fails first.
- [ ] 7.2 The setting in `server/routes/shop-settings.js` and its screen; `src/screens/book/privacy.tsx`; the link in `account.tsx`. Verify: 7.1 passes.
- [ ] 7.3 Walk the built piece against every requirement in this change's specs and the drawings (`ac-receipt`, `ac-receipt-sent`, `ac-account`, `ac-account-lower`, `ac-reminder-landing`, `ac-today`, `bk-bookings`) and Jack's 9 Nov answers; say in the pull request which are met, dropped or changed. Verify: the list is in the pull request description.

## Workflow follow-up

- `/opsx:archive` as the last commit of PR 7, before it merges, so `openspec/specs/` describes what was built.
- The day's status pull request updates the build board's WP-4.5 line (`design.md` § 9) and `.agents/STATUS.md`.
- With step C (Mark): older sales' and repairs' receipts open from the account, and the receipt email gains "See it in your account" (`cp-receipt-email`).
