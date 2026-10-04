# Coverage cell 12: Maya asks for her account to be deleted, and Jack Lewis does it

Stage W coverage check (`../coverage-check.md`, "Empty cells", 12), 4 Oct 2026. Journey 15 (Customer service) × Jack Lewis. Kept screen: `cs-privacy` (privacy requests, answered within a month), with its situations `ac-privacy-requests`, `cs-privacy-delete` and `cs-privacy-blocked`. Walked on the clickable mockup's build (`generator/out-mockup/`, copied to the scratchpad the moment it was built, every data file checked as whole JSON), following the targets `mockup/controls.mjs` `resolve()` gives each button. Maya was walked on a phone, and Jack on a desktop, then at tablet and phone. Method: `../ux-walkthrough-script.md`, the personas' checks in `../personas.md`, and issue #116's three changes.

## The story

Story 12 (`mockup/stories.mjs`), after Maya's account opens (`ac-account`):

1. Maya presses **Ask us to delete your account** (→ `ac-delete`). It tells her that her £[credit] of store credit will be lost. She presses **Ask to delete** (→ `ac-delete-sent`, "Request sent … by [date] at the latest"), then **OK** (→ `ac-account-delete-pending`, with "Cancel my request").
2. Jack sees "[Customer name] asked us to delete their account" on Today (`ac-today`) and presses **Open** (→ `ac-privacy-requests`).
3. If WH-1042 has been collected, he presses **Delete their details** and confirms (`cs-privacy-delete` → `cs-privacy`). If it's still open, he should get "Settle up first" (`cs-privacy-blocked`).

## Clicks and screens

| Person | Size | Clicks | Screens | Notes |
|---|---|---|---|---|
| Maya | Phone | 3 (Ask us to delete your account, Ask to delete, OK) | 3 (`ac-delete`, `ac-delete-sent`, `ac-account-delete-pending`) | Nothing tells her when it's done (M3) |
| Jack Lewis | Desktop | 3 (Open, Delete their details, Delete their details) | 3 (`ac-today`, `ac-privacy-requests`, `cs-privacy-delete`) and back to `cs-privacy` | Maya's row only exists in its "bike still in" state, with the button disabled (M3) |
| Jack Lewis | Tablet | the same | the same | |
| Jack Lewis | Phone | the same | the same | Pop-ups fill the screen |

Issue #116's question, "a line instead of a screen?": every gap below can be a line on `cs-privacy` or `ac-delete`. Question 2 would remove a situation (one less click for staff).

## Findings

### M1: "Settle up first" blocks deletion for store credit, but Maya was told the credit would just be lost

- **Screens:** `cs-privacy-blocked` (all sizes); `ac-delete`, `ac-privacy-requests`.
- **What happens:** Maya's pop-up says "You have £[credit] of store credit. It will be lost when your account is deleted — use it first, or ask for it back." Her request on Privacy requests reads "store credit £[credit] will be lost". But "Settle up first" lists "Store credit [£]" among "what's still open", and tells staff to "use or refund the credit … then delete".
- **Why it matters:** this is a money promise. Built from `cs-privacy-blocked`, a customer whose only open item is store credit would be told it's being deleted (and that the credit will be lost), while staff are stopped from deleting it.
- **Fix, no choice:** take the store credit row out of "Settle up first", and put it on the confirm pop-up (`cs-privacy-delete`) as "£[credit] store credit will be lost". This is a change to a situation line's wording (`consolidate/j15.mjs` line 31) and the drawing's row.
- **Decision it touches:** Account 8 (UI audit M12, option 2, 1 Oct): "store credit doesn't block deletion — the pop-up says it will be lost, and staff see it on the request". This replaced Customer service 12(2) (30 Sep, "holds store credit … is blocked") on this one point. The Customer service file's 1 Oct later change says the same ("store credit that will be lost"). The later decision settles it, so this only applies it.
- **Second check:** KEPT. The texts are as quoted. `cs-privacy-blocked`'s situation line still cites only "Customer service 9, 12(2)". Medium, not High: Maya's side and the request row are already right. Only the staff block pop-up is out of date.

### M2: With the bike still in, Maya is told to ask again later, but the staff side shows her request arriving anyway

- **Screens:** `ac-delete-blocked` (phone); `ac-privacy-requests`, `ac-account-delete-pending` (all sizes).
- **What happens:** Maya's blocked pop-up says "We can delete your account once your bike has been collected. Bike with us · Trek Domane AL 3 · WH-1042. Ask again after that…", with only OK, so nothing is sent. But Privacy requests shows "Maya Patel · Delete their details · From their account on the website … Still in the way: bike in the workshop, WH-1042 … Can be deleted once the bike is collected", with Delete held back. Her pending account shows the request beside WH-1042 "In the shop".
- **Why it matters:** the two sides disagree about whether a request can be sent while the bike is in. Either Maya has to remember to come back after collecting (an extra visit to her account), or staff are holding a request she was told she hadn't made.
- **Fix:** see question 1.
- **Decision it touches:** Account 4 ("with anything blocking it said up front ('We can delete your account once your bike has been collected' — Customer service 12)"); the Customer service file's 1 Oct later change ("what's in the way (a bike still in …), with 'Delete their details' held back until it's clear"). The two can be read either way, which is why it's a question.
- **Second check:** KEPT. `ac-delete-blocked`'s only control is OK, which leads to the account (`links/j07.mjs` line 97). `ac-privacy-requests`' line is "delete disabled, 'Still in the way'". Not raised before: walk-3 story 12 stopped at the receipt and the contact settings.

### M3: Once the bike is collected, the story can't be clicked to "done", and nothing tells Maya it's done

- **Screens:** `ac-privacy-requests` → `cs-privacy-delete` → `cs-privacy` (all sizes); `ac-delete`, `ac-delete-sent`.
- **What happens:** Maya's row is drawn only in its "bike still in" state. Its **Delete their details** has the HTML `disabled` attribute, yet the mockup wires it to `cs-privacy-delete`. A browser doesn't send clicks from a disabled button, so in the mockup it most likely does nothing (not checked rendered). The confirm pop-up is for "[Customer]" ("Delete [Customer]'s details?"), not Maya. After confirming, the list comes back unchanged, with the request still open and no "Done [date]". Maya was told "North Street Cycles will delete your account … and tell you when it's done". No message to her is drawn, and there's none in Settings › Messages.
- **Why it matters:** the last two steps of the story (Jack deleting, Maya being told) have no screen. The one-month deadline needs the request marked done to keep the paper trail Customer service 9 asks for.
- **Fix, no choice:** three lines, no drawings, following Customer service 9 and Account 4:
  - on `cs-privacy`, "Maya's request once WH-1042 is collected: 'store credit £[credit] will be lost', Delete their details" (this also gives M1's credit wording a home);
  - after deleting, the row reads "Done [date]", as the list's third row already does;
  - Maya is told it's done the way she chose to hear from the shop, with wording drafted under build-plan question 9.

  The mockup sends the story through `cs-privacy`'s enabled row, with a note naming Maya.
- **Decision it touches:** Customer service 9 (logged, worked on and marked done); Account 4; build-plan Q9 (message drafts). Applied, not reopened.
- **Second check:** KEPT. The button markup is `<button disabled aria-describedby="del-why" … data-go="cs-privacy-delete">`. `cs-privacy-delete`'s confirm leads to `cs-privacy`, whose rows are as before. A text search of every desktop drawing for a "deleted" message finds only `ac-delete` itself and the activity log (`ops-log`). Whether the disabled button's click is swallowed wasn't checked in a browser.

### L1: Today calls Maya "[Customer name]"

- **Screens:** `ac-today` (all sizes); `cs-privacy-delete`.
- **What happens:** Today reads "[Customer name] asked us to delete their account", and the confirm reads "Delete [Customer]'s details?". Privacy requests, opened from that same line, names "Maya Patel".
- **Why it matters:** these are the same request on three screens with two names. Jack can't check that he's deleting the person he means.
- **Fix, no choice:** "Maya Patel asked us to delete her account" and "Delete Maya Patel's details?", using example data the drawings already have.
- **Second check:** KEPT. The texts are as quoted at all three sizes.

## Decided, not raised again

- Deletion is a request staff confirm. It's shown on Today and on the customer page, with "Cancel my request" until it's done (Account 4, 8 H3).
- Sales stay in the books without her name, for tax (Customer service 9, and both pop-ups say so).
- Privacy requests open from Customers, with no sidebar entry (Customer service 9). Today's line is Jack's way in.
- "+ Log a request" and "Send the copy" lead to pages not drawn yet, already in `../mockup-gaps.md`.

## Persona and access checks

- **Jack Lewis:** two clicks from Today to the confirm, once the button works. The owner's checks are about reports, so they don't apply here.
- **Maya, not confident with phones:** the pop-up says what's lost, what stays, and that it can't be undone, each on its own line. "Want a copy first?" offers the download. Three taps.
- **Maya in a hurry:** the same three taps. Nothing to sign again.
- **Screen reader:** the disabled Delete carries its reason through `aria-describedby="del-why"`. The pop-ups are named dialogs.
- **Low vision:** customer screens are 13px or larger on a phone. The staff boards have some 11–13px text at desktop. Which elements it is on wasn't checked one by one.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | cs-privacy-blocked, ac-delete, ac-privacy-requests | Store credit blocks deletion for staff, but Maya was told it's just lost | No |
| M2 | ac-delete-blocked, ac-privacy-requests, ac-account-delete-pending | Bike still in: Maya told to ask again, but staff see her request | Yes (question 1) |
| M3 | ac-privacy-requests, cs-privacy-delete, cs-privacy | No clickable way to "done", and Maya isn't told | No |
| L1 | ac-today, cs-privacy-delete | "[Customer name]" for Maya | No |

## Questions for Jack

1. **If Maya asks to delete her account while her bike is still in the shop, can she send the request?** The customer pop-up says no ("Ask again after that"). The staff list shows the request arriving and waiting.
   1. **Yes. She sends it, and it waits until the bike is collected.** Her pop-up reads "We'll delete your account once your bike has been collected", with "Ask to delete" still there, and staff see "Can be deleted once the bike is collected", as drawn. Good for: fewer steps for Maya, nothing for her to remember, and the staff side and her pending account are already drawn this way. Costs: the shop has to watch the one-month answer date while the bike is in, and `ac-delete-blocked` changes from "Ask again" to "We'll do it after".
   2. **No. She can't send it until the bike is collected.** Staff never see a blocked website request, so `ac-privacy-requests`' "Still in the way: bike" line only lists store credit. Good for: the shop's one-month clock only starts once it can act. Costs: Maya has to come back later, and the staff drawing and her pending account need changing.

   Recommend 1.

2. **Two ways of saying "can't delete yet": a held-back button with the reason on the row (website requests), or a pressable button that opens "Settle up first" (requests logged by hand). Should they be one?**
   1. **One way: every request shows "Still in the way: …" on its row, with Delete held back until it's clear.** `cs-privacy-blocked` becomes unnecessary. Good for: one click fewer, one situation fewer (issue #116's aim), and staff see what's in the way without pressing anything. Costs: the "Settle up first" pop-up's how-to ("Take the payment, use or refund the credit, and hand the bike back") would need to be a line under the row.
   2. **Keep both as drawn.** Good for: no change. Costs: two patterns for the same rule on one page, and an extra click on hand-logged requests.

   Recommend 1.

## Verification

- **Walked:** `ac-account` → `ac-delete` → `ac-delete-sent` → `ac-account-delete-pending`, and `ac-delete-blocked` (phone, then desktop and tablet). `ac-today` → `ac-privacy-requests` → `cs-privacy-delete` → `cs-privacy`, and `cs-privacy-blocked`, at desktop, tablet and phone. A scratchpad script listed each screen's text, every control with its target, the delete button's markup, and text under 14px, then compared targets across the three sizes. Every desktop drawing was searched for a "deleted" message.
- **Also read:** `mockup/links/j07.mjs`, `controls.mjs`, `page.html` (the click handler), `consolidate/j07.mjs` and `j15.mjs` (the `cs-privacy` lines), `stories.mjs` story 12, `../mockup-gaps.md`, walk-3 story 12.
- **Decisions read:** Account, history and reminders (3, 4, 8 and later changes), Customer service (9, 12 and the 1 Oct later change), build-plan questions (Q9), the third walk's answers.
- **Not checked:** the mockup rendered in a browser, including whether the disabled button's click is swallowed. The one-month deadline's wording against UK law (from the decisions, not checked here).
