# till Specification

## Purpose
The till takes payment at the front desk: a sale of parts and products, or a workshop job's order paid when the work is done. This spec so far covers paying a job's order; the plain sale is described as each piece of it is next changed.

## Requirements

### Requirement: The till pays a workshop job's order
Opened with a job (Jack, 18 Oct, `docs/decisions/2026-10-18-till-job-payment.md`), the till SHALL show the job's order lines locked, each marked "agreed on the job", with the customer and job, and "Bike collected when paid", on by default while the bike is in the shop. Take payment SHALL pay the whole order. Then, unless the pill is off, it SHALL record the bike as collected.

#### Scenario: Paying for a finished job
- **WHEN** staff open WH-1042 in the till and pay its £83.00 by card
- **THEN** the order is paid, the job stays finished, and the bike is recorded as collected

#### Scenario: The bike stays
- **WHEN** staff switch off "Bike collected when paid" and pay
- **THEN** the order is paid and the bike stays in the shop

### Requirement: The till says when a job can't be paid
An order already paid SHALL say "This job’s order is already paid." with nothing to take. Work not yet in progress or finished SHALL say "The work isn’t finished, so this job can’t be paid yet." with Take payment unavailable.

#### Scenario: Work not started
- **WHEN** the job's work hasn't started
- **THEN** the till says "The work isn’t finished, so this job can’t be paid yet." and Take payment can't be pressed

### Requirement: The till pays a job's order at the amount due
The till SHALL ask the server for the amount due on a job's order, the order's and the customer's group discounts taken off, show both discounts, and take that amount (Jack, 18 Oct, answer 3). Paying SHALL sell past zero stock, the line saying "Stock says [n] — sold anyway".

#### Scenario: A discount
- **WHEN** Maya Patel is in Blue Light (10%) and her order has £2.00 off
- **THEN** the till shows both discounts and asks the card machine for the amount due, not the lines' sum

### Requirement: The till never takes a card for a sale the server would refuse
If the server won't pay a job's order (a retired service or product on it), the till SHALL say why, "This job can't be paid here yet: [reason]. Change it in the job's Work and parts.", and keep Take payment greyed. A refusal after the card step SHALL add "No sale was recorded: if the card machine took the payment, reverse it on the machine."

#### Scenario: A retired part
- **WHEN** a part on the order has been retired
- **THEN** the till says why and Take payment stays greyed

#### Scenario: Paid in another tab
- **WHEN** the card is approved but the order was already paid elsewhere
- **THEN** the till says no sale was recorded and to reverse the card on the machine

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
