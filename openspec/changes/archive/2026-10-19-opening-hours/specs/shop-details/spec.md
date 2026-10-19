## ADDED Requirements

### Requirement: A shop sets its opening hours in Settings
Settings › Shop and sites › Opening hours SHALL show Monday to Sunday, each Open or Closed, an open day with its opening and closing times on the hour (`set-shop-hours`; Jack, 19 Oct). Each change SHALL save at once; a refusal SHALL be shown in plain words and the hours left as they were. They are one set for the whole business until shops have sites.

#### Scenario: Closing on Sundays
- **WHEN** the owner switches Sunday to Closed
- **THEN** it saves, and the diary and online booking treat Sunday as closed

#### Scenario: A shorter Saturday
- **WHEN** the owner sets Saturday to close at 16:00
- **THEN** it saves Saturday's own hours and leaves the other days as they were
