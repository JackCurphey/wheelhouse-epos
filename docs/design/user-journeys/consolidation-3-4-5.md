# Consolidation — journeys 3, 4, 5

Read-only analysis for issue #116 step 1, 3 Oct 2026. Journeys 3 (Book a repair), 4 (Drop off and approve the quote) and 5 (Collect the bike and pay) have **110 screens** in `journeys.mjs`: 41 in journey 3 (lines 252–308), 31 in journey 4 (310–353) and 38 in journey 5 (355–410), checked by count. Their titles are in those lines. The customer sees every screen unless it is listed under Staff or Manager below.

## Counts by class

| Class | J3 | J4 | J5 | Total |
|---|---|---|---|---|
| Real screen | 7 | 2 | 4 | **13** |
| Situation of another screen | 28 | 24 | 27 | **79** |
| Edge case | 3 | 2 | 3 | **8** |
| Settings | 3 | 1 | 3 | **7** |
| Old Release 1 picture, now replaced | 0 | 2 | 1 | **3** |
| Deferred by the 3 Oct answers | 0 | 0 | 0 | **0** |

- **Real screens:** the four booking steps (`bk-service`, `bk-bike`, `bk-when`, `bk-details`), `bk-request`, `bk-bookings`, `bk-page`, `dq-quote`, `cp-pay`, `cp-receipt-email` and `cp-receipt-text`. Two are staff screens: `dq-record-answer` and `cp-receipt-address`.
- **Edge cases:** `bk-checking-payment`, `bk-expired`, `bk-unavailable`, `dq-quote-newer`, `dq-withdrawn`, `cp-summary-counter`, `cp-expired` and `cp-receipt-address-offline`.
- **Settings (Manager):** `bk-messages`, `bk-settings`, `bk-settings-deposits`, `dq-messages`, `cp-setting`, `cp-messages` and `cp-message-wording`.
- **Old pictures:** `customer-message`, `preferences` and `ready`.
- **Staff screens:** `bk-staff-*`, `dq-job-*`, `dq-diary-waiting`, `dq-record-answer`, `cp-ready-*`, `cp-till`, `cp-collected` and `cp-receipt-address*`. The Manager also sees `dq-today-no-answer` and `cp-today-uncollected`.
- **After the trading week, by build-plan question 5** (not the issue #116 questions): the seven Lightspeed screens (`bk-page-ls`, `bk-cancel-ls`, `dq-quote-ls`, `dq-quote-price-ls`, `dq-answered-price-no-ls`, `cp-summary-ls`, `cp-summary-ls-paid`) (`2026-10-03-build-plan-questions.md:58-61, 115-117`). They are counted as situations above. None of the six issue #116 answers touches these journeys.
- **Exact copies of a drawing that already exists:**
  - `dq-ready` is `cp-summary` (`quote.mjs:166`).
  - `dq-job-waiting` is journey 12's `job-waiting-parts` (`quote.mjs:197`).
  - `cp-ready-paid` is journey 12's `job-collection` (`collect.mjs:161`).
  - `cp-till` is journey 11's `till-job` (`collect.mjs:160`).
  - `dq-messages` and `cp-messages` are the same code as journey 8's `set-msg-list` (`setup.mjs:409`).
  - `bk-messages` is that same page, scrolled (`book.mjs:385`).

## Walking the main tasks

| Person | Task | Clicks | Pages they pass through | Drawn as |
|---|---|---|---|---|
| Maya | Book, no deposit | 5–6 taps, about 6 fields (walk-through 1, lines 18–22) | 2 (one booking page, then "Request received") | 5 drawings |
| Maya | Approve the quote | 2 taps (wt1:26) | 1 (the job page changes in place) | 2 |
| Maya | Pay online | 3 taps plus the card form (wt1:28) | 3 (`cp-summary`, `cp-pay`, `cp-paid`) | 3 |
| Maya | Change the date | about 4 taps *(inferred from `book.mjs:258-262`)* | 1 | 1 |
| Maya | Cancel | 2 taps *(inferred from `book.mjs:287-296`)* | 2 | 2 |
| Jo | Accept a request | 3–4 clicks (wt1:23) | 2 (diary, pop-up) | drawn in journey 12, and again here with a deposit |
| Jo | Record an answer given by phone | about 3 clicks plus ticks *(inferred)* | 3 (Today, job, pop-up) | 2 |
| Jo | Hand over a paid bike | search plus 2 clicks (wt1:29) | 2 | 2 |
| Jo | Hand over an unpaid bike | 3 clicks (wt1:29) | 3 (job, till, receipt) | 3 |
| Alex | Build and send a quote | 9–10 taps (wt1:25) | 1, plus the Undo bar | 2 |

**The job page from journey 12 is redrawn here 12 times** (all `dq-job-*` and `cp-ready-*`, plus `cp-collected`). Two of these are exact copies of journey 12 drawings. The other ten are states that appear on no journey 12 row. Journey 12's own `job-quote` (`diary.mjs:2437`) and this journey's `dq-job-quote` (`diary.mjs:2470`) are two different drawings of the same moment: building a quote.

## Merge table

| Screens now | Become | Drawings saved | Decision touched |
|---|---|---|---|
| The 11 booking screens and 5 of the 8 "Sending" screens (not `bk-request`, `bk-request-deposit` or `bk-confirmed`) | The booking page: 4 drawings, one per step open, and a situation list | 12 | Book 2, 9 |
| `bk-request`, `bk-request-deposit`, `bk-confirmed` | "Booking sent": 1 drawing, 3 situations | 2 | Book 8 |
| `bk-page*`, `bk-offered`, `bk-change*`, `bk-cancelled*`, `bk-declined`, `dq-in-shop`, `dq-waiting-part`, `dq-quote*`, `dq-answered*`, `dq-withdrawn`, `dq-within-limit`, `cp-summary*`, `dq-ready`, the Lightspeed screens, `bk-expired`, `cp-expired` | **One customer job page**, 4 drawings (before drop-off, changing the date, a quote to answer, ready to collect) with about 35 situations | about 39 | Quote 1 (one page per job); Quote 7 H4 keeps the two-column ready page, so that stays a drawing; wt1 M5 (one rule for when the link expires) |
| `bk-cancel`, `bk-cancel-late`, `bk-cancel-ls` | "Are you sure?" box: 1 drawing | 2 | Book 10 |
| `cp-pay*`, `cp-paid*` | Pay page: 1 drawing, 4 situations | 4 | Collect 2, 5 H1 |
| The 5 receipt emails | 1 drawing, 4 versions | 4 | Leftover screens 1, 6 H1 |
| `cp-receipt-text`, `cp-receipt-text-email` | 1 drawing | 1 | Leftover screens 2 |
| The 7 `cp-receipt-address*` screens | Till receipt box: 1 drawing | 6 | Leftover screens 3 |
| The 12 staff job page drawings | Lines in journey 12's job page situation list | 12 | Workshop day 20 (one job page) |
| `bk-staff-*`, `dq-diary-waiting`, both Today screens, `cp-till` | Lines in journey 12, 10 and 11 situation lists | 6 | none |
| `dq-record-answer` | Stays (a form box) | 0 | Quote 4 |
| `dq-job-withdraw` | A line for the "Are you sure?" box | 1 | Quote 7 |
| The 7 Settings and Messages screens | 1 drawing (Settings › Workshop with Online booking open); the rest become lines on journey 8's Settings and Messages | 6 | Book 11; Receiving 7 (later change) |
| `customer-message`, `preferences`, `ready` | Removed. *Inferred from titles only*: they are replaced by journey 7's `ac-job-note` and `ac-contact`, and by `cp-summary` | 3 | **Removing `ready` goes against Collect 6** (`2026-09-30-collect-and-pay-review.md:83-85` keeps it). Jack's call. |

**Reduced count: 110 drawings down to about 17.** It could be up to about 20 if the deposit card form, the quote's pinned bottom bar on phone, and "Your bookings" are drawn separately.

**Possibly too big for the first release.** Online deposits run through about 14 situations, and pay-online depends on a payment provider nobody has chosen yet (Collect 2, lines 30–31; build plan line 78). This doesn't suggest reopening Book decisions 3 and 4, only the order: build the plain path without a deposit first.

## Building blocks

Seven come from Mark's list: Settings page, Settings row, Today cards, "Are you sure?" box, form box, saving/failed/undo message, and the job page.

Eight are new:
1. The customer website frame, with a bar pinned to the bottom on phone.
2. Step-by-step booking: a step that closes to one line with "Change", and the "Your booking" summary.
3. The day strip and time picker (also used by "Change the date").
4. The customer job page. It is currently coded three separate times: `book.mjs:251`, `quote.mjs:42-50` and `collect.mjs:96-104`.
5. The quote card: lines that tick together in pairs, a photo, a running total, and the "final answer" line.
6. The card payment box. Booking and collection code it separately (`book.mjs:205-211`, `collect.mjs:109`).
7. The outcome card: sent, cancelled, declined, expired, paid, answered.
8. The receipt.

That is **15 blocks for 110 drawings**.

## Persona findings

**High**

1. **A customer can pay twice at collection.** If the connection drops after paying a deposit while booking, they see "please don't pay again" (`bk-checking-payment`, `book.mjs:210`). The collection pay page has no equivalent screen: a search of `collect.mjs` for "checking" and "pay again" found nothing. Collect 5 H3 only covers paying online and at the counter at the same time. This is a broken promise about money, so it is High. Fix: add a "checking your payment" line to the pay page's situation list.

**Medium**

2. **The one customer job page is coded three times**, although Quote decision 1 says it is one page. If it is built three times, the customer's single link could look and behave differently at each stage. Fix: build it once, as block 4 above.
3. **Jo has no drawn place to refund a deposit by hand.** Book 4 says "staff can still refund by hand" (`2026-10-01-book-a-repair-review.md:53-54`), for example when a customer doesn't turn up. A search of the generator for "no-show", "never came" and "didn't arrive" found nothing. That is a search result, not proof it is missing.
4. **Alex can't add a photo from the shared desktop in the drawings.** The fix is decided ("Use my phone", `2026-10-03-ux-walkthrough-8.md:43-45`) but not drawn: the generator has no "Use my phone". Fix: make it a situation line on the job page, not a new drawing.
5. **Two edge cases from walk-through 1 are still only listed:** a bike marked ready while its quote is still open, and a "Not sure" booking that reaches a quote (wt1 L9, `2026-10-02-ux-walkthrough.md:71`). They should become situation lines on the job page.

**Low**

6. **Paying online takes the customer through 3 pages.** Pick one:
   1. Open the card box in place on the ready page, the way the deposit opens inside booking step 4. This saves one page and one tap, but changes a screen design, so it needs Jack's OK.
   2. Keep it as drawn.
7. **`bk-bookings` overlaps journey 7's account list of repairs** *(inferred)*.
8. **Staff and the customer see different deposits.** The staff collection boards still show the £27.75 deposit taken at the till, while the customer's pages show £[deposit]. This was left on purpose (`2026-10-02-ux-walkthrough.md`, "Left as it was"), but a Saturday worker could read the two as a mismatch.
