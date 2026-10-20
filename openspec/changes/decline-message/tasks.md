# Tasks: declining with a message

## 1. Server — the workshop server (Jack's, Mark approves) and Mark's portal.js, on Jack's word; flagged for Mark

- [x] 1.1 Tests first, watched failing: decline saves the message (trimmed), refuses too long or not text, works without one; the link carries it once declined
- [x] 1.2 Migration 047; the decline route; the link view; route snapshot unchanged

## 2. Screens

- [x] 2.1 Tests first, watched failing: Decline opens the message step with the message started; Decline & notify customer posts it; Keep request goes back; the customer's declined page
- [x] 2.2 The request pop-up's decline step; the declined page
- [x] 2.3 Browser: a decline with a message, sent to the server as the pop-up sends it, shows on the customer's page (the pop-up itself is covered by the screen tests)

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass; archived
