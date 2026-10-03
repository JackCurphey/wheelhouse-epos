# UX walk-through 2, walked again — a shop day, on the one canvas

Walked 3 Oct 2026 for issue #116 step 4, with `ux-walkthrough-script.md` and its three step-4 changes: the eighth question, a count of screens, and joins followed through the links in the boards. The canvas is the local build at `generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j. I read it as HTML text, not as pictures. The earlier walk is `../ux-walkthrough-2-shop-day.md`, and its decisions are walk-through decisions 5 and 6.

## The story

1. Jo Taylor checks in at Till B1 with their PIN and answers the float check (journeys B and 10). Jack Lewis looks at Today.
2. Jo sells all day at the till: brake pads and "Fit & adjust brakes" with a £4.00 discount, paid partly in cash and partly by card, with the receipt emailed to Maya Patel. Then Jo refunds one pad from yesterday's sale (journey 11).
3. An online order from Maya comes in, and Jo marks it ready (journey 2).
4. Maya gets the "ready to collect" email, comes in and gives her name, and Jo hands the order over (journeys 2 and 11).
5. After closing, Jack takes over the till and closes the day (journey 16).

I also walked it as the Saturday worker at the till, and as a screen-reader user, a keyboard-only user and someone with low vision.

## Clicks and screens, per person

A "screen" is a board on the canvas. A box that opens over the till has a board of its own, so it counts as one.

| Person | Clicks on the main path | Different screens |
|---|---|---|
| Jo Taylor (and the Saturday worker) | About 24, plus 4 PIN presses and typed amounts. Adding Maya to the sale is +3. Last time it was about 26. | 16. Only 3 are whole pages (check-in, the till, Online orders); the other 13 are boxes over the till. |
| Maya Patel | 0–1 taps between paying and collecting | 2–3 (`on-confirmed`, `on-email-ready`, and `on-order` if she taps "See your order") |
| Jack Lewis | 7, plus 4 PIN presses and the cash count | 4 (`op-today`, the PIN pad, `eod-count`, `eod-z`). "Close the day" in the till bar has no board; it is a line in a list. |

How Jo's clicks break down:
- Float check: 1.
- The sale: about 11.
- The refund with the receipt: about 5. By name, through "Older sale? Find the customer", it's about 6, down from about 8.
- Getting the order ready: 3 (Unfold, Online orders, Mark ready), then 2 to get back to the till.
- Handing the order over from the till's search: 4 ("Hand over", tick 2 items, "Hand over"), down from about 6.

## High

**H1 — "Today shows [n] refunds to finish", but nothing anywhere shows it.**
1. **Screens:** the till-sale situation lines "Needs the internet — refunds wait, or note one for later" and "Offline refund noted for later" (desktop); `op-today` and its 32 situation lines (desktop); `till-refund` (desktop).
2. **What happens:** When the internet is down, Jo notes a customer's refund for later. The noted box tells Jo "When the till is back online, Today shows '[n] refunds to finish'. Finishing one is a single press" (`till.mjs` line 468). No Today line says this: none of `op-today`'s 32 situations mentions a refund to finish. No board or line draws the "single press" either. I searched the generator and every board for "to finish". The only matches are in `till.mjs`.
3. **Why it matters:** Jo promised the customer their money back. The list that should make sure it happens isn't designed, so the refund can be forgotten. Also, Staff don't see Today's Needs attention ("Today, as Staff see it"), so the person who noted the refund wouldn't see the reminder anyway.
4. **Fix:**
   1. Add two lines. On `op-today`: "Today: [n] refunds to finish · Finish" (Manager). On `till-refund`: "Finishing a noted refund — the sale and items already filled in" (Staff). Also put a count on the till's "Past sales" button, so whoever is on the till sees it too. Good for: the promise reaches both the manager and the person on the till. Cost: two lines and a badge.
   2. Only the Today line, so a manager finishes every noted refund. Cost: Staff never see their own noted refunds.
   3. Only the till badge. Cost: the manager has nothing to check.

   Recommend 1.
5. **Decision it touches:** walk-through decision 5 (M7, option 1). This fills a gap in that decision and doesn't reopen it.

8th question: yes, lines and a badge are enough. Nothing new opens over the page.

**Second check:** CONFIRMED — "refunds to finish" appears only in `till.mjs` (lines 455, 464, 468), on no board in `out/project/`, and none of the 32 lines in note `j10_sit_op-today` mentions it, though decision 5 took the old M7 option 1 that promised "Today shows '[n] refunds to finish'" (`../ux-walkthrough-2-shop-day.md` line 107). High is right: it's a broken promise about money. One correction: Today's Needs attention is hidden from plain Staff only. Anyone with "Can close the day" sees it (Opening decision 4; `opening.mjs` lines 87–88, 213). The till badge in option 1 goes beyond what decision 5 promised, so it is a new design choice, as offered.

## Medium

**M1 — A situation line holds only a name, so some decided details of the last walk's fixes are now only in the generator code.**
1. **Screens:** the lists under `op-float-check`, `op-today`, `eod-count` and `till-sale` (desktop).
2. **What happens:** README rule 2 says each line should have a "What's different" column. On the canvas, each line is just a name, who sees it and a decision number. Three examples:
   - "First in, when yesterday wasn't counted: the float plus Wednesday's cash" doesn't say there is only "Count it", with no "Looks right". Decision 6 settled that, and the code still does it (`opening.mjs` line 51).
   - "Count the cash: the difference" leaves out "How the till worked it out": float counted this morning, plus cash sales, minus cash refunds, minus paid-outs (`cashup.mjs` line 89; last walk's M2).
   - "Today, with sales waiting to send" leaves out "Till B1 last in touch at [time] · [n] sales waiting then" (`opening.mjs` line 188; last walk's L2).
3. **Why it matters:** if the uncounted-day box is built from its line alone, it could keep "Looks right". Wednesday's figure would then become a guess instead of a count, which is the double-counting problem the last walk's H1 fixed.
4. **Fix:**
   1. Give every line a short "what's different" phrase, taken from the old drawing (one field per screen in the consolidate files). Good for: the canvas holds everything that was decided, with no new drawings. Cost: writing text for every journey, not only this one.
   2. Link each line to its old drawing. Cost: builders work from drawings nobody keeps current.
   3. Leave it; builders read the code. Cost: Jack can't check the canvas against his decisions.

   Recommend 1.
5. **Decision it touches:** README rule 2; walk-through decision 6.

8th question: these already are lines. The fix only adds words to them.

**Second check:** CONFIRMED — README line 83 sets a "What's different" column, but `build.mjs` lines 305–318 use the folded drawing's title as that column, and the step-3 plan chose this (`docs/superpowers/specs/2026-10-03-one-canvas.md` line 37). The three examples check out: `opening.mjs` line 51 (only "Count it" when the day wasn't counted), `cashup.mjs` line 89, and `opening.mjs` line 188, and none of their notes says it. Option 1 changes a choice the step-3 plan made, not one of Jack's decisions. Medium is right.

**M2 — Every join in the story is a dead end on the canvas.**
1. **Screens:** listed below, with the click that should lead on and the board it should open.
2. **What happens:** apart from Prev/Next, the only links between boards are the ✕ on till boxes (back to `j11-till-sale`), Diary and Overview (to journey 12), and your name (Your settings). Every hand-over in the story is a button with no link, or a link to `#`:
   - `jb-till-checkin`: the PIN keys don't link anywhere, and Next goes to `jb-pin-change`, not to `j10-op-float-check`.
   - `op-float-check`: "Looks right" should go to `till-sale`; "Count it" should go to the counter (now a line under `eod-count`).
   - The till rail's "Online orders [n] to get ready" links to `#`, not to `on-orders`.
   - `on-orders` "Mark ready" and "Hand over" don't link. The page itself says "Hand over opens the till's hand-over", which is `till-collect`.
   - `ja-till-search` "Order [order number] · Maya Patel … Hand over" links to `#`, not to `till-collect`.
   - `till-receipt` "Email" should open `cp-receipt-address`.
   - `on-confirmed` and `on-email-ready` "See your order" should open `on-order`.
   - Getting from the till to Close the day: the till bar's "Close the day" is only a line under `till-sale`. No drawn button, so nothing to click. The old `eod-entry` linked to `eod-count`.
   - `op-today`'s "Close it" is only a line.
   - `eod-z` "Online payments today … see Reports" links to `#`, but `j17-rp-takings` is on the canvas.
3. **Why it matters:** the step-5 mockup must wire every join, and where the target is only a line there is nothing to land on.
4. **Fix, no choice:** in the generator, add a link wherever the target board exists. Where the target is a line, give that line a named state in the step-5 mockup. Don't add drawings.

8th question: no new screens. Links only.

**Second check:** CONFIRMED — I listed the link targets on each named board. "Online orders [n] to get ready" on `j11-till-sale` and the "Hand over" row on `ja-till-search` link to `#`, and so does "see Reports" on `j16-eod-z`. "Looks right" and "Count it" on `op-float-check`, "Mark ready" and "Hand over" on `on-orders`, "Email" on `till-receipt`, and "See your order" on `on-confirmed` and `on-email-ready` are plain buttons with no link. Those two customer boards reach `on-order` only through Prev/Next. The old till-bar link to `eod-count` is still in `cashup.mjs` line 214, but it was lost when `eod-entry` folded into `till-sale` (`consolidate/j16.mjs` line 8). Medium is right, because Close the day has no control drawn to press.

## Low

**L1 — Handing over an online order is listed under the wrong screen.** "Hand over: the till's hand-over for the order" and "Hand over with one item refunded" are lines under `till-sale` (`consolidate/j02.mjs`). But `on-hand-over` is built from `till-collect`'s own board (`online.mjs` line 293), and `till-collect` is kept as a board. Rule 5 says nothing is drawn twice, and as it stands a builder would find the hand-over in two places. **Fix, no choice:** move both lines to `till-collect`'s list. 8th question: lines only.

**Second check:** CONFIRMED — `consolidate/j02.mjs` lines 51–52 fold `on-hand-over` and `on-hand-over-refunded` into `till-sale`. `online.mjs` lines 290–294 build them from `tillScreens['till-collect']`, and `consolidate/j11.mjs` line 50 keeps `till-collect` as a board. The cause is the step-3 plan's rule that lines from other journeys go only to a fixed list of main screens, which includes the till page but not `till-collect` (one-canvas spec, decision log). The fix bends that plan rule but doesn't reopen any of Jack's decisions. Low is right.

**L2 — The line doesn't say who gets "Close the day".** The line under `till-sale` says "Close the day appears in the till bar after closing time — Manager". The person form (`set-staff-person`) has a "Can close the day" switch, so a Saturday worker closing up alone can be allowed. The line doesn't say that. **Fix, no choice:** change it to "Owner, Manager, or anyone with Can close the day". This touches Cash-up 5 without reopening it.

**Second check:** CONFIRMED — the line under `till-sale` says "— Manager", and Cash-up 5 says "owners and managers". But Owner setup decision 9 (30 Sep, one day later) lets a Staff member be given "Can close the day", and Opening decision 4 already uses that switch. The fixed wording follows those two decisions, so it should cite Owner setup 9 alongside Cash-up 5. The code comment at `cashup.mjs` line 207 still says "owners and managers". Low is right.

**L3 — The same thing has different names.**
- The end-of-day report says "Card machine" and "Sales" (`eod-z`).
- The saved day and Reports say "Card", "Sales" and "Takings (with VAT)" (`rp-day`, `rp-takings`).
- Search on staff pages says "Search jobs, customers, products" (`on-orders`, `op-today`). The till's search says "…jobs, orders", and its results have an Orders group. I didn't check whether staff-page search finds orders.
- Today's sidebar says "Online orders" with no count, while the till rail has "[n] to get ready" and `on-orders` has "3 to get ready".

**Fix, no choice:** use one word for each, and put the count on every sidebar.

**Second check:** CONFIRMED — `eod-z` says "Sales" and "Card machine", while the saved day in `rp-day` says "Sales" and "Card", and the Reports list says "Takings (with VAT)" and "Card". Search on staff pages is `diary.mjs` line 166 ("Search jobs, customers, products"), and the till's search adds "orders". The sidebar on `op-today` has no count after "Online orders"; `on-orders` shows "3 to get ready". Whether staff-page search finds orders is still unchecked, and I couldn't find it drawn. Low is right.

**L4 — "Tablet and phone ↗" opens canvases that aren't this one.** All 50 of the story's boards link to the old canvases, one per journey (for example `E9XTaKJys2WH3gpgwfPJbq` for journey 10). Rule 3 says the other sizes are written rules now, and the till's phone board (`j11-till-sale-phone`) is on this canvas. **Fix, no choice:** point the link at the written size rule, or remove it.

**Second check:** CONFIRMED on the facts, but the fix shouldn't be "no choice". `build.mjs` line 213 adds the link to every board, and phone boards label it "Sizes ↗". The overview says on purpose that the link "opens its journey's own canvas, where every drawing is kept" (`build.mjs` line 437), and the one-canvas plan keeps the folded drawings there. Removing the link would remove the only drawn view of the folded situations, and that ties to M1 option 2. A safer no-choice fix is to rename it to say what it opens. Removing it is for Jack to decide together with M1. Low is right.

## Earlier findings: were they fixed on the one canvas?

| Earlier | Now |
|---|---|
| H1 day not closed | Fixed, as lines under `eod-count`, `op-today` and `op-float-check`. "Only Count it" isn't in the line (M1). |
| M1 who answers the float check | Fixed and drawn ("first in today to take payments"; Alex Morgan "In" on Today) |
| M2 short float lost by evening | Report fixed and drawn (`eod-z` "Float at the start"). The workings are in code only (M1). |
| M3 order count at the till | Fixed and drawn ("[n] to get ready" on the rail) |
| M4 name doesn't find the order | Fixed and drawn (Orders group; `till-collect` over an empty basket) |
| M5 online money | Fixed and drawn (`eod-z`, and an Online line in `rp-takings`) |
| M6 held stock | Fixed, as lines (till-sale, on-orders) |
| M7 offline refund and hand-over | Fixed, as lines. The Today side is missing (H1). |
| M8 "keep it until" | Fixed and drawn ("kept for [n] days" in Settings) |
| M9 sorry message | Fixed ("Order not ready after all" row) |
| M10 older refund by name | Fixed ("Older sale? Find the customer" is a button), plus lines |
| M11 discount reaching payment | Fixed, as lines only. Every drawn payment box shows £74.00. |
| L1–L5 | Fixed. L2's wording is in code only (M1). L3: `op-float-short` has no ✕. |
| L6 undrawn edge cases | Still open, as recorded |

## Saturday worker and access

- **Saturday worker:** check-in, the float check and the hand-over each say what to do in words. Closing up alone depends on the switch (L2). The folded rail needs "Unfold" to reach a page; the app map says so.
- **Screen reader:** the PIN has a status ("2 of 4 digits entered"); Close the day's steps use `aria-expanded`; "Mark ready" is `aria-disabled` with a reason in words; "Hand over" names whose order it is; the receipt countdown is covered by "Don't close things by themselves". The noted refund has no reminder to hear (H1).
- **Keyboard:** the rail unfolds on focus as well as hover (`:focus-within`). Not checked: number keys on the PIN pad, or the order of the 12 count boxes.
- **Low vision:** not checked. The boards are fixed sizes.

## The end table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | till-sale lines, op-today, till-refund | Promised "refunds to finish" on Today isn't designed anywhere | Yes (1–3) |
| M1 | situation lists | Lines lack "what's different"; decided details only in code | Yes (1–3) |
| M2 | every join | Hand-overs have no links; Close the day has nothing to click | No |
| L1 | till-sale, till-collect | Hand-over lines under the wrong screen | No |
| L2 | till-sale line | "Close the day" line omits the switch | No |
| L3 | eod-z, rp-day, staff search, sidebar | Same thing, different names | No |
| L4 | all boards | "Tablet and phone ↗" goes off this canvas | No |

## Choices for Jack

1. Where a noted offline refund reminds people (H1). Recommend 1: a Today line for managers, plus a count on the till's Past sales.
2. How situation lines keep the details that were decided (M1). Recommend 1: a short "what's different" phrase on every line.

## Verification

- **Boards read as HTML text** (a scratchpad script listing text, buttons and link targets): every board of journeys 10, 11, 2 and 16; `ja-till-rail`, `ja-till-search`, `ja-staff-app`, `ja-map`, `ja-your-settings`, `jb-till-checkin`, `j05-cp-receipt-address`, `j08-set-eod`, `j08-set-staff-person`, `j08-set-msg-list`, `j17-rp-takings`, `j17-rp-day`. Staff at desktop, customers at phone.
- **Also read:** `canvas.json` boards and notes; `consolidate/j02`, `j10`, `j11`, `j16`, `jb`, `ja`, `j05`; `opening.mjs`, `cashup.mjs`, `till.mjs`, `online.mjs` in part.
- **Decisions read:** the walk-through decisions (2 Oct, decisions 4–6), Cash-up (journey 16), build-plan questions (3 Oct), and the "Later change" lines in Opening, Selling at the till, Buy online and Signing in. None of my journeys' files has a "Later change (3 Oct, issue #116)" note. I searched for one.
- **Not checked:** anything rendered (layout, colour, contrast, zoom), a real screen reader or keyboard, the old per-journey canvases behind "Tablet and phone ↗", and whether staff-page search finds orders. Clicks are counted from the boards, not timed.

## Second check

Checked 3 Oct 2026 by a second reviewer against `generator/out/project/` (`canvas.json` notes and the board `.dc.html` link targets), the generator modules, `consolidate/j02`, `j11` and `j16`, the README rules, the one-canvas spec, and the decision files.

- **Counts:** 7 findings checked. 7 confirmed, 0 refuted, 0 uncertain. No severity changes. L4 is confirmed on the facts, but its "no choice" fix isn't safe (see its line). The earlier-findings table checks out where I spot-checked it: M11's drawn £74.00 on `till-pay`, `till-pay-split` and `till-card`; no ✕ on `op-float-short`; "kept for [n] days"; the "Order not ready after all" row; and the parked sale in Close the day.
- **Decisions reopened:** none. H1 fills in decision 5 (old M7 option 1). M1 and L1 change choices the step-3 plan made (`2026-10-03-one-canvas.md`), not Jack's decisions, and the report could say so. L2 follows Owner setup 9 and Opening 4.
- **Drawings added:** none. Every fix is a line, a link, a badge or wording, which answers the eighth question.
- **Invented data or wording:** none found. Every quoted string matches the boards or the code.
- **Missed by the walker (mine):**
  1. One more naming difference for L3: `eod-z` says "Gift cards, credit, accounts, other", and the saved day in `rp-day` says "Gift cards, store credit, customer accounts".
  2. H1's reason should be narrower: Needs attention on Today is hidden from plain Staff, but not from Staff who have "Can close the day" (Opening 4).
