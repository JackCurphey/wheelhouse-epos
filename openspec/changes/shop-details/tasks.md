# Tasks: Shop details

## 1. Server (Mark's shops table and shop-settings.js; flagged for him)

- [ ] 1.1 Tests first, watched failing: GET is empty to start; PUT saves, trims, clears blanks, refuses a blank name and over-long text, keeps fields left out; one shop can't see another's
- [ ] 1.2 Migration 042; GET and PUT /api/shop-details; the route list

## 2. Screens

- [ ] 2.1 Tests first, watched failing: Shop details shows and saves each box on leaving it; a failed save says so; the receipt prints details then barcode at the bottom, leaving blanks out; till and diary pass the details
- [ ] 2.2 Settings section; receipt layout; till and diary
- [ ] 2.3 Browser: enter the details in Settings, pay a job, and the printed receipt carries them above the barcode

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
