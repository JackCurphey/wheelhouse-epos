# Tasks

## 1. Server (pull request 1, `jack/stock-take`)

- [ ] 1.1 Tests first: migration 098 from an empty scratch database and run twice (`tests/migration-098.test.js`); the routes (`tests/stock-take.test.js`: start for the Owner only, each kind and its checks; areas used before; join, scan, type, take off; blind; twenty scans at once; stock untouched; a count's own products only; still to find; finished and back to counting; each shop sees only its own). Watch each fail
- [ ] 1.2 Migration 098, `server/routes/stock-takes.js`, registered in `server/routes/index.js`
- [ ] 1.3 The route list snapshot, the owner-only list
- [ ] 1.4 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.5 Lint, typecheck, the touched tests; `/review` (migration, stock)

## 2. Screens (pull request 2, `jack/stock-take-screens`, stacked on 1)

- [ ] 2.1 Tests first: Stock take for the Owner and Staff, Start a count, counting and below zero (`tests/screens/stock-take.test.js`); the shell no longer shows the placeholder; a browser spec. Watch each fail
- [ ] 2.2 Build them to the drawings
- [ ] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, the browser specs; `/review`
- [ ] 2.5 `/opsx:archive` as the last commit

## 3. Later (waits for Jack's answer, or for other pieces)

- [ ] 3.1 Check the count (`tk-diff`): expected, counted, differences at cost, Recount, Count them as none — waits for Jack's answer on what's allowed for (`design.md`)
- [ ] 3.2 Apply with Undo (`tk-applied`): products locked in id order, each change with its "Counted" stock-history line in one transaction; Finished counts on the hub; Download the count
- [ ] 3.3 Held stock left out of Expected — when stock can be held for online orders and jobs
- [ ] 3.4 Today's below-zero line with Count them (`st-today-below`) — with Today's stock warnings
- [ ] 3.5 Sizes and colours on counted lines — after WP-1.5
- [ ] 3.6 Sending stock to another shop (`tr-send`, `tr-sites`, `tr-today-short`)
