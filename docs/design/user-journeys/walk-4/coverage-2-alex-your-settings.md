# Coverage cell 2: App map and navigation × Alex Morgan, Your settings on the workshop computer (clicked on the mockup)

Stage W coverage check (`../coverage-check.md`, "Empty cells", cell 2), walked 4 Oct 2026. I used the method in `../ux-walkthrough-script.md` and Alex's checks in `../personas.md` (walk every workshop step on a shared desktop and on a tablet; always clear whose name the work is under), with issue #116's three changes: fewer steps rather than more drawings, screens counted as well as clicks, and the joins clicked through the mockup at desktop, tablet and phone. The mockup was rebuilt first (763 screens, 0 dead links). Targets below are the `data-go` / `data-act` values in `generator/out-mockup/data/*.json`, read with a scratchpad script. Nothing was saved to the repo.

Kept screens walked: `staff-app` (as its situation `staff-app-mechanic`, Workshop room only) and `your-settings`.

## The story, as the mockup clicks it

Story 8, at the start:

1. On the shared workshop desktop, Alex types his PIN (`till-checkin-workshop`). The keys open `diary-mechanic` with "Now working: Alex Morgan".
2. He clicks his name at the foot of the sidebar ("Your settings — Alex Morgan, Mechanic") and `your-settings` opens.
3. He checks what the drawing's lines promise: the settings are his, they'd switch if Jo typed her PIN, and there's no Change PIN on a workshop computer (walk-through 8, fix M3 and decision 3). He turns on "Larger text" and closes the pop-up.
4. Again on his own tablet (signed in with his own email), then at phone size.

## Clicks and screens

PIN typing isn't counted.

| Size | Clicks | Screens | Notes |
|---|---|---|---|
| Shared desktop | 3 (name, a switch, Close) | 3 (`till-checkin-workshop`, `diary-mechanic`, `your-settings`) | Close goes to the front desk's diary, not his (L1) |
| Tablet | 3 | 3 | The rail's "AM" opens the same drawing |
| Phone | 4 (menu, name, a switch, Close) | 4 (adds `staff-app-menu`) | The phone menu that opens is Jo Taylor's, with every room (M1) |

Fewer steps: one click from any workshop page to Your settings is already the fewest. The workshop-computer rules are lines on `your-settings`, not drawings, which is what issue #116 asks for. Nothing here needs a new drawing.

## High

None found.

## Medium

### M1: Alex opens his own name and gets Jo Taylor's settings, with Change PIN

- **Screens:** `diary-mechanic` → `your-settings` (desktop, tablet). `diary-mechanic` → `staff-app-menu` → `your-settings` (phone).
- **What happens:** Alex's name button is labelled "Your settings — Alex Morgan, Mechanic". It opens `your-settings`, which reads "Your settings · Jo Taylor · Staff · just for you", with "Till PIN •••• … Change PIN" (→ `pin-change`). Behind the pop-up is Jo's diary, with all four rooms and "Waiting for you (3)". On a phone, "Open menu" opens `staff-app-menu`: "Jo Taylor · Staff", Front desk, Workshop, Stockroom and Office. The lines under the drawing are right ("belong to the person who typed their PIN, and switch with them"; "no Change PIN"), but the drawing says the opposite. The mockup's person choice can't help: a click only swaps in a view whose id ends `-mechanic`, `-staff` and so on, and `your-settings` has none.
- **Why it matters:** this is the check walk-through 8 M3 was made for: on a shared computer, it must be clear whose settings and whose name these are. Clicked, Alex sees Jo's name and a Change PIN that decision 3 says isn't offered there. In a walk with Jack it looks as if the design does that.
- **Fix, no choice:** a mockup note, not a drawing. Alex's name button (on `diary-mechanic`, `job-mechanic`, `job-checklist` and the other mechanic drawings) opens `your-settings` with the note "Showing Jo Taylor's settings: on the workshop computer they're Alex Morgan's, with no Change PIN (see the lines below)". That's the same `go(id, note)` form the third walk used for "showing Till B2's report". The phone menu for a mechanic is in the same family as the phone-menu entries already in `mockup-gaps.md` (the phone menu is drawn for staff only), so add a line there: "the phone menu is drawn as Jo Taylor's; a mechanic sees only the Workshop room (`staff-app-mechanic`)".
- **Decision it touches:** walk-through 8, fix M3 and decision 3; App map 8 and 9. None reopened.
- **Second check:** KEPT. `diary-mechanic` at desktop: `"Your settings — Alex Morgan, Mechanic" → your-settings`; tablet the same. `your-settings` text at all three sizes begins "Your settings | Jo Taylor · Staff". "Change PIN" → `pin-change`. Phone `diary-mechanic` "Open menu" → `staff-app-menu`, whose foot reads "JT Jo Taylor Staff". `page.html` `viewOf()` only swaps ids ending `-staff|-mechanic|-manager|-owner|-all`. Walk 2 and walk 3 reports for story 8 don't mention Your settings in the mockup.

### M2: On the workshop computer, the sidebar's "Sign out" signs the shop's computer out

- **Screens:** `diary-mechanic`, `job-checklist` (desktop, the shared computer) → `auth-signedout`.
- **What happens:** right under Alex's name, the sidebar's foot reads "Sign out". It goes to `auth-signedout`: "You've signed out · Close this window, or sign in again." On `job-checklist` the same page also has the bar "Working: Alex Morgan · Switch". So a workshop computer offers both "Switch" (back to Enter your PIN) and "Sign out" (sign the computer out of the shop).
- **Why it matters:** walk-through 8 decision 1 says a workshop computer "stays signed in as the shop" and people take over with their PIN. If Alex presses the word he knows from every other computer, Sign out, the next mechanic finds an email sign-in, not the PIN screen. That's the one-computer problem decision 1 fixed. The till already solved the same thing: its rail's foot reads "Jo Taylor · Staff · Check out" (fix M6 part 1). The word list (walk-through 8 L3) says "Check out [name]" to leave, and keeps "Sign out" for your own email sign-in.
- **Fix, no choice:** a line on `staff-app`, following the till's pattern: "On a workshop computer the sidebar's foot reads 'Alex Morgan · Mechanic · Check out'; Check out goes back to Enter your PIN; no Sign out". A line, not a drawing. In the mockup, "Sign out" on mechanic drawings keeps its target. (Story 8's drawings are also the tablet's, where Sign out is right.)
- **Decision it touches:** walk-through 8 decision 1, fix M6 part 1 and L3 (followed, not reopened).
- **Second check:** KEPT. `diary-mechanic` desktop: "Sign out" → `auth-signedout`. `job-checklist` desktop has "Working: | Alex Morgan | ·", "Switch" → `till-checkin-workshop`, and "Sign out". None of the situation lines on `staff-app`, `till-checkin` or `diary` says what the foot reads on a workshop computer (`consolidate/ja.mjs` lines, the `till-checkin` list). The only "Check out" lines are the till rail's (`till-rail-open`) and oversight's `ops-till-checkout`. Walk 3 story 8 fixed the till rail's Sign out only ("Fixed: the till reads Check out").

## Low

### L1: Closing Your settings drops Alex on the front desk's diary

- **Screens:** `your-settings` → `diary` (all sizes). Also `diary-mechanic`'s sidebar "Diary" → `diary`.
- **What happens:** "Close" on `your-settings` goes to `diary`, the Staff view: Everyone, "Waiting for you (3)", all rooms. Alex came from `diary-mechanic` (his own column, "Me", Workshop room only). His own sidebar's "Diary" link does the same.
- **Why it matters:** he closes a pop-up and the page behind it has changed to someone else's view. On the real app, Close leaves you where you were.
- **Fix, no choice:** in the mockup, `your-settings`' "Close" goes back (`BACK`), and on mechanic drawings "Diary" opens `diary-mechanic`. Both are mockup links.
- **Decision it touches:** none.
- **Second check:** KEPT. "Close" → `diary` at desktop, tablet and phone, and on `rp-your-settings` too. The shared "Diary" rule is `go('diary')` with no role check.

### L2: The diary's "Today" button opens Office › Today, a room a mechanic can't see

- **Screens:** `diary-mechanic` → `op-today` (desktop, tablet). The same on `diary`.
- **What happens:** in the diary's toolbar ("Week · Day · 14–20 September 2026 · Today · Me · Everyone"), "Today" moves the diary to this week. In the mockup it opens `op-today`, the manager's Office › Today, with Tills and Needs attention. It picks up the sidebar's shared "Today" label.
- **Why it matters:** Alex only has the Workshop room (`staff-app-mechanic`). One tap on the diary's own date button takes him to an owner's page.
- **Fix, no choice:** in `links/j12.mjs`, the diary toolbar's "Today" stays on the page (like "Previous week" and "Next week"). This is a mockup link.
- **Decision it touches:** none.
- **Second check:** KEPT. On `diary-mechanic` the button is `<button … font-size: 13px … data-go="op-today">Today</button>`, after "Previous week" and "Next week" (both "stay"). `links/shared.mjs` line 10 maps every "Today" label. Walk 3's walk 1 L2 fixed the sidebar's Today by role, not this one.

## Decided, not drawn yet (not counted)

- Your settings on a workshop computer: belongs to the PIN person, and no Change PIN (lines on `your-settings`). M1 asks for a mockup note, not a drawing.
- "Working: Alex Morgan · Switch" on the diary is a line. It's drawn on `job-checklist` at desktop only (already in `mockup-gaps.md`, story 8 step 4).
- When Jo types her PIN, the mockup still says "Now working: Alex Morgan". Every key leads to one screen, as walk 10 L1 says; that's still open for Jack, so not raised again.

## Persona and access checks

- **Alex, shared desktop:** one click to his settings, as App map 8 drew. M1 shows him the wrong person, and M2 offers a way to sign the computer out.
- **Alex, own tablet:** signed in with his own email, so Your settings with Change PIN and Sign out are right there. M1 still shows Jo's name.
- **Screen reader:** the name button's name is "Your settings — Alex Morgan, Mechanic". The settings' switches are `role="switch"` with `aria-checked`. "Now working: Alex Morgan" is announced (second walk, answer 10, a line).
- **Keyboard only:** every control is a button. I didn't check the focus order or whether focus returns to the name button after Close.
- **Low vision:** the hints in Your settings are 13px and the section headings 12px on a phone. "Larger text" is in the same pop-up, one switch away. Not raised.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | diary-mechanic, staff-app-menu, your-settings | Alex's name opens Jo Taylor's settings, with Change PIN | No |
| M2 | diary-mechanic, job-checklist, auth-signedout | The workshop computer offers "Sign out" next to "Switch" | No |
| L1 | your-settings, diary | Close lands on the front desk's diary, not Alex's | No |
| L2 | diary-mechanic, op-today | The diary's "Today" opens Office › Today | No |

## Questions for Jack

None. M1 and both Lows are mockup fixes. M2 follows the till's "Check out" pattern (walk-through 8 fix M6 part 1) and the word list (L3), so there's no new choice.

## Verification

- **Walked:** `till-checkin-workshop`, `diary-mechanic`, `your-settings`, `job-checklist`, `staff-app-menu`, `staff-app-mechanic` at desktop, tablet and phone. `auth-signedout` and `op-today` at desktop. `rp-your-settings` for its Close. I read text, every control with its resolved target, and the situation lines (`consolidate/ja.mjs`, `situation-lines.mjs`).
- **Mockup code read:** `controls.mjs` `resolve()`, `links/ja.mjs`, `links/shared.mjs`, `page.html` (`fitFor`, `viewOf`, `onClick`), `stories.mjs` story 8.
- **Incoming-link scan:** nothing leads to `staff-app-mechanic`; `your-settings` has 1,098 incoming links, all to the one Jo Taylor drawing.
- **Decisions read:** `2026-10-03-ux-walkthrough-8.md` in full, with its later changes; App map in full; the second and third walk decisions; walk 3's story 8 report; `mockup-gaps.md`.
- **Not checked:** focus order and what a real screen reader says; whether the sidebar foot's "Sign out" is reachable when the job pop-up covers it (walk-through 8 step 3 saw it dimmed).
