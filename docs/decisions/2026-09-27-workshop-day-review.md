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
31. **The job page follows the Citrus Lime layout (option 5)**, revised:
    - **One notes box** holds everything written about the job. What the
      customer told us (from their booking, or typed in when staff create
      the job) goes into the same notes, marked as the customer's; staff
      notes show who wrote them and when.
    - **Writing notes is the main thing** a staff member does on opening a
      job, so the notes box is large and prominent.
    - **Job details are a compact strip at the top**, always visible, not
      a folding section.
    - **Work and parts sit at the bottom and are small by default** (a
      summary with Scan barcode / Add item ready, since usually you just
      scan an item in); expand to see every line.
32. **No mechanic field on the job.** The mechanic is shown and decided by
    where the job sits in the diary; to change it, drag the job to the other
    mechanic's column in the Day view. The job page has no mechanic select; the
    mechanic's name is shown as plain text in the customer strip at the top
    (e.g. "Mechanic: Alex Morgan");
    New job takes the mechanic from where you clicked (or the automatic
    choice in the Everyone view, item 18) without a select.
33. **The job page is a refined version of Citrus Lime's job page** (Jack,
    28 Sep, after comparing options 5 and 6): he prefers option 5, and
    seeing the work and parts list straight away is part of why. Work and
    parts stay visible without opening anything (compact, at the bottom,
    scan-in ready), rather than folded to one line as in option 6.
34. **The job page is study variant A, "Faithful Five"** (Jack, 28 Sep,
    on the design review in docs/design/user-journeys/job-page-study.md §7):
    option 5's structure; the notes stay as the right-hand column of the
    job details, made more prominent; the full work and parts table open
    below; checklist folded. The review's refinements apply, and controls a
    mechanic presses are raised to 44px now rather than in the look pass.
35. **The job page has three parts** (Jack, 28 Sep, after the final
    drawing): (1) **information** — the customer's name, number and
    details, and the job's details (job number, whether the bike is here,
    and so on); (2) **notes** — one big text box holding everything, with
    the checklist incorporated into it; (3) **work and parts** — the items
    and labour charged for the job. Supersedes the notes feed of items 31
    and 34 and the separate folded checklist. The final drawing
    ("Job page · FINAL (in the workshop)") stays the base — Jack: "the
    closest to how I want it" — with the notes turned into one big text box.
    (Checklist placement: see item 36.)
36. **Notes box plus a "Detailed notes" section** (Jack, 28 Sep): the notes
    are one plain text box where everything typed so far can be edited — for
    basic notes. From within it, staff can open a **Detailed notes** section
    that holds the service checklist, with a note field for each checklist
    item, for when they want to write more detail. It opens on the job page
    (no separate page).
37. **Right-click a diary block → "View overview"** (Jack, 28 Sep): a
    small box over the diary with just the job's notes, its line items and
    the cost — no customer details or mechanic — so a staff member on the
    phone to a customer can catch up on the job quickly without opening it.
    Holding the right mouse button opens the overview straight away (a
    quick right-click shows the menu); the box stays open until closed. Its
    header adds the customer's name and the bike under the job title.
38. **The notes box is a plain canvas with a customer section on top**
    (Jack, 28 Sep): the customer's notes from their booking sit in a section
    at the top of the box, closed off by an underline; staff can keep adding
    to that section when the customer explains more in the shop. Below the
    line, the job's notes are plain text — no name or time stamps on what
    staff write (supersedes the stamps in item 36's drawing). No prompts or
    placeholder text anywhere in the box — just one large text box.
39. **The notes box is settled** (Jack: "exactly how I want it").
    **"Detailed notes" becomes "Full service checklist"** and opens as its
    own pop-up that takes the whole screen over the job (a mechanic filling
    it in is doing only that). It appears only for jobs whose service has a
    checklist (a general service or the bigger services) — not, for
    example, a hub service.
40. **The job page is settled** (Jack, 28 Sep): the "notes box" page with
    the Full service checklist pop-up is the job page at every stage of
    "The job" row, following the stages table.
41. **Booking: the customer sets a spending limit** (Jack, 28 Sep; for the
    customer booking pages at /book, a separate piece from Workshop day):
    when booking, a customer can say how much they're happy for the work to
    come to — e.g. "up to £200" — and anything beyond that means the shop
    calls them with a quote first. Most customers want to name a price once
    rather than go back and forth over each addition.
42. **The spending limit shows on the job page** (Jack, 28 Sep): a small tag
    in the job details, e.g. "Customer OK up to £200", so a mechanic sees at
    a glance whether extra work can go ahead or needs a call first.
43. **Under the customer's spending limit, the quote step is skipped
    automatically** (Jack, 28 Sep): work within the limit goes ahead without
    sending a quote; a quote is sent only when the total would go over the
    limit, or when the customer set no limit.
44. **A change request draws a line from the job to the time the customer
    wants** in the diary, so the move reads at a glance — only once the
    Change requested card is clicked, from the middle of the original job's
    bottom edge to the middle of the requested slot's top edge, so it never
    covers either box's contents (Jack, 28 Sep).
45. **Diary blocks lose the darker bar on their left edge**; instead each
    block has a full outline in that darker colour around its tinted fill.
46. **Work and parts lines sort themselves: labour at the top, parts
    below.**
47. **Look options are drawn on the job page** (Jack, 28 Sep), open over the
    diary. The aim: light and airy, very modern, simple and minimal while
    keeping all the information — emulating the general aesthetic of the
    Anthropic website (warm light ground, generous space, sections separated
    by thin rules and space, a characterful heading face over a plain body
    face, one restrained accent) without copying it: open-licence fonts and
    Wheelhouse's own colours.
48. **Look 4, "Soft sand, dark rail", is Wheelhouse's standard look**
    (Jack, 28 Sep), for every page from now on — superseding Fjell
    (docs/decisions/2026-09-27-fjell-theme.md): soft sand ground `#F4EEE1`,
    charcoal sidebar `#262420`, a small amber highlight `#D9A441` for active
    states only, Source Serif 4 for headings over Public Sans for body (see
    generator/looks.mjs for the full palette). The Workshop day redesign is
    redrawn in it first so Jack can see the whole section in the new look.
49. **Clicking the customer's phone number on the job opens the text
    conversation with that customer** (Jack, 28 Sep) — a future feature,
    tied to the Messages page (receiving texts isn't built yet).
50. **"Bike is here" and "New bike build" are clickable pills**, not tick
    boxes (Jack, 28 Sep): a pill that is filled when on and outlined when
    off, on the job page — and, for consistency, the same two choices on the
    New job form. "New bike build" appears only on the New job form; once
    the job exists it isn't shown on the job page (Jack, 28 Sep).
51. **No separate "Ready by" on New job** (Jack, 28 Sep): the diary day
    chosen for the job is its ready-by day. The Ready by field and its quick
    buttons (Today, Tomorrow, +3 days…) come off the New job form; the job
    page shows ready-by as the diary day, and it moves when the job is moved
    in the diary. (Refines item 26.)
52. **Open: jobs that take more than one day** (raised by Jack, 28 Sep) —
    how the diary shows a job worked across several days is still to be
    designed. Two cases to cover: a job planned over several days, and a job
    that simply isn't finished in its day without having been planned that
    way (it has to carry over). Options discussed: split into parts per day
    (recommended), one bar across the days, or both. To revisit later.
53. **Sans-serif throughout** (Jack, 28 Sep): the Soft sand look uses
    Public Sans for headings as well as body (the serif headings of Look 4
    are dropped). **Destructive buttons such as Unschedule are outlined**
    rather than filled.
54. **New job shows the mechanic, doesn't ask for it** (applying item 32 to
    the form): the chosen time and mechanic appear together at the top of
    the form ("Tue 15 Sep · 10:00 · Alex Morgan") with the reason; changing
    the mechanic is done by dragging in the Day view.
55. **UI audit adopted as a finishing pass** (Jack, 29 Sep; audit in
    docs/design/user-journeys/workshop-day-ui-audit.md): fix the five High
    findings and the quick wins; short diary blocks show status as a colour
    dot/icon with the word where there's room (S1, which is also the fix for
    H1); the work-and-parts "Done" ticks get a full 44px touch area; S2–S4
    are drawn as before/after boards for Jack to choose.
56. **The change-request arrow is a smooth curve** (Jack, 29 Sep, with a
    reference image of a swooping curved arrow): it bows out in an arc from
    the original job to the requested slot, drawn on top of the jobs in
    between, arrowhead at the requested slot. Nice-to-have, not required
    now: when the Change requested card is clicked, the arrow animates
    (draws itself from the job to the new slot).
57. **Status is colour-only by default; status symbols are an
    accessibility setting** (Jack, 29 Sep): the diary shows status by colour
    alone unless "Show status symbols" is switched on. Settings gains an
    Accessibility tab (beside the diary settings). Jack wants Wheelhouse to
    be as accessible as possible. Accessibility choices are per person
    (each staff member's own), since they depend on who is using the screen.
    The Accessibility tab has three settings (Jack, 29 Sep): Show status
    symbols; Reduce motion (turns off animations such as the change-request
    arrow, and follows the computer's own reduce-motion setting
    automatically); Larger text (a step up in text size across the app).
58. **Audit ideas S2, S3 and S4 adopted** (Jack, 29 Sep): the job's
    customer strip in two rows; the Full service checklist in collapsed
    tick-and-label rows with a note box only where a note exists; overlapping
    jobs shown as a stacked-card control.
59. **Stacked jobs expand on hover and open as real blocks** (Jack, 29 Sep):
    hovering a stack for about 300 ms lifts and fans the stacked jobs out
    (covering neighbouring days for the moment) so each can be seen;
    choosing from a stack shows the actual diary blocks (same look as the
    rest of the diary), not a text list. Jobs that only partly overlap in
    time (e.g. 9–11 and 10–12) sit side by side, each at its true start and
    end and sharing the day's width only where they overlap (calendar
    style); the stacked-card control is for jobs that start at the same
    time; hover-to-expand helps with the narrower side-by-side blocks.
60. **The diary toolbar gives each control its own shape** (Jack, 29 Sep):
    Week / Day as a segmented switch; Previous / Next as small arrow buttons
    either side of the date range, with Today as a small text button;
    the mechanic filter as people chips (initial badge + name, tinted when
    selected, not solid); New job the one solid dark button, alone at the
    right. Grouped left to right: view · dates · people and New job.
61. **Stacked jobs fan out from the middle** (Jack, 29 Sep): on hover the
    stack spreads centred on its own day — with two jobs, one to the left
    and one to the right; with three or more, at most two per row side by
    side, each further pair on a row underneath (a small grid growing
    downwards), rather than fanning out to the right.
62. **Choosing the mechanic on a booking request uses pills**, not a
    dropdown (Jack, 29 Sep): a small set of pills (the shop's mechanics and
    the shared queue) on the request pop-up.
63. **Open (future): taking payment normally also records collection**
    (Jack, 29 Sep): about 90% of the time payment happens as the bike goes
    out, so "Take payment" and "Record collection" should be one step by
    default, with a way to say otherwise for a deposit or pay-now-collect-
    later. To design later.
64. **Mechanic sign-off** (Jack, 29 Sep): a mechanic signs a job off —
    puts their name to it, saying it's fine to go out — so if a job comes
    back the shop can see who worked on it and who passed it. Not yet
    designed (no existing feature does this).
65. **Hover a job for its summary, as an extra** (Jack, 29 Sep): resting on
    a diary job for about 0.6 s shows the quick-look summary (notes, line
    items, cost); stacks keep their 0.3 s fan-out, and resting on a fanned
    job then shows its summary. Right-click (long-press on touch) stays.
66. **Branching pills instead of dropdowns for short and grouped choices**
    (Jack, 29 Sep): e.g. the work — Full service / Individual service, then
    that group's services — plus starting status, mechanic, storage hook.
    Long lists (customers, bikes, parts) stay as search boxes; services also
    keep a small search. Shops group their services in service settings.
67. **No heavy left-edge accents on boxes** (Jack, 29 Sep): anything drawn
    with a thick darker left edge (e.g. the Notes box on the job page,
    customer notes, limit tag) gets a thin border all the way round instead.
68. **Desktop design approved; tablet and phone next** (Jack, 29 Sep:
    "this all looks good, let's see it in tablet and phone too"). Every
    desktop decision carries over; hover features become long-press on
    touch screens.
69. **Workshop day approved** (Jack, 29 Sep) — desktop, tablet and phone.
    It is copied into the user journeys canvas as journey 12, status
    Designed, in the Soft sand look.

These were drawn in a separate canvas for Jack to review
(https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U). The user journeys canvas
is updated to match once he approves.
