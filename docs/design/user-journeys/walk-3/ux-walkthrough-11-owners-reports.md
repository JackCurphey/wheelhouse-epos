# UX walk-through 11, third walk: the owner's reports, clicked

Issue #116 step 6, 3 Oct 2026. Walked on the clickable mockup (https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi, built in `generator/out-mockup/`). I followed story 11's steps in `generator/mockup/stories.mjs` through the real drawings and link targets, as Jack Lewis (Owner) at desktop and then at tablet and phone, with Jo Taylor at the end. Walk 2's findings that Jack answered (`../walk-2/ux-walkthrough-11-owners-reports.md`: "takings" has one meaning, labour is left out of margin, the strip follows the shop menu) aren't raised again.

## The story, as the mockup runs it

1. Jack Lewis is on Bolton's Today (`op-today`). He opens the shop menu and chooses All shops (`ms-switch-open` → `ms-today-all`).
2. He goes to Reports (`rp-home`), then Margin and stock value (`rp-margin`), then back to All reports.
3. He opens Sales, then Change what's shown, then Show report (`rp-sales` → `rp-change` → `rp-changed`).
4. He opens Takings and cash-ups and a closed day (`rp-takings` → `rp-day`), then the Activity log (`ops-log`).
5. In Settings he goes to Office, then Staff and roles, then Jo (`set-till-quick` → `set-shop-details` → `set-staff` → `set-staff-person`). Jo then opens Reports, then Sales (`rp-home-staff` → `rp-sales`).

## Clicks and screens

| Size | Clicks | Screens | Notes |
|---|---|---|---|
| Desktop | 18, plus the switch | 16 | Every named button leads on |
| Tablet | 18 | 16 | Step 1: the tablet sidebar has no shop chooser (already in `mockup-gaps.md`) |
| Phone | more than 18: the menu adds a tap each time (not counted exactly) | 17 (adds the phone menu) | Five steps are already listed in `mockup-gaps.md`: no Office room in the phone menu (Reports, Settings, twice), no room tabs on the phone Settings page, no All reports on the day sheet, no Open on the People list. Not raised again |

The owner's two persona checks, as clicked:

- **The overview, split by shop, with no clicks.** It fails in the mockup (H1).
- **Margin breakdown in one step.** Margin is one click from Reports, but only for Bolton. Margin by shop can't be clicked (L1).

## Findings

### H1: Jack Lewis chooses All shops, opens Reports, and gets Bolton

- **Screens:** `ms-today-all` → `rp-home` (all sizes).
- **What happens:** On `ms-today-all` the shop menu reads "Shop: All shops". Clicking Reports opens `rp-home`, which says "Thursday 17 September · North Street Cycles, Bolton · use the shop menu for another shop or all shops". Its strip shows one row, "Shop North Street Cycles, Bolton ›". `rp-home` has no All shops drawing among its situations (staff, the saved-report menu, deleted, and the two oversight ones).
- **Why it matters:** This is the owner's first check, and the reason the strip was added. Jack decided the strip follows the shop menu, with "a row for each shop" on All shops (Reports, 3 Oct). In the mockup the owner does exactly that and the page forgets his choice. It also breaks "every page says which shop it is showing" (Multiple sites 1). Clicking shows this; the canvas couldn't.
- **Fix, no choice:** draw `rp-home`'s All shops situation. That's the decided strip with a row for Bolton and one for [Second site]: takings, margin, and the link. Point Reports to it from an All shops page. The line already exists ("All shops in the shop menu: the strip has a row for each shop", `consolidate/j17.mjs` line 50). Draw it because the strip's layout changes from one row to several. Its period and its link are still open (questions 1 and 2).
- **Decision it touches:** Reports and accounts, 3 Oct (question 1; the strip and the shop menu); Multiple sites 1.
- **Second check:** KEPT, and High is right: the story's main check fails at the step it exists for. `ms-today-all`'s Reports link has `data-go="rp-home"`, and `rp-home`'s text is as quoted. The manifest's situations for `rp-home` are `rp-home-staff`, `rp-report-menu`, `rp-report-deleted`, `ops-reports-home`, `ops-reports-staff`. Drawing a decided state is "build exactly what the decisions show", not a design change.

### M1: The period choice "Today" on every report opens the Today page

- **Screens:** `rp-sales`, `rp-margin`, `rp-takings`, `rp-day`, `rp-change`, `rp-workshop`, `rp-discounts`, `rp-c2w`, `ops-log` and their situations (desktop, tablet, phone).
- **What happens:** In the row "Today · This week · This month · Last month · Last 12 months · Pick dates", every choice stays on the report except "Today". "Today" is a radio button with `aria-checked`, but it opens `op-today`, the shop's Today page. The mockup mixes it up with the sidebar's Today. It happens on 20 report drawings and 4 Activity log drawings, at all three sizes.
- **Why it matters:** The owner reads reports "all the time". Choosing today's figures throws him out of Reports. In a walk with Jack it looks like the design does that.
- **Fix, no choice:** in the mockup's link rules, a radio, tab or switch stays on the page before any label match. Today, `controls.mjs` checks the journey's `*` map and the shared labels first. This is a mockup fix only.
- **Decision it touches:** none.
- **Second check:** KEPT. A scan of all `data/*.json` for selector controls that navigate finds "Today → op-today" on the radio in each report listed. The same scan finds the diary's "Week"/"Day" (deliberate: they switch views), and "Messages" on the customer page, which is walk-through 9 L2.

### M2: Clicking Wed 16 Sep · B1 opens Till B2's report

- **Screens:** `rp-takings` → `rp-day` (all sizes).
- **What happens:** All four closed-day rows ("Wed 16 Sep · B2 ›", "Wed 16 Sep · B1 ›", "Tue 15 Sep · B1 ›", "Mon 14 Sep · B1 ›") open the one drawing, `rp-day`. It is headed "Wed 16 September · Till B2". The story clicks B1.
- **Why it matters:** The owner's third check is that the figures match. He clicks one till's row and reads another till's report.
- **Fix, no choice:** story 11 clicks "Wed 16 Sep · B2 ›", the row the drawing shows. The other rows say "showing Till B2's report" in the mockup note. This is a mockup change only.
- **Decision it touches:** none.
- **Second check:** KEPT. All four rows have `data-go="rp-day"`, and `rp-day` begins "Wed 16 September · Till B2".

### M3: Jo, given "Can see reports", opens Sales and sees the owner's page

- **Screens:** `rp-home-staff` → `rp-sales`, then `rp-change` (all sizes).
- **What happens:** Jo's Reports page (`rp-home-staff`) is drawn for Staff: no Margin, VAT or Activity log. Clicking Sales opens `rp-sales`, whose sidebar reads "Jack Lewis · Owner" with Reports, Website and Settings. Its "Change what's shown" offers "Margin" as a measure, though Jo's "Can see costs and margin" is Off on `set-staff-person`. No Staff drawing of Sales exists. `rp-discounts-staff` does exist for Discounts.
- **Why it matters:** The last step of the story checks what Jo sees. The mockup shows her the owner's page, including a way to margin, which Reports 5 says she can't have.
- **Fix, no choice:** in the mockup, a note "Showing the owner's Sales: Jo sees the same report without Margin in Change what's shown". The `rp-home` line "Staff with Can see reports, without Can see costs and margin: no margin figure in the strip" already covers the rule. This is a mockup note; no drawing.
- **Decision it touches:** Reports and accounts 5.
- **Second check:** KEPT. The text of `rp-sales` begins "… JL Jack Lewis Owner …". `rp-change` lists Measure "Margin". The manifest has no `rp-sales-staff`.

### L1: "Show report" always shows the saved Accessories report, whatever was chosen

On `rp-change`, choosing Measure "Margin" and Split by "Shop" changes nothing (each choice stays). "Show report" then opens `rp-changed`, "Sales: items sold by product · Accessories only". The owner's margin-by-shop question can't be clicked. The decided answer is a line: "Margin and stock value for all shops: a shop column" (Reports 8). **Fix, no choice:** the mockup note on `rp-changed` says "showing an example changed report". **Second check:** KEPT. "Show report" has `data-go="rp-changed"` and the `rp-changed` text is as quoted. Margin by shop is settled by Reports 8, so this finding is only about the mockup.

### L2: Jack Lewis's Staff and roles page is drawn from a manager's view

`set-staff`, opened by the owner in this story, reads "M [Manager] · you · Manager … JL Jack Lewis · Owner". The person using the page is the [Manager], not Jack Lewis. **Fix, no choice:** the story says "as the [Manager]" here, or the mockup notes it. The page is the same for the owner apart from "· you". **Second check:** KEPT. Text as quoted on `set-staff` and `set-staff-person`.

### L3: The same "Book in" on Today goes to two different places

On Bolton's Today (`op-today`), "Book in" on WH-1042 opens the job page's book-in (`job-book-in`). On the same Today with the shop menu open (`ms-switch-open`), the same button opens the till's book-in pop-up (`till-book-in`). **Fix, no choice:** both open `job-book-in`. The till's book-in is for the till (walk-through 8 decision 8). This is a mockup link. **Second check:** KEPT. `op-today` has `data-go="job-book-in"` and `ms-switch-open` has `data-go="till-book-in"`.

## Decided, not drawn yet (not counted)

- The strip's row per shop on All shops (H1 asks for it to be drawn).
- "Margin and stock value for all shops: a shop column" (Reports 8, L1).
- "Give a new PIN" from a manager's phone on `set-staff-person` (Signing in, 3 Oct). The person page still shows only "Clear a forgotten PIN".

These were already drawn and match Jack's answers when clicked: "Closed days' takings" on `rp-takings`, "Takings" and "Online money is not in this till's takings" on the end-of-day report, "Labour £[£] · not in margin. Margin is on goods only." on `rp-margin`, and "Takings so far" on Today for All shops.

## Persona and access checks

- **Owner, desktop:** Reports, then Margin, is 1 click. Margin by shop can't be clicked (L1), and All shops is lost (H1).
- **Owner, phone:** reports work, but five of the story's steps have no button at phone size. They're already in `mockup-gaps.md`, and the owner's device is still "not known" (`personas.md`).
- **[Manager] at two shops:** not walked separately. They'd see the same H1.
- **Low vision, phone:** the report card descriptions and the strip's labels ("Takings", "Margin") are 13px. The margin table's headings are 12px, and its "[n]%" is 11px.
- **Screen reader:** the period choices are a radio group (M1 is only the mockup's link). The report cards are links.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | ms-today-all, rp-home | All shops, then Reports, opens Bolton; the decided per-shop strip isn't drawn | No (questions 1 and 2 are the strip's open details) |
| M1 | every report, ops-log | The "Today" period opens the Today page | No |
| M2 | rp-takings, rp-day | Till B1's row opens Till B2's report | No |
| M3 | rp-sales, rp-change | Jo gets the owner's Sales, with Margin offered | No |
| L1 | rp-change, rp-changed | Show report ignores the choices | No |
| L2 | set-staff | The owner's page is drawn as "[Manager] · you" | No |
| L3 | op-today, ms-switch-open | Book in goes to two places | No |

## Questions for Jack

The Reports decision file (3 Oct, "the strip and the shop menu") says two of the strip's details are "still open, and bracketed on the drawing". Drawing H1 needs both.

1. **What period should the strip at the top of Reports show?**
   1. **This week so far, the same as every report opens on ("So far: Mon 14 – Thu 17 September").** Good for: the strip agrees with the report one click away, so the figures match (the owner's third check). Costs: it isn't the same as Today's "Takings so far", which is today only.
   2. **Today only.** Good for: it matches Today's All shops row. Costs: no report opens on today, so the strip and the report below it disagree.
   3. **This month so far.** Good for: a steadier picture for an owner. Costs: it matches nothing else on screen, and is one more period to explain.

   Recommend 1.

2. **What should clicking a shop's name in the strip open?**
   1. **That shop's Sales report, with the shop menu switched to it.** This is what the mockup does now. Good for: one click from the overview to the detail, and the menu still says which shop you're looking at. Costs: someone who wanted that shop's Today has to click Today too.
   2. **That shop's Today (the whole app switches to it).** Good for: the same as "Work in [Second site]" on Today's All shops. Costs: it leaves Reports, so the owner loses his place.
   3. **Nothing: the strip is figures only, and the shop menu does the switching.** Good for: nothing new to build. Costs: the "link to each shop" in Jack's answer to question 1 goes, and it's one more click.

   Recommend 1.

## Verification

- **Walked:** every step of story 11 at desktop, tablet and phone, with scratchpad `walk-9-12.mjs` (each screen's text, every control and its target, text under 14px). A scan of every `data/*.json` for selector controls (radio, tab, switch, pressed) that lead to another screen.
- **Screens read in full:** `op-today`, `ms-switch-open`, `ms-today-all`, `rp-home`, `rp-home-staff`, `rp-margin`, `rp-sales`, `rp-change`, `rp-changed`, `rp-takings`, `rp-day`, `ops-log`, `set-till-quick`, `set-shop-details`, `set-staff`, `set-staff-person`.
- **Also read:** `consolidate/j17.mjs` (situations and lines), `mockup/controls.mjs` (link order), `mockup-gaps.md`.
- **Decisions read:** Reports and accounts with every 3 Oct later change; Multiple sites 1; the second walk's answers; Signing in (3 Oct later change).
- **Not checked:** anything rendered in a browser; the [Manager]'s walk on its own; what each figure would be (all are placeholders).
