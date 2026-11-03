## MODIFIED Requirements

### Requirement: Margin and cost for the Owner only
The list's Margin and the product page's Cost and Margin SHALL show only to someone who can see costs, and the product page's Show on website only to the Owner. Until roles bring the person's "Can see costs and margin" switch, that is the Owner, and only when the Owner is the person at the computer. The server SHALL send a product's cost, from every route, only to someone who can see costs (stock decision 11; Reports and accounts decisions 5 and 9).

#### Scenario: Jo Taylor opens the brake pads
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** she sees Price and VAT, and no Cost or Margin

#### Scenario: Jo Taylor at the Owner's till
- **WHEN** Jo Taylor is checked in on a till signed in as the Owner, or nobody is checked in there, and Stock or a product is opened
- **THEN** no cost is in what the server sent, and no Cost or Margin shows

#### Scenario: the Owner
- **WHEN** the Owner, signed in on their own computer or checked in, opens Stock or a product
- **THEN** the Cost and Margin show

## ADDED Requirements

### Requirement: A save never overwrites a cost it wasn't given
Saving a product with no cost, a null or an empty cost SHALL leave its stored cost as it is. Someone who can't see costs SHALL NOT be able to change a product's cost, whatever they send, and a product they add SHALL start with no cost recorded. The Owner SHALL still be able to change a cost, including to £0.

#### Scenario: Jo Taylor saves the brake pads
- **WHEN** Jo Taylor changes the description of Shimano brake pads, and what's sent has the cost as null, 0 or a new figure
- **THEN** the description changes and the cost stored stays as it was

#### Scenario: adding a product in the old app with costs hidden
- **WHEN** someone who can't see costs opens the old app's add form
- **THEN** it offers no cost box, so nothing typed there is thrown away

#### Scenario: the Owner corrects a cost
- **WHEN** the Owner saves the brake pads with a new cost
- **THEN** the new cost is stored

### Requirement: A supplier's trade price follows the same rule
A supplier's catalogue item SHALL send its trade price only to someone who can see costs, and importing one SHALL still record that price as the new product's cost, without sending it to someone who can't.

#### Scenario: Jo Taylor reads a supplier's catalogue
- **WHEN** Jo Taylor opens a supplier's catalogue items
- **THEN** each item's trade price isn't in what the server sent
