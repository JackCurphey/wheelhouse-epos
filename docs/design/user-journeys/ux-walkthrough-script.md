# UX walk-through script

For Jack and Mark, to walk Wheelhouse's stories by hand. A UI audit checks one screen at a time. A walk-through follows one person's whole story across several journeys and looks for what breaks where one journey hands over to the next. The first one done this way is `ux-walkthrough-1-repair.md`; use it as the example of a finished report.

## The seven stories

| # | Story | Journeys, in order | People to walk it as |
|---|---|---|---|
| 1 | A repair, start to finish | 1 Find the shop, 3 Book a repair, 4 Drop off and approve the quote, 12 Workshop day, 5 Collect and pay, 7 Account and reminders | Maya Patel (customer, phone and computer), Jo Taylor (front desk), Alex Morgan (mechanic, tablet), Jack Lewis (owner) — **done 2 Oct 2026** |
| 2 | A shop day | 10 Opening the shop, 11 Selling at the till, 2 Buy online / click and collect, 16 End-of-day cash-up | Jo Taylor at the till, Maya collecting an online order, Jack Lewis cashing up — **done 2 Oct 2026** |
| 3 | Stock | 13 Receiving stock, 11 Selling at the till, 14 Stock take, 17 Reports | Jo Taylor receiving and selling, Jack Lewis ordering and reading reports; follow the Shimano brake pads B05S-RX that WH-1042 waits for — **done 2 Oct 2026** |
| 4 | A new shop | 9 Moving from Citrus Lime, 8 Owner setup, B Signing in, 18 Website management | Jack Lewis (owner) setting up; Jo Taylor signing in for the first time — **done 2 Oct 2026** |
| 5 | A Cycle to Work bike | 6 Cycle to Work, 11 Selling at the till, 17 Reports | Maya (customer), Jo Taylor, Jack Lewis — **done 2 Oct 2026** |
| 6 | A repair at a Lightspeed shop | 21 Lightspeed shops (with the customer pages of 3, 4 and 5 it uses) | Maya, Jo Taylor, Alex Morgan, Jack Lewis — **done 2 Oct 2026** |
| 7 | An owner with two shops | 19 Multiple sites, 20 Management oversight, 17 Reports | Jack Lewis, and staff at Bolton and [Second site] — **done 2 Oct 2026** |

In every story, also walk it as: **someone using a screen reader**, **someone using only a keyboard**, and **someone with low vision** (large text or zoom).

## Before you start

1. Read the story's decision files in `docs/decisions/` (one per journey, named after it). They say what has already been decided. Don't reopen those; note when a problem touches one.
2. Open the canvases: customers and the website on https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh, the staff app's shop floor (workshop, till, opening, cash-up, customers, Lightspeed) on https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j and its back office (setup, moving over, stock, reports, website, multiple shops, oversight) on https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4. Each journey's board links to its own canvas for tablet and phone.
3. Write down the story in five or six lines: who does what, in what order. Use the example data the drawings use (Maya Patel, WH-1042, £111.00 and so on). Don't make up new facts; a bracketed value like `[time]` is unknown, not wrong.
4. Pick the size each person really uses: Maya on a phone (a computer for her account), Jo on a desktop, Alex on a tablet.

## How to walk it

For each step of the story:

1. **Find the screen the person would actually be on.** Write down its title and size, and its id if you know it (the short name the reports use, like `bk-details`; the ids are listed journey by journey in `generator/journeys.mjs`).
2. **Be that person.** What do they know right now? What were they told on the last screen, or in the last text or email?
3. **Ask the seven questions below.** Write down anything that fails, straight away, with the screen id.
4. **Count the clicks** to get to the next step. Keep a running total for each person.
5. **Move on to the screen they'd see next** — which may be in the next journey, on someone else's device (Maya's text arrives on her phone because Jo pressed a button).

Then walk the **edge cases at the joins**: what if they say no, don't turn up, pay early, pay a deposit, change their mind, or the internet drops?

## The seven questions at every step

1. **What next?** Does this person know what to do? Is there one obvious next step?
2. **Promises kept.** Does what they were told earlier still hold here? Check prices, times, dates, names, what a message or link said would happen, and what was said about paying and deposits.
3. **Same thing, same name.** Is the job, bike, price, status or person called the same thing on every screen, for staff and for the customer? Keep a little word list as you go.
4. **Nothing twice, nothing missing.** Are they asked for anything they already gave? Is there a step with no screen, so the story can't carry on?
5. **Fewest clicks.** How many taps or clicks did this step take? Could it be fewer?
6. **Accessible.** Could a screen-reader user, a keyboard-only user, or someone with low vision get through this step? Watch for: things shown only by colour, things that only work on hover, things that close by themselves on a timer, and buttons that are really links.
7. **Dead ends at the joins.** What happens if they say no, don't come, have already paid, or paid a deposit? Is that drawn?

## How to record a finding

Give each finding a severity and a number: **H1, H2…** for High, **M1…** for Medium, **L1…** for Low.

- **High:** the story breaks, or a promise about money, time or what happens next is broken.
- **Medium:** someone is confused, asked for something twice, or a screen the story needs is missing.
- **Low:** wording, names, small polish.

Each finding has five parts:

1. **Screens:** the ids and sizes, e.g. `job-finished` (desktop), `cp-summary` (phone).
2. **What happens:** in plain words, quoting the exact wording on the screen.
3. **Why it matters:** to the person living the story.
4. **Fix:** if there's a real choice, numbered options (1, 2, 3), each with what it's good for and what it costs, then "Recommend 1". If there's only one sensible fix, write "Fix, no choice".
5. **Decision it touches:** if any, e.g. "touches Workshop day 43".

Only write down what you saw. If you couldn't check something, write "not checked" — never "it isn't there".

## At the end

1. A short table: id, screens, one line, and whether Jack needs to choose.
2. A numbered list of the choices for Jack.
3. **Verification:** which screens you looked at, at which sizes, which decision files you read, and what you couldn't check.
4. Save it as `docs/design/user-journeys/ux-walkthrough-<number>-<story>.md`, and tick the story off in the table above.

## Word list: customer words and staff words

For the "same thing, same name" question. If a screen uses another word for one of these, write it down as a finding. Started from walk-through 1 (L1); add to it as you go.

| The thing | What the customer reads | What staff read |
|---|---|---|
| Making a booking | Book a repair | New job, or Accept (a request) |
| Receiving the bike | (We've got your bike) | Book in |
| Work the customer said yes to | Work agreed | Approved |
| A job that's done | Ready to collect; the "Bike ready" message | Ready for collection; marking it is "Mark ready for collection" |
| Waiting on the customer's answer | Waiting for your answer | Waiting for the customer |
| The shop's address | [Shop address] (a placeholder until a real one is given) | [Shop address] |
| Something bought on the website | Your order; order [order number] | Online order (the till's hand-over says "Click and collect", walk-through 2 L1) |
| Giving it to the customer | Collect it; Collected | Hand over (the till's hand-over button says "Mark collected", walk-through 2 L1) |
| An order that's waiting | Ready to collect; the "Your order is ready to collect" email | Ready to collect; marking it is "Mark ready" |
| Checking in at the till | — | Enter your PIN; "Checked in today"; "Serving: [name]" (the app map says "Pick your name", walk-through 2 L1) |
| The money left in the drawer overnight | — | The shop's float; "Leave in the drawer" |
| Counting up at the end of the day | — | Close the day (till bar and page); "Takings and cash-ups" in Reports; "Close it" on Today |
| Finding an earlier sale | Receipt number; "give your name in the shop" | Past sales; "Scan or type the receipt number" |
| A part a job needs, once ordered | (The brake pads are arriving later than expected) | "On order" on the job's line (walk-through 3 L1: in the In stock column, not Customer approval); "for job WH-1042" on the order line |
| The part has come in | — | "Part arrived" (job, diary, Overview); "Arrived" in the job's In stock column; "All arrived" on the order |
| Adding a delivery to stock | — | "Book in [n] items" — the same word as receiving a bike, kept for both (walk-through 3 L1) |
| Items that didn't come | — | "Missing", then "[n] to come", on a delivery; a transfer says "1 missing" (it said "1 short", walk-through 3 L1) |
| Stock kept for a customer | — | "[n] held for online orders" at the till; "Held" for a bike (Cycle to Work); "held for job WH-1042" (walk-through 3 H1) |
| A job waiting for a part | (Waiting for parts strip and "New ready date" text) | "Waiting for parts" (the Activity log said "Waiting for a part", walk-through 3 L1) |
| Counting stock | — | Stock take (sidebar); "Start a count", "Join", "I've finished my part", "Check the count", "Apply to [n] products" |
| Stock lost or found | — | "Adjust stock" with a reason; "under" and "over" on a count; "Stock written off" in Reports (walk-through 3 M7) |
| What stock cost the shop | — | "Cost" (product page); "What it cost you" (Reports); "At cost" (Settings › Stockroom) |
| A group of products | — | "Category" (Settings › Stockroom › Categories, and Reports, walk-through 3 M10); the till's quick buttons are "groups" (Workshop, Parts, Accessories) |
| Bringing someone onto the staff | (the invite email) | "Invite someone" (Staff and roles); Getting started's step says "Invite your staff" (it said "Add your staff", walk-through 4 L1); a waiting invite is "Invited [date] · not joined yet" (walk-through 4 M3) |
| A person's till PIN | — | "Till PIN"; Wheelhouse picks it: "Your till PIN" the first time, "Your new till PIN" after; "No PIN yet · Get your PIN"; "Clear a forgotten PIN" (the invite said "They choose their own till PIN", walk-through 4 L1) |
| Wheelhouse before switch-over | — | "Practice: not real money" (till band); "Run alongside", "Still running" (the move's stages); "Clear and go real" (switch-over morning) |
| Bringing data from Citrus Lime | — | "Bring your data" the first time; "Weekly refresh" and "Refresh now" after; "Changed in both — Citrus Lime's kept" |
| The website showing to customers | (the website) | "Turn it on" / "Turn off"; "Your website is on" / "off"; changes go live with "Publish"; the move's checklist says "The website is ready" (it said "The website is moved", walk-through 4 H2) |
| Making a computer a till | — | "Make this computer a till" (Getting started); "Set up this till"; "Make this computer Till B1"; on a new shop's checklist "Make a computer a till there" (it said "Register its tills" / "Register a till", walk-through 7 L1); the tills list keeps "+ Add a till" |
| A Cycle to Work sale | (Your Cycle to Work bike) | "Cycle to Work order"; "+ New Cycle to Work order"; Front desk › Cycle to Work |
| The scheme's paperwork | "your certificate"; the "Certificate received" email | "Add the certificate"; "Certificate received" (a stage) |
| Who pays for a Cycle to Work bike | [Provider] (on the quote and emails) | "Scheme provider" where one is chosen, "Provider" elsewhere; the till's Other ways to pay said "Cycle to Work scheme · [Scheme name]" (walk-through 5 L1) |
| Giving a Cycle to Work bike over | Ready to collect; Collected | "Hand over", then "Hand over at the till" |
| The provider's money | — | "Expected £[£] by [date]"; "Mark paid", "Save as part paid", "Close with a reason"; "Owed by Cycle to Work providers" |
| A job's record in Lightspeed | (Job WH-1042; the customer never sees the Lightspeed record) | "work order [number]" — "a work order is Lightspeed's name for a job"; "In Lightspeed · work order [number]" |
| Paying at a Lightspeed shop | "Pay at the till when you collect" (the ready page said "You pay at the till", and the shop-without-online-payments page "Pay at the counter", walk-through 6 L1) | "Waiting to be paid in Lightspeed"; "Maya pays at the Lightspeed till"; "Paid in Lightspeed · [time]"; with payment unchecked, "Has Maya paid?" and "Yes, she paid" |
| The price agreed, at a Lightspeed shop | "Agreed price" | "Agreed £111.00" on the Lightspeed strip (Lightspeed shops 10, M8); the header tag said "Approved £111.00" beside it (walk-through 6 L1); the table keeps "Approved" |
| Linking the customer to Lightspeed | — | "Choose the customer"; "Which Maya Patel in Lightspeed?"; "Link and send"; "None of these — add Maya to Lightspeed" |
| Lightspeed out of reach | — | "Waiting to reach Lightspeed"; "Can't reach Lightspeed"; "Not sure it arrived"; "Check this in Lightspeed"; "Not in Lightspeed yet" |
| A price that moved in Lightspeed | (The quote has changed; the page said "Alex has added to the quote", walk-through 6 M4) | "Price changed in Lightspeed: £28.00 → £[£]"; "Keep £28.00"; "Ask Maya again" |
| A bike that left before payment showed | — | "Hand over anyway"; "Collected · not shown as paid in Lightspeed"; Today: "Handed over, not paid in Lightspeed" |
| One of the business's shops | (the shop's name on the website; "Which shop?") | "shop" everywhere staff read it ("Switch shop", "Choose a shop", "Works at"); "Sites" only in Settings › Shop and sites (Multiple sites 9, M12). Sign-in and "Set up this till" said "site" (walk-through 7 L1) |
| The second shop in examples | [Second site] | "[Second site]" on every board (journey 14's transfer boards and Today's transfer line said "[Site 2]" and offered "[Site 3]", walk-through 7 M5, L1) |
| Every shop at once | — | "All shops" (switcher, Today, Reports, the activity log); the owner always; a manager only with two or more shops |
| Changing which shop you're looking at | — | The switcher "Shop: Bolton. Choose a shop"; "Now working in [Second site]"; on Today's All shops rows "Work in Bolton" |
| A job for the other shop's workshop | (the booking messages name the shop: "North Street Cycles, [Second site]", walk-through 7 M6) | "Workshop at"; "Send request to [Second site]"; "Request from Bolton · booked by [name]"; Bolton sees "Sent to [Second site] · accepted for [day] [time]" (walk-through 7 H2) |
| Stock moved between shops | (online: "Coming from [Second site]") | "Send to another shop"; "On its way"; "Receive it"; transfer T-[0000]; the new shop's checklist "Send from Bolton" |
| A new shop being set up | — | "+ Add a shop"; "Add the shop"; "Getting [Second site] ready"; on Bolton's Today "[Second site] · [n] steps to get it ready"; "Show [Second site] to customers" (walk-through 7 H1, M3) |
| Something wrong at the other shop | — | On the chosen shop's Today, "[Second site] · [n] things need attention" with "See them" (walk-through 7 H1) |
