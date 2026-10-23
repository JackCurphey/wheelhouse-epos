# Proposal: Your settings › Accessibility

## Why

Jack wants Wheelhouse "as accessible as possible", with each person's own
accessibility choices (decision 57, `docs/decisions/2026-09-27-workshop-day-review.md`;
app map review decisions 5, 7 and 9). Your settings is routed but shows "Not
built yet". On 23 Oct Jack decided the choices are saved on the signed-in
account until staff PINs exist (`docs/decisions/2026-10-23-overnight-questions.md`
answer 1).

## What Changes

- **Your settings**, the drawn pop-up (`your-settings`, `app-map.mjs`
  `yourSettingsDialog`): "Your settings", whose it is, the Accessibility
  switches, and "Changes apply straight away." Opened from your name, as now.
- **Saved per signed-in login** (migration 065, `login_preferences`), read and
  changed through `GET`/`PUT /api/your-settings`.
- **This change builds Reduce motion**: animations and transitions off
  across the app, as the computer's own setting already does; on by itself
  when the computer asks.
- **Larger text waits for Jack**: zooming the app (the way it was first
  built) put the diary's drops and pop-ups off their marks (review), so how
  to make text larger is a question for him.
- Later changes add Show status symbols, Don't close things by themselves,
  Folded sidebar and Larger text, each with what it acts on; the server
  already keeps all five.

## Capabilities

### New Capabilities
- `your-settings`: each person's own settings, starting with accessibility.

### Modified Capabilities
- None.

## Lane, work package, drawings and decisions

- **Work package:** WP-1.11, taken by Jack (overnight queue, 23 Oct).
- **Risky area:** a migration, so `/review` runs before merging.
- **Drawings:** `your-settings`, `your-settings-no-pin` (`app-map.mjs` :183–217,
  :326–333); the previews in `diary.mjs` :1843–1858.
- **Decisions:** workshop day 57; app map review 5, 7, 9; UX walk-through
  (Don't close things by themselves); 23 Oct answer 1.

## Out of scope

- The Till PIN block (waits for PINs, WP-1.7) and Help (off on the drawn boards).
- Show graphs in reports (reports aren't built).
- Larger text, Show status symbols, Don't close things by themselves, Folded
  sidebar: next changes.

## Impact

`server/migrations/065_login_preferences.sql`, `server/routes/your-settings.js`
(registered; route list); `src/screens/your-settings/`, `src/staff/` (applying
the choices to the page), `src/styles/theme.css`, the diary's reduced-motion
check.
