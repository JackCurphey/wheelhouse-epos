# Design: input checks (audit items 19, 21, 22)

## The mechanic as a whole number (item 19)

`resolveJobMechanicId(rawId, existingId)` keeps its three cases (left out:
keep; null or `''`: the shared queue) and now refuses anything that is not
`isEmployeeId(rawId)` before reading the database: a whole number from 1 to
2,147,483,647, the range of the employees' id column (a bigger one would be a
server error from Postgres). `isEmployeeId` lives in
`server/workshop/sign-off.js`, and `signOffMechanic` uses it too in place of
its plain `Number.isInteger` (fresh review, P3). A number sent as text (`"3"`) is refused too:
no screen sends one (the diary, the job page, the request and offer dialogs
and the booking page all hold the mechanic as a number). The refusal is the
callers' existing 400, "Mechanic not found or inactive".

## The mechanic gone mid-finish (item 21)

`recordSignOff(jobId, employeeId)` reads the employee with
`AND active = 1 AND is_mechanic = 1 FOR SHARE`. `FOR SHARE` holds the row
until the outer transaction ends, so a delete or a switch-off waits for the
finish to commit; one that committed first leaves no row. With no row it
rolls back its savepoint and returns `false`; on success it returns `true`.

- **Finish route** (`POST /api/workshop-jobs/:id/finish`): `false` rolls back
  the whole move and returns 400 `SIGN_OFF_REQUIRED`, the refusal it gives
  when the check before the transaction fails. The work stays where it was,
  the version unchanged, no sign-off history row.
- **Till** (`server/routes/sales.js`): the payment already stands, so
  `false` sets the warning "Paid and finished, but not signed off: that
  mechanic isn’t active any more.", the words used when the earlier check
  finds them inactive.

## The on/off settings (item 22)

In `PUT /api/workshop-settings`, before anything is saved, each of
`showPricesOnline`, `showSignOffToCustomers` and
`confirmBookingsAutomatically` that is present must be `typeof 'boolean'`;
otherwise 400 `"<key> must be true or false"` (the wording
`server/routes/messages.js` uses for `enabled`). All three go through one
helper, so they behave the same. Absent keeps the stored value.

## Testing

`tests/input-checks.test.js`:

- create and save refuse `"abc"`, `1.5`, `true`, `"1"`, `[1]`, `{id: 1}`,
  `10000000000` and the mechanic's id as text; null and the real number
  still work. Finishing refuses a sign-off by `10000000000`.
- a trigger on the job's finishing update deletes (or switches off) the
  signing mechanic, standing in for the Owner doing it at that moment; the
  finish is refused with `sign_off_required` and nothing moves.
- each of the three settings refuses `"false"`, `"true"`, `"yes"`, `1`, `0`,
  null, `''`, `[]` and `{}` without changing the stored value, and takes
  `true` and `false`.
