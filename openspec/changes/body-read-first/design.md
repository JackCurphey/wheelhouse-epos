## Where the read happens

`readBodyFirst` (`server/lib/read-body-first.js`) runs in the dispatcher, on each branch, just before the connection is taken. It keeps the bytes against the request (`holdRequestBody`); `readJsonBody` and `readRawBody` then use them and the routes are unchanged. A request with no body (no length and not chunked) has nothing to wait for and takes no place.

| Branch | Checked before the read | Limits on reads at once and bytes |
|---|---|---|
| Signed-in staff | Session, which gives its connection straight back | No |
| Till | Token, on a connection it gives straight back | No |
| Website, customer and staff sign-in, Shopify webhook | Nothing can be | Yes |

A till used to have its token checked and its work done on one connection; it now takes two, one after the other, so it can be known to be a till while its body arrives.

## Size limits

A route that reads over 2 MB says so when it's registered: `route(method, path, handler, { maxBody, upload, answerOverflow })`. The read keeps at most `maxBody`, then stops. The route's own reader still refuses in the route's own words, and cuts the connection if more of the body is still to come. One small change: a route with a limit under 2 MB (a sign-in form post, 10 KB) now reads a body up to 2 MB, so when the whole of it has arrived it can be answered rather than cut off.

The seven upload routes: a job's attachment, a product photo, the logo, the hero image, a Citrus Lime file, a booking with photos, a photo for a line.

## Deadlines

30 seconds for a small route, which is 2 MB at about 530 kilobits a second, and 4 minutes for an upload, under Node's own 5 minutes for a whole request. The timer starts when the read starts and no byte resets it. `WH_BODY_DEADLINE_MS` and `WH_UPLOAD_BODY_DEADLINE_MS` shorten them in tests.

## Limits on reads

Taking the connection out of the wait also takes away what used to cap reads at 10 at once. A booking can be about 73 MB with no sign-in, so these are needed:

- 10 requests with a body at once per address, and 200 for the server;
- 100 MB held per address (one full booking and room to spare), and 300 MB for the server.

A place and its bytes are given back when the request is over, however it ended. The address is `clientIp`, so a forwarded address is believed only with `TRUST_PROXY=1`. Caddy and the gateway each overwrite that header, so it can't be chosen by the caller on either path.

Staff and tills are outside these, so a flood from anyone with no sign-in can't turn them away. The cost: a flood from more than 20 addresses can fill the 200 places, and then customers and new sign-ins get 429 until those requests hit the deadline.

## The Citrus Lime send

A shop sends one file at a time, and an existing test holds that true while an upload is stalled. Reading first would put that check after the file has arrived. So a route may register `beforeBody`, run on a connection given straight back: it checks who is sending, takes the place, and returns how to let go, or returns nothing if it has answered. The dispatcher lets go when the request is over, however it ended.

## Paying for an order

The route reads its body before `BEGIN`. Reading first already makes that read instant; this also means a body that can't be parsed never opens a transaction, which is what the test watches. One thing changes: a body that can't be parsed gets its 500 before the check that the order exists, not after.

## After this

A client going away now ends in `readBodyFirst`, and a request with no body is held as empty, so no route's reader meets the stream on a request the dispatcher has handled. So the five `ClientGoneError` catches in the dispatcher and the rethrow on Cancel booking, from `dropped-request-releases`, could no longer be reached, and have gone. `tests/dropped-request.test.js` is unchanged and still passes. The readers keep their own handling of the stream.
