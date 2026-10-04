# UX walk-through 12, third walk: Maya twice, clicked

Issue #116 step 6, 3 Oct 2026. Walked on the clickable mockup (https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi, built in `generator/out-mockup/`). I followed story 12's steps in `generator/mockup/stories.mjs` through the real drawings and link targets. I walked it on a phone, twice: as Maya when she isn't confident with phones (**Maya, unsure**) and as Maya in a hurry (**Maya, hurried**). Then I walked it at tablet and desktop. Walk 2's findings that Jack answered (`../walk-2/ux-walkthrough-12-maya-twice.md`) aren't raised again. Those are: "Ask me before any extra work", the drafted texts, Cycle to Work's private link, "Your repair · WH-1042", Apple Pay and Google Pay on Pay now, and "[time]" on Book this time. Clicking shows each of those drawn as decided.

## The story, as the mockup runs it

1. Maya goes Home, then Shop, then a category, then the pads. She adds them to the basket, goes to the basket and checkout, pays, and her bank checks it's her. Then the order is confirmed and the "ready to collect" email comes.
2. Home, then Book a repair, then the four booking steps, then "Request received".
3. The quote comes; she taps Approve £111.00.
4. The "Bike ready" link at the counter, then the receipt email, then "See it in your account". She signs in with a code, opens the receipt, closes it, and changes how the shop contacts her.
5. The Cycle to Work email comes; she taps "See your Cycle to Work bike".

## Taps and screens

| Size | Taps | Screens | Notes |
|---|---|---|---|
| Phone | 18, plus typing the code | 27 (the email, bank and text screens count) | Every named button leads on |
| Tablet | 18 | 27 | Same; the account's receipt row reads "Purchase B1-[0000] · …" |
| Desktop | 18 | 27 | Same |

For **Maya, hurried**, the quickest route to the pads is the home page's featured product: 1 tap, not 3 (L2). Apple Pay is drawn on checkout. For **Maya, unsure**, the taps are few. The work is in reading, typing the sign-in code, and phoning when she isn't sure (M2).

## Findings

### M1: After paying and collecting, her account still says the bike is in the shop

- **Screens:** `cp-receipt-email` → `cust-signin` → `cust-code` → `ac-account` → `ac-receipt` (phone, tablet, desktop).
- **What happens:** Maya has paid £111.00 at the counter and the receipt email has come. She taps "See it in your account" and signs in. Her account says "Your bikes: … In the shop now · WH-1042", and under History, Now: "WH-1042 · Trek Domane AL 3 · Standard service · Repair · Booked in Thu 17 Sep · expected ready Thu 17 Sep · In the shop ›". The receipt she came for is the row "B1-[0000] · [Items bought] · Purchase · in the shop". When she opens it, it's the WH-1042 repair receipt (Standard service, pads, fitting, £111.00).
- **Why it matters:** **Maya, unsure** has the bike with her and has paid, and her account says the shop still has it. The row that holds her repair's receipt is called a purchase of "[Items bought]". She followed the email's own button, so this is the page she's meant to see.
- **Fix, no choice:** add a line on `ac-account`: "After collecting: the repair moves to Earlier, 'WH-1042 · Trek Domane AL 3 · Standard service · Repair · collected · receipt £111.00 ›'". This is the pattern the drawing already uses for older repairs ("WH-[0000] … Repair · [date] · collected · receipt £[total] ›"). In the mockup, story 12 opens the receipt from that row. This is a line and a link; no new drawing.
- **Decision it touches:** Account and reminders (one history); second walk answer 13 ("Your repair · WH-1042").
- **Second check:** KEPT. `cp-receipt-email`'s "See it in your account" has `data-go="cust-signin"`, the code screen leads to `ac-account`, and the `ac-account` text is as quoted at all three sizes. `ac-receipt` lists the WH-1042 lines. No `ac-account` line covers the state after collecting. Walk 2 walked these screens one at a time and didn't follow the email into the account.

### M2: "Call us" isn't a link on the repair pages, though it is on the website

- **Screens:** `dq-quote`, `bk-request`, `dq-answered`, `cp-summary-counter` (phone).
- **What happens:** The quote says "Not sure? Call [shop phone], or Add a note for the shop". The booking, answered and ready pages end "[Shop address] · [shop phone]". On all four, the number is plain text: only "Add a note" can be tapped. On the website (`wb-home`, "Our shops") and in the "ready to collect" email, the same "[shop phone]" opens the phone app.
- **Why it matters:** Jack's 3 Oct answer made the quote's promise "We'll send you the quote to approve, or call us" (Drop off, walk-through 12 H1). **Maya, unsure** is the person who'd rather call. On these pages she has to remember or retype the number, on the page where she's least sure what to do.
- **Fix, no choice:** on the repair pages, "[shop phone]" opens the phone app, as it does on the website and in the email. That's a link, not a layout change.
- **Decision it touches:** Drop off and approve the quote, 3 Oct (walk-through 12 H1).
- **Second check:** KEPT. In the phone data, `dq-quote` has `<span>[shop phone]</span>` inside "Not sure? Call …", and `bk-request`, `dq-answered` and `cp-summary-counter` have it in a `<span>` with no link. `wb-home`'s "[shop phone]" has `data-act="outside"` ("The phone app, calling the shop"). Walk 2 didn't raise this.

### L1: The basket jumps from 1 item to 3

On `wb-product` Maya adds 1 pad, and `on-product-added` shows "Basket, 1 item". "View basket" then opens `on-basket` with "Shimano brake pads … 2", another product, and "Basket, 3 items". Walk 2 L4 made checkout agree with the basket (ON1 in `draw-the-answers.md`), and it now does ("Shimano brake pads × 2"). Only clicking shows the jump from the product page. **Fix, no choice:** the example on `on-product-added` adds the quantity the basket shows, or the basket starts from 1 pad. This is example data. **Second check:** KEPT. The texts are as quoted. Walk 2 checked the basket against checkout, not the product page against the basket.

### L2: From Shop, Maya can't reach the pads by tapping

Home → Shop → a category opens `wb-category`, which is Bearings only. The pads aren't in any category the mockup can open, so the story has to skip ahead "(Shimano brake pads B05S-RX)". The only routes are the home page's featured product and the search. **Maya, unsure** browses by category, so in the mockup she gets lost. **Fix, no choice:** in the mockup, a note on `wb-category` ("showing Bearings; the pads' category works the same way"), or story 12 goes through the featured product. This is a mockup note. **Second check:** KEPT. `wb-shop`'s category links all go to `wb-category` (Bearings) or `wb-category-parent`.

### L3: Four status words were missed when the text was made bigger

At phone size, against 15px body text, these are 12px: the "Waiting for the shop to confirm" tag on `bk-request`, the "Answered" tag on `dq-answered`, the "In the shop" tag on her account (`ac-account`), and "Tap to enlarge" under the pads photo on `dq-quote`. After walk 2 M5, Jack said yes to making text bigger ("yes you can go ahead and make some text bigger", `draw-the-answers.md`, Done). The same kind of tag on the quote page ("Waiting for your answer", "Needed", "Optional") is now 15px, and the account's history lines went to body size, but these four were missed. **Fix, no choice:** the four go to 15px, as on the quote page. That follows Jack's yes and the pattern already drawn. **Second check:** KEPT. I read the sizes from the elements' own inline `font-size` in the phone data. `dq-quote`'s tags are `font-size: 15px`, and these four are 12px. No question needed: Jack's 3 Oct yes covers it.

## Decided, not drawn yet (not counted)

- The Cycle to Work email's "See your order" opens with no sign-in (Cycle to Work, 3 Oct). `cw-customer-view` is still headed "Your account", with an "Your account" link back to `ac-account`. That's right for a signed-in Maya; the private link is a line.
- The drafted customer texts (build plan Q9, 3 Oct, walk-through 12 M2) are lines on Settings › Messages. The story's hand-overs ("Alex's quote comes by text") have no text to click.

These were drawn and match Jack's answers when clicked: "Ask me before any extra work" (`bk-bike`), "We'll send you the quote to approve, or call us" (`bk-request`), "Your repair · WH-1042" (`dq-quote`, `cp-summary-counter`), Apple Pay and Google Pay on checkout, "Earliest you can have Thu 17 Sep, [time] · Book this time" (`bk-when`), "See your Cycle to Work bike" (`cw-email`).

## Persona and access checks

- **Maya, unsure:** the booking and quote read plainly and every step has one obvious button. She meets M1 (the account contradicts her) and M2 (she can't tap to call).
- **Maya, hurried:** Book this time, Apple Pay, and the code that "signs you in as soon as the last digit goes in" all click through. The code still can't be pasted (walk 2 M3, left out and still open; not raised again).
- **Screen reader:** the booking steps read "Step 3 of 4", the quote's photo button is named, and the email buttons are links.
- **Low vision:** see L3.
- **Saturday worker at the counter:** Maya is told "give your name or order number"; that's walk-through 10's ground.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | cp-receipt-email, ac-account, ac-receipt | After collecting, her account says the bike is still in the shop | No |
| M2 | dq-quote, bk-request, dq-answered, cp-summary-counter | "Call us", but the number can't be tapped | No |
| L1 | on-product-added, on-basket | Basket count jumps from 1 to 3 | No |
| L2 | wb-shop, wb-category | No tap route from Shop to the pads | No |
| L3 | bk-request, dq-answered, ac-account, dq-quote | Four status words still 12px on a phone | No |

## Questions for Jack

None. Each finding has one sensible fix, or follows a decision Jack has already made: the "call us" wording (M2), and his yes to bigger text (L3).

## Verification

- **Walked:** every step of story 12 at phone, tablet and desktop, with scratchpad `walk-9-12.mjs`, which lists each screen's text, every control and its target, and text under 14px. I also searched the phone data for "[shop phone]" on the repair pages.
- **Screens read in full (phone):** `wb-home`, `wb-shop`, `wb-category`, `wb-product`, `on-product-added`, `on-basket`, `on-checkout`, `on-checkout-paying`, `on-checkout-bank`, `on-confirmed`, `on-email-ready`, `bk-service`, `bk-bike`, `bk-when`, `bk-details`, `bk-request`, `dq-quote`, `dq-answered`, `cp-summary-counter`, `cp-receipt-email`, `cust-signin`, `cust-code`, `ac-account`, `ac-receipt`, `ac-contact`, `cw-email`, `cw-customer-view`.
- **Decisions read:** Drop off, Cycle to Work and build plan Q9 (3 Oct later changes); the second walk's answers 13–16; Account and reminders; walk 2's report and its second check; draw-the-decisions' "Left out" list, and draw-the-answers' text-size fixes and Jack's yes.
- **Not checked:** anything rendered in a browser (zoom, focus order, the phone's text-size setting); the pictures inside `jb-pending` and `j05-ready`.
