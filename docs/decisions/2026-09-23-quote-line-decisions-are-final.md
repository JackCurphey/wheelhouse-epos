# A customer's quote line decision is final

Date: 23 September 2026. **Status: decided by Jack in session.** This is a
record of the decision and its consequences, not an implementation. The code
does not yet behave this way — see "What has to change" below.

## The question

`recordLineDecision` (`server/workshop/quotes.js`) lets a customer approve or
decline an individual quote line while the quote is in state `sent`. It does
not check whether that line has already been decided, so a customer can flip a
line between approved and declined as often as they like, right up until the
quote is approved as a whole.

Surfaced on 23 September while reviewing the new quote read endpoints
(PR #58). A reviewer could not tell from the code whether this was deliberate
("nothing is final until the customer submits") or an oversight ("each line is
decided once"). Nothing in the atlas or the earlier decisions answered it.

## The decision

**A line decision is final.** Once a customer approves or declines a line,
that answer stands. The customer cannot change it through the portal.

If the customer changes their mind, they contact the shop — a text to the
mechanic or a phone call. The shop then changes the quote by the route that
already exists for changing a quote: issuing a new revision, which supersedes
the old one per line.

## Why

A customer who has changed their mind is already in a conversation with the
shop, and that conversation is a better channel for it than a workflow. The
shop can ask why, check whether the work has started, and price the change
before anything moves. A self-service reversal gives the shop none of that.

It also keeps what the customer agreed to stable. A line the shop has acted
on — ordered a part, started the labour — cannot silently become un-agreed.

## What was considered and rejected

**Allow re-decision freely (today's behaviour).** Rejected: the shop can find
that agreed work has changed under it with no notice and no record of why.

**Allow re-decision, but flag it to the mechanic to approve or reject.**
Considered and preferred briefly in the same session, then rejected. It needs a
place to record a requested-but-not-yet-decided change, a staff surface to show
it, and approve/reject actions — new schema, new endpoints and a new screen —
to automate something the shop already handles by talking. It also lands on
screens 28 and 39, which have no backing endpoint until P00c and the message
providers are settled.

Recording the reversal deliberately: this decision was taken, reversed, and
retaken inside one conversation. The final answer is the one above.

## What has to change

Not in PR #58, which adds read endpoints only. This is a change to an existing
Phase 3 write route and belongs in its own piece of work.

- `recordLineDecision` must refuse a line whose `decision` is not `pending`,
  the way it already refuses a quote whose state is not `sent` — a 409 naming
  the reason, consistent with `a quote that is <state> is not open for
  decisions`.
- A test that decides a line twice and asserts the second attempt is refused,
  confirmed by removing the guard and watching it fail.
- The Phase 4 plan that builds screen 21 (`approval`) must show decided lines
  as settled, not as controls the customer can still operate, and must say what
  the customer sees if they try — the screen should not offer an action the API
  will refuse.
- Screen 22 (`approval-done`) already shows what was agreed; no change expected
  there, but confirm it reads correctly once lines cannot move.

## Consequences

The customer's route back is a new revision, which the shop controls. That path
already exists and already supersedes per line, so nothing new is needed for
it.

A quote with every line decided is complete and can be approved. Nothing about
this decision changes the approve path or the totals.
