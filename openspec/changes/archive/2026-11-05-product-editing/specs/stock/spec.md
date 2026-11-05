## ADDED Requirements

### Requirement: Only the Owner adds or changes a product
Adding a product, changing one, its price or cost, taking it off or back on sale, its photo or its details, bringing a supplier's item in, and making or changing a product with sizes SHALL be the Owner's, until "Can order stock" exists. Anyone else, including someone checked in by PIN under the Owner's sign-in, SHALL be told "Only the shop’s owner can add or change products" and nothing SHALL change. Adjusting and counting stock and receiving deliveries SHALL stay with everyone.

#### Scenario: Jo Taylor adds a product on the old Stockroom
- **WHEN** Jo Taylor adds a product
- **THEN** she is told "Only the shop’s owner can add or change products", and it isn't added

### Requirement: A product answers its category's details
A product SHALL have an answer to each detail of its category and those above it: a number of up to four decimal places, one of a choice's choices, or text. An answer that doesn't fit SHALL be refused, saying why.

#### Scenario: A bearing's outer diameter
- **WHEN** Jack Lewis gives a bearing an outer diameter of 30
- **THEN** its page shows Outer diameter 30 mm

### Requirement: Products are found by their measurements
Searching a number with a unit SHALL find products with a number detail in that unit with that value. Picking a category SHALL show it and those inside it, and each of its details SHALL narrow them.

#### Scenario: bearing 30 mm
- **WHEN** someone searches "bearing 30 mm"
- **THEN** the bearings with a 30 mm detail are found, and nothing with 30 cm

### Requirement: Each size is named with its size and colour
Each size of a product with sizes SHALL be named with the product's name, its size and its colour, and SHALL have the product's category, kept in step whenever the product, a size or a colour is renamed. A sale's line SHALL say that name.

#### Scenario: Jersey M Blue
- **WHEN** size M in Blue of Jersey is sold
- **THEN** the sale's line reads "Jersey M Blue"

#### Scenario: Renaming
- **WHEN** Jersey is renamed
- **THEN** every one of its sizes is renamed with it, at once
