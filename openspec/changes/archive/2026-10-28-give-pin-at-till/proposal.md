# Proposal: giving a PIN at the till

## Why

Someone added as "till only" has no email and no Wheelhouse sign-in, so they
can't get a PIN in Your settings, and so can't check in at the till. Jack
chose to build giving a PIN at the till now (`docs/decisions/2026-10-28-answers.md`,
answers 3 and 4), had the way in drawn, and approved the drawings on 28 Oct
(answer 5: "Approve, build it"). This is the next piece of **WP-1.7 Sign-in
and PINs** (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`),
taken by Jack, after the PINs and check-in
(`openspec/changes/archive/2026-10-28-pins-and-checkin`, "`till-give-pin`,
later task").

**Risky area:** sign-in (PINs and the check-in). No migration, no money.
`/review`-style checks run before the pull request.

## What Changes

- The person checked in at the till, if they are the Owner (and, once roles
  exist, a Manager or anyone with "Give everything a Manager can do"), and
  only while someone at the shop has no PIN, gets a menu on
  "Serving: [name]": **Switch who’s serving** (back to Enter your PIN, as
  today) and either **Give [Name] their PIN** (one person) or **Give someone
  their PIN · [n] people have no PIN yet** (several), which opens **Who’s
  getting a PIN?**. Everyone else, and the Owner when everyone has a PIN,
  keeps the one-tap Switch.
- Choosing a person opens **[Name]’s till PIN**, the same pop-up as Your
  settings' new PIN: Wheelhouse picks four digits nobody else has, "Give me
  a different one", "Keep this PIN", "Close without giving a PIN". Keeping
  it ends the giver's check-in, so the till goes back to Enter your PIN,
  ready for that person.
- The server gives a PIN only for the checked-in Owner, only to an active
  person in the shop with no PIN, never to the giver or the Owner, with the
  existing offer, keep, uniqueness lock, limit and hashing.
- Enter your PIN's line becomes the drawn "No PIN yet? Sign in on your
  phone, or ask the owner or a manager to give you one here."

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/signin.mjs`, from PR #556):
  `till-serving-menu`, `till-serving-menu-several`, `till-give-pin-pick`
  (:268-331) and `till-give-pin` (:229-266, `PIN_TEXT.give`); their links in
  `mockup/links/jb.mjs`; `noPinLine` (:135); the note on
  `set-staff-invite-till-only` (`setup.mjs` :280).
- Decisions: Jack's answers 28 Oct, 3, 4 and 5; signing in 4, 6, 7 and its
  5 Oct later change (the Owner's PIN stays the Owner's); roles and
  switches 1 and 5 (`docs/decisions/2026-10-05-roles-and-switches.md`); UX
  walk-through 4 M2 and M3; app map 13.

## Out of scope

- Adding a till-only person (`set-staff-invite-till-only`): Staff and roles
  (WP-1.1) isn't built in the new app; this piece gives PINs to people
  already on the team.
- Manager and "Give everything a Manager can do": not stored anywhere yet
  (WP-1.1), so until roles only the Owner gives PINs, as for clearing one.
- Give a new PIN by phone (a one-time PIN read out over a call), and the
  till bar itself (step C).
