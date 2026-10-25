# Design: review requests

## Decisions

1. **Off by default.** `TEMPLATES.review_request.offUntilOn` makes
   `templateFor` read it as off until the shop has its own row. Switching it
   on is refused ("Add your review page first, then switch this on.") while
   the shop has no review page. Clearing the page while it's on is refused
   too: "Switch review requests off first."
2. **Settings:**
   - `workshop_settings.review_page_url` is a web address starting http://
     or https://, up to 500 characters, or empty for none.
   - `review_request_days` is from 1 to 60. It starts at 2, a choice made
     here and logged; the drawing shows "[n]".
3. **When it goes.** The shop's date of collection plus the days, at that
   day's opening time or the next open day's, as service reminders do
   (Jack's answer 4). `dueAt` is shared.
4. **One per job,** set up on collect, undone on reopening the collection,
   and set up afresh on a second collect.
5. **Checked and written when it goes,** as the service reminder is:
   - the job's customer now still says yes;
   - the message is on;
   - there is a review page;
   - the job is still collected.

   [Link to review] is the shop's page now. It's the shop's own address, so
   it's real even while sending is pretend.
6. **"Stop these"** uses a code of kind `review_requests`. Stopping clears
   `review_requests` only, and turning back on is a yes from the stop page.
   The stop page reads the same for each kind with its own name (audit M5).
