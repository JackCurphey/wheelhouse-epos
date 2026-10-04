# Coverage cell 10: Jo answers Maya's question from her account

Stage W coverage check (`../coverage-check.md`, "Empty cells", 10), 4 Oct 2026. Journey 7 (Account, history and reminders) × Jo Taylor. Kept screen: `ac-inbox` (Staff Messages: needs a reply). Walked on the clickable mockup's build (`generator/out-mockup/`, copied to the scratchpad the moment it was built, every data file checked as whole JSON), following the targets `mockup/controls.mjs` `resolve()` gives each button. Maya was walked on a phone, and Jo on a desktop, then at tablet and phone. Method: `../ux-walkthrough-script.md`, Jo's and Maya's checks in `../personas.md`, and issue #116's three changes.

## The story

Story 12 (`mockup/stories.mjs`), extended from the step where Maya is on her account (`ac-account`):

1. Maya presses **Ask the shop a question** (`ac-account` → `ac-ask`), types it, and presses **Send question** (→ `ac-account-question-sent`: "Question sent. We'll text you when North Street Cycles replies.").
2. At the front desk, Jo opens **Messages** (`ac-inbox`). Maya's question is in "Needs a reply". Jo opens it, types an answer, and presses **Send reply** (→ `ac-inbox-sent`).
3. Maya gets a text with a link (`ac-reply-text` shows it to staff), opens it, and reads the answer (`ac-question`).

## Clicks and screens

| Person | Size | Clicks | Screens | Notes |
|---|---|---|---|---|
| Maya | Phone | 3 (Ask the shop a question, Send question, the link in the text), plus typing | 4 (`ac-account`, `ac-ask`, `ac-account-question-sent`, `ac-question`) and the text | In the mockup the text's link isn't a button. She gets to `ac-question` through her history row on `ac-account-asked` (1 click, a situation) |
| Jo | Desktop | 3 (Messages, the question's row, Send reply), plus typing | 2 (`ac-inbox`, `ac-inbox-sent`) | The question's row says "Not drawn yet" (M1) |
| Jo | Tablet | the same | the same | The list and the conversation side by side, as on desktop |
| Jo | Phone | 4 (Open menu, Messages, the row, Send reply) as decided; the mockup skips the list (L1) | 3 with the list | |

Issue #116's question, "a line instead of a screen?": the one missing piece (M1) can be a line on `ac-inbox`. No new drawing is needed.

## Findings

### M1: Jo can't open Maya's question, and the reply drawn is for a job note

- **Screens:** `ac-inbox`, `ac-inbox-sent`, `ac-reply-text` (desktop, tablet, phone); `ac-question` (phone).
- **What happens:** Messages lists two conversations. "Maya Patel · Trek Domane AL 3 · WH-1042 · [Maya's note to the shop]" is her note on the job. "[Customer name] · Question from their account · [Their question]" is the account question. Pressing the question's row says "Not drawn yet: Another customer's question, opened in Messages". The only conversation that opens is the job note. Its reply box says "Sent to Maya by text, with a link to reply on the job's page". Its text reads "North Street Cycles replied about your Trek Domane AL 3 (WH-1042): [Jo's reply] … reply on your page: [link]". Maya's side (`ac-question`) is her account question, answered by "Jo Taylor, North Street Cycles", with no job.
- **Why it matters:** the story's join breaks in the middle. Jo can't answer what Maya asked. The reply and the text that can be clicked name a job her question isn't about. Built from these drawings, an account question's reply could promise "a link to reply on the job's page" when there is no job.
- **Fix:** see question 1. Whichever is chosen, the question's row names Maya (example data the drawings already use), so the two sides match.
- **Decision it touches:** Account 3 (each reply goes the way the customer chose, "with a link back to the thread"; "Ask the shop a question" covers anything not about a job) and Account 7 (the two-pane inbox). This applies them, and reopens neither.
- **Second check:** KEPT. `links/j07.mjs` line 59 makes the row `notDrawn`, and `../mockup-gaps.md` lists "Another customer's question, opened in Messages" among the 96 pages for Jack. A search of every desktop data file finds the account question staff-side only as that one row (on `ac-inbox`, `ac-inbox-sent`, `ac-inbox-all`, and behind `ac-reply-text`). It's Medium: a screen the story needs is missing, and nobody is asked to pay or promised a time.

### L1: On a phone, Messages opens a conversation, not the list

- **Screens:** `staff-app-menu` → `ac-inbox` (phone); `ac-inbox-list`.
- **What happens:** the phone menu's **Messages** opens `ac-inbox`, which is Maya's job-note conversation. The list (`ac-inbox-list`, "Needs a reply · 2") opens only from "Messages · needs a reply 2" at the top of that conversation.
- **Why it matters:** Account 9 says that on a phone it's "the list, then the conversation". Opening one conversation first hides the other one waiting for a reply. That's exactly the question in this story.
- **Fix, no choice:** on a phone, Messages opens `ac-inbox-list`. The mockup's shared Messages target (`links/shared.mjs` line 15) is the same at every size, so this needs a phone-only target.
- **Decision it touches:** Account 9. Applied, not reopened.
- **Second check:** KEPT. The phone menu's Messages has `data-go="ac-inbox"`, and the phone `ac-inbox` board shows the conversation, with the list as its first situation line. At tablet and desktop the list and the conversation sit side by side, so this is phone only.

## Decided, not raised again

- The question's own page before the shop answers is not drawn. It's already in `../mockup-gaps.md` ("The question's own page before the shop replies"), from `ac-account-question-sent`'s history row.
- Texts can't be received yet, so every text says "Replies to this number aren't read" (Account 3, Workshop day 2).
- Today shows "2 messages need a reply" (`ac-today`) as Jo's prompt, which is Account 7's "Needs a reply · [n]" on Today. The sidebar's Messages has no count. No decision asks for one.

## Persona and access checks

- **Jo, on the phone with a customer:** Messages is one click from any page. The list says "Needs a reply" in words. Once the question can be opened, answering takes one box and one button. The "Customer page" and the phone number sit beside the conversation.
- **Maya, not confident with phones:** one button on her account, one box, one button. The banner tells her how she'll hear back ("We'll text you"), which matches "Job updates · By text" on her account. Nothing to install, no new account.
- **Maya in a hurry:** 3 taps from her account to the answer.
- **Screen reader:** `ac-ask` is a named dialog, and its box has a label. The "Question sent" banner is a `role="status"` at every size. The answer's reply box on `ac-question` has a label.
- **Low vision:** the customer screens are 13px or larger on a phone. The desktop inbox has some 11–13px text. Which elements it is on wasn't checked one by one. The sidebar's 11px room headings were already noted in walk-3 story 2.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | ac-inbox, ac-inbox-sent, ac-reply-text, ac-question | Maya's account question can't be opened in Messages; the reply drawn is for a job note | Yes (question 1) |
| L1 | staff-app-menu, ac-inbox, ac-inbox-list | On a phone, Messages skips the list | No |

## Questions for Jack

1. **Maya's question from her account can't be opened in staff Messages, because only a job note is drawn there. How should it be shown?** This settles the `../mockup-gaps.md` entry "Another customer's question, opened in Messages" too.
   1. **A line on the Messages screen: "A question from the account: no bike or job; 'Question from her account'; the reply 'Sent to Maya by text, with a link to her question'".** The mockup's row opens the Messages screen with a note saying so. Good for: no new drawing, which is issue #116's aim, and the difference really is just two lines of wording. Costs: clicking the row in the mockup shows Maya's job note under a note, not her question.
   2. **Draw it as a situation of the Messages screen,** with Maya's question open and its reply line. Good for: the story clicks through end to end and looks right. Costs: one more drawing on the canvas.
   3. **Leave it for the build.** Good for: no drawing or line work now. Costs: the mockup's row stays "Not drawn yet", and the build has to guess the reply wording.

   Recommend 1.

## Verification

- **Walked:** `ac-account` → `ac-ask` → `ac-account-question-sent` → `ac-account-asked` → `ac-question` (phone, then desktop and tablet). `ac-inbox` → `ac-inbox-sent` → `ac-reply-text`, and `ac-inbox-list`, at desktop, tablet and phone. A scratchpad script listed each screen's text, every control with its target, labels and `role` attributes, and text under 14px, then compared targets across the three sizes.
- **Also read:** `mockup/links/j07.mjs`, `links/shared.mjs`, `controls.mjs`, `consolidate/j07.mjs` (the `into` lines for `ac-inbox` and `ac-account`), `stories.mjs` story 12, `../mockup-gaps.md`, walk-3 stories 9 and 12.
- **Decisions read:** Account, history and reminders (1–9 and later changes), Customer service 9, the third walk's answers.
- **Not checked:** the mockup rendered in a browser. The text's link opening `ac-question` (the link is text in a drawing, not a control).
