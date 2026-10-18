# Tasks: printing a receipt

## 1. Tests first, each watched failing

- [x] 1.1 Receipt tests: the printed receipt's contents for a job and for a cash-and-card sale; printReceipt prints only the receipt
- [x] 1.2 Till tests: Print on the Paid box prints the paid sale's receipt and starts the next sale (job and plain sale)
- [x] 1.3 Diary tests: Print receipt prints a paid job's receipt; greyed "Not paid yet" and "Order cancelled"
- [x] 1.4 Browser: pay a job, press Print, and the printed page holds the receipt

## 2. Build

- [x] 2.1 `receipt.tsx` (the receipt and printReceipt), print styles, JsBarcode
- [x] 2.2 Print on the Paid box; Print receipt in the job menu

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
