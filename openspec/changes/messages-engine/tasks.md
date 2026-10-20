# Tasks: the messages engine

## 1. Safety guard
- [ ] 1.1 Tests first: the hosted copy refuses real sending keys
- [ ] 1.2 The guard

## 2. Wording and filling in
- [ ] 2.1 Tests first: Wheelhouse's wording; tap-ins filled, missing ones left out; a shop's own wording; switched off
- [ ] 2.2 Migration 048; templates.js; render

## 3. Senders, engine and outbox
- [ ] 3.1 Tests first: the channel; queue, Undo, the timer sends with the pretend sender; the outbox route
- [ ] 3.2 The pretend sender; engine.js; the timer; outbox and undo routes

## 4. Settings › Messages routes
- [ ] 4.1 Tests first: list, change, go back, Owner only, preview
- [ ] 4.2 The routes

## 5. First triggers
- [ ] 5.1 Tests first: quote send queues Quote to approve with Undo on the server; finish queues Bike ready
- [ ] 5.2 The triggers; the quote panel's Undo

## 6. Screens
- [ ] 6.1 Draw the outbox, for Jack's approval
- [ ] 6.2 Tests first, then Settings › Messages (list, edit)
- [ ] 6.3 The outbox screen

## 7. Checks
- [ ] 7.1 A fresh review per piece; `npm test` and `npm run test:browser` pass; archived with the last
