# Tasks: the mechanic sign-off, piece 3

## 1. Server (Mark's workshop-settings.js and portal.js; flagged for him)

- [ ] 1.1 Tests first, watched failing: the setting starts off and round-trips; the booking link's checkedBy only with the setting on, a signed-off job, and ready or collected
- [ ] 1.2 Migration 041; the settings serializer and PUT; bookingLinkView

## 2. Screens

- [ ] 2.1 Tests first, watched failing: the Settings page's switch reads and saves the setting; the receipt's Checked by line; the till and diary pass it only with the setting on; the booking link shows it
- [ ] 2.2 Settings page; receipt; till; diary; booking link
- [ ] 2.3 Browser: turn the switch on, and a signed-off job's booking link says Checked by

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
