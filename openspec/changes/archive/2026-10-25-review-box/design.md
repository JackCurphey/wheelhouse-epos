# Design: the review request's box

## Decisions

1. **Its own box** (`ReviewRequestBox`), opened by the review request's
   Edit. The plain wording box doesn't have a switch, a page or days. It
   follows the plain box's look for the wording, tap-ins and text preview.
2. **The switch** can go on once the page box has something in it, typed or
   saved. Before that it's disabled, with the drawn line under it (audit M6).
3. **Save, in order:**
   - first `PUT /api/workshop-settings` with `reviewPageUrl` and
     `reviewRequestDays`;
   - then `PUT /api/message-templates/review_request` with `enabled` and the
     wording, if it changed.

   The server refuses the switch without a page, so the page goes first. A
   refusal shows in the box, which stays open.
4. **The preview** follows the typed wording through the existing preview
   route, which now ends with "Stop these" for the review request (#494).
