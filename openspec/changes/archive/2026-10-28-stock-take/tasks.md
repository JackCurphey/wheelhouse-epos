# Tasks

## 1. Server (pull request 1, `jack/stock-take`)

- [x] 1.1 Tests first: migration 099 from an empty scratch database and run twice (`tests/migration-099.test.js`); the routes (`tests/stock-take.test.js`: start for the Owner only, each kind and its checks; areas used before; join, scan, type, take off; blind; twenty scans at once; stock untouched; a count's own products only; still to find; finished and back to counting; each shop sees only its own). Watch each fail
- [x] 1.2 Migration 099, `server/routes/stock-takes.js`, registered in `server/routes/index.js`
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [x] 1.5 Lint, typecheck, the touched tests; `/review` (migration, stock): 28 Oct, two rounds, all findings fixed

## 2. Screens (pull request 2, `jack/stock-take-screens`, stacked on 1)

- [x] 2.1 Tests first: Stock take for the Owner and Staff, Start a count, counting and below zero (`tests/screens/stock-take.test.js`); the shell no longer shows the placeholder; a browser spec. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [x] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, the browser specs; `/review`
- [x] 2.5 `/opsx:archive` as the last commit

## 3. Checking and applying (server on pull request 1, screens on 2)

- [x] 3.1 Tests first: migration 099 (renumbered; the draft 098 tables brought up to date); check, last-count rule, apply with its history line, Undo, Recount, Count them as none, Download, two applies at once, a sale while applying (both orders), no deadlock with a sale in another order, other shops refused. Watch each fail
- [x] 3.2 `server/lib/stock-take-differences.js`, the routes in `server/routes/stock-takes.js`
- [x] 3.3 Break each key rule on purpose, see its test go red, and restore
- [x] 3.4 Screens: Check the count (`tk-diff`), Count applied (`tk-applied`), Finished counts, recounts on the counting page, "Counted" in a product's history; a browser spec
- [x] 3.5 `node scripts/ci/check-migrations.mjs pr origin/main` once #561 has merged
- [x] 3.6 The independent review (28 Oct), tests first: Undo refused after a later count; the counting page's own blind search; till sales by when they were made; the download's text cells; the history line tied to its shop's take; the apply in bulk statements; a held-lock deadlock test
- [x] 3.7 Screens from the review: the counting page on its own search; arrow keys and Enter in the category picker and the match list; drawn words shortened until true
- [x] 3.8 The second review (28 Oct), tests first: till sales by close-the-day's rule (an online sale on a fast till clock; an offline sale whose clock is ahead of when it arrived); Undo refused after a later count that matched; an apply of several products; the below-zero search scope
- [x] 3.9 `/review`; CI by hand

## 4. Later (waits for other pieces)

- Later, not in this change: 4.1 Held stock left out of Expected — when stock can be held for online orders and jobs
- Later, not in this change: 4.2 Today's below-zero line with Count them (`st-today-below`) — with Today's stock warnings
- Later, not in this change: 4.3 Sizes and colours on counted lines — after WP-1.5
- Later, not in this change: 4.4 Sending stock to another shop (`tr-send`, `tr-sites`, `tr-today-short`)
