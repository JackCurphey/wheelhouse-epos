# Tasks

Nine pull requests. The first seven (1–5, 6a, 6b) need none of Mark's
unbuilt pieces and can be built now: 1 then 2, then 3, 4, 5 and 6 in any
order. Pull request 7 waits for WP-1.1 roles; pull request 8 waits for
WP-8.1's switch-over checklist. Sizes are estimates of changed
lines, tests included.

Every test is written first and watched failing for the right reason before
the code. While building, run only the related test files
(`node --test --test-force-exit tests/<a>.test.js …`; screen tests need
`npm run pretest`). Before each pull request: merge the latest main,
`npm run full-check` passes, self-review with the `reviewer` agent — and
`/review` plus `risky-area-reviewer`, and a hand-run CI
(`gh workflow run test.yml --ref <branch>`), for the pull requests marked
**risky**.

## 1. Website model, publish and discard — server (pull request 1, about 550 lines, risky: migration and public route)

- [ ] 1.1 Test: migrating from empty makes `website` and `website_versions` with row-level security on `shop_id`; another shop's rows can't be read (scratch database)
- [ ] 1.2 Test: the first `GET /api/website` makes the row, seeded from `storefront_settings` (tagline, description, logo, hero), with Collection and returns and Privacy unchecked
- [ ] 1.3 Test: `PUT /api/website/parts/:key` changes the draft only; two parts saved at the same moment both stay; the part is marked checked
- [ ] 1.4 Test: the changes list compares draft with published part by part and names the page ("Home page", "Collection and returns"); a photo with no description and no decoration tick is counted
- [ ] 1.5 Test: publish copies draft → published and keeps the old version; discard keeps the draft as a discarded version and puts published back; turn-on publishes when never published; turn-off keeps what's published
- [ ] 1.6 Test: history lists the last 90 days newest first, marks "What customers see now" and "First published"; restore keeps unpublished changes as a discarded draft first; the clean-up removes old rows but never the live one
- [ ] 1.7 Test: `/api/storefront/info` gives the published words, logo and colour, never the draft, and nothing while the website is off
- [ ] 1.8 Test: every write is refused for a non-Owner (`ownerOnly`)
- [ ] 1.9 Write the migration, `server/website.js` (model, changes, `websiteReady`) and the routes in `server/routes/website.js` to pass 1.1–1.8; keep `storefront_settings.enabled` in step with `is_on`
- [ ] 1.10 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 2. The Website page — screen (pull request 2, about 550 lines)

- [ ] 2.1 Screen test: `ws-page` — "Your website is off", the free address, Turn it on with its drawn line, the starting-wording pages named, the product counts with See them, the summary rows and the footer link
- [ ] 2.2 Screen test: `ws-page-on` and `ws-page-changes` — "[n] unpublished changes", "Saved by Jack Lewis [time]", the open list with Publish and Discard changes, "Review in the editor" not shown
- [ ] 2.3 Screen test: the Words and photos list — seven rows in the drawn order, "Check this" until saved once; Edit opens the form box; a photo part has a description and "This photo is only decoration"
- [ ] 2.4 Screen test: the Published toasts (on and off), the Discard box with Keep editing, and History over the page with Go back to this
- [ ] 2.5 Screen test: `ws-no-access` for Staff, naming the Owners, with Back to Today; Website not in a Staff sidebar
- [ ] 2.6 Build `src/screens/website/` on the Settings page frame and the form box to pass 2.1–2.5; add Website to Office in the sidebar
- [ ] 2.7 Remove the old app's Website panel (`public/app.js`, rule 5) now its replacement is here
- [ ] 2.8 Log decided-while-building 1, 3, 4 and 5 (design) in your own month file
- [ ] 2.9 Self-review with `reviewer`; full check

## 3. The three-step start, logo and colour (pull request 3, about 450 lines)

- [ ] 3.1 Test: `POST /api/website/set-up` with "every" switches `show_online` on for priced products only, "nothing" leaves all off; a second set-up is refused
- [ ] 3.2 Test: the colour check accepts #1A3F66, #2F6B4F and #2A2822 and refuses a colour white text can't be read on, on the server as well as the screen
- [ ] 3.3 Screen test: `ws-start-which` (both choices, Not now, Next), `ws-start-look` (logo, Change logo, skip line, suggestions, Soft sand charcoal, Choose another colour), `ws-start-products` (both choices, the three counts with See them, Make my website); Back keeps choices
- [ ] 3.4 Test: colours suggested from a logo — a test image made of two known colours gives those two
- [ ] 3.5 Build the start screens and the set-up and colour routes to pass 3.1–3.4
- [ ] 3.6 Log decided-while-building 2 (the step line) in your own month file
- [ ] 3.7 Self-review with `reviewer`; full check

## 4. Tracking tools (pull request 4, about 300 lines)

- [ ] 4.1 Check the ID formats for Microsoft Clarity, Meta Pixel and TikTok Pixel against each company's own help pages; note the sources in the code
- [ ] 4.2 Test: switching a tool on saves it to the draft only; a wrong ID is kept and reported waiting; off keeps the ID; published, only valid tools reach `/api/storefront/info`, each with its kind
- [ ] 4.3 Screen test: `ws-tracking` (four tools, kinds, the two drawn lines), `ws-tracking-on` (the cookie line, the ID field, the toast with Undo), `ws-tracking-error`
- [ ] 4.4 Build the tracking list, route and screen to pass 4.2–4.3; the Website page's Tracking tools row shows "None — so there's no cookie choice" or the tools on
- [ ] 4.5 Log decided-while-building 7 in your own month file
- [ ] 4.6 Self-review with `reviewer`; full check

## 5. Online payments setup and Today (pull request 5, about 600 lines, risky: money and migration)

- [ ] 5.1 Test: migrating from empty makes `online_payment_account` and `online_order_settings`; shops with deposits on and the server's provider set are marked connected
- [ ] 5.2 Test: the pretend adapter's `connectStart`, `connectFinish` (finish and cancel) and `accountState`; the £1 test payment is one payment, taken and refunded, even if pressed twice
- [ ] 5.3 Test: `paymentsConnected` is per shop; with it off, booking deposits are off and "Pay now" is hidden — one test per caller (`server/workshop/deposit.js`, `booking-deposit.js`, `routes/portal.js`, `routes/workshop-settings.js`)
- [ ] 5.4 Test: Buying online can't be switched On while not connected; connecting switches it On
- [ ] 5.5 Test: Today's Needs attention shows "[payment provider] needs more details by [date]" with Add the details for the Owner, and drops it when no longer needed
- [ ] 5.6 Screen test: `ws-pay-none`, `ws-pay-connected`, `ws-pay-tested`, `ws-pay-failed`, `ws-pay-more`, `ws-today-pay-more`, and the Website page's Taking payments row in each state
- [ ] 5.7 Build the migration, adapter calls, routes, the Online orders settings page (Buying online and Paying online only) and the Today source to pass 5.1–5.6
- [ ] 5.8 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 6. Shopify in the new frame (pull request 6a and 6b, about 500 lines each)

- [ ] 6.1 Test: the pretend Shopify adapter — connect finishes, "Couldn't connect" on an unknown address or a cancel, preview counts, the only-in-Shopify list (left alone in Shopify, never hidden or deleted), sending progress, the three problem kinds, pause and resume
- [ ] 6.2 Test: the routes — nothing is sent until Send; sending carries on as a background job; switch-to-Wheelhouse stops sending, makes Wheelhouse's website switched off, and keeps `show_online` and orders
- [ ] 6.3 Build the adapter, pretend version and routes to pass 6.1–6.2 (pull request 6a)
- [ ] 6.4 Screen test: `ws-start-shopify`, `ws-shopify-connect` with `-failed`, `-check`, `-sending`, `-problem`, `-switch`; `ws-shopify-on` on the Website page; `ws-pay-shopify` in Online orders settings
- [ ] 6.5 Build the Shopify screens to pass 6.4 (pull request 6b)
- [ ] 6.6 Self-review each with `reviewer`; full check

## 7. Roles (pull request 7, about 250 lines — waits for WP-1.1)

- [ ] 7.1 Test: "Can edit the website" decides the website routes and the sidebar; online payments and online orders settings need "Can change settings"; Shopify connect needs both
- [ ] 7.2 Screen test: `ws-no-settings` — the page without its settings rows and the drawn line naming who can change settings; `ws-no-access` names the people with "Can edit the website"
- [ ] 7.3 Swap `ownerOnly` for the switches to pass 7.1–7.2
- [ ] 7.4 Self-review with `reviewer`, `/review` and `risky-area-reviewer` (sign-in); full check; hand-run CI

## 8. Moving from Citrus Lime (pull request 8, about 250 lines — waits for WP-8.1)

- [ ] 8.1 Test: while the shop is moving, the switch-over checklist reads `websiteReady`; Turn it on is replaced by the drawn moving lines until switch-over morning
- [ ] 8.2 Screen test: `ws-page-moving` ("Ready for switch-over · 1 of 2", Done and To do), `ws-page-switch-over` ("Your website is ready", "2 of 2"), `ws-pay-tested-moving`
- [ ] 8.3 Build to pass 8.1–8.2
- [ ] 8.4 Self-review with `reviewer`; full check

## 9. Before the last pull request merges

- [ ] 9.1 `npm test` and `npm run test:browser` pass locally on the final commit (through `npm run full-check`)
- [ ] 9.2 Walk the build against `specs/` and the drawings line by line; note what was met, dropped or changed

## Workflow follow-up

- `/opsx:archive` as the last commit of the last pull request, before it merges.
- Change STATUS's "Start here" in the pull request that takes the piece, and in the one that finishes it.
