# Spec Delta

## ADDED Requirements

### Requirement: The shop lists its services in Settings, by group
Settings › Workshop SHALL have a Services fold, first, with the summary "Full service, Individual service". It SHALL show the pills "Full service" and "Individual service" and, for the one chosen, each of that group's services with its name, "[n] min in the diary" and its price, and Edit and Remove; then "+ Add a service" and "Groups and services show as pills, in this order, when a job is booked." (`set-workshop-services`). Removed services SHALL NOT be listed.

#### Scenario: Individual services
- **WHEN** the Owner chooses Individual service
- **THEN** Safety check, Gear adjustment and Brake service are listed, each with its time in the diary and its price

### Requirement: The Owner changes a service in its box
Edit SHALL open the service's box (`ac-service-edit`): its name as the title, with "[Group] · [n] min in the diary · [£ price]"; Name; Group, Full service or Individual service; Time in the diary in minutes; Price; "Customers can book this online"; Cancel and Save. Save SHALL write the service, keeping anything the box doesn't show, and a refusal SHALL show the shop's words in the box.

#### Scenario: A new price
- **WHEN** the Owner changes Standard service's time to 90 minutes and saves
- **THEN** the list shows "90 min in the diary"

### Requirement: The Owner adds a service
"+ Add a service" SHALL open the same box empty, titled "New service", in the group chosen, with "Customers can book this online" on.

#### Scenario: Adding a service
- **WHEN** the Owner adds a service under Individual service
- **THEN** it is listed under Individual service and customers can book it online

### Requirement: The Owner removes a service
Remove SHALL take a service out of the list and out of booking, keeping it on past jobs.

#### Scenario: Removing a service
- **WHEN** the Owner removes Brake service
- **THEN** it leaves the list, and new bookings can't choose it
