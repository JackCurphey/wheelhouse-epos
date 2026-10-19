# Tasks: the additional note on the confirmation

## 1. Server (Mark's files; flagged for him)

- [ ] 1.1 Tests first, watched failing: settings start with the drawn sentence; the note saves, trims, can be emptied, refuses over 300 characters and non-text; a confirmed booking's link carries the note; a request waiting, a bike in and an empty note carry null
- [ ] 1.2 Migration 045; workshop-settings.js; bookingLinkView's confirmationNote

## 2. Screens

- [ ] 2.1 Tests first, watched failing: the booking page shows the note after the drop-off sentence, or alone; none without it; the Settings box shows the stored note, saves when left, shows a refusal
- [ ] 2.2 The Settings box; the booking page
- [ ] 2.3 Browser: the note saved in Settings shows on a confirmed booking's page against the real server

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
