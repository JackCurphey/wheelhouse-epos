# Design: Settings for the Owner only

## Contract

- `PUT /api/workshop-settings`, `PUT /api/shop-details`: a login that isn't the shop's Owner (`logins.is_owner` false) gets 403 `{ error: "Only the shop's owner can change settings", code: 'owner_only' }` and nothing changes. The Owner is unaffected. `GET`s are unchanged.
- One helper, `ownerOnly(req, res)` in `server/lib/owner-only.js`, reads the session (`currentSession`) as `team.js` does, so WP-1.1 can swap it for the role and switch 7 in one place.

## Screen

The Settings page reads the session: the Owner sees Settings as now; anyone else sees a card with a lock, "Settings aren’t part of your role", "Only the shop’s owner can change settings for now. Ask the owner if you need something changed.", and "Go to the till" (their landing page). Following `auth-noaccess`, with its words fitted to Settings and to there being no Managers yet.
