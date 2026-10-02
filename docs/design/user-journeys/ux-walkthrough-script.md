# UX walk-through script

For Jack and Mark, to walk Wheelhouse's stories by hand. A UI audit checks one screen at a time. A walk-through follows one person's whole story across several journeys and looks for what breaks where one journey hands over to the next. The first one done this way is `ux-walkthrough-1-repair.md`; use it as the example of a finished report.

## The seven stories

| # | Story | Journeys, in order | People to walk it as |
|---|---|---|---|
| 1 | A repair, start to finish | 1 Find the shop, 3 Book a repair, 4 Drop off and approve the quote, 12 Workshop day, 5 Collect and pay, 7 Account and reminders | Maya Patel (customer, phone and computer), Jo Taylor (front desk), Alex Morgan (mechanic, tablet), Jack Lewis (owner) — **done 2 Oct 2026** |
| 2 | A shop day | 10 Opening the shop, 11 Selling at the till, 2 Buy online / click and collect, 16 End-of-day cash-up | Jo Taylor at the till, Maya collecting an online order, Jack Lewis cashing up |
| 3 | Stock | 13 Receiving stock, 11 Selling at the till, 14 Stock take, 17 Reports | Jo Taylor receiving and selling, Jack Lewis ordering and reading reports; follow the Shimano brake pads B05S-RX that WH-1042 waits for |
| 4 | A new shop | 9 Moving from Citrus Lime, 8 Owner setup, B Signing in, 18 Website management | Jack Lewis (owner) setting up; Jo Taylor signing in for the first time |
| 5 | A Cycle to Work bike | 6 Cycle to Work, 11 Selling at the till, 17 Reports | Maya (customer), Jo Taylor, Jack Lewis |
| 6 | A repair at a Lightspeed shop | 21 Lightspeed shops (with the customer pages of 3, 4 and 5 it uses) | Maya, Jo Taylor, Alex Morgan, Jack Lewis |
| 7 | An owner with two shops | 19 Multiple sites, 20 Management oversight, 17 Reports | Jack Lewis, and staff at Bolton and [Second site] |

In every story, also walk it as: **someone using a screen reader**, **someone using only a keyboard**, and **someone with low vision** (large text or zoom).

## Before you start

1. Read the story's decision files in `docs/decisions/` (one per journey, named after it). They say what has already been decided. Don't reopen those; note when a problem touches one.
2. Open the canvases: customers and the website on https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh, the staff app on https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j. Each journey's board links to its own canvas for tablet and phone.
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
