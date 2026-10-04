# UX walk-through 4, third walk: a new shop (clickable mockup)

Walked 3 Oct 2026 for issue #116 step 6, on the clickable mockup (`generator/mockup/`, built into `generator/out-mockup/`). I followed story 4's 22 steps in `mockup/stories.mjs` through the drawings the mockup shows and the targets `controls.mjs` `resolve()` gives each button: Jack Lewis at desktop, then every step at tablet and phone (Jack's device isn't known, `personas.md`). A scratchpad script listed each step's screen text and every control's target. I didn't see it rendered. The second walk is `../walk-2/ux-walkthrough-4-new-shop.md`. Jack has answered its H2 (tills wait for switch-over), H3 (Words and photos), M3 (first PIN at the till) and M4 (forgotten PIN), so those aren't raised again.

## The story, as the mockup clicks it

1. Jack Lewis: Today's Getting started (`fr-today`) › Start: Connect the card machine › `fr-step` (Settings › Front desk › Payments) › Next: Invite your staff › `set-staff-invite` › Send the invite › `set-staff-invited` › Workshop › `set-workshop-services`.
2. Jo signs in for the first time: `pin-first` › Keep this PIN › `diary`.
3. Jack: `fr-today` › Moving from another system? › `mv-start` › Choose files › `mv-progress`.
4. Jo at Till B1: `till-checkin` › `op-float-check-first` › Count it › `op-float-count`.
5. Jack: `fr-today` › Set up your website › `ws-start-which` › `ws-start-look` › `ws-start-products` › Make my website › `ws-page`.
6. Weeks later: `mv-ready-all` › Pick the day › `mv-pick-day` › Switch over on [date] › `mv-morning` › Turn it on › `mv-week`.

## Clicks and screens, per person

| Person | Clicks the story presses | Different screens | Notes |
|---|---|---|---|
| Jack Lewis | 13, plus typing the invite, the files and the logo | 15 | On a phone, Workshop is two taps through the Settings list (listed in `mockup-gaps.md`) |
| Jo Taylor | 2, plus a password at sign-in, 4 PIN digits and the float count | 5 | |

## High

None.

## Medium

**M1 — During the move, "Make my website" lands on a Website page whose "Turn it on" works. The moving version, where it waits, is drawn but nothing reaches it.**
- *Screens:* `ws-start-products` → `ws-page` (all sizes); `ws-page-moving`, `ws-page-switch-over`.
- *What happens:* Jack is running alongside Citrus Lime (step 3 started the import). Step 3 of website set-up, Make my website, opens `ws-page`, which offers "Turn it on · This also publishes your website as it is now". `ws-page-moving` is drawn for exactly this moment ("Your website goes on during switch-over morning … so no order or booking reaches a shop that's still running on Citrus Lime", Turn it on waiting, "Open the switch-over checklist"). But no button and no story step leads to it. `mv-morning`'s Turn it on skips `ws-page-switch-over` too.
- *Why it matters:* one press on the page the mockup shows puts the website live weeks early. Customers then book and buy on Wheelhouse while the shop still runs on Citrus Lime, which is what the 2 Oct decision was made to stop.
- *Fix, no choice:* while a move is running, Make my website (and the sidebar's Website) opens `ws-page-moving`. The story's step 18 uses it. `mv-morning`'s Turn it on leads to the website being on (`ws-page-switch-over`'s result, or `ws-published`).
- *Decision it touches:* 2 Oct walk-through decisions, walk-through 4 H2 ("the website goes on as a step on switch-over morning": `ws-page-moving`, `ws-page-switch-over`). Applies it.
- *Second check:* CONFIRMED. `ws-page-moving` and `ws-page-switch-over` are in the mockup at all three sizes as situations of `ws-page`, and no `resolve()` target in the story's screens points to either. Walk-2 checked the move's checklist, not where set-up lands.

**M2 — Getting started's step 5, "ticks when a service has a price", can't be done: Edit opens a reminder box with no price.**
- *Screens:* `set-workshop-services` (desktop, tablet, phone) → `ac-service-edit`.
- *What happens:* every service shows "[£ price]". On desktop only Gear adjustment's row shows Edit and Remove. Its Edit opens "A service's reminder time", headed "Standard service · Full service · 60 min · £65.00" (a different service), with only "Remind customers it's due after [n] months". "+ Add a service" says "Not drawn yet". On a phone the rows have only their move handles: no Edit at all.
- *Why it matters:* a new shop's services all start without a price, so Jack can't tick step 5 or price a booking. On a phone there's no way in.
- *Fix, no choice:* a service's Edit opens the service box (name, group, time in the diary, price, and the reminder that Account 2 put on each service), headed with the service clicked. On tablet and phone, each row offers Edit the way the desktop row does. Drawing the empty box stays the decision already in `mockup-gaps.md` ("Adding a workshop service").
- *Decision it touches:* Owner setup 16 (each step ticks itself when done); Account 2 (a reminder time per service). Applies them.
- *Second check:* CONFIRMED. `resolve()` gives Edit → `ac-service-edit` on desktop and tablet, and the phone board has no Edit control. `ac-service-edit` is a journey 7 situation drawn for reminders only. Walk-2 didn't open these boards ("not checked … `set-workshop-services` … beyond their notes").

**M3 — After sending the invite, Getting started's "Next" is gone.**
- *Screens:* `fr-step` → `set-staff-invite` → `set-staff-invited` (all sizes).
- *What happens:* the first step opens with a bar: "Getting started: Connect the card machine · Checklist · Next: Invite your staff". Next opens the invite box. After Send the invite, Jack is on Settings › Office › Staff and roles with no Getting started bar and no "Next: Workshop services and prices". He has to know to press the Workshop tab (two taps through the Settings list on a phone), or go back to Today.
- *Why it matters:* an owner setting up a shop alone loses the thread at the second step, and each step after costs extra clicks.
- *Fix, no choice:* every page opened from Getting started keeps the bar, including the page under the invite box: "Getting started: Invite your staff · Checklist · Next: Workshop services and prices".
- *Decision it touches:* Owner setup 17 ("an opened step offers 'Next step' instead of 'step 3 of 8'"). Applies it.
- *Second check:* CONFIRMED. `set-staff-invited`'s text at all three sizes has no "Getting started" or "Next:"; `fr-step` has both. Walk-2 didn't follow the steps in order.

## Low

**L1 — Jo's first PIN sends her to the Workshop diary.** On `pin-first`, Keep this PIN (and Skip for now) open `diary`. Jo is Staff, at the front desk. *Fix, no choice:* Keep this PIN goes to the till (`till-sale`), or the page she last used. *Touches:* App map 11 (Staff land on Front desk › Till; Mechanic on the Diary). *Second check:* CONFIRMED at all sizes. App map 11 settles where Staff land.

**L2 — The story counts the first real day's float while the import is still running.** Steps 11–13 have Jo check in and count on `op-float-check-first` ("the first day the till takes real money") right after `mv-progress`, weeks before switch-over. In the mockup the PIN keys lead to the everyday `op-float-check` (with Looks right), not the first-day one. *Fix, no choice:* the story moves Jo's first check-in to after `mv-morning`, which itself says "The first person to check in counts the float". *Touches:* Moving, later change 3 Oct (walk-through 4 H2: while running alongside, the tills wait for switch-over day). *Second check:* CONFIRMED in `stories.mjs` and the PIN keys' targets. This is the story file, not a drawing. The "tills wait" check-in isn't drawn yet, as the decision itself says.

**L3 — Turn it on, on switch-over morning, jumps to day 5 of the first week.** `mv-morning`'s Turn it on goes straight to `mv-week` ("Day 5 of 7"). There's no moment that shows the website is now on and the tills are live. *Fix, no choice:* Turn it on leads to the morning with step 2 done ("Your website is on"), and the story's next step is the week. *Second check:* CONFIRMED. `mv-morning` has no "website on" situation, and `ws-published` is drawn for the Website page.

**L4 — Story mode guides only step 1, and Person stays as chosen.** The same mockup issue as walk-3 story 1 L2. Here, Jo's steps show as Owner.

## Second-walk findings seen again, not raised again

- Walk-2 H1 (practice mode drawn): gone. `mv-ready-all` is "4 of 4" with no practice row; `mv-pick-day` says "The tills take real money and messages to customers start".
- Walk-2 H2 (tills while running alongside): answered (Moving, later change 3 Oct). Not drawn yet: `fr-today` still says "Your till is ready, so you can sell now".
- Walk-2 H3 (Words and photos): drawn as a list on `ws-page`. Each Edit box is a line, so "Not drawn yet" in the mockup, as decided.
- Walk-2 M1 (own web address): "Wheelhouse sets up your own address for you" is drawn.
- Walk-2 M3: the till now reads "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here."
- "Ask us to help", "Another day…" and "Choose another colour": listed in `mockup-gaps.md`.

## Persona checks

- **Jack Lewis:** each Getting started row opens its place in one click. M2 and M3 are where he'd stall. Not known: whether he sets up on a phone, where M2 is worse.
- **Jo:** first sign-in shows her PIN straight away with words to learn it; then L1.
- **Saturday worker:** till-only invite drawn (`set-staff-invite-till-only`); not on this story's path.
- **Screen reader and keyboard:** the services' move handles say "drag, or use the arrow keys". Otherwise not checked.
- **Low vision:** nothing under 12px on this path at phone size; at desktop, only the sidebar's room headings (11px).

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| M1 | ws-start-products → ws-page | During a move, the website can be turned on early; the moving page is unreachable | No |
| M2 | set-workshop-services | Edit opens a reminder box with no price; no Edit on a phone | No |
| M3 | set-staff-invited | Getting started's Next is lost after the invite | No |
| L1 | pin-first | Jo lands in the Workshop diary | No |
| L2 | story 4, steps 11–13 | First-day float counted during the import | No |
| L3 | mv-morning → mv-week | Turn it on skips to day 5 | No |
| L4 | mockup story mode | Same as story 1 L2 | No |

Counts: 0 High, 3 Medium, 4 Low.

## Verification

- **Walked:** all 22 steps at desktop, tablet and phone, with every control's target. I also opened `ws-page-moving`, `ac-service-edit`, and the situations of `ws-page` and `fr-today`.
- **Read:** the script, personas, walk-2 report 4, the second-walk decisions, `mockup-gaps.md`; decisions Owner setup 16–17 and later changes, Moving later changes (3 Oct), Website later changes (3 Oct), Signing in later changes (3 Oct), App map 11, the 2 Oct walk-through decisions (walk-through 4), Account 2.
- **Not checked:** rendered layout; WorkOS's sign-in pages (outside Wheelhouse); a real screen reader or keyboard; text-only situation lines.

## Second check

Re-read on 3 Oct against the drawings at all three sizes and the decisions. Kept: 7. Dropped: 3.
1. "Your till is ready, so you can sell now" on `fr-today`: Jack answered walk-2 H2, and the decision says "Not drawn yet".
2. The Words and photos Edit boxes being "Not drawn yet": decided as a line (Website, 3 Oct).
3. `fr-today-moving` missing from the mockup: put later by `consolidate/j08.mjs` (issue #116 question 4), with Getting started's moving wording decided under walk-2 H2.

## Questions for Jack

None. Every finding applies a recorded decision, or is already in `mockup-gaps.md`.
