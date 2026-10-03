# Journey 14 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 23 desktop renders of the
Stock take and stock control boards (1280 x 800: `st-list`,
`st-search-measure`, `st-filter-bearings`, `st-categories`,
`st-category-edit`, `st-product`, `st-product-bike`, `st-product-sizes`,
`st-list-ticked`, `st-prices`, `st-adjust`, `st-today-adjust`,
`st-setting-adjust`, `st-today-below`, `tk-start-below`, `tr-sites`,
`tr-send`, `tr-incoming`, `tk-hub`, `tk-start`, `tk-count`, `tk-diff`,
`tk-applied`), against `docs/decisions/2026-10-01-stock-control-review.md`
(decisions 1-10), `generator/stock.mjs` (`searchBox`, `filters`, `pillBtn`,
`row`, `head`, `COLS`, `tickBox`, `listBoard`, `detailFilter`,
`bearingsBoard`, `summary`, `box`, `kv`, `linkBtn`, `link`, `histRow`,
`history`, `PADS_HIST`, `frameRow`, `bikeBoard`, `GRID`, `cell`, `sizeGrid`,
`sizesBoard`, `takeHub`, `startPopup`, `AREAS_`, `qty`, `countBoard`,
`diffRow`, `diffBoard`, `appliedBoard`, `adjustPopup`, `adjustSetting`,
`tickedBoard`, `pricesPopup`, `pRow`, `sitesBoard`, `sendPopup`,
`incomingBoard`, `catRow`, `categoriesOpen`, `detailEditRow`,
`categoryEdit`), `generator/settings-frame.mjs` (`settingsPage`, `fold`,
`stockFolds`, `STOCK_INTRO`, `SETTINGS_ROOMS`, `popup`), `generator/opening.mjs`
(`today()` with `adjusted` and `below`), `generator/ui.mjs` (`C`, `SAND`,
`button`, `icon`), journey 13's `generator/receiving.mjs` and
`receiving-ui-audit.md` as the sister journey, and the rules for every
journey in `HANDOVER-next-journey.md`. Tablet and phone are not drawn yet, so
nothing here covers them.

**Scope.** `st-today-adjust` and `st-today-below` reuse journey 10's approved
Today: only the new line in Needs attention is audited. `st-setting-adjust`
and `st-categories` use the shared four-room Settings frame (approved): only
the Stockroom sections are audited. `tr-incoming` is journey 13's Deliveries
and orders page with one new card: only that card is audited.

**Not raised, on purpose.** The [bracketed] placeholders. The unselected-pill
border contrast (parked as a design-wide fix; the − / + box and the filter
boxes use the same thin border, so they are covered by it). 12-13px text that
is only a label or a second line. A pop-up's ✕ being a link, and Today and
Reports sharing one icon. "Clipped" reports from the scroll areas in the
renderer. None of Jack's 10 decisions is reopened: a searchable list with
filters, a summary-and-history product page, one product with a size grid,
blind counting a section at a time, anyone adjusting with a reason, bulk price
changes with a preview, send-then-receive between shops, below-zero products
on Today, and each category's own details. The warranty words on the bike page
stand on Customer service decision 4, as journey 13's audit settled.

**Verdict.** The look is right and the basics hold. Soft sand throughout,
amber only for the "you are here" marker and real warnings, one dark main
button per board, every pop-up with the safe choice on the left and the
confirming action on the right, every button, pill, stepper button and filter
box 44px tall. Status is in words almost everywhere (Running low, Below zero,
2 under, 1 over, Counting, Ready to check, In stock, Sold, On its way, "−1,
below zero" read out for a size). Most of what journey 13's audit found is
fixed here: the `qty()` number is a real typed field, the stock list's column
names are read out (`head()` is hidden but every cell carries a hidden name),
the tick box is a 44px label, actions that do something are buttons
(`linkBtn()`), scans are announced (`role="status"`), the Settings folds are
headings. Contrast, worked out by hand from `ui.mjs`: grey text 5.5:1 on cards
and 4.9:1 on the page, grey text on its grey tag 4.7:1, amber text on a card
6.3:1 and on its amber tag 5.3:1, green text on its tag 6.5:1, white on the
dark buttons 14.7:1, dark text on cards 14.5:1. The problems are in what the
boards leave out, and in three places where a decision is only half drawn. A
blind count never says what happens to a product nobody scanned. Adjust stock
cannot take "the new count", though decision 6 says it can. Ticking products
has no start and no tick-all, and the ticked bar has no Send to another shop,
though decisions 7 and 8 need both. And the Add a detail box cannot make
Jack's own example (a number in mm), because it has no place for the unit.
Findings are ranked; where a fix is a real choice the options are numbered.

Checked against the source, not just the pictures: `row()` draws the whole
row as `<a href="#" role="listitem">`, and the ticked version as a `<div>`
with only the name as a link; `head()` has an empty `<span></span>` in the
tick column and nothing else, and `tickedBoard()`'s bar holds Untick all,
Print labels and Change prices only; the plain `st-list` draws no tick boxes
at all (`COLS()` adds the column only when `TICKS` is on); `adjustPopup()`
draws a Change stepper and "In stock now [n] · after [n]" as text, with the
Damaged pill chosen (`REASONS.map(... i === 0)`) and the note field always
"(optional)"; `detailEditRow()` draws the kind and the choices as a plain
`<span>`, and the Add a detail box in `categoryEdit()` has a name, the three
kind pills and a button, no unit and no choices field; `GRID` puts its −1 in
row 2 (`[Colour 2]`), column 2 (M), while `diffBoard()`, `startPopup(true)`
and `sizesBoard()`'s history all say size M · `[Colour 1]`; `diffBoard()`'s
summary is "[n] products counted · [n] match · [n] differ" with no group for
products nobody scanned (searched the whole generator folder for "not counted",
"uncounted" and "unscanned": no match); `takeHub()`, `tk-count` and `tk-diff`
have no back link (`takePage()`, unlike `back` on the product page);
`productPage()` is called with the title "Product"; `STOCK_INTRO` is still
"Deliveries and what suppliers charge for them." and the `SETTINGS_ROOMS`
Stockroom line is still "Supplier invoices"; `diffRow()` draws Recount with
`link()`; `incomingBoard()` draws "Receive it" without a row name; `today()`'s
`below` and `adjusted` lines hold plain text and one button each; `histRow()`
takes one `who` and its first argument is plain text; the `kind === 'part'`
test is the only thing that shows the Details box.

---

## High

**H1 — `tk-count`, `tk-diff`, `tk-start`, `tk-start-below`: nothing says what
happens to a product nobody scanned.**
The count is blind and by scanning (decision 5). On `tk-diff` the summary is
"[n] products counted · [n] match · [n] differ", and only products that were
scanned can be in it. A shelf nobody reached, or a product that really has run
out, is either missing from the list or counts as zero, and the page does not
say which. It matters most for "A category" and "Whole shop". For "An area"
there is a second gap: `startPopup()` takes the area as typed text, and
nothing ties a product to "Wall 3", so Wheelhouse cannot know what should have
been scanned there. The below-zero count (`tk-start-below`) has no list for
the counters to work from either: `countBoard()` shows only what has been
scanned, so nobody is told which products to go and find.
*Why it matters:* a count that wipes stock to zero because someone missed a
shelf is worse than no count. This is the one place in the journey where a
mistake costs real money, and the money line on `tk-diff` ("£[value] under in
all") would be wrong.
*Options:*
1. On Check the count, add a group "Not counted · [n] products · expected [n]
   in all", closed by default, with "Leave them as they are" (the default,
   nothing changes) and one button "Count them as none". For an area count say
   "Only what was scanned is compared". For the below-zero count, show the
   counters a "Still to find" list of product names without numbers, so it
   stays blind. One extra press only when the manager really means zero.
2. Treat everything not scanned as zero. Fewest presses, but one missed shelf
   sets stock to zero and the "under" figure is then wrong.
3. Leave it undrawn and decide at build.
Recommend 1.

**H2 — `st-adjust`: Adjust stock cannot take "the new count", although
decision 6 says it can.**
Decision 6: "takes the change (or the new count)". `adjustPopup()` draws only
a − / + box holding "−1", with "In stock now [n] · after [n]" as plain text.
The commonest real case is "I looked, there are 7": today that is work out the
difference, then type it as a negative number. (From memory, not checked here:
the numeric keypad on an iPad or phone often has no minus key. The box is
`inputmode="numeric"`.)
*Why it matters:* Jack's fewest-clicks rule, and it is a decision only half
drawn.
*Options:*
1. Make "after [n]" a box you can type in, joined to Change: type 7 and the
   change shows −3; − and + still move both. One pair of boxes, no switch,
   and the new count never needs a minus sign.
2. A pill pair "Change by / New count" at the top. Clearer labels; one more
   press every time, and two modes to learn.
Recommend 1.

**H3 — `st-list`, `st-list-ticked`: ticking has no start and no "tick all", and
the ticked bar has no Send to another shop.**
Decision 7: "tick products (or search or filter, then tick all)". `st-list`
has no tick boxes (`COLS()` adds the column only when `TICKS` is on), so the
page that decision 7 starts from shows no way in. `head()` draws an empty
`<span></span>` where a tick-all box belongs. Decision 8 says send to another
shop works "on a product, or from ticked products", but `tickedBoard()`'s bar
has Untick all, Print labels and Change prices only; the only drawn way to
send several products is one at a time with "+ Add another product".
*Why it matters:* moving twenty products between shops, or re-pricing a
supplier's range, are the two jobs the tick boxes exist for.
*Options for how ticking starts:*
1. Tick boxes always in the first column, a tick-all box in the header ("Tick
   all [n] shown"). No extra press. The list is a little busier and the only
   click target on a row becomes the name (see M9).
2. Tick boxes appear on hover or keyboard focus, and stay once one is ticked
   (always on touch). Quiet at rest; the control is hidden until you reach it.
3. A "Select" button switches ticking on. One extra press every time.
Recommend 1. Also add "Send to another shop" to the bar as a third button, in
the same outline style. Print labels is not in any journey 14 decision (it
comes from journey 13's labels): keep it, with Jack's yes.

**H4 — `st-category-edit`: Jack's own examples cannot be built from the box.**
Decision 10's kinds of answer are "a number with a unit", "a choice from a
list" and text. In `categoryEdit()` the Add a detail box has a name, the three
kind pills and "Add this detail". With "A choice from a list" picked there is
nowhere to type the choices; with "A number with a unit" there is nowhere to
say mm. The existing row (`detailEditRow()`) shows "A choice from a list ·
[n], [n], [n]" as plain text, so a detail's choices and unit cannot be edited
afterwards either. Bearings (inner, outer, height in mm) is the example the
whole decision is built on.
*Why it matters:* the filter on `st-filter-bearings` and the "mm" next to each
box depend on the unit being set here.
*Options:*
1. After a kind is picked, the box shows the one field it needs: a unit box
   for a number, a choices box for a list (type one and press Enter to add
   it, each choice a small pill with a ✕). Existing rows edit the same way.
   No extra steps.
2. Add the detail first, then open a second step to give its unit or choices.
   More presses and a half-made detail in between.
Recommend 1.

---

## Medium

**M1 — `st-prices`: after "Change 3 prices" nothing is drawn, and a bulk price
change has no way back.**
The preview is good (`pricesPopup()`: old and new side by side, margin before
and after). But it is the biggest risk in the journey: a wrong percentage on
two hundred products goes to the till and the website "straight away" (the
pop-up's own note), and no board shows what happens next. Also no state is
drawn for "A new price" (one price for every ticked product?) or "A target
margin", and a new price under the cost is not flagged.
*Options:*
1. After Change, back on Stock with the ticks cleared and the note "Prices
   changed · 3 products · Undo" (the same note Settings uses). Undo puts every
   old price back; both changes stay in each history. No extra press.
2. A second "Are you sure?" step. The preview is already that step, so it adds
   a press for every price change.
Recommend 1. Also say "Below cost" in words, with the alert icon, on any
preview row whose new price is under its cost, and draw the other two methods
(or say that "A new price" is for one product).

**M2 — `tk-diff`, `tk-applied`: Apply the count is one press with no way back,
and does not say how much it will change.**
`diffBoard()` ends with a lone "Apply the count" that changes stock for every
differing product (decision 5: "records every change"). `appliedBoard()` has
"Download the count" and "Back to Stock take" and no Undo. The button does not
say how many products it changes, and the rows are not in an order that puts
the biggest money first.
*Options:*
1. Name the button "Apply to [n] products", and after it show "Count applied ·
   Undo" for a short while. Undo puts the old numbers back and writes that in
   each history. Matches the trust-over-lock-down stance.
2. A confirm pop-up ("[n] products will change, £[value] under"). One more
   press for every count.
3. Leave it.
Recommend 1. Sort the rows by value, largest first.

**M3 — `tk-diff`, `tk-count`: Recount, and two people counting the same product.**
Decision 5 lets a manager ask for a line to be recounted and lets several
staff join. Neither state is drawn. After Recount, `diffRow()` looks the same,
and `countBoard()` has no line saying "Recount: [Product]". And when Jo and
Alex both scan the same product (the hub row says both are counting), their
numbers are added together with no sign on the Counted column, so a double
count looks like a real surplus.
*Fix (a yes from Jack):* after Recount, the row's tag becomes "Recount asked"
(grey) and the counters see that product at the top of their list with the same
tag and its number cleared. Under a Counted number that came from two people,
show "Jo Taylor [n] + Alex Morgan [n]" in small grey text, so the manager can
spot a double count.

**M4 — `st-adjust`: a reason is pre-picked, some reasons make no sense with the
sign, and "Other" does not need its note.**
`adjustPopup()` opens with Damaged chosen and the change at −1. A person who
adds three found boxes and does not touch the reason records "Damaged +3", and
Today's line then says Damaged. The reason is the point of decision 6 ("with a
reason"); a reason that is already picked is not a choice. "Found" with a minus
and "Damaged" with a plus cannot be true. Decision 6 says "Other (with a note)",
but the note is always "(optional)".
*Options:*
1. No reason picked; the Adjust button stays off until one is. The list
   follows the sign: minus shows Damaged, Lost or stolen, Used in the
   workshop, Returned to supplier, Other; plus shows Found, Other. Other asks
   for its note. One press more than now; the record is honest; fewer pills to
   read each time.
2. Keep Damaged pre-picked. Fewest presses; wrong reasons will be recorded.
Recommend 1. The list of six reasons is Jack's and is unchanged.

**M5 — `st-list`, `st-product`, `tk-hub`: what Staff see and can do on Stock is
not drawn, and the page shows costs.**
Everything is drawn for Jack Lewis except the count board (Jo Taylor). The
stock list has a Margin column; the product page's Price box shows Cost,
Margin and VAT; the price preview and Check the count show margins and money
values. Journey 13 decided that Staff see a delivery without costs or the
invoice (receiving decision 10). Nothing says Staff may see cost here, and the
decisions do not say who can change prices, edit or add a product, send stock
to another shop, or start and apply a count. Decision 6 gives adjusting to
anyone, and decision 5 has a manager start and apply. Also Jo's Stock take page
is not drawn (Start a count hidden, "Join" instead of "Open").
*Question for Jack:*
1. Staff see products, price, stock and history, and can adjust, count and send
   stock. They do not see Cost, Margin or VAT, cost values anywhere, Change
   prices, Edit, Add a product or Categories. Consistent with journey 13.
2. Staff see everything, including cost, but cannot change prices.
3. As drawn, for managers only, and decide at build.
Recommend 1. Then draw Staff's stock list, product page and Stock take page.

**M6 — `st-product`, `st-product-bike`, `st-product-sizes`: the stock number is
third, the measurements are last, and bikes and sizes products have no Details.**
The left column in `productPage()` runs summary, Price (cost, margin, VAT), In
stock, Details. The question asked most is "how many do we have?", and it sits
below four lines of money. For a part, the measurements are what Jack wanted
staff to find ("bearing 30 mm"), and they are the last card. `Adjust stock`
is in the top card and `Send to another shop` in the In stock card, a long way
from the number they change. And `kind === 'part'` is the only thing that shows
Details, so a bike (frame size?) or a product with sizes never shows the
category's details, though decision 10 says every category has them.
*Options:*
1. Order the left column: summary, In stock (with Adjust stock and Send to
   another shop beside the number, and Running low or Below zero as a tag in
   words), Details, then Price and cost. Nothing new to learn.
2. Keep the order and add one line under the name: "In stock at Bolton: [n]".
   Smaller change; the measurements stay last.
Recommend 1. Either way show Details on bike and sizes pages when the category
has any. Staff would then not see the Price and cost box's cost lines (M5).

**M7 — `st-product*`, `tr-sites`: history rows go nowhere, and the history
leaves out what decisions 7 and 3 put in it.**
`histRow()` draws "Used on job WH-1042", "Sold ... sale B1-[0000]", "Received
... Delivery from [Supplier]" and "Counted ... Stock take" as plain text. The
person trying to find out why stock is wrong has to go and search for the job,
sale or delivery. Decision 7 says every price change is in the product's
history, but there is no "Price changed" row and no pill for it ("Everything,
Sold, Received, Counted and adjusted"). `appliedBoard()` promises "who counted
and who applied it", but `histRow()` takes one name: the Counted row shows
Jo Taylor only.
*Fix (a yes from Jack):* make the first line of each row a link to the thing it
names (job, sale, delivery, count, transfer; the row is already 56px tall).
Draw one "Price changed · £[old] → £[new]" row. Draw Counted as "counted by Jo
Taylor, applied by Jack Lewis".

**M8 — `st-today-adjust`, `st-today-below`, `tk-start-below`: the Today lines
do not take you to what they are about, and "Count them" is two presses.**
In `today()` the `adjusted` and `below` lines have a plain title and one
button. "Stock adjusted: [Product] −[n] · £[value]" has no link to the product
or its history; "[n] products below zero" has no link to the list, though the
Below zero filter exists (decision 9). "Count them" opens a pop-up whose one
answer is Start the count (`tk-start-below` is drawn over the Stock take page,
not over Today), so the manager leaves Today, presses Start, and then lands on
a count.
*Options for Count them:*
1. Keep the pop-up. It confirms how many and lets the manager change what to
   count. Two presses.
2. "Count them" starts the count at once and opens it, with a note "Staff can
   join from Stock take". One press. The manager ends up counting and might
   have wanted only to start it for staff.
Recommend 2, since the choice was made by pressing the button.
*Fix (a yes from Jack):* make the product name in the adjusted line a 44px link
to its page, and add "See them" beside Count them that opens Stock on Below
zero. Say "1 product" when it is one.

**M9 — `st-list`, `st-list-ticked`: a screen reader is not told the rows are
links, and in tick mode only the name opens the product, 21px tall.**
`row()` draws `<a href="#" role="listitem">`. A role replaces what the element
is, so it is announced as a list item, not a link. In tick mode it draws a
`<div>` and only the name is an `<a>`, about 21px tall (the row is 60px). The
chevron is still drawn at the right, which suggests the whole row opens.
*Fix:* a list item containing the link (`li > a`) for the plain list. In tick
mode make the name and the line under it one 44px-high link, and drop the
chevron.

**M10 — `st-list`: two search boxes on one page.**
The header's "Search jobs, customers, products" (A2: one search on every
staff page) and the page's own search sit 50px apart and both say products.
Typing "bearing 30 mm" into the wrong one gives a different kind of answer.
*Options:*
1. Keep both. Name the page box "Search stock" in its label, and make the
   header's product results understand measurements and codes the same way, so
   the answer for a product is the same wherever it is typed.
2. On Stock, the header search just moves the cursor to the page box. One box;
   jobs and customers cannot be searched from this page.
Recommend 1.

**M11 — `st-filter-bearings`, `st-list`: category pills will not scale, and
move when you pick one.**
`filters()` draws a pill per category. A bike shop has far more than three
categories, so the row becomes several lines and pushes the list down (rules
62 and 66: pills for short choices, a search box for long lists). Picking
Bearings inserts it second, so Running low and Below zero move under the
pointer. Sub-categories (Drivetrain › Derailleurs) are not drawn as a choice.
*Options:*
1. Keep All, Running low and Below zero fixed. Add one "Category" pill-sized
   search box that opens a short list as you type; the pick shows as a dark
   pill with a ✕ ("Drivetrain › Derailleurs"). One press for the usual
   categories after the first search.
2. One pill for every category, wrapping. Fine up to about eight.
Recommend 1.

**M12 — `st-search-measure`, `st-filter-bearings`: the measurements are in a
wrapping grey line, and only number details have a filter.**
The point of the journey is to find a part by its size, yet `ROWS_MEASURE`
puts "Inner [n] mm · Outer diameter 30 mm · height [n] mm" in the 13px second
line, which wraps and leaves "mm" alone on its own line in both boards. Once
Bearings is picked, the three sizes are the most useful columns. `detailFilter()`
draws a number box only; "Number of gears" (a choice) and any text detail have
no drawn filter.
*Options:*
1. When one category is picked, add its details as columns (Inner, Outer,
   Height) and drop the grey line, keeping it for All. Sortable columns come
   free. Costs width: Margin may need to drop to make room.
2. Keep the grey line, shorten it ("Inner [n] · Outer 30 · Height [n] mm") so it
   fits on one line.
Recommend 1. Draw one board for Derailleurs with number of gears as small
pills, and say which kind each filter is.

**M13 — `tr-sites`, `tr-send`, `tr-incoming`: a wrong send cannot be undone, the
sender cannot see what is on its way, and "flagged to both shops" is not drawn.**
Stock leaves at once (decision 8). Nothing shows the sending shop its own
transfers: `incomingBoard()` lists only what is coming in. There is no way to
take back a transfer sent to the wrong shop or with the wrong number. The
receiving page behind "Receive it" is not drawn, and neither is the flag when
something does not arrive (the decision says both shops are told; Today does
not change).
*Options for a wrong send:*
1. "Cancel this send" on the sender's row while it is on its way; the stock
   comes back and both histories say so. Needs a second list "On its way to
   other shops" with the same row and a tag instead of Receive.
2. No cancel: the other shop sends it back. Simpler; more work for the mistake.
Recommend 1. Draw also the receive page for a transfer and a Today line at
both shops ("Transfer T-[0000] arrived [n] short"). "Receive it" is a button
with no row name (as journey 13's M7): name it "Receive transfer from [Site 2]".

**M14 — `st-product-sizes`, `tk-diff`, `tk-start-below`: the size below zero is
Colour 2 on one board and Colour 1 on three.**
`GRID` has its −1 under `[Colour 2]`, size M. `diffBoard()` says "Size M ·
[Colour 1] · was below zero" with Expected −1; `startPopup(true)` says "including
[Product with sizes], size M · [Colour 1]"; the history on the sizes page says
the last sale was "Size M · [Colour 1]". One thing, two colours.
*Fix:* move the −1 in `GRID` to Colour 1, size M (and keep the 0 for L in
Colour 2). A yes from Jack is enough.

**M15 — `st-category-edit`: removing a detail, and the "Inside" drop-down.**
The ✕ on a detail row (`detailEditRow()`) is 44px and labelled, but nothing says
what happens to the values already filled in on products. Removing "Number of
gears" could blank it on every derailleur. Separately, "Inside" is a native
`<select>` (rules 62 and 66 ask for pills for short lists and a search box for
long ones), and "[Detail] — change it on Drivetrain" is plain text where a
link would take you there in one press.
*Options for removing:*
1. The row turns into "Removed · Undo" in the list, and Save says "[n] products
   lose Number of gears". Nothing is lost until Save.
2. A confirm pop-up first. One more press each time.
Recommend 1. Make "Inside" a search box (as in M11), label it "Sits inside",
and turn "change it on Drivetrain" into a button.

**M16 — `tk-start`: the category choice is not drawn, and an area is free text.**
With "A category" picked nothing is drawn for the choice (categories are a long
list, so a search box, as M11). "Which area" is a text box holding "[Area]";
"Wall 3", "wall 3" and "Wall three" would be three areas. (No product belongs
to an area in this design, which H1 explains.)
*Options for areas:*
1. Suggest areas already used as you type, as journey 13's decision 10 does
   for measurement names. No set-up.
2. A list of areas in Settings › Stockroom. Most consistent; needs set-up
   before the first count.
Recommend 1.

---

## Low

**L1 — `st-list`: states that are not drawn.**
No results (offer "+ Add [what was typed] as a product"); an unknown barcode
scanned on the list ("Not in Wheelhouse yet" with Add it, as in journey 13);
searching "jersey M" and opening that size and colour (decision 4); a brand-new
shop with no products; the list of a product that is running low or below zero
on its own page (the list shows the tag, `summary()` shows only the number).

**L2 — wording.**
- `pricesPopup()`: "Round to .99" is a rule for people who know
  the trade. "Prices end in: .99 / .00 / Leave as they are" says it plainly.
- `ROWS_MEASURE`: "Inner [n] mm · Outer diameter 30 mm · height [n] mm" mixes
  "Inner", "Outer diameter" and "height". The category says Inner diameter,
  Outer diameter, Height.
- `listBoard()`'s summary says "2 bearings with an outer diameter of 30 mm"
  for the search "bearing 30 mm". The search matches 30 in any size; the bold
  one on each row is what matched. Say "2 bearings with 30 mm".
- `tag('Ready to check')` is green with a tick, which reads as already checked.
  It is a job for the manager; no tick, or the grey tag.
- `diffRow()`: Recount does something (sends a line back) and is a link. Make it
  a button, as journey 13's M7 settled.
- "Stock take", "Count stock", "Start a count", "Counting": one name for one
  thing. Suggest "Stock take" for the room and the page, "Start a count" for the
  button.
- `STOCK_INTRO` still says "Deliveries and what suppliers charge for them."; the
  phone list line in `SETTINGS_ROOMS` still says "Supplier invoices". Stockroom
  now also holds Stock adjustments and Categories.
- `today()`'s "[n] products below zero" needs "1 product" for one.

**L3 — headings and way-back gaps.**
`productPage()` is titled "Product", so the page's h1 is not the product; the
name is an h2 in the card. `tk-count`, `tk-diff` have the same title twice
(page h1 and card h2, as journey 13's L2) and no back link, while `tk-applied`
has "Back to Stock take". `catRow()` shows Derailleurs indented with a
decorative arrow, so a screen reader does not hear that it sits inside
Drivetrain: add a hidden "Inside Drivetrain".

**L4 — placeholder colour in two places.**
`searchBox()` sets the placeholder to the grey text colour (5.5:1). The "Any"
in `detailFilter()` and the "Name, like “Mount”" input in `categoryEdit()` do not,
so they take the browser's grey (about 4.5:1 at best, from memory, not
measured). Set both.

**L5 — one-of-several choices are toggle buttons (design-wide).**
Reason, Round to, How, Kind of answer, To, What to count and the category
pills are "pick one" groups drawn with `aria-pressed` buttons (`pillBtn()`), so
a screen reader announces each as an on/off switch. They should be radio groups
(arrow keys move between them). For the `frontend` agent; look unchanged.

**L6 — real product, concrete numbers.**
Names, prices and ids are all from the allowed list, and the bike page agrees
with itself (Received +3, three frame numbers listed, one Sold, two In stock;
3 ticked, 3 products, "Change 3 prices"; 2 bearings, 2 rows; 4 sizes, 4
columns). But some figures are real-looking facts about a real product, not
placeholders: Shimano brake pads "2 under", "1 sold during the count", "−1"
adjusted, "−1" sold and "−1" used on job WH-1042. Journey 13's audit flagged the
same kind of thing (a "low" tag on the pads). Harmless as a demonstration:
either say so, or use `[n]` there and keep the real figures for the structure
(3 frames, 3 ticked). The Trek Domane AL 3 is both Maya Patel's bike in for a
service (history of the pads) and a bike the shop sells; a reader could take
them to be the same bike.

**L7 — small faults.**
`summary()`'s Price card is titled Price and its first row is Price. Name the
card "Price and cost". The stock list has no sorting (name, stock, margin): a
shop with a thousand products will want it, and the column headings are the
place. `adjustPopup()` says Bolton and has no way to pick another shop's stock
to adjust. `tag()` is a copy of journey 13's (same colours, same icons): worth
exporting one from a shared module so they do not drift.

---

## Answers to the specific questions

- **Status by words, not only colour:** yes on every board: Running low, Below
  zero (with its icon), 2 under, 1 over, Counting, Ready to check, In stock,
  Sold, On its way, the size grid ("−1" with its icon and "below zero" in its
  label), "was below zero". The amber icons are decoration beside words.
  Gaps: a product's own page does not show Running low or Below zero (L1, M6),
  and the states not drawn (H1, M3, M13).
- **44px targets:** buttons, pills, stepper buttons and boxes, search, filter
  boxes (the label is the target), tick boxes (a 44px label), the ✕ on a detail,
  Edit, Open, Check it and Recount (`link()` and `linkBtn()` are 44), the size
  cells (52) all pass. Not passing: the product name link in tick mode (about
  21px, M9) and the inline "[Customer]" link in a bike's Sold row (an in-text
  link, about 20px).
- **Contrast:** everything drawn passes 4.5:1 (4.7 to 14.7:1). The only
  unknowns are two input placeholders the source does not colour (L4).
- **Fewest clicks:** where the journey is good: one search box that takes a
  barcode or a measurement, a whole row that opens, Adjust stock one press from
  the page, a tick bar that prices and prints in one place, a typed count in the
  stepper, one pop-up for send. Where presses can go: typing a new count (H2),
  tick all (H3), unit and choices in the same box (H4), Undo not confirm on
  prices and on Apply (M1, M2), Count them in one press (M8), a reason not
  pre-picked but fewer to read (M4), linking history and Today lines to what
  they name (M7, M8). Worth asking Jack: a hover "Adjust" on a list row would
  save opening the product for a quick fix.
- **Accessibility:** pop-ups are `role="dialog"` with `aria-modal` and a labelled
  title; sections are headings; the size grid and the price preview are real
  tables with captions and row headers; the count message is `role="status"`;
  the tick box has the product's name; the list's columns are named for a
  screen reader. To fix: the row's role (M9), the toggle-versus-radio groups
  (L5), the h1 on the product page and the missing back links (L3), the nested
  category (L3), placeholder colour (L4).
- **Consistency with journey 13:** the typed stepper, the buttons-versus-links
  rule, the tags, the headings in Settings and "Seen" on Today are the same.
  Differences: Recount is still a link (L2), "Receive it" has no row name
  (M13), sub-pages have no back link (L3), the Stock list's search and the
  header's search overlap (M10), Print labels on the ticked bar comes from
  journey 13 and is not in a journey 14 decision (H3).
- **Between boards:** the below-zero size is Colour 2 on one and Colour 1 on
  three (M14); the measurement words differ between the list and the categories
  (L2); the page title is "Product" while the card says the name (L3);
  Stock take, Count and Counting for one thing (L2).
- **Example data:** the real data used is Shimano brake pads B05S-RX £28.00, the
  Trek Domane AL 3, Maya Patel with WH-1042, Jack Lewis (Manager), Jo Taylor
  (Staff), Alex Morgan (Mechanic), Bolton, Till B1, and Jack's own examples
  (bearings with inner diameter, outer diameter and height; derailleurs with
  number of gears; "bearing 30 mm"). The decision file adds "Wall 3" and
  "Drivetrain" as examples; both are used as given. Everything else is a
  bracketed placeholder. Nothing is invented in the labels. See L6 for the
  concrete numbers on a real product and the Trek double use. The history
  lines agree with the lists, except the size colour (M14). One check that
  cannot be done from the boards: the history rows say "Used on job WH-1042" by
  Alex Morgan while Today (17 Sep) has WH-1042 still to arrive; the dates are
  placeholders, so no contradiction is drawn.
- **What Staff would see:** as drawn, costs and margins are on the stock list
  (Margin column) and the product page (Cost, Margin, VAT), and the price preview
  and count differences show money. Journey 13 decided Staff see no cost prices
  on a delivery. Nothing in journey 14 says the same: question for Jack (M5).

---

## Summary of what to decide

1. Products nobody scanned in a count: a "Not counted" group left alone unless
   the manager says "Count them as none", or treat as zero, or leave it (H1,
   options 1-3).
2. Adjust stock with a new count: type into "after", or a Change by / New count
   pill pair (H2, options 1-2).
3. How ticking starts: tick boxes always, on hover, or a Select button; plus
   Send to another shop on the ticked bar, and whether Print labels stays (H3,
   options 1-3).
4. Unit and choices in the Add a detail box: shown after the kind is picked, or
   a second step (H4, options 1-2).
5. After a bulk price change: Undo note, or a second confirm (M1, options 1-2).
6. Apply the count: "Apply to [n] products" with Undo, or a confirm pop-up
   (M2, options 1-3).
7. Adjust reasons: none pre-picked and shown by plus or minus, or keep Damaged
   pre-picked (M4, options 1-2).
8. What Staff see and can do on Stock, including costs (M5, options 1-3).
9. The product page's order: In stock first, or a stock line only (M6, options
   1-2).
10. Count them on Today: start at once, or keep the pop-up (M8, options 1-2).
11. The two search boxes on Stock (M10, options 1-2).
12. Category choice on Stock: a search pill, or one pill each (M11, options
    1-2).
13. Measurements on the list: columns when one category is picked, or a shorter
    line (M12, options 1-2).
14. A wrong send between shops: cancel while on its way, or send it back (M13,
    options 1-2).
15. Removing a detail: Removed with Undo and a count at Save, or a confirm
    (M15, options 1-2).
16. Areas in a count: suggest ones already used, or a list in Settings (M16,
    options 1-2).

Nothing here changes a decision. These need only a yes from Jack: the Recount
and two-counters states (M3), history links, price rows and the Counted
wording (M7), the Today links and "See them" (M8), the row and tick-mode link
fix (M9), the colour swap in the size grid (M14), the transfer receive page and
flags (M13), the link-and-button fixes, wording, headings and placeholder
colours in Low. No file other than this one was edited.

---

## Verification and outcome (1 Oct 2026)

Checked against the source before going to Jack: `adjustPopup()` took only a
change (H2); the ticked bar had no Send to another shop and the list no tick
boxes until ticking was on (H3); `categoryEdit()`'s Add a detail had no unit
or choices field (H4); `GRID` had the size below zero under Colour 2 while
three boards said Colour 1 (M14). Jack took every recommendation (decision 11
in the stock-control review). Knock-ons: the Stockroom description and the
phone Settings list's Stockroom line now name adjustments and categories
(journey 13's Stockroom boards and Owner setup's phone list, and their
big-canvas copies, republished after checking the live copies matched the
last build); Today gains "See them", a product link on the adjustment line,
and a short-transfer line (journeys 10, 5 and 13 rebuilt unchanged). Not
done as drawn changes: the header search understanding measurements (a
behaviour, no visible change); one shared `tag()` for journeys 13 and 14
(code tidy-up, parked); radio-button semantics outside journey 14 (the
design-wide part of L5, parked).
