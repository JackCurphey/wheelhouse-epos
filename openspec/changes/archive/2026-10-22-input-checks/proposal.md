# Proposal: tighter input checks on the mechanic, the sign-off and the on/off settings

## Why

The audit of the flagged merges (22 Oct, `docs/reviews/2026-10-22-flagged-merges-audit.md`,
P3 items 19, 21 and 22) found three places where a sloppy or unlucky request
gets the wrong answer:

- **Item 19 (#337).** A job's mechanic is read with `Number()`. Sending
  `"abc"` or `1.5` gives a server error instead of a plain refusal, and
  `true` is read as staff member 1. Creating a job, saving one, accepting a
  request with a mechanic and offering another time all share this check.
- **Item 21 (#271).** Finishing the work checks the signing mechanic before
  its transaction. If the Owner deletes that mechanic in between, the
  sign-off write throws and staff get a server error (nothing is left half
  done; it rolls back). A mechanic switched off in that gap still signs.
- **Item 22 (#275).** The workshop's on/off settings use JavaScript
  truthiness, so the text `"false"` turns "Show who signed off to customers"
  on. "Show prices on the booking page" and "Confirm bookings automatically"
  read their values the same way.

## What Changes

- **Server:** a job's mechanic must be sent as a whole number that could be
  someone's id (or null for the shared queue, or left out); the sign-off's
  mechanic too. Anything else is refused with the existing
  "Mechanic not found or inactive".
- **Server:** the sign-off reads the mechanic again inside the finishing
  transaction, still active and still a mechanic, and holds that row until
  the transaction ends. If they have gone, finishing is refused with the
  existing "Choose who is signing this off" and nothing moves. At the till,
  where the payment already stands, the reply warns as it does for a mechanic
  made inactive before the payment.
- **Server:** `showSignOffToCustomers`, `showPricesOnline` and
  `confirmBookingsAutomatically` accept only `true` or `false`; anything else
  is refused with "[setting] must be true or false" and nothing is saved.
  Left out, each stays as it is.
- No screen changes. The Settings screen already sends real `true`/`false`
  for both switches it has (`src/screens/settings/settings-page.tsx`,
  `RowSwitch` calls `onChange(!on)`); no screen sends
  `confirmBookingsAutomatically` yet. Every screen that sends a mechanic sends
  a number or null.

## Lane, work package, drawings and decisions

- **Work package:** follow-up fixes from the audit (stage 1 workshop and
  settings).
- **Lane:** Mark's (server). `server/routes/workshop-settings.js` is Mark's.
  The other lines land in Jack's workshop files, kept to the minimum, and
  need his approval (split plan §3): the integer check in
  `resolveJobMechanicId` (`server/workshop/jobs.js`), the re-read in
  `recordSignOff` (`server/workshop/sign-off.js`), and the refusal in the
  finish route (`server/routes/workshop.js`). One warning line in
  `server/routes/sales.js` (the till's payment).
- **Drawings:** none changed. The refusal words are the ones already built.
- **Decisions:** `docs/decisions/2026-10-16-mechanic-sign-off.md` (the server
  refuses to finish without an active mechanic; a sign-off that is no longer
  valid never refuses a payment). Followed, not reopened.

## Out of scope

- Audit item 20 (the accept and offer routes check the mechanic before their
  lock, not again inside it).
- Other true/false values elsewhere (a team member's `active` and
  `bookableOnline`), which use the same truthiness; listed in the result for
  a later change.
