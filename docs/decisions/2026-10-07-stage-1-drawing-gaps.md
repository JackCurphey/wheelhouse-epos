# Stage 1: what the drawings don't show — Jack's decisions (7 Oct 2026)

Before stage 1 is built, every screen in Jack's stage-1 packages (WP-1.1,
1.3, 1.7, 1.8, 1.10, 1.11; split plan §6) was checked against its drawing,
the build plan, the specs and the decisions. Every board is drawn; nothing
blocks building. These are the 25 places where a screen needs something the
drawings don't show, or where two sources disagree. Jack decides each one
here, so it is settled before building rather than during it.

Sources: the blocks list `docs/design/user-journeys/README.md:105-170`; the
build plan `docs/superpowers/plans/2026-10-03-release-2-build-plan.md:209-355`;
the drawings in `docs/design/user-journeys/generator/` (`consolidate/ja.mjs`,
`jb.mjs`, `j08.mjs`, `j10.mjs`, `j12.mjs`). The check read the drawings' text,
not their pictures, and not the live claude.ai canvases.

Status: **all 25 decided** (7 Oct).

## Decided

### 1. An Owner or Manager PIN on a workshop computer

**The gap.** Settings and other owner pages on a workshop computer open
only after an Owner's or Manager's PIN, every time (walk-through 8,
decision 3; `consolidate/ja.mjs:29`; spec
`2026-10-05-wp-1-1-roles-and-switches.md:118`). It was a written line only,
with no drawing, and it didn't say whether typing that PIN makes the Owner
the person working.

**Decision** (Jack, 7 Oct: "1"). A PIN pop-up over the page — "Settings
needs an Owner or Manager PIN" with the usual PIN box (someone with "Give
everything a Manager can do" counts too, spec `:118`). The Owner's or
Manager's change is recorded under their name; the person working on the
computer stays who they were (for example Sam the mechanic), so nobody has
to switch back. Chosen over making the Owner the person working, which
would record later work under the Owner's name if nobody switched back.

### 2. Changing a one-time PIN at check-in

**The gap.** A forgotten till PIN is replaced by a one-time PIN the Owner or
a Manager reads out over a call, and "you change it here at check-in"
(walk-through 10 M2, `2026-09-29-signing-in-review.md:80`;
`consolidate/jb.mjs:40`). The check-in step that changes it wasn't drawn.

**Decision** (Jack, 7 Oct: "1", then corrected the same day). Straight after
the one-time PIN, the till shows the drawn "Your till PIN" pop-up: a new PIN
Wheelhouse picked, with "Keep this PIN" and "Give me a different one", and
no way to skip (`signin.mjs:206-236`; the drawn first-time and cleared-PIN
versions have "Skip for now" and a "Your old PIN was cleared" line, which
this version drops). The one-time PIN then stops working,
so nobody else knows the person's PIN (signing in, decision 6). Chosen over
a "Later" button, which would leave the read-out PIN working.

*Correction (Jack, 7 Oct: "1").* The question first offered "Choose your own
PIN, typed twice", which would have reversed signing-in decision 7
("Wheelhouse picks each person's till PIN", `2026-09-29-signing-in-review.md:46-52`):
a chosen PIN that clashes reveals a colleague's PIN. The fresh review caught
it; Jack kept decision 7 and the drawn pop-up instead.

### 3. Giving someone their PIN at the till

**The gap.** The PIN box the person types into (`till-give-pin`) is drawn;
how the checked-in Owner or Manager (or someone with "Give everything")
opens "Give [name] their PIN" and picks
the person was a written line only (`setup.mjs:275`; `signin.mjs:252`).

**Decision** (Jack, 7 Oct: "1", after a sketch of both). From the checked-in
Owner's or Manager's name on the till's top bar: a menu item "Give someone
their PIN" opens a list of only the people waiting for one (new, or PIN
cleared); tapping a name opens the drawn PIN box, screen turned to them.
Chosen over a "Give a PIN" button on the check-in screen, which every
member of staff would see.

### 4. Making a computer a till or a workshop computer

**The gap.** "Set up this till" (`till-setup`) is built in WP-1.7, but the
only drawn way in, "Make this computer a till", is in Till settings' Tills
section, built in WP-5.1 (`mockup/links/j08.mjs:57`; build plan `:691`).
"Make this computer a workshop computer" was a written line only
(`consolidate/jb.mjs:34`, walk-through 8 decision 1).

**Decision** (Jack, 7 Oct: "1"). Stage 1 brings forward only that button:
the Owner's Till settings page gets the Tills section holding just "Make
this computer a till"; the list of tills fills in with WP-5.1. The setup
screen offers the two choices, a till or a workshop computer. Chosen over a
temporary link elsewhere (Getting started) that would later move.

### 5. The sidebar for someone given extra switches

**The gap.** Each role's sidebar is drawn (`diary.mjs:117-122`), and so are
Staff with reports (`reports.mjs:50`) and Staff with the website
(`website.mjs:150`). Not drawn: Staff with switch 7, a Mechanic with any
switch, and "Give everything a Manager can do" (spec
`2026-10-05-wp-1-1-roles-and-switches.md:31`, `:38-40`, `:44`, `:84`).

**Decision** (Jack, 7 Oct: "1"). Each switch adds only the pages it
unlocks, in their usual room. A Mechanic with "Can use the till" gets a
Front desk room with Till and Online orders — the same as a "till only"
Mechanic (walk-through 8, decision 8, later change). Staff with "Can change
settings" get Office › Settings. "Give everything" gives a Manager's
sidebar. Chosen over giving a Mechanic with the till the whole Front desk
room.

### 6. What Settings shows in stage 1

**The gap.** WP-1.3 builds four room pages, but only Front desk › Till has
content until WP-5.1 (build plan `:229-232`); the drawing shows every row
filled in, and nothing says what unfinished rooms and rows show meanwhile.

**Decision** (Jack, 7 Oct: "1"). Show only what works: in stage 1 Settings
shows the Till section and nothing else; rooms and rows appear as their
package builds them. No shop uses the app for real until the move (stage
8), so this only affects testing. Chosen over the full drawn layout with
unfinished rows greyed out as "Coming in a later stage".

### 7. The Messages list in stage 1

**The gap.** Settings › Messages is built in WP-1.8, but each automatic
message row comes with its journey's package (build plan `:303-306`,
`:315`), so in stage 1 the list starts empty; an empty list wasn't drawn.

**Decision** (Jack, 7 Oct: "1"). The same rule as decision 6: the page
shows only what exists — "Your own messages" with "+ Add your own message";
automatic rows appear as each package adds them. With nothing there, it
uses Till settings' drawn empty-list look (`set-till-empty`): one short line
and the add button.

### 8. The "not saved" message

**The gap.** WP-1.3 builds the failed save (build plan `:230`), but its
drawing (`set-save-failed`: "Not saved — no internet connection. Your
change is kept here." with "Try again") sits on the End of day page, filed
under WP-5.1 (`consolidate/j08.mjs:23`; `setup.mjs:157`).

**Decision** (Jack, 7 Oct: "1"). Built in WP-1.3 exactly as drawn, as part
of the frame every Settings page shares, so it works on the Till page from
stage 1. Chosen over leaving it to WP-5.1, which would let a failed save on
the Till page go unnoticed.

### 9. The trust PIN and idle-time settings

**The gap.** Trust PIN (off to start) and how long a workshop computer
waits before going back to the start were written lines on `set-till-quick`
with no row drawn (`consolidate/j08.mjs:59-60`); the line says Owner and
Manager, and the roles spec didn't say whether switch 7 can change them.

**Decision** (Jack, 7 Oct: "1"). Owner and Manager only (and so "Give
everything", which includes what is kept for Managers): trust PIN loosens
security for the whole business. Where they go, decided here for Jack to
overrule: together in their own fold, "Signing in", on the Till settings
page beside the Tills section, following the drawn folding-sections
pattern. Chosen over letting anyone with "Can change settings" change them.

### 10. The "Working: [name] · Switch" bar (block 26)

**The gap.** On a workshop computer the bar is drawn only as the top row of
an open job pop-up (`diary.mjs:2631-2637`); a written line puts it on the
diary page too (`consolidate/j12.mjs:48`), and "Switch" led nowhere.

**Decision** (Jack, 7 Oct: "1"). The bar runs across the top of every page
on a workshop computer, looking as drawn; "Switch" opens the existing
"Enter your PIN" screen (with trust PIN on, the names to tap). Chosen over
showing it only on the diary and in job pop-ups.

### 11. The till's PIN screen with trust PIN on

**The gap.** With trust PIN on, anyone checked in on that till today takes
over by tapping their name (spec `:114-115`, R10). That is drawn while
someone is checked in, as the till's name pills (`till-serving-pills`,
roles and switches answer 10, `2026-10-05-roles-and-switches.md:88-99`).
Not drawn: whether the "Checked in today" names on the till's own PIN
screen can be tapped; only the workshop computer's PIN screen has tappable
names.

**Decision** (Jack, 7 Oct: "1"). The same as the workshop computer: with
trust PIN on, tapping a name in "Checked in today" checks that person back
in; with it off, the names are only a list and the PIN is typed. Chosen
over always typing the PIN on the till's PIN screen.

### 12. The Today page in stage 1

**The gap.** "Not in yet" (grey, then "Late" after the start time) was
decided on 30 Sep but only "Late" is drawn
(`2026-09-30-opening-the-shop-review.md:37-40`); and the Tills card's float
and banking lines depend on WP-3.3, so in stage 1 it has nothing true to
show.

**Decision** (Jack, 7 Oct: "1"). The same rule as decisions 6 and 7: in
stage 1 Today shows only what works — Who's in, Workshop today and Needs
attention; the Tills card arrives with WP-3.3's float check. "Not in yet" is
built as decided on 30 Sep, in "Late"'s drawn look (already decided; no new
choice). Chosen over a stage-1 Tills card with only till names and online
or offline.

### 13. A customer's wrong code

**The gap.** A wrong or expired customer code "says so under the boxes"
with "Send a new code" (signing-in decision 9), but only the expired line
is drawn: "That code has expired — send a new one" (`consolidate/jb.mjs:26`;
`signin.mjs:281`).

**Decision** (Jack, 7 Oct: "1"). A wrong code reads "That code isn't right
— check it or send a new one", in the expired line's look (digits in red,
the line under the boxes). Chosen over "Wrong code — try again".

### 14. How long before staff are signed out on their own devices

**The gap.** Staff signed in by email and password (own phone, laptop, the
office computer) eventually see the drawn "Please sign in again" screen
(`signin.mjs:65`), but no decision said after how long; Q6's 10 minutes is
for workshop computers only (split plan `:409`).

**Decision** (Jack, 7 Oct: "1"). 30 days without use, like most apps on a
phone; a lost phone is handled by the Owner signing out that person's
devices (roles spec). Chosen over 12 hours without use.

### 15, 16, 18, 19 and 21. Older drawings that a later decision settles

**The gap.** In each, an older drawing or map line disagrees with a later
recorded decision:
- 15: the pills drawing shows "Sign out" on a workshop computer
  (`signin.mjs:197-203`, reusing the diary sidebar's "Sign out",
  `diary.mjs:186`); the decision is "Check out", no "Sign out"
  (`consolidate/ja.mjs:40`; walk-through 8, decision 1).
- 16: the mockup opens a Staff member's full sidebar at a workshop computer
  (`mockup/links/jb.mjs:33-36`); the decision is workshop pages, owner pages
  only after an Owner or Manager PIN (spec `:118`; walk-through 8,
  decision 3).
- 18: "Not part of your role" says "Reports are for owners and managers"
  with no name to ask (`signin.mjs:66`); Reports is now switch 2, and block
  29 reads "ask [name]".
- 19: the map says a manager sets up a till (`app-map.mjs:403`); only the
  Owner registers tills (spec `:59`; Owner setup 10, R5).
- 21: "All shops" is for Owners and multi-shop Managers (`signin.mjs:63`);
  "Give everything" includes it too (spec `:89`; R1).

**Decision** (Jack, 7 Oct: "1"). Build each as the later decision says, and
bring the old drawings and map lines into line with it. No decision
changes.

### 17. WhatsApp messages

**The gap.** Customers choose text, WhatsApp or email (account and
reminders 6, 1 Oct; Book a repair d5; `setup.mjs:382,385`), but WP-1.8
says "text or email" (build plan `:304`; split plan `:410`).

**Decision** (Jack, 7 Oct: "1"). WP-1.8's messages engine sends by text,
WhatsApp or email, with WhatsApp behind an adapter and a pretend version,
like the other outside services; the real WhatsApp Business connection (a
real account, usually a per-message charge) waits for Jack's yes. Chosen
over adding WhatsApp in a later stage.

### 20. Takings on Today

**The gap.** The app map says the Owner's Today shows takings
(`app-map.mjs:411`), and the roles spec's Today data includes them (spec
`:261`, §7.9); opening the shop decision 3 (30 Sep) sets Today's four parts
— Tills, Who's in, Workshop today, Needs attention — with no takings, and
the `op-today` drawing follows it.

**Decision** (Jack, 7 Oct: "1"). Keep the four parts; takings stay in
Reports › Takings and cash-ups. The map line is brought into line, and
Mark is told Today's data needs no takings. Chosen over a "Takings so far
today" line on the Tills card.

### Added while deciding 13: "Continue with Google" for customers

Jack asked why customers need a code when WorkOS offers Google or Apple
sign-in. **Decision** (Jack, 7 Oct: "lets do just google for now, but once
we start getting money in then we will be getting apple too"): customer
sign-in adds "Continue with Google" beside the emailed code; Apple follows
once the business has income ($99 a year developer fee). Recorded as a later
change to signing-in decision 5 (`2026-09-29-signing-in-review.md`). Needs a
drawing of the customer sign-in screen with the button.

**Later the same day** (Jack, 7 Oct: "Apart from saying yes, which i do, for
the google sign in stuff…", then "1"). Jack says yes to the real Google
sign-in setup. What it needs, from WorkOS's Google guide
(workos.com/docs/integrations/google-oauth, read 7 Oct) and Google's usual
sign-in screen requirements (not yet checked against Google's own pages):
- **Building and testing:** nothing more. WorkOS's staging environment has
  its own default Google keys for testing; until the WorkOS account exists
  (Mark's, build-plan questions Q10), the pretend version stands in.
- **Before real customers (by the move):** a Google Cloud project and
  sign-in key of Wheelhouse's own, owned by a business Google account (which
  one is still to settle), with a support email, a homepage, a privacy
  policy page, and the name **"Wheelhouse"** on Google's "Sign in to …"
  screen (Jack's choice, over a neutral name such as "Bike shop sign-in").
  No logo there: Google verifies logos, and there is no official Wheelhouse
  logo yet. Unless WorkOS has a custom sign-in address (a web-address
  record and a second return address in Google), Google's account chooser
  may read "continue to workos.com"; whether to set one up is still to
  decide.
- **Answered:** Google sends people back to WorkOS's own address, not each
  shop's, so shops' own web addresses need no registering with Google.

### 22–25. The minor ones

**Decision** (Jack, 7 Oct: "yeah lets just go with all the reccomneded"):
- **22. Header search.** Finding bikes, frame numbers and booking requests
  (a written line, `consolidate/ja.mjs:36`) is built as the line says, all
  in WP-1.11 beside its server side rather than split with WP-1.1; the
  results use the drawn search look, one row type per kind of result.
- **23. The shop switcher.** The same rule as decisions 6, 7 and 12: in
  stage 1 the sidebar shows the shop's name only; switching shops arrives
  with WP-5.2 (build plan `:706`), when a shop can have more than one.
- **24. The Messages edit box.** When a message can go by email, an email
  preview — a subject line and the same wording, in the drawn preview's
  style — sits beneath the text preview. A small design addition, approved
  here.
- **25. Two STATUS lines.** The trust-PIN and Mechanic drawings were done in
  #172 (`2026-10-05-roles-and-switches.md:99`), and the "Change requested"
  badge belongs to the job page in WP-4.1, stage 4
  (`docs/superpowers/specs/2026-10-03-quote-stage-design.md:172`; build plan
  `:566`), where it is still a design question for Jack. Both are
  corrected in the next daily status pull request.

## What follows

- **Drawings to add or bring into line** before or with their package:
  the Owner or Manager PIN pop-up (1), the "Your till PIN" pop-up shown
  after a one-time PIN (2; the cleared-PIN version is drawn), the "Give
  someone their PIN" menu and list (3), the stage-1 Tills section and the
  setup screen's two choices (4), the "Signing in" fold (9), the working bar
  on a page (10), the till's tappable names (11), "Not in yet" (12), the
  wrong-code line (13), the old drawings in 15, 16, 18, 19 and 21, the map's
  takings line (20), the email preview (24), and customer sign-in with
  "Continue with Google".
- **For Mark** (his packages): WP-1.8's engine sends by WhatsApp too,
  behind an adapter with a pretend version (17); Today's data needs no
  takings (20); staff email sessions last 30 days without use (14; set in
  WorkOS's session settings — not yet checked that WorkOS allows 30 days); trust
  PIN and its idle time are Owner and Manager only (9).
- **Jack said yes (7 Oct):** the real Google sign-in setup, named
  "Wheelhouse" — still to settle: which business Google account owns it, and
  a Wheelhouse privacy policy page for Google's screen.
- **Needs Jack's yes before it is created:** the WhatsApp Business
  connection; later, the Apple Developer Program ($99 a year).
