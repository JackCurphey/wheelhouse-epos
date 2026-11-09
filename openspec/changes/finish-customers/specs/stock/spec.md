# Spec Delta

Lines marked **[Q n]** follow a small default in `design.md` § Open questions, question n, for Jack to overrule.

## ADDED Requirements

### Requirement: Bike warranties are set per brand
Settings › Stockroom SHALL have a "Bike warranties" section where the Owner lists bike brands, each with its warranty lines: Frame, Components and Electronics, each either a number of whole years or Lifetime, or left out (Jack, 9 Nov, answer 3). The Electronics line SHALL apply only to e-bikes. Only the Owner SHALL change them.

#### Scenario: Trek and Cube
- **WHEN** Jack Lewis adds Trek with Frame Lifetime, Components 2 years and Electronics 2 years, and Cube with Frame 10 years and Components 2 years
- **THEN** the section lists "Trek · Frame lifetime · Components 2 years · Electronics 2 years" and "Cube · Frame 10 years · Components 2 years"

#### Scenario: Not a sensible length
- **WHEN** a line is typed as 0, a negative number, a fraction or more than 50 years
- **THEN** it isn't saved and says to type whole years, or choose Lifetime

#### Scenario: A brand typed twice
- **WHEN** "trek" is added while Trek is already listed
- **THEN** it is refused as already listed, capitals ignored

#### Scenario: Not the Owner
- **WHEN** Jo Taylor (Staff) opens Bike warranties
- **THEN** she sees them but can't change them, and the server refuses a change from her

### Requirement: A category is marked Bikes or E-bikes
In Settings › Stockroom › Categories the Owner SHALL be able to mark a category "Bikes" or "E-bikes", or leave it unmarked (Jack, 9 Nov, his answer to the bike question, option 3). A product SHALL be a bike when its category, or the nearest marked category it sits in, is marked; "E-bikes" SHALL count as bikes and SHALL make the product an e-bike. A category's name SHALL NOT decide it. Migration 127 SHALL mark "Bikes" every existing category whose name ends in the word bike or bikes, in each business that has marked none, so nothing that worked before stops working.

#### Scenario: A sub-category follows its parent
- **WHEN** Bikes is marked "Bikes" and Road bikes sits inside it unmarked
- **THEN** a product in Road bikes is a bike, and asks for its frame number when booked in

#### Scenario: Marked itself
- **WHEN** E-bikes sits inside Bikes and is marked "E-bikes"
- **THEN** a product in it is an e-bike

#### Scenario: Unmarked
- **WHEN** the Owner takes the mark off Bikes
- **THEN** products in it, and in unmarked categories inside it, are no longer bikes

#### Scenario: Not the Owner
- **WHEN** Jo Taylor (Staff) sends a mark
- **THEN** the server refuses it

### Requirement: A product records its brand, and is an e-bike by its category
A product SHALL be able to hold a brand, chosen from Bike warranties' brands or typed, set with the product's details and shown on its page. Whether it is an e-bike SHALL come from its category's mark. A typed brand SHALL match a listed brand ignoring capitals and spaces at either end. [Q 18]

#### Scenario: The Trek's brand
- **WHEN** the Owner sets the Trek Domane AL 3's brand to Trek
- **THEN** its page shows "Brand Trek" and "Warranty: Frame lifetime · Components 2 years", from Trek's lines

#### Scenario: A Trek e-bike
- **WHEN** a Trek product is in a category marked E-bikes
- **THEN** its page's warranty adds "Electronics 2 years"

#### Scenario: A brand not in the list
- **WHEN** a product's brand isn't one of Bike warranties' brands
- **THEN** its page shows the brand and no warranty

### Requirement: A model can have its own warranty lines
A product SHALL be able to replace its brand's warranty lines with its own, set on the product and put back to its brand's. [Q 17]

#### Scenario: A model with a longer frame warranty
- **WHEN** the Owner gives one Cube model its own Frame line of Lifetime
- **THEN** its page shows "Warranty (this model's own): Frame lifetime · Components 2 years", and other Cube models keep Cube's lines

### Requirement: A sold bike keeps the warranty it was sold with
Changing a brand's or a model's warranty lines SHALL NOT change the warranty of bikes already sold.

#### Scenario: Trek's components line changes
- **WHEN** Trek's Components line is changed from 2 years to 3 years
- **THEN** bikes sold before keep their components end date, and bikes sold after get 3 years
