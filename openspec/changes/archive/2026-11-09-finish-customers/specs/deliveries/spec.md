# Spec Delta

## MODIFIED Requirements

### Requirement: A bike asks for its frame number before it counts
Scanning or picking a bike while receiving SHALL ask for its frame number ("Scan the sticker on the frame, or type it") before it counts, and SHALL count it when the number is scanned or "Count this bike" is pressed. A bike is a product whose category, or the nearest marked category it sits in, is marked "Bikes" or "E-bikes" in Settings › Stockroom › Categories (`rs-frame`; Jack, 9 Nov, the bike question, option 3).

#### Scenario: Scanning a bike's sticker
- **WHEN** Jo Taylor scans a bike in a delivery and then its frame sticker
- **THEN** the bike counts, and its line reads "Frame [frame number]"

#### Scenario: Cancel
- **WHEN** the frame number box is cancelled
- **THEN** the bike isn't counted
