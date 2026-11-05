## What was measured

`node:22-alpine` at 1 GB with no swap, where V8's heap limit is about 524 MB. Each case parses the bodies and keeps them, as a request waiting on its work does.

| Body | At once | Result |
|---|---|---|
| 69 MB of `{}` | 1 | Out of heap, exit 139 |
| 14.7 MB of `{}` | 1 | 317 MB heap |
| 2 MB of `{}` | 1 / 10 | 46 MB / 432 MB heap |
| 2 MB of `{}`, numbers, pairs or empty strings | 100 | Out of heap |
| 73.5 MB of base64 | 1 / 3 | 77 MB / 224 MB heap |
| 14.7 MB of base64 | 13 | 224 MB heap |
| 2 MB with 200,000 values, `{}` | 25 / 100 | 200 MB heap / out of heap |
| 2 MB with 20,000 values, `{}` | 100 | 263 MB heap |
| 73.5 MB with 20,000 values | 2 | 151 to 224 MB heap |

So base64 is safe at its size and tiny values aren't, and a limit safe alone isn't always safe together: 2 MB bodies of tiny values were safe at 10 and fatal at 100.

## The count

`readBodyFirst` counts `{`, `[`, `,` and `:` in each piece of a body as it arrives. Every value in JSON needs one of them, apart from a single value alone. Base64 has none, so a real photo costs nothing here. It's counted before anything is kept, so a body over the limit is refused without being read to its end. A count inside a string counts too, since telling them apart would be parsing; a booking's notes are limited far below this.

| Gate | Values | Small route's limit |
|---|---|---|
| Website and customer accounts | 10,000 | 100 KB |
| Staff accounts | 10,000 | 100 KB |
| Shopify webhook | none, parsed only after its signature | 2 MB |
| Signed-in uploads | 200,000 | 2 MB, or the route's |
| Signed-in small bodies, and tills | 200,000 | 2 MB |

A route that declares `maxBody` keeps it. A small route with no sign-in, over its 100 KB, gets the same 400 and closes. A client still sending when its connection is cut can lose the answer and see only an error, so what's left is read and thrown away, up to 2 MB, holding no memory, with the deadline and the place in the gate as for any read. Past 2 MB the connection closes whether or not the client has heard. The till's sync has no limit on its items, and at 2 MB it could honestly hold about 200,000 values, so the signed-in limit is set there rather than lower.

The answer is a 400 with "That's too much to send in one go.", which the screens already show as a refusal in the server's words, and the connection closes.

## Together, at the limits

On the real server in the same container, with `TRUST_PROXY=1` so one machine could be many addresses, each on a fresh server, the health check asked every few hundred milliseconds for 25 seconds:

| Scenario | Peak memory | Health check |
|---|---|---|
| Full bookings ×6, base64 | 300 MiB | 13 of 13 |
| Full bookings ×6, one `€` so the source is two-byte | 296 MiB | 13 of 13 |
| Full bookings ×6, at the value limit, with `€` | 291 MiB | 13 of 13 |
| 100 KB sign-ins ×200 at the value limit | 102 MiB | 13 of 13 |
| 100 KB sign-ins ×400 at the value limit | 154 MiB | 13 of 13 |
| Photos for a line ×13, 13.9 MB, at the value limit | 273 MiB | 13 of 13 |
| Signed in: 1.9 MB at 199,000 values ×27 across 3 shops | 122 MiB | 13 of 13 |
| Signed in: 20.9 MB uploads at 199,000 values ×20, 2 shops | 310 MiB | 13 of 13 |
| All of the above kinds at once | 383 MiB | 13 of 13 |

The byte limits on each gate let in only two or three full bookings at a time, and most routes parse only once they have one of the 10 connections. That's what keeps these together under the heap limit, along with the count.

## How far these figures have been checked

The independent review of this change did not run its memory and body-shape probes. The memory figures in this document are the author's own measurements, and haven't been independently reproduced.

## Not covered

- A Shopify webhook with a good signature has no count, so only the holder of a real secret could send a costly body.
- `batchProblem` in `server/till/sync.js` has no cap on a batch, so only the 2 MB and 200,000 limits apply to a till's sync.
- Memory here is sampled, so a peak between samples isn't seen. The heap was never near its limit in the samples, and no scenario stopped the server.
