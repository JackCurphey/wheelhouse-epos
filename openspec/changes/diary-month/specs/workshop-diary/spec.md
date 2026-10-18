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
