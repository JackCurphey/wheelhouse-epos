# Drop the print agent

## Why

Jack decided on 26 Oct to drop the label printer helper (the "print agent")
and print everything through the browser: "Drop it, browser only"
(`docs/decisions/2026-10-26-day-answers.md` section 5, following his 1 Sep
answer in `2026-09-01-ownership-signoff.md` PF-3). Receipts
(`2026-10-18-print-receipt.md`) and bike tags (`2026-10-21-bike-tag.md`)
already print through the browser. Jack approved deleting the helper's code
and routes with that answer.

**Work package:** PF-3 and the printing line of WP-1.11. Taken by Jack.

**Risky area:** none. The routes lived in their own file,
`server/routes/print-agents.js`; `server/server.js`, migrations, money,
stock, sign-in and the messaging core are untouched. Print jobs were kept in
memory only, so nothing in the database goes.

## What changes

- **The helper app goes:** the `print-agent/` folder (a desktop app with its
  own `package.json`; the main app never depended on it).
- **Its four routes go:** `POST /api/print-agents/checkin`,
  `GET /api/print-agents`, `POST /api/print-agents/:deviceId/jobs` and
  `POST /api/print-agents/jobs/:printJobId/complete`, with their
  registration in `server/routes/index.js` and their test
  (`tests/print-agents-per-shop.test.js`, from #510).
- **The old app** (`public/app.js`, a placeholder): Print stickers prints
  through the browser's print box only; its "Send straight to" choice and
  the dashboard's "Connected printers" panel go.
- **Tests:** the route list loses the four routes (232 to 228); the id
  check's "a non-id param is left alone" test uses a message template's
  name instead of a print job id.
- **Docs:** the go-live checklist and the two plans say the helper was
  removed; `decided-while-building.md` logs it.

## Drawings and decisions followed

- `docs/decisions/2026-10-26-day-answers.md` section 5.
- `docs/decisions/2026-10-18-print-receipt.md`, `2026-10-21-bike-tag.md`.
- No drawing changes. `job-book-in` still shows the helper's "Bike tag sent ·
  Acknowledged"; the built tag follows the bike-tag decision, drawn in
  `diary.mjs`.

## Out of scope

- Any new printing feature, such as a shop designing its own printouts
  (later, per Jack).
- Rewriting history documents (decisions, reviews, older plans) that name
  the helper.
- The new app's own sticker or label printing.
