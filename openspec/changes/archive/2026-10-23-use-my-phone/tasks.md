# Tasks

## 1. The server (first pull request; migration and public routes: `/review`)

- [x] 1.1 Write tests first (`tests/quote-photo-codes.test.js`, against a live server): staff make a code for the pads line of a draft quote and get its path and expiry; the public read shows only shop, reference, bike, line and reason (not the customer's name or phone); a JPEG posted with the code lands on the line and among the job's files, cleaned of its location; the staff status goes waiting → added; a second post, a code over 15 minutes old (the pinned clock moved on), an unknown code, a sent quote, and a line whose words changed all give the same 410 and change nothing; another shop can't use the code; the limiter stops a run of guesses. Watch each fail for the right reason
- [x] 1.2 Migration 062 `quote_photo_codes` with RLS enabled and forced; check from empty on a scratch database, and `assert-rls-coverage` passes
- [x] 1.3 Build the four routes (decision 3) and the line update (decision 2) in one transaction. Verify 1.1 passes
- [x] 1.4 Update the route list (190 → 194), screen-trace comments, and run lint, `npm test`, `npm run test:browser`, a fresh review and `/review`

## 2. The screens (second pull request)

- [x] 2.1 Write screen tests first: on a computer, Add photo offers "Choose a file" and "Use my phone"; on a touch screen it goes straight to the file input; "Use my phone" shows the drawn pop-up with a QR code of the address, "Works for 15 minutes, for this photo only. No sign-in needed." and "Waiting for the photo…", then "Photo added" when the status says added, and the line reads "1 photo"; the phone page's four states as drawn, with "Use this photo" posting the photo. Watch each fail
- [x] 2.2 Add the `qrcode-generator` package (noted in the pull request), build the choice and pop-up in `quote-panel.tsx`, and the phone page at `/book/:shopSlug/photo/:code` as a route of its own. Verify 2.1 passes
- [x] 2.3 A browser test: the phone page at 320px with a photo picked, then Photo added
- [x] 2.4 Log anything decided while building in `decided-while-building.md`; run lint, `npm test`, `npm run test:browser` and a fresh review

## Workflow follow-up

- Archive the change with `/opsx:archive` as the last commit of the second pull request, before it merges.
