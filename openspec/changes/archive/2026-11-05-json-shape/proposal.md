## Why

One POST with no sign-in stops the server for every shop. A booking can be about 73 MB, because it carries photos as base64 inside JSON. A body of about 69 MB of `{"a":[{},{},{},...]}` passes every limit, and `JSON.parse` then runs out of memory: on the real server in `node:22-alpine` at 1 GB, the container exited with 139 after about 11 seconds. Base64 costs about its own size to parse, but tiny values cost far more: 2 MB of `{}` takes 43 MB of heap.

## What Changes

- Bodies are counted as they arrive for the characters that make values (`{`, `[`, `,`, `:`). Base64 has none of these. Over the limit, the client is told "That's too much to send in one go." with a 400, and the connection closes, without the rest being read or anything being parsed.
- The limit is 10,000 with no sign-in, and 200,000 for signed-in staff and tills, whose bodies can honestly be long lists.
- Routes with no sign-in and no photos now take at most 100 KB rather than 2 MB, as they have no reason for more. Over it, the client gets the same 400 and the connection closes. The two routes with photos keep their sizes.
- A body handed to its route stops being held twice.

## Out of scope

- Moving a booking's photos out of the JSON. It isn't needed: the count separates the two shapes, and honest bookings at the largest size still work.
- A Shopify webhook: it's parsed only once its signature is good, so it has no count.

## Who and risk

From a review of main, no work package; Jack's. Risky areas: public routes (`/api/portal/*`), and `server/lib/read-body-first.js`, which `server/server.js` uses for every route. `/review` before merging; the hand-run CI and the merge are done by whoever is running the build.

## Follows

No drawing: nothing on any screen changes. Follows `openspec/changes/archive/2026-11-05-body-read-first`. The limits are logged in `docs/decisions/decided-while-building.md`. No decision is touched.
