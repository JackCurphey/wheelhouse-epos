## MODIFIED Requirements

### Requirement: New job starts by choosing a time on the diary
New job SHALL turn the diary to "Choose a time for the new job.", with "Enter a time instead" and Cancel. A click on the grid SHALL open the New job form at that time, snapped to 15 minutes, with no date or time box; Cancel SHALL leave the diary as it was. "Enter a time instead" SHALL open the form with a Date box and a Start time box in place of the time, filled with the diary's date and the grid's first hour, and the job SHALL be saved at what they hold; with either box empty, Save job SHALL say "Choose a date and a start time.", and with a start time off the quarter hour "Choose a start time on the quarter hour, like 14:30 or 14:45.", and keep the form open (Jack, 15 Oct). Opened this way, the Date box SHALL have the focus. A job that would run past midnight SHALL be refused with "The job would run past midnight. Choose an earlier start time." In the Day view the clicked column's mechanic SHALL be chosen, or Shared queue in the "Not assigned yet" column. Otherwise the form SHALL choose a mechanic as the next requirement says.

#### Scenario: Clicking Tuesday at 10:00
- **WHEN** staff press New job and click Tuesday 6 October at 10:00, where Alex Morgan already has a job and Jo Taylor has none
- **THEN** the form opens reading "Tue 6 Oct · 10:00 · Jo Taylor" with Jo Taylor chosen, and no date or time box

#### Scenario: Cancel
- **WHEN** staff press New job and then Cancel
- **THEN** the New job button returns and no form opens

#### Scenario: Enter a time instead
- **WHEN** staff press "Enter a time instead" in the Week view
- **THEN** the form opens with Date and Start time boxes holding the date in the page address and the grid's first hour

#### Scenario: Changing the time entered
- **WHEN** staff open the form by "Enter a time instead", change Start time to 14:30 and the date to Thursday, and save
- **THEN** the job is created on that Thursday from 14:30

### Requirement: New job chooses the mechanic with the fewest timed minutes
Outside a mechanic's own column, New job SHALL choose, among the mechanics whose working days include that weekday, the one with the fewest minutes of timed jobs on that day in the diary, counting cancelled, declined and expired bookings too; on a tie, the first in the list. If nobody works that weekday, it SHALL choose from everyone. The form SHALL say "Mechanic chosen automatically: most free time on [weekday]." until staff pick a mechanic themselves. When the Date box changes, the form SHALL choose again for the new day, unless staff have picked one; it counts only the jobs the diary has loaded, so for a day outside the week shown it chooses the first mechanic working that weekday.

#### Scenario: Jo Taylor has nothing booked
- **WHEN** both mechanics work Tuesdays and only Alex Morgan has a timed job on Tuesday 6 October
- **THEN** Jo Taylor is chosen

#### Scenario: A new date entered
- **WHEN** the form opened by "Enter a time instead" on Monday 5 October has Alex Morgan chosen, and staff change the date to Tuesday 6 October
- **THEN** Jo Taylor is chosen, and the form says "Mechanic chosen automatically: most free time on Tuesday."
