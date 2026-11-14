## Context

Messages live in `customer_messages` (one row per message, kept under each
shop's row-level security). `server/messaging/engine.js` queues them
(`queueMessage` for a template, `sendEmailTo` for a one-off email such as a
receipt or the quote), and each round `sendDueForShop` claims the due rows
and hands each to `senderFor(channel).send({channel, to, subject, body})`.
Every sender is the pretend one (`senders/pretend.js`).

The quote is built for the screen by `GET /api/c2w/orders/:id/quote` in
`server/routes/c2w.js` and drawn by `QuoteDoc` (`src/screens/c2w/quote-page.tsx`).
The quote email goes through `sendEmailTo` (template key `c2w_quote`); the
certificate's message goes through `queueCertificateMessage` →
`queueC2wMessage` → `queueMessage` in `server/c2w/messages.js`.

## Goals / Non-Goals

**Goals:** an email message can carry files to its sender; the quote email
and "Certificate received" (after a change to match) carry the quote as a PDF.

**Non-goals:** real sending, attachments on screens, wording changes, other
messages' attachments.

## Decisions

1. **A table of its own, migration 159.** `customer_message_attachments (id,
   shop_id, message_id, filename, content_type, content bytea, created_at)`.
   The link carries the shop too, `(message_id, shop_id)` →
   `customer_messages (id, shop_id)` ON DELETE CASCADE, as migration 117
   does, so a file can only hang off its own shop's message; an index led by
   `message_id` lets a deleted message find its files. With the shop's row-level
   security forced and a policy, as migration 085 does. Kept apart from
   `customer_messages` so the outbox's reads never load file contents. The
   cascade means a customer's privacy deletion, a merge's moves and a shop's
   removal (`server/remove-shop.js` finds `shop_id` tables itself) carry the
   files with their messages, with no change to those.
   *Alternative:* a `bytea` column on `customer_messages`: simpler, but every
   outbox read would have to avoid it, and a message could hold only one file.

2. **The engine takes `attachments`.** `queueMessage` and `sendEmailTo` take
   `attachments = []`, each `{ filename, contentType, content: Buffer }`, and
   store them in the same `runWithShop` as the message, only when the
   message goes by email. `sendDueForShop` loads the claimed email messages'
   files in its claim step and `sendOne` passes `attachments` to the sender.
   Undo and every "still needed" check act on the message row, so they stop
   its files too.

3. **`senderFor` returns a plain object.** `{ send }` from the pretend module,
   so a test can watch what the sender is given (`mock.method`). The interface
   a real sender meets gains `attachments`; the pretend one ignores them.

4. **The PDF is made on the server with pdfkit** (0.20.2, MIT, pure
   JavaScript, no browser needed). `server/c2w/quote-pdf.js` holds
   `quoteFor(orderId)` (moved out of the GET route, which then uses it, so
   the screen and the PDF show the same quote) and `quotePdf(quote)`, which
   lays out the paper version of `QuoteDoc`: the shop block top left, the
   quote's title, number and dates top right, the "For … · scheme provider …"
   line, the items table with its bold total, the closing paragraph and "How
   to apply:". A4, Helvetica (pdfkit's built-in font): neither is drawn; they
   follow the printed quote, which is A4 in UK shops. Logged as defaults.

5. **The logo only when the PDF can hold it.** The shop's uploaded logo (PNG
   or JPEG in `UPLOADS_DIR`, where `readUploadedImage` stores it, checked by its first bytes) goes in; a WebP
   logo, a logo held elsewhere or none leaves the space empty. The screen's
   "LOGO" box marks where a logo goes on screen; on a customer's file it would
   read as a missing mark, so it isn't drawn. Never a made-up mark.

6. **A snapshot when queued.** The PDF is made when the message is queued and
   stored with it, so the customer gets the quote as it was when staff sent
   it, even if the order changes within the minute's Undo.

7. **The certificate's revised quote.** The certificate route passes the PDF
   to `queueCertificateMessage` only when the certificate changed the order to
   match (`detail.revisedQuote`); the message carries it whichever wording goes
   (Certificate received, or Ready to collect when the bike is ready with it),
   and only by email. File names follow the drawn chips: "Quote [quote
   number].pdf" and "Revised quote [quote number].pdf".

## Risks / Trade-offs

- [File sizes in the database] → one quote PDF is a few kilobytes; a shop's
  logo adds its own size. Acceptable for two messages per order.
- [A PDF that fails to build stops the email] → the quote email route
  answers with the usual fault, so staff see "Wheelhouse couldn't send the
  quote." and Try again; the certificate is recorded first and a failed PDF
  leaves the message without the file rather than failing the certificate.
- [pdfkit's text checks in tests] → tests read the PDF's text by inflating
  its streams; tied to pdfkit's output, but the same library makes it.

## Migration Plan

Migration 159 adds an empty table; nothing to move. Rolling back the code
leaves the table unused.
