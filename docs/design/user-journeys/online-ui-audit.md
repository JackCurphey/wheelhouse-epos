# Journey 2 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 29 desktop renders of the Buy online / click and collect boards (1280 x 800: `on-product`, `on-product-two-shops`, `on-product-order-in`, `on-product-out`, `on-product-no-shop`, `on-choose-shop`, `on-basket`, `on-checkout`, `on-checkout-credit`, `on-checkout-gift`, `on-checkout-declined`, `on-confirmed`, `on-order`, `on-order-moving`, `on-order-ready`, `on-order-cancel`, `on-order-cancelled`, `on-order-cant-supply`, `on-orders`, `on-orders-ready`, `on-order-staff`, `on-cant-supply`, `on-today`, `on-today-uncollected`, `on-settings`, `on-settings-order-in`, `on-settings-start`, `on-settings-show`, `on-settings-pay`), against `docs/decisions/2026-10-01-buy-online-review.md` (decisions 1-8), `generator/online.mjs` (`site`, `product`, `AVAIL`, `qty`, `chooseShop`, `basketLine`, `basket`, `how`, `details`, `pay`, `cardForm`, `checkout`, `confirmed`, `steps`, `orderPage`, `cancelOrder`, `ordersPage`, `orderDialog`, `cantSupply`, `sellsOpen`, `startQuestion`), the pieces it borrows (`settings-frame.mjs` `onlineFolds`, `fold`, `popup`; `ui.mjs` `field`, colour tokens; `opening.mjs` `today`; `setup.mjs` Messages list; `till.mjs` `till-collect`), the rendered HTML of the boards for the accessibility checks, and the decisions it has to agree with (Collect and pay 4, Account and reminders 1-2, Multiple sites 1, 5, 9, 11, Selling at the till 9 and 12, Book a repair 3). Tablet and phone are not drawn yet, so nothing here covers them.

**Not raised, on purpose.** The [bracketed] placeholders (`[n]`, `[time]`, `[date]`, `[Product]`, `[Customer]`, `[order number]`, `[payment provider]`, `[Second site]`, `[opening hours]`, `[Shop address]`, `£[total]`). The Soft sand look. Clipped scroll areas the renderer cuts off (the bottom of the Collected group, the checkout boards stopping at the card form). Tablet and phone. 12-13px text that is only a label. The payment provider being unnamed. Apple Pay and Google Pay as plain text buttons. Real example data: North Street Cycles, Bolton, Maya Patel (07700 900 142, maya@example.test), Shimano brake pads B05S-RX £28.00, Jo Taylor, Jack Lewis. None of the eight decisions is reopened, including the single option in "How you'll get it" (decision 1) and stock being held only once the customer has paid (decision 2).

**Verdict.** The decisions are carried out and the look is right: one dark button per board, 44px quantity buttons and fields, labelled inputs, one `<h1>` per page by the source, dialogs that put the safe choice on the left on the customer side, "Collecting from Bolton · Change" in the header (decision 8), the three order groups and "Mark ready" in one press (decision 6), the reminder and Today line (decision 7), a progress list that is built from a list so "Sent" can be added (decision 1), and plain wording throughout. The gaps are in what the decisions leave to the design. Only one failure is drawn for money (a declined card), and nothing for stock changing under the customer. Every refund is described as "to your card" even though gift cards and store credit can pay part of an order. "Undo" after "Mark ready" cannot unsend an email. The last step of the flow, handing over at the till, has no door from the Online orders list. A mistyped email, the only way the customer hears "ready", is never checked. And the confirmation page says "link" where the approved account journey says "emailed code".

Checked against source: `cardForm()` is the only payment failure and it is passed one error text; `details()` never passes `error` to `field()`; `field()` has no `autocomplete`, `aria-invalid` or `aria-describedby`; refund text in `cancelOrder`, `orderPage('cancelled')`, `orderPage('cantSupply')` and `confirmed` always says "card"; `orderDialog` footer is `Cancel and refund` (ghost) on the left and `Mark ready` on the right, with the reason the button is greyed held only in a `title` attribute; the toast is a `role="status"` with an Undo button and no stated time; `orderRow` Ready rows end in a badge, not a button; `till-collect` exists in `till.mjs` but no board here leads to it; `basketLine` buttons are named "Remove", "One fewer", "One more" with no product name; `AVAIL.noshop` leaves "Add to basket" live; `onlineFolds` has four folds and no on/off switch; the sidebar's Online orders item shows no count on `on-today` or `on-orders`; `confirmed` says "we'll email you a link to sign in" and Account and reminders says customers sign in with an emailed code. Nothing was run in a browser, and no shell was available, so keyboard order, focus and a screen reader were not tested. Contrast was worked out by hand: muted text `#6E6752` on panel `#FFFDF7` about 5.5:1 and on page `#F4EEE1` about 4.9:1, both passing.

## High

**H1 — `on-basket`, `on-checkout`, `on-product-two-shops`: nothing is drawn for stock changing before the customer pays.** Decision 2 holds stock only once paid. So between "Add to basket" and "Pay", the last pair of pads can go to someone else, and a customer can pay for something that is gone. Not drawn: a basket line that has sold out, fewer left than the quantity asked for (the "+" button has no limit), the same check at checkout, and what happens when the customer pays at the same moment as someone else. *Why it matters:* the customer's money is taken for something the shop cannot give them, and the only fix is the "Can't supply" refund after the fact. *Fix:*
1. Check stock when the basket opens, at "Go to checkout" and again just before the payment is taken. A basket line that has changed says what happened in words ("Only [n] left at Bolton", "No longer in stock at Bolton"), with "Change quantity" or "Remove", and "Go to checkout" and "Pay" stay off until it is sorted. No money is taken for something that is not there. Draw `on-basket-changed` and one line on checkout.
2. Leave as drawn and rely on staff using "Can't supply this" and refunding. Fewer boards; the customer finds out by email after paying.
Recommend 1. Also make the quantity stepper stop at what is available and say why.

**H2 — `on-checkout-declined`: a declined card is the only payment problem drawn.** Not drawn: the moment after pressing Pay (button shows "Paying…" and cannot be pressed twice), the bank's extra check on the card (customers are sent to approve it), an Apple Pay or Google Pay sheet being cancelled, the connection dropping so the customer cannot tell if it went through, and a card declined after store credit or a gift card was applied. The error also sits inside the card box, well away from the sticky "Pay" button the customer just pressed. "Nothing has been taken" is only true if gift card and credit are not spent until the card succeeds, which no board states. *Why it matters:* "did it go through?" is how customers pay twice or ring the shop. *Fix:*
1. Draw three: paying (button disabled, "Paying — please don't close this page"), bank check ("Your bank wants to check it's you"), and not-sure ("We couldn't confirm your payment. Don't pay again — we'll email maya@example.test within [n] minutes if it went through."). Show the decline message under the Pay button as well as in the card box, and move focus to it. Say that gift card and credit are only used when the order is paid.
2. Only the not-sure state and the message under the button. Fewer boards; bank check and cancelled wallet left unspecified.
Recommend 1.

**H3 — refunds say "your card" everywhere, against "refunds go back the way they were paid" (Selling at the till 9).** Decision 5 lets store credit and gift cards pay part of an order. But `cancelOrder` says "£[total] goes back to your card", `on-order-cancelled` says "refunded to your card", `on-order-cant-supply` says "back on your card", the staff dialog says "Paid [time] by card", and `on-confirmed` says "Paid · £[total] on your card" even after credit or a gift card was used. The order page shows only "Paid on [date] £[total]", with no method. *Why it matters:* a customer who paid with a gift card is told the money goes to a card they did not use; staff cannot see which way to refund. *Fix:*
1. A "How it was paid" list on the confirmation, the order page and the staff dialog ("Store credit £[£] · Card £[£]"), and refund wording built from it ("£[£] back to your store credit, £[£] back to your card"). A gift card goes back onto that card's code. Same words on the customer's cancel dialog, the staff "Cancel and refund" and "Can't supply".
2. Refund everything as store credit. Simple; contradicts the till decision and surprises customers who paid by card.
Recommend 1.

**H4 — `on-orders-ready`: "Undo" cannot take back an email that has already gone.** Decision 6 sends "Order ready to collect" on one press. The toast says "Ready — [Customer] has been emailed" with Undo. Undoing puts the order back in "To get ready" but the customer is already on their way. The toast also has no stated time on screen, and a toast with a button that disappears by itself is hard for keyboard and screen-reader users to reach. *Why it matters:* a customer arrives and the order is not there. *Fix:*
1. Hold the email for a short, shop-visible moment: "Ready. Email goes to [Customer] in [n] seconds · Undo". After that, no Undo; mistakes are fixed by moving the order back, which offers to send "Sorry, not ready yet" in the shop's wording. Keep the toast on screen until dismissed or until the email goes, and make it reachable by keyboard (Tab goes to Undo).
2. Keep Undo and add a "Sorry, not ready yet" email on undo. No waiting; the customer gets two emails for a slip.
Recommend 1.

**H5 — `on-orders`, `on-orders-ready`, `on-order-staff`: the last step of the flow has no door.** Decision 6 says collecting is the till's hand-over, and `till-collect` ("Click and collect · order [number]") is drawn. But Ready rows end in a status badge ("Emailed", "Not collected · [n] days"), the only order pop-up drawn is for an order still being got ready, and nothing here leads to the hand-over. I did not check whether another journey's till board does. *Why it matters:* this is the moment the customer is standing at the counter, and it is the one that most needs to be one click. *Fix:*
1. A "Hand over" button on each Ready row that opens `till-collect` for that order, with the status badge moved beside the customer. Opening the customer's name on a Ready order shows the same button. At the counter that is: find the name, one press.
2. Search for the order number at the till only. Fewer controls on this page; staff who are on this page have to go and search.
Recommend 1. Also draw the hand-over for an order where one item was refunded ("Couldn't supply · refunded", not ticked).

**H6 — `on-checkout`, `on-confirmed`, `on-orders`: a mistyped email is never caught, and the "ready" message goes only there.** The email is the way the customer is told it is ready, and how an order without an account is found (decision 4). `details()` draws no required marker and never passes an error to `field()`, so there is no "Enter your email", "That email doesn't look right", missing name or phone state. The confirmation shows the address but offers no way to correct it, and staff see no sign that an email did not arrive. *Why it matters:* the customer waits for a message that never comes, and the shop only finds out when they ring. *Fix:*
1. Draw field errors for Name, Phone and Email ("Check your email address — it needs an @ and a dot"), keep the typed values, and move focus to the first one. On the confirmation: "Not right? Change email". On the staff order: "Email didn't arrive" badge with the phone number next to it. No second typing box.
2. Ask for the email twice. Catches more typos; more typing, against the fewest-clicks rule.
Recommend 1.

## Medium

**M1 — `on-orders`, `on-order-staff`, `on-product-two-shops`: the other shop's side of moving an item is not drawn.** Maya's order has an item "On its way from [Second site]", but nothing shows [Second site]'s staff that they have to send it, and Bolton has no board for "arrived", so "Waiting for 1 item" never turns into "Mark ready". The Order it button, once pressed, has no next state either. In the pop-up, "Mark ready" is greyed with the reason only in a `title` attribute, which a keyboard or a touch screen never shows. *Fix:*
1. Draw a "To send to Bolton" line in [Second site]'s own Online orders, "Arrived" in Deliveries and orders turning the row to "Mark ready", "Ordered · due [date]" after Order it, and the reason in plain text under the greyed button ("1 item is still on its way from [Second site]").
2. Only the plain-text reason. Cheapest; the other shop's side stays unspecified.
Recommend 1.

**M2 — `on-order-staff`: the pop-up footer puts a refund on the left and looks harmless.** Footer is "Cancel and refund" as a quiet ghost button on the left and "Mark ready" on the right, against Selling at the till 12 (safe choice left, confirming action right). The refund has no confirm, no reason and no amount or method, unlike a void at the till and unlike "Can't supply", which needs a reason. *Fix:*
1. Footer: "Close" on the left, "Mark ready" on the right. "Cancel and refund" moves into the body next to "Can't supply an item", as a red-outline button. It opens a short confirm: "Refund £[£] to Maya — [how it was paid]", a required reason, and the same email text the customer sees.
2. Keep it in the footer but red-outline, with the same confirm. Fewer changes; the destructive action stays next to the main one.
Recommend 1.

**M3 — `on-choose-shop`, `on-product-no-shop`: the shop chooser disagrees with booking's "Which shop?".** Multiple sites 9 says booking has nothing chosen unless the customer came from that shop's page, and tapping a shop goes straight on. Here the header says "Choose a shop", but Bolton is already selected in the pop-up and the button says "Collect from Bolton", which takes two actions and invites an unthinking click. "Add to basket" is live with no shop chosen (`AVAIL.noshop`), and nothing says what pressing it does. "Change" shop with items in the basket is not drawn either, though availability lines in the basket would become wrong. *Fix:*
1. Nothing pre-selected; tapping a shop saves it and closes the pop-up (one action). Pressing "Add to basket" with no shop opens the chooser, then adds the item once a shop is picked. After "Change", the basket re-checks each line and shows any that differ ("Ready at [Second site] in [n] days"), as in H1.
2. Keep the pre-selected shop and the confirm button. Two actions; matches checkout's single radio.
Recommend 1.

**M4 — customer order page: states missing.** Drawn: getting ready, on its way, ready, cancelled by the customer, one item refunded. Not drawn: "Collected" (the last step of the progress list is never lit, and nothing says what the customer sees afterwards); an order the shop cancelled when it was not collected (decision 7) which would say "Order cancelled" with no reason; all items refunded; and the customer pressing "Cancel" in the moment staff press "Mark ready". The Ready state has no Cancel and no sentence explaining why or who to ring. *Fix:*
1. Draw `on-order-collected` ("Collected on [date] by [name]", receipt link), shop-cancelled ("We cancelled this because it wasn't collected. £[£] has gone back to…"), and the clash ("Sorry — your order has just been marked ready, so it can't be cancelled here. To cancel, call [shop phone]."). On Ready, replace the missing button with "Changed your mind? Call or visit — [shop phone]".
2. Only Collected and the clash. Less to draw; shop cancellation unwritten.
Recommend 1.

**M5 — emails are promised but none is drawn or listed.** The journey sends an order confirmation, "ready", a reminder after [n] days, "couldn't supply" with the shop's reason, and a cancellation, but Settings › Messages lists only "Order ready to collect" (`setup.mjs`), so the shop cannot reword the other four. Customers are told "we email you" in the checkout hint, the confirmation, the order page and the basket, yet the Messages note lets the shop send text, email or both. *Fix:*
1. Add the other four to Messages ("Order confirmation", "Order still waiting", "Order cancelled", "Item we couldn't supply") and draw the "ready" email once, with the collect address and opening hours. Customer wording says "We'll tell you when it's ready" with the channel chosen by the shop.
2. Draw the "ready" email only. Smaller; the other four have no home.
Recommend 1.

**M6 — `on-confirmed`: "link" against "emailed code", and no way back to the order for someone without an account.** "No password — we'll email you a link to sign in" disagrees with Account and reminders (customers sign in with an emailed code). "Save my details" has no board for what happens next. "See your order" is a plain link to the side of the page, and for a customer without an account there is no stated way back later. *Fix:*
1. Wording: "We'll email you a code to sign in." Draw the step after Save ("We've sent a code to maya@example.test"). Say once that the confirmation email has a link to this order. Make "See your order" a normal secondary button.
2. Wording only. Cheapest; the missing step is found when built.
Recommend 1.

**M7 — `on-checkout-gift`, `on-checkout-credit`: gift card and credit states.** Not drawn: the code box that "Have a gift card? Add it" opens, a wrong or used-up code, a card worth more than the total (what is left on it), and credit or a card that pays the whole order (the card form and wallets should disappear and the button should read "Place order"). The store-credit tick is also unticked by default on the plain board and ticked on the credit board, so it is unclear which is the rule. *Fix:*
1. Draw the code box with its error ("We don't recognise that code"), the "£[£] left on your card" line, and a covered-in-full state with no card form. Tick store credit by default when the customer has some (one click fewer).
2. Draw the covered-in-full state only. Smaller; code errors unspecified.
Recommend 1.

**M8 — decision 1, room for delivery: it is there in the data but not in six places on screen.** Present and right: the progress list is built from a list, the "How" column is on the staff list, the one-option checkout step. Hard-wired to collection: the header chip "Collecting from Bolton · Change", availability lines ("Ready today at Bolton"), the basket and checkout summary row "Collect from Bolton · Free", the three numbered steps on the confirmation, the order page's side panel "Collect from", and the staff group names "Ready to collect". None needs drawing now. *Fix:*
1. Add a short "What changes when delivery arrives" list to the journey's handover, naming those six places, so delivery is a swap and not a redesign. No new boards (as decision 1 wants).
2. Draw one greyed-out "Delivery to your address" option on checkout. Shows the slot; contradicts "rather than drawn as a feature".
Recommend 1.

**M9 — `on-product-out`: a dead end.** "Ask the shop about it" is a button with no destination drawn. With two shops, a product out at Bolton but in stock at [Second site] still only says "Not in stock at Bolton" and the header chip is missing from the board. The customer has to work out that changing shop might help. *Fix:*
1. With two shops and stock at the other: "Not in stock at Bolton — in stock at [Second site]. Change shop". "Ask the shop about it" opens the shop's phone and email in place. No new setting.
2. Leave the wording; just draw where "Ask" goes. Smaller; customer still has to guess.
Recommend 1.

**M10 — accessibility: names, labels and announcements (source and rendered HTML).**
- Two basket lines both have "Remove", "One fewer" and "One more" buttons with no product name; a screen reader's list of buttons is ambiguous. Name them "Remove Shimano brake pads", "One fewer [Product]".
- `field()` does not link hint or error text to its input (`aria-describedby`), does not mark an invalid one (`aria-invalid`), and none of the checkout fields has `autocomplete` (name, tel, email, card number, expiry, security code). Autofill is one of the biggest fewest-clicks wins at checkout.
- The staff order list's column headings ("Customer", "Items", "How") are `aria-hidden` and the rows are a list, so a screen reader hears "Collect · Bolton" with no column name.
- Several `legend`s are hidden and say "Shop" or "Start with" while the visible question is "Which shop will you collect from?"; make the hidden legend the same words.
- The greyed buttons use `aria-disabled` and half opacity with the reason in a `title` (M1).
*Fix:* one pass as above. No choice.

**M11 — decision 6 asks for a count on the sidebar item; it is missing.** "Today shows 'New online orders · [n]' and the sidebar item a count." `on-today` and `on-orders` show Online orders in the sidebar with no number. *Fix:* a small count pill on the item (text and number, not colour alone) that matches Today's [n]. Global search says "Search jobs, customers, products": add "orders", since Online orders are found by customer name and order number.

**M12 — `on-today-uncollected`: not the uncollected-bike pattern.** Collect and pay 4 and its audit (H4): the line shows the phone, has a "Contacted" button and goes by itself at hand-over. Here the line has the phone and one "Open" button. Decision 7 says staff contact the customer or cancel, so the line has no way to say "I rang" and no way to cancel from it. *Fix:*
1. Same as the bike: phone number, "Contacted" (records who and when and quiets the line), and "Open" for the order (where Cancel and refund lives, with the M2 confirm). The line leaves by itself at hand-over.
2. Open only; staff do everything inside the order. One button; no record that someone has already rung.
Recommend 1.

**M13 — `on-settings`, `on-settings-start`: the owner's switches are incomplete.** `startQuestion` says "You're turning on buying online", but no board shows that switch or what the shop's website looks like when it is off. All three choices in "What the website sells" show on a one-shop business, though "Anything in stock at any of our shops" means nothing with one shop. And the fold says "What the website sells" without naming the shop even though decision 2 says each shop chooses (Multiple sites 1: every page says which shop). *Fix:*
1. A "Buying online" On/Off row at the top of the page (Off: the website's product pages show no Add to basket and say "Ask the shop"); the second choice is hidden for one-shop businesses; fold headings name the shop for businesses with more than one ("What Bolton's website sells").
2. Only hide the second choice for one shop. Smallest; the master switch stays unspecified.
Recommend 1.

## Low

**L1** — `on-product-two-shops`, `on-product-order-in`: the header gets crowded. The search box shrinks to 170px and its placeholder is cut ("Search the shor"), and "Collecting from Bolton · Change" does not wrap. A longer shop name pushes the nav. *Fix:* shorten the search placeholder, let the chip's shop name truncate with the full name in its label, and test with a long shop name.
**L2** — `on-basket`, `on-product`: not drawn: an empty basket after the last "Remove" (with an Undo line), what "Add to basket" does (basket count changes and a polite announcement, "Added — View basket"), and whether a basket price is per item or for the line when quantity is above 1. *Fix:* draw the empty basket; show "£28.00 each" and a line total when quantity is above 1.
**L3** — `on-confirmed`, `on-order-ready`: the order number is plain 15px text, yet step 3 says "give your name or order number". *Fix:* show it large in the monospace face on the confirmation and the Ready page.
**L4** — `on-product`, `on-basket`, `on-order-*`: availability lines use `role="status"` on text that is static when the page loads, so it is announced as noise. *Fix:* keep `role="status"` only where the text appears after an action (the paid banner, the refund line, the staff toast).
**L5** — `on-order-*`: no receipt. Account and reminders 1 lists purchases with receipts. *Fix:* "Receipt" link on the Ready and Collected pages, same one the account history opens.

## Summary of what to decide

17 recommendations, each a choice between real options; Jack to pick:

1. Stock changes before payment (H1, options 1-2).
2. Payment states beyond a decline (H2, options 1-2).
3. Refund wording and "how it was paid" (H3, options 1-2).
4. "Mark ready" Undo and the email (H4, options 1-2).
5. Hand-over from the Online orders list (H5, options 1-2).
6. Email and field errors (H6, options 1-2).
7. The other shop's side of moving an item (M1, options 1-2).
8. Footer and confirm on "Cancel and refund" (M2, options 1-2).
9. Shop chooser: nothing chosen and one action (M3, options 1-2).
10. Customer order states missing (M4, options 1-2).
11. Emails listed in Messages (M5, options 1-2).
12. Code against link and the way back to an order (M6, options 1-2).
13. Gift card and credit states (M7, options 1-2).
14. How delivery room is kept (M8, options 1-2).
15. Out-of-stock dead end (M9, options 1-2).
16. Uncollected line like the bike (M12, options 1-2).
17. Owner's master switch and one-shop settings (M13, options 1-2).

M10, M11 and L1-L5 have a single fix each and are listed so they are not lost.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | basket, checkout, two-shops | Stock gone before paying not drawn | Yes (1-2) |
| H2 | checkout-declined | Only a declined card drawn | Yes (1-2) |
| H3 | cancel, cancelled, cant-supply, confirmed, order-staff | Refunds say "your card" | Yes (1-2) |
| H4 | orders-ready | Undo cannot unsend the email | Yes (1-2) |
| H5 | orders, orders-ready, order-staff | No door to till hand-over | Yes (1-2) |
| H6 | checkout, confirmed, orders | Email typos and field errors | Yes (1-2) |
| M1 | orders, order-staff | Other shop's side and states | Yes (1-2) |
| M2 | order-staff | Refund on the left; no confirm | Yes (1-2) |
| M3 | choose-shop, no-shop | Chooser differs from booking | Yes (1-2) |
| M4 | order-* | Collected, shop-cancelled, clash | Yes (1-2) |
| M5 | Messages, order-* | Four emails with no home | Yes (1-2) |
| M6 | confirmed | Link against code; way back | Yes (1-2) |
| M7 | checkout-gift, checkout-credit | Code errors; covered in full | Yes (1-2) |
| M8 | header, basket, checkout, confirmed, order | Delivery hard-wired in six places | Yes (1-2) |
| M9 | product-out | Dead end | Yes (1-2) |
| M10 | basket, checkout, orders | Names, autofill, headings | Yes |
| M11 | today, orders | Sidebar count; search | Yes |
| M12 | today-uncollected | Bike pattern | Yes (1-2) |
| M13 | settings, settings-start | Master switch; one shop | Yes (1-2) |
| L1-L5 | various | See above | Yes |

## Verification (1 Oct 2026)

Checked by reading: all 29 renders; `online.mjs` in full; decisions 1-8; Collect and pay 4 and 5, Account and reminders 1-2, Multiple sites 1, 5, 9, 11, Selling at the till 9 and 12; `ui.mjs` `field` and colour tokens; `settings-frame.mjs` `fold`, `popup`, `onlineFolds`; `opening.mjs` `today`; `setup.mjs` Messages list; `till.mjs` `till-collect`. Searched the rendered HTML for `autocomplete`, `aria-invalid`, `role="alert"` and `role="status"` on `on-checkout-declined` (no `autocomplete`, no `aria-invalid`; one live region). Not checked: tablet and phone; keyboard order and focus; a screen reader; heading counts in the rendered files (one `<h1>` per page is from the source, not a count); whether another journey's till board leads to `till-collect` (H5); the other approved journeys beyond the decisions listed; payment provider behaviour (H2's bank check and unknown-result states are from general practice for card payments, not this product's documents, and need to be confirmed once a provider is chosen). Contrast worked out by hand. Pixel observations (search box clipped in L1) are read off screenshots.

Re-checked by the main session (1 Oct): the emailed-code sign-in (Signing in 2–3), the safe-choice-left rule (Selling at the till 12), `till-collect` having no way in from Online orders, and the missing sidebar count (decision 6) all hold.
