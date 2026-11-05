## ADDED Requirements

### Requirement: Categories sit inside others
A business's categories SHALL form a tree: each sits at the top or inside one other, and a product's category SHALL be its whole path, "Drivetrain › Derailleurs". The tree SHALL be built from the categories products already have, and wherever a product's category is written the categories in it SHALL be found or made. "Uncategorised" SHALL NOT be a category.

#### Scenario: A product added to Drivetrain › Derailleurs
- **WHEN** a product is added with the category "Drivetrain ›Derailleurs "
- **THEN** it reads "Drivetrain › Derailleurs", and Derailleurs sits inside Drivetrain

#### Scenario: Uncategorised inside a path
- **WHEN** a product is added with the category "Uncategorised › Tyres"
- **THEN** its category is Tyres, and there is no category called Uncategorised

#### Scenario: A category called Uncategorised
- **WHEN** the Owner adds a category called "uncategorised", or renames one to it
- **THEN** it is refused, saying it's what a product with no category shows

### Requirement: Each category has its own details
In Settings › Stockroom › Categories the Owner SHALL give a category details: a name and the kind of answer, a number with its unit, a choice from a list with its choices, or text. A category SHALL pass its details down to the categories inside it, and a detail's name SHALL be used once from the top of the tree to the bottom. Removing a detail SHALL remove its answers, and the edit box SHALL be able to say how many products that is.

#### Scenario: Bearings
- **WHEN** Jack Lewis gives Bearings Inner diameter, Outer diameter and Height, each a number in mm
- **THEN** Bearings lists those three, each with its unit

#### Scenario: A detail with no unit
- **WHEN** a number detail is saved without a unit
- **THEN** it is refused, saying to give it a unit

### Requirement: Renaming or moving a category takes its products with it
Renaming a category, or moving it inside another, SHALL change the path of every category inside it and of every product in them, at once. It SHALL NOT be able to sit inside itself or one of its own, take a name already beside it, or change while one of its categories is being counted.

#### Scenario: Renaming Drivetrain
- **WHEN** Drivetrain is renamed
- **THEN** its derailleurs read "[new name] › Derailleurs"

#### Scenario: Moving where a detail's name is taken
- **WHEN** Wheels and Bearings each have Height, and Bearings is moved inside Wheels
- **THEN** it is refused, saying Wheels already has a detail called Height, and Bearings stays where it was

#### Scenario: Being counted
- **WHEN** Drivetrain › Derailleurs is being counted and Drivetrain is renamed
- **THEN** it says "Drivetrain › Derailleurs is being counted. Apply that count first." and nothing changes

#### Scenario: A count started while a rename is under way
- **WHEN** a count of a category is started at the same moment the category is renamed
- **THEN** either the rename is refused because the count is running, or the count finds no products in the old name; never a count of a category that's gone

### Requirement: A category of any depth can be counted
Starting a count of a category SHALL work for any path the tree holds, however long. An area's name SHALL still stop at 60 characters.

#### Scenario: A deep category
- **WHEN** a count of "Components › Drivetrain › Derailleurs › Rear derailleurs › 12-speed" is started
- **THEN** it starts
