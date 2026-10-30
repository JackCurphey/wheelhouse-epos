# Tasks

## 1. One pull request, `jack/your-data-once-a-day`

- [x] 1.1 Tests first (`tests/your-data-copy.test.js`: a second copy the same day refused and not logged; the shop's midnight, in a zone far from UTC; two at once, one logged; another sign-in not held up. `tests/customer/your-data.test.js`: the refusal's words with no Try again; a proxy's 429 still "didn't start"; Download it again makes no request). Watch each fail
- [x] 1.2 The check in the route's transaction, the sign-in's row locked; the in-memory limiter removed; the screen's refusal
- [x] 1.3 Break each rule on purpose, see its test go red, and restore
- [x] 1.4 Jack's answer 2 recorded; choices logged in Jack's lane of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`, the consolidate check
- [x] 1.5 `/opsx:archive` as the last commit
