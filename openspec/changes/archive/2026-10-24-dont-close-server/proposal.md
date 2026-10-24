# Proposal: Don't close things by themselves, the server holds Bike ready

## Why

Jack's 24 Oct answer 9 (`docs/decisions/2026-10-24-morning-questions.md`):
"Don't close things by themselves makes both timers wait: Bike ready waits
with 'Send now' and Undo, the server holding the message until one is
pressed". Approved drawings (#464): `job-finished-wait`, `job-finished-sent`.
This is the server half; the job strip, the Your settings row and the till
are the screens half. The switch, `noAutoClose`, is already stored per login
(`server/routes/your-settings.js`). Jack's lane. **Risky area: the messaging
core** (`server/messaging/*`), so `/review` runs. No migration.

## What Changes

- Marking a job ready by someone with "Don't close things by themselves" on
  queues Bike ready **held**: it waits, with no time, until Send now or Undo.
- `POST /api/messages/:id/send-now` sends a held message now (the sender
  sends it on its next round, within seconds).
- Undo stops a held message as it does one in its minute.
- A message as the screens read it says it's held.

## Capabilities

### Modified Capabilities

- `messages`: a message can be held until someone sends it.

## Out of scope

The screens (Your settings' row, the job strip, the till's Start next sale).

## Impact

`server/messaging/engine.js`, `server/routes/workshop.js` (Bike ready),
`server/routes/messages.js` (Send now), tests.
