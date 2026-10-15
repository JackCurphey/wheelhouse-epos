# Proposal: the staff quote routes move to server/routes/workshop.js (WP-0.4)

## Why

The workshop moves (#180–#184) left staff quotes in `server.js`, because
answering a quote adds the approved lines to the job's order and that needs
`loadDocumentLine`, which only `server.js` had. Mark's #202 put it in
`server/lib/sales.js`, so quotes can now follow the rest of the workshop.

## What Changes

- The six staff quote routes move to `server/routes/workshop.js`, inside
  `register()`: `GET /api/quotes/:id`, `GET /api/workshop-jobs/:id/quotes`,
  `POST /api/workshop-jobs/:id/quotes`, `POST /api/quotes/:id/send`,
  `POST /api/quotes/:id/withdraw` and `POST /api/quotes/:id/answer`.
  `publicBase` moves with them, private, because only the send route uses it.
- `addApprovedLinesToOrder` and `answerAndAddToOrder` move to
  `server/workshop/jobs.js`, exported, because the customer's booking-link
  answer route (Mark's, staying in `server.js`) calls `answerAndAddToOrder`
  too. `jobs.js` imports `loadDocumentLine` from `../lib/sales.js` and still
  imports nothing from `server.js`.
- Moved, not rewritten: the code is unchanged apart from `export` on the two
  helpers, the indentation inside `register()`, a `// ---------- Quotes
  ----------` label in `workshop.js`, and the import lines.
- No behaviour changes, so there's no spec change (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Jack's. `server/routes/workshop.js` and `server/workshop/jobs.js`
  are Jack's files; the lines leave `server.js`, which is Mark's, so the pull
  request needs Mark's approval (split plan §3.1).
- **Drawings:** none. Nothing on any screen changes.
- **Decisions followed:** split plan §4.1 (a move, not a rewrite, proven by
  the route-list test and the existing tests passing unchanged); Mark's
  answers 1 and 3 on #180 (the portal quote routes are his and stay; quotes
  move once the sale helpers are in `sales.js`).

## Out of scope

- The three portal quote routes and the two booking-link quote routes:
  Mark's, with the rest of the portal.
- Job attachments and deleting a job: they wait for Mark's shared
  `server/lib/uploads.js`.

## Impact

- `server/server.js`, `server/routes/workshop.js`, `server/workshop/jobs.js`,
  and `tests/workshop-jobs-module.test.js` and
  `tests/workshop-routes-file.test.js` (extended).
