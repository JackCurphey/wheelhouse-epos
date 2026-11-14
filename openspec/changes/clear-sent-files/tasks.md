## 1. Clear files once a message has left the queue

- [x] 1.1 Tests first (`tests/message-attachments.test.js`): a sent message's files go in its round and the message stays; a failed send's files go; an undone message's files go next round while one still in its minute keeps its own. Watched failing (1 file left where 0 expected)
- [x] 1.2 The sweep at the end of `sendDueForShop` (`server/messaging/engine.js`); mutations caught: keeping undone files fails the undone test, clearing 'intended' fails the still-waiting check
- [x] 1.3 Related messaging tests pass (179 of 179)

## 2. Before merging (risky area 4)

- [ ] 2.1 `/review` and the `risky-area-reviewer` agent
- [ ] 2.2 lint, `npm test`, `npm run test:browser` locally; CI run by hand on the branch, green
- [ ] 2.3 Archive as the last commit
