# Coverage cell 5: Jack Lewis turns on buying online

Stage W coverage check (`../coverage-check.md`, "Empty cells", 5), 4 Oct 2026. Journey 2 (Buy online / click and collect) × Jack Lewis. Kept screens: `on-settings` (Settings › Front desk › Online orders) and `on-settings-start` (turning on buying online before the website is set up: "start with everything, or nothing", asked once). Walked on the clickable mockup's build (`generator/out-mockup/`), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, the owner's checks in `../personas.md`, and issue #116's three changes (fewer steps, not more drawings; count screens as well as clicks; walk the joins as clicks).

## The story

Story 4 (`mockup/stories.mjs`), from website set-up step 3. Jack is running alongside Citrus Lime (the import started at `mv-start`).

1. Website set-up step 3 asks "Start with every product online, or nothing?" (`ws-start-products`). Jack picks Every product online and presses **Make my website**. The mockup opens the Website page for a shop that's moving (`ws-page-moving`).
2. Jack wants the website to sell. He presses **Open Online orders settings** (or the Taking payments row).
3. He connects [payment provider] (`ws-pay-none` › Connect [payment provider], which leaves Wheelhouse), comes back (`ws-pay-connected`) and makes a test payment (`ws-pay-tested-moving`).
4. Buying online comes on. Because step 3 already asked, nothing is asked again (`on-settings-start-answered`: the answer, with Change).

The coverage cell suggested Jack answers the everything-or-nothing question "during the website set-up steps". He does, but on `ws-start-products`, not on `on-settings-start`. `on-settings-start` only appears when buying online is turned on *before* the website is set up (Buy online 3; 2 Oct walk-through 4 M7, "asked once").

## Clicks and screens

| Person | Size | As the mockup clicks today | As it should go (with M1 and L1) | Kept screens on the way |
|---|---|---|---|---|
| Jack Lewis | Desktop | 2 (Make my website, Open Online orders settings), then stuck: `on-settings` already says "Buying online On", and its switch does nothing | 4 (Make my website, Open Online orders settings, Connect [payment provider], Make a test payment), plus the provider's own sign-up; 5 boards | 3 (`ws-start-which`, `ws-page`, `ws-pay-none`) |
| Jack Lewis | Tablet | the same | the same | the same |
| Jack Lewis | Phone | the same; every control above is on the phone boards | the same | the same |

If Jack connects payments *before* setting up the website, `on-settings-start` adds one box and one click ("Turn on buying online"), and website set-up step 3 then shows the answer instead of the question. See question 1.

## High

None.

## Medium

**M1 — During a move, the Website page says payments are connected and tested before Jack has done either, and no click reaches the page where he connects them.**
- *Screens:* `ws-start-products` → `ws-page-moving` → `on-settings` or `ws-pay-tested` (all sizes); `ws-pay-none`.
- *What happens:* straight after Make my website, `ws-page-moving` reads "Ready for switch-over · 2 of 3", "Done: Payments connected, and the test payment worked", and the Taking payments row "Connected to [payment provider] · test payment done". Its two ways into Online orders go to boards that say the same: Taking payments opens `ws-pay-tested`; "Open Online orders settings" opens `on-settings`, where "Buying online" is already On (the switch stays put when pressed). `ws-pay-none` ("Buying online · Off until you connect [payment provider]", "Connect [payment provider]") is reached only from `ws-page`, the Website page for a shop that isn't moving.
- *Why it matters:* Jack has just made his website and is told payments are done. He'd believe customers can pay once switch-over comes, and the mockup gives him no way to connect.
- *Fix, no choice:* while payments aren't connected, the moving Website page shows the same Taking payments row as `ws-page` ("Not connected · customers can look but not buy · open to connect [payment provider]"), and both its Taking payments row and "Open Online orders settings" open `ws-pay-none`. This is a situation line on `ws-page` and two links in the mockup, not a new drawing.
- *Decision it touches:* Website management 5 and 8 (payments live in Online orders; Connect, then a test payment), 12 H5 ("Buying online can't be On until they are").
- *Second check:* CONFIRMED at desktop, tablet and phone. `ws-page-moving`'s text has "Payments connected, and the test payment worked"; its links are `ws-pay-tested` and `on-settings`. A search of every `data/*.json` finds `data-go="ws-pay-none"` only on `ws-page`. Walk-3 story 4 M1 moved Make my website onto `ws-page-moving` but looked at Turn it on, not at payments.

**M2 — The moving Website page and the test payment count payments towards "The website is ready", but the decision says one rule: no Words and photos row says Check this.**
- *Screens:* `ws-page-moving` ("Ready for switch-over · 2 of 3": the three set-up steps, payments, the pages' starting wording), `ws-pay-tested-moving` ("This counts towards 'The website is ready' on the switch-over checklist"); against `mv-ready-all` and `fr-today` / `fr-today-moving` (all sizes).
- *What happens:* the switch-over checklist's "The website is ready" and Getting started's step 9 tick on one rule (`moving.mjs` says so; `fr-today` reads "ticks when no Words and photos row says Check this"). The Website page shows a different, three-part count that includes payments, and the test payment says it counts.
- *Why it matters:* three screens give Jack two answers to "is my website ready to switch over?". A shop that switches over without selling online (buying online off on purpose) would see "2 of 3" forever.
- *Fix, no choice:* follow the decision. The Website page's ready count is the Words and photos rule only. Payments stay as their own row, not counted. `ws-pay-tested-moving` keeps "Customers can buy once your website goes on, during switch-over morning" and drops the "counts towards" sentence.
- *Decision it touches:* Website management, later change 3 Oct (walk-through 4 H3: "the move's checklist and Getting started tick 'the website is ready' on that one rule"), which came after the 2 Oct walk-through 4 H2 boards.
- *Second check:* CONFIRMED. The three texts are on all three sizes. `website.mjs` line 457 still carries the 2 Oct comment ("a working test payment counts towards 'The website is ready'"); `moving.mjs` line 195 cites the 3 Oct one rule. The 3 Oct decision is the later one.

**M3 — Neither "asked once" board can be reached, and the answered step 3 sends a moving shop to the Website page whose Turn it on works.**
- *Screens:* `ws-start-products-answered`, `on-settings-start-answered`, `on-settings-start` (all sizes).
- *What happens:* nothing links to `ws-start-products-answered` or `on-settings-start-answered`. `on-settings-start`, the question box itself, is reached only from "Change what your website started with" on `on-settings-start-answered` and `on-settings-show`; turning buying online on never opens it (the Buying online switch stays put, and `ws-pay-connected` shows it On straight after connecting). On `ws-start-products-answered`, Make my website goes to `ws-page`, not `ws-page-moving`, which is the walk-3 story 4 M1 problem again on the other route.
- *Why it matters:* the "asked once" rule can't be tried in the mockup in either order, and an owner who connects payments first, then sets up the website during a move, lands on a page that can put the website live weeks early.
- *Fix, no choice:* Make my website on `ws-start-products-answered` follows the same rule as on `ws-start-products` (moving → `ws-page-moving`). Where the question box lives depends on question 1; if it stays, the first press of Buying online opens `on-settings-start`, and website set-up step 3 opens as `ws-start-products-answered` after that.
- *Decision it touches:* 2 Oct walk-through 4 M7 ("asked once": `ws-start-products-answered`, `on-settings-start-answered`); 2 Oct walk-through 4 H2 (the website goes on during switch-over morning).
- *Second check:* CONFIRMED. A search of every `data/*.json` finds no `data-go` to either answered board; `on-settings-start` is reached only from the two "Change" links. `ws-start-products-answered`'s Make my website has `data-go="ws-page"` at all three sizes.

## Low

**L1 — During a move, the test payment opens the everyday result, not the moving one.** On `ws-pay-connected`, "Make a test payment" opens `ws-pay-tested` at every size. `ws-pay-tested-moving`, with "Customers can buy once your website goes on, during switch-over morning", has no way in. *Fix, no choice:* while a move runs, the test payment opens `ws-pay-tested-moving` (with M2's change to its wording). *Touches:* 2 Oct walk-through 4 H2. *Second check:* CONFIRMED: no `data-go="ws-pay-tested-moving"` in any data file.

**L2 — "Showing products" on Online orders doesn't open.** On `on-settings`, the "Showing products · Set on each category and product" row has `aria-expanded` and stays put. Its open version, `on-settings-show` (a switch per category, "Started with every product online on [date]" with Change), is drawn but reached only from `on-settings-start`'s "Turn on buying online". *Fix, no choice:* the mockup's map sends that row to `on-settings-show`; the clickable-mockup spec's per-screen map comes before its "aria-expanded changes on the spot" rule. *Second check:* CONFIRMED at all three sizes.

## Seen, not raised

- `mv-morning`'s Turn it on now opens `ws-published`, the live-preview editor, which Website management's 3 Oct later change (issue #116 question 2) puts off until after Release 2. That is story 4's switch-over step, not this cell; listed for whoever walks story 4 next.
- `ws-pay-connected` shows Buying online On before the test payment. Folded into question 1, because it decides whether connecting turns buying online on.
- `on-settings` says "Buying online On" for a shop that hasn't connected payments: it is the configured shop's board, and M1's fix routes a new shop to `ws-pay-none` instead.

## Persona checks

- **Jack Lewis:** reports aren't on this path, so the owner's report checks don't apply. The thread he'd lose is M1: told payments are done when they aren't.
- **Fewest clicks:** with M1, buying online takes 4 clicks from Make my website, and the everything-or-nothing question is asked once, in set-up. Question 1 would remove the other place it can be asked.
- **Screen reader and keyboard:** `on-settings-start`'s choices are real radio buttons, 22px; Close, Not now and Turn on buying online are buttons. Not checked in a browser.
- **Low vision, phone:** only "You're turning on buying online" is under 14px (13px) on `on-settings-start`; `ws-pay-none`'s row summaries are 13px.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | ws-page-moving → on-settings, ws-pay-tested | Moving Website page says payments done; connecting can't be reached | No |
| M2 | ws-page-moving, ws-pay-tested-moving | Payments counted towards "website ready", against the one-rule decision | No |
| M3 | ws-start-products-answered, on-settings-start(-answered) | "Asked once" boards unreachable; answered step 3 skips the moving page | No (where the box lives is question 1) |
| L1 | ws-pay-connected → ws-pay-tested | Moving test-payment result unreachable | No |
| L2 | on-settings | "Showing products" doesn't open | No |

Counts: 0 High, 3 Medium, 2 Low.

## Questions for Jack

1. **Should "Start with every product online, or nothing?" be asked only in the website's set-up, and not again when buying online is switched on?**
   Today it can be asked in two places: website set-up step 3, and a box on Settings › Online orders if buying online is switched on first (`on-settings-start`). Customers can't see any product until the website is set up and turned on, so the set-up question always comes before a customer sees anything.
   1. **Ask it only in website set-up step 3.** Good for: one place, one question; connecting payments simply turns buying online on, as `ws-pay-connected` already shows; drops the kept screen `on-settings-start` and both "answered" situations, so less to build and one click fewer for owners who connect payments first. Costs: changes Buy online 3's "asked when buying online is first turned on" and the 2 Oct "asked once" boards.
   2. **Keep both places, as decided.** Good for: no decision changes. Costs: three boards to build and keep in step; buying online must stay Off after connecting until the owner presses it (so `ws-pay-connected` and `ws-pay-tested` change), one more click and box.

   Recommend 1.

## Verification

- **Walked:** story 4 from `ws-start-products` at desktop, tablet and phone, with scratchpad scripts listing each board's text, every control and its target, and text under 14px; a search of every `data/*.json` for links into `ws-pay-none`, `ws-pay-connected`, `ws-pay-tested-moving`, `on-settings`, `on-settings-start`, `on-settings-start-answered` and `ws-start-products-answered`.
- **Boards read:** `ws-start-which`, `ws-start-look`, `ws-start-products`, `ws-start-products-answered`, `ws-page`, `ws-page-moving`, `ws-published`, `on-settings`, `on-settings-start`, `on-settings-start-answered`, `on-settings-show`, `ws-pay-none`, `ws-pay-connected`, `ws-pay-tested`, `ws-pay-tested-moving`, `fr-today`, `fr-today-moving`, `mv-ready-all`, `mv-morning`; situation lines of `ws-page`, `ws-pay-none`, `ws-start-which`, `on-settings`.
- **Decisions read:** Buy online 1–10 and later changes; Website management 5, 8, 11, 12 and the 3 Oct later changes; 2 Oct walk-throughs (walk-through 4 H2, M7); the second- and third-walk decisions; Owner setup 16–17.
- **Not checked:** anything rendered in a browser; the provider's own sign-up pages (outside Wheelhouse); the Shopify set-up route's step 3.

## Second check

Re-read every finding against the built data at three sizes and the decisions. Kept: 5. Dropped: 2.
1. "Getting started has no step for online payments": dropped. Website management 11 leaves payments to the Website page, and adding a step is more, not fewer.
2. "`on-settings` shows Buying online On for a new shop": folded into M1 (it is the configured shop's board; M1 routes a new shop elsewhere).
