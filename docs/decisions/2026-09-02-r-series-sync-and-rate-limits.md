# Lightspeed R-Series — how we stay in sync, and what it costs

**Date:** 2 September 2026
**Status:** Research complete. The architecture consequence (§4) and the product
requirement (§5) need Jack's sign-off before they change any plan.
**Closes:** open item 4 of `2026-09-02-lightspeed-first-platform.md` §7.
**Method:** desk research against Lightspeed's own developer documentation.
**No live API call was made**, so every finding is a documentation-level read.

Confidence tags: **[V]** verified against a primary source · **[R]** third-party
reported · **[U]** unverified · **[NF]** searched, not found (not proof of absence).

---

## 1. The short version

R-Series has **no webhooks**. The diary polls. That is a constraint we work
inside, not a blocker, because the API supports a real "what changed since X"
query and the rate limits are generous enough that live sync costs a rounding
error of the allowance.

The expensive part is not staying in sync. It is the **initial backfill** — the
one that makes the migration story true — and that needs to be built as a
resumable, rate-limit-aware job from the start.

## 2. Webhooks — there are none

Nothing in the R-Series developer documentation mentions webhooks, event
subscriptions or push notifications **[V, as "absent from the docs"]**.
Third-party integrators describe polling with a `timeStamp` filter as the
standard pattern and state plainly that R-Series offers no native webhooks
**[R]**.

X-Series *does* have webhooks **[V]**, which makes the R-Series absence look
like a product decision rather than a documentation gap.

**This is not proven absence.** Documentation silence is not the same as a
feature not existing, and the rule is not to treat "it doesn't exist" as settled
without checking. The definitive check is a support question once we hold an
account. Until then: **[R]**, and build for polling.

## 3. What we get instead, and it is better than it sounds

The filtering is real. Supported operators: `=`, `!=`, `>`, `>=`, `<`, `<=`,
`><` (between), `~` (like), `!~`, `IN` (up to 100 values) and `or` **[V]**.
Timestamps are stored in UTC, format `YYYY-MM-DDTHH:MM:SS-00:00`, operators
URL-encoded.

So one request answers "what changed since 14:00":

```
GET /API/V3/Account/{id}/Workorder.json?timeStamp=%3E,2026-09-02T14:00:00-00:00
```

That was the make-or-break question. A "what changed since X" query is the
difference between a design that works and one request per work order, which
would not.

Also available:

- **`load_relations`** pulls nested entities in the same call — costs extra per
  relation, but beats a second round trip **[V]**.
- **Cursor pagination** via `after` / `before`, maximum **100 records per page**.
  The response carries `next` and `previous` URLs; use those rather than
  building cursors by hand **[V]**.
- **`offset` is deprecated in V3** and charges per record skipped **[V]**. Do
  not use it. This is the single easiest way to accidentally build something
  that costs ten times what it should.

## 4. Rate limits

A leaky bucket, allocated **per account *and* client combination** **[V]**.

**That last detail matters more than the numbers.** Our polling draws from our
own bucket, not the shop's. We cannot slow their till no matter how badly we
behave. For a product a shop has to trust next to its livelihood, that is the
single most reassuring fact in this document, and it should be said out loud
when we sell it.

| | Base | Per extra register |
|---|---|---|
| Bucket size | 90 | +10 |
| Drip rate | 1 / second | +0.5 / second |

Costs **[V]**:

- 1 drip minimum per request
- `count` costs **10** — do not use it as a health check
- `load_relations` and complex `or` queries add more
- POST/PUT add 0.5 per nested relation in the payload
- Some endpoints charge more for particular operations

Every response carries `X-LS-Api-Bucket-Level`, `X-LS-Api-Burst-Level`,
`X-LS-Api-Drip-Rate` and `X-LS-Api-Request-Cost` **[V]**. **Throttle from those
headers, never from a fixed sleep.** A 429 returns `Retry-After`. There is a
separate burst limiter over 1-second windows, and repeated violations can
suspend the account.

**A number to confirm before anything depends on it.** Secondary sources say
the bucket is 60; Lightspeed's own rate-limiting page says 90. This document
uses 90 because it is the primary source, but the honest position is that we
have not seen a live response header. Read the real value from
`X-LS-Api-Bucket-Level` on the first call and trust that over both.

### What it means in practice

**Live sync is comfortable.** A one-register shop — the floor — gives 60
requests per minute sustained. Polling changed work orders every 30 seconds
costs 2 of them. We could poll every 5 seconds and still use a fifth of the
smallest allowance in the market.

**The backfill is the real constraint.** At 100 records per page and 1 request
per second: 100,000 historical sales is roughly 1,000 requests, about 17
minutes. A million records is nearer three hours. Fine as a one-off overnight
job, and only fine if it is resumable, restartable and reads the bucket headers
rather than sleeping on a timer.

That backfill is the migration story from
`2026-09-02-lightspeed-first-platform.md` §4. It is the thing no competitor has
a reason to build, so it is worth building properly rather than as a script
somebody runs once.

### The open question this could not settle

**Does `timeStamp` on `Workorder` update when a child row changes?** **[NF]**

If a `WorkorderLine` is edited or labour hours are added and the parent's
`timeStamp` does not move, polling parent work orders **silently misses
line-level edits** — the diary would show a job as unchanged while its contents
changed underneath. The workaround is polling `WorkorderLine` separately, which
roughly doubles the request cost of the live loop.

This is a genuine design fork and it cannot be answered from documentation. It
is the **first thing to test against a live account**, before the sync loop is
written rather than after.

## 5. Product requirement — make the lag legible, and let it argue for us

Raised by Jack, 2 September 2026: the shop should understand that slow job
updates are Lightspeed's constraint, not ours — no webhooks means we poll —
and that moving fully to Wheelhouse removes the lag entirely.

Clarified by Jack the same day: **the point is not to blame Lightspeed. It is
that the delay must be unambiguously attributed to Lightspeed's limitation and
never mistaken for slowness in our software.**

**Accepted. That attribution is the requirement; the framing below is how it
survives contact with a real shop.**

**The success criterion, stated plainly.** A shop owner who notices the lag
should be able to say what causes it without asking anyone. If they cannot —
or worse, if they assume our software is slow — the feature has failed, however
accurate the underlying timestamp is. Everything below serves that one test.

The attribution is true, and a shop deserves to know why its till and its diary
are a minute apart. But how it is said decides whether it works:

1. **It has to stay true.** The claim is only honest while the lag really is
   Lightspeed's constraint. If we poll every five minutes because it was easier,
   a message blaming Lightspeed for a five-minute delay is a lie we told
   ourselves first. **The message is only permitted while our polling interval
   is genuinely tight** — if the interval is ever relaxed, the message changes
   with it. This is a hard rule, not a preference.
2. **State the fact; do not complain.** "Lightspeed last checked 40 seconds
   ago" is more convincing than "Lightspeed is slowing you down." A product that
   attacks the incumbent in its own interface reads as insecure, and the shop's
   instinct is to distrust the newcomer, not the thing it already pays for. The
   fact does the argument on its own.
3. **Explain on demand, not permanently.** A "why?" that opens one plain-English
   sentence — Lightspeed does not notify us when something changes, so we check
   every 30 seconds; jobs created here update instantly — is enough. A banner
   that nags becomes furniture within a week and reads as an excuse.
4. **Show the contrast, do not narrate it.** A job created in Wheelhouse should
   visibly have no sync indicator at all, because it needs none. The absence is
   the argument.

**Implementation shape.** A per-shop last-successful-sync timestamp, surfaced as
relative time near anything sourced from Lightspeed, with an expandable
explanation. No task ID yet. It belongs with the read-out sync work, not before
it, because it has nothing to display until that exists.

**The failure mode to design against** is the whole reason this requirement
exists: a shop concluding "this integration is unreliable" rather than
"Lightspeed is the limit." Silence produces exactly that — an unexplained
delay is attributed to whatever the person is looking at, which is us.

Two things decide it. Tone, per the four points above. And the size of the
number: a 40-second figure reads as a system working within someone else's
constraint. A 6-minute figure reads as our software being slow, no matter what
the label next to it says. **If we cannot keep the figure small, we should not
show it — we should fix the interval first.**

## 6. What this changes

| Item | Change |
|---|---|
| Sync architecture | Polling, not webhooks. `timeStamp` greater-than queries against `Workorder`, cursor-paginated at 100 per page |
| Throttling | Driven by `X-LS-Api-*` response headers and `Retry-After`, never a fixed sleep |
| Backfill | A first-class resumable job, not a script. It is the migration story, so it is product, not plumbing |
| `offset` | Banned. Deprecated in V3 and charges per record skipped |
| `count` | Not for health checks — 10 drips |
| New requirement | Sync freshness visible to the shop, per §5, with the honesty constraint attached |
| First live test | Whether a parent `Workorder.timeStamp` moves when a child line changes. Before the sync loop is written |

## 7. What would change these conclusions

- **R-Series turning out to have webhooks after all.** Documented absence is not
  proven absence. A support answer settles it, and the live loop gets simpler.
- **A parent timestamp that does not track child changes.** Doubles the live
  request cost and changes the polling design. §4's open question.
- **A real bucket size of 60 rather than 90.** Does not change the design —
  live sync fits comfortably either way — but it changes backfill pacing.
- **Per-integration buckets turning out to be shared in practice.** If our
  polling can degrade a shop's till, the whole read-out-continuously position in
  `2026-09-02-lightspeed-first-platform.md` §4 needs revisiting. The
  documentation says otherwise, but this is worth watching on a real account
  during a busy Saturday.
