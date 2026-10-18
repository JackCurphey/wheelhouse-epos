## ADDED Requirements

### Requirement: Month view shows each day's first jobs
The diary SHALL offer "Month" beside Week and Day on desktop and tablet (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 1). It SHALL show the weeks that hold the month, Monday to Sunday, with other months' days dimmed, and each day's first three jobs, earliest first, as start time and bike coloured by status, then "+[n] more". The arrows SHALL move a month at a time.

#### Scenario: A busy day
- **WHEN** Tuesday 6 October has jobs at 09:00, 10:00 and 14:00 and one with no time
- **THEN** its day shows 09:00 Cube Attain, 10:00 Trek Domane, 14:00 Giant Escape and "+1 more"

#### Scenario: The next month
- **WHEN** staff press Next month from October 2026
- **THEN** the diary shows "November 2026", from Monday 26 October to Sunday 6 December

### Requirement: A month's day opens its list or the Day view
"+[n] more" SHALL open the day's list: each job's time, bike and job, status, customer and mechanic, and "Open this day in the Day view". A job SHALL open its page, and a day's date SHALL open that day in the Day view. On a touch screen a tap anywhere in a day SHALL open its list, with rows at least 44 pixels tall, and its jobs SHALL NOT be tapped one by one.

#### Scenario: The day's list
- **WHEN** staff press "+1 more" on Tuesday 6 October
- **THEN** a list titled "Tuesday 6 October" shows all four jobs, and its last line opens that day in the Day view

#### Scenario: A tablet
- **WHEN** staff on a tablet tap anywhere in Thursday 8 October
- **THEN** that day's list opens

### Requirement: A phone chooses a day from the month
On a phone the week label SHALL open "Choose a day", the month with each day's number of jobs, and a tap on a day SHALL go to that day.

#### Scenario: Choosing a day
- **WHEN** staff tap the week label and then Monday 5 October, which has one job
- **THEN** the diary shows Monday 5 October

## MODIFIED Requirements

### Requirement: Shared queue shows only the jobs no mechanic has yet
The diary SHALL offer "Shared queue" after the mechanics: a button on desktop and tablet, and the last line of the phone's "whose jobs" list (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 5). Picked, the diary SHALL show only the jobs with no mechanic. The Day view SHALL be one column of them, named "Shared queue", and the choice SHALL be kept in the address as `?who=shared`. With Week, Day and Month and four people buttons, the toolbar SHALL stay one row on a screen 1366 pixels wide; on a narrower screen the people buttons and New job SHALL move to a second row, as on a tablet (Jack, 18 Oct, when Month was added).

#### Scenario: The week
- **WHEN** staff pick Shared queue in a week where Sam Reed's Specialized Sirrus has no mechanic and Maya Patel's Trek Domane is Alex Morgan's
- **THEN** the Specialized Sirrus shows and the Trek Domane does not

#### Scenario: The Day view
- **WHEN** staff open the Day view with Shared queue picked
- **THEN** there is one column, named "Shared queue", and no column for each mechanic

#### Scenario: A phone
- **WHEN** staff open the phone's "whose jobs" list
- **THEN** its last line is "Shared queue", and picking it shows only the jobs with no mechanic

#### Scenario: A 1366-pixel screen
- **WHEN** the diary is open on a screen 1366 pixels wide
- **THEN** the view switch, the dates, Everyone, each mechanic, Shared queue and New job sit on one row

#### Scenario: A 1280-pixel screen
- **WHEN** the diary is open on a screen 1280 pixels wide with two mechanics
- **THEN** the people buttons and New job sit on a second row, under the view switch and the dates, and nothing scrolls sideways
