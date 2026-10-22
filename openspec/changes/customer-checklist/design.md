# Design

`bookingLinkView` adds `checklist` from `jobChecklistCopy()` (server/workshop/
checklists.js), the job's own copy made by its first tick or note, when
`work_state` is `complete`; a checklist nobody used sends null; items are renamed `name` from
the staff side's `label`. The card's title is the checklist's own name (the
shop's, as on the job page). Show prices doesn't touch it: it has no prices.
