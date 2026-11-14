WP: none (Cycle to Work follow-up from `message-attachments`: Undo of Ready left the revised quote marked as sent)

# Proposal: undoing Ready un-sends the revised quote

## Why

When the certificate changes a Cycle to Work order to match and marks it ready,
the revised quote goes as a PDF with the "Ready to collect" email, and the
order records `revised_quote_sent`. That clears cw-quote-revised's grey "not
sent yet" message. Undo of Ready stops the waiting message, so the quote never
goes, but the record stayed and the grey message didn't come back. Staff would
think the customer had the revised quote when they didn't.

## What Changes

- **The quote's "sent" check** (`quoteFor` in `server/c2w/quote-pdf.js`) counts
  a `revised_quote_sent` only while the message it names hasn't been stopped
  (`status = 'undone'`). Events stay append-only; nothing is deleted.
- The same covers cancelling the order, which stops the message the same way.
- A message that already went can't be stopped by Undo, so it stays sent.

## Capabilities

None changed in `openspec/specs/`: this brings the code back in line with
cw-quote-revised as drawn. A small piece (`skip_specs`).

## Touches

`server/c2w/quote-pdf.js` (one query) and `tests/c2w-quote-pdf.test.js`. Not a
risky area: it reads the messages table and changes no messaging code.

## Out of scope

Sending the revised quote again with the next Ready to collect. After an Undo,
the grey message is back and "Email to [Customer]" sends it, as drawn.
