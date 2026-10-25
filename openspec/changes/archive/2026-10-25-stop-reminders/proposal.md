# Proposal: "Stop these" for service reminders

## Why

Account and reminders decision 6 (Jack, 1 Oct): every reminder ends "Stop
these: [link]", which switches that kind off at once, with no signing in,
and says so. Jack's answer 5 of 25 Oct
(`docs/decisions/2026-10-25-morning-questions.md`) says it stops on a button
press, not when the link is opened, so a phone or email app checking the
link can't stop reminders by accident.

The stopped page is drawn and agreed (`ac-stopped`, `ac-stopped-on`,
`account.mjs:251-258`):
- "Service reminders stopped", then "We won’t send you service reminders
  any more. Job updates about a bike that’s with us still come as usual.",
  and "Turn them back on";
- "Service reminders are on again", then "We’ll remind you when your bike
  is due its next service. Stop them any time with the link at the end of
  each one."

Sending service reminders is #488. Jack's lane.

## What Changes

- **A stop code for each reminder.** It is made when the reminder is set
  up, kept only as its hash, and works with no signing in and no expiry.
  The link is kept with the message and put back after the shop's words
  when it goes. While sending is pretend it reads "[link]", as every
  pretend link does.
- **The stop page,** `/book/:shopSlug/stop/:code`:
  - first, "Stop service reminders?" with one button (answer 5; not
    drawn);
  - after the press, the drawn "Service reminders stopped" with "Turn them
    back on";
  - after turning them back on, the drawn "Service reminders are on again".
- **Turning them back on** is a yes again, recorded with when and that it
  came from the stop page.
- **Migration 079:** the stop codes, the message's kept ending, and "stop
  page" as a place a yes can come from.

## Capabilities

### Modified Capabilities

- `book`: the customer's stop page.

## Out of scope

- **Review requests' own stop.** That message isn't built; the code
  already says which kind it stops.
- **The drawn "Sign in to your account" line.** There's no customer
  account to sign in to yet (WP-1.7).
