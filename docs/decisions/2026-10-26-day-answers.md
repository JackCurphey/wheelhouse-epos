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

## 5. The label printer helper's own key

**In Settings › Till, next to Tills, as "Label printers"** (Jack: "Next to
Till › Tills"). The owner adds a printer there, gets its key, and can remove
it. Not drawn, so it is drawn first for Jack to approve. Helpers already
signed in keep working up to 30 days meanwhile.

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
