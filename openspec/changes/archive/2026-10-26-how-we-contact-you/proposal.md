# "How we contact you" on the customer's account

## Why

Account and reminders decision 6 (Jack, 1 Oct) gives one "How we contact
you" section:
- Job updates by Text, WhatsApp or Email. The way can change, but job
  updates can't be switched off while a job is in.
- Three switches: Service reminders, Review requests, and Offers and news.

It's drawn as `ac-contact` and `ac-contact-changed`. The account shows these
read-only today; "Change" was left out until the account page existed
(`decided-while-building.md`, 26 Oct, account screens 1). The stop page's
"Sign in to your account" line waited for the account too
(`decided-while-building.md`, 25 Oct, stop reminders).

**Risky areas:** a migration (086), and customer accounts and public routes
(`/api/portal/*`).

## What changes

- **"Change"** beside "How we contact you" on the account opens the drawn
  box, "How we contact you", "Changes save straight away". It holds:
  - Job updates by Text, WhatsApp or Email, with the drawn note;
  - the three switches, each with its line;
  - the drawn note, and Done.

  Each change saves at once and says so ("Service reminders are off").
- **`PUT /api/portal/:shopSlug/me/contact`** saves any of these four. It
  refuses another website, and refuses text or WhatsApp with no mobile
  number. Saying yes to reminders or review requests here is recorded as a
  yes from the account (migration 086).
- **`GET /me`** gives WhatsApp as WhatsApp, rather than as text.
- **The stop page,** once something is stopped, adds the drawn line: "Want
  to change anything else? Sign in to your account and go to “How we
  contact you”."
