## Why

WP-4.5, Account, history and reminders, is mostly built: the account page, conversations and the staff Messages inbox, How we contact you and "Stop these", service reminders, review requests, Your data's copy and the request to delete (archived changes of 25 to 30 Oct). A check on 8 Nov found its last customer-facing parts missing: a purchase in the account's history "opens nothing yet" (`src/screens/book/account.tsx:648`), so a customer can't see a receipt (`ac-receipt`, `ac-receipt-sent`); the store credit and warranty lines; and the privacy notice (`account.tsx:30`). Jack chose on 9 Nov to have each piece's spec written one piece ahead, with its open questions brought to him before building. This is that spec, with Jack's 9 Nov answers folded in (`docs/decisions/2026-11-09-account-answers.md`). **It is not built yet;** a builder session builds from it.

## What Changes

- **A receipt from the history** (`ac-receipt`; account and reminders decision 1, audit L1, M6; UX walk-through 1 L3): a sale with a receipt number (the till's own record, "B1-0000") opens "Your receipt": the shop's name, address, phone and VAT number, the receipt's number and time, its lines, discounts, total, VAT and how it was paid. A company's reads "Invoice". The row gains "· receipt" as drawn. **Older in-shop sales, recorded without a receipt number, stay unclickable until Mark's step C** (Jack's answer 1, keeping to his 26 Oct choice for the text receipt). Today every collected repair is paid through that older record, so a repair's receipt also waits for step C. A receipt always shows what was paid, even with "Show prices online" off (answer 5).
- **Email it to me** (`ac-receipt-sent`): sends that receipt to the email on her account, then says "Sent to [email]". No address box: it goes only to her own address (the drawing's note: "'Email it to me' sends it to [email]"). No "Download receipt (PDF)" (answer 6).
- **"See it in your account" waits for step C too** (`cp-receipt-email`; third walk answer 9): staff email receipts only for the older record today, whose receipts don't open in the account under answer 1, so the button would lead nowhere. It comes with step C, with the older record's receipts. The account still opens a receipt from an address (`?receipt=`), ready for it.
- **The reminder's booking link** (`ac-reminder-landing`; account and reminders decision 2; built in this piece, answer 4): a service reminder's link is still the literal text "[link]" (`server/messaging/service-reminders.js:16`). It becomes a link of its own that opens Book a repair on "When?" with the bike and service chosen, saying "From your reminder: …", with the customer's details filled in (name and mobile partly hidden) and Change. It doesn't sign them in.
- **A request to delete on Today** (`ac-today`; coverage walk 12 L1): "[name] asked us to delete their account", when they asked and the date to answer by, with Open to Privacy requests, for the Owner.
- **Edit on Your details** (`ac-account`, `account.mjs:80`): the drawn "Edit" link, missing today. It changes name, mobile **and email** (Jack's answer 3). A new email is confirmed with a six-digit code sent to it, as signing in is, before it replaces the old one; the old one keeps working until then, and is told once it has changed.
- **The privacy notice** (`ac-account-lower`; account and reminders decision 4): the Owner types the shop's own notice in Settings › Shop details, as booking terms are (answer 2); the "Privacy notice" link under Your data shows only once it is added. Nothing here writes legal wording for a shop.
- **`bk-bookings`** ("Your bookings", listed by the build plan as one of the account's situations) is covered by the account's one history (decision 1); no separate page (question 12).
- **Not in this change, and why:**
  - The store credit card, each bike's warranty lines and the delete pop-up's store credit and money-owed lines on the account are in `openspec/changes/finish-customers/` (merged as #643, being built now; its `customer-accounts` delta). This change builds nothing for them and changes none of their words; its receipt pop-up sits beside them in `account.tsx`.
  - A Cycle to Work order in the history and the Cycle to Work bike in her bikes (`ac-account-c2w`, `ac-account-c2w-collected`): they come with Cycle to Work, WP-7.1, which builds the orders they show.
  - An online order in the history ("Order [order number] · online · receipt"): with buying online, WP-6.3.
  - The shop's own Privacy page among the website's pages (`set-website` Pages, website management decision 4): WP-6.1.
  - Receipts for older in-shop sales and for repairs, and the receipt email's "See it in your account" button: with step C (answer 1).
  - Spending store credit online; a receipt's barcode; Download receipt (PDF); the till's half of anything.
  - Mark's areas: roles (WP-1.1), the settings store and activity log (WP-1.2), sales step C, the till deposit. Nothing here changes how a sale is recorded or numbered.

## Who and risk

WP-4.5, Jack's side, built by one builder session. **Risky on two counts:** customer accounts, sign-in and public routes (`/api/portal/*`: receipts, the reminder's link, editing details and changing the sign-in email, the privacy page) and **one migration** (the reminder links' codes, a login's email waiting to be confirmed, and the shop's privacy notice). The reminder's link touches `service-reminders.js` in the messaging folder but not the messaging core (`engine.js`). `/review` before each merge and a hand-run CI (`gh workflow run test.yml --ref <branch>`). Read-only on money: nothing writes a sale, payment or stock. Seven pull requests, listed in `tasks.md`.

## Follows

- Decisions: `docs/decisions/2026-11-09-account-answers.md` (Jack's answers to this change's questions); `docs/decisions/2026-10-01-account-and-reminders-review.md` 1 and 4, audit L1, M6, and the later change of 3 Oct (third walk answer 9); `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md` 9; `docs/decisions/2026-10-02-leftover-screens-review.md` (M8, H1); `docs/decisions/2026-10-26-receipt-and-own-messages.md` 1 to 3 (the text receipt waits for step C, no PDF, no barcode; the account's receipt follows all three, answers 1 and 6, question 7); `docs/decisions/2026-10-26-day-answers.md` 10 (a company's receipt reads "Invoice" until VAT is recorded); `docs/decisions/2026-10-02-website-management-review.md` 4 (the Privacy page's starting wording needs a solicitor; WEB-2 in `2026-09-01-ownership-signoff.md`); `docs/decisions/2026-10-16-go-live-checklist.md` 4 (legal pages before a shop goes live); `docs/decisions/decided-while-building.md` (30 Oct, Your data item 8: "Privacy notice" left out until there is a page).
- Drawings (`docs/design/user-journeys/generator/account.mjs`, `collect.mjs`, `opening.mjs`, `book.mjs`): `ac-receipt`, `ac-receipt-sent`, `ac-account` and `ac-account-lower` (the history's rows, Your details' Edit, Your data's link), `cp-receipt-email` (the button and footer), `ac-reminder-landing`, `ac-today`, `bk-bookings`.
- Also: `docs/decisions/2026-10-01-account-and-reminders-review.md` 2 (the reminder's link opens Book a repair with the bike and service chosen, on "When?"); `docs/decisions/2026-10-01-book-a-repair-review.md` 10 ("Your bookings"); `docs/decisions/2026-10-04-coverage-walks.md` (walk 12 L1, the name Privacy requests shows).
- Built: `openspec/specs/customer-accounts` (the account page, history and code sign-in), `openspec/specs/receipt-email` (unchanged here), `openspec/specs/shop-details` (booking terms, the pattern for the privacy notice).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `customer-accounts`: a receipt with a receipt number opens from the account's history and can be emailed to the customer's own address; a receipt address opens it; a repair's payment shows once; Edit on Your details, with a new email confirmed by code; the link to the shop's privacy notice.
- `book`: a service reminder's link opens the booking with the bike and service chosen.
- `messages`: a service reminder carries its own booking link.
- `today`: a request to delete an account goes to Needs attention.
- `shop-details`: the shop's own privacy notice in Settings.

## Impact

New: `server/receipts.js` (a till sale's receipt, for the account and its email; the older record is added with step C), `src/screens/book/receipt-dialog.tsx`. New also: `server/messaging/reminder-links.js`, `server/migrations/1NN_reminder_links.sql` (the next free number at build time; `finish-customers` takes the next two), `src/screens/book/details-dialog.tsx`, `src/screens/book/privacy.tsx`. Changed: `server/messaging/service-reminders.js` (the booking link), `server/routes/portal.js` (receipts, the reminder link, `PUT …/me` and the email change's two routes, the privacy page; a purchase says whether it opens a receipt, and a repair's own payment isn't listed again as a purchase; a booking accepts a reminder code), `server/routes/today.js`, `server/routes/shop-settings.js` (the privacy notice), the customer merge (`server/routes/customer-merge.js`: codes move with the customer, as `reminder_stop_codes` do), `src/screens/book/account.tsx`, the booking's draft and "When?" step (`src/screens/book/draft.tsx`, `date.tsx`, `details.tsx`), `src/screens/today/today-page.tsx`, the Shop details settings screen. Tests: new `tests/portal-receipts.test.js`, `tests/reminder-links.test.js`, `tests/migration-1NN.test.js`, `tests/screens/account-receipt.test.js`, `tests/screens/reminder-landing.test.js`, `tests/browser/account-receipt.spec.ts`, `tests/browser/reminder-landing.spec.ts`; new `tests/portal-email-change.test.js`; changed service reminder, today, portal and route-list tests.
