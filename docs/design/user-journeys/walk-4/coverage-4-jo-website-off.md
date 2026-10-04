# Coverage cell 4: Find the shop × Jo Taylor, the switched-off website as staff see it (clicked on the mockup)

Stage W coverage check (`../coverage-check.md`, "Empty cells", cell 4), walked 4 Oct 2026. I used the method in `../ux-walkthrough-script.md` and Jo's checks in `../personas.md` (shop words, not computer words; obvious how to undo a mistake; works while she's on the phone), with issue #116's three changes: fewer steps rather than more drawings, screens counted as well as clicks, and the joins clicked through the mockup at desktop, tablet and phone. The mockup was rebuilt first (763 screens, 0 dead links). Targets below are the `data-go` / `data-act` values in `generator/out-mockup/data/*.json`, read with a scratchpad script. Nothing was saved to the repo.

Kept screen walked: `wb-off-preview` ("Switched off: what the shop's own staff see"), with its situations `wb-off-preview-ask` (staff without "Can edit the website"), `wb-off-preview-product` and `wb-turned-on`. The public's page, `wb-off` ("This website isn't available"), I read for the promise the banner makes.

## The story, as the mockup clicks it

Story 4, before Jack Lewis turns the website on:

1. Jo has signed in for the first time and has her till PIN (`pin-first` → `till-sale`). Jack is still setting up, and the shop is moving from Citrus Lime (`ws-page-moving`: "Turn it on waits" until switch-over morning).
2. Jo opens the shop's website address. She has no "Can edit the website", so she sees `wb-off-preview-ask`: "Only your staff can see this. Your website is switched off — customers see 'This website isn't available'. Ask Jack Lewis to turn it on." with "Back to Wheelhouse".
3. She looks at a page or two, then presses "Back to Wheelhouse".

## Clicks and screens

| Size | Clicks | Screens | Notes |
|---|---|---|---|
| Desktop | 1 (Back to Wheelhouse), plus typing the address | 2 (`wb-off-preview-ask`, then where Back goes) | No button in the mockup opens the switched-off website (M1); Back opens the owner's Website page (L1) |
| Tablet | 1 | 2 | The same banner and button |
| Phone | 1 | 2 | The website's menu button opens the staff app's menu (L2) |

Fewer steps: for Jo it's zero clicks to see the banner and one to leave. Nothing to drop. `wb-off-preview-ask` is a separate drawing that differs from `wb-off-preview` by one sentence and two missing buttons. That was decided as "a new screen" (Find the shop, later change 2 Oct), so I didn't propose folding it into a line. H1's fix below is a line, not a drawing.

## High

### H1: During a move from Citrus Lime, the staff banner still says to turn the website on

- **Screens:** `wb-off-preview-ask` (Jo), `wb-off-preview` and `wb-off-preview-product` (the owner, "Turn it on" → `wb-turned-on`), all sizes; against `ws-page-moving`.
- **What happens:** in story 4 the shop is moving from Citrus Lime. The Website page says so (`ws-page-moving`): "Your website goes on during switch-over morning, from the switch-over checklist. Until then Citrus Lime's website keeps selling, so no order or booking reaches a shop that's still running on Citrus Lime". Its "Turn it on" is greyed out (`aria-disabled="true"`, "It goes on during switch-over morning"). The staff banner on the website itself has no moving version:
  - Jo's banner says "Ask Jack Lewis to turn it on."
  - Jack's banner (`wb-off-preview`) has a working "Turn it on", which goes to `wb-turned-on`: "Your website is on. Customers can see it now."

  None of `wb-off-preview`'s three situation lines mentions a move.
- **Why it matters:** Jo is told the next step is to get Jack to turn it on. That's the opposite of the move's rule, and it's the kind of thing she'd pass on to a customer on the phone. If Jack presses the banner's own "Turn it on", the promise on his Website page breaks: orders and bookings could reach Wheelhouse while the shop still runs on Citrus Lime.
- **Fix, no choice:** a situation line on `wb-off-preview`, following `ws-page-moving`: "While moving from Citrus Lime: the banner reads 'Your website goes on during switch-over morning'; no 'Turn it on' (owner) and no 'Ask Jack Lewis to turn it on' (staff)". It's a line, not a drawing. The wording is the moving Website page's own.
- **Decision it touches:** walk-through 4 H2 (`2026-10-02-ux-walkthrough.md`: "the website goes on as a step on switch-over morning", with moving versions of the Website page, editor, payments and address, but not this banner); Moving from Citrus Lime, later change 3 Oct; Find the shop M14 and its 2 Oct later change. Followed, not reopened.
- **Second check:** KEPT, and High is right: a working button breaks a promise about orders and bookings, written on the page next door. `ws-page-moving` has `<button aria-disabled="true" title="It goes on during switch-over morning" …>Turn it on`. `wb-off-preview`'s "Turn it on" → `wb-turned-on` at all sizes. The situation lines for `wb-off-preview` are only the product-page banner, the "Ask Jack Lewis" banner and "Turned on". A search of `consolidate/*.mjs` for "banner" finds no moving line for the website, and walk-through 4 H2's list of moving screens doesn't name `wb-off-preview`. Walk 2 skipped `wb-off-preview` as staff (`walk-2/ux-walkthrough-12-maya-twice.md` line 228), and walk 3 didn't visit it.

## Medium

### M1: Nothing in the mockup opens the switched-off website as staff see it; the owner's own address opens the customer page instead

- **Screens:** `ws-page`, `ws-page-moving` → `wb-home` (desktop, tablet, phone); `wb-off-preview`, `wb-off-preview-ask`.
- **What happens:** an incoming-link scan of all 69 data files finds no button leading to `wb-off-preview-ask` or `wb-off-preview-product`. The only way into `wb-off-preview` is "Turn off" on `wb-turned-on`, which is already inside it. On the Website page while it's off ("Your website is off · Only your staff can see it. Customers will find it at [shop-name].wheelhouseepos.com"), the address link opens `wb-home`, the customer home page, with no staff banner. So clicked, the owner checks his switched-off website and sees it looking live.
- **Why it matters:** this cell's story can only be reached through the situation picker. The owner's own route shows the opposite of what the page beside it says ("Only your staff can see it"). Jo has no Website room (Staff), so for her the only way in is the address itself. That's fine in the real app, but a walk with Jack can't show it.
- **Fix, no choice:** in the mockup, the address link on `ws-page` and `ws-page-moving` (website off) opens `wb-off-preview`. On `ws-page-on` it keeps opening `wb-home`. For Jo, story 4 gets a step "(Jo opens the website's address)" → `wb-off-preview-ask`, the way story 8 bridges a typed PIN. These are mockup links and a story step.
- **Decision it touches:** Find the shop M14 (the banner shows on every page while it's off); Website 12. None reopened.
- **Second check:** KEPT. `ws-page` and `ws-page-moving`: `"[shop-name].wheelhouseepos.com" → wb-home`. `wb-home` has no "Only your staff can see this". The incoming scan: `wb-off-preview` ← `wb-turned-on` only; `wb-off-preview-ask` ← none.

## Low

### L1: "Back to Wheelhouse" takes Jo to the owner's Website page

- **Screens:** `wb-off-preview-ask` → `ws-page` (all sizes).
- **What happens:** Jo's banner has no buttons except "Back to Wheelhouse", which opens `ws-page`, Office › Website as the owner sees it (role Manager, "Turn it on"). Jo can't open the Website room. For staff without the right, the drawing `ws-no-access` ("Only some people can change the website … Back to Today") exists, and nothing links to it. Its own "Back to Today" opens the manager's `op-today`, not `op-today-staff`.
- **Why it matters:** one click from Jo's banner shows her a page she isn't allowed and a "Turn it on" button. Her check is that it's always obvious how to get back.
- **Fix, no choice:** in the mockup, "Back to Wheelhouse" on `wb-off-preview-ask` goes to Jo's own Today (`op-today-staff`), as `auth-noaccess`'s "Go to Today" does. `ws-no-access`'s "Back to Today" goes to `op-today-staff` too. These are mockup links.
- **Decision it touches:** none.
- **Second check:** KEPT. `links/j01.mjs` line 84 sends every "Back to Wheelhouse" in journey 1 to `ws-page`. Only `wb-turned-on` overrides it (line 121), and `-ask` doesn't. `ws-page`'s role is Manager. `links/j18.mjs` line 96: `'ws-no-access': { 'Back to Today': go('op-today') }`. `links/jb.mjs` line 22 uses `op-today-staff` for the same case.

### L2: On a phone, the switched-off website's menu button opens the staff app's menu

- **Screens:** `wb-off-preview`, `wb-off-preview-ask`, `wb-off-preview-product` → `staff-app-menu` (phone).
- **What happens:** these are website pages with the website's header, but their role is Staff. The shared rule ("Open menu" → `site-menu` for customers, `staff-app-menu` otherwise) opens the staff app's menu: "Jo Taylor · Staff", Front desk, Workshop, Stockroom, Office.
- **Why it matters:** Jo is checking what customers will see. One tap on the website's own menu drops her into the staff app.
- **Fix, no choice:** in `links/j01.mjs`, "Open menu" on the three `wb-off-preview` drawings goes to `site-menu`. This is a mockup link.
- **Decision it touches:** none.
- **Second check:** KEPT. All three at phone: `"Open menu" → staff-app-menu`. `links/shared.mjs` line 56 picks by `role`, and `wb-off-preview`'s role is Staff.

## Decided, not drawn yet (not counted)

- "Edit this page" on the owner's banner goes to the website editor, which is now later (Website, 3 Oct, issue #116 question 2: the first release edits words and photos from a list). That's the owner's path, not Jo's, so I didn't walk it. I'm noting it for whoever walks Jack Lewis on the website.

## Persona and access checks

- **Jo:** the banner is in shop words, names who to ask, and repeats exactly what customers see ("This website isn't available", the same words as `wb-off`). During a move it gives the wrong next step (H1). Leaving takes one click, to the wrong page (L1).
- **Saturday worker:** not walked. Whether someone checked in only by PIN on the till sees the staff banner or the public page isn't drawn or decided. Not checked; not raised.
- **Screen reader:** the banner starts with "Only your staff can see this." in `<strong>`, after a padlock icon (`aria-hidden`). It isn't marked as a region or status. Not checked in a real screen reader, so not raised.
- **Keyboard only:** the skip link comes first and every control is a link or button. Not checked: focus order through the banner.
- **Low vision:** the banner is at body size. Only the placeholder "LOGO" and the category counts (13px, "[n] products") are smaller.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | wb-off-preview, wb-off-preview-ask, ws-page-moving | During a move, the banner still says to turn the website on | No |
| M1 | ws-page, ws-page-moving, wb-off-preview(-ask) | No click opens the staff view of the switched-off website; the address opens the customer page | No |
| L1 | wb-off-preview-ask, ws-page, ws-no-access | "Back to Wheelhouse" opens the owner's Website page | No |
| L2 | wb-off-preview (phone) | The website's menu opens the staff app's menu | No |

## Questions for Jack

None. H1 follows walk-through 4 H2 and the moving Website page's own wording. The others are mockup links and a story step.

## Verification

- **Walked:** `wb-off-preview`, `wb-off-preview-ask`, `wb-off-preview-product` at desktop, tablet and phone; `wb-turned-on`, `wb-off`, `ws-page`, `ws-page-moving`, `ws-page-on`, `ws-no-access` at desktop (and `wb-off` at phone). I read text, every control with its resolved target, and the situation lines (`consolidate/j01.mjs` lines 33–37, `consolidate/j18.mjs`).
- **Mockup code read:** `controls.mjs` `resolve()`, `links/j01.mjs`, `links/j18.mjs`, `links/jb.mjs`, `links/shared.mjs`, `stories.mjs` story 4.
- **Incoming-link scan:** `wb-off-preview` ← `wb-turned-on` only; `wb-off-preview-ask`, `wb-off-preview-product`, `ws-no-access` ← none.
- **Decisions read:** Find the shop (decision 7 M13/M14, 8 and the 2 Oct later change); Website management (decisions 11–13 and every 3 Oct later change); Moving from Citrus Lime (3 Oct later change); `2026-10-02-ux-walkthrough.md` walk-through 4 section; the second and third walk decisions.
- **Not checked:** how the website knows a visitor is staff (an email sign-in in the same browser, or a till's PIN); rendering, focus order and a real screen reader.
