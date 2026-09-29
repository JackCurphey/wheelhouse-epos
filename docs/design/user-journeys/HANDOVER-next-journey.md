# Handover — designing the next journey (rewritten 29 Sep 2026, evening)

For the agent who picks up journey design in a fresh session. Read this
first, then the top of `.agents/STATUS.md`. Work is on branch
`feat/workshop-diary-design` — everything committed, **not pushed, no PR**
(ask Jack before pushing or opening one).

**Who you're working with.** Jack (not Mark — Mark wrote the global rules
file). Jack has little coding experience: plain English, **one question at a
time, as numbered options with concrete trade-offs and your recommendation**.
Record each decision in the journey's decision file the moment he makes it,
with his words where useful. He likes to *see* options drawn on a canvas
rather than described. Never declare work "done"; report status and let him
decide. No flattery.

## Where things stand

The big user-journeys canvas (every screen, by journey, status-coded; Jack
has shared it "anyone with the link"):
https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j

Approved and in the big canvas as **Designed**, each with its own canvas
holding desktop, tablet and phone:

| Journey | Own canvas | Decisions |
|---|---|---|
| 12 Workshop day | https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U | `docs/decisions/2026-09-27-workshop-day-review.md` (69) |
| A App map and navigation | https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA | `docs/decisions/2026-09-29-app-map-review.md` (15) |
| B Signing in and access | https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe | `docs/decisions/2026-09-29-signing-in-review.md` (10) |
| 11 Selling at the till | https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG | `docs/decisions/2026-09-29-selling-at-the-till-review.md` (16) |
| 16 End-of-day cash-up | https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE | `docs/decisions/2026-09-29-cash-up-review.md` (8) |

UI audits: `workshop-day-ui-audit.md`, `app-map-ui-audit.md`,
`signin-ui-audit.md`, `till-ui-audit.md`, `cashup-ui-audit.md` (this folder).

Overview count (each screen once): 253 screens — 146 designed, 6 built, 14
old app only, 87 not designed yet, 0 for review.

**Next: ask Jack which journey.** Still drawn in the old Fjell look or as
placeholders: 1 Find the shop / browse the website, 2 Buy online / click and
collect, 3 Book a repair, 4 Drop off and approve the quote, 5 Collect the
bike and pay, 6 Cycle to Work, 7 Account, history and reminders, 8 Owner setup
and onboarding, 9 Moving from Citrus Lime, 10 Opening the shop and checking
in, 13 Receiving stock and purchase orders, 14 Stock take and stock control,
15 Customer service, 17 Reports and accounts, 18 Website management, 19
Multiple sites, 20 Management oversight, 21 Lightspeed shops (Release 1).
Strong candidates, because finished journeys lean on them: **8 Owner setup**
(where the shop sets up everything the till assumes — quick buttons and
groups, discount/refund/paid-out reasons, "Other" ways to pay, account
limits, float, closing time, blind-count setting, staff and roles, clearing
a forgotten PIN), **15 Customer service** (the customer page — older sales
and refunds are found there, till decision 13), **10 Opening the shop**
(pairs with cash-up: float, who's in), **5 Collect the bike and pay** (much
now decided in journey 11: deposits on jobs, collected-when-paid).

## Rules that apply to every journey (Jack's decisions)

- **Look: "Soft sand, dark rail"**, sans-serif only — Public Sans, DM Mono for
  numbers and prices; charcoal sidebar; **amber only for "you are here"**;
  routine notices warm grey, real warnings keep the warning colour (till 12);
  destructive buttons outlined; thin borders, never a thick coloured left
  edge (Workshop day 45, 48, 53, 67). Tokens: `generator/ui.mjs`
  (`--theme sand`). The app code is still Fjell until switched (STATUS).
- **As few clicks as possible** (A6): look for the step to drop — hover to
  reveal, sensible defaults, one step not two, things that check themselves
  (a PIN on its 4th digit, a code on its 6th) — while keeping a clickable,
  keyboard and touch way.
- **Accessibility first** (Workshop day 57): ≥44px touch targets, ≥14px body,
  ≥12px labels, 4.5:1 contrast; colour-only status by default with a
  per-person "Show status symbols"; Reduce motion; Larger text; Folded sidebar.
  Personal settings live in **Your settings**, opened from your name (A8).
- **Interaction:** pop-ups in the middle, not side panels (15, 16); **safe
  choice on the left, confirming action on the right** in every pop-up (till
  12); one page with folding sections rather than separate pages (30); pills
  and branching pills instead of dropdowns for short choices, search boxes for
  long lists (62, 66); toggle pills for on/off (50); hover previews as an
  extra, with right-click / long-press kept (65).
- **Staff frame** (journey A): rooms in the sidebar; one search box on every
  staff page (A2); the Till page folds the sidebar to an icon rail that
  unfolds on a 300 ms rest (A4, A5); the till bar shows Online, **Past
  sales**, and "Serving: …" (switch who's serving by PIN).
- **Trust over lock-down** (Jack's stance): anyone can discount or void with a
  reason, recorded for managers (till 4, 10); no lockout after wrong PINs (B8).
- **Shops customise as much as practical**, especially the website (A10).
- **Process:** own canvas per journey; desktop first; iterate with Jack; UI
  audit (designer helper) → Jack picks fixes; tablet and phone; Jack
  approves; copy into the big canvas.

## How to build a journey (reuse this)

Generator: `docs/design/user-journeys/generator/`.

1. **Module** `<name>.mjs` — copy the shape of `cashup.mjs` or `till.mjs`:
   each screen is a recipe `def('id', () => markup)`; helpers read `CUR`
   (`desktop` / `tablet` / `phone`) so all three sizes come from one recipe;
   export `screens`, `TITLES`, `ROWS`. Reuse the approved frames:
   `app-map.mjs` (`tillBar`, `tillPhoneBar`, `foldedRail`, `siteDesktop`,
   `siteTablet`, `sitePhone`, `headerSearch`), `diary.mjs` (`shellDesktop`,
   `shellTablet`, `shellPhone` — the staff app, with search and the Your
   settings name button), `ui.mjs` (`button`, `field`, `card`, `badge`,
   `icon`). Export a helper from its module rather than copying it.
2. **Build** `build-<name>.mjs` — three lines calling `buildSandCanvas` from
   `sand-canvas.mjs`; add `out-<name>-sand/` to the generator's `.gitignore`.
   Run `node build-<name>.mjs --theme sand`.
3. **Check** `WH_THEME=sand node tools/shoot.mjs <name>.mjs <scratch-dir>` —
   PNGs plus overflow report; look at the PNGs yourself.
4. **Own canvas** — `Artifact` quickstart (intent `design`) → publish with the
   Design `type_url`, a title, `auto_open: "after_first_write"` → then publish
   the files. For updates: read the live `project/canvas.json`, then
   `node tools/stage.mjs <live canvas.json> out-<name>-sand/project <stage-dir> [changed files]`
   and publish its printed `files` map with `root` = the stage dir and
   `file_path` = its `project/canvas.json`.
5. **Copy into the big canvas** (after Jack approves): add the journey's
   source to `SAND_SOURCES` **and its canvas URL to `SAND_CANVAS`** in
   `build.mjs`; list its screens in `journeys.mjs` with a marker like `sd16()`
   (generate the rows from the module's `ROWS`/`TITLES`, as done for 11 and
   16); snapshot `out/`, run `node build.mjs` (its mismatch guard checks the
   screen list and rows against the journey's own canvas); publish only files
   that changed plus `null` for `out/removed.json`, then copy
   `out/project/canvas.json` to `live-canvas.json` and commit.

**The big canvas is desktop only** (cash-up decision 8): a canvas holds at
most 512 files, so each screen appears once — desktop, the one large app map,
or a phone-only screen's only size — with a "Tablet and phone ↗" link to its
journey's canvas. 257 files now. A publish carries at most 255 files: split
big changes (changed boards with `canvas.json` first, removals second).

## Gotchas that cost time

- **Check other journeys when you touch a shared frame.** `app-map.mjs` and
  `diary.mjs` shells feed several journeys. Before and after, build the
  others and `diff -r` their `out-*-sand` folders; approved boards should
  change only on purpose, and then republish them to their own canvas.
- **Fonts:** never put `&quot;` inside a `<style>` block (silently falls back
  to serif). Renders strip `<helmet>`; trust the `font` field, not the look
  of numbers — DM Mono sometimes falls back when the font download is slow.
- **macOS has no `timeout` command** — a command using it does nothing.
- **Artifact publishing:** read `project/canvas.json` right before any publish
  that sends it; the canvas editor re-saves the index when Jack has it open
  (same layout, different formatting — compare positions, not bytes). A
  removal refused as "not read" needs a `list` (scope `files`) first.
- **Example data:** only names, bikes, prices and jobs already in the
  generator (North Street Cycles, Bolton, Till B1, Jack Lewis Manager, Jo
  Taylor Staff, Alex Morgan Mechanic, Maya Patel with job WH-1042 — Trek
  Domane AL 3, Standard service £65, Shimano brake pads B05S-RX £28, Fit &
  adjust brakes £18, Replace gear cable £12, approved total £111). Everything
  else is a bracketed placeholder like `[£ total]`.
- **Helpers:** the `designer` agent (no Bash) does UI audits from PNGs well —
  give it the PNG folder, the source file, the decision files, and say which
  decisions not to relitigate. Check every finding yourself before bringing
  it to Jack; audits have reported things that weren't true.

## Open items carried forward

- Card machine: which provider can take amounts from the till, and card
  payments when the internet is down (till 6 — supersedes the offline spec's
  standalone-machine line).
- Settings designed nowhere yet (Owner setup, journey 8): quick buttons and
  groups, reasons, "Other" ways to pay, account limits, float, closing time,
  blind count on or off, till PIN clearing.
- Workshop day: multi-day jobs (52), mechanic sign-off (64), tap a phone
  number to see texts (49); customer spending limit on `/book` (41).
- Switch the app's tokens from Fjell to Soft sand, then build Workshop day
  (STATUS "Next").
