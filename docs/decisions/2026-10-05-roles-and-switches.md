# Roles and switches — Jack's decisions (5 Oct 2026)

Issue #132 (Codex finding 6): before WP-1.1, write the full set of roles and
switches. The survey found nine switches and five things the decisions left
open (answers 1, 2, 4, 5, 6); Jack added trust PIN (answer 3), and the
fresh review raised answers 7 and 8; answers 9 and 10 came while drawing answer 3. Jack answered them one at a time on 5 Oct. The table they produce is in
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
   PIN on a workshop computer that day doesn't type it again: when the
   computer has been left idle it shows the names of everyone who typed
   their PIN on it today, and they tap their own. Opening an Owner or
   Manager page still asks for that person's PIN every time. With it off,
   the computer asks for the PIN again after 10 minutes idle (Q6). Chosen
   over the computer carrying on as the last person. Drawn 5 Oct
   (`till-checkin-workshop-names`), with answers 8–10.
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
7. **Only Owners and Managers give out "Can change settings" or "Give
   everything a Manager can do"** (Jack, 5 Oct: "no only managers and owners
   can change settings", then "1" when asked which meaning). Someone with
   "Can change settings" turns the other switches on and off for colleagues,
   but not those two, so two colleagues can't promote each other. Raised by
   the fresh review of the table. Chosen over anyone with "Can change
   settings" giving any switch except to themselves.
8. **A mechanic with no email works at a workshop computer by PIN** (Jack,
   5 Oct: "1"). A "till only" Mechanic gets the diary and jobs at a workshop
   computer, as their role allows, and only the till anywhere else. Settles
   walk-through 8 decision 8 ("till only") against decision 1 (everyone at
   a workshop computer types a PIN). Raised by the second fresh review.
   Chosen over every workshop-computer user needing an email.

**Later change (5 Oct 2026, issue #133, `docs/decisions/2026-10-05-shops-and-sites.md`):** Jack, 5 Oct, answer 1. Trust PIN (answer 3) is one setting for the whole business, not per site.
9. **With trust PIN on, today's people as pills at the bottom of every
   workshop page, and the idle screen as a setting** (Jack, 5 Oct, while
   reviewing the drawing of answer 3: "there should just a pill switch or
   something at the bottom of the page so that someone hopping on a computer
   can just swap it over to them without having to go to another screen";
   then "1", and "allow shops to change how long the idle screen is, or if
   they even want it on"). A strip of pills, one per person who typed their
   PIN there today and "Someone else", sits at the bottom of every workshop
   page; tapping your own makes you the person working, on the same page.
   After the computer has been left alone, the "Who's working?" screen
   still comes up, so nothing is recorded under the last person after a
   break. How long that takes is a setting for the whole business, 10
   minutes to start (Q6), and it can be switched off. Owner and Manager
   pages still ask for a PIN. Chosen over pills only, with no idle screen.
10. **The till gets the same pills** (Jack, 5 Oct: "I would also like to
    have that for the till system too, so a staff member can quickly make
    sure the sales are recorded under their name"; then "1"). With trust
    PIN on, the till shows a "Serving:" row of pills: everyone who has
    checked in on that till today with their PIN, and "Someone else" for a
    PIN. Tapping your own makes you the person serving, with no PIN. The
    same trust PIN setting covers workshop computers and tills. Proposed,
    for Jack to overrule: the sale on screen moves to the new name too, so a
    wrong name can be fixed mid-sale. Chosen over pills on every till
    whatever the setting, and over a PIN on every tap.

**Drawn (5 Oct 2026):** answers 3, 8, 9 and 10 are drawn on the one canvas and in the clickable mockup: "Who's working?" (`till-checkin-workshop-names`), the workshop pills (`workshop-working-pills`), the till pills (`till-serving-pills`), the Trust PIN and go-back-to-the-start lines on `set-till-quick`, and the line for a Mechanic on the till-only pop-up (`set-staff-invite-till-only`). Jack approved each drawing on 5 Oct.
