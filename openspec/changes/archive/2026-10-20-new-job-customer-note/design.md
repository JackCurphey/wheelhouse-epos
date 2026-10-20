# Design
- Server: `customerDescription` is optional; not a string → 400 "What the customer told us must be text"; over 2,000 characters → 400; trimmed, blank stored as null; passed to `createWorkshopJob`, which already writes `customer_description`.
- New job sends `customerDescription` with the job; the box has `maxLength` 2,000 and its hint as its description.
- Receipt: `ReceiptJob.customerWords`, printed as "From the customer: …" straight under the job and bike line, keeping line breaks; none, no line. The job page's own label, "From the customer", is the wording followed (the receipt drawing has no such line).
