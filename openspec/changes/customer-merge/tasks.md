# Tasks

- [x] 1.1 Migration 068, from empty on a scratch database; row-level security
- [x] 1.2 Server tests first (`tests/customer-merge.test.js`): possible duplicates by phone (+44 alike) and email, not dismissed ones, not another shop's; merge moves every kind of row and the chosen fields, hides the other; undo puts it all back; after 30 days the other is removed and undo refused; both with online accounts refused; Staff can merge; another shop's never. Watch each fail
- [x] 1.3 Build `server/routes/customer-merge.js`. Verify 1.2
- [x] 2.1 Screen tests first: the notice and Check; the pop-up as drawn, only what differs, the choices; Merge, the page after; They're different people; the Undo line and Undo. Watch each fail
- [x] 2.2 Build them; a browser test
- [ ] 2.3 Log what's decided; `/review`; fresh review; lint and tests; archive as the last commit
