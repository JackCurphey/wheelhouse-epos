## ADDED Requirements

### Requirement: The Paid box offers Print and No receipt
After a sale or a job's order is paid, the Paid box SHALL offer Print and No receipt (`till-receipt-print`; Jack, 18 Oct). Print SHALL print the receipt on the computer's printer and then start the next sale, as No receipt does.

#### Scenario: Printing after paying a job
- **WHEN** workshop job WH-1042 is paid by card and staff press Print
- **THEN** the receipt prints and the till moves on to the next sale

### Requirement: The printed receipt
The printed receipt SHALL show the shop's name, "Sale [n]" and its barcode, the date and time, the job and bike when it pays a job, each line with its price, any discounts, the total and each way it was paid (`till-receipt-paper`). It SHALL show no VAT line or address until those are recorded (Jack, 18 Oct, answer 2).

#### Scenario: A job's receipt
- **WHEN** WH-1042's receipt prints
- **THEN** it shows "North Street Cycles", "Sale [n]", "WH-1042 · Trek Domane AL 3", Standard service £65.00, Shimano brake pads £28.00, Fit & adjust brakes £18.00, Total £111.00 and "Paid by card £111.00"

#### Scenario: Cash and card
- **WHEN** a sale is paid partly in cash and partly by card
- **THEN** the receipt shows "Paid by cash" and "Paid by card", each with its amount
