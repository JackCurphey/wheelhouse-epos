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

The big user-journeys canvas is **three canvases** (a canvas holds at most
512 files): customers split off on 1 Oct (Buy online decision 10), and the
staff app split into shop floor and back office on 3 Oct (Jack: "1"). Each
has the whole overview, desktop only, and links to the others:
- **The staff app: shop floor** (journeys A, 10, 11, 12, 15, 16, 21), the
  link Jack has shared "anyone with the link":
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j (`out/`, `live-canvas.json`)
- **The staff app: back office** (journeys 8, 9, 13, 14, 17, 18, 19, 20),
  private until Jack shares it: https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4
  (`out-backoffice/`, `live-canvas-backoffice.json`)
- **Customers and the website** (journeys B and 1–7), private until Jack
  shares it: https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh
  (`out-customers/`, `live-canvas-customers.json`)

`build.mjs`'s `PARTS` says which journeys go where; a new journey must be
added to one of them (the build stops if it isn't). Publish each part from
its own folder; `removed.json` in each lists boards to send as null.

Approved and in the big canvas as **Designed**, each with its own canvas
holding desktop, tablet and phone:

| Journey | Own canvas | Decisions |
|---|---|---|
| 12 Workshop day | https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U | `docs/decisions/2026-09-27-workshop-day-review.md` (69) |
| A App map and navigation | https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA | `docs/decisions/2026-09-29-app-map-review.md` (15) |
| B Signing in and access | https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe | `docs/decisions/2026-09-29-signing-in-review.md` (10) |
| 11 Selling at the till | https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG | `docs/decisions/2026-09-29-selling-at-the-till-review.md` (16) |
| 16 End-of-day cash-up | https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE | `docs/decisions/2026-09-29-cash-up-review.md` (8) |
| 8 Owner setup | https://claude.ai/artifact/EN9dy5TkNzuwJcUCSpLW1B | `docs/decisions/2026-09-30-owner-setup-review.md` (23) |
| 15 Customer service | https://claude.ai/artifact/LbStDU6XExLrd7FNd2zEox | `docs/decisions/2026-09-30-customer-service-review.md` (14) |
| 10 Opening the shop | https://claude.ai/artifact/E9XTaKJys2WH3gpgwfPJbq | `docs/decisions/2026-09-30-opening-the-shop-review.md` (8) |
| 9 Moving from Citrus Lime | https://claude.ai/artifact/Wkp23VuCPRydTjfYmJgKo9 | `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` (9) |
| 5 Collect the bike and pay | https://claude.ai/artifact/LdnE9ayZJ1L2qu6suqcC2W | `docs/decisions/2026-09-30-collect-and-pay-review.md` (6) |
| 13 Receiving stock and purchase orders | https://claude.ai/artifact/RsbUcYNz9QfEF8LAbxSKwo | `docs/decisions/2026-09-30-receiving-stock-review.md` (11) |
| 14 Stock take and stock control | https://claude.ai/artifact/7oZPudk8GGxqY9L1iXBvbV | `docs/decisions/2026-10-01-stock-control-review.md` (12) |
| 3 Book a repair | https://claude.ai/artifact/KxkLMpRgFk23oeFJdfuq95 | `docs/decisions/2026-10-01-book-a-repair-review.md` (13) |
| 4 Drop off and approve the quote | https://claude.ai/artifact/XWm8FSLNSWC4de3vcCAKWC | `docs/decisions/2026-10-01-drop-off-and-quote-review.md` (8) |
| 7 Account, history and reminders | https://claude.ai/artifact/Hoz1q28Frh9M7hNgV2bo3b | `docs/decisions/2026-10-01-account-and-reminders-review.md` (9) |
| 19 Multiple sites | https://claude.ai/artifact/LXYUo9UQymsN2VyNSynAcB | `docs/decisions/2026-10-01-multiple-sites-review.md` (12) |
| 17 Reports and accounts | https://claude.ai/artifact/NXHvoKd8wY8wpAhBYsPRUt | `docs/decisions/2026-10-01-reports-and-accounts-review.md` (9) |
| 2 Buy online / click and collect | https://claude.ai/artifact/QGRBBPUhHRd5rg94XbgAyS | `docs/decisions/2026-10-01-buy-online-review.md` (10) |
| 1 Find the shop and browse the website | https://claude.ai/artifact/7g2TbX8jMauaaTqSkvj5CQ | `docs/decisions/2026-10-02-find-the-shop-review.md` (8) |
| 18 Website management | https://claude.ai/artifact/RkyxcQZBCaVYfUa8bqixZM | `docs/decisions/2026-10-02-website-management-review.md` (13) |
| 20 Management oversight | https://claude.ai/artifact/XLYiuhFS1WVjS9ohF7G7gf | `docs/decisions/2026-10-02-management-oversight-review.md` (7) |
| 6 Cycle to Work | https://claude.ai/artifact/6NR9hm3Gnc3kX1i57xcRgt | `docs/decisions/2026-10-02-cycle-to-work-review.md` (8) |
| 21 Lightspeed shops | https://claude.ai/artifact/2qnzyGx8enhxbVN17Brpnf | `docs/decisions/2026-10-02-lightspeed-shops-review.md` (13) |

UI audits: `workshop-day-ui-audit.md`, `app-map-ui-audit.md`,
`signin-ui-audit.md`, `till-ui-audit.md`, `cashup-ui-audit.md`,
`setup-ui-audit.md`, `customer-ui-audit.md`, `opening-ui-audit.md`,
`moving-ui-audit.md`, `collect-ui-audit.md`, `receiving-ui-audit.md`,
`stock-ui-audit.md`, `book-ui-audit.md`, `quote-ui-audit.md`,
`account-ui-audit.md`, `sites-ui-audit.md`, `reports-ui-audit.md`, `online-ui-audit.md`,
`browse-ui-audit.md`, `website-ui-audit.md`, `oversight-ui-audit.md`, `c2w-ui-audit.md`, `lightspeed-ui-audit.md`, `leftover-ui-audit.md` (this folder).

Overview count (each screen once): 823 screens — 820 designed, 0 built, 2
old app only, 1 not designed yet, 0 for review; the staff app canvas holds
497 files and customers and the website 330, of 512 each (2 Oct: all seven UX
walk-throughs (the repair, a shop day, stock, a new shop, Cycle to Work, a Lightspeed repair, two shops) done and every fix drawn — see
`ux-walkthrough-1-repair.md`, `docs/decisions/2026-10-02-ux-walkthrough.md`
and the reusable `ux-walkthrough-script.md` for Jack and Mark. The staff canvas is 15 files from its 512 limit: the next additions need it split, ask Jack how) (2 Oct: the
leftover screens drawn and their UI audit's fixes made — the receipt email
(with and without a customer, a VAT invoice, a till sale), a text receipt
and the till's "email the receipt" pop-up with its states in journey 5, the
till start-up line on the PIN screen in journey B, the Returning customers
report in journey 17, and a company's VAT number and "Send invoices to" in
journey 15; see `docs/decisions/2026-10-02-leftover-screens-review.md` and
`leftover-ui-audit.md`. The VAT invoice stays a general one for now,
and the text receipt page keeps its barcode for showing at the counter
(Jack, 2 Oct). The 3 screens left
are journey 13's supplier screens, deferred to a later release (below).
Earlier, journey 21: a "Lightspeed shop" switch (`shop-mode.mjs`,
`withLightspeedShop`) draws the sidebar, Settings, Today, Messages and the
website header for a shop that keeps Lightspeed as its till; it changes no
other journey's boards. Open from journey 21: what Lightspeed's account
actually allows is unverified until there's a test account (LS-01–09, plus
seeing payment); the website editor without selling pages, the Customers
page's Lightspeed link and a Diary marker for jobs waiting on Lightspeed are
not drawn. Earlier, from journey 6: a held bike in the till's search and as
sold out online not drawn; the owner's tablet rail is full. Earlier still:
how long records are kept (LEG-05); Shopify-only products and custom web
addresses (ECOM-03, frozen)).

**Next: ask Jack.** All seven UX walk-throughs are done and every fix is
drawn (`docs/decisions/2026-10-02-ux-walkthrough.md`). Jack will run more
walk-throughs with Mark using `ux-walkthrough-script.md`. The step after
that is a clickable prototype to test with real customers. Before shipping:
remind Jack about the Doom easter egg. Everything is published, on three big canvases
(198, 305 and 332 files of 512).

**Planned: one UX audit at the end** (Jack, 1 Oct: "i guess we can just do a
ux audit at the end when all the pages are done?"). Each journey keeps its own
UI audit; once every journey is drawn, one UX walk-through follows whole
stories across journeys (for example book → drop off and approve the quote →
collect and pay) and different kinds of people, looking for gaps at the
hand-offs. Testing with real customers on a clickable prototype is the step
after that.

**Later release: the supplier screens** (Jack, 2 Oct): Suppliers,
Supplier catalogue (browsing Madison, ZyroFisher and Raleigh) and Send the
order stay in journey 13's "not designed" cards until a later release — see
the later change at the end of the receiving-stock decisions.

**Name idea: "WIZ" for integrations** (Jack, 2 Oct: "calling all the
integration stuff with suppliers and whatnot 'WIZ' which is a play on having
things called wizards in software and 'Wheelhouse Integration Zone'. Not
something we have to do now"). A possible name for the area that connects
Wheelhouse to suppliers and other systems (supplier feeds, Lightspeed,
Shopify, accounts software). Not adopted yet; raise it when integrations are
designed.

**Remind Jack before we ship: a Doom mod easter egg** (Jack, 2 Oct: "i
want a doom mod. we dont need to build this at all now, but its an easter
egg i want you to remind me of before we ship"). Not designed or built;
raise it in any pre-launch checklist.

**Noted for later: a Cycle to Work page on the website** (Jack, 2 Oct:
"but i would also like to remember 2 for the future", journey 6 decision 6).
Customers ask for a Cycle to Work quote online — pick a bike and their scheme
provider — and the request starts the Cycle to Work order for staff to check
the bike and size before the quote goes. Touches journeys 1 (the website) and
6.

**Noted for later: customer orders** (Jack, 1 Oct: "one thing as well i dont
think we have solved is how to do customer orders, say we just order in a part
for a customer for them to collect, not something we have to figure out now,
just at some point"). A part ordered in for a customer to collect, outside a
workshop job, isn't designed anywhere yet (checked journeys, decisions and
specs on 1 Oct). It touches journey 13 (ordering and receiving), journey 11
(the till and any deposit) and journey 2 (click and collect).

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
or a phone-only screen's only size — with an "Other sizes, on its own canvas ↗" link to its
journey's canvas. 452 files now. A publish carries at most 255 files: split
big changes (changed boards with `canvas.json` first, removals second).

## Gotchas that cost time

- **The Settings frame is shared.** `settings-frame.mjs` (journey 8) draws
  Settings at every size and also journey 12's `diary-settings` boards, so
  it and `diary.mjs` import each other; `diary-settings` is built by getters
  to dodge the start-up order. Change the frame → rebuild and diff journey 12.
- **Journey 15's boards build on demand** (getters): `diary.mjs` uses its
  customer page for journey 12's `customer` board, and the two import each
  other.
- **Exploration boards stay off the big canvas** via `explore` on a
  `SAND_SOURCES` entry in `build.mjs` (journey 8's layout options).

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

- Example-data overlap: the diary's example customers repeat across jobs, so
  journey 5's Today flag (WH-1050, Aisha Khan's Cannondale Quick, ready since
  Mon 14 Sep) sits beside WH-1047 (the same bike arriving) on journey 10's
  Today. Noted, not changed — the diary is approved.
- What Citrus Lime lets a shop export (files, formats, columns, reports) is
  still unchecked — journey 9 draws every file name, count and figure as a
  [placeholder], and decision 2's behind-the-scenes matching and decision
  9's "a week counts when all four match" both depend on it. Jack is best
  placed to check, from his shop's Citrus Lime admin (Release 2 design §4).
- WH-1045 Jamie Brooks is on Thursday 17 at 10:30 on the Workshop Overview
  and journey 10's Today, but the diary (`diary.mjs`, day 4) puts it on
  Friday 18 at 11:00. Found by journey 10's UI audit (L5); not changed,
  since journey 12 is approved — settle which is right with Jack.
- Design-wide, parked from journey 10's UI audit (L5): every pop-up's ✕ is
  a link rather than a button (`popup()` in settings-frame.mjs and
  cashup.mjs), and Today and Reports share the same sidebar icon.
- Journey 7 left for later: Release 1's message thread and update
  preferences in journey 4's "Also in this journey" are now covered by
  journey 7 (conversations, "How we contact you") — retire them when that
  row is next touched. The review-request wording ("And ask me for a review
  after I collect") is for the shop to check with its lawyer (journey 7
  audit H1). Today's "Needs a reply" and deletion lines, the deletion line on
  the customer page and the website request on Privacy requests are drawn on
  journey 7's canvas only; Customer service's and Opening the shop's own
  boards don't show them.
- Journey 19 left for later: Book a repair's own boards (journey 3) show a
  one-shop booking — the "Which shop?" step is drawn on journey 19's canvas
  only; Staff and roles' person boards (journey 8) don't show "Works at" —
  journey 19 draws it; the new-job form for another shop's workshop still
  shows Bolton's own mechanic and storage slot (the receiving shop sets
  those); the second shop has no real name, address or code ("[Second
  site]") — Jack can supply them.
- Journey 17 left for later: the VAT layout and the Xero account mapping are
  for the shop's accountant to confirm; the owner's Discounts and refunds
  table scrolls sideways on a phone (five columns); "Returning customers"
  (REP-10) is still to design; Opening the shop's own Today boards don't
  show the Xero line — journey 17 draws it; "Show graphs in reports" is in
  Your settings only for people who can see reports, so journey A's board
  (Jo Taylor, Staff) doesn't show it.
- Journey 2 left for later: the payment provider is still to choose (PAY-05)
  — the bank's check and "couldn't confirm" states are general card-payment
  practice, to confirm once it is chosen; delivery by post is not drawn —
  decision 9 lists the six places that assume collection; ordering in from
  the supplier (decision 2) starts customer orders, whose purchase order is
  journey 13; the "Show on website" switch on a single product is a line on
  Stock's product page, not yet an interactive board; autofill and linked
  hints on form boxes (`field()`'s `autocomplete`/`linked`) are only used by
  journey 2's boards.
- Maya Patel's example email differs: `maya@example.test` (diary.mjs,
  job-page.mjs, customer.mjs) vs `maya@example.com` (till.mjs, signin.mjs).
  Pick one and republish the approved boards that show it.

- Search products by measurements and specifications (bearing sizes,
  derailleur gears) — Jack's idea, 30 Sep; for journeys 13, 14 and search.
  Recorded in `docs/decisions/2026-09-30-owner-setup-review.md`.

- Card machine: which provider can take amounts from the till, and card
  payments when the internet is down (till 6 — supersedes the offline spec's
  standalone-machine line).
- Done 30 Sep: journey 5 provides the job link journey 8 decision 23 sends
  in "Bike ready" (one job's summary, no sign-in). Parked:
  unselected-pill border contrast 1.31:1 — a design-wide token fix for the
  Soft sand switch (journey 8 audit M6).
- Workshop day: multi-day jobs (52), mechanic sign-off (64), tap a phone
  number to see texts (49); customer spending limit on `/book` (41).
- Switch the app's tokens from Fjell to Soft sand, then build Workshop day
  (STATUS "Next").
