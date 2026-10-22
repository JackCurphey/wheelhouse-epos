# Design

`bookingLinkView` adds `checklist` from `jobChecklist()` (server/workshop/
checklists.js) when `work_state` is `complete`; items are renamed `name` from
the staff side's `label`. The card's title is the checklist's own name (the
shop's, as on the job page). Show prices doesn't touch it: it has no prices.
