# Journey 10, Opening the shop and checking in — Jack's decisions (30 Sep 2026)

Journey 10 is the start of the shop's day: opening the till, counting in the
float, and seeing who's in and what's on. It pairs with journey 16 (closing
the day) and uses what journey 8 set up (the standard float, opening hours,
each mechanic's working days) and journey B's till check-in by PIN.
Designed in the Soft sand look on its own canvas, desktop first, then
tablet and phone. Rules for every journey apply (Workshop day 45, 48, 50,
53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

1. **Journey 10 is next** (Jack, 30 Sep), chosen over Collect the bike and
   pay, Account and reminders, and Moving from Citrus Lime.
2. **A one-tap float check when the till opens** (Jack, 30 Sep): the first
   person to check in sees "The drawer should have £[float] — Looks right /
   Count it"; Count it opens the same note-and-coin count as cash-up
   (journey 16 decision 3). Catches overnight problems at the start of the
   day. Chosen over no morning check and a full count every morning.
3. **The start-of-day overview is Office › Today** (Jack, 30 Sep): one
   page where owners and managers land, with four parts — Tills (open,
   float checked, sales waiting to send), Who's in (checked in, and who's
   due from their working days), Workshop today (bikes due in, bikes ready
   to collect) and Needs attention (e.g. a float that didn't match).
   Replaces the "[The rest of Today]" placeholder in journey 8. Chosen over
   a Today card on the till after check-in and both.
4. **Staff see Who's in and Workshop today on Today; the money side is for
   owners, managers and anyone with "Can close the day"** (Jack, 30 Sep):
   Tills and Needs attention (a short float, sales waiting) show only to
   them (Owner setup decision 9's switch), so a colleague's short float
   isn't broadcast. Chosen over everyone seeing the whole page and taking
   Today away from Staff.
5. **Checking in only records who's in and when — no check-out or hours
   list for now** (Jack, 30 Sep): the PIN check-in unlocks the till and
   stamps the time Today shows under Who's in. Keeps the start of the day
   to one step. Hours worked (check-out, a weekly hours list, breaks) can
   be added later without changing this screen. Chosen over check in and
   out with an hours list, and check in and out with breaks.
6. **Someone due in who hasn't checked in just shows on Who's in — no
   alert** (Jack, 30 Sep): "Not in yet" in grey, turning to "Late" (still
   grey) once their start time has passed; the line reads "Due in at
   [start time]". Nothing goes to Needs attention and nobody is prompted
   to move their bikes — the manager sees it at a glance. Chosen over
   flagging it under Needs attention after a set time, and a "Mark as off
   today" button that hands their bikes to someone else.
7. **If last night's day wasn't closed, the till opens as normal and it's
   flagged on Today** (Jack, 30 Sep): the first person in gets the usual
   float check, and "Wednesday 16 September wasn't closed — Till B1 ·
   yesterday's takings still to count" goes to Needs attention with a
   "Close it" button for owners, managers and anyone with "Can close the
   day". The first customer is never blocked and Staff aren't handed a job
   that isn't theirs. Chosen over closing yesterday first before any sale,
   and letting whoever is first choose.
8. **UI audit fixes, all as recommended** (Jack, 30 Sep; audit in
   `docs/design/user-journeys/opening-ui-audit.md`):
   - H1: a count that matches closes the pop-up with "Float checked"; a new
     "The float is over" pop-up matches the short one; "Done counting"
     stays off until a box has a number. An over float goes to Needs
     attention only when yesterday was closed (otherwise "wasn't closed"
     already explains it).
   - H2: sales waiting to send also go to Needs attention after [n]
     minutes, with "Try again".
   - H3: "Check" on a short float becomes "Seen" — one click clears it and
     Tills then reads "Float short · seen by Jack Lewis". "Close it" lands
     on journey 16's close the day for Wednesday 16 September.
   - M1: no ✕ on the float check; "Count it" and "Looks right" are the
     only ways out.
   - M2: Needs attention shows a count ("Needs attention · 2") and a
     warning icon on each line; a board shows two items stacked.
   - M3: a "Still to arrive" heading only — the rows otherwise stay as the
     approved Workshop Overview draws them.
   - L1–L4: warning icon on the difference, no double rule, "[reason]"
     instead of an invented example; 44px count boxes and no expected
     float on the count (blind counting); "Hello, Jo", "The shop's float",
     "All sales sent", spacing above two-line rows; labelled sections and
     lists for screen readers.
   - L5: the ✕-as-link and the shared Today/Reports icon are parked as
     design-wide fixes; the WH-1045 day and time mismatch with the diary
     is logged in the handover's open items.

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.

**Later change (2 Oct 2026, Cycle to Work decision 7, audit L4):** the Workshop today tile reads "Repairs ready to collect", so it isn't confused with a Cycle to Work stage. Needs attention can carry two Cycle to Work lines (a quote with no certificate yet, a provider payment late), drawn on journey 6. The sidebar on every board has the new Front desk › Cycle to Work item.
