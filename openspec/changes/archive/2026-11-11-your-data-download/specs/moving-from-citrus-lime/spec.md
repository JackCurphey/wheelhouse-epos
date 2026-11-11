## ADDED Requirements

### Requirement: See them opens the rows left out
When "Everything’s sorted" shows rows left out, its Left out line SHALL offer See them, opening Settings › Office › Your data with Download everything unfolded (`mockup/links/j09.mjs:46`), and its sentence SHALL read "Everything that fitted is in. The ones you left out are listed under Settings › Office › Your data, to add by hand when you like." (`moving.mjs:127`).

#### Scenario: Two rows left out, See them
- **WHEN** the Owner left out two rows and presses See them on Everything's sorted
- **THEN** Settings › Office › Your data opens with Download everything unfolded, showing "Left out from Citrus Lime · 2 rows", and the download holds both rows with why each needed a look

#### Scenario: Nothing left out
- **WHEN** every row was fixed and none left out
- **THEN** Everything's sorted shows no See them, and Your data shows no fifth row and the zip no fifth file

#### Scenario: A left-out row whose customer was then deleted
- **WHEN** a row left out holds a customer's own details and that customer's details are then deleted
- **THEN** the row goes at the deletion, so it is not in "Left out from Citrus Lime.csv"; a row only sharing their email or phone stays, with its reason, and is listed

### Requirement: The left-out rows come in the download
While any rows are left out, the download SHALL hold "Left out from Citrus Lime.csv", one row per row left out with the file it came from, why it needed a look and Citrus Lime's own columns in Citrus Lime's order, and the fold SHALL show a fifth row "Left out from Citrus Lime · [n] rows" (answer 1). A row that went when its customer's details were deleted SHALL NOT appear.

#### Scenario: Rows left out in the download
- **WHEN** two rows were left out and the Owner downloads everything
- **THEN** "Left out from Citrus Lime.csv" holds both, each with why it needed a look
