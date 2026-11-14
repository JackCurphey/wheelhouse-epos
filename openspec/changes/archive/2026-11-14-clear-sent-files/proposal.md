WP: none (follow-up from `message-attachments`: a message's stored files were kept after it went)

## Why

Since `message-attachments`, an email's files (such as the Cycle to Work quote PDF) are stored with the message until the sender takes them. After that they were kept for as long as the message, which is for good: nothing clears messages except a customer's deletion request or a shop's removal. Nothing reads the files again once the message has left the queue, so every quote PDF ever sent stayed in the database, holding a customer's name and order, for no use.

## What Changes

- At the end of each round of the message sender (every 5 seconds), the files of every message that has left the queue are deleted: sent, failed, stuck ("unknown") or undone. The message itself stays, with its wording and status, so the outbox is unchanged.
- A sent message's files go in the same round that sends it. A message staff undo has its files cleared by the next round.
- A message still waiting (in its minute, held, or due later) keeps its files, and one being sent keeps them until the sender has finished.
- No migration: the table and its cascade from the message are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `messages`: "An email message can carry attachments" now says the files are kept only until the message has left the queue.

## Touches

- `server/messaging/engine.js` (`sendDueForShop`), `tests/message-attachments.test.js`.
- **Risky area 4, the messaging core** (`server/messaging/**`): `/review`, the `risky-area-reviewer` agent, a full local run and a hand-run CI before merging.

## Out of scope

- Re-sending a message that went or failed: there is no such path today, and one would have to make its files again.
- Clearing old messages themselves.
