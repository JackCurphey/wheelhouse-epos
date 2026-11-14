## 1. Messages carry attachments (pull request 1: messaging core and migration)

- [x] 1.1 Test: an email message queued with an attachment hands the sender its file name, type and contents when it comes due (`queueMessage` and `sendEmailTo`)
- [x] 1.2 Test: a text queued with an attachment stores none; an undone message's file is never sent
- [x] 1.3 Test: deleting a message deletes its files; a shop can't read another shop's files (row-level security)
- [x] 1.4 Migration 159: `customer_message_attachments`
- [x] 1.5 `server/messaging/engine.js` and `senders/index.js` to pass 1.1–1.3

## 2. The quote as a PDF on its emails (pull request 2, or the same one if it stays under about 600 lines)

- [x] 2.1 Test: `quotePdf` holds the quote's shop, number, dates, customer, provider, items, total, closing and How to apply; "Revised [date]" on a revised quote; no logo when there is none
- [x] 2.2 Test: Email the quote queues "Quote [quote number].pdf"
- [x] 2.3 Test: the certificate changed to match queues "Revised quote [quote number].pdf" with "Certificate received"; a matching certificate queues none; a text customer gets none
- [x] 2.4 Add `pdfkit` 0.20.2; write `server/c2w/quote-pdf.js`; the GET quote route uses `quoteFor`
- [x] 2.5 `server/routes/c2w.js` and `server/c2w/messages.js` attach the PDFs
- [x] 2.6 Log the defaults in `docs/decisions/decided-while-building/2026-11-jack.md`

## 3. Checks

- [ ] 3.1 `/review` and `risky-area-reviewer` on each pull request
- [ ] 3.2 `npm run full-check` passes; CI run by hand on the branch is green
- [ ] 3.3 Archive the change as the last commit
