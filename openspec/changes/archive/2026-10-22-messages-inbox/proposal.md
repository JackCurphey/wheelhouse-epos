# Proposal: the staff Messages inbox

## Why
WP-4.5's third piece. Decision 7 (`docs/decisions/2026-10-01-account-and-reminders-review.md`):
the two-pane staff inbox, "Needs a reply" first. Drawn as `inbox()` in
`generator/account.mjs`: ac-inbox, ac-inbox-sent, ac-inbox-all,
ac-inbox-list (phone), ac-inbox-empty, ac-reply-text. The server is
`notes-with-the-shop` (#421); the customer's card is `notes-card`.

## What changes
Front desk › Messages (`/workshop/messages`, today a placeholder) becomes
the inbox:
- the drawn note, "Needs a reply · n" and "All", the conversations (name,
  bike and job number, the newest words, when, "Needs a reply" in words);
  "Nothing needs a reply. Every conversation is under All." when none do;
  "Choose a conversation to read it." with none open;
- the open conversation: the customer, their bike, the job number and phone,
  Open the job, "On the job’s page · started by Maya", the thread, and Reply
  with Send reply; after sending, the drawn bar saying how it went, See the
  text Maya gets, and Reply again;
- on a phone, the list, then the conversation with "Messages · needs a reply
  n" to go back.

## Not in this change
"Customer page" (the Customers page isn't built yet); questions from a
customer's account; "2 messages need a reply" on Today.
