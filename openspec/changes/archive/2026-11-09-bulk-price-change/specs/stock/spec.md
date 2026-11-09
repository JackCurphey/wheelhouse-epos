## ADDED Requirements

### Requirement: Products are ticked on Stock
Whoever can change prices SHALL see a tick box on each product on Stock and, on a computer, "Tick all [n] shown" above them. With any ticked, a bar SHALL say "[n] ticked" with Untick all and Change prices. Ticks SHALL stay while the search, the filter or the category changes (`st-list-ticked`).

#### Scenario: Ticking a supplier's products
- **WHEN** the Owner searches "[Supplier]" and ticks all 3 shown
- **THEN** the bar says "3 ticked" with Change prices

#### Scenario: Jo Taylor
- **WHEN** Jo Taylor (Staff) opens Stock
- **THEN** there are no tick boxes and no Change prices

### Requirement: Change prices shows old and new before anything changes
Change prices SHALL offer A new price for each, Up or down by a percentage, or A target margin, and for a percentage or margin an ending: Leave as they are, .99 or .00. It SHALL list each ticked product (each size of a product with sizes) with its price now, its new price and its margin before and after, mark a new price under the product's cost "Below cost", and change nothing until "Change [n] prices" is pressed (`st-prices`).

#### Scenario: Ten per cent up, ending in .99
- **WHEN** the Owner ticks Shimano brake pads B05S-RX at £28.00 and picks Up or down by a percentage, +10, ending .99
- **THEN** the preview shows Now £28.00 and New £30.99, and the price is still £28.00

#### Scenario: A target margin with no cost recorded
- **WHEN** a ticked product has no cost recorded and A target margin is picked
- **THEN** it keeps its price, says "No cost recorded", and isn't counted in "Change [n] prices"

#### Scenario: Nothing would change
- **WHEN** the rule leaves every price as it is
- **THEN** "Change prices" is greyed and says "Nothing would change"

### Requirement: Prices are rounded to the nearest ending chosen
Ending in .99 SHALL take the nearest price ending in .99, and .00 the nearest whole pound, halfway going up. A price of £0.00 SHALL stay £0.00, and no other price SHALL round to £0.00.

#### Scenario: Rounding to .99
- **WHEN** a percentage change gives £30.80, and another gives £30.40
- **THEN** they become £30.99 and £29.99

### Requirement: A bulk change goes into each product's history
Each price a bulk change makes SHALL be recorded in that product's history as an edited price is, "Price changed · £28.00 → £[price]", with who and when, and SHALL be pushed to the website as a saved price is.

#### Scenario: The brake pads' history
- **WHEN** the Owner changes the brake pads' price from £28.00 in a bulk change
- **THEN** its history's newest line reads "Price changed · £28.00 → £[price]" with the Owner's name

### Requirement: A bulk change can be undone
After a bulk change, "Prices changed · [n] products" SHALL show with Undo (`st-prices-done`). Undo SHALL put back every price the change made that is still as it made it, record each in the product's history, and leave alone, and count, any price changed since. A change SHALL be undone only once.

#### Scenario: Undo straight after
- **WHEN** the Owner changes 3 prices and presses Undo
- **THEN** all 3 go back to what they were, and it says "Prices put back · 3 products"

#### Scenario: A price edited in between
- **WHEN** one of the 3 products' price is edited after the change, then Undo is pressed
- **THEN** the other 2 go back, the edited one keeps its new price, and it says "· 1 changed since, left as they are"

### Requirement: Only the Owner changes prices in bulk
Previewing, making and undoing a bulk change SHALL be refused to anyone but the Owner, the one at the computer, with "Only the shop’s owner can add or change products", until roles bring "Can order stock"; on a till or workshop computer with nobody checked in it SHALL ask for a PIN. A business's change SHALL never reach another business's products.

#### Scenario: Jo Taylor sends a change
- **WHEN** Jo Taylor sends a bulk price change
- **THEN** it is refused and no price changes

#### Scenario: Another business's product
- **WHEN** a bulk change names a product of another business
- **THEN** that product is left out and its price doesn't change

### Requirement: A bulk change never hangs on a held product
A bulk change SHALL wait a short time for a product something else holds, then say Wheelhouse is busy and change nothing.

#### Scenario: One product is held
- **WHEN** one ticked product's row stays locked and the change is made
- **THEN** within seconds it says Wheelhouse is busy, and no price has changed
