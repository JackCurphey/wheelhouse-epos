# Tasks: the diary on an upright tablet

## 1. Drawing

- [x] 1.1 `uprightTabletDiary()` drawn from the tablet's pieces; Jack approved the picture

## 2. Tests first, each watched failing

- [x] 2.1 In a real browser at 834 wide: no Waiting column, a Waiting button that opens the list, New job on the second row
- [x] 2.2 At 1280 wide the column stays and there's no button (a guard; it passed before and after)

## 3. Build

- [x] 3.1 The shared Waiting sheet; the two-row toolbar below computer width; the column from computer width

## 3b. After the fresh review

- [x] 3b.1 Test first, watched failing: a card chosen from the sheet on an upright tablet shows the chosen bar with Open at the foot of the page
- [x] 3b.2 The chosen bar shared with the phone; on an upright tablet the passing messages sit at the foot with it, as on the phone; the computer test runs at 1280
- [x] 3b.3 Noted, not changed: the Waiting button is named "Waiting for you, n" while it shows "Waiting n", as the phone's is

## 4. Checks

- [x] 4.1 A fresh review; `npm test` and `npm run test:browser` pass; the drawings build and fit
