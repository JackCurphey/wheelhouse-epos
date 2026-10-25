# Replan proposal: build in playable slices (25 Oct 2026)

**Status: a proposal from Mark's session, for Jack to accept, change or drop.**
Nothing here changes the build plan or the split plan until Jack accepts it (Mark answered the four questions in §4 on 25 Oct); if
he accepts, §9 of the split plan and the build board's "next" lists get
updated in the day's status pull request. It reorders work only: no package is
dropped, and no decision is reopened.

Mark's ask: "complete workable chunks we can play with online and see working".

## 1. Audit: the build board against what is merged

Checked on 25 Oct against the board (`docs/build-progress/build-board.html`,
"Updated 25 October"), `origin/main`, and the open pull requests. The package
statuses are the board's own; the second column says where I think it is out
of date.

| Board says | Reality on 25 Oct, 11:20 |
|---|---|
| WP-4.5: service reminders "begun"; sending and Stop these "not yet" | Sending (#488), Stop these (#489), the tick on the in-shop ready page (#491) and merging customers keeping a yes (#493) are merged. The customer's account page is still waiting for emailed-code sign-in (WP-1.7) |
| Not on the board | Review requests: the message and its Settings box (#494, #495) are merged. They belong to WP-4.5 or WP-4.3 (Jack to say which) |
| WP-3.2 Customers: list, page, Merge | A bike's own page (#497) is merged; "Find a bike in the header search" (#498) is open |
| WP-1.6: step B is "Mark's next" | Step B is built and in review, #492 (the `all_sales` view, the dashboard, the sales list and a customer's sales read both records). Not yet done inside it: the real baseline and the second check on the hosted copy (tasks 3.1 and 3.4) |
| "Still open from the audit: items 12, 20, 23, 24" | 12, 20 and 24 are fixed in #496 (open). 23 (a declined date change sends nothing) waits on Jack: where the second wording is stored and edited in Settings |
| Overnight runner not mentioned | #490 (open) keeps the runner, brief and queue in the repo |
| Stage 0: "nearly done", the WP-0.5 drills and the walkthrough are Jack's today | Done (Mark, 25 Oct); `STATUS.md` and the board still list both as waiting |
| `lead`/`sub` text names #447 to #485 | Seventeen or so merges since; the day's status pull request catches it up |

The package list itself (stages 0 to 8, 38 packages on the board) still matches the build
plan. I did not re-read each package against its code; the "part" ones are
the board's judgement, not mine.

## 2. What the board shows about the shape of the work

- **Done and playable:** the repair's whole life, built ahead of the plan by
  Jack: book online (change, cancel, offers, deposits, Didn't come), staff
  answer, diary, job page, quotes, Bike ready, collect, pay at the till,
  receipts, texts and emails (pretend sending), reminders, review requests,
  customers with Merge, bike pages. The till takes a sale.
- **Not built, and nothing playable yet:** who is signed in (roles, PINs),
  products and stock, cash-up, reports, the website, Cycle to Work, the
  Citrus Lime import. Stage 1's foundations (1.1 server half, 1.2, 1.4, 1.5,
  1.7, 1.9) are mostly the "todo" rows, and are the ones that produce the
  least that anyone can click on.
- So the plan's stage order (foundations, then stock, then till, then the
  rest) would leave a long stretch with nothing new to play with. The screens
  Jack built ahead already sit on a single Owner login.

## 3. Proposed slices

Each slice ends with something Jack can do on the hosted test copy, a short
written "play it" list (like `docs/runbooks/stage-0-check.md`), and a
stage-check walk before the next slice's work is called ready. Inside a slice
the existing lanes hold: Mark takes the server half and hosting, Jack the
screens and the workshop. Package ids are the build plan's.

| Slice | You can play | Packages it takes | It needs first | Lanes |
|---|---|---|---|---|
| **A. A repair, start to finish** (nearly there) | Book online, answer it, take the bike in, quote, work, ready, collect, pay with a deposit taken off, receipt, the reminder and review text | Sales-in-pence step B (#492) and step C; the deposit at the till (`till-job-deposit`); paying a repair online (on the current sales record, redone at step C); audit item 23 | Nothing blocking: item 23 and paying online are decided (§4) | Mark: B, C, deposit at the till. Jack: item 23's screens, paying online |
| **B. A shop day with real people** | Staff sign in with a PIN, see only their own rooms, the shop opens with a float check, sells, the day closes with a count and a report | WP-1.1 server half, 1.2 (settings store, change record, activity log), 1.7 (sign-in and PINs, against the fake WorkOS), 3.3 (opening), 3.4 (cash-up), 1.10 (Tills and Who's in on Today), the till's discounts and refunds (3.1) | Slice A's step C: the new till on sync | Mark: 1.1, 1.2, 1.7 server. Jack: sign-in and PIN screens, then 3.3 and 3.4 |
| **C. Stock you can trust** | Add a product with sizes and colours, receive a delivery, sell it and watch stock drop, count the shelf | WP-1.5, 2.1, 2.3, 2.2, then 2.4 (import, first half) | Nothing from B, so C can start in parallel once A's server work is out of Mark's lane | Mark: 1.5 server, then 2.1 to 2.3 server. Jack: stock screens |
| **D. The owner's view** | Reports and takings by day, the activity log, staff and roles setup, payments set up | WP-5.1 (what's left), 5.3, 5.4, 1.11's spreadsheet download | B for who did what; C for stock figures | Mark: reporting layer. Jack: the screens |
| **E. Sell online** | The public website, buy online, click and collect; Cycle to Work | WP-6.1 to 6.3, 7.1 | C for products; B for sign-in; Stripe account (Jack's yes, costs money) | Mark and Jack as in the build plan |
| **F. The move** | The shop's data in; run alongside; switch over | WP-8.1 to 8.3 | Everything above; Jack's real export files | As in the build plan; real data stays with Jack |

What moves, against the build plan's stage order:

- **1.7, 1.1 server half, 1.2 and 3.3/3.4 become one slice (B)** instead of
  being spread over stages 1 and 3, because "who is signed in" is only worth
  doing once there is a shop day to use it in.
- **1.4 (shops and sites everywhere), 1.9 (live updates) and 5.2 (multiple
  sites screens)** are not in A to D. They go where the first slice needs
  them: live updates is the likely one (two devices on one diary), so it
  joins B if the stage check shows it is missed; multiple sites waits for a
  second shop to exist. Jack to confirm; this is my judgement of the plan,
  not a recorded decision.
- **2.4 (import, first half)** moves to the end of C, since it needs products
  first and nothing in A or B needs it.

## 4. Answers (Mark, 25 Oct; Jack still to accept the plan as a whole)

1. **Order:** B before C. The shop day (sign-in, PINs, opening, cash-up)
   comes before stock. The order is A, B, C, D, E, F.
2. **Item 23:** the declined date change's wording goes in the existing "Date
   change answered" row in Settings as a second box, as drawn
   (`generator/book.mjs:489`, "If the shop can't"), not as its own row. It is
   unblocked; the row's subtitle and the second message trigger are the work.
3. **Paying a repair online does not wait for step C.** It is built on the
   current sales record and redone when step C lands (Mark's call; it
   overlaps his sales-in-pence decisions 4 and 8, which is why it is logged
   here).
4. **Stage 0:** the four drills and the walkthrough have happened, so stage 0
   is closed apart from anything the walkthrough found.

What changes in the slices because of these answers: slice A no longer waits
on the paying-online decision and no longer lists closing stage 0; its open
items are step B's two baseline checks, step C, the deposit at the till,
paying a repair online, and item 23. Slice B is next after A's server work.

## 5. What this plan does not claim

- No sizes or dates. I haven't counted pull requests per slice; the build plan
  gives roughly one pull request per line, so slice B is the largest.
- I did not check each package's dependencies beyond the build plan's own
  text and the board's "part" notes. Anything in the "It needs first" column
  is a prerequisite I read, not one I tested.
- The board's own numbers (the project percentage) are unchanged. Once Jack
  picks an order, the board's `next` lists follow it.
