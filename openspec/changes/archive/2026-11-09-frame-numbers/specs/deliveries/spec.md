## ADDED Requirements

### Requirement: A bike asks for its frame number before it counts
Scanning or picking a bike while receiving SHALL ask for its frame number ("Scan the sticker on the frame, or type it") before it counts, and SHALL count it when the number is scanned or "Count this bike" is pressed. A bike is a product whose category, or a category it sits in, is named as bikes (`rs-frame`).

#### Scenario: Scanning a bike's sticker
- **WHEN** Jo Taylor scans a bike in a delivery and then its frame sticker
- **THEN** the bike counts, and its line reads "Frame [frame number]"

#### Scenario: Cancel
- **WHEN** the frame number box is cancelled
- **THEN** the bike isn't counted

### Requirement: A frame number already in stock is caught
A frame number already in stock, or already in this delivery, SHALL NOT be counted, and SHALL say "This frame number is already in stock — booked in [date]. Check the sticker, or scan the next bike." (or "This frame number is already in this delivery.") (`rs-frame-dup`). Booking in SHALL refuse a frame already in stock, including one booked in by someone else at the same moment.

#### Scenario: The same frame twice
- **WHEN** a frame number booked in last week is scanned again
- **THEN** it says it's already in stock, booked in that day, and the bike isn't counted

### Requirement: Booking in records each bike's frame number
Booking in SHALL record each bike's frame number against the product, the shop, the delivery and who booked it in, in stock, and SHALL refuse a bike without one. Bikes set aside SHALL NOT be recorded in stock.

#### Scenario: Three bikes
- **WHEN** three bikes are booked in with their frame numbers
- **THEN** the bike's page lists the three frames, each In stock, booked in that day from the delivery's supplier

#### Scenario: A bike without its frame number
- **WHEN** booking in sends a bike without a frame number
- **THEN** it is refused and nothing is booked in
