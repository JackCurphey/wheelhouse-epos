## Context

`message-attachments` stores each email's files in `customer_message_attachments` (migration 159), one row per file, cascading from its message. The engine reads them in one place: when `sendDueForShop` claims due messages (`intent_state` 'intended' → 'sending'), it loads their files and hands them to the sender. A message is claimed only from 'intended', and no path moves it back: delivered, failed, unknown (stuck in 'sending' over 5 minutes) and undone are final. So a message's files are dead once it leaves 'intended'/'sending'.

## Decisions

### 1. Cleared by the sender's round, not at each change of state

One statement at the end of each shop's round deletes the files of every message whose `intent_state` is not 'intended' or 'sending'. The alternative, deleting in `recordResult` and at each place a message is undone, touches about a dozen places (the engine's undo and stops, the stuck rule, the held Bike ready rule, the still-needed checks in the round, and Cycle to Work's three stops in `server/c2w/messages.js`), and a future stop would have to remember to do it too. The round's sweep catches every final state, including ones added later, and keeps the state changes as they are.

Timing: the sweep runs after that round's sends are recorded, so a sent or failed message's files go in the same round, as do those of a message the round itself marks stuck or stops. One staff undo between rounds has its files cleared by the next round (the sender runs every 5 seconds).

### 2. 'sending' keeps its files

A message being sent has its files in the sender's hands, in memory. Its rows are kept until the result is recorded; a message that never gets a result becomes 'unknown' after 5 minutes and is then swept.

### 3. Inside the shop's scope

The sweep runs in `runWithShop(shopId, …)`, like the rest of the round, so row-level security limits it to that shop's rows. A failure is logged on its own line (its own catch, like the shop's own-messages and hold-ending rounds) and tried again next round; nothing depends on it.

### 4. No migration, no index

The table holds only files of messages still waiting, at most a few per shop, so the join needs no index. The cascade from the message stays for deletions.

## Risks / Trade-offs

- A failed email's file is gone, so if a re-send were ever built (the `messageIntent` state machine allows failed → sending on a deliberate retry, but no code does it today) it would have to make the file again (it would anyway: the quote route makes a fresh PDF each time, design 6 of `message-attachments`).
- The sweep runs every 5 seconds for each shop. The table only ever holds the files of messages still waiting, so it is a small join on a near-empty table.

## Contract

No route, response or screen changes. `filesOf`-style reads of the table see a message's files until its first round after it has left the queue.
