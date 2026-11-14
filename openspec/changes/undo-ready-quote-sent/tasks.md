# Tasks

- [x] 1.1 Test first: the order changes, the certificate changes it to match and marks it ready, then Undo of Ready shows the revised quote as not sent (`tests/c2w-quote-pdf.test.js`). Watched failing (`true !== false`)
- [x] 1.2 `quoteFor` ignores a `revised_quote_sent` whose message was stopped; mutation-checked (the test fails when stopped messages still count)
- [ ] 1.3 Self-review with the `reviewer` agent; lint, `npm test`, `npm run test:browser`; archive as the last commit
