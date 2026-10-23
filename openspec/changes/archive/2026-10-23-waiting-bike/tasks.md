# Tasks: each "Waiting for you" item carries the bike

## 1. Server — Mark

- [x] 1.1 Tests first, watched failing: every kind of waiting item carries the bike ("Specialized Sirrus", from the `diary` drawing); a booking without a bike carries `null`; the new booking's full item includes `bikeLabel` (`tests/workshop-waiting.test.js`: 3 of 13 failed, the field missing)
- [x] 1.2 The waiting query joins the bike and `waitingItem` carries `bikeLabel` (`server/routes/workshop.js`, Jack's area: his approval on the pull request)
- [x] 1.3 A fresh review; `npm test` passes; merged

## 2. Screens — Jack (after 1 merges)

- [x] 2.1 The tablet and phone Waiting cards draw the bike line from `bikeLabel`

## 3. Checks

- [x] 3.1 `npm test` and `npm run test:browser` pass; archived as the last commit of the pull request
