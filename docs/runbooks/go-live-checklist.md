# Go-live checklist: the first shop going live

Everything that has to be true before the first shop runs on Wheelhouse
alone (WP-8.3, "Switch-over and one trading week alone", now in the selling
stage after Release 2). Until 18 Oct this was written for Jack's shop; Jack
then decided Wheelhouse is built for every shop and his shop goes through
the same handover as any other, so the lines below are for whichever shop
goes live first (`docs/decisions/2026-10-18-build-for-every-shop.md`,
answers 4 to 6).
Issue #140 asked for it (from Codex's review in #126, finding 15). Each line
says who does it and where it was decided. Jack answered every open
question on 16 Oct (`docs/decisions/2026-10-16-go-live-checklist.md`); the
lines without a name to decide are Mark's to set up.

Tick a line only when it is done and checked, not when it is planned.

## 1. Real accounts and keys

From the build plan §5 ("all of them block going live") and Q10
(`docs/decisions/2026-10-03-build-plan-questions.md`). Mark sets up each
account once Jack says yes; Jack says yes to anything that costs money.

- [ ] **Hosting for real shops** (Mark), **in the UK only** (Jack, 16 Oct):
  the database, backups and stored files. The test copy is already on
  DigitalOcean in London (`docs/decisions/2026-10-15-hosted-copy-region.md`).
  The privacy notice says the data is kept in the UK.
- [ ] **Hosting fit for real shops**: health checks, automatic deploys,
  monitoring and an email provider (PL-11 to PL-14,
  `openspec/changes/add-hosted-copy/design.md`) (Mark).
- [ ] **Stripe**: the card reader and online payments
  (`docs/decisions/2026-10-05-card-payments-provider.md`) (Mark, after
  Jack's yes). **The reader: a Stripe Reader S700** (£229 when checked on
  5 Oct), on the shop's Wi-Fi, with a phone hotspot as the fallback for the
  till and the reader when the shop's internet is down (Jack, 16 Oct).
  Bought with Jack's yes at the time. (The cheaper WisePad 3 can't be
  driven from the server: Stripe's server-driven integration supports only
  its smart readers, docs.stripe.com/terminal/payments/setup-reader, checked
  16 Oct.)
- [ ] **Email sending service** (Mark).
- [ ] **Staff sign-in (WorkOS)** (Mark).
- [ ] **Google sign-in for customers**: yes from Jack on 7 Oct
  (`docs/decisions/2026-10-07-stage-1-drawing-gaps.md`). **Needed on
  switch-over day, owned by a Google account for Wheelhouse itself**, not
  one shop's (Jack, 16 Oct), since it serves every shop's customers. Jack
  makes the account if Wheelhouse has none; Mark sets up the Google Cloud
  project in it; it uses the privacy page from the legal drafts.
- [ ] **WhatsApp Business, needed on switch-over day** (Jack, 16 Oct): the
  account (Mark sets it up; Jack says yes to it and its per-message charge
  when it is opened), and Meta's approval of each message template. The
  templates use the wording Jack reads in Q9's read-through, so that comes
  first, early enough for Meta's approval to finish before switch-over.
- [x] **Texts (Twilio)**: already a real account (build plan §5).
- **Accounts software: not needed for switch-over** unless the first shop
  uses some (Jack, 16 Oct, said of his shop, which uses none). The Xero and
  QuickBooks connections wait until a shop needs one.
- [ ] **If the first shop is moving from Citrus Lime: Citrus Lime's full
  export** of its customers and workshop history, asked for by that shop
  (#171, closed 18 Oct when it stopped being Jack's shop's to-do).

**Not needed for switch-over** (moved later): Lightspeed (Q5, after the
trading week); SumUp and Paymentsense (after Stripe; #138, closed 18 Oct); Apple sign-in
(once the business has income, `docs/decisions/2026-09-29-signing-in-review.md`).

## 2. Wording checks

- [ ] **Every automatic message read by Jack in one go** (Q9): booking,
  quote, bike ready, reminders, receipts, all marked as draft wording until
  then. Includes the first repair texts (Request received, Booking
  confirmed, Quote to approve). Jack.
- [ ] **Booking terms and privacy notice** behind the booking form's "By
  sending, you agree to our booking terms and privacy notice."
  (`docs/decisions/2026-10-01-book-a-repair-review.md`), with the cookie
  policy, the returns page and the data agreement for shops: Claude drafts
  them from Jack's decisions, marked as drafts; Jack reads them; the
  solicitor checks them (Jack, 16 Oct).
- No automatic messages go to customers until switch-over day
  (`docs/decisions/2026-10-02-ux-walkthrough.md`).

## 3. Professional checks

Q12: "these are done before switch-over".

- [ ] **Solicitor**: privacy, cookie, returns and reminder wording; the
  starting Privacy and Collection and returns pages; the legal set (privacy
  notices, data agreement for shops, cookie policy, terms; WEB-2, Jack's).
  Jack finds a solicitor for small-business privacy work **by the start of
  stage 7** (Jack, 16 Oct), once the drafts exist.
- [ ] **Accountant**: the VAT report layout, including where its "Stock
  purchases" box comes from where the shop has no accounts software (the
  build plan points it at accounts software until the supplier invoice
  check is built) (`docs/decisions/2026-10-01-reports-and-accounts-review.md`).
  The accounts mapping waits until a shop uses accounts software. The VAT
  invoice stays generic for now (`docs/decisions/2026-10-02-leftover-screens-review.md`).
  **The first shop's own accountant** (Jack, 16 Oct, said of his shop's).
- [ ] **The accountant's reports**: Wheelhouse's reports give the first
  shop's accountant what they now take from the shop's old system, and the
  accountant checks Wheelhouse's versions before switch-over. (Asking Jack's
  shop's accountant which Citrus Lime reports they use was dropped, 18 Oct.)
- [ ] **What staff must be told about what is recorded about them**
  (build plan, "still to check before release"): part of the solicitor's
  check (Jack, 16 Oct). If staff need a notice, Claude drafts it like the
  other legal pages.

## 4. Records

- [ ] **How long records are kept** (LEG-05,
  `docs/decisions/2026-10-02-management-oversight-review.md`; Jack, 16 Oct):
  sales and VAT records are kept 6 years, the same for every shop (HMRC's
  rule for a limited company, and for VAT records of any VAT-registered
  business). Each shop chooses, in Settings, when a
  customer who hasn't been in for a while is removed; the solicitor
  confirms the default during their check. Built before switch-over.
- [ ] Deleting a customer keeps their sales for tax without the name
  (`docs/decisions/2026-09-30-customer-service-review.md`).
- [ ] A privacy request is answered within one month (same file).
- [ ] Website history is kept 90 days (Q8).
- [ ] **Real export files** (Q4; Jack, 16 Oct, said of his shop's files):
  kept in a private folder on Jack's Mac, outside the Wheelhouse folder,
  with FileVault on; never in the repository or uploaded anywhere. Mark gets
  a single file when he needs one. Deleted once the two matching weeks have
  passed and Jack says so. Where another shop's files are kept is still for
  Jack to decide.

## 5. Backups and a practice restore

- [ ] **Jack restores the database, with Mark watching**, before any real
  shop uses Wheelhouse, from a dated runbook; again whenever the host
  changes (`openspec/changes/add-hosted-copy/specs/hosted-copy/spec.md`,
  tasks 5.1 to 5.3; PL-3).
- [ ] **How far back a backup can go** ("any moment in the last [n] days")
  (Mark).
- [ ] **Photos and attachments kept somewhere that survives an update**
  (`openspec/changes/add-hosted-copy/design.md`) (Mark).

## 6. Data checks for a move from Citrus Lime

`docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` unless noted.

- [ ] **Two matching weeks in a row**: sales total, number of sales, stock
  value and number of customers all match Citrus Lime (decisions 5 and 8).
  The customer count can't match until the full export is in.
- [ ] **Brought across at switch-over**: account balances and credit limits,
  gift vouchers, open orders and deposits, open workshop jobs, open purchase
  orders (build plan, stage 7).
- [ ] **Workshop job history**: from Citrus Lime's full export, or copied
  from the screens only if Jack decides to (build plan, stage 7).
- [ ] **One last refresh on the switch-over morning** (decision 7).

## 7. On the day, and the week after

- [ ] The switch-over checklist in the app ticks itself: matching weeks, the
  card machine connected, "The website is ready" (decision 7; the website
  is turned on that morning, `docs/decisions/2026-10-02-ux-walkthrough.md`).
- [ ] **Equipment**: the Stripe Reader S700 and a phone that can share its
  connection; receipt and label printers through
  the browser and the existing print agent (the printer half of P00b is
  still open, `docs/decisions/2026-09-23-p00b-scanner-evidence.md`);
  scanners set to a UK keyboard layout.
- [ ] **The shop's staff ready** (Jack, 16 Oct): before switch-over, they practise on
  the online test copy (North Street Cycles, test data only) from a short
  list Claude writes: a sale, a refund, booking a bike in, taking a deposit,
  handing a bike over. Claude also writes a one-page guide kept at the till
  for the first week (Jack, 16 Oct). Replaces practice mode, which was
  dropped.
- [ ] **One full trading week, weekend included, on Wheelhouse alone.** No
  longer Release 2's finish line: since 18 Oct Release 2 is done when it is
  built and checked, ready to sell (`docs/decisions/2026-10-18-build-for-every-shop.md`
  answer 4).

## Not part of switch-over

Since the trading week moved after Release 2 (18 Oct), whether the items
below are still in Release 2 is open for Jack
(`docs/decisions/2026-10-18-build-for-every-shop.md`, open questions).

After the trading week: Lightspeed, the three supplier browsing screens,
and stock suggestions. Later in Release 2:
the supplier invoice check, oversight extras, the full website editor, the
shop's own web address. Dropped: practice mode. (Build plan, "After the
trading week".)

## The size of the build

The build plan's "about 240 pull requests" was estimated before the work was
split between two people. Treat it as a guess until stage 1 shows the real
pace (#140).
