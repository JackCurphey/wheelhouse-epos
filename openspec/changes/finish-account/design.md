# Design

**Not built.** Jack answered the six main questions on 9 Nov (`docs/decisions/2026-11-09-account-answers.md`); they are folded in here, in the specs and in the tasks. The small ones (§ Open questions, 7 to 13) are built on their defaults unless he overrules one.

## Context

What exists today (checked 9 Nov against main at `daa38577`):

- **The account** (`src/screens/book/account.tsx`, archived changes `customer-account-screens`, `how-we-contact-you`, `ask-the-shop-*`, `your-data-*`, `delete-account`): bikes, Your details with How we contact you, the history (Everything, Repairs, Purchases; Now, then Earlier eight at a time), Your data's copy and the request to delete with Cancel my request. Its comment at line 30 lists what's left out: store credit, the warranty line, a purchase's receipt and the privacy notice. Your details has **no "Edit"** (`account.tsx:456-461`); the drawing has one (`account.mjs:80`).
- **The history** comes from `repairsAndPurchases()` (`server/routes/portal.js:694`): repairs from `workshop_jobs` with the repair page's own figures (`jobMoney`, so "Show prices online" off hides a repair's total), and purchases from the `all_sales` view (migration 083) over both sales records: the old `sales` (pounds, no receipt number) and the till's own `till_sales` (pence, `receipt_number`, shown as `B1-0000` by `receiptLabel` in `server/till/money.js`). A purchase row opens nothing (`account.tsx:648`).
- **A repair's payment:** collecting converts the job's order (`sale_documents`, `kind = 'order'`, `workshop_job_id`) into an old-record sale, `converted_sale_id` (`server/routes/sales.js:742`). So today every paid repair's sale is in the old record, with no receipt number.
- **The receipt email** (`server/messaging/receipt-email.js`): staff send it from the till; it reads only the old record and says "Sale [n]". It has no "See it in your account" button (`cp-receipt-email` draws one). Unchanged by this change.
- **Code sign-in** (`openspec/specs/customer-accounts`; `server/signin/provider.js`, the pretend provider in `server/signin/pretend.js` keeping six-digit codes in `pretend_signin_codes`, 10 minutes, used once, five wrong tries; `POST /api/portal/:shopSlug/sign-in/code` and its check, with network and per-email limiters, `portal.js:787`). `customer_logins.email` is unique per shop; `loginForSignedInEmail` (`portal.js:117`) joins a first sign-in to the one active customer whose own email (`email_from_customer`, migration 084) matches.
- **Service reminders** (`server/messaging/service-reminders.js`): the booking link in the reminder is the literal text `[link]` ("the booking landing and the stop page come in later pieces", line 16). The stop page was built (`reminder_stop_codes`, migration 079, `stop-codes.js`); the landing (`ac-reminder-landing`) was not. While sending is pretend every link reads `[link]` (`messageLink`).
- **Today** (`server/routes/today.js`, `today-page.tsx`) shows "messages need a reply" but no line for a request to delete an account (`ac-today`, drawn in `opening.mjs:156`).
- **Privacy requests** (`server/privacy-requests.js`, migration 108/109): Owner-only list; an open deletion has `asked_at` and a "finish by" date a month on (`DUE_BY`), which the account already shows.
- **Booking terms** are the closest built pattern for a shop's own legal words: Settings "Booking terms", the shop's own text (up to 20,000 characters) or Wheelhouse's standard terms, read by `GET /api/portal/:shopSlug/terms`.
- **Bikes and warranties** are `finish-customers`' (Jack, 9 Nov): a product is a bike when its category is ticked "Bikes" or "E-bikes" in Settings › Stockroom › Categories, and "E-bikes" adds the Electronics line. This change adds no bike or warranty rule of its own.
- Latest migration on disk: 125. `finish-customers` takes the next two at build time.

## Goals / Non-Goals

**Goals:** a customer sees and emails every receipt in their history that has a receipt number; nothing in this piece writes a sale, a payment or stock; the reminder's link lands where decision 2 says; a sign-in email changes only once the new address has proved it receives mail; no legal wording is invented.

**Non-Goals:** changing how sales are numbered or recorded (step C, Mark); receipts for old-record sales and repairs, and the receipt email's account button (both with step C, answer 1); anything in `finish-customers` (store credit, warranty lines, the delete pop-up's money lines); Cycle to Work and online orders in the history (WP-7.1, WP-6.3); the website's own Privacy page (WP-6.1).

## Decisions

### 1. A till sale's receipt (`server/receipts.js`; Jack's answer 1)

`receiptFor({ source: 'till', id })` returns `{ heading, number, at, shop: { name, address, phone, vatNumber }, invoiceTo, lines: [{ name, qty, unitPence, totalPence }], totalPence, vatLines: [{ ratePercent, pence }], payments: [{ how, pence }], customerId }` or null, from `till_sales`, `till_sale_lines` and `till_sale_payments`. Number `receiptLabel(till.code, receipt_number)` ("B1-0000"); "VAT at [rate]" one per rate, from each line's `vat_rate_bp` and `vat_pence`, only when the sale's `vat_pence` is above 0. A company customer's heading is "Invoice", with Invoice to, as the receipt email does it (day answers 26 Oct, 10). `receiptText(receipt)` lays it out as plain text in the receipt email's frame for "Email it to me".

**Only a sale with a receipt number opens a receipt.** An old-record sale, recorded without one, stays an unclickable row, as today, until step C gives those sales numbers (Jack, 9 Nov, answer 1, keeping to his 26 Oct choice that the text receipt waits for step C: "nobody uses Wheelhouse yet, so it can change later"). Because every repair is paid through the old record today, a repair row opens its job page as now and carries no receipt. *Why a function that takes a `source`:* step C adds `'old'` (or retires it) in one place.

### 2. Portal routes (`server/routes/portal.js`, `// screens:` comments)

- `GET /api/portal/:shopSlug/receipts/till/:id` (signed in): the receipt when the sale's customer is the signed-in customer, or a record merged into them (as the history reads). Anything else, another shop's or another customer's or an old-record sale, is a 404 "We can’t find that receipt". *Why not the sale id alone:* ids are guessable; the customer check is the guard.
- `POST /api/portal/:shopSlug/receipts/till/:id/email` (signed in; refuses a request from another website, as add-a-bike does): sends `receiptText` to the account's own email through `sendEmailTo`, never an address from the request; at most 5 an hour per customer (question 9); answers `{ sentTo }`.
- **Show prices online off (answer 5):** the receipt is shown whatever the setting. Jack's reasoning: shops that hide prices online usually hide only service prices; bikes and accessories always have prices; a receipt is what was paid.
- The history's purchase items gain `receipt: { source: 'till', id } | null` (null for an old-record sale). **A sale that is a repair's payment is left out of the purchase rows** (question 8), so the money shows once, on the repair.

### 3. The receipt pop-up (`src/screens/book/receipt-dialog.tsx`)

A dialog in the account's own pop-up frame, as the delete pop-up is: title "Your receipt", under it "[number] · [date] · [shop name]"; the receipt body (shop's details; "Receipt [number]" or "Invoice [number]" and "[date] · [time]"; the lines, with "[n] × £[each]" under a line of more than one; "Total (includes VAT)" when the sale has VAT, else "Total"; "VAT at [rate]"; "Paid by …"); the note "“Email it to me” sends it to [email]."; one button, "Email it to me" (no PDF, answer 6; no barcode, question 7). After sending, the note becomes the green bar "Sent to [email]" (`ac-receipt-sent`). A failure shows "That didn’t go through. Try again." in the account's existing warning bar. A row with a receipt becomes a button opening it, and reads "[date] · in the shop · receipt". `?receipt=till-41` opens it on arrival (ready for the receipt email's button, which comes with step C); one that isn't hers shows "We can’t find that receipt" in the warning bar and leaves the account as it is. Signed out, the built sign-in brings her back to the same address.

### 4. The reminder's link (`ac-reminder-landing`; account and reminders decision 2; answer 4)

`reminder_book_codes (id, shop_id, code_hash UNIQUE, customer_id, bike_id NULL, service_id NULL, job_id, created_at)` in this change's migration, row-level security as every table. Made with the reminder when it is set up (as the stop code is, `service-reminders.js:103`, because the timer has no request to build a link from), only the hash kept (`newLinkCode`/`hashLinkCode`). The reminder's `[link]` becomes `/book/<shop>/from-reminder/<code>` (still `[link]` while sending is pretend). Merging records moves the codes with the customer; deleting the customer removes them.

- `GET /api/portal/:shopSlug/reminder-links/:code`: `{ serviceId, bikeId, bikeLabel, serviceName, details: { name: "Maya P.", phone: "07700 ••• 142" } }` (first name and initial; the mobile's first five and last three digits, as drawn), or 404 for a code that doesn't work. **No sign-in is made**; it only fills the booking.
- The booking page opens on "When?" with the service and bike chosen and the drawn box: "From your reminder: booking the next **[service]** for your **[bike]**. Change either above." and "Your details are filled in from your reminder: **[Maya P.]** · [07700 ••• 142] · Change". "Change" clears the filled details, and the details step asks as for anyone.
- `POST /api/portal/:shopSlug/bookings` accepts `reminderCode`: with it, and no typed details, the booking is made for the code's customer and their record's details, as a signed-in booking is. A code that no longer works is refused with "This reminder’s link has expired. Choose your bike and service to book." and the page falls back to the normal steps.
- When the service is no longer bookable online, or the bike has gone, the page opens at the first step still needed (question 10). Online booking off shows the built "Online booking is unavailable just now".

### 5. Today's line for a request to delete (`ac-today`)

`today.js` gains one line per open deletion request: "[name] asked us to delete their account" (question 11: "their", since we don't record pronouns), under it "From their account on the website, [asked] · answer by [finish by]" (once `finish-customers` adds how a logged request came, "Asked in person, [asked] · answer by [finish by]" for one the shop logged), with Open to Privacy requests. Shown to the Owner only, as Privacy requests are, until roles.

### 6. Edit your details, email included (Jack's answer 3)

"Edit" beside Your details opens a Form box (block 9, as How we contact you's box is): Name, Mobile and Email, Cancel and Save.

- **Name and mobile** save at once through `PUT /api/portal/:shopSlug/me { name, phone }` (refuses another website's request; the mobile checked as the booking checks it; locks the customer's row, as the other customer saves do). Clearing the mobile is refused while job updates go by text or WhatsApp, with How we contact you's words ("We don’t have a mobile number for you, so we can’t text you.").
- **A new email** is not saved by Save. `POST /api/portal/:shopSlug/me/email { email }` sends a six-digit code to the new address through the same sign-in provider (`signinProvider().sendCode`), under the sign-in's own limiters, and keeps it on the login as `pending_email` with `pending_email_at` (the migration). The box then shows the sign-in's code step: "We sent a code to [new email]. It works for 10 minutes." with the code box, "Confirm", and "Send a new code". `POST …/me/email/confirm { code }` checks it (`checkCode`, the sign-in's wrong, expired and used-up words, `SIGNIN_REFUSED`). On "ok", in one step with the customer's row locked: the login's `email` and the customer's `email` become the new one, `email_from_customer` true, `pending_email` cleared. The box says "Your email is now [new email]. Use it to sign in from now on."
- **Until it is confirmed, nothing changes:** the old email still signs in and still gets every message. A pending change older than 10 minutes, or replaced by another, is simply gone.
- **Refused before a code is sent:** the same address as now ("That’s already your email"); a badly formed one (the receipt email's words, "That doesn’t look like an email address — check it"); an address that already signs in to another account at this shop, or is another active customer's own email here: "That email is already used for another account at [shop]. Ask [shop] to help." (*Why:* a customer's own email decides which record a first sign-in joins, `loginForSignedInEmail`; two records with it would make that guess wrong.)
- **The old address is told** once the change is made, by one email (`sendEmailTo`, pretend until Jack says yes): subject "Your email address has changed — [shop]", body "The email on your [shop] account is now [new email, its middle hidden as m•••@example.test]. You’ll sign in with it from now on. If you didn’t make this change, call [shop phone]." (no phone line when the shop has none). *Pattern:* no built screen or message tells a customer about a change to their account, so this is a gap, logged in Jack's section of `decided-while-building.md`, 9 Nov; it follows the receipt email's plain frame and the delete pop-up's "call [shop phone]" line. The new address isn't sent a second email: the code already reached it, and the box says it is done.
- **Signed-in devices stay signed in**: a session belongs to the login, not the address, so changing the address doesn't sign anyone out (logged with the item above).

### 7. The privacy notice (Jack's answer 2)

Settings › Shop details gains "Privacy notice", built as Booking terms is: "Add your privacy notice" opens a text box (up to 20,000 characters), Save; once added, "Change" and "Remove". Under the heading: "Shown on your website account. Each shop is responsible for its own policies." Owner only. A nullable `shops.privacy_notice` column in this change's migration. `GET /api/portal/:shopSlug/privacy` returns it or 404. The account's Your data shows "Privacy notice" only when the shop has one, opening it on its own page (`/book/<shop>/privacy`) in the booking frame, the shop's words as typed, line breaks kept. No Wheelhouse wording is offered. When WP-6.1 builds the website's Privacy page, it starts from this text. Linking it from the booking's "I agree" line is not drawn there yet and is left out.

### 8. One migration

`1NN_account_links.sql` (the next free number at build time, after `finish-customers`' two): `reminder_book_codes` (§ 4), `customer_logins.pending_email TEXT NULL` and `pending_email_at TIMESTAMPTZ NULL` (§ 6), `shops.privacy_notice TEXT NULL` (§ 7). Additive and safe to run twice.

### 9. The build board

The status pull request that follows the last merge replaces WP-4.5's "not yet: [to check against the drawings]" with what is left: receipts for older sales and repairs, and the receipt email's account button (step C); Cycle to Work rows (WP-7.1); online orders (WP-6.3); store credit and warranty lines if `finish-customers` hasn't merged.

## Risks / Trade-offs

- [Until step C, almost no row opens a receipt, since sales and repairs still go through the old record] → Jack's answer 1 accepts this: nobody uses Wheelhouse yet. The receipt, its route and pop-up are built and tested against till sales, so step C only adds the old record.
- [A forwarded reminder lets someone else book in the customer's name] → only the masked name and number are shown, nothing else of hers is readable through the code, and the booking goes through the shop's normal confirmation; drawn and decided (decision 2, `ac-reminder-landing`).
- [Someone signed in on a shared computer changes the email to take the account] → the new address must receive the code, and the old address is told with the shop's phone; the shop can change it back on the customer page.
- [The real sign-in provider (WorkOS) treats a code to a new address as a new user] → the change goes through the same adapter as sign-in; the pretend version is what is built and tested now, as every outside service is.
- [`finish-customers` edits `account.tsx` and `portal.js` at the same time] → this change touches different parts (rows, new dialogs, new routes); whichever merges second merges main first, as always.
- [The privacy text is the shop's own, unchecked] → the setting's line says each shop is responsible, as the website drawing says.

## Migration Plan

One additive migration (§ 8), tested from empty on a scratch database and run twice. Rolling back the code leaves an unused table and three unused columns; nothing existing is rewritten.

## Open Questions

Jack answered the six main questions on 9 Nov (`docs/decisions/2026-11-09-account-answers.md`): 1, only a sale with a receipt number opens a receipt now, the rest with step C; 2, the Owner types the shop's own privacy notice; 3, Edit changes name, mobile and email, a new email confirmed by code; 4, the reminder's link is built here; 5, a receipt always shows what was paid; 6, no PDF.

Small ones, built on these defaults unless Jack overrules one (kept as proposed, 9 Nov):

7. No barcode on the account's receipt, as on the text receipt (26 Oct answer 3).
8. A collected repair's payment shows once: on the repair's row, not again as a purchase.
9. "Email it to me" goes only to the account's own email, at most 5 an hour per customer; a company's reads "Invoice".
10. The reminder's link keeps working (no expiry, like Stop these) while the customer's record exists. A service no longer bookable online opens the service step with the bike chosen; a removed bike opens the bike step with the service chosen.
11. Today's deletion line is the Owner's only (as Privacy requests are), one line per open request, reading "[name] asked us to delete their account".
12. `bk-bookings` ("Your bookings") is covered by the account's history, as the build plan lists it as one of the account's situations; no separate page.
13. A refund isn't shown on a receipt in this piece; the receipt shows the sale as it was made.
