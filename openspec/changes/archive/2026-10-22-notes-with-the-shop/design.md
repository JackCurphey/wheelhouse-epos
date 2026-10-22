# Design

## The table
`job_notes (id, shop_id, workshop_job_id → workshop_jobs ON DELETE CASCADE,
from_customer BOOLEAN, login_id → logins NULL, body TEXT 1–1000, created_at)`,
RLS as every shop table. A conversation is a job's notes; it **needs a
reply** when its newest note is the customer's. Kept apart from
`customer_messages`, which records messages sent, so the thread holds the
words themselves and the text that tells the customer is a message like any
other.

## The customer's side
`resolveBookingLink` as the other booking-link routes (its code, its expiry,
its limit on guesses). A note: trimmed, 1–1000 letters ("Write a note of up
to 1,000 letters."). The reply lists the job's notes oldest first: who
("You", or the shop's name, with the member of staff's name only when the
shop's "Show who signed off to customers" switch is on, as quotes), when,
and the words.

## The staff side
The list: one row per job with notes, newest note first: the customer's
name, the bike, the job's reference, the newest note's words and time, and
needsReply; `filter=needs-reply` keeps those needing one, with the count.
A reply: trimmed, 1–1000 letters, saved with who wrote it, then
`queueMessage('shop_reply')` at once with [The shop’s reply] and the job's
link (a customer who gets nothing keeps their link, as Bike ready). The
reply reports whether the text went, as Send quote does.

The `shop_reply` wording, from ac-reply-text: "[Shop name] replied about
your [Bike] ([Job number]): [The shop’s reply]. Replies to this number
aren’t read — reply on your page: [Link to the job]".
