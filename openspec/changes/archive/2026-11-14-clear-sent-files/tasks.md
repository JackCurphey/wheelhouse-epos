## 1. Clear files once a message has left the queue

- [x] 1.1 Tests first (`tests/message-attachments.test.js`): a sent message's files go in its round and the message stays; a failed send's files go; an undone message's files go next round while one still in its minute keeps its own. Watched failing (1 file left where 0 expected)
- [x] 1.2 The sweep at the end of `sendDueForShop` (`server/messaging/engine.js`); mutations caught: keeping undone files fails the undone test, clearing 'intended' fails the still-waiting check
- [x] 1.3 Related messaging tests pass (179 of 179)

## 2. Before merging (risky area 4)

- [x] 2.1 `/review` and the `risky-area-reviewer` agent: no defects; added from them a test that a stuck message's files go while a held one's stay (mutations caught: keeping 'unknown', sweeping held), the sweep's own error log, and timing wording
- [x] 2.2 lint, `npm test`, `npm run test:browser` passed locally on b5563f4e (after merging main); CI run by hand on the branch (43563404633), green
- [x] 2.3 Archived as the last commit
