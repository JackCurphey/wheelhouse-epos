# Design: Today

## Context

The staff app already routes `/workshop/today` (Office › Today) to a "Not built
yet" page, and lands the Owner there. The Workshop Overview works out today's
figures in the browser from `GET /api/workshop-jobs?start=&end=` and
`?custody=in_shop`, with its own Book in (storage slots included). Quotes carry
`sentAt` and `reminderSentAt`; the diary and job page already say "No answer
yet" by the same rule (quote-no-answer). Customers' messages needing a reply
come from `conversations('needs-reply')` (`server/workshop/job-notes.js`).

## Goals / Non-Goals

**Goals:** the drawn page with the parts that have data; one place on the
server that later packages add their lines to. **Non-Goals:** see the proposal.

## Decisions

1. **Needs attention comes from the server, one list for every kind.**
   `GET /api/needs-attention` returns `{ items: [...] }`, each with a `kind`
   (`quote_no_answer`, `replies`) and what its line shows. Later packages add
   kinds here, so Today's screen grows a line per kind and nothing else
   changes. *Alternative:* work it out in the browser from the job list.
   Rejected: a quote waiting days on a job not booked today wouldn't be in
   today's jobs, and every later kind would need its own fetch.
2. **"No answer" uses the job page's rule**: the job's current quote is sent,
   its one reminder has gone, and nothing is answered, whatever the job's
   date. The line's phone is the customer's. Oldest first.
3. **Owner only, until roles.** The route uses `ownerOnly`, as Settings do;
   WP-1.1 later opens it to Managers and "Can close the day" (decision 4).
4. **Workshop today shares the Overview's working**: the expected, still to
   arrive, ready and in-the-shop rules, the due-time rule for Book in, and
   Book in with storage slots move into a shared module the Overview and
   Today both use, so the two pages can't disagree. *Alternative:* copy them.
   Rejected: two copies drift.
5. **Record their answer opens the job** (`/workshop/diary?job=[id]`), where
   the quote's Record their answer already is, as Messages' "Open the job"
   does. *Alternative:* a pop-up on Today. Rejected: a second copy of the
   answer form.
6. **No live updates yet**: Today reads again every 60 seconds and when the
   window regains focus, as the diary does, until WP-1.9.

## Risks / Trade-offs

- [The Overview changes under the move] → Its own tests must pass unchanged
  before and after the shared module.
- [Needs attention grows slow as kinds are added] → Each kind is one query;
  revisit if it grows past a handful.
