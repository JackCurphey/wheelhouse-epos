# Design

`declined: { revise: 'superseded' }` in `server/workshop/state-machines.js`;
`createRevision` already revises whatever the machine allows. The quote
states themselves don't change, so the database's state CHECK is unchanged.

`earlierAnswers(quote)` reads the approved and declined lines on the job's
quotes with a lower revision, oldest first; withdrawn quotes' lines were
never answered, so they don't appear. `customerQuote()` adds it to both
customer routes.

The card shows the newer view when `earlier` has anything; a second quote
after a withdrawn one reads as a first quote. "Already agreed" lists the
booking's services, then the earlier yeses, with the booking's agreed total
(the link's `totalPrice`); the usual "Already agreed £[n]" row under the lines
isn't repeated, as drawn.

## From the fresh review
- `latestAnswers(jobId, below)` keeps each line's latest answer by its words,
  and only from quotes answered in full; `earlierAnswers` and the finished
  page's "you said no thanks" (`jobMoney`) both use it.
- The customer's quote reply carries `agreedTotal`: the booked services (when
  their prices show online) plus the earlier yeses, summed by the database.
  The card uses it for "Already agreed", the new total and the button.
- The "Already agreed" row shows only when it has something to say.
- `docs/design/workshop-states.md` regenerated.
