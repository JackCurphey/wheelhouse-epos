## Why

A review of main found that a client going away at the wrong moment can stop the server answering every shop. If the connection is lost after a request arrives and before the server starts reading its body, the read never finishes, so the request keeps its database connection for good. There are 10 connections. A reviewer sent complete requests and reset the connection 1 to 4 ms later: 10 dropped till syncs, or 20 dropped staff requests, used them all, and every request for every shop then got an error after 5 seconds, still stuck about 5 minutes later. Anyone on the internet can do this to a till or website address, and a shop's own poor signal can do it by accident.

Reading the code for this found one more thing on main: a customer's Cancel booking whose body was cut off part-way went on to cancel the booking, because it treats a body it can't read as an empty one.

## What Changes

- Reading a request's body always ends. A client gone before or during the read ends it with its own kind of error, whichever moment it happened; the database work rolls back and the connection goes back.
- A dropped request is not a server fault: nothing goes in the log as one, and nothing tries to answer a client that has gone.
- A Citrus Lime upload that is dropped lets the shop send again.
- A Cancel booking that never arrived whole cancels nothing. A body that did arrive but can't be read still cancels, as it does today.
- Reading a body twice, a mistake in the code, now gets an error where it used to wait for good.

## Out of scope

- A client that sends part of a body and then goes quiet without disconnecting. It keeps its connection until Node's own 5-minute limit ends the request, and at that point the read now ends and the connection goes back. Reading the body before taking a connection is the real answer, and a larger change (the note on `runWithShop` in `server/db.js` lists it among the work still to move).
- `server/gateway.js`: a client gone from the gateway part-way through a body leaves the app waiting until the gateway's own 5-second limit closes its side. That ends the read in the app, so nothing is stuck.
- File answers (`createReadStream(...).pipe(res)`) hold no database connection, so aren't part of this.

## Who and risk

From a review of main, no work package; Jack's. Risky areas: `server/server.js`, and public routes (`/api/portal/*`). `/review` before merging; the hand-run CI and the merge are done by whoever is running the build.

## Follows

No drawing: nothing on any screen changes. Follows `openspec/changes/archive/2026-10-26-server-stays-up-when-busy` (one failed request never stops the others). No decision is touched.
