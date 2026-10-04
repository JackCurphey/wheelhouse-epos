# Coverage cell 9: the Saturday worker emails a receipt

Stage W coverage check (`../coverage-check.md`, "Empty cells", 9), 4 Oct 2026. Journey 5 (Collect the bike and pay) × the Saturday worker. Kept screen: `cp-receipt-address` (no customer on the sale, this receipt only). Walked on the clickable mockup's build (`generator/out-mockup/`, copied to the scratchpad the moment it was built, every data file checked as whole JSON), following the targets `mockup/controls.mjs` `resolve()` gives each button, at desktop, tablet and phone. Method: `../ux-walkthrough-script.md`, the Saturday worker's checks in `../personas.md`, and issue #116's three changes.

The drawings call whoever is at the till "Jo Taylor", so the till says "Serving: Jo Taylor". That's example data, not a finding (walk-3 story 10 says the same).

## The story

Story 10 (`mockup/stories.mjs`), with one change: at `till-receipt` the Saturday worker picks **Email** instead of "No receipt", as Jo does in story 2.

1. The Saturday worker sells two Shimano brake pads and Fit & adjust brakes, £74.00 by card (`till-sale` → `till-pay` → `till-card` → `till-receipt`).
2. The customer, who isn't on the sale, wants the receipt by email. The worker presses **Email** (`till-receipt` → `cp-receipt-address`), types the address, leaves "Save to a customer record" unticked, and presses **Send receipt**.
3. The customer gets the receipt email (`cp-receipt-email-till`, the mockup's target). The till goes on to the next sale.

## Clicks and screens

| Person | Size | Clicks for this step | Screens for this step | Against story 10 as walked in walk-3 |
|---|---|---|---|---|
| Saturday worker | Desktop | 2 (Email, Send receipt), plus typing the address. Enter sends, so it can be 1 click and Enter | 1 new (`cp-receipt-address`) | 12 → 13 clicks; 20 → 21 screens |
| Saturday worker | Tablet | the same | the same | the same |
| Saturday worker | Phone | the same; the pop-up fills the screen | the same | the same |
| Customer | any | 0 | 1 (the email) | — |

Issue #116's question, "could this be a line instead of a screen?": no new screen is needed. `cp-receipt-address` is already one kept screen with five situation lines (error, save, text, customer on the sale, offline). An address box inside the Paid pop-up would save one click. But the separate pop-up, with the cursor already in the box and Enter to send, is decided (Leftover screens 3 and 6, audit M1), so this walk doesn't raise it.

## Findings

### M1: The receipt the customer gets is for a different sale: £70.00 with a discount, cash and card

- **Screens:** `till-receipt` → `cp-receipt-address` → `cp-receipt-email-till` (desktop, tablet, phone).
- **What happens:** Story 10's sale is "Card · £74.00 · receipt B1-[0000]" (`till-receipt`), and the pop-up behind the box still says "Card · £74.00". After **Send receipt**, the email the mockup shows is story 2's sale: "Discount · [reason] −£4.00", "Total (includes VAT) £70.00", "Paid by cash £20.00", "Paid by card · [card ending] £50.00".
- **Why it matters:** the receipt is the customer's proof of what they paid. Anyone walking the Saturday worker's day sees the amount and the way it was paid change between the till and the email. This is the same kind of mismatch as walk-3 story 10 M1 (£111.00 becoming £74.00 on the pay screen).
- **Fix, no choice:** one receipt email serves every till sale, so no new drawing is needed. When `cp-receipt-address`'s **Send receipt** is reached from the £74.00 sale, the mockup shows a note on the email: "showing the discounted £70.00 sale's receipt; yours reads Card · £74.00". The mockup already has `go(id, note)` for this.
- **Decision it touches:** Leftover screens 1, 3 and 6 (M3, "a till-sale receipt is drawn too"); walk-3 story 2 H1, whose fix pointed **Send receipt** at the discounted email. This carries that fix to the other sale. It doesn't reopen it.
- **Second check:** KEPT. `mockup/links/j05.mjs` line 60 sends every **Send receipt** to `cp-receipt-email-till`, with no note. The email's text is as quoted at all three sizes. No £74.00-by-card guest email is drawn: `cp-receipt-email-guest` is the £111.00 WH-1042 repair. Medium, not High: the drawings' rule (the receipt shows the sale) is right. Only the mockup's example is wrong.

### L1: After the receipt goes, two of the box's endings land on the paid sale with "Take payment · £74.00" still live

- **Screens:** `cp-receipt-address-save` ("Add the customer"), `cp-receipt-address-offline` ("Send when back online") → `till-sale` (all sizes).
- **What happens:** both buttons lead to `till-sale`, which is the full £74.00 basket with "Take payment · £74.00". On `till-receipt`, **Close** and **No receipt** lead to the empty till (`till-empty`), as decided after walk-3 story 5 L2. "Not now" on the save box goes back to the address box, but the box's own words say "'Not now' keeps the receipt sent and adds no one".
- **Why it matters:** someone who hasn't used the till for a week sees the sale they've just been paid for, ready to be charged again. These situations are reached from the mockup's situation list, not from story 10's path. The tick itself stays on the page.
- **Fix, no choice:** "Add the customer", "Not now" and "Send when back online" lead to `till-empty`, as Close and No receipt do.
- **Decision it touches:** none. This follows the third walk's fix for Close (`links/j11.mjs` line 108).
- **Second check:** KEPT. `links/j05.mjs` lines 61–62 and 96 send these to `till-sale`. `till-sale`'s text is as quoted. "Not now" resolves to `back` through the shared Close rule in `controls.mjs`. Low, because it's off the story's path and the mockup's wiring, not the drawing.

## Decided, not raised again

- "Next sale starts in 5 seconds" on `till-receipt`: the countdown stops while the receipt pop-up is open (Leftover screens 6, M1), and `cp-receipt-address` says "Next sale waits until the receipt is sent". Closing things on a timer is walk-through 1 L6.
- "Save to a customer record" starts unticked, and ticking it opens a quick Add a customer (Leftover screens 3).
- The till-only worker still has the full sidebar in the mockup: "Till only" is decided as a line (walk-through 8 decision 8, walk-through 10 M1 later change), as walk-3 story 10 notes.

## Persona and access checks

- **Saturday worker, after a week away:** the box says what it's for ("· no customer on this sale"), and that the address is for this receipt only. The tick explains itself. Nothing needs to be shown by someone else. Adding a customer from the tick uses the till's own Add a customer, so it needs no owner-level access (the coverage check counts `cp-receipt-address` among till-only screens).
- **Screen reader:** the box is a named dialog. The address has a label, `type="email"` and `enterkeyhint="send"`. The tick is inside its label.
- **Keyboard:** the cursor starts in the address box, and Enter sends.
- **Low vision:** the box's text is 13px or larger at every size. The 11px and 12px text is in the sidebar behind it, already noted in walk-3 story 2.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | till-receipt, cp-receipt-address, cp-receipt-email-till | The £74.00 card sale's receipt email shows the £70.00 discounted cash-and-card sale | No |
| L1 | cp-receipt-address-save, cp-receipt-address-offline | Add the customer, Not now and Send when back online land on the paid basket | No |

## Questions for Jack

None. Both fixes follow recorded decisions.

## Verification

- **Walked:** `till-receipt` → `cp-receipt-address` → `cp-receipt-email-till`, and the box's five situations, at desktop, tablet and phone. A scratchpad script listed each screen's text, every control with its `data-go`/`data-act` target, and any text under 14px, then compared the targets across the three sizes.
- **Also read:** `mockup/links/j05.mjs`, `links/j11.mjs`, `controls.mjs`, `page.html` (the click handler), `stories.mjs` story 10, `../mockup-gaps.md`, walk-3 stories 2 and 10.
- **Decisions read:** Leftover screens (1, 3, 6 and the later changes), Selling at the till 3, walk-through 8 decision 8, the third walk's answers.
- **Not checked:** the mockup rendered in a browser (focus order, zoom). Whether the Saturday worker uses a desktop, tablet or phone is still unknown (`personas.md`).
