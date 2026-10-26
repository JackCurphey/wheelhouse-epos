# Proposal: two settings saved at once both stay

## Why

Settings › Workshop saves each field the moment it changes. The server read the
shop's whole settings row, changed the field that was sent, and wrote the whole
row back. Nothing stopped a second save running in between, so two saves at the
same moment could undo each other: switch "Take a deposit when booking" on while
"How much" is still saving, and one of the two changes is lost without a word.
A test sending the two saves together lost one in 30 rounds out of 30.

The sticker label size and the website settings (tagline, description, pictures,
look) save the same way and lose changes the same way.

## What Changes

- **Workshop settings** (`PUT /api/workshop-settings`): the save reads the row
  `FOR UPDATE` inside a transaction, so a second save waits for the first and
  then starts from what it wrote. Every check on what was sent stays as it was.
- **Sticker labels** (`PUT /api/label-settings`) and **the website**
  (`PUT /api/storefront-settings`, and the logo and hero picture uploads, which
  share `updateStorefrontSettings`): the same lock.
- Nothing a shop sees changes; a save that clashed now keeps both changes.

## Capabilities

### Modified Capabilities

- `settings`: two saves of different settings at the same moment both stay.

## Work package, owner, risky areas

A fix found in review, not a work package; Jack's lane. No migration, no
`server.js`, no sign-in or public route. The workshop settings row holds the
deposit settings, so it sits next to money; it is not a sale, payment, refund or
stock change. No drawing or decision changes: this follows the existing pattern
of reading a row `FOR UPDATE` before writing it (`server/workshop/checklists.js`,
`server/routes/workshop.js`).

## Out of scope

- Telling the Owner when someone else changed the same field at the same time:
  the later save still wins for one field, as before.
- The settings saves that already change only what was sent in one statement
  (listed in `design.md` under "Not covered").
