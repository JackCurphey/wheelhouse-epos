# Design

**Server** (`server/workshop/jobs.js`). `WORKSHOP_JOB_SELECT`'s latest-quote
join also takes `sent_at`; a second lateral join takes
`max(sent_at)` of the job's `quote_reminder` messages sent at or after that
quote's `sent_at`, only while the quote's state is `sent` (the same rule the
customer's reply uses in `portal.js`). The job's `quote` becomes
`{ id, state, revision, sentAt, reminderSentAt }`. It uses the existing
`idx_customer_messages_job` index.

**Screens** (`src/screens/diary`). `rules.ts` gains `noAnswer(job)` and
`stateWord(job)`: "No answer yet" for a job in the `answer` state whose
quote has a `reminderSentAt`, otherwise `STATE_LABEL[state]`. The wide
block's line, the month chip's name and day list, and `describe` use
`stateWord`. The quote
panel, for a sent quote with a reminder, shows the warning line above its
buttons, reading the customer's phone from the job page's `['customer', id]`
query (already loaded for its customer strip).
