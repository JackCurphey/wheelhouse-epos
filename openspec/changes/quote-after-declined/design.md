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
