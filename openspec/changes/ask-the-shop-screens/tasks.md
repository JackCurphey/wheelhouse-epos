# Tasks

## 1. Tests first (each watched failing for the right reason)

- [ ] 1.1 `tests/customer/conversation.test.js`: the route; signed out goes
  to sign-in and back; the heading, "Your account" back, the thread on its
  sides, "About WH-1042 ›" opening the repair; the box's two labels; Send
  posts and announces "Sent. …"; an empty box sends nothing; a refusal says
  why.
- [ ] 1.2 `tests/customer/account.test.js`: "Ask the shop a question" in
  the header opens the conversation; the Messages row, Replied under
  Earlier and Sent under Now, opening the conversation, shown under
  Everything only.
- [ ] 1.3 `tests/screens/messages-inbox.test.js`: one row per customer from
  the new list, `?customer=`; a general row's "From their account"; the
  thread with "About WH-1042"; the reply posts with the newest repair's
  `jobId`, or none for general, and says how it went; the text for each.
- [ ] 1.4 `tests/job-notes.test.js` and `tests/fixtures/route-list.txt`: the
  old list route is gone.
- [ ] 1.5 `tests/browser/conversation.spec.ts`: sign in with the pretend code,
  send a message, staff reply, the customer sees it, at computer and phone
  widths, nothing scrolling sideways.

## 2. Build

- [ ] 2.1 `MESSAGES_ROUTE`, `ConversationScreen`, `BookFrame`'s `backLabel`
  and width.
- [ ] 2.2 The account's header button and Messages row.
- [ ] 2.3 The inbox on the per-customer routes.
- [ ] 2.4 Remove `GET /api/job-notes/conversations` and `conversations()`.
- [ ] 2.5 Redraw `ac-inbox*`; rebuild; the mockup's links and checks.
- [ ] 2.6 `decided-while-building.md`.

## 3. Check

- [ ] 3.1 Break each key behaviour on purpose and watch its test fail.
- [ ] 3.2 The touched tests, the route list, the new browser spec, and
  `npm run lint` pass.
- [ ] 3.3 The full `npm test` and `npm run test:browser` before the pull
  request, with `/review`.
