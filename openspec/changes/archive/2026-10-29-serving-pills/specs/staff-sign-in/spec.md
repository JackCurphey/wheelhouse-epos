# Spec Delta

## ADDED Requirements

### Requirement: The till's Serving pills
On a till with trust PIN on, while someone is serving, the product side SHALL end in "Serving:", a pill for each person a tap would check in there and for the person serving, highlighted, then "Someone else" (`till-serving-pills`; roles and switches 10). A pill SHALL make that person the one serving, keeping the sale on screen. "Someone else" SHALL end the check-in and show Enter your PIN. With trust PIN off there SHALL be no pills.

#### Scenario: Jo takes over mid-sale
- **WHEN** trust PIN is on, Alex Morgan and Jo Taylor typed their PINs on Till B1 today, Alex is serving with a sale on screen, and Jo taps her pill
- **THEN** Jo Taylor is serving, the sale is still on screen, and Take payment records it under Jo

#### Scenario: Trust PIN off
- **WHEN** trust PIN is off and Alex Morgan is serving
- **THEN** there are no pills

### Requirement: Tapping a name in Checked in today
On a till's Enter your PIN with trust PIN on, each name in "Checked in today" that a tap would check in SHALL check that person back in when tapped (stage-1 gaps 11). Other names, and every name with trust PIN off, SHALL stay a list.

#### Scenario: Back from the stockroom
- **WHEN** trust PIN is on, Jo Taylor typed her PIN on Till B1 this morning, and the till shows Enter your PIN
- **THEN** Jo taps her name in Checked in today and is serving

### Requirement: A tap on a till follows the tap's rules
The server SHALL check someone in by a tap on a till only with trust PIN on, for someone active, not the Owner, who typed their PIN on that same till under the same sign-in on the shop's day, since their PIN was last cleared or changed. A PIN typed on another till or on a workshop computer SHALL not count, and a browser that is neither a till nor a workshop computer SHALL be refused.

#### Scenario: Another till
- **WHEN** Jo Taylor typed her PIN only on Till B2 today and her name is sent as a tap on Till B1
- **THEN** it is refused

#### Scenario: The Owner
- **WHEN** Jack Lewis, the Owner, typed his PIN on Till B1 today and his name is sent as a tap there
- **THEN** it is refused, and he types his PIN
