# Proposal: Settings › Workshop › Services, the list and the service box

## Why

The shop's services can't be changed in the new app; they are set only
through the server. Settings › Workshop › Services is drawn and agreed:
- `set-workshop-services`, `setup.mjs:305-319`;
- `ac-services` and `ac-service-edit`, `account.mjs:205-215`.

It is where a service's name, group, time and price are set. It is also
where the next piece of service reminders goes: "Remind customers it’s due
after [n] months", from account and reminders decision 2.

Workshop day 66 says shops group their own services. Book a repair 11 says
which services can be booked stays on each service. The walk-through 4
coverage fix says the box gains "Customers can book this online", on by
default.

This is WP-5.1, and nobody has it in STATUS. Jack's lane. No server change.

## What Changes

- **A Services fold,** first in Workshop, with the summary "Full service,
  Individual service".
- **The list:**
  - the group pills, "Full service" and "Individual service";
  - each of the chosen group's services, with its name, "[n] min in the
    diary" and its price, and Edit and Remove;
  - "+ Add a service";
  - the note "Groups and services show as pills, in this order, when a job
    is booked."
- **The service box:**
  - its title is the service's name, with the line "[Group] · [n] min in
    the diary · [£ price]";
  - Name;
  - Group (Full service or Individual service);
  - Time in the diary, in minutes;
  - Price;
  - "Customers can book this online", on for a new service;
  - Cancel and Save.
- Save writes the service, and New job, Checklists and online booking see it
  at once.
- **Remove retires the service,** as the server already does. It leaves the
  list and can't be booked, and past jobs keep it.

## Capabilities

### Modified Capabilities

- `settings`: the shop's services can be listed, added, changed and removed
  in Settings.

## Out of scope

- **The reminder months.** These need a migration; they are the next piece.
- **"+ Add a group", and moving services up and down.** The groups are the
  two fixed kinds, and the server lists services by name. Neither is drawn
  beyond its button.
- **The deposit line, questions, includes and categories.** They are kept as
  they are when a service is saved.
- **Price at a second site, and the Lightspeed banner.**
