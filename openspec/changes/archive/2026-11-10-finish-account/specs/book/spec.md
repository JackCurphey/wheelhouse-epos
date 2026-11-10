# Spec Delta

## ADDED Requirements

### Requirement: A service reminder's link opens the booking with the bike and service chosen
The link in a service reminder SHALL open Book a repair on "When?", with the reminder's service and bike chosen and the box "From your reminder: booking the next [service] for your [bike]. Change either above." (`ac-reminder-landing`; account and reminders decision 2).

#### Scenario: Maya's reminder
- **WHEN** Maya follows the link in her Standard service reminder for her Trek
- **THEN** Book a repair opens on "When?" saying "From your reminder: booking the next Standard service for your Trek Domane AL 3 · green · black mudguards", with "Maya P. · 07700 ••• 142 · Change"

### Requirement: A reminder's link fills in the customer's details without signing them in
The box SHALL add "Your details are filled in from your reminder: [first name and initial] · [mobile with its middle hidden] · Change". The link SHALL NOT sign the customer in or show more of their details. Booking from it SHALL use the customer's own record's details unless they choose Change and type their own.

#### Scenario: what it shows
- **WHEN** Maya's reminder link is opened
- **THEN** it shows "Maya P. · 07700 ••• 142 · Change" and nothing else of hers

#### Scenario: booking from it
- **WHEN** she picks a time and books without changing her details
- **THEN** the booking is made for Maya Patel's own record, as a signed-in booking is

#### Scenario: Change
- **WHEN** she chooses Change by her details
- **THEN** the filled details are cleared and the details step asks for them

### Requirement: A reminder's link that can't fill everything opens the first step still needed
When the reminder's service is no longer booked online, the link SHALL open with the bike chosen at the service step; when the bike has been removed, with the service chosen at the bike step; when the link doesn't work, Book a repair as for anyone.

#### Scenario: the service is gone
- **WHEN** the shop has stopped online booking for the reminder's service
- **THEN** the link opens at the service step with Maya's Trek chosen
