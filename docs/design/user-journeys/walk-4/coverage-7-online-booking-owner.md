# Coverage cell 7: Jack Lewis sets up online booking

Stage W coverage check (`../coverage-check.md`, "Empty cells", 7), 4 Oct 2026. Journey 3 (Book a repair) × Jack Lewis. Kept screen: `bk-settings` (Settings › Workshop › Online booking), with its drop-off window line and `bk-settings-deposits` (scrolled to deposits and terms). Walked on the clickable mockup's build (`generator/out-mockup/`), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, the owner's checks in `../personas.md`, and issue #116's three changes.

## The story

Story 4 (`mockup/stories.mjs`), after `set-workshop-services` (Getting started step 5, "Workshop services and prices"). A new shop: no online payments connected yet (`ws-pay-none`).

1. On Settings › Workshop, Jack presses the **Online booking** row ("Exact times · 2 hours' notice · deposit [n]% · each booking a request") to open it (`bk-settings`).
2. He picks **A day to drop off**. The drop-off window row appears ("Drop-off window [start] to [end]", a situation line) and he types the times.
3. He scrolls to **Deposits** (`bk-settings-deposits`), turns on "Take a deposit when booking", picks a fixed amount or a percentage, and sets "Free to cancel until".
4. Which services can be booked online, and which take a deposit when "Chosen services" is picked, are "set on each service, in Services": he goes back to Services and opens a service's **Edit** (`ac-service-edit`).

## Clicks and screens

| Person | Size | As the mockup clicks today | As it should go (with M1) | Kept screens on the way |
|---|---|---|---|---|
| Jack Lewis | Desktop | 0: the Online booking row stays put, and nothing else leads to `bk-settings` | 3 (Online booking, A day to drop off, the deposit switch), plus typing the window, amount and cut-off; 3 boards (`set-workshop-services`, `bk-settings`, `bk-settings-deposits`) | 2 (`set-workshop-services`, `bk-settings`) |
| Jack Lewis | Tablet | the same | the same | the same |
| Jack Lewis | Phone | the same | the same, from Getting started; from the sidebar, Workshop is two taps through the Settings list (accepted 3 Oct) | the same |
| Per service (step 4) | any | Edit, Save: 2 | 2, once M3's fields exist | +0 (a situation of `set-workshop-services`) |

Issue #116's question, "could this be a line?": yes, and it already is. The drop-off window is a line on `bk-settings` (Book a repair, 3 Oct), and Online booking is a section of the one Settings › Workshop page, not a new page. Getting started has no booking step, and none is needed: a new shop starts with requests (Book 8), no deposit (Book 3) and exact times, so the website's "Book a repair" is safe on its defaults.

## High

None.

## Medium

**M1 — Online booking can't be opened: nothing in the mockup leads to `bk-settings` or `bk-settings-deposits`.**
- *Screens:* `set-workshop-services` → `bk-settings` (all sizes); `bk-settings`'s own Services and Mechanics rows.
- *What happens:* on Settings › Workshop, the Online booking row is a button with `aria-expanded`, so the mockup's rule keeps it on the spot. The open section is its own kept screen, `bk-settings`, which no board links to; nor `bk-settings-deposits`. On `bk-settings`, the Services and Mechanics rows also stay put, though the page tells Jack those rows are where "which services can be booked" and "who can be booked" are set.
- *Why it matters:* every rule for booking online lives here (Book 11). Anyone clicking story 4 as Jack never sees it, so the drop-off window, deposits and confirming automatically can't be tried.
- *Fix, no choice:* in the mockup's map, the Online booking row on `set-workshop-services` opens `bk-settings`; on `bk-settings`, Services opens `set-workshop-services` and Mechanics opens `set-workshop-mechanics`. The clickable-mockup spec's per-screen map comes before its "aria-expanded changes on the spot" rule, which is for sections drawn open on the same board. No drawing changes.
- *Decision it touches:* Book a repair 11 (one Online booking section in Settings › Workshop).
- *Second check:* CONFIRMED. A search of every `data/*.json` finds no `data-go="bk-settings"` or `data-go="bk-settings-deposits"`. The row's target is `stay` on `set-workshop-services` and `bk-settings` at desktop, tablet and phone.

**M2 — Deposits can be switched on with no online payments, and the only drawing shows them on.**
- *Screens:* `bk-settings`, `bk-settings-deposits` (all sizes); against `ws-pay-none`.
- *What happens:* "Take a deposit when booking · On" and the summary "deposit [n]%" are on both boards. Nothing on the page mentions payments. In story 4, Jack hasn't connected [payment provider] yet; `ws-pay-none` says "Customers can't buy online, and 'Pay now' for repairs is hidden, until you connect", but says nothing about deposits.
- *Why it matters:* with deposits on (Book 3: "the last step takes a card payment") and no payment provider, a customer's booking would stop at a payment step that can't take money, or go through without the deposit the page promises. Book 3 also says deposits start off for a new shop.
- *Fix, no choice:* follow the closest patterns. While payments aren't connected, the deposit switch is Off and reads "Connect [payment provider] first · in Settings › Front desk › Online orders", as Buying online does (Website management 12 H5; `ws-pay-none`), and as the Lightspeed board already says "Deposits and paying online are off". `ws-pay-none`'s sentence adds deposits beside "Pay now". A line on `bk-settings`, logged in `decided-while-building.md` when built.
- *Decision it touches:* Book a repair 3 (off by default; a card payment when on); Website management 8 and 12 H5.
- *Second check:* CONFIRMED. No board's text in journey 3 mentions the payment provider on `bk-settings`. The Lightspeed line on `set-workshop-services` ("Banner 'Deposits and paying online are off.'") is for a Lightspeed shop only, so it doesn't already cover this. Kept as Medium: a story step depends on it, but the decision itself (deposits need card payment) is settled.

**M3 — "Set on each service" points to a service box that has neither setting.**
- *Screens:* `bk-settings` ("Which services can be booked online is set on each service, in Services"; deposits "For · Chosen services (choose on each service)") → `set-workshop-services` → `ac-service-edit` (all sizes).
- *What happens:* the service box, as fixed after walk-3 story 4 M2, has Name, Group, Time in the diary, Price and "Remind customers it's due after [n] months". It has no "Customers can book this online" and no "Take a deposit". Neither is a situation line on `set-workshop-services`.
- *Why it matters:* Jack can't choose which services appear on his booking page, or which take a deposit, though the page sends him there.
- *Fix, no choice:* the service box gains "Customers can book this online" (on by default) and, when deposits are for chosen services, "Take a deposit for this service". Two lines on `ac-service-edit`'s situation, in the same pattern as a person's "Customers can book this person online" (Owner setup 11).
- *Decision it touches:* Book a repair 11 ("which services can be booked stays on each service"); Book a repair 3 ("only chosen services"); Owner setup 11 (the pattern).
- *Second check:* CONFIRMED. `ac-service-edit`'s text at all three sizes has neither field; the five situation lines of `set-workshop-services` don't mention booking online per service. Walk-3 story 4 M2 listed the box's fields without these two, so this is new.

## Low

None.

## Seen, not raised

- "A day to drop off" stays on the spot and the drop-off window row doesn't appear: the row is a line on `bk-settings`, not drawn yet (Book a repair, later change 3 Oct, the drop-off window).
- "Use your own" booking terms: in `../mockup-gaps.md`.
- "See your booking page ↗" opens `bk-service`, the customer's page, while story 4's website is still off. What staff see then is coverage cell 4's ground; not checked here.

## Persona checks

- **Jack Lewis:** reports aren't on this path. With M1–M3 fixed, setting up drop-off days and deposits is 3 clicks plus typing on one page, and each service is 2 clicks.
- **Fewest clicks:** Online booking needs no Getting started step; the safe defaults let a new shop take requests from day one.
- **Screen reader and keyboard:** the section rows are buttons with `aria-expanded`; "An exact time to arrive" and "A day to drop off" are a choice. Not checked in a browser.
- **Low vision, phone:** the summaries under each row ("Exact times · 2 hours' notice · deposit [n]% · each booking a request", "Before the booked time · after that…") are 13px.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | set-workshop-services → bk-settings | Online booking can't be opened in the mockup | No |
| M2 | bk-settings, bk-settings-deposits | Deposits on with no online payments | No |
| M3 | bk-settings → ac-service-edit | "Set on each service" but the service box has no such setting | No |

Counts: 0 High, 3 Medium, 0 Low.

## Questions for Jack

None. Each finding applies a recorded decision or follows the closest drawn pattern.

## Verification

- **Walked:** story 4 from `set-workshop-services` at desktop, tablet and phone, with scratchpad scripts listing each board's text, every control and target, and text under 14px; a search of every `data/*.json` for links into `bk-settings`, `bk-settings-deposits` and `set-workshop-services`.
- **Boards read:** `set-workshop-services`, `ac-service-edit`, `bk-settings`, `bk-settings-deposits`, `ws-pay-none`, `fr-today`; situation lines of `bk-settings` and `set-workshop-services`.
- **Decisions read:** Book a repair 3, 4, 8, 11 and the later changes (3 Oct drop-off window); the 4 Sep booking-mode decision (§2 item 3); Owner setup 11, 16, 17, 19; Website management 8, 12; the third-walk decisions.
- **Not checked:** rendered layout and focus order; the customer's booking pages with deposits off (journey 3's own walk).

## Second check

Re-read against the built data at three sizes and the decisions. Kept: 3. Dropped: 1.
1. "Getting started has no online booking step": dropped. The defaults are safe (Book 3, Book 8), and adding a step is more, not fewer.
