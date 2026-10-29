## ADDED Requirements

### Requirement: Items set aside are listed to return to their supplier
Stockroom › Deliveries and orders SHALL show, after "A delivery arrived?", a "To return to [Supplier]" section for each supplier with damaged or wrong items not yet returned, and none when there are none (`rs-hub`; receiving decisions 9 and 10). Each item SHALL read "Damaged · [n] · from the delivery on [date]" or "Wrong item · [n] · …", with Returned. Missing items SHALL NOT be listed. Only the Owner SHALL see the list, until roles.

#### Scenario: one damaged
- **WHEN** 1 [Product] from [Supplier] was marked damaged at booking in on 1 September
- **THEN** Deliveries and orders shows "To return to [Supplier]" with [Product], "Damaged · 1 · from the delivery on Tue 1 Sep" and Returned

#### Scenario: nothing to return
- **WHEN** nothing is set aside, or only missing items are marked
- **THEN** there is no To return section

### Requirement: Returned takes an item off the list
Returned SHALL record who sent the item back and when, and the item SHALL leave the list. Stock SHALL NOT change. Only the Owner SHALL mark an item returned, and an item SHALL be marked returned only once.

#### Scenario: sent back
- **WHEN** Jack Lewis presses Returned on [Product]
- **THEN** it leaves To return to [Supplier], and the section goes when nothing else is on it

#### Scenario: pressed twice
- **WHEN** the same item is marked returned twice at once
- **THEN** one is recorded and the other is refused
