# Workshop day review — Jack's decisions (27 Sep 2026)

Jack reviewed the Workshop day drawings (user journeys canvas, journey 12) and
then asked for Workshop day to be rebuilt around the diary. These are his
answers, in the order given.

## The five open points

1. **Payment.** There are two versions of Wheelhouse: the full end-to-end one,
   where the customer pays at the Wheelhouse till, and the one connected to
   Lightspeed, which sends the job to a Lightspeed till. Collection and
   "finished" use one "Take payment" step; a per-shop setting decides where it
   goes. Build one destination first and leave a clear place for the other.
2. **Messages page under Front desk:** keep it as drawn. (Today the app can
   send texts through Twilio; it cannot receive them, and WhatsApp is only a
   contact preference.)
3. *(Extended by item 20: every job page has no tabs.)* **The mechanic's job page:** no tabs, as drawn (agreement left, work right;
   tap-to-open rows on a phone).
4. **The bike tag:** a striped Code 128 barcode (the app already prints these
   on product stickers).
5. **The sidebar:** no date or open-until line.

## Workshop day is organised around the diary

6. **The diary is the Workshop room's main page**, for every role. Mechanics
   land on it too, opening on their own column with a switch to see everyone.
   The mechanic's separate "Jobs" list goes.
7. **Booking requests live in the diary's "Waiting for you" column** on the
   left, beside change requests and cancellations (as the built diary already
   does, PR #91). The separate Booking requests page goes.
8. *(Superseded by item 16: jobs open as a pop-up in the middle.)* **Jobs open in a panel over the right-hand side of the diary**; on a phone
   the panel fills the screen. Everything that was on the job page lives in
   the panel.
9. **A new job is made by clicking an open slot in the diary**, which opens
   "New job" in the panel with the day, time and mechanic filled in. Bikes with
   no set time use the diary's Unscheduled row the same way.
10. **The workshop overview stays** as a second page in the Workshop room.
11. **Every screen works on desktop, tablet and phone.** Tablets are drawn in
    landscape.

## First review of the diary canvas (row 1)

12. **A pending booking request also sits in the diary**, in the slot it asked
    for, in the purple pending colour. A confirmed job with no set time (the
    "No time" row) uses the ordinary scheduled colour, so purple only ever
    means pending.
13. **The mechanic's diary is the standard diary filtered to that mechanic**,
    with one Me / Everyone switch.
14. **Waiting for you cards: one click highlights, then open.** A single click
    highlights the job in the diary (jumping to its week) and shows an
    **Open** button on the card; double-click opens it directly. On a tablet
    or phone the first tap highlights and a second tap opens. Accept and
    Decline are in the request pop-up that opens (item 15), so staff see the
    whole request before deciding.
15. **Requests open as a pop-up in the middle of the screen**, not in the
    right-hand panel: new booking requests (Accept, Offer another time,
    Decline, and the decline message), change requests and cancellations.
    On a phone the pop-up fills the screen. (This is how the built diary's
    review pop-up already works.)
16. **Jobs open as a pop-up in the middle too**, and so does "New job" from
    an empty slot — the right-hand panel is dropped everywhere (supersedes
    item 8's panel). The job pop-up takes most of the screen (a slim
    dimmed edge of the diary around it): for a mechanic it is where the work
    happens, and the diary is the way to reach it. Request pop-ups stay
    smaller. On a phone it fills the
    screen.
17. **Diary blocks show the customer**, and each shop chooses what is most
    prominent on a block — job number, customer or bike — in its settings.
18. **New job picks the mechanic from where you click.** Clicking an empty
    slot in a mechanic's own part of the diary selects that mechanic; in the
    Everyone view Wheelhouse assigns the mechanic with the most free time
    that day (staff can change it on the form before saving). The Day view
    shows one column per mechanic so there is a "Jo's side" to click.
19. **Change requests work like pending requests in the Waiting column:** a
    click highlights the time the customer wants to move to (and the job)
    and shows Open; double-click or Open shows the change request pop-up.
20. **The job is one page, no tabs**, for everyone (supersedes the staff
    job's five tabs; the mechanic's no-tabs page from item 3 becomes the
    layout for all). Customer and bike, what the customer told us, the
    quote/agreed work, the checklist, messages and history are all on the
    one page, so nobody clicks through to find anything. Each stage of the
    job (expected, booked in, quoting, in the workshop, waiting for parts,
    finished, collecting) is the same page with that stage's main action.
21. **Checklist items can carry an optional note.** A mechanic can write
    more detail for any item or leave it blank; an item ticked with no note
    reads "All working well" to the customer.
22. **"New job" is a button at the top of the diary**, not a slot hint.
    Pressing it lets you click any free place in the diary; that opens the
    New job pop-up for that time (and that mechanic, per item 18).
23. **New job warns when the job won't fit.** Choosing the work sets the
    job's time; if the free time at the chosen slot is shorter, the form says
    so before saving.
24. **On the job page, the customer's details sit in the header** with the
    title, and the customer's name is a link to their account (previous
    purchases, services and so on).
25. **Iterate on desktop first.** While the design is being worked out, only
    the desktop drawings are updated; tablet and phone are redrawn once the
    desktop design settles.
26. **The New job form follows Citrus Lime's "Create a Workshop Job"**
    (Jack's reference screenshot, 27 Sep), in Fjell with plain labels: job
    title (filled from the work chosen), starting status, "Ready by" date
    with quick buttons (Today, Tomorrow, +3 days, +1 week, +2 weeks, Before
    the weekend) alongside the diary time, bike (from the customer's bikes
    or add one), "The bike is here now" (books it in straight away), "New
    bike build or pre-delivery check" (customer optional), a note for the
    customer printed on their receipt, and internal staff notes (each with
    who and when). Wheelhouse keeps customer search, mechanic, time needed
    and the won't-fit warning.
27. **Storage slots are optional per shop.** A shop turns them on or off in
    Settings and keeps its own list of hooks and spaces. When on, the New
    job form has "Where the bike is kept" and the diary block shows the
    slot (e.g. "Hook 3"); when off, neither appears.
28. **The overall look will be revisited.** Jack likes the content and
    structure but wants to change the look across the whole app. Once the
    desktop content settles, look at new theme options side by side on the
    same real screens (diary, job page, New job) before redrawing tablet and
    phone. Fjell (27 Sep) stays in use until then.
29. **Diary blocks show the bike, then the job title, by default** (e.g.
    "Trek Domane AL 3" / "General service"), for a mechanic's quick glance.
    The job title is filled in from the work chosen and editable. "Job title"
    joins customer, bike and job number as a choice in the Settings for
    blocks; each shop can change the default. (Refines item 17's
    customer-first default.)
30. **"One page" means reachable without leaving the job, not all open at
    once** (Jack, 28 Sep). Sections may fold away (as in Citrus Lime's Cloud
    POS job page, his reference for the job page layout); what matters is
    that everything about the job is on the one page, never a separate page.

These were drawn in a separate canvas for Jack to review
(https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U). The user journeys canvas
is updated to match once he approves.
