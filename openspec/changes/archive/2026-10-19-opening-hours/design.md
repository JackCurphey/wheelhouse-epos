# Design: opening hours in Settings

## Contract (existing)

`GET /api/workshop-settings` returns `openingHours: [{ weekday, open, close }]` for the open days (0 is Sunday); `PUT` with `openingHours` replaces them. Times are on the hour ("Opening hours must be on the hour (e.g. 09:00)"); closing must be after opening.

## Screen

An "Opening hours" box under Shop details: a row per day, Monday first, with the day, an Open/Closed button, and for an open day two hour pickers ("[Day] opens", "[Day] closes"), whole hours only, as the server and the diary need. Turning a day on starts it at the shop's usual hours (`openingTime`/`closingTime`). Each change sends the whole week; a change made while a save is on its way is sent next; the reply replaces the cached settings; a refusal shows its words and the week goes back as it was. The Open/Closed button keeps the name "[Day] open" and shows its state as pressed or not, drawn as the settings pages' `offer` button. On a phone the day and the button share a line, with the times underneath. The drawn note's second sentence, "Online booking only offers mechanics on the days they’re in, set on each person.", shows under the rows (the first is about End of day, not built).
