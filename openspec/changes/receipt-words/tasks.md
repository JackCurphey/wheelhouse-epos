# Tasks: words at the bottom

## 1. Server (Mark's shops table and shop-settings.js; flagged for him)

- [ ] 1.1 Tests first, watched failing: receiptFooter starts null, saves trimmed with line breaks, clears when blank, refuses over 500 characters
- [ ] 1.2 Migration 043; receiptFooter on GET and PUT /api/shop-details

## 2. Screens

- [ ] 2.1 Tests first, watched failing: Settings › Till › Receipts shows and saves the words; the receipt prints them above the barcode with their line breaks, and nothing when blank
- [ ] 2.2 Settings section; receipt
- [ ] 2.3 Browser: type the words in Settings, print a receipt, and they sit above the barcode

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
