# Tasks

## 1. Server and screen (one pull request, `jack/delivery-labels`)

- [x] 1.1 Tests first: a delivery's lines carry barcode and price (`tests/deliveries-booked-in.test.js`); the button's place for Owner and Staff, none with nothing booked in; the box's starting counts; changing a count, down to 0; Print off at 0; what's printed, how many, the barcode or code, none without either; the size; a size that can't load (`tests/screens/delivery-labels.test.js`); a browser spec. Watch each fail
- [x] 1.2 Build the box and the paper to `rs-labels`; `Count` gains `min`
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.3a The independent review, 3 Nov: a quiet zone and a barcode sized to the label; a count's limit; the day instead of "just now" later. Tests first, watched failing, each broken on purpose
- [x] 1.3b The re-review, 3 Nov: the starting count keeps to the limit. Test first, watched failing
- [x] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawing and this spec
- [x] 1.5 `/opsx:archive` as the last commit
