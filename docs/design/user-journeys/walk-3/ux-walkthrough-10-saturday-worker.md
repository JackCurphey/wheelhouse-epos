# UX walk-through 10, third walk: the Saturday worker's day, clicked

Issue #116 step 6, 3 Oct 2026. Walked on the clickable mockup (https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi, built in `generator/out-mockup/`). I followed story 10's steps in `generator/mockup/stories.mjs` through the real drawings and link targets as the Saturday worker at desktop, then at tablet and phone. Walk 2's findings that Jack answered (`../walk-2/ux-walkthrough-10-saturday-worker.md`; walk-through 8 decision 8 and its 3 Oct later changes) aren't raised again; see "Decided, not drawn yet".

The Saturday worker has no name yet (`personas.md`). The drawings call whoever is at the till "Jo Taylor", so the mockup greets them "Hello, Jo". That's example data, not a finding.

## The story, as the mockup runs it

1. They check in by PIN (`till-checkin`), then do the float check, "Looks right" (`op-float-check`, `op-float-matched`).
2. They sell the pads and the fitting, £74.00 by card, with no receipt (`till-sale` → `till-pay` → `till-card` → `till-receipt` → `till-empty`).
3. Maya's online order: search, "Hand over", tick, "Hand over" (`till-search` → `till-collect`).
4. They book a bike in at the till (`till-book-in`). Then a repair paid online is handed over (`till-hand-over-job`).
5. A customer pays for WH-1042 at the till (`till-search` → `till-job` → `till-pay`).
6. At closing time, someone who can close the day takes over (`eod-entry` → `eod-count` … `eod-z`).

## Clicks and screens

| Size | Clicks (worker) | Clicks (closing) | Screens | Notes |
|---|---|---|---|---|
| Desktop | 12 (1 PIN tap in the mockup, 4 in real use; the hand-over ticks not counted) | 7 | 20 | Step 4's two screens can't be reached by any click (H1) |
| Tablet | the same | the same | 20 | Same as desktop |
| Phone | the same | the same | 20 | The phone till keeps the sale behind "Open the sale", which isn't drawn (already in `mockup-gaps.md`) |

## Findings

### H1: The two new till screens can't be reached, and the paid repair's only button charges £111.00 again

- **Screens:** `till-search`, `till-book-in`, `till-hand-over-job`, `till-job` (desktop, tablet, phone).
- **What happens:** Jack decided the till books bikes in and hands over repairs paid online (walk-through 8 decision 8), and both screens are drawn. But no button anywhere in the mockup leads to `till-book-in` or `till-hand-over-job`. The story has to skip to them ("Book in on the expected WH-1042 row — a line only"). On `till-search`, the WH-1042 row's one control reads "approved £111.00 Add to basket ↵" and opens `till-job`, which is "Take payment · £111.00". That row has no Book in, no "Paid online", and no Hand over.
- **Why it matters:** These are the two things the Saturday worker most needs (walk 2 H1 and H2). Anyone clicking through the mockup as them finds only the button that would take Maya's £111.00 a second time. This is the double payment walk 2 H2 warned about, and it's still what the mockup shows.
- **Fix:** see question 1 below. The decided rows ("A job paid online: Paid online · [date], with Hand over in place of Add to basket"; "A job expected today: Book in") are lines on `till-search`. A line has nothing to click.
- **Decision it touches:** walk-through 8 decision 8; Collect and pay 5 (H3); the `till-search` lines in `consolidate/ja.mjs` 28–29.
- **Second check:** KEPT, and High is right: the story breaks at steps 12 and 15, and the only click on offer breaks a money promise. A search of every `data/*.json` finds no `data-go="till-book-in"` or `data-go="till-hand-over-job"`. `till-search`'s job row has `data-go="till-job"`. The decisions settle *what* the till does, not whether the rows are drawn. That's the same open choice as walk-through 9's question 1, so it's asked once there and repeated here only to tie it to this story.

### M1: After "Take payment · £111.00", the pay screen asks for £74.00

- **Screens:** `till-job` → `till-pay` → `till-receipt` (all sizes).
- **What happens:** `till-job` shows Maya's three agreed lines, "Total £111.00" and "Take payment · £111.00". Clicking it opens `till-pay`, which reads "Jo Taylor serving · 3 items · Card · £74.00 Sends £74.00 to the card machine", over the morning's pads-and-fitting sale. The receipt then says "Card · £74.00".
- **Why it matters:** someone taking money sees the amount change between two clicks. In a walk-through with Jack, that reads as a bug in the design.
- **Fix, no choice:** the mockup says "showing the £74.00 sale's pay screen" when `till-pay` is reached from `till-job`, or story 10 marks step 20 as a hand-over in brackets. There's no £111.00 pay drawing, and one isn't needed: the pay screen is the same with a different total.
- **Decision it touches:** none.
- **Second check:** KEPT. The `till-pay` text is as quoted, and the `till-job` control has `data-go="till-pay"`. Not raised in walk 2, which couldn't click.

### L1: Any PIN, at any time of day, opens the morning's first-in float check

Every digit on `till-checkin` goes to `op-float-check`: "Hello, Jo · Till B1 · first in today to take payments". So the worker coming back from lunch, or the owner checking in at closing to close the day, gets the morning float check again. **Fix, no choice:** the mockup sends the PIN to the till (`till-empty`) except at the story's first step, or adds a note "first in only" (mockup only). Opening the shop 2 already says the float check is for the first person to check in. **Second check:** KEPT. The digits 0–9 all have `data-go="op-float-check"`.

### L2: At closing time, the morning's £74.00 sale is still in the basket, unpaid

`eod-entry` ("Close the day appears in the till bar after closing time") shows "Serving: Jack Lewis" over a basket with the pads and the fitting, "Total £74.00 · Take payment · £74.00". On the phone it reads "Sale · 3 items · £74.00". That's the sale the worker took at step 2. **Fix, no choice:** the closing-time drawing's backdrop is an empty basket, as `till-empty` is. This is example data. **Second check:** KEPT. Text as quoted at desktop and phone.

### L3: After closing the day, Close goes back to "Ready to close the day"

On `eod-z`, "Close" is the mockup's Back. It returns to `eod-finish`, which still offers "Close the day and show the report". **Fix, no choice:** Close on the day's report goes to the till (`till-empty`). This is a mockup link. **Second check:** KEPT. `eod-z`'s Close is `data-act="back"`, and `page.html`'s Back pops the last screen, which is `eod-finish`.

### L4: The paid repair's hand-over says "Tick each item", with nothing to tick

`till-hand-over-job` reads "Tick each item as you hand it over. Already paid online — nothing to take at the till." The only controls are Close, "Not now" and "Hand over". It has no tick boxes, because a repair is one bike. The sentence was carried over from the online order's hand-over, which does have items. **Fix, no choice:** drop the tick sentence on the repair hand-over, or add one tick for "Trek Domane AL 3 · Kept on Hook 3". This is a wording change; Collect and pay 5 M4's Undo covers mistakes. **Second check:** KEPT. The controls are as listed at all three sizes.

### L5: The day's report says the float was short. The morning said it looked right

`op-float-matched` says "Float checked · Till B1 · counted by Jo Taylor", though the worker only pressed "Looks right". `eod-z` says "Float at the start [£] short, counted by Jo Taylor at [time]". **Fix, no choice:** the morning line says "checked by", as `op-today` does ("float checked by Jo Taylor"), and the day's report example matches the story (not short). This is wording and example data. **Second check:** KEPT. All three texts are as quoted. `op-today` uses "checked by".

### L6: "Acknowledged" on the till's book-in

`till-book-in` shows "Bike tag sent · Acknowledged · Front desk Zebra · 1 copy". "Acknowledged" is the printer's word, not a shop word, and the Saturday worker check asks for shop words. **Fix, no choice:** "Printed". This is wording. **Second check:** KEPT. The text is on all three sizes, at 12px on the phone.

## Decided, not drawn yet (not counted)

Clicking shows the old behaviour, because these answers are lines:

- "Till only" opens only the till and Front desk › Online orders (walk-through 8, 3 Oct, walk-through 10 M1). In the mockup the worker still has the full rail, and the basket's "Maya Patel · workshop job WH-1042" opens the job page (`job-collection`).
- A forgotten PIN can be given from the owner's or manager's phone (Signing in, 3 Oct, walk-through 10 M2). `till-checkin` still only says "No PIN yet? …".
- The closing-time line for staff who can't close the day (walk-through 10 M3), and "Handed over · Undo for a few minutes" after an online order (L2). Both are lines on `till-sale` and `till-collect`. The mockup goes straight to an empty basket.

## Persona and access checks

- **Saturday worker, after a week away:** check-in, the float check, the card sale and the online order hand-over click through with clear words. Book-in and the paid repair can't be found (H1).
- **Screen reader:** the PIN dots, the hand-over's ticks and the hooks are labelled. The receipt still closes itself after 5 seconds, which walk-through 1 already covered.
- **Low vision, phone:** the till's line details ("Labour · 60 min · agreed on the job") are 12–13px.
- **Who closes the day:** this is clicked as Jack Lewis. Whether anyone who can close the day works Saturdays is still not known.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | till-search, till-book-in, till-hand-over-job, till-job | New till screens unreachable; paid repair's only button charges £111.00 | Yes (question 1) |
| M1 | till-job, till-pay | £111.00 becomes £74.00 on the pay screen | No |
| L1 | till-checkin | Every PIN opens the first-in float check | No |
| L2 | eod-entry | The morning's sale still in the basket at closing | No |
| L3 | eod-z | Close after closing goes back to "Ready to close the day" | No |
| L4 | till-hand-over-job | "Tick each item" with nothing to tick | No |
| L5 | op-float-matched, eod-z | "Counted" and "short" against "Looks right" | No |
| L6 | till-book-in | "Acknowledged" | No |

## Questions for Jack

1. **The till's Book in and paid-online Hand over are decided but drawn only as lines, so the mockup can't reach the two till screens. Should the search rows be drawn?** This is the same choice as walk-through 9's question 1, about the same drawing (`till-search`). One answer covers both.
   1. **Draw them: a situation of the till search for "WH-1042", with "Expected 11:30 · Book in" and "Paid online · [date] · Hand over" in place of "Add to basket".** Good for: the Saturday worker's day can be clicked end to end, and the double-payment risk is visibly gone. Costs: one more drawing on the canvas.
   2. **Keep them as lines, and have the mockup's job row say "Not drawn yet: Book in or Hand over here".** Good for: no drawing. Costs: the only click on that row still takes £111.00, and nobody can try the till's book-in before it is built.

   Recommend 1.

## Verification

- **Walked:** every step of story 10 at desktop, tablet and phone, with scratchpad `walk-9-12.mjs` (each screen's text, every control and its target, text under 14px), plus a search of all `data/*.json` for links to `till-book-in` and `till-hand-over-job`.
- **Screens read in full:** `till-checkin`, `op-float-check`, `op-float-matched`, `till-sale`, `till-pay`, `till-card`, `till-receipt`, `till-empty`, `till-search`, `till-collect`, `till-book-in`, `till-hand-over-job`, `till-job`, `eod-entry`, `eod-count`, `eod-count-result`, `eod-banking`, `eod-paidout`, `eod-finish`, `eod-z`.
- **Also read:** `mockup/page.html` (Back), `controls.mjs`, `consolidate/ja.mjs` and `j11.mjs` lines, `mockup-gaps.md`.
- **Decisions read:** walk-through 8 (decision 8 and its 3 Oct later changes), Signing in (3 Oct later change), the second walk's answers, Opening the shop 2 and 7.
- **Not checked:** anything rendered in a browser (focus order, zoom, colour); whether a till-only person can be given "Can close the day" (still not stated).
