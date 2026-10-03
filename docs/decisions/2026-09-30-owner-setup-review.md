# Journey 8, Owner setup — Jack's decisions (30 Sep 2026)

Journey 8 is where a shop's owner and managers set up everything the other
journeys assume: quick buttons and groups, reasons, ways to pay, the float,
closing time, blind counting, staff and roles, clearing a forgotten PIN,
workshop services and mechanics, and a new shop's first-run setup. Settings
lives in the Office room for Owners and Managers only (app map 8); personal
settings stay in Your settings. Designed in the Soft sand look on its own
canvas, desktop first. Rules for every journey apply (Workshop day 45, 48,
50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

Background: approved journeys hand these settings here — till 2, 3, 4, 6,
7, 8, 10, 13, 15; cash-up 2, 4, 5, 6; signing in 6, 9; Workshop day 1, 17,
27, 29, 62, 66. The old placeholder "Set a staff PIN" (manager picks a 4–6
digit PIN) is superseded by signing in 6–7: each person sets their own
Wheelhouse-picked PIN in Your settings; a manager only clears a forgotten
one from the staff list.

1. **Journey 8 is next** (Jack, 30 Sep), chosen over Customer service,
   Opening the shop and Collect the bike and pay.
2. **The Settings page comes first, starting with till and cash-up
   settings** (Jack, 30 Sep): settle the overall shape of Settings, then
   the settings journeys 11 and 16 already rely on, then staff, then
   workshop. First-run setup (the new owner's checklist) comes after, and
   the journey can still split into 8a Settings and 8b First-run setup if
   one canvas gets too large. Chosen over first-run setup first and
   splitting into two journeys straight away.
3. **Settings lists its areas down the left, with the chosen area beside
   them** (Jack, 30 Sep): eight areas — Shop and sites, Staff and roles,
   Till, Payments, End of day, Workshop, Messages, Your data — each one
   click away, the area's settings as folding sections. Chosen over one long
   page of folding sections and a page of area cards. How the list shows on
   tablet and phone is still to draw. Board: `so-list` (setup.mjs).
4. **Settings save as soon as they're changed, with a short "Saved" note
   and an Undo** (Jack, 30 Sep): no Save buttons. Every change is recorded
   (who, when, what it was before). Chosen over a Save button per section
   and confirming only settings that affect money or sign-in.
5. **Each kind of reason has its own list** (Jack, 30 Sep): Till ›
   Reasons holds separate lists for discount, void, refund and paid-out,
   picked by pill; the till's pop-ups show only their own kind, plus
   "Other…". Chosen over one shared list and a Wheelhouse-suggested
   starting set. Board: `set-till-reasons`. Two choices drawn on the Till
   boards stand unless Jack objects: a shop can switch off Print, Email or
   Text in the Paid pop-up ("No receipt" always stays), and a quick
   button's price always comes from its product.
6. **Blind counting starts on for a new shop** (Jack, 30 Sep): settles
   cash-up decision 2's default — staff count first, then see the
   difference; the shop can turn it off in Settings › End of day. Chosen
   over off by default and asking during first-run setup.
7. **Customer accounts have one shop-wide limit, which can be changed for a
   single customer on their page** (Jack, 30 Sep): Payments › Ways to pay
   sets "Most a customer can owe"; a trusted club or regular can be given
   a different limit from their customer page (journey 15). Chosen over one
   limit with no exceptions and a limit set per customer only.
8. **Four fixed roles — Owner, Manager, Staff, Mechanic — plus a few
   per-person switches** (Jack, 30 Sep): each role has a plain
   description of what it can do; a handful of switches on a person cover
   the in-between cases (e.g. a senior mechanic who can see reports). No
   shop-made roles, which also avoids WorkOS's one-way organisation-level
   roles (auth spec §6.2). "Staff" is the till role the auth spec calls
   `cashier`. Which switches exist is the next question. Chosen over fixed
   roles only and a permissions grid.
9. **All five switches, and a Staff member can be given everything a
   Manager can do** (Jack, 30 Sep): Can see reports, Can close the day, Can
   order stock, Can edit the website, Can use the till (for mechanics).
   Jack's reason: at his shop he isn't a manager but has an administrator
   account in Citrus Lime with all the same abilities — "have the distinct
   roles, but be able to give someone who is a staff member all of the
   same permissions, ultimately, as a manager". So the role is what a
   person is; the switches can add up to a Manager's abilities.
10. **A "Can change settings" switch, and one tap to "Give everything a
    Manager can do"** (Jack, 30 Sep): with it, a Staff member's switches
    can add up to exactly a Manager (Settings includes clearing a
    forgotten PIN). Nobody can switch off their own "Can change settings".
    Only the Owner adds or removes staff and registers tills (auth spec
    §6.2, offline spec) — stands, Jack not objecting. Chosen over the
    Settings switch alone and keeping Settings to Owners and Managers.
11. **A "Works in the workshop" switch decides who is a mechanic in the
    diary, with a second switch for online booking** (Jack, 30 Sep): anyone
    with it on gets a diary column and can be picked on a booking (Workshop
    day 62); it is on for everyone with the Mechanic role. Turning it on
    shows a second switch, "Customers can book this person online".
    Jack's example: "I'm a salesman, but I work downstairs and I can do
    little jobs on demand… we want to book that into the diary, but I
    don't necessarily want people to be able to book my time in because I
    don't have a proper schedule." Online booking starts on for Mechanics
    and off for everyone else (Jack, 30 Sep, settling the draft). Chosen over the Mechanic
    role only and a separate mechanics list.
12. **Journey 12's "Diary & storage" settings board is redrawn inside
    Settings › Workshop** (Jack, 30 Sep): its approved content (what a diary
    block shows, storage slots) becomes two folding sections in the
    Workshop area, replacing the old tabbed Settings page on journey 12's
    canvas and in the big canvas. Desktop now; its tablet and phone boards
    are replaced when this journey's tablet and phone are drawn. Chosen
    over leaving journey 12's board until the build.
13. **Opening hours per site, plus each mechanic's own working days**
    (Jack, 30 Sep): Shop and sites holds each site's opening hours;
    everyone with "Works in the workshop" on has working days set on their
    person in Staff and roles, so online booking only offers a mechanic on
    days they're in and the diary knows who's working. Drawn assumption:
    "Close the day" keeps its own time in End of day, filled in from the
    site's closing time. Overlaps journey 10 (who's in today). Chosen over
    one set of hours for everything and separate workshop hours.
14. **Shops can reword, switch on or off, and choose text or email for
    every automatic message — and create their own** (Jack, 30 Sep):
    Wheelhouse supplies starting wording for each (drafted for Jack's
    approval), edited with a live preview and tap-in placeholders
    (customer's name, job number…). Shops can also add their own automatic
    messages with a "send when…" trigger. Overlaps journey 7 (reminders).
    Chosen over rewording only and fixed wording.
15. **Journey 12's "Settings · Accessibility" board is removed** (Jack,
    30 Sep: "let's remove it from the journey"): Accessibility lives in
    Your settings (app map decision 8), whose approved board is in journey
    A. Removed from journey 12's canvas (all three sizes) and the big
    canvas; the accessibility helpers stay in `diary.mjs` for Your
    settings. Chosen over leaving it marked "Moved". Journey 12's tablet
    and phone Diary settings boards still show the old Diary /
    Accessibility tabs until they are redrawn (decision 12).
16. **First-run setup is a "Getting started" checklist that links into
    Settings** (Jack, 30 Sep): at the top of Office › Today for the owner;
    each step opens the right Settings section and ticks itself when done;
    the shop can trade before finishing; the checklist goes when every step
    is ticked. Chosen over a setup wizard before the app opens and starting
    with a Citrus Lime import (journey 9 — still offered as a link).
17. **UI audit fixes adopted, as recommended** (Jack, 30 Sep: "let's go
    with all your recommendations"; `docs/design/user-journeys/setup-ui-audit.md`):
    owner-only actions (make or remove a till, add or remove people) are
    hidden from everyone but the Owner, and removing a till asks first; the
    owner invites people from Staff and roles; each checklist step says
    what ticks it, finished steps fold away, and an opened step offers
    "Next step" instead of "step 3 of 8"; a new shop's empty lists are
    drawn (one board, the rest by the same rule); "Saved · Undo" follows
    every change, and a save that fails for want of internet says so with
    Try again; one fold rule everywhere — one section open, the first
    unfinished or the one a link pointed to; "Count first" replaces
    "Blind"; Shop details gains the address; Jo Taylor is drawn the same on
    every board; reorder handles are 44px and also move by keyboard;
    Remove is an outlined button; "Clear the PIN" is outlined red like
    Void; the repeated "Changes save as you make them" line goes.
    **"Close the day" follows the site's closing time** — End of day's own
    time box goes (settles the decision 13 assumption). Dismissed: text
    sizes (labels may be 12px); parked: unselected-pill border contrast
    (1.31:1 — the same pills in every journey, a design-wide token fix for
    the Soft sand switch). The other missing states (M14–M20) are rules in
    the audit file, not drawings.
18. **"Close the day" can appear before closing time** (Jack, 30 Sep: he
    wants the option "to appear, say, about an hour or so before closing
    time"): End of day › Close the day offers At closing time, 30 minutes
    before, or 1 hour before, counted from the site's closing time. Restores
    the early option decision 17 had dropped when it removed End of day's
    own time box. Drawn with 1 hour before chosen; the default for a new
    shop is **30 minutes before closing** (Jack, 30 Sep, settling the
    draft). Also (Jack, same
    message): a workshop person's seven day pills sit on one line.
19. **The Shared queue gets a row in Workshop › Mechanics** (Jack, 30 Sep:
    for jobs "booked in for the shop floor to do rather than a certain
    mechanic" — "me and someone else will just kind of figure it out
    between us"): journey 12's Shared queue (Workshop day 32, 62) sits in
    the Mechanics list beside the people, with a name the shop can change
    (e.g. "Shop floor") and two switches — "Customers can book it online"
    and "Show it as a column in the diary". Whoever takes a job drags it
    to their column, or it stays in the queue. Chosen over no settings
    for it and a group of people sharing the jobs.
20. **The person pop-up puts the role across the top** (Jack, 30 Sep: the
    right-hand side "is at the top, and it looks kind of off" — "you have
    the roles at the top and everything else is organized underneath"):
    Role runs full width; "Also allowed to" and "Works in the workshop"
    start level beneath it. The "Give everything" note merges into one line
    under "Also allowed to".
21. **Desktop approved; on to tablet and phone** (Jack, 30 Sep: "I think
    that looks good. Should we go on to just make the mobile pages, and
    then we can finish the section up?"). Tablet and phone follow the
    journeys before: the same recipes at three sizes. Drawn 30 Sep: tablet
    keeps the desktop layout with a narrower area list; a phone opens
    Settings on the list of areas (`set-list`) and each area is its own page
    with "‹ Settings" back; pop-ups fill the phone; hover-only Edit and
    Remove aren't drawn on a phone (a tap opens the row); the checklist's
    steps are whole tappable rows on a phone. Journey 12's Diary & storage
    tablet and phone boards now use the same frame (decision 12 done at
    every size); its old tabbed Settings code is removed.
22. **Journey 8 approved at desktop, tablet and phone** (Jack, 30 Sep: "I
    like this. Let's continue on."): copied into the big user-journeys
    canvas as Designed, desktop only there, each board linking to this
    journey's canvas for tablet and phone (cash-up decision 8).
23. **The "Bike ready" starting wording includes the amount to pay and a
    link to the job** (Jack, 30 Sep: "can we have 2 and then also add the
    option to link the job notes as well so a customer can see everything
    that was done before they pick it up?"): "Hi [first name], your [bike]
    is ready to collect from [shop]. [Amount to pay] to pay on collection.
    See what we did: [link to the job]. Job [number]. We're open [opening
    hours]." The amount is what's left after any deposit. The link opens
    that one job's summary (journey 5's "Job done: summary and invoice")
    with nothing to sign into, and shows only that job. "Amount to pay" and
    "Link to the job" join the tap-in placeholders. Chosen over pointing to
    the customer's account and doing both.

## Noted for later (not for this journey)

- **Search products by their measurements and specifications** (Jack, 30
  Sep): when stock is booked in, parts can carry bike-specific details —
  a bearing's dimensions, how many gears a derailleur is for — so staff
  can search by them ("bearings with a 30 mm outside diameter") instead of
  by name. Belongs with receiving stock (journey 13), stock control
  (journey 14) and the till and header search.

**Later change (30 Sep, Customer service decision 8):** Settings ›
Payments gains a fifth section, "Customer groups" (a name and a discount
the till gives by itself); the Payments boards and the phone's Settings
list were republished here and on the big canvas.

**Later change (30 Sep, Customer service decision 10):** the separate
Loyalty points switch in Payments › Ways to pay is gone; Store credit gains
"Customers earn back [n]% of what they spend" (0% turns earning off).

**Later change (30 Sep 2026, Collect the bike and pay decision 3):**
Settings › Workshop gains a fifth section, "Collection" — hand-back
reminders, off by default. The three Workshop boards (services, mechanics,
diary) now show it folded.
Later (same day, decision 4 there): the Collection section also sets when a
"Bike still waiting" reminder goes and when an uncollected bike shows on
Today (summary "Reminder after [n] days · hand-back reminders off"); and
Messages › Automatic messages gains "Bike still waiting" (text, on) — "5 on".

**Later change (30 Sep 2026, Receiving stock decision 7):** Settings now has
four pages, one per room — Front desk (Till, Payments, Messages, End of
day), Workshop, Stockroom (new) and Office (Shop and sites, Staff and roles,
Your data). A room with several areas shows them as headings with a "Jump
to" row of pills; a phone opens on the list of four rooms. This replaces decision 3's eight areas down the left and decision 21's phone list of areas; every Settings board is redrawn. The option boards for decision 3 are kept as they were.

**Later change (1 Oct 2026, Book a repair decision 11):** Settings ›
Workshop gains an "Online booking" section between Services and Mechanics
(closed on these boards: "Exact times · 2 hours' notice · each booking a
request"). Nothing else on the Workshop settings boards changed.

**Later change (1 Oct 2026, Book a repair decision 12):** Settings › Front
desk › Messages gains a "Booking messages" group below the existing rows —
Request received, Booking confirmed (moved here from the top of the list),
New time offered, Request declined, Date change answered and Booking
cancelled — each sent "Customer's choice" (the channel the customer picked
when booking). The Automatic messages summary now reads "10 on" wherever it
shows, including the closed row on the Front desk settings boards. The
Online booking row's summary adds the deposit: "Exact times · 2 hours'
notice · deposit [n]% · each booking a request".

**Later change (1 Oct 2026, Drop off and approve the quote decisions 4–5):**
in Settings › Front desk › Messages, "Quote to approve" now goes the way the
customer chose ("Customer's choice") and reads "When a job needs the
customer's OK · reminder after [n] hours with no answer". Nothing else on the
Messages boards changed.

**Later change (1 Oct 2026, Drop off and approve the quote decision 7):** in
Settings › Messages every row has a visible "Edit" ("Edit wording" on the
hovered row), "Bike ready" and "Bike still waiting" go the way the customer
chose (the "Bike ready" wording pop-up says so instead of Text/Email
switches), and "Quote to approve" has its reminder as its own line with an
[n] hours box.

**Later change (1 Oct 2026, Account, history and reminders decisions 2, 5 and 8):**
Settings › Front desk › Messages gains a "Bringing customers back" group after
the booking messages — "Service reminder" (on, the way each customer chose,
timed on each service in Settings › Workshop › Services) and "Review request"
(off until the shop adds its review page) — each ending with a fixed "Stop
these: [link]" the shop can't delete. The Automatic messages summary reads
"11 on" wherever the Front desk area is shown.

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.

**Later change (1 Oct 2026, Reports and accounts decisions 5 and 9):** the person pop-up in Staff and roles has a new switch, "Can see costs and margin", after "Can see reports" (Off for Jo Taylor; On with "Give everything a Manager can do"). Turning it on also turns on "Can see reports". Nothing else on these boards changed.

**Later change (1 Oct 2026, Buy online decision 10):** Settings › Front desk has a fifth section, "Online orders" (what the website sells, showing products, paying online, not collected), with its Jump to pill; Settings › Messages lists five online-order messages under "Online order messages", and Automatic messages reads "15 on".

**Later change (2 Oct 2026, Management oversight decisions 6 and 7):** every person shows "Signed in · Sign out everywhere"; Settings › Office › Staff and roles gains "Signed-in devices" and "Alerts on Today" (set by the owner). Nothing else changed.

**Later change (2 Oct 2026, Cycle to Work decisions 2, 6 and 7):** Settings › Front desk has a Cycle to Work tab (holding bikes and quotes, bikes not in stock, how to apply, deposits, scheme providers, On Today); Messages lists four Cycle to Work messages ("19 on"); Payments › Other ways to pay reads "Cycle to Work · Recorded at the till against a Cycle to Work order". The sidebar on every board has the new Front desk › Cycle to Work item.

**Later change (3 Oct 2026, third walk, answer 10, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1". Getting started for a shop moving from Citrus Lime is drawn now (`fr-today-moving`), as a situation of Getting started: one checklist with the move's stage, the steps the move shares (card machine, float, website) listed once, and "Running alongside Citrus Lime: the tills start on switch-over day". It replaces the practice-mode wording dropped by issue #116 question 4. Taken without a question, following decision 17: a page opened from Getting started keeps its bar, including Staff and roles after the invite. Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.
