## Cause

`readJsonBody` and `readRawBody` in `server/lib/http.js` waited for the request's `end` or `error`. Node destroys a request when its connection is reset, and tells only listeners already attached. A route that reaches the read after that (it looks up the session or the till first) attaches its listeners to a stream that will never speak again, so the promise never settles, and `runWithShop`'s `finally`, which releases the connection, never runs.

## The read

One shared `readBody`, which both readers call:

- Already read to its end: an ordinary error (`Request body already read`), because the client is fine and the code is wrong. This is checked first, because Node also marks a normal request destroyed once it is finished with, so `destroyed` alone doesn't mean dropped.
- Destroyed and not ended: `ClientGoneError`.
- While reading, `error` and `close` each end it with `ClientGoneError`. `close` after `end` does nothing, because the promise has settled.

An aborted request is always a destroyed one (Node sets the first only while destroying), so it needs no check of its own, and `req.aborted` is deprecated.

## A dropped request

`ClientGoneError` passes up through `runWithShop` like any failure, so an open transaction rolls back and the connection is released. It must not be swallowed any lower than that: returning normally would commit, in the `transaction` tenant mode, and run `afterRelease` work. The dispatcher's catches for a till, customer sign-in, staff sign-in, the website and signed-in staff return without logging or answering. A Shopify webhook's read has its own catch and logs nothing already.

`sendJson` writes nothing when `res.destroyed` and nothing has been sent. This covers the routes that catch a failed read themselves and answer 400. It tests the response, not the request, because a normal request's stream is destroyed while its response is still to come. Once a response has been sent, a second answer still throws as it always has.

## Routes that catch the read

Every catch around a body read was checked. All answer and return, except that four use `.catch(() => null)`: three then refuse a null body, and `booking-links/:code/cancel` carries on, since its body is optional. Only that one had to change, so it now rethrows `ClientGoneError`. A cancel whose body arrived whole and whose client then went away still goes through, as the customer did finish asking.

## Other readers

There are no others: `readBody` is the only reader of a request's stream in the app, and uploads (product photos, logo, hero image, job attachments, booking photos, the Citrus import) all read through `readJsonBody`. The Citrus import's per-shop "another file is going" mark is cleared in a `finally`, so it now clears. `server/gateway.js` pipes the stream on and is bounded by its 5-second limit.
