# Design: the time kept free each day

## Contract (existing)

`GET`/`PUT /api/workshop-settings` carry `fullDayThresholdMinutes`, an integer from 0 to 480 (the server's refusal otherwise); Owner only to change.

## Screen

A "Workshop" section already holds Mechanics; it gains an "Online booking" box above Mechanics with one row: the label "Time kept free each day", the hint, a number box in hours (0 to 8, in half hours) and "hours", and the note. The box shows the stored minutes ÷ 60. Leaving it saves minutes = hours × 60 if it changed; a value that isn't a half hour from 0 to 8 is refused in the screen ("Enter 0 to 8 hours, in half hours") without saving; a server refusal shows its words.

## The old app

`OFFICE_TABS` › Edit Shop loses its "Workshop" child; `#office/edit-shop/workshop` and `#office/edit-shop` open the new Settings and Front desk respectively; `renderEditWorkshop` and what only it used go.
