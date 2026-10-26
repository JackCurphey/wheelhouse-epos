# Jack's answers, 26 Oct 2026 (the day's list)

Questions waiting on Jack, gone through one at a time on 26 Oct. Each answer
names what it unblocks.

## 1. The replan into playable slices (#499)

**Accepted as is** (Jack: "Accept it as is"). The rest of Release 2 is built
in six slices, each ending in something to play on the test copy:

A. a repair, start to finish;
B. a shop day with real people;
C. stock you can trust;
D. the owner's view;
E. selling online;
F. the move.

The order is A, B, C, D, E, F, as in Mark's answers in the plan
(`docs/superpowers/plans/2026-10-25-playable-slices-replan.md`, in #499).

Mark's judgement in the plan stands:
- live updates (WP-1.9) joins slice B if the stage check misses it;
- shops and sites everywhere (WP-1.4) and the multiple-sites screens
  (WP-5.2) wait until a second shop exists.

What it unblocks: paying a repair online (slice A) is built on the current
sales record now and redone after Mark's step C (Mark's answer 3 in the
plan). Its smaller questions (who counts as the cashier on an online
payment, and refunds) come later in this list.

## 2. "Ask the shop a question", and staying signed in

1. **The question's page needs the customer to sign in.** The link in the
   shop's reply opens sign-in first if they aren't signed in (Jack, asking
   "a customer logs in once and then it can remember them").
2. **A customer stays signed in for 30 days from their last visit**, on
   each phone or computer (Jack: "30 days from last visit"). Every visit
   renews it, so a regular customer never signs in again on that device.
   Today it is 30 days from signing in, whatever they do.
3. **One running conversation per customer**, not a page per question
   (Jack: "One per customer"). This changes the drawings (`ac-ask`,
   `ac-question`, `ac-account-asked`, the inbox's "Question from her
   account" rows), so they are redrawn for Jack to approve before building.
   The conversation never closes. It leaves the shop's "Needs a reply" list
   once answered, as the inbox already does, so the earlier question "should
   a question ever close?" falls away.
4. **The reply message** reads "[Shop] replied to your message: [link]"
   (the shop can reword it in Settings › Messages). The account says "we'll
   let you know when they reply" rather than the drawn "we'll text you",
   since customers may choose email (Jack: "Yes to both").
5. **Notes on a repair also show in the customer's conversation** on their
   account, each marked with its repair ("About WH-1042") and opening that
   repair (Jack: "Yes, marked with the repair"; decision 3 of the account
   review).

## 3. Company customers

**No accountant check; build now** (Jack: "No check, build now"). His 2 Oct
answer stands (`2026-10-02-leftover-screens-review.md`: "a generic vat
invoice for now"). The later note that the VAT invoice "waits on the
accountant" (`decided-while-building.md`) is overruled.

What it unblocks, as drawn (`cs-add-company`; collect.mjs's VAT invoice):
- Add a customer gets "This is: A person / A company or club", with company
  name, contact name, an optional VAT number and "Send invoices to";
- a company's emailed receipt is headed "VAT invoice", with an "Invoice to"
  block.

## 4. Spreadsheet downloads

**With Reports, as drawn** (Jack: "With Reports, as drawn"). Each report
(Sales, Takings, VAT, Workshop and the rest) gets its "Download as
spreadsheet" button when Reports is built in slice D (`reports.mjs:68`,
`2026-10-01-reports-and-accounts-review.md`). "Download everything" stays as
decided on 25 Oct (`2026-10-25-morning-questions.md` answer 10): one zip of
all four spreadsheets once stock exists.

This replaces a first answer that day ("a Download button on each list
now"). That came from a wrongly framed question: the drawings put Download
on the reports, not the lists, and only the Customers list is built. The
question was also asked again by mistake, since STATUS still listed it as
open after the 25 Oct answer.

## 5. The label printer helper: dropped, browser printing only

**Drop the print agent; print everything through the browser** (Jack: "Drop
it, browser only"). This follows Jack's 1 Sep answer to Mark
(`2026-09-01-ownership-signoff.md` PF-3: "you can get rid of the print agent
if you want and just make it all browser based"). It also matches how
receipts (`2026-10-18-print-receipt.md`) and bike tags
(`2026-10-21-bike-tag.md`) already print.

The earlier question, where the owner makes the helper's own key, falls
away. A "Label printers" page was drawn for it that morning before Jack
pointed out the 1 Sep answer; it was scrapped, not kept. The helper's code
and its server routes (`print-agent/`, `server/routes/print-agents.js`) are
removed in their own pull request; Jack approved the deletion with this
answer.

## 6. Discounts at the till

**Wait for Mark's step C** (Jack: "Wait for step C"). They come in slice B,
on the new till, so the money part is built once. Customer group discounts
already work at the till meanwhile.

## 7. The till's quick buttons in Settings

**Wait for slice B** (Jack: "Wait for slice B"). They are built with the new
till after Mark's step C, so the till screen changes once. Today's automatic
Workshop buttons stay as they are until then.

## 8. The conversation, drawn and approved

1. **The redrawn account screens are approved** (Jack: "Approve").
   `account.mjs` now draws:
   - `ac-ask`: "Ask the shop a question" opens "Messages with North Street
     Cycles", one thread, with repair notes marked "About WH-1042" (opening
     that repair) and "We'll let you know when North Street Cycles replies";
   - `ac-account-question-sent` and `ac-question`;
   - `ac-account-asked`: one "Messages" row in the history.
2. **The staff Messages inbox shows one conversation per customer too**
   (Jack: "Yes, one per customer"). A customer's repair notes and general
   messages are together, each repair note marked with its repair, instead
   of a row per repair's notes and a row per question. The inbox drawings
   (`ac-inbox*`) are updated to match as part of the build.

## 9. Paying a repair online: the three open points

Most of it is settled already: where it is paid (`2026-09-30-collect-and-pay-review.md`),
the drawings (`cp-pay`, `cp-pay-failed`, `cp-pay-balance`, `cp-paid`), and
Mark's rules for the balance (his till-deposit design, decision 12: charge
what's left to pay, take the order's lock first, count deposits held at the
till). Jack answered the rest:

1. **The cashier on an online payment is nobody: the sale shows "Paid
   online"** (Jack: "Nobody"). It needs a server change so a sale can have no
   cashier, since Mark ruled out a pretend online till (sales-in-pence
   decision 4).
2. **While the till has the bike's order open, the customer's page hides Pay**
   and says it's being paid at the counter, as drawn (audit H3). A short
   "till has it open" marker, which clears itself after a few minutes
   (Jack: "Hide Pay while the till has it").
3. **Refunds of an online repair payment wait for the till's refunds**
   (slice B), built once for both. Until then a refund is made in the
   payment provider's own dashboard (Jack: "Wait for till refunds").
4. **Built after Mark's till-deposit piece is merged** (Jack: "After Mark's
   till deposit"), so it uses his "what's left to pay" and deposit rules
   directly, in slice A, rather than being built now and redone.
