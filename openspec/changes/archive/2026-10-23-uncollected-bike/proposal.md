# Proposal: a bike left uncollected

## Why

A finished bike that sits in the shop takes space and the customer may have
forgotten. Jack decided (collect and pay review, item 4, H4 and M5,
`docs/decisions/2026-09-30-collect-and-pay-review.md`): after the days the shop
sets, counted from when the bike is marked ready, the customer gets one "Bike
still waiting" message; after a longer wait the bike shows on Today under
Needs attention with the customer's phone and "Contacted"; the line goes by
itself at hand-over.

## What Changes

- **Settings › Workshop › Collection** (new section): "Remind the customer
  after [n] days" and "Show it on Today after [n] days", saved as they're
  changed, the second longer than the first.
- **"Bike still waiting"**, a new automatic message with the drawn wording,
  editable in Settings › Messages like the others; queued when the work is
  marked ready, for the days set; checked when it's due (still in the shop,
  still finished, not paid, message still on) and dropped otherwise; stopped
  when the work is reopened.
- **Today's line** (new Needs attention kind `uncollected`): "WH-1050 · Aisha
  Khan — ready since Mon 14 Sep", the bike, when the reminder went and the
  phone; **Contacted** records who and when and takes the line off Today.
- **Migration 064**: the two day counts on `workshop_settings`, and when and by
  whom an uncollected bike's customer was contacted on `workshop_jobs`.

## Capabilities

### New Capabilities
- `workshop-collection`: reminding about and flagging a ready bike that
  isn't collected.

### Modified Capabilities
- None. (Today's Needs attention gains a kind through its own extension
  point, `server/routes/today.js`; its spec arrives with #437.)

## Lane, work package, drawings and decisions

- **Work package:** WP-4.3 (collect and pay), taken by Jack (overnight queue,
  23 Oct).
- **Risky areas:** a migration and the messaging core, so `/review` runs
  before merging.
- **Drawings:** `cp-setting` and the "Bike still waiting" wording pop-up
  (`docs/design/user-journeys/generator/collect.mjs` :139–155, :181),
  `cp-today-uncollected` (`opening.mjs` `today({ uncollected })`, :158), and
  the Messages row (`setup.mjs` :413).
- **Decisions:** the collect and pay review item 4, H4, M5; owner setup 14
  and the row "Bike still waiting (text, on)"
  (`2026-09-30-owner-setup-review.md`); buy online decision 7 ("one reminder
  … as uncollected bikes", `2026-10-01-buy-online-review.md`); the messages
  engine (`2026-10-20-messages-engine.md`).

## Out of scope

- The "Hand-back reminders" switch in the same section: it changes Hand over
  and the till, a separate piece.
- Who else sees the line ("owners and managers"): Owner only until roles
  (WP-1.1), as the rest of Needs attention.
- Online orders left uncollected (buy online, later).

## Impact

`server/migrations/064_uncollected_bike.sql`, `server/routes/workshop-settings.js`,
`server/routes/workshop.js` (queueing at ready, stopping at reopen, the
Contacted route), `server/messaging/templates.js` and `engine.js`,
`server/workshop/job-messages.js`, `server/routes/today.js`; the screens:
Settings › Workshop, Today. Two pull requests: the server, then the screens.
