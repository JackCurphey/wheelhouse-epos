## ADDED Requirements

### Requirement: Settings shows each category with its details
Settings › Stockroom SHALL have a Categories fold after Stock adjustments, summarised by its most particular categories ("Bearings, Drivetrain › Derailleurs and 1 more"). It SHALL list every category, one inside another set in, with its own details on one line, whether it passes them down or has some from above, and an Edit button, then "+ Add a category".

#### Scenario: The drawn categories
- **WHEN** the Owner opens Settings › Stockroom › Categories with Bearings, Drivetrain and Drivetrain › Derailleurs
- **THEN** Bearings reads "Inner diameter (mm) · Outer diameter (mm) · Height (mm)", Drivetrain "[Detail] · passed down to its sub-categories", and Derailleurs, set in, "Number of gears (a choice) · and Drivetrain’s details"

### Requirement: The category box asks for what each detail needs
Editing or adding a category SHALL show where it sits, picked from a list by keyboard and never itself or one of its own, what it has from the categories above with a way to change it there, and its own details. Adding a detail SHALL ask for a unit for a number, the choices for a choice, and nothing more for text. A removed detail SHALL be undoable until Save, and the box SHALL say how many products lose its answers.

#### Scenario: A detail removed then undone
- **WHEN** the Owner removes Number of gears from Derailleurs, answered on 3 products
- **THEN** it shows struck through with Undo, and the box says "Saving removes Number of gears from 3 products."; pressing Undo brings it back

#### Scenario: A category can't sit inside its own
- **WHEN** the Owner edits Drivetrain and types in Sits inside
- **THEN** neither Drivetrain nor Drivetrain › Derailleurs is offered

#### Scenario: Adding Bearings by keyboard
- **WHEN** the Owner presses "+ Add a category", types Bearings, and adds Inner diameter, Outer diameter and Height each in mm, pressing Enter in Unit
- **THEN** Save makes Bearings with those three details, and its row lists them, at computer and phone widths with nothing scrolling sideways
