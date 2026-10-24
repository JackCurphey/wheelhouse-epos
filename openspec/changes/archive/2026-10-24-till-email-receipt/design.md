# Design: the till's Email receipt button

1. **The row.** Print · Email · No receipt (or Start next sale). Three
   columns: the drawn row's Text waits for texting.
2. **The pop-up** (`email-receipt.tsx`) sits over Paid:
   - title "Email the receipt", and "Sale [n] · [customer name]" or "Sale [n]
     · no customer on this sale" under it (the build's "Sale [n]", not the
     drawn "B1-[0000]", as the printed receipt does);
   - the "Email address" box (placeholder "name@example.com", focused); Enter
     submits;
   - "Cancel" and "Send receipt", which reads "Sending…" while sending.
3. **The customer's address.** `PayDialog`'s `job` carries the job's
   `customer` ({ id, name }). The pop-up reads `GET /api/customers/:id` and
   fills the box, with the drawn hint. A customer with no email gets an empty
   box and no hint.
4. **Errors.** The server's `bad_address` shows under the box, drawn red.
   "Sent five times in the last hour", or any other refusal, shows in the
   pop-up in the server's words (`refusalText`).
5. **The countdown.** `PaidStep` takes `paused`: counting stops while the
   pop-up is open, and the line reads "Next sale waits until the receipt is
   sent". Cancel resumes it from where it stopped.
6. **Sent.** With the setting off, the next sale starts (`onNextSale`). With
   it on, the pop-up closes and Paid says "Receipt sent to [address]."
   (`role="status"`).
