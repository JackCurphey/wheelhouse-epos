# Proposal: review requests, the message and when it goes

## Why

Account and reminders decision 5 (Jack, 1 Oct): "A review request after
collection: an automatic message, off by default. Switched on in Settings ›
Messages, where the shop picks the review page (such as its Google page) and
when it is sent ([n] days after collection). Every customer gets the same
link". Decision 8: the same tick that says yes to service reminders is the
customer's yes to a review request.

Drawn and agreed (`ac-review-first`, `ac-review-setting`, `account.mjs:229-241`):
- "Thanks for coming to [Shop name], [Customer’s first name]. If you have a
  minute, we’d love a review: [Link to review]."
- "Stop these: [link]" can't be taken off;
- "Add your review page first, then switch this on."

Service reminders (#483 to #493) built the yes, the sending, "Stop these" and
the stop page. Jack's lane.

## What Changes

- **A Review request message,** off until the shop switches it on, which
  needs its review page first.
- **The shop's settings** gain its review page (a web address) and the days
  after collection (1 to 60, starting at 2).
- **Set up when a bike is collected** for a customer who said yes to review
  requests, going at the shop's opening time on the day that many days
  after.
- **Checked when it goes:**
  - the customer still says yes;
  - the message is on, with a review page;
  - the bike is still collected.

  Its words and the page's address are written then.
- **"Stop these"** has its own stop link. The stop page names review
  requests: "Stop review requests?", "Review requests stopped" and "Review
  requests are on again".
- **Migration 080:** the review page and days, and review requests as a
  kind a stop code can stop.

## Capabilities

### Modified Capabilities

- `messages`: the review request.

## Out of scope

- **The Settings › Messages box for it** (`ac-review-setting`): the next
  pull request. Until then it shows as a plain message row, off, and can't
  be switched on without a review page.
