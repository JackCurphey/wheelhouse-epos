# Tasks: the diary's passing messages float

## 1. Tests first, each watched failing

- [x] 1.1 In a real browser, pressing New job leaves the diary where it was (it moved 74px)
- [x] 1.2 The choose-a-time bar and a refused move's message are in the floating area; the message closes

## 2. Build

- [x] 2.1 A floating area at the bottom of the screen; the bar and the message in it; the message's close button

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: on a phone the bar sits above the chosen card's bar in the foot of the page, not over it or the last hour; the focus goes to Enter a time instead; room is kept at the foot of the page
- [x] 2b.2 The fixes; the floating area sits under menus; the phone's New job clears an old move message (not covered by a test)

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
