# Proposal: till PINs and the PIN check-in

## Why

Staff check in at the till by typing their PIN alone; the PIN says who is
serving, so sales go under the right name, and the first person in who takes
payments checks the float (signing in decisions 3, 4, 6 to 9; opening the shop
decision 2). This is the first part of **WP-1.7 Sign-in and PINs**
(`docs/superpowers/plans/2026-10-03-release-2-build-plan.md` ~:302), the rest
of slice B in the replan Jack accepted (`docs/decisions/2026-10-26-day-answers.md`
section 1). Jack chose it on 28 Oct. Taken by Jack. Under the working
agreement one person builds it from the drawing to the screen.

**Risky areas:** sign-in (PINs and the check-in), a migration (097), and
money (the float check moves onto the check-in). `/review` runs before each
pull request merges.

## WP-1.7's screens, and what this change builds

WP-1.7 lists nine screens and their situations. Already built: `staff-signin`,
`workos-signin`, `auth-signedout` and `auth-expired` (staff-signin-workos,
staff-signin-google), `cust-signin`, `cust-code` and `cust-code-expired`
(customer code sign-in). Left:

| Screen | This change | Later |
|---|---|---|
| `till-checkin` (block 43, PIN pad) | Enter your PIN, the dots, the pad, "No PIN yet?", Checked in today | the till bar's till name and online pill (needs `till-setup` and step C) |
| `till-pin-wrong` | built | |
| `pin-change` | Your settings › Till PIN › Change PIN; Wheelhouse picks, "Give me a different one", "Keep this PIN" | |
| `pin-first` | the same pop-up from Your settings' "Get your PIN", with Skip for now | opening by itself at a first sign-in |
| `pin-cleared` | | its wording, after a clear |
| a manager clears a PIN | the server (Owner only until roles) | the button and "Clear Jo Taylor's till PIN?" on `set-staff-person` / `set-staff-clear-pin`, when Staff and roles is built (WP-1.1) |
| `till-give-pin`, give a new PIN by phone | | later task |
| `till-setup`, `auth-site` (block 13 Shop switcher) | | later task (step C's named tills) |
| `till-checkin-offline`, `-stale` (block 22 Status line) | | needs the till's offline copy (step C) |
| `till-checkin-workshop`, `-workshop-names`, `workshop-working-pills` (block 26) | | later task (trust PIN, idle return) |
| `till-checkin-practice` | | with running alongside |

The float check moves from "the first person to open the till page" to the
first person who checks in with their PIN (Jack's answer 3, 27 Oct:
"When PIN check-in lands, it moves to the check-in, as drawn").

## What it is built on, and what it isn't

- **No named tills yet.** "Set up this till" and the till's token are step C's
  (`till-setup`). Until then the PIN screen is the till page itself, on any
  signed-in computer, and a check-in belongs to that browser and its
  sign-in. "Checked in today" lists everyone who checked in at the shop
  today, not one till's.
- **Online only.** Decision 3 says the PIN works without the internet; that
  needs the till's offline copy (WP-1.6, step C). The PIN hashes are the
  format the offline till already uses (`server/till/pin.js`), so it can
  check them later.
- **Roles.** "Takes payments" stays as the float check has it (the Owner or a
  team member marked as a cashier) and clearing a PIN is the Owner's, until
  WP-1.1.

## What Changes

- **Server (pull request 1, `jack/pins-and-checkin`):** migration 097 (a
  PIN offer on each staff member; today's check-ins, per shop, with
  row-level security; who checked the float); Wheelhouse picks a PIN nobody
  else at the shop has, the person keeps it; the Owner clears someone
  else's; check in by PIN, check out (Switch); the float check takes its
  person from the check-in.
- **Screens (pull request 2, `jack/pins-and-checkin-screens`, stacked):** the
  PIN screen on the till, "Serving: [name]" with switch, the pay box's
  serving name from the check-in, the float check after the check-in, and
  the Till PIN block and pop-up in Your settings.

## Drawings and decisions

- Drawings: `docs/design/user-journeys/generator/signin.mjs` (`till-checkin`
  :139-153, `till-pin-wrong`, `pin-change`/`pin-first` :220-262);
  `app-map.mjs` `tillBar` :32 ("Nobody serving — enter your PIN",
  "Serving: [name]") and `yourSettingsDialog` :198-202 (Till PIN, Change PIN,
  No PIN yet, Get your PIN); `setup.mjs` :242-247 (Clear a forgotten PIN).
- Decisions: signing in 3, 4, 6, 7, 8, 9 and its later changes
  (`docs/decisions/2026-09-29-signing-in-review.md`); roles and switches 1, 2,
  5 (`docs/decisions/2026-10-05-roles-and-switches.md`); opening the shop 2;
  Jack's answer 3 of 27 Oct (`docs/decisions/2026-10-27-answers.md`).

## Out of scope

Everything in the "Later" column above; the activity log (WP-1.2); "I'll do
this" and "Who did what" (they wait for this and WP-1.2,
`docs/decisions/2026-10-22-ill-do-this-waits.md`).
