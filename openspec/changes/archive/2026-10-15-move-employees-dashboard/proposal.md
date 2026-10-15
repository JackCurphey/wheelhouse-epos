# Proposal: employees join the team routes, and the dashboard gets its own file (WP-0.4)

## Why

The last of Mark's WP-0.4 route moves. After this, the only routes left in
`server.js` are Jack's (quotes, job delete and attachments), plus one portal
route waiting for his quote move.

## What Changes

- `GET /api/employees` and `PUT /api/employees/:id`, with
  `serializeEmployee`, move to `server/routes/team.js`. That file already
  merges the employee roster with logins, and its comment pointed at these
  routes "still in server.js".
- `GET /api/dashboard` moves to the new `server/routes/dashboard.js`.
- Moved, not rewritten. The only changes are the 2-space indent inside
  `register(route)`, the imports, and `team.js`'s pointer comment. No
  behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's (`team.js`, the dashboard and `server.js`; split plan §3).
- **Drawings:** none.
- **Decisions followed:** split plan §4.1.

## Out of scope

- Jack's remaining routes, and the portal quote answer that waits for them.

## Impact

- `server/routes/team.js`, `server/routes/dashboard.js` (new),
  `server/routes/index.js`, `server/server.js`, and the new test
  `tests/employees-dashboard-routes.test.js`. Built on #213.
