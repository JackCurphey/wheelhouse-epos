## Design

1. **Migration 112.** `move_files.report` also allows `customers` and `bikes`. `customers.citrus_account` (one per shop) says who came across; `customers.marketing_consent_on` holds the date of their yes. Indexes on the lower-case email and the phone's digits, so looking for the same person doesn't read every customer for every row.

2. **Recognising.** Top Customers needs Account Number, First Name, Last Name, Email, Phone. Service Items Report needs Description, Serial Number, Customer Name, Email Address. Only the columns used are kept; sales totals aren't.

3. **Order.** Price lists, customers, barcodes, then bikes. When a customers file finishes, bikes that found no customer try again, as barcodes do.

4. **A customer row.** First and last name → `name`; none, needs a look ("No name"). Address, Address 2, City, County and Country joined → `address`; Postcode, Email and Phone as they are. GDPR Consent of Yes, True, Y or 1 → `marketing_permission`, with GDPR Consent Date → `marketing_consent_on` (Excel's day number, dd/mm/yyyy or yyyy-mm-dd; nothing if it can't be read, and never guessed). `email_from_customer` stays off, so a code sign-in doesn't join a typed-in email (customer account, option 2).

5. **The same person.** An account number already here is left alone and counted in, deleted or merged customers included, so a file sent twice changes nothing and a deleted customer never comes back. Otherwise, the same email or phone (+44 and 0044 as 0) as a live customer needs a look ("Looks like the same person as [customer name]"), as drawn.

6. **A deleted customer's account number stays on their blanked record.** It's what stops them coming back. On its own it says nothing about them outside Citrus Lime.

7. **A bike row.** Match a live customer by email, then mobile, then phone, then exact name. No match needs a look ("The customer on this bike isn't in the customers file"); a name that fits several, "More than one customer has this name". Description → `model` (Citrus Lime has one field; no make is guessed); Serial Number → `serial_number`. The same description and serial on that customer is left alone. The batch locks its customers `FOR SHARE` in id order first, the order customers are locked elsewhere, and each row reads its customer again `FOR SHARE`, so a deletion that got there first is seen.

8. **Deleting someone's details.** Inside the existing deletion, rows not yet in whose email, phone or account number are theirs are removed, and their files' counts follow. Rows that came across are already empty.

9. **The page.** Customers becomes a real row: Top Customers and Service Items Report, with Service Items' "include items never serviced" named, since it's easy to miss. Bikes count beside customers on the summary ("[n] brought across · [n] bikes"), as bikes aren't one of the five kinds drawn.
