# Proposal: what a diary block shows first and second

## Why
Workshop day 17 and 29 (27 Sep): each shop chooses what a diary block shows,
bike, then job title, by default, from bike, job title, customer and job
number; drawn as `set-workshop-diary`'s Diary blocks fold (30 Sep), one
setting for the business (shops and sites, 5 Oct). Built 22 Oct on Jack's
word (WP-4.1, ahead of stage 4). Storage slots, the same drawing's other fold,
follow in their own change.

## What changes
- Migration 053: `workshop_settings.block_first` and `block_second`.
- `GET/PUT /api/workshop-settings` carry `blockFirst` and `blockSecond`
  (Owner only to change, as all Settings), two different choices.
- Settings › Workshop › Diary blocks: First line and Second line, saved as
  soon as chosen, with the drawn preview and note; its summary "Bike, then job
  title".
- The diary's blocks, a stack's front card and a fanned stack's tiles show the
  two chosen lines. A block's name for screen readers is unchanged.

## Risky areas
A migration (053). Needs `/review`.
