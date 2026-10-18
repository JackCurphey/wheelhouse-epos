# Proposal: the mechanic sign-off, piece 2 (the till asks too)

## Why

Jack's 16 Oct answer 5 (`docs/decisions/2026-10-16-mechanic-sign-off.md`): a
till payment that finishes a job still in progress asks who is signing it off,
with the same pop-up, "so every job that goes out is signed". Piece 1 (#271)
asks on "Mark ready for collection"; until this piece, a job finished by
paying at the till goes out unsigned. Jack chose this piece next on 18 Oct.

## What Changes

- **The till asks first.** When the job's work is still in progress, Take payment opens "Who’s signing this off?" (the job's mechanic picked, nobody on a shared-queue job). Signing off opens the payment; Cancel takes nothing. Work already finished is paid without asking (it was signed off when it was marked ready). A deposit doesn't finish a job, so it wouldn't ask (deposits aren't built yet).
- **Paying records the sign-off.** `POST /api/sale-documents/:id/convert` takes `signedOffBy`; when paying finishes the job, the sign-off is recorded with it.
- **The payment always stands.** The card is taken before the sale is recorded, so the server never refuses a payment over the sign-off. If `signedOffBy` is given but isn't an active mechanic any more, the job is finished unsigned and the reply's `jobWarning` says so (Paid shows it, and the bike isn't handed over automatically). With no `signedOffBy` (the old app), the job finishes unsigned, as today.

## Lane, work package, drawings and decisions

- **Work package:** WP-4.1 (mechanic sign-off), piece 2.
- **Lane:** the till screens are Jack's; `server/routes/sales.js` is **Mark's**, changed on Jack's go-ahead to merge and flag it (as #267 and #271).
- **Drawings:** the same pop-up as piece 1 (`signOffDrawings()` in `diary.mjs`; the decision: "The till's payment that finishes a job uses the same pop-up"); `till-job`.
- **Decisions:** `2026-10-16-mechanic-sign-off.md` answers 5 and 8; `2026-10-18-till-job-payment.md`; `2026-10-08-paying-for-finished-work.md`.

## Out of scope

- "Show who signed off to customers" (piece 3).
- Deposits (stage 3).

## Impact

- `server/routes/sales.js`; `src/screens/till/till-page.tsx`, `pay-dialog.tsx`
- `tests/sale-documents-sign-off.test.js` (new), `tests/screens/till-job.test.js`, `tests/browser/till-job.spec.ts`
