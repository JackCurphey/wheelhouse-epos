## ADDED Requirements

### Requirement: The Workshop Overview shows today's work at a glance
The Overview page SHALL show:
- today's date;
- how many bikes are expected today, and how many are still to arrive;
- how many bikes are in the workshop, and how many are ready to collect;
- four tabs with counts: Arrivals, Shared queue, Needs attention and Ready. Each tab lists its jobs, sorted by time.

#### Scenario: The day's figures
- **WHEN** a staff member opens Workshop › Overview
- **THEN** the page counts the live bookings for today, those not yet booked in, the bikes in the shop and those whose work is finished

#### Scenario: Booking in an arrival
- **WHEN** an arrival is due and staff press Book in
- **THEN** the bike is booked in and moves from Arrivals to the bikes in the workshop

#### Scenario: Opening a job
- **WHEN** staff choose a job's number and name
- **THEN** its page opens in the diary

### Requirement: The jobs list can be asked for the bikes in the shop
`GET /api/workshop-jobs` SHALL take `custody` (`in_shop`, `expected` or `collected`). It SHALL return only jobs in that custody, whatever their days, and refuse any other value.

#### Scenario: A ready bike from an earlier day
- **WHEN** the list is asked for `custody=in_shop`
- **THEN** a bike finished and waiting since an earlier day is included
