## 1. Noto Sans in the quote PDF

- [x] 1.1 Test first: the PDF for "Łukasz Wiśniewski" embeds Noto Sans regular and bold, has no built-in font, and its text reads "For Łukasz Wiśniewski"; watched failing on Helvetica
- [x] 1.2 Embed Noto Sans from `@expo-google-fonts/noto-sans` 0.4.2; the test's PDF reader reads embedded-font text; mutation (bold back to Helvetica) fails the test with the name garbled
- [ ] 1.3 Self-review with the `reviewer` agent; lint, `npm test`, `npm run test:browser`; archive as the last commit
