# Proposal: storage slots

## Why
Workshop day 27 (27 Sep): storage slots are optional per shop; a shop turns
them on or off in Settings and keeps its own list of hooks and spaces; when
on, staff note where a bike is kept and the diary shows it. Drawn as
`set-workshop-diary`'s Storage slots fold, New job's "Where the bike is kept",
`till-book-in`'s picker, the job page's "Kept on Hook 3" and the Overview's
Custody column (`rs-overview-arrived`). Built 22 Oct on Jack's word (WP-4.1,
ahead of stage 4).

## What changes
- Migration 054: `storage_slots` (the shop's own list), a switch on
  `workshop_settings`, and the job's slot on `workshop_jobs`.
- Settings › Workshop › Storage slots: the switch, the slots as chips with
  Remove, "+ Add a slot".
- A slot is chosen at book-in (New job when the bike is here, the job page's
  and the Overview's Book in) and can be changed while the bike is in; it is
  cleared when the bike is collected.
- The job page shows "Kept on [slot]"; the Overview's Custody column too; a
  diary block shows the slot where there's room.

Gaps the drawings leave are decided here and logged in decided-while-building.

## Risky areas
A migration (054). Needs `/review`.
