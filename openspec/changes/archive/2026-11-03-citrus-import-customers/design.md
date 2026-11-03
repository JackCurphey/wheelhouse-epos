## Design

1. **Migration 112.** `move_files.report` also allows `customers` and `bikes`. `customers.citrus_account` (one per shop) says who came across; `customers.marketing_consent_on` holds the date of their yes. Indexes on the lower-case email and the phone's digits, so looking for the same person doesn't read every customer for every row.

2. **Recognising.** Top Customers needs Account Number, First Name, Last Name, Email, Phone. Service Items Report needs Description, Serial Number, Customer Name, Email Address. Only the columns used are kept; sales totals aren't.

3. **Order.** Price lists, customers, barcodes, then bikes. When a customers file finishes, bikes that found no customer try again, as barcodes do.

4. **A customer row.** First and last name → `name`; none, needs a look ("No name"). Address, Address 2, City, County and Country joined → `address`; Postcode, Email and Phone as they are. GDPR Consent of Yes, True, Y or 1 → `marketing_permission`, with GDPR Consent Date → `marketing_consent_on` (Excel's day number, dd/mm/yyyy or yyyy-mm-dd; nothing if it can't be read, and never guessed). `email_from_customer` stays off, so a code sign-in doesn't join a typed-in email (customer account, option 2).

5. **The same person.** An account number already here is left alone and counted in, deleted or merged customers included, so a file sent twice changes nothing and a deleted customer never comes back. Otherwise, the same email or phone (+44 and 0044 as 0) as a live customer needs a look ("Looks like the same person as [customer name]"), as drawn.

6. **What a deleted customer leaves behind:** see 10; their account number doesn't stay on their blanked record.

7. **A bike row.** Match a live customer by email, then mobile, then phone, then exact name. No match needs a look ("The customer on this bike isn't in the customers file"); a name that fits several, "More than one customer has this name". Description → `model` (Citrus Lime has one field; no make is guessed); Serial Number → `serial_number`. The same description and serial on that customer is left alone. The batch locks its customers `FOR SHARE` in id order first, the order customers are locked elsewhere, and each row reads its customer again `FOR SHARE`, so a deletion that got there first is seen.

8. **Deleting someone's details.** Inside the existing deletion, rows not yet in whose email, phone or account number are theirs are removed, and their files' counts follow. Rows that came across are already empty.

9. **The page.** Customers becomes a real row: Top Customers and Service Items Report, with Service Items' "include items never serviced" named, since it's easy to miss. Bikes count beside customers on the summary ("[n] brought across · [n] bikes"), as bikes aren't one of the five kinds drawn.

## After the independent review, 3 Nov

These replace what's above where they differ.

10. **One-way codes of a deleted person** (Jack: "Keep a scrambled code", "Yes, scramble all three", `docs/decisions/2026-11-03-answers.md`). At deletion, HMAC-SHA-256 codes of their account number, each email and each phone (normalised) go in `move_deleted_codes`, keyed with a random salt for that shop (`move_deleted_salt`), with row-level security and no link to the customer. `customerRow` and `bikeRow` check them first: a match is `skipped`, counted and emptied, never created. This covers someone added by hand and deleted before any file, and someone waiting as "the same person as" them. `citrus_account` and `citrus_ref` are blanked at deletion.

11. **The date of a yes** goes by a trigger whenever `marketing_permission` changes, so every route (customers, the account, booking) follows, and it's cleared at deletion.

12. **A customer row with no account number needs a look,** since a resent file couldn't tell them from themselves.

13. **A bike's owner.** Everyone its email and phones fit is looked at, not the first. Two needs a look; so does a name that disagrees with the one they fit. Only with no contact match does the exact name count.

14. **A waiting row holds the matched customer's id** (`move_rows.customer_id`), not their name. `lookRows` puts the name in when it's shown, and deletion removes rows by that id as well as by email, phone and account number.

15. **A deletion locks every move file first,** in id order, as a batch does before its customers, so the two can't deadlock. A batch is 100 rows, so a deletion's 0.8-second lock wait is rarely hit, and if it is it says try again.

16. **A bike already brought across** is found by the Citrus Lime row it came from (`citrus_ref`, a hash of the row, one per shop), by its frame number on that customer, or by the same description and frame, so a corrected bike isn't added again.

17. **Phones.** `+44 (0)7700 900403` is the same number as 07700 900403: after removing 44 or 0044, a leading 0 goes too. One function serves customers, bikes, codes and waiting rows.

18. **Left alone isn't in.** `same` and `skipped` are counted apart from `in`; the summary adds "· [n] already here" and "· [n] left out, as they asked".
