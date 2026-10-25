# Proposal: the review request's box in Settings › Messages

## Why

Review requests are built (#494), off until the shop switches them on with
its review page. The box where a shop does that is drawn and agreed
(`ac-review-first`, `ac-review-setting`, `account.mjs:229-241`; account and
reminders decision 5, audit M6). Jack's lane.

## What Changes

The review request's Edit opens its own box, as drawn, instead of the plain
wording box:
- the title "Review request", with "Sent after a bike is collected";
- "Send review requests", a switch that can't go on until there's a review
  page, saying "Add your review page first, then switch this on.";
- "Your review page", with "Paste the link to your review page" and "Where
  the link goes — your Google page, say.";
- "Send it [n] days after collection";
- the wording, with its three tap-ins and the fixed "Always added at the
  end: “Stop these: [link]”. It can’t be taken off.";
- a text preview;
- "Everyone gets the same link — Google doesn’t allow asking only happy
  customers. Only customers who said yes get it.";
- Cancel and Save.

Save writes the page and the days, then the switch and the wording. The
shop's refusals show in the box.

## Capabilities

### Modified Capabilities

- `settings`: the shop sets up review requests.
