# Design

`src/screens/messages/messages-page.tsx`, registered as the `messages`
screen. The list reads `GET /api/job-notes/conversations?filter=…` and
refreshes every 30 seconds while the page is open (staff side, no guess
limit; there are no live updates yet, WP-1.9). The open conversation is in
the address (`?job=`), so Back works and a link can open one. It reads the
job (`GET /api/workshop-jobs/:id`), its customer's phone
(`GET /api/customers/:id`) and its notes (`GET /api/workshop-jobs/:id/notes`).

Send reply posts `POST /api/workshop-jobs/:id/notes`; the reply says whether
the text went and how (`message.channel`): "Sent to Maya by text, with a link
to reply on the job’s page.", or why not. Before sending, the hint under the
box says the reply goes the way the customer chose, as the page's own note
does. See the text Maya gets opens the text from the job's messages
(`GET /api/messages?jobId=`), the newest Reply from the shop.

Open the job goes to the diary with the job open (`/workshop/diary?job=`), as
the Overview does.

## From the fresh review
- All lists those needing a reply first, then the newest (`conversations()`);
  answered rows say "You: …".
- The open conversation is read again every 30 seconds too; a load failure
  shows "Wheelhouse couldn’t load this conversation." with Try again and no
  reply box.
- On a phone, back to the list goes back in history, so the phone's own Back
  doesn't reopen it; focus moves to the conversation's heading.
- Replies half typed are kept per conversation; the not-sent reasons from the
  server are causes only, so the bar never repeats "no text went".
