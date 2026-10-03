# Journey 19 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 13 desktop renders of the
Multiple sites boards (1280 x 800, `ms-switch-open`, `ms-today-all`,
`ms-pick-shop`, `ms-service-price`, `ms-services-differs`, `ms-product-price`,
`ms-person`, `ms-book-shop`, `ms-book-shop-chosen`, `ms-sites`, `ms-add-shop`,
`ms-today-new`, `ms-tills`), against
`docs/decisions/2026-10-01-multiple-sites-review.md` (decisions 1-8),
`generator/sites.mjs` (`shopOption`, `switchMenu`, `shopRow`, `todayAll`,
`pickShop`, `priceLine`, `shopPrices`, `offeredRow`, `worksAtDialog`, `dayPills`,
`shopChoice`, `siteCard`, `addShopDialog`, `todayNew`, `tillsGrouped`), the pieces
it borrows (`opening.mjs` `today`; `diary.mjs` `withSite`, the sidebar switcher;
`setup.mjs` `servicesOpen`, `set-staff`; `stock.mjs` `tr-sites`; `book.mjs`
`shopStepAt`, `serviceAfterShopAt`; `settings-frame.mjs`), the rendered HTML of
each board for the accessibility checks, and the earlier decisions it has to agree
with (Stock take and stock control 8, Owner setup 8, 10 and 13, Signing in 9,
Book a repair). Tablet and phone are not drawn yet, so nothing here covers them.

**Scope.** `ms-switch-open` is the ordinary Today with the switcher open; only the
menu is new. `ms-product-price`, `ms-person`, `ms-book-shop-chosen` and
`ms-services-differs` sit on earlier journeys' pages: only the new parts and
whether the rest of the board agrees with them are audited.

**Not raised, on purpose.** The [bracketed] placeholders (`[Second site]`,
`[Address]`, `[n]`, `[price]`, `[code]`, `[opens]`, `[sales]`, `[time]`). The
`[code]` tile on `ms-sites`, which is wider than one letter only because the
placeholder is. The shop logo slot. Scroll areas the renderer clips (foot of
`ms-sites`, the cut-off row above Tills on `ms-tills`, the foot of
`ms-book-shop-chosen`). Tablet and phone. 12-13px text that is only a label. The
Soft sand look. Real example data: North Street Cycles, Bolton, 24 North Street,
code B, tills B1-B3, Jack Lewis, Jo Taylor, Alex Morgan, Aisha Khan, WH-1050,
Standard service £65.00, Shimano brake pads B05S-RX £28.00. None of the eight
decisions is reopened.

**Verdict.** The decisions are carried out and the look is right: Soft sand, one
dark button per board, every control at least 44px (menu rows are 52px, pills and
price fields 44px, rows 56-64px), form fields have real `<label for>`, dialogs have
a role, a labelled title and a Close button, the booking step is a labelled radio
group, the days are labelled pressed-state groups, and headings run h1, h2, h3 (h4
for shop names on the tills list). The plain wording is mostly good: "Different at
a shop?", "Same as all shops", "Stock starts at zero". The problems are at the
edges of the decisions. Two rules in the decisions meet without an answer (who gets
"All shops", and what the till does when the chosen shop is not the till's shop).
The switcher and the all-shops rows are the two most-used new controls and both
have accessibility faults. The "a day can only be at one shop" rule is stated but
cannot be done on the board as drawn. Several states the decisions create are not
drawn: a duplicate shop code, a service not offered at a shop, staff with two
shops, someone with one shop, the confirmation after switching. Findings are
ranked; where a fix is a real choice the options are numbered.

Checked against the source, not just the pictures: the switcher trigger in every
board is `<button aria-label="Switch site">` with no `aria-haspopup` and no
`aria-expanded`, and the menu is `role="menu"` with `role="menuitemradio"` rows and a
trailing `<p>`; `shopRow()` returns an `<a href="#">` and `todayAll()` puts a
`<span role="link">` inside it; the `role="list"` that wraps the two shop rows has
`<a>` children, not list items; `offeredRow()` renders two `aria-pressed` buttons
with no group and no label; `removeBtn()` has the accessible name "Use the
all-shops price at [Second site]" and the visible text "Same as all shops";
`dayPills()` renders every day as an independent `aria-pressed` button with no
check against the other shop; `worksAtDialog()` is its own small pop-up, not the
existing `personDialog()` of `set-staff-person`; `addShopDialog()` has no error
slot, no required marks, no suggestion for the code and no cost line;
`shopStepBody()` marks Bolton `aria-checked="true"` with nothing saying why;
`todayNew()`'s steps have an `aria-hidden` circle and, for open steps, only a
button; `tillsGrouped()` sets shop names in 14px/700 `<h4>` and till names in
15px/700. Nothing was run in a browser.

---

## High

**H1 — `ms-switch-open`, `ms-today-all`, `ms-person`: decisions 1 and 4 disagree
about who sees "All shops".**
Decision 1: "Owners and managers have an extra 'All shops' choice." Decision 4:
"the switcher offers only their shops (someone with one shop never sees it); owners
always see every shop." So a manager who works only at Bolton either gets a switcher
with "All shops" (and sees [Second site]'s sales on Today), or gets no switcher. The
menu's own footnote says "'All shops' is for owners and managers", which settles
nothing for that person. `ms-person` shows Works at for a mechanic only; it never
shows what Works at does for an owner or a manager.
*Why it matters:* it decides who can see another shop's money. It has to be answered
before the person page, the switcher and Today are built.
*Decision for Jack:*
1. "All shops" appears for an owner always, and for a manager only if they work at
   two or more shops, and then it combines just those shops. A manager at one shop
   sees no switcher. Keeps "your shops only" true for everyone but the owner; one
   extra rule to explain on the person page.
2. "All shops" for every owner and manager, whatever their Works at. Matches decision
   1 word for word; a Bolton-only manager can read [Second site]'s figures and Works
   at no longer limits them.
3. "All shops" for owners only. Simplest to build and to explain; a manager who runs
   both shops cannot see them together.
Recommend 1. Draw the owner's Works at as ticked and greyed ("Owners see every
shop") and say the manager rule in one line under it.

**H2 — `ms-switch-open`, `ms-pick-shop`: the till has no answer when the chosen shop
is not the till's shop.**
Decision 1 puts the till in the "whole app works for the chosen shop" list. The
background of the decisions says each till is registered to a site and its receipts
carry that site's code (B1-1042). Nothing says what happens on the computer that is
Bolton's B1 when someone picks [Second site] in the sidebar and opens Till. Only the
diary's "choose one" page is drawn (`ms-pick-shop`); the till's version is not.
*Why it matters:* a sale made under the wrong shop moves the wrong shop's stock and
lands in the wrong cash-up. It is the one place the switcher can cause real harm.
*Decision for Jack:*
1. The Till page always works for the till's own shop. If the sidebar shows another
   shop, the Till page says so at the top ("This till is Bolton's. Sales here are
   Bolton's.") and its sales, receipts and cash-up stay Bolton's. Safe; a manager at
   the other shop's desk still sells on a Bolton-registered computer only as Bolton.
2. Switching the shop is not offered on a computer registered as a till; those
   people use a different computer or sign in again. Hard to get wrong; costs a
   manager who wanted to check the other shop from the till.
3. Allow it with a confirmation each time. Most flexible; the wrong-shop risk
   returns every time someone clicks through.
Recommend 1. Draw one board: the Till page opened from [Second site] on a B1
computer. Reuse `ms-pick-shop` for the other single-shop pages (Workshop overview,
Stock take), with the page name in the heading.

**H3 — `ms-today-all`: each shop row is a link that contains another link, and its
name does not say what it does.**
`shopRow()` is one `<a>` for the whole row, and the till status inside it is a
`<span role="link">`. A link inside a link is not valid; keyboard and screen-reader
users cannot reach the till status separately, which is the decision 8 target ("a
shop's till status on Today's rows opens it"). The name read out is the whole row
("Bolton Open [opens]–[closes] Sales so far £[sales] ..."), and "Tap a shop to work
in it" is a note below, not part of the link. The `role="list"` around the rows has
`<a>` children rather than list items.
*Why it matters:* decisions 6 and 8 both depend on these two targets, and
accessibility is Jack's first rule.
*Fix, choose how:*
1. Two real targets per row: the shop name is the link ("Work in Bolton"), the till
   status is its own link or button next to it ("Bolton tills: all sales sent"). No
   nesting; rows become list items. One extra visible edge, nothing else changes.
2. Keep the whole row as the one target (switch to that shop) and take the till
   link out of the row into the "Needs attention" list only when something is
   waiting. Fewer targets; the till is no longer one click from the row, which
   decision 8 asked for.
Recommend 1. Give the shop link the accessible name "Work in Bolton" and the till
link "Bolton tills".

**H4 — `ms-switch-open` and every board with the sidebar: the switcher's name,
state and focus are not specified.**
The trigger is named "Switch site" while it shows "North Street Cycles / Bolton", so
the visible words are not in the name (label in name), and it says "site" where the
menu says "shop". It has no `aria-haspopup="menu"` and no `aria-expanded`, so the
open state is silent. The menu is a `role="menu"` that also holds a plain paragraph
("'All shops' is for owners and managers"), which is not a menu item; it is also
redundant, since only people who can choose "All shops" see the row. The checked row
is marked by a tick and a tinted fill, which is right. Not drawn or stated: focus on
opening, arrow-key movement, Escape, focus back to the trigger, close on outside
click, and the announcement after choosing.
*Why it matters:* this is the control that sets what every other page shows.
*Fix:*
1. Name the trigger "Shop: Bolton. Choose a shop" (contains the visible words), add
   `aria-haspopup="menu"` and `aria-expanded`; open with focus on the ticked row;
   arrows move, Escape closes and returns focus; choosing closes the menu and
   announces "Now working in [Second site]" (see M3); delete the footnote or turn it
   into the menu's own accessible description. Write this as a short note under the
   board, as other boards do for their pop-ups.
2. As 1, and show the focus ring on the open menu's ticked row in the drawing.
   One extra detail on one board.
Recommend 2.

**H5 — `ms-person`: "A day can only be at one shop" is not possible on the board as
drawn.**
Alex's Bolton days are Mon-Sat and [Second site]'s are none, with the hint "A day can
only be at one shop." Nothing stops tapping Thu at both shops, and decision 4's own
example (Bolton Mon-Wed, [Second site] Thu-Fri) cannot be reached without first
unticking three Bolton days with no sign that this is needed. Also not drawn:
unticking a shop under Works at (does its days block disappear, and what happens to
jobs already booked with Alex there), and a day already taken shown at the other
shop.
*Why it matters:* a mechanic in two diaries on the same day means online booking
offers times that cannot be kept.
*Fix, choose how:*
1. A day taken at the other shop is disabled at this one and says where, "Thu ·
   Bolton"; to move it, untick it at Bolton first. Cannot go wrong; one extra tap to
   move a day.
2. Tapping a day taken at the other shop moves it, with a line under the pills "Thu
   moved from Bolton". Fewest taps; easy to move a day by accident.
Recommend 1. Add: unticking a shop under Works at hides its days block and, if Alex
has booked jobs there, says "Alex has [n] jobs at [Second site] after today.
Reassign them first" (a message line, not a new screen).

---

## Medium

**M1 — `ms-add-shop`: no error or suggestion for the code, and no way to see what
is required.**
Decision 7: the code is "suggested from the name". The form shows an empty "One
letter" box. Not drawn: the suggestion after the name is typed, "B" already used
(the form must say which shop has it), a number or two letters, and which fields are
required. The fields carry no required marks and there is no error line or announcement.
*Why it matters:* the code ends up on every till and receipt (B1-1042) and is the
one field that cannot easily be changed later; a duplicate would make two shops'
receipts look the same.
*Fix:* draw one more board, `ms-add-shop-error`: Name "Bolton Road" suggests "R";
typing "B" shows under the box "B is North Street Cycles, Bolton's code. Choose
another letter." in the error style used elsewhere, with `aria-describedby` and the
dialog's error announced. Mark Name, Code and Address "(required)" in the label.
Phone and hours stay optional.

**M2 — `ms-add-shop`: two parts of decision 7 are not on the form.**
Opening hours is one button, "Copy Bolton's hours", and nothing shows what it does:
no hours, no result, and nothing stopping saving with none, while decision 13 of
Owner setup makes "Close the day" follow the closing time. Decision 7 also says "if
adding a shop changes what Wheelhouse costs, the form says so before saving"; the
form has no place for that sentence. (No price exists yet, so the line would be a
placeholder.)
*Fix, choose how:*
1. Show the week as seven short rows (Mon [opens]–[closes]) with "Copy Bolton's
   hours" filling them and "Closed" per day, and a [cost line] placeholder above the
   buttons. Reuses Owner setup's hours layout; the dialog gets taller and scrolls.
2. Keep the button, show a one-line result after pressing it ("Same hours as Bolton:
   Mon-Sat [opens]–[closes]") and the [cost line] placeholder. Shorter; any change to
   a day is still after saving.
Recommend 2.

**M3 — `ms-switch-open`, `ms-pick-shop`, `ms-today-new`: nothing confirms a switch.**
After choosing, the only change is the small shop name in the sidebar. No board
shows the moment of switching, a line announced to screen readers, or which page you
land on (the same page for the new shop, presumably). After "Add the shop" the app
lands on [Second site]'s Today (`ms-today-new`) with no sentence saying it moved
you.
*Why it matters:* decision 1 says every page says which shop it is showing; the one
time that matters most is the second after it changes.
*Fix:* a polite status line, "Now working in [Second site]", at the top of the page
for a few seconds and announced; after adding a shop, "[Second site] added. You are
now looking at it." The page you are on stays the page you are on, unless it needs a
single shop.

**M4 — `ms-switch-open`: staff with two shops, and someone with one shop, are not
drawn.**
Every board has a switcher with a chevron and a manager's "All shops". The decisions
create two other cases: a Staff or Mechanic member at two shops (menu with their
shops and no "All shops") and a person at one shop (decision 4: "never sees it", so a
plain "North Street Cycles / Bolton" label with no chevron and no button). The Settings
boards also show only the owner or the manager; who sees "+ Add a shop", "Edit" on a
shop and the Tills note ("Only the owner can add or remove tills") for a manager is
not shown.
*Fix, choose how:*
1. Draw two small boards (staff switcher; one-shop sidebar) and one manager view of
   `ms-sites`. Complete; three more boards.
2. One note under `ms-switch-open` listing the three states in words, and a manager
   view of `ms-sites` only. Quicker; the one-shop label (which is the most common
   case for a small shop) is not seen until it is built.
Recommend 1 for the one-shop sidebar and the manager `ms-sites`, 2 for the staff
switcher.

**M5 — `ms-services-differs`, `ms-service-price`, `ms-product-price`: the price
shown does not say which shop's, and the list shows one price when it differs.**
The Services row says "£65.00" and "Differs by shop". If someone is working at
[Second site], decision 3 says each place shows "its own shop's price"; this row
would still say £65.00. The product dialog behind `ms-product-price` has "In stock"
for both shops and a price dialog that never says which shop you are looking at from.
*Why it matters:* the one line that is meant to stop a wrong price being quoted
gives only the all-shops price.
*Fix, choose how:*
1. Show the chosen shop's price in the list ("£[price] here · £65.00 all shops") only
   for rows that differ. One more phrase on a few rows.
2. Keep one price, and replace "Differs by shop" with "Different at [Second site]".
   Smaller; the price shown may still be the wrong one for the shop being viewed.
Recommend 1.

**M6 — `ms-service-price`: "Offered at" has no group label, no off state, and its
sentence reads like a label.**
Two `aria-pressed` buttons ("Bolton", "[Second site]") with no group name, so a
screen reader says "Bolton, toggle button, pressed" and never "Offered at". The
sentence "Not offered: it doesn't show at that shop's till or in its online booking"
describes the off state but is written like a heading. The off state is not drawn:
decision 3's "Not offered at [Second site]", and what happens to that shop's price
line when the service is not offered there (it should go or grey out), and to bookings already
made. Another reused-board problem: the Services list does not show "Not offered at
[Second site]" anywhere.
*Fix:* wrap in `role="group"` labelled "Offered at"; sentence "Untick a shop to stop
offering this service there. It then won't show at that shop's till or in its online
booking."; draw `ms-service-not-offered` with the [Second site] pill unticked, its
price line greyed ("Not offered here"), and the list row showing "Not offered at
[Second site]".

**M7 — `ms-person`: Works at is drawn in its own small pop-up, not on the person's
page.**
Decision 4: "Each person has 'Works at' on their page in Staff and roles." The existing
person pop-up (`set-staff-person`) holds the role, the five switches, the PIN and "In
the workshop on" with its days; `ms-person` replaces it with a different pop-up, so it is not
clear where Works at sits among those, or whether "Days in the workshop · Bolton" (new
wording) replaces "In the workshop on" (Owner setup 13). The page behind shows one row
as "Open".
*Fix:* draw Works at and the per-shop days inside the real person pop-up, keep one
wording ("In the workshop on · Bolton"), and show the one-shop case without the Works
at block (one shop = nothing to choose).

**M8 — `ms-book-shop`: Bolton is ticked with no reason, and choosing costs an extra click.**
Decision 5 says "Which shop?" is already chosen only when the customer came from a
shop's page or a reminder; otherwise nothing should be chosen. The board has Bolton
selected with no sentence; a customer who came from the home page would not know
they have been given Bolton and could press Next. The "Next: what does your bike need?"
button is needed even when there is only one thing to decide. The selected card uses
a thicker border and a tint, with no tick (the service cards on the next board use
"✓ Chosen").
*Fix, choose how:*
1. Nothing chosen unless Bolton came from the page they were on. When it did, say so:
   "From Bolton's page" under the title. Choosing a card goes straight to step 1, no
   Next button; a tick on the chosen card. Fewest clicks; a customer who mis-taps goes
   back with "Change".
2. Keep Next and the pre-choice, but add the "From Bolton's page" line and the tick.
   Fewer surprises; one more click for everybody.
Recommend 1. Draw the empty state (nothing chosen, Next disabled with "Choose a shop
to carry on") as well.

**M9 — `ms-book-shop-chosen`, `ms-book-shop`: changing the shop later has no
consequence shown, and the shop is missing from the booking summary and footer.**
"Change" on the Shop strip has no state: moving to [Second site] after choosing the
Standard service and a time can change the price, remove the service, or clear the
time. "Your booking" lists Service, Bike, When and Price but not the shop; decision 5
says the booking and every message name the shop. The page footer says "North Street
Cycles · Bolton" before and after, whatever shop was chosen.
*Fix:* when Change is used, say what resets ("Changing shop clears your time. Your
service stays if [Second site] offers it."); add a "Shop" row at the top of "Your
booking"; make the footer follow the chosen shop, or say "North Street Cycles" until
one is chosen.

**M10 — `ms-tills`: shop names are weaker than the rows they head, and the fold
summary and the owner's way in are unclear.**
The shop names are 14px/700; the till names under them are 15px/700, so "Bolton"
reads like another row. The closed-fold summary is "B1–B3 · [Second site]", mixing
till codes with a shop name. "Only the owner can add or remove tills" is stated, but
there is no "+ Add a till" for the owner on this list (the Today checklist's "How"
is the only way in) and nothing for a manager to do with the sentence.
*Fix:* shop names 16px/700 with the tills' count on the right ("Bolton · 3 tills");
summary "Bolton B1–B3 · [Second site] [n] tills"; for the owner a "+ Add a till" under
each shop that also is the target of "Register its tills · How".

**M11 — `ms-today-new`: the checklist buttons do not say what they do, and the
stock step has one path.**
"How" says nothing out of its row and its accessible name is "How"; "Staff and roles"
is a place, not an action; "Send from Bolton" is one of the two ways decision 7 gives
("send from Bolton, or count it with a stock take") and the other has no button.
Open steps have an `aria-hidden` circle and no word, so a screen reader hears an
action but not that it is not done. "This goes from Today when all four are done" does
not say what "This" is.
*Fix:* "Register its tills" with the button "Register a till"; "Choose who works there"
with "Open Staff and roles"; "Get its stock in" with two buttons, "Send from Bolton"
and "Count it" (a stock take); `aria-label` on each ("Register tills at [Second
site]") and "Not done" read before each open step; "This list goes away when all four
are done."

**M12 — `ms-switch-open`, `ms-sites`, `ms-tills`: "site" and "shop" are mixed for the
same thing.**
The trigger says "Switch site", the Settings fold and tab say "Shop and sites" and
"Sites", the checklist says "Getting [Second site] ready", the menu and decisions say
"shop", and "Where are you working today?" (Signing in) says "more than one site". Plain
English is a rule; a shop owner says "shop".
*Decision for Jack:* the words are partly from approved journeys.
1. "Shop" everywhere staff read it: "Switch shop", "Your shops" for the fold, "Shop
   details" for the page ("Shop and shops" would be awkward). Needs a pass through
   Owner setup and Signing in's boards.
2. Keep "Sites" in Settings (the owner's view of the setup) and "shop" everywhere else.
   Fewer boards to touch; one word to explain to the owner.
3. Leave as drawn.
Recommend 2, and "Switch shop" on the trigger either way (H4).

**M13 — `ms-switch-open`, `ms-today-all`: Bolton's own Today and the All shops Today
disagree about Bolton.**
`ms-switch-open` is the ordinary Bolton Today: "Needs attention: Nothing needs you
right now." `ms-today-all` (same date) lists WH-1050 ready since Mon 14 Sep as a
Bolton line in "Needs attention · 3".
*Why it matters:* the two boards are meant to show the same shop; whoever reads them
together will think one is broken.
*Fix, choose how:*
1. Make the All shops list [Second site]-only (three lines), so Bolton has none and
   both boards agree. Loses the example of a Bolton line carrying its tag.
2. Put WH-1050 on Bolton's own Today. That is `opening.mjs`'s shared `today`, so it
   changes other journeys' boards. Keeps the tag doing real work; touches a reused
   board.
Recommend 1, keeping one Bolton line only if the shared Today is changed later.

---

## Low

**L1 — `ms-today-all`: the three figures do not line up between shops, and every row
repeats the labels.**
"Sales so far", "Bikes expected" and "Ready to collect" start at x 523/518, 715/705,
907/892 in the two rows, because each row has its own grid with an `auto` last
column. The labels repeat in each row.
*Fix:* one grid for the section with the labels once as column headings; fixed width
for the till column. Row height stays 64px.

**L2 — `ms-service-price`, `ms-product-price`: price controls.**
"Same as all shops" is named "Use the all-shops price at [Second site]", which
does not contain the visible words (label in name); say "Same as all shops at
[Second site]". "+ Different at another shop" is still offered when only one other
shop exists and [Second site] already has its line; hide it until a third shop
exists. "Price" is a bold `<span>`, not a group label, over the rows. The product
sub-title reads "B05S-RX · price".
*Fix:* as written; make "Price" a `role="group"` label; sub-title "B05S-RX".

**L3 — `ms-today-all`, `ms-switch-open`: Needs attention carries the shop in small
muted text.**
The shop tag is 12px/700 in muted grey in front of the line. It is correct but when
more shops exist it is the only thing separating a Bolton line from a [Second site]
line.
*Fix:* ink colour, same weight as the line's first words, or group by shop with a
small heading. Keep it one list as decision 6 says.

**L4 — `ms-tills`, `ms-today-new`, `ms-sites`, `ms-add-shop`: Jack Lewis is the Owner
on some boards and the Manager on others, and the tills sidebar is shifted.**
`ms-sites`, `ms-add-shop` and `ms-today-new` say "Jack Lewis, Owner"; the others say
"Manager". On `ms-tills` the user's name is on one line and the nav is 6-8px higher
than on every other board.
*Fix:* Owner on all journey 19 boards unless the board is showing a manager's view on
purpose (then say so in its title); re-render `ms-tills` with the standard sidebar.

**L5 — `ms-product-price`, `ms-sites`, `ms-tills`: reused boards disagree with the new ones.**
The product page says "[Site 2]" (and "[Site 3]" in the send dialog) where journey 19
says "[Second site]". The Sites fold summary says "Bolton" with two shops listed. The
Tills summary mixes codes and names (M10).
*Fix:* "[Second site]" on the stock boards when journey 19 is stitched in; summary
"Bolton, [Second site]".

**L6 — `ms-sites`, `ms-add-shop`: opening hours live in two places, and "Copy Bolton's
hours" names Bolton for ever.**
The page has "Opening hours · Bolton" (the chosen shop's) and each site card has hours
and "Edit". With "All shops" chosen it is not shown which shop's hours that fold means.
The copy button names Bolton, which is wrong once the owner adds a third shop from
somewhere else.
*Fix:* hours in one place per shop (the site's own Edit); drop the separate fold or
rename it "Opening hours · [chosen shop]" and, for "All shops", "Choose a shop". The
button reads "Copy hours from [shop]" with a pick when there are more than two.

**L7 — `ms-services-differs`: "Differs by shop" does not say what differs.**
It can be the price or whether the service is offered. *Fix:* "Price differs" or
"Not offered at [Second site]".

---

## Answers to the specific questions

- **Decision 1, the chosen shop and "All shops":** the switcher and Today rows are
  as decided. Gaps: who gets "All shops" (H1), the till (H2), semantics and focus
  (H4), nothing confirms a switch (M3), staff, one-shop and manager views (M4).
- **Decision 2, one business, price or service by shop:** the shared and
  per-shop split reads clearly on `ms-sites` ("Customers, products, staff and
  messages are shared by every shop"). Gap: the not-offered state (M6).
- **Decision 3, set on the item:** "Different at a shop?" and "Same as all shops" are
  as decided. Gaps: price in the list (M5), controls (L2), the tag (L7).
- **Decision 4, Works at:** the pills and days are as decided. Gaps: the day rule
  (H5), real pop-up (M7), who sees what (H1).
- **Decision 5, "Which shop?":** the radio group and step order are as decided.
  Gaps: pre-choice reason, tick and click (M8), changing later (M9).
- **Decision 6, Today with "All shops":** a row per shop and one list, as decided.
  Gaps: nested links (H3), alignment (L1), shop tag (L3), Bolton's Today says
  "Nothing needs you right now" while this board lists WH-1050 for Bolton (M13).
- **Decision 7, add a shop and the checklist:** the form and checklist are as decided.
  Gaps: code (M1), hours and cost line (M2), checklist wording (M11), the landing
  message (M3).
- **Decision 8, every till:** grouped by shop with last sent and waiting. Gaps:
  hierarchy and summary (M10), the owner's way in.
- **Keyboard and screen reader:** H3, H4, M6, M11. Good: dialogs have role, label and
  Close; the booking step is a labelled radiogroup; the day pills are labelled
  groups; form fields have `<label for>`; `ms-today-new` is a labelled list.
- **Touch targets:** every control on the boards is 44px or more (menu rows 52px,
  price fields and pills 44px, shop rows 64px). The text links "Edit", "Change" and
  "Same as all shops" are 44px high but narrow.
- **Wording:** M12, M11, M6, L2, L7. Plain English is kept elsewhere.
- **Data across boards:** Bolton's Today on `ms-switch-open` (same date, Thursday 17
  September) says "Nothing needs you right now", while `ms-today-all` lists "Bolton ·
  WH-1050 · Aisha Khan, ready since Mon 14 Sep" as a Bolton line. The numbers (8 bikes,
  4 ready, All sales sent) agree. One of the two is wrong (M13).
- **Fewest clicks:** switching from a shop row (one tap), "Same as all shops"
  (one tap), a card straight to the booking (M8, would save one), the checklist
  buttons going to where the task is. Costs to cut: Next on the shop step, the stock
  step's second path.

---

## Summary of what to decide

1. Who sees "All shops" when someone works at one shop (H1, options 1-3).
2. What the till does when the chosen shop is not the till's shop (H2, options 1-3).
3. How the two targets on a shop row are split (H3, options 1-2).
4. How a day taken at another shop behaves (H5, options 1-2).
5. How much of the staff, one-shop and manager views to draw (M4, options 1-2).
6. How the price is shown in lists when it differs (M5, options 1-2).
7. Whether choosing a shop in booking goes straight on (M8, options 1-2).
8. The word "site" or "shop" in Settings and the switcher (M12, options 1-3).
9. How Bolton's Today and the All shops Today are brought into agreement (M13,
   options 1-2).

Nothing here changes a decision. The rest (missing states in M1, M3, M6, M9, the
wording, markup and Lows) need only a yes from Jack. No file other than this one was
edited.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | switch-open, today-all, person | Decisions 1 and 4 disagree on who sees "All shops" | Yes (option 1-3) |
| H2 | switch-open, pick-shop | Till has no rule when the chosen shop is not its own | Yes (option 1-3) |
| H3 | today-all | A link inside a link; the shop link's name says nothing | Yes (option 1-2) |
| H4 | switch-open, every sidebar | Switcher name, open state, menu content and focus not specified | Yes (option 1-2) |
| H5 | person | The one-shop-a-day rule cannot be done on the board | Yes (option 1-2) |
| M1 | add-shop | No code suggestion, duplicate error or required marks | Yes |
| M2 | add-shop | Opening hours show nothing; no cost line | Yes (option 1-2) |
| M3 | switch-open, pick-shop, today-new | Nothing confirms a switch | Yes |
| M4 | switch-open, sites | Staff, one-shop and manager views not drawn | Yes (option 1-2) |
| M5 | services-differs, service-price, product-price | List shows the all-shops price only | Yes (option 1-2) |
| M6 | service-price | "Offered at" has no group, no off state | Yes |
| M7 | person | Works at drawn in a different pop-up from the real person page | Yes |
| M8 | book-shop | Pre-chosen shop with no reason; extra click; no tick | Yes (option 1-2) |
| M9 | book-shop-chosen, book-shop | Changing shop has no consequence; shop missing from summary and footer | Yes |
| M10 | tills | Shop names weaker than rows; summary; no add-till | Yes |
| M11 | today-new | Vague buttons, one stock path, no status words | Yes |
| M12 | switch-open, sites, tills | "Site" and "shop" mixed | Yes (option 1-3) |
| M13 | switch-open, today-all | Bolton's Today and All shops disagree | Yes (option 1-2) |
| L1 | today-all | Columns do not line up; labels repeat | Yes |
| L2 | service-price, product-price | Price control names, extra "Different" link, sub-title | Yes |
| L3 | today-all, switch-open | Shop tag is small and muted | Yes |
| L4 | tills, today-new, sites, add-shop | Owner or Manager for Jack; tills sidebar shifted | Yes |
| L5 | product-price, sites, tills | "[Site 2]", "Bolton" summary | Yes |
| L6 | sites, add-shop | Hours in two places; "Copy Bolton's hours" | Yes |
| L7 | services-differs | "Differs by shop" does not say what | Yes |

## Verification (1 Oct 2026)

Checked by reading: all 13 renders; `sites.mjs`; `setup.mjs` lines 193-232
(`workingDays`, `set-staff-person`); `stock.mjs` lines 148-223 (`[Site 2]`);
`signin.mjs` line 56; the rendered HTML of `ms-switch-open` (trigger, headings),
`ms-today-all` (`<a>`, `role="link"`, `role="list"`), `ms-service-price` (labels,
`aria-pressed`, dialog), `ms-person` (groups, `aria-pressed`), `ms-add-shop` (labels,
inputs, dialog), `ms-book-shop` (radiogroup, headings), `ms-today-new` (list, labels)
and `ms-tills` (headings), found by search. Not checked: tablet and phone; keyboard
order and focus (nothing run in a browser); a screen reader; contrast beyond the
shared tokens (`#6E6752` on `#FFFDF7` about 5.5:1 and on `#F0EADC` about 4.7:1, as
already worked out for journey 7); placeholder contrast in the Add a shop fields;
`docs/decisions/2026-10-01-book-a-repair-review.md` (not opened). The column
positions in L1 are read off the screenshot, not measured in a browser. Numbers in
the "Verdict" (row heights) come from the generator's inline styles.

Re-checked in the main session (1 Oct 2026) against the built files: H3 — the
shop rows on `ms-today-all` hold a `role="link"` span inside the row's link;
H4 — the trigger is named "Switch site"; M13 — `ms-switch-open` (Bolton's Today)
says "Nothing needs you right now" while `ms-today-all` lists WH-1050 under
Bolton. All confirmed.
