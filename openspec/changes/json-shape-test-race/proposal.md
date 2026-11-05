## Why

`tests/json-shape.test.js` failed about one run in ten: "answered without waiting for the rest". Its last check sends 3 MB of a body declared at 20 MB to a small route with no sign-in, and required the client to hear the 400.

Past 2 MB the server answers and closes without reading the rest, as `openspec/changes/archive/2026-11-05-json-shape/design.md` says it will ("Past 2 MB the connection closes whether or not the client has heard"). Closing with bytes still unread resets the connection, and the reset can reach the client before the answer. Repeating just that case 200 times: 185 heard the 400, 15 heard nothing as the connection was reset, and none was left open waiting. So the server never waited; the test asked for more than the design promises.

## What Changes

- The check asks what the design says: the server ends the request without waiting for the rest, by answering or by closing. Waiting, it would do neither within the same 3 seconds. If anything is heard, it must be the words.
- A new check, with fixed timing, that under 2 MB the server reads to the end before answering, which is what lets a client hear it. The old check was the only thing that went red when the read-on stopped at 200 KB, and only by chance; this one does every time.
- No retry and no longer wait.

## Out of scope

Making the answer reach a client past 2 MB, for example by reading on after answering. The design chose not to read on past 2 MB.

## Who and risk

From a review of main; Jack's. Tests only; no risky area.
