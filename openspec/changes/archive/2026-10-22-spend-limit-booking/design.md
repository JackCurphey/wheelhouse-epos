# Design

`spend_limit INTEGER NULL CHECK (spend_limit BETWEEN 1 AND 100000)`: whole
pounds, as drawn (`inputmode="numeric"`, "in pounds"). Null is "Ask me before
any extra work", the default.

The booking draft keeps `limitOn?: true` (Go ahead chosen) and `limitText`
(the box as typed); `spendLimit(draft)` turns them into whole pounds or
none, and the date screen's guard (`hasProblem`) sends a bad amount back to
the bike step, so a limit is never dropped unseen (fresh review). The
bike step's second choice fills £200 to start, as drawn; an empty or
non-whole amount is refused on Continue with "Enter the most the whole bill
can come to, in whole pounds." `bookingBody` sends `spendLimit` only when
set. The server refuses anything but a whole number from 1 to 100000 (400,
in the booking's own refusal words) and stores it through
`createWorkshopJob`.

The summary adds "Extra work: go ahead if the whole bill is no more than
£200" when set; nothing when asking first (the drawn "We’ll send you the
quote to approve" row isn't built yet).

The job's replies carry `spendLimit` (number or null). The job page shows the
drawn outlined blue tag in the details strip before Ready by: "Customer OK up
to £200", or "Ask before any extra work".
