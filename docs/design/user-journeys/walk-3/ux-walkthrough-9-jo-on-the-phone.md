# UX walk-through 9, third walk: Jo on the phone, clicked

Issue #116 step 6, 3 Oct 2026. Walked on the clickable mockup (https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi, built in `generator/out-mockup/`). I followed story 9's steps in `generator/mockup/stories.mjs` through the real drawings and the real link targets: as Jo Taylor at desktop first, then at tablet and phone. This walk looks for what clicking shows that the canvas didn't. Findings that walk 2 (`../walk-2/ux-walkthrough-9-jo-on-the-phone.md`) raised and Jack answered are not raised again. They are listed under "Decided, not drawn yet".

## The story, as the mockup runs it

1. Jo is on the till's search (`till-search`) with "maya" typed in. Maya asks if her bike is ready and what it will cost.
2. Jo clicks Diary, then the WH-1042 block, which opens the job (`diary` → `job-overview`).
3. Jo clicks "Open Maya Patel's page" (`customer`) to answer the warranty question.
4. Jo clicks Stock, then the Shimano brake pads B05S-RX (`st-list` → `st-product`).
5. Jo clicks Diary, then New job, picks a free time and fills in the job (`new-job-pick` → `new-job`), then clicks Save job.

## Clicks and screens

| Size | Clicks | Screens | Notes |
|---|---|---|---|
| Desktop | 8 (Diary, block, Maya's page, Stock, pads, Diary, New job, a free time) + Save | 8 | Every step's named button leads on |
| Tablet | the same | 8 | The diary block reads "… Press and hold for more" |
| Phone | 11: the menu adds a tap before Diary, Stock and Diary again | 9 (adds the phone menu) | Every step leads on through the menu |

Fewer clicks: on Maya's page, "New job" opens New job with Maya already filled in. That's 1 click, against 3 through the diary (Diary, New job, a time). The story goes the long way because Jo looked at stock in between. Nothing is wrong with the drawings here.

## Findings

### M1: The same job shows a different stage and price depending on where Jo clicks it

- **Screens:** `diary`, `job-overview`, `customer`, `job-mechanic` (desktop, tablet, phone).
- **What happens:** In the diary, the WH-1042 block reads "In the workshop, 11:30–13:00 · approved £111". Clicking it opens `job-overview`, which says "Status Expected", shows a "Bike is here" button, has only "Standard service … £65.00" in Work and parts, and shows "Full service checklist 0 of 10 done". From Maya's page, the same job's row ("WH-1042 … In the workshop") opens `job-mechanic` instead: "In the workshop", "Approved £111.00", 8 of 10 done. "Open job WH-1042" on the product page also opens the Expected page.
- **Why it matters:** Jo is on the phone and Maya has asked "is it ready, what will it cost?" Clicking the diary block, the obvious route, shows a job still expected and £65.00. Jo would tell Maya the wrong thing. On the canvas each drawing makes sense on its own. Clicking from one to the other is what shows the clash.
- **Fix, no choice:** in the mockup's links, open WH-1042's "In the workshop" stage from every place that shows WH-1042 as In the workshop: the diary block, the product page's "Open job WH-1042", and the customer page row. Use a Staff view, not the Mechanic's (see M2). If no Staff drawing of that stage exists, say "showing the mechanic's view" in the mockup note. Nothing new to draw.
- **Decision it touches:** second walk answer 11 (one set of status words, Workshop day 20).
- **Second check:** KEPT. Re-read the built data. In the diary, "Trek Domane AL 3, Standard service, Maya Patel, WH-1042, In the workshop, 11:30–13:00 · approved £111" has `data-go="job-overview"`. `job-overview`'s text has "Status Expected", one £65.00 line and "Book in". The customer row goes to `job-mechanic`. Answer 11 settles the words, not where a click lands, so this is not settled. Walk 2 M4 was about the wording on the canvas; this is about the link targets, which walk 2 couldn't see.

### M2: Jo sees pages drawn for the owner and the mechanic, with costs and margin, though Staff versions are drawn

- **Screens:** `st-list`, `st-product`, `job-mechanic` (all sizes); `st-list-staff` and `st-product-staff` exist.
- **What happens:** Stock in Jo's sidebar opens `st-list`. Its sidebar says "Jack Lewis · Owner" with Reports, Website and Settings, and it has a Margin column. The pads open `st-product`, with "Cost £[cost] Margin [n]%". The Staff drawings ("Stock as Staff see it: no cost or margin" and "A product's page as Staff see it") exist, but no button anywhere in the mockup leads to them. WH-1042 from Maya's page opens `job-mechanic`. That page's sidebar is "Alex Morgan · Mechanic" with only the Workshop room, so Jo has no Till link to get back to the counter (only the mockup's Back).
- **Why it matters:** Staff see no cost or margin unless they are given "Can see costs and margin" (Reports 5; Stock control, 1 Oct later change). Anyone trying the mockup as Jo sees what Jo must not see, and could take that as the design.
- **Fix, no choice:** in the mockup's links, a Staff screen's Stock goes to `st-list-staff`, and its product rows go to `st-product-staff`. Story 9's steps use those two. The job opens as in M1.
- **Decision it touches:** Reports and accounts 5; Stock control (1 Oct later change).
- **Second check:** KEPT. `grep` of every data file finds no `data-go` to `st-list-staff` or `st-product-staff`. The `st-list` and `st-product` text starts "… JL Jack Lewis Owner …" and has Margin and Cost. No decision settles which drawing the mockup opens.

### M3: Jo's one search box can't be tried away from the till, and on a tablet or phone it opens the till's sale

- **Screens:** the header search on `customer`, `diary`, `st-list`, `rp-home` (tablet and phone: a search button; desktop: a box); `till-search` (all sizes).
- **What happens:** On desktop, "Search jobs, customers, orders, products" is a plain box in the mockup. Clicking or typing does nothing. On a tablet or phone, the search button on any staff page opens `till-search`, which is the till itself: the basket, "Take payment", "Add to basket ↵" and "Add to sale". On `till-search`, the WH-1042 row's only control still puts £111.00 in the basket (`till-job`), and "Maya Patel … Add to sale" does nothing, even though the till with a customer added (`till-customer`) is drawn.
- **Why it matters:** "One search box" is Jo's first persona check. Jack decided how it works: rows open what they are, a button on the right sells, the job row shows its stage and ready-by date, and the header search has no till buttons. All of that is lines on the situation list, so the mockup can't show any of it. Someone trying it on a tablet from Maya's page lands in a sale.
- **Fix:** see question 1 below. Whichever is chosen, "Add to sale" should open `till-customer` (a link only).
- **Decision it touches:** App map, 3 Oct (walk-through 9 H1); Stock control, 3 Oct (walk-through 9 M2); Customer service 12(5); the `staff-app` line "Search open on any staff page … no till buttons".
- **Second check:** KEPT. The tablet and phone data have `aria-label="Search jobs, customers, orders, products" … data-go="till-search"` on every staff page. On desktop the search is an `<input>` with no target. `consolidate/ja.mjs` lines 31–34 hold the decided rows as lines. The decisions settle what the search does. They don't settle whether to draw it, so that is asked, not fixed.

### M4: New job books Maya in two days ago, and Save opens her old job

- **Screens:** `new-job-pick`, `new-job`, then `job-overview` (all sizes).
- **What happens:** Maya asks for next week. On `new-job-pick`, the only free time the mockup can click is "Choose 10:00 · Alex Morgan for the new job". It fills in "Tue 15 Sep · 10:00 · Alex Morgan" with "Only 30 minutes free at 10:00 — this job needs 60", but today is Thu 17 Sep. "Next week" does nothing. "Save job" opens `job-overview`, which is the old WH-1042 ("Created Thu 17 Sep … Thu 17 Sep · 11:30–13:00"), not a new job. Nothing says "Booking confirmed sent to 07700 900 142".
- **Why it matters:** At the end of the call Jo has to tell Maya the new date and that a text is coming. The mockup shows a date in the past, a clash warning, and then her old booking.
- **Fix, no choice:** in the mockup, show a note after Save: "Saved: Booking confirmed sent to 07700 900 142 (a line on `new-job`)". Give the example a free time after today. The free time is example data on `new-job-pick`, so this changes no design.
- **Decision it touches:** Book a repair, 3 Oct (walk-through 9 L4).
- **Second check:** KEPT. `new-job`'s text has "Tue 15 Sep · 10:00 · Alex Morgan" and the 30-minute warning. "Save job" has `data-go="job-overview"`, and that page says "Created Thu 17 Sep". The saved line is decided but is a line, so the mockup can't show it. That part is the same kind of gap as M3, and is raised here only because it is the last step of the story.

### L1: The job's Close says "back to the diary", wherever Jo came from

`job-overview`'s "Close, back to the diary" always goes to the diary, including when Jo opened the job from the product page ("Open job WH-1042") or from Maya's page. **Fix, no choice:** in the mockup, Close goes back to the page Jo came from. The wording "back to the diary" is only right when the diary opened it. **Second check:** KEPT. The control has `data-go="diary"`. No decision covers it.

### L2: Two buttons on Maya's page go somewhere surprising

On `customer`, the history filter "Messages" (beside Everything, Jobs and Sales) opens the Messages inbox (`ac-inbox`) instead of filtering her history. The tabs beside it stay put. **Fix, no choice:** the filter stays on the page, as the other three do (mockup link only). **Second check:** KEPT. A scan of selector controls that navigate finds "Messages → ac-inbox" on `customer`, `cs-page` and 13 more situations.

### L3: The diary's quick look adds up to more than it says, and uses "Cost" for the price

The quick look over WH-1042 lists "Standard service £65.00, Fit & adjust brakes £18.00, Shimano brake pads £28.00, Replace gear cable £12.00", then "Cost £111.00". The four lines make £123.00. The gear cable was declined, but the quick look doesn't say so. In staff wording, "Cost" means what stock cost the shop (script word list). **Fix, no choice:** mark the declined line "· no thanks" as Maya's own page does (`dq-answered`), and call the total "Agreed £111.00". This is a wording change. **Second check:** KEPT. The `diary` text is as quoted. `job-mechanic` marks the cable "Declined". Walk 2 didn't raise this.

## Decided, not drawn yet (not counted)

These are Jack's recorded answers. In the mockup they appear only as lines, so clicking shows the old behaviour:

- The till search's split rows, with stage and ready-by on the job row (App map, 3 Oct). Clicking the job row still sells it.
- Product rows with price and "[n] in stock here · [n] at [Second site]" (Stock control, 3 Oct). The till search shows "No products match", so Jo still has to leave the till for the price.
- "Booking confirmed sent to …" on saving New job (Book a repair, 3 Oct). See M4.
- Search finds bikes, frame numbers and requests, and the cursor starts in the till's search box (second walk answer 12).

## Persona and access checks

- **Jo, desktop:** the answers to Maya's three questions (ready? warranty? pads in stock?) are each on screen within 1–2 clicks, but M1 gives the wrong stage and price.
- **Saturday worker on the same call:** the same path. M2 would show them the owner's costs.
- **Screen reader:** the diary blocks carry their full stage and price in their names, for example "… WH-1042, In the workshop …". The job page they open says Expected (M1).
- **Low vision, phone:** the diary's day names and hours are 12px, and the customer page's job stages are 12px.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | diary, job-overview, customer, job-mechanic | One job shows Expected £65 or In the workshop £111 depending on the click | No |
| M2 | st-list, st-product, job-mechanic | Jo lands on owner and mechanic pages; Staff versions unreachable | No |
| M3 | header search, till-search | One search box can't be tried; tablet and phone search opens a sale | Yes (question 1) |
| M4 | new-job-pick, new-job | New job lands on a past date; Save opens the old job | No |
| L1 | job-overview | Close always goes to the diary | No |
| L2 | customer | The Messages filter opens the inbox | No |
| L3 | diary | Quick look lines add to £123, says "Cost £111.00" | No |

## Questions for Jack

1. **The search Jo uses on every call is decided but only written as lines, so the mockup can't show it. Should it be drawn?**
   1. **Draw it: redraw the till search's rows as decided, and add one new drawing of the search open on a staff page.** The till search's rows would show the name that opens, the till button on the right, and the job's stage and ready-by date. The new drawing would have no till buttons. Good for: Jo's main tool, and the Saturday worker's (walk-through 10), can be clicked and checked before the build. Costs: one existing drawing changes and one is added. That breaks the "lines unless the layout differs" habit, though here the layout does differ.
   2. **Redraw only the till search's rows. Leave the header search as a line.** Good for: fixes the till, where the sell-by-mistake risk is, with no new drawing. Costs: on a tablet or phone, the header search keeps opening the till.
   3. **Keep both as lines, and have the mockup say "Not drawn yet: the decided search" on these rows.** Good for: no drawing work. Costs: the mockup keeps selling £111.00 on a click, and nobody can try the search before it is built.

   Recommend 1.

## Verification

- **Walked:** every step of story 9 at desktop, tablet and phone, with a throwaway script (scratchpad `walk-9-12.mjs`). It reads `out-mockup/manifest.json` and `data/<journey>-<size>.json` and lists each screen's text, every control with its resolved target, and text under 14px.
- **Screens read in full:** `till-search`, `diary`, `job-overview`, `customer`, `st-list`, `st-product`, `st-list-staff`, `st-product-staff`, `job-mechanic`, `new-job-pick`, `new-job`, `staff-app-menu` (phone).
- **Also read:** `mockup/controls.mjs`, `drawings.mjs`, `page.html` (how Back and sizes work), `consolidate/ja.mjs` situation lines, `mockup-gaps.md`.
- **Decisions read:** the second walk's answers (3 Oct); the 3 Oct later changes in App map, Stock control, Book a repair and Reports and accounts; Workshop day 20.
- **Not checked:** anything rendered in a browser (colour, focus order, zoom); what typing in the search would show (nothing is wired to typing).
