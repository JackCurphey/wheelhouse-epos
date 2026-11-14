WP: none (Cycle to Work follow-up: the quote attachments drawn on `cw-email` and `cw-email-certificate-revised`)

# Proposal

## Why

The drawings show the quote going with two emails as a file: "Attached: Quote
[n]" on the quote email (`cw-email`) and "Attached: Revised quote [n]" on
"Certificate received" (`cw-email-certificate-revised`). What is built sends
both emails with no attachment: the quote email has the quote's words in its
text, and "Certificate received" only links to the customer's Cycle to Work
page. The 14 Nov entry in `docs/decisions/decided-while-building/2026-11-jack.md`
("The certificate's revised quote clears the grey message", item 3) left the
attachment for a later piece. This is that piece.

Messages can't carry a file today, so this change first lets an email
message carry attachments, then attaches the quote as a PDF to those two
emails.

**Who takes it:** Jack's side (Claude, for the Front desk), 14 Nov 2026,
option 1 from the Front desk: a PDF attachment, as drawn.

**Risky areas:** two.
- Migrations: a new table for the attached files.
- Messaging core: `server/messaging/engine.js` and the senders.

So it is a full change at any size: `/review`, `risky-area-reviewer` and a
hand-run CI before merging. Not a small piece.

## What changes

- An email message can carry attachments (a file name, its type and its
  bytes), kept with the message and handed to the email sender when it
  goes. Pretend sending still sends nothing; the pretend sender receives
  the files as a real one would.
- A text never carries an attachment.
- The quote is made as a PDF, laid out as the printed quote (`quoteDoc` in
  `c2w.mjs`, the paper version of `QuoteDoc`).
- The quote email (cycle-to-work task 3.6) carries "Quote [quote number].pdf".
- "Certificate received", when the certificate changed the order to match,
  carries "Revised quote [quote number].pdf" when it goes by email.
- A new dependency: `pdfkit` (MIT), to make the PDF on the server.

## Drawings and decisions followed

- `cw-email`, `cw-email-certificate-revised` (`docs/design/user-journeys/generator/c2w.mjs`,
  `email` and `emailRevised`; the `attachment()` chip).
- `cw-quote`, `cw-quote-revised` (`quoteDoc`, line 201): the PDF's layout.
- Journey 6 decisions: `docs/decisions/` (Cycle to Work), decision 6 (the quote).
- `docs/decisions/2026-10-20-messages-engine.md`: pretend sending until Jack says otherwise.
- `docs/decisions/decided-while-building/2026-11-jack.md`, 14 Nov, "The
  certificate's revised quote clears the grey message", item 3.

## Out of scope

- Changing any message's wording. The drawn "Certificate received" email
  says "Your revised quote is attached."; the built wording isn't changed here.
- Showing attachments in the outbox or on the conversation screens.
- Real email sending (still pretend).
- Attachments on any other message.
- The shop's own logo when it is a WebP file (the PDF leaves it out).
