# Design: the additional note on the confirmation

## Storage

`workshop_settings.confirmation_note TEXT NOT NULL DEFAULT 'Please bring the lock key, and tell us about any accessories.'` (migration 045, additive). Every shop, new or existing, starts with the drawn sentence. An empty string means no note.

## Contract

- `GET /api/workshop-settings` gains `confirmationNote` (a string, maybe empty).
- `PUT /api/workshop-settings` accepts `confirmationNote`: a string, trimmed, up to 300 characters (400 "The note can be up to 300 characters"); not a string, 400 "The note must be text". Omitted keeps what is stored. Owner only, as the rest of the route.
- `GET /api/portal/:shopSlug/booking-links/:code` (and the views cancel, change and withdraw-change return) gain `confirmationNote`: the shop's note when the stage is `confirmed` or `change_requested` and the note isn't empty, else `null`. It shows whether or not there is a drop-off line (a set-time shop's job with no time still gets the note).

## Screens

- Booking page (`pending.tsx`): the drop-off sentence and the note share one paragraph, joined by a space; with only one, that one alone.
- Settings: a 2-row textarea, label "Additional note on the confirmation", hint as drawn (`aria-describedby`), `maxLength` 300, saved when left if it changed (the NumberSetting pattern: "Saved." or the server's refusal). Shown in both booking modes, after the drop-off row and before Notice.
