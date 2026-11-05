## Where the read happens

`readBodyFirst` (`server/lib/read-body-first.js`) runs in the dispatcher, on each branch, just before the connection is taken. It keeps the bytes against the request (`holdRequestBody`); `readJsonBody` and `readRawBody` then use them and the routes are unchanged. A request with no body (no length and not chunked) has nothing to wait for and takes no place.

| Branch | Checked before the read | Gate, and what it counts by |
|---|---|---|
| Signed-in staff | Session, which gives its connection straight back | Signed-in, by shop |
| Till | Token, on a connection it gives straight back | Signed-in, by shop |
| Website, customer sign-in | Nothing can be | Website, by address |
| Staff sign-in | Nothing can be | Staff sign-in, by address |
| Shopify webhook | Nothing can be | Webhook, by address |

A till used to have its token checked and its work done on one connection; it now takes two, one after the other, so it can be known to be a till while its body arrives.

## Size limits

A route that reads over 2 MB says so when it's registered: `route(method, path, handler, { maxBody, upload, answerOverflow })`. The read keeps at most `maxBody`, then stops. The route's own reader still refuses in the route's own words, and cuts the connection if more of the body is still to come. One small change: a route with a limit under 2 MB (a sign-in form post, 10 KB) now reads a body up to 2 MB, so when the whole of it has arrived it can be answered rather than cut off.

The seven upload routes: a job's attachment, a product photo, the logo, the hero image, a Citrus Lime file, a booking with photos, a photo for a line.

## Deadlines

30 seconds for a small route, which is 2 MB at about 530 kilobits a second, and 4 minutes for an upload, under Node's own 5 minutes for a whole request. The timer starts when the read starts and no byte resets it. `WH_BODY_DEADLINE_MS` and `WH_UPLOAD_BODY_DEADLINE_MS` shorten them in tests.

## Limits on reads

Taking the connection out of the wait also takes away what used to cap reads at 10 at once. A booking can be about 73 MB with no sign-in, and a signed-in cookie could open any number of 21 MB uploads, so limits are needed: in a container of 1 GB with no swap, 47 stalled uploads stopped the server.

| Gate | Reads at once, per key / overall | Bytes held, per key / overall |
|---|---|---|
| Website and customer sign-in | 10 / 200 | 100 MB / 200 MB |
| Staff sign-in | 10 / 100 | 10 MB / 20 MB |
| Shopify webhook | 10 / 100 | 30 MB / 30 MB |
| Signed-in staff and tills | 200 / 2000 | 150 MB / 250 MB |

Together that is at most 500 MB. 100 MB leaves room for one full booking. 150 MB is a full Citrus Lime file and five attachments arriving at the same moment.

**A place is held only while the body is being read.** Once it has all arrived, the database pool limits the work; holding a place through the work turned away honest customers (6 of 30 complete small requests sent together). Bytes are counted until the request is over, because they are memory until then.

**The gates are separate,** so stalled bookings can't stop a shop's staff signing in, a public flood can't use up what staff and tills have, and one shop can't use up another's share of its 150 MB.

**Giving back.** Bytes come back when the answer has gone (`finish`), or when the connection goes (the socket's `close`). The response's own `close` isn't used: on Node 22, the version the Dockerfile uses, it never fires for a pipelined response that was never given the socket, and a place was lost for good. A read going no further gives everything back at once.

The address is `clientIp`, so a forwarded address is believed only with `TRUST_PROXY=1`. Caddy and the gateway each overwrite that header, so it can't be chosen by the caller on either path.

The cost: ten stalled bookings from one address still block customers sharing that address, such as a mobile network, from the website gate for up to 4 minutes. A flood from more than 20 addresses can fill the 200 places, with the same effect on everyone using the website until those requests hit the deadline.

## Known, no code

- Through Caddy, a quiet client never hears the 408 or 429. Nothing is held in the app. Caddy's `enable_full_duplex` might help, but that is deployment config: it needs Jack's approval and a check against Caddy's docs.
- A full Citrus Lime file at between about 1.12 and 1.4 megabits a second arrived inside Node's 5 minutes, and now misses the 4-minute deadline.

## The Citrus Lime send

A shop sends one file at a time, and an existing test holds that true while an upload is stalled. Reading first would put that check after the file has arrived. So a route may register `beforeBody`, run on a connection given straight back: it checks who is sending, takes the place, and returns how to let go, or returns nothing if it has answered. The dispatcher lets go when the request is over, however it ended.

## Paying for an order

The route reads its body before `BEGIN`. Reading first already makes that read instant; this also means a body that can't be parsed never opens a transaction, which is what the test watches. One thing changes: a body that can't be parsed gets its 500 before the check that the order exists, not after.

## After this

A client going away now ends in `readBodyFirst`, and a request with no body is held as empty, so no route's reader meets the stream on a request the dispatcher has handled. So the five `ClientGoneError` catches in the dispatcher and the rethrow on Cancel booking, from `dropped-request-releases`, could no longer be reached, and have gone. `tests/dropped-request.test.js` is unchanged and still passes. The readers keep their own handling of the stream.
