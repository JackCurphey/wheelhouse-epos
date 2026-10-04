# Coverage cell 11: Jack Lewis sets up review requests

Stage W coverage check (`../coverage-check.md`, "Empty cells", 11), 4 Oct 2026. Journey 7 (Account, history and reminders) × Jack Lewis. Kept screen: `ac-review-setting` (review requests: the review page, when, the wording), with its situation `ac-review-first`. Walked on the clickable mockup's build (`generator/out-mockup/`, copied to the scratchpad the moment it was built, every data file checked as whole JSON), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, the owner's checks in `../personas.md`, and issue #116's three changes.

## The story

Story 4 (`mockup/stories.mjs`), during Getting started's settings steps, after `set-workshop-services`:

1. On Today's Getting started (`fr-today`), Jack presses **Set up** on step 8, "Check the messages customers get · Settings › Messages" (→ `set-msg-list`).
2. He scrolls to "Review request · After a bike is collected · Off" and presses **Edit**.
3. It's the first time, so the box should be `ac-review-first`: "Send review requests · Off · Add your review page first, then switch this on". He types the shop's review page and the number of days after collection, checks the wording and preview, switches it on, and presses **Save** (→ `set-msg-list`).

## Clicks and screens

| Person | Size | Clicks | Screens | Notes |
|---|---|---|---|---|
| Jack Lewis | Desktop | 4 (Set up, Edit, the switch, Save), plus typing the review page and the days | 3 (`fr-today`, `set-msg-list`, `ac-review-first`) | In the mockup, Edit opens the "Bike ready" wording box instead (M1) |
| Jack Lewis | Tablet | the same | the same | the same |
| Jack Lewis | Phone | the same, from Getting started; a long scroll to the last row | the same | the same |

Issue #116's question, "a line instead of a screen?": nothing new is needed. The review box is already one kept screen with one situation. The fixes below are links and two small states on existing rows.

## Findings

### M1: Edit on "Review request" opens the "Bike ready" wording box, so review requests can't be set up by clicking

- **Screens:** `set-msg-list` → `set-msg-edit` (desktop, tablet, phone); `ac-messages`, `ac-review-setting`, `ac-review-first`.
- **What happens:** on Settings › Messages, the screen Jack actually reaches from Getting started and the sidebar, the button "Edit the wording of Review request" opens `set-msg-edit`, whose box is "Bike ready · Sent when a job is marked ready". The same happens for "Service reminder" (its box is `ac-reminder-wording`) and "Bike still waiting" (`cp-message-wording`). Only the situation board `ac-messages` sends Review request's Edit to the review box. Even there it opens `ac-review-setting`, the box already switched On with a review page filled in, while the row says "Off". The first-time box, `ac-review-first`, can't be reached by any click.
- **Why it matters:** there's no other way to the review page or "[n] days after collection". Walking it as Jack, the setting Account 5 decided can't be found, and the box that opens is about something else.
- **Fix, no choice:** in `mockup/links/j08.mjs`, take "Review request", "Service reminder" and "Bike still waiting" out of the list that all opens `set-msg-edit`, and send them to their own boxes. Review request goes to `ac-review-first` while its row is Off (as on `set-msg-list` and `ac-messages`), and to `ac-review-setting` once it's on.
- **Decision it touches:** Account 5 (switched on in Settings › Messages, with the review page and when); Owner setup's 1 Oct later change ("Review request (off until the shop adds its review page)"). Applied, not reopened.
- **Second check:** KEPT. `links/j08.mjs` lines 7–13 list all three names, and line 25 spreads them over every journey 8 board. The built `set-msg-list` has `data-go="set-msg-edit"` on that button at all three sizes. `ac-messages` (journey 7) has `data-go="ac-review-setting"`. The first-time situation's only way in is the situation list. Medium: a screen the story needs can't be reached. The drawings themselves are right.

### L1: The row's "Off" can be pressed before there's a review page

- **Screens:** `set-msg-list`, `ac-messages` (all sizes).
- **What happens:** on the list, Review request's "Off" is an ordinary on/off button (`aria-pressed="false"`, not disabled). Inside the box, the same switch is disabled with "Add your review page first, then switch this on." What happens if Jack presses Off → On on the list with no review page isn't drawn.
- **Why it matters:** this is an edge case at the join. Switched on from the list, review texts would go out with no page to link to. The owner's 1 Oct note says it stays "off until the shop adds its review page".
- **Fix, no choice:** follow the pattern the box already has. Until a review page is saved, the row's switch is unavailable and reads "Off · add your review page first", and Edit is the way in. Log it in `decided-while-building.md` when built.
- **Decision it touches:** Owner setup, 1 Oct later change; Account 5. Applied, not reopened.
- **Second check:** KEPT. The row's markup is a plain `aria-pressed` button with `data-act="stay"`. `ac-review-first`'s switch has `disabled` and `aria-describedby` pointing to the reason.

### L2: The On/Off buttons on Settings › Messages don't say which message they switch

- **Screens:** `set-msg-list` and its situations (all sizes).
- **What happens:** every row's on/off control is a button whose whole name is "On" or "Off". The Edit buttons beside them are named in full ("Edit the wording of Review request"), but the switches aren't. A screen-reader user tabbing down the list hears "Off, toggle button" with no message name.
- **Why it matters:** this page holds 25 or more of them. Jack (or a manager) using a screen reader can't tell which one is Review request.
- **Fix, no choice:** name each switch with its message, for example "Review request: Off". This follows Account 8's "On/Off controls … are named switches" on the customer's side, and the Edit buttons on this same page.
- **Decision it touches:** Account 8 (H2), the same rule on the customer's page.
- **Second check:** KEPT. The Review request row's button has no `aria-label` and its text is "Off". The earlier walks and the setup UI audit checked that On/Off carry a tick and a word, not the name. This is wider than this story (every row on the page), so it's one fix in the shared row.

### L3: After Save, the list still says "Off"

- **Screens:** `ac-review-first` → Save → `set-msg-list` (all sizes).
- **What happens:** Save goes back to the list as drawn, where Review request still reads "Off" and the summary still says "25 on".
- **Why it matters:** Jack can't see that it worked. In a walk-through it looks like the save failed.
- **Fix, no choice:** the mockup's Save carries a note: "Review request is now On". The mockup already has `go(id, note)`. No drawing is needed.
- **Second check:** KEPT. `links/j07.mjs` sends Save to `set-msg-list` with no note, and the board's row reads "Off".

## Decided, not raised again

- Review requests are off by default, everyone gets the same link (Google's rules), and only customers who said yes get one (Account 5, Account 8 H1). The box says all three.
- "Stop these: [link]" is always added and can't be taken off (Account 6 and 8). The box says so.
- Getting started step 8 ticks once Messages has been looked at (Owner setup 16). Setting up review requests isn't its own step.

## Persona and access checks

- **Jack Lewis:** the owner's checks are about reports, so they don't apply here. Once M1 is fixed, setting it up takes four clicks and one box with a live preview ("Thanks for coming to North Street Cycles, Maya…").
- **Fewest clicks:** the review box opens straight from the row's Edit. Nothing to save twice.
- **Screen reader:** the box's switch carries its reason through `aria-describedby`. The list's switches have no names (L2).
- **Low vision:** the box is 13px or larger on a phone. At desktop and tablet the 11–12px text is the sidebar and the closed Settings rows behind the box.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | set-msg-list, set-msg-edit, ac-messages, ac-review-setting, ac-review-first | Review request's Edit opens "Bike ready"; the review box can't be reached | No |
| L1 | set-msg-list, ac-messages | The row's Off can be pressed before a review page exists | No |
| L2 | set-msg-list | On/Off switches have no message name | No |
| L3 | ac-review-first, set-msg-list | After Save the row still reads Off | No |

## Questions for Jack

None. Every fix follows a recorded decision or a pattern already drawn.

## Verification

- **Walked:** `fr-today` → `set-msg-list` → (Edit) → `set-msg-edit`, and `ac-messages` → `ac-review-setting`/`ac-review-first` → Save → `set-msg-list`, at desktop, tablet and phone. A scratchpad script listed each screen's text, every control with its target, the switches' markup, and text under 14px, then compared targets across the three sizes.
- **Also read:** `mockup/links/j07.mjs` and `j08.mjs`, `controls.mjs`, `stories.mjs` story 4, `consolidate/j07.mjs` (the `ac-review-setting` and `set-msg-list` lines), `../setup-ui-audit.md` (On/Off), walk-2 story 12 M2 (message wording, answered by build-plan Q9).
- **Decisions read:** Account, history and reminders (2, 5, 6, 8 and later changes), Owner setup (16 and the 1 Oct later change), the build-plan questions (Q9), the third walk's answers.
- **Not checked:** the mockup rendered in a browser. What happens to review requests while the shop is still running alongside Citrus Lime (a `set-msg-list` line says "none sent until switch-over", so it isn't a gap).
