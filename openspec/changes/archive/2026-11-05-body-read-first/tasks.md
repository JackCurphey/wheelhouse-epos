# Tasks

- [x] 1.1 Tests first (`tests/body-read-first.test.js`): real sockets, each with a time limit. 10 and 50 stalled and trickling with no sign-in; staff and tills stalled; the deadline at each door; a slow honest body and upload; the limits per address, overall, on bytes and with a made-up address; paying for an order; every upload route; the normal requests. Watch each fail for the right reason on the unfixed code, and the normal requests pass on it
- [x] 1.2 `server/lib/read-body-first.js`; `server/lib/http.js` uses what it read
- [x] 1.3 `server/server.js`: each branch reads first; staff and tills are checked first; `route` takes what a route needs of its body
- [x] 1.4 The seven upload routes say their limits; the Citrus Lime send's checks and its one place move before the body
- [x] 1.5 `server/routes/sales.js`: paying for an order reads its body before the transaction
- [x] 1.6 Break each changed branch on purpose, confirm the break is in the file, see the tests go red, restore and check the restore
- [x] 1.7 The review's fixes, tests first: a byte limit per shop for staff and tills; a place held only while reading, bytes until the request is over; everything given back for a pipelined request on Node 22; staff sign-in and webhooks on gates of their own; every upload route and every door tested on its own. Break each, see red, on Node 22 where it matters
- [x] 1.8 A payment with a key after `sale-request-key`: a stalled send holds nothing, and a lost answer gets the first sale, once
- [x] 1.9 The re-check's fixes, tests first: 408 and 429 are busy at the till, never a reason to reverse, and don't settle a lost answer; signed-in uploads have a gate of their own; one listener per socket; each overall limit tested live
- [x] 1.10 The busy words say the sale may not be recorded yet, which stays true after a lost answer
- [x] 1.11 Self-review; through the gateway with a real trickle; `npm test`, `npm run test:browser`, the drawing coverage check and lint on the head after merging main
