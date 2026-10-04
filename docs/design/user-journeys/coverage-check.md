# The coverage check (WP-W.5)

4 Oct 2026. The build plan's stage W asks for "a table of every journey
against every persona who uses it, saying which walk-through covered it. Any
empty cell gets walked before stage W closes."

Each row is a journey; each column is a persona from `personas.md`. A cell
holds the walk-through (story) numbers that passed through that journey as
that person. "—" means that person doesn't use the journey. **EMPTY** means
they do, and no walk-through has covered it yet.

The table is worked out by a script, not by hand:
`generator/coverage.mjs` (run from the repo root with `node docs/design/user-journeys/generator/coverage.mjs`, or `--json` for the detail). It
reads `generator/journeys.mjs`, `generator/consolidate/j*.mjs`,
`generator/mockup/stories.mjs` and the build plan. It was checked by taking
story 9 out: journey 15 for Jo went to EMPTY, as it should, and came back
when story 9 was put back.

**Walk-through numbers are story numbers.** Stories 1–8 were walked three
times: the first walks (`docs/decisions/2026-10-02-ux-walkthrough.md`,
`2026-10-03-ux-walkthrough-8.md`), the second walk (`walk-2/`) and the third
walk on the clickable mockup (`walk-3/`). Stories 9–12 were walked twice
(`walk-2/`, `walk-3/`). The steps in `stories.mjs` follow the second and third
walks.

## The table

| Journey | Maya (customer) | Jo (front desk) | Alex (mechanic) | Jack Lewis (owner) | Saturday worker |
|---|---|---|---|---|---|
| A App map and navigation | **EMPTY** | 2, 9 | **EMPTY** | **EMPTY** | 8, 10 |
| B Signing in and access | 1, 12 | 2, 4, 8 | 8 | 7 | 8, 10 |
| 1 Find the shop and browse the website | 1, 6, 12 | **EMPTY** | — | — | — |
| 2 Buy online, or click and collect | 2, 12 | 2 | — | **EMPTY** | **EMPTY** |
| 3 Book a repair | 1, 6, 12 | — | — | **EMPTY** | — |
| 4 Drop off and approve the quote | 1, 6, 12 | **EMPTY** | — | — | — |
| 5 Collect the bike and pay | 1, 2, 12 | 2 | — | — | **EMPTY** |
| 6 Cycle to Work | 5, 12 | 5 | — | 5 | — |
| 7 Account, history and reminders | 1, 12 | **EMPTY** | — | **EMPTY** | — |
| 8 Owner setup and onboarding | — | — | — | 4, 7, 11 | — |
| 9 Moving from Citrus Lime | — | — | — | 4 | — |
| 10 Opening the shop and checking in | — | 1, 2, 4 | — | 5, 7, 11 | 10 |
| 11 Selling at the till | — | 2, 3, 4, 5 | — | 2, 10 | 8, 10 |
| 12 Workshop day | — | 1, 6, 7, 8, 9 | 1, 3, 6, 8 | — | — |
| 13 Receiving stock and purchase orders | — | 3 | — | 3 | — |
| 14 Stock take and stock control | — | 3, 9 | — | 3, 7 | — |
| 15 Customer service | — | 9 | — | **EMPTY** | — |
| 16 End-of-day cash-up | — | 4 | — | 2, 10 | — |
| 17 Reports and accounts | — | 11 | — | 3, 5, 7, 11 | — |
| 18 Website management | — | — | — | 4 | — |
| 19 Multiple sites | — | — | — | 7, 11 | — |
| 20 Management oversight | — | — | — | 7, 11 | — |
| 21 Lightspeed shops | — | out of first build | — | out of first build | — |

**12 empty cells.**

### Out of Release 2's first build

- **Journey 21, Lightspeed shops:** after the trading week (Jack, build-plan
  question 5: no Lightspeed test account yet, and his shop doesn't need it to
  switch over). Story 6 walked it, but it doesn't need covering now. Its
  Lightspeed situation lines on other journeys' boards (for example
  `dq-quote-ls`, `cp-summary-ls`) don't count towards those journeys either.
- **Screens marked "later" or "dropped"** in the `consolidate/j*.mjs` files
  aren't counted: the supplier screens (journey 13), the supplier invoice
  check, the oversight extras (journey 20 keeps only the activity log), the
  website editor, theme, extra pages and own web address (journey 18), and
  practice mode (dropped). The build plan's "Later, not in Release 2's first
  build" lists each one with Jack's reason.

## How "uses" and "covered" were decided

**Covered** (the strict rule, the only one counted): a story step in
`stories.mjs`, as that person, on one of the journey's kept screens. A step
whose screen id is a situation line counts for the kept board it's drawn on
(through `into` and `same`). So the step `eod-entry` ("Close the day" in the
till bar) counts for journey 11's `till-sale` board, not journey 16. Story 4's
first float count (`op-float-count`) is drawn on the cash-up count board,
which is why it puts Jo in journey 16. The step's `who` picks the column:
Customer is Maya, Staff is Jo, Mechanic is Alex, Owner is Jack Lewis, and
"Saturday worker" is the Saturday worker.

**Not counted (weaker evidence):** the "People to walk it as" column in
`ux-walkthrough-script.md`, which names more people than the steps show (for
example, Jack Lewis on story 1). A step on another journey's board whose id
comes from this journey also doesn't count. The script lists those. The only
one is Jo on journey 5 through story 1's hand-over steps, and that cell is
already covered by story 2.

**Uses** comes from each kept screen's role in `journeys.mjs`:

- Maya: Customer screens.
- Jo: Staff screens, and Everyone screens.
- Alex: Mechanic and Everyone screens, plus the Staff screens of journey 12
  and the staff app frame (a mechanic sees only the Workshop room,
  `staff-app-mechanic`), plus `till-checkin` (the workshop computer's PIN,
  walk-through 8).
- Jack Lewis: Owner, Manager, and Owner-and-Manager screens, plus Everyone
  screens and the staff app frame. There's no manager persona. The owner
  stands in for the manager role.
- Saturday worker: "till only" (walk-through 8 decision 8, widened by the
  walk-through 10 M1 later change). That means Everyone screens, the till's
  Staff screens (`till-*` and `pin-change`), Front desk › Online orders (the
  journey 2 Staff screens), and `cp-receipt-address`, which opens from the
  till's receipt. Cash-up isn't included, because "Close the day" is for
  owners and managers (cash-up decision 5).
- "Everyone" means every member of staff, because Your settings opens from a
  staff person's name. The `map` board ("How Wheelhouse fits together") is a
  drawing of the app, not a screen anyone opens, so it isn't counted.
- A story step also counts as "uses". That adds journeys the role rule alone
  missed: Jo on 10, 13, 14 and 17; Jack Lewis on 11, 14 and 16; the Saturday
  worker on 10.
- Not counted: `pending` on journey B. It has no role, and its title says it
  was "replaced by bk-page".

**Access personas** (screen reader, keyboard only, low vision) aren't columns.
`personas.md` asks for every story to be walked as them too, so their
coverage follows the stories rather than the journeys.

## Empty cells

Each suggestion below reuses an existing story, its people, and the example
data the drawings already use. Nothing new is invented.

1. **A App map and navigation × Maya.** Kept screens: `site` (the customer
   website frame, with its phone menu `site-menu`) and `site-ocean` (a shop's
   own theme, with `site-ocean-menu`). Story 12 walks journey 1's `wb-home`,
   not the frame boards. *Suggested:* in story 12, Maya (not confident with
   phones) opens the phone menu and picks "Book a repair". Then she does it
   again on a shop's own theme, where "Book a repair" is the big button above
   the list.
2. **A App map and navigation × Alex.** Kept screens: `staff-app` (as
   `staff-app-mechanic`, only the Workshop room) and `your-settings`.
   *Suggested:* in story 8, after Alex types his PIN on the workshop computer,
   he opens his name and checks Your settings. The drawing says they belong to
   the person who typed the PIN, switch with them, and have no Change PIN
   (walk-through 8, fix M3 and decision 3). Then walk it again on a tablet.
3. **A App map and navigation × Jack Lewis.** Kept screens: `staff-app` and
   `your-settings`. *Suggested:* start story 11 in the staff app. Jack opens
   Your settings › Accessibility and turns on "Show graphs in reports"
   (`rp-your-settings`), then goes to Reports.
4. **1 Find the shop × Jo.** Kept screen: `wb-off-preview` (what the shop's
   own staff see while the website is switched off), with the
   `wb-off-preview-ask` banner: "Ask Jack Lewis to turn it on." *Suggested:*
   in story 4, before Jack publishes the website, Jo opens the shop's website
   and sees the switched-off banner.
5. **2 Buy online × Jack Lewis.** Kept screens: `on-settings` (Settings ›
   Online orders) and `on-settings-start` (turning on buying online before the
   website is set up, asked once). *Suggested:* in story 4, during the website
   set-up steps, Jack turns on buying online and answers the
   "start with everything, or nothing" question.
6. **2 Buy online × Saturday worker.** Kept screens: `on-orders`,
   `on-order-staff`, `on-cant-supply`. Walk-through 10 M1 opened this page to
   till-only workers, but story 10's steps don't visit it. *Suggested:* in
   story 10, the Saturday worker opens Online orders from the till and marks
   Maya's order ready, as Jo does in story 2 (`on-orders` → `on-orders-ready`).
7. **3 Book a repair × Jack Lewis.** Kept screen: `bk-settings` (Settings ›
   Workshop › Online booking, with its drop-off window line and
   `bk-settings-deposits`). *Suggested:* in story 4, after
   `set-workshop-services`, Jack sets up online booking: "A day to drop off",
   the drop-off window, and deposits.
8. **4 Drop off and approve the quote × Jo.** Kept screen:
   `dq-record-answer` (record their answer, from a phone call). *Suggested:*
   in story 9, Maya rings about WH-1042's quote and Jo records her answer
   while on the phone. This is the phone version of story 1's
   `dq-quote` step.
9. **5 Collect the bike and pay × Saturday worker.** Kept screen:
   `cp-receipt-address` (no customer on the sale, this receipt only). Story 10
   picks "No receipt". *Suggested:* in story 10's sale, the Saturday worker
   picks Email instead, as Jo does in story 2 (`till-receipt` →
   `cp-receipt-address`).
10. **7 Account × Jo.** Kept screen: `ac-inbox` (Staff Messages: needs a
    reply). *Suggested:* in story 12, Maya asks the shop a question from her
    account (`ac-ask`). Jo answers it in Messages (`ac-inbox` →
    `ac-inbox-sent`), and Maya reads the answer (`ac-question`).
11. **7 Account × Jack Lewis.** Kept screen: `ac-review-setting` (review
    requests: the review page, when, and the wording, with `ac-review-first`).
    *Suggested:* in story 4's settings steps, Jack sets up review requests.
12. **15 Customer service × Jack Lewis.** Kept screen: `cs-privacy` (privacy
    requests, answered within a month). *Suggested:* in story 12, Maya asks
    for her account to be deleted (`ac-delete` → `ac-delete-sent`). Jack sees
    the request in Privacy requests (`ac-privacy-requests`) and deletes her
    details, or gets "Settle up first" if WH-1042 is still open
    (`cs-privacy-delete`, `cs-privacy-blocked`).
