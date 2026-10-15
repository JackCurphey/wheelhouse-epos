# Tasks: the image upload routes move to their areas

## 1. The move

- [x] 1.1 Moved the three routes and the shared helper. Checked that all 77 removed non-blank lines are in their new homes, apart from the import line, the section header and `export` on `readUploadedImage`
- [x] 1.2 Added `tests/image-uploads-module.test.js`. It was written after the move, so it was run against #205's branch without the move, where it fails 2 of 3; the third, "serveUploadedImage stays in server.js", holds either way. It passes with the move, along with `route-files-defined` (which caught one unused `err`, now `catch {`), `route-list`, the screen trace and the settings guard (26 tests)
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [x] 1.4 A fresh review confirmed the move is pure: the write path and RLS scoping are unchanged, the order is safe, and there are no circular imports. Its two comment points (the `uploads.js` header, and an "above" that no longer points anywhere) are fixed

## Workflow follow-up

- Archive as the last commit, then merge once CI is green and #205 is in.
