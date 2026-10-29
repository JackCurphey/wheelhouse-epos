# Proposal: The Tills list, with Rename and Remove

## Why

Settings › Till › Tills today shows only "Make this computer a till" and a
summary of the tills' codes (`decided-while-building.md`, 28 Oct, till-setup
entry 13: "The list with Rename and Remove is WP-5.1"). An Owner can't see
which computers are tills or workshop computers, can't give one a name after
setting it up, and can't switch one off: a workshop computer has no way to be
switched off at all, and a till only through a route no screen calls. The
drawings show the list: each till with where and when it was registered and
by whom, Rename, and Remove, which asks first.

Work package: **WP-1.7 task 3.6, later task 2.7** ("Renaming or switching
off a workshop computer, with the Tills list",
`openspec/changes/archive/2026-10-29-workshop-computer/tasks.md` section 2),
and the Tills part of **WP-5.1** (Owner setup). Slice B. Taken by Jack. It
needs nothing of Mark's: Settings stay the Owner's until roles (WP-1.1), as
every other fold.

**Risky areas:** a migration (104, who registered each till and workshop
computer), and sign-in (switching off a till or workshop computer stops that
browser being one). No money, stock or public route.

## What Changes

- **The Tills list** (`set-till-tills-owner`): every till that's on, in
  number order, "Till B1" over "Bolton · registered [date] by [name]", with
  Rename and Remove; then every workshop computer that's on, the same way;
  then the drawn note and "Make this computer a till", as now.
- **Rename**: a box with the till's "Name (optional)", saved with Save; a
  blank name is none.
- **Remove asks first** (`set-till-remove`): "Remove Till B1?", "Bolton",
  "This computer stops working as a till. Sales already taken stay in the
  reports.", Keep the till, Remove the till. The till is switched off: that
  computer stops being Till B1, and B1 stays in use, as now.
- The same for a workshop computer.
- Migration 104: who registered each till and workshop computer.
- Server: `GET /api/till-setup/list`; `PUT` and `POST …/remove` for a till
  and a workshop computer, the Owner's only, refused while someone else is
  checked in by PIN on that computer, as setting one up is.

## Drawings and decisions

- Drawings: `set-till-tills-owner` and `set-till-remove`
  (`docs/design/user-journeys/generator/setup.mjs` :126-131, `tillsOpen`,
  `removeTillDialog`; listed in `journeys.mjs` :601-602); the name field
  from `till-setup` (`generator/signin.mjs` :111, "Name (optional)").
- Decisions: owner setup 17 (`docs/decisions/2026-09-30-owner-setup-review.md`:
  owner-only actions, make or remove a till, are hidden from everyone but
  the Owner, and removing a till asks first); roles and switches 2
  (`2026-10-05-roles-and-switches.md`: registering tills needs the Owner's
  email sign-in, never a PIN); stage-1 gaps 4
  (`2026-10-07-stage-1-drawing-gaps.md`); till-setup design 1 and 7 and
  `decided-while-building.md` 28 Oct entries 7, 13, 14 and 17; workshop
  computer design 1.

## Out of scope

- The Manager's view (`set-till-tills`, Rename without Remove): Settings
  are the Owner's until roles (WP-1.1, Mark's).
- Moving a till to another shop (`ms-till-move`, WP-5.2) and the list by
  shop (`ms-tills`).
- Re-claiming a taken number on screen (28 Oct entry 16).
- A till's offline key (step C, Mark's).
