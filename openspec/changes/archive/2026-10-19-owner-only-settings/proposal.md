# Proposal: Settings for the Owner only, until roles are built

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-owner-only-settings.md`): any
signed-in staff member can change the shop's settings today. Until WP-1.1
brings Managers and the "Can change settings" switch, only the Owner can.

## What Changes

- **Server:** `PUT /api/workshop-settings` and `PUT /api/shop-details` refuse anyone but the Owner: 403 `{ error: "Only the shop's owner can change settings", code: 'owner_only' }`. Reading them stays open, since the diary, till and booking need them. The same workshop route also saves the online booking settings (booking mode, notice, terms, prices), so those are Owner-only too; only the old app's form sends them today, and a refused save there shows the message.
- **Screen:** `/workshop/settings` shows anyone but the Owner "Settings aren’t part of your role" (drawn as `auth-noaccess`), with no settings on it.

## Lane, work package, drawings and decisions

- **Work package:** a stand-in for part of WP-1.1 (the check on settings routes), until WP-1.1 replaces it with roles and switch 7.
- **Lane:** **Mark's files, flagged for him** (Jack, 19 Oct): `server/routes/workshop-settings.js`, `server/routes/shop-settings.js`. Screen: `src/screens/settings/settings-page.tsx` (Jack's).
- **Drawings:** `auth-noaccess` (`stage1.mjs`, `signin.mjs`).
- **Decisions:** `2026-10-19-owner-only-settings.md`; `2026-10-05-roles-and-switches.md` (what WP-1.1 brings).

## Out of scope

- Managers, the switches and the other routes' checks (WP-1.1); label, theme and website settings, which the new Settings page doesn't save.

## Impact

- `server/routes/workshop-settings.js`, `server/routes/shop-settings.js`, `server/lib/owner-only.js` (new)
- `src/screens/settings/settings-page.tsx`
- `tests/settings-owner-only.test.js` (new), `tests/screens/settings-page.test.js`, a browser test
