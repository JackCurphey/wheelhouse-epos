# Roles and switches — Jack's decisions (5 Oct 2026)

Issue #132 (Codex finding 6): before WP-1.1, write the full set of roles and
switches. The survey found nine switches and five things the decisions left
open. Jack answered them one at a time on 5 Oct. The table they produce is in
`docs/superpowers/specs/2026-10-05-wp-1-1-roles-and-switches.md`.

1. **"Give everything a Manager can do" gives all of it** (Jack: "1"). A
   Staff member given it can do everything a Manager can, including the
   things later decisions kept for Owners and Managers: the activity log,
   the three Today alerts, Cycle to Work on Today and the "Owed by Cycle to
   Work providers" report, "All shops", giving a new till PIN, the Owner and
   Manager pages on a workshop computer. Only the role's name differs. Keeps
   Owner setup decision 10 ("add up to exactly a Manager") true. Chosen over
   keeping those for the Manager role and renaming the button.
2. **The most sensitive changes need an email sign-in** (Jack: "1").
   Adding or removing people, changing anyone's role or switches, and
   registering or removing tills cannot be done by PIN on a till or a
   workshop computer, only signed in by email (own phone, laptop or the
   office computer). Everything else works by PIN as decided, including
   giving a first PIN at the till (Signing in, later change). Reason: a
   4-digit PIN with no lock after wrong tries (Signing in 8) would
   otherwise open those to guessing. Chosen over a lock after wrong PINs on
   shared computers, and over keeping it as decided.
3. **"Trust PIN" for the day, a per-shop setting** (Jack, 5 Oct: "some
   shops might not want to have to enter a pin every time they use the
   computer"; how it works: "1"). With it on, a person who has typed their
   PIN on a shared computer that day doesn't type it again: when the
   computer has been left idle it shows the names of everyone who typed
   their PIN on it today, and they tap their own. Opening an Owner or
   Manager page still asks for that person's PIN every time. With it off,
   the computer asks for the PIN again after 10 minutes idle (Q6). Chosen
   over the computer carrying on as the last person. Not drawn yet.
4. **Existing logins take their role from the staff list** (Jack: "1").
   The Owner stays Owner; a login whose staff member is marked as a mechanic
   becomes Mechanic, with "Works in the workshop" and "Customers can book
   this person online" on; every other login becomes Staff. Nobody is made
   a Manager automatically. Chosen over making every login a Manager, and
   over Staff with "Give everything a Manager can do".
5. **The Owner controls Managers, and nobody changes their own** (Jack:
   "1"). Only the Owner makes someone a Manager or takes it away. Managers,
   and Staff with "Can change settings", change other Staff and Mechanics'
   switches and clear forgotten PINs, but never their own role or switches.
   A Manager always has every switch; they can't be turned off one by one.
   Chosen over Managers with switches that turn off, and over anyone with
   "Can change settings" changing anyone but the Owner.
6. **Stock takes and reopening a day follow the closest switch** (Jack:
   "1"). Starting a stock take and applying the count needs "Can order
   stock" (Stock control 5 said "a manager"); reopening a closed day needs
   "Can close the day" (Cash-up 6 said "a manager"). Owners and Managers
   have both. Chosen over Managers and Owners only.
