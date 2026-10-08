## MODIFIED Requirements

### Requirement: Saving a new job
Save job SHALL create the job with what the form holds and, when work was chosen, its planned length; with no work chosen the job SHALL be an hour long. A title SHALL be needed, and a customer unless it is a new bike build. If the server refuses, the form SHALL show its words and stay open. "The bike is here now" SHALL book the bike in straight after saving, unless the job was created with the bike already in the shop; if that book-in is refused, the job SHALL already be saved and the form SHALL show the refusal and stay open.

#### Scenario: Maya Patel's Standard service
- **WHEN** staff find "Maya", choose Maya Patel, choose "Standard service · 90 min" and save
- **THEN** a job is created for Maya Patel's Trek Domane AL 3 on Tuesday 6 October from 10:00 to 11:30 with Jo Taylor, booked, with a planned length of 90 minutes

#### Scenario: The bike is here now
- **WHEN** staff turn on "The bike is here now" and save with the starting status Booked
- **THEN** the job is created and then booked in

#### Scenario: The bike is here now, waiting for parts
- **WHEN** staff turn on "The bike is here now" and save with the starting status Waiting for parts
- **THEN** the job is created with the bike already in the shop, no book-in is sent, and the form closes

#### Scenario: No customer
- **WHEN** staff save a job titled "PDI" with no customer and New bike build off
- **THEN** the form says "Give the job a title, and choose a customer or turn on New bike build."

### Requirement: The change request pop-up shows from and to
A change request SHALL open in a pop-up headed "Change request", with the customer and bike, From and To as day, time and mechanic ("Shared queue" when there is none), and the sentence "The customer asked to move this booking. Accepting keeps the same work.", with Accept and Decline, each sent with the version the pop-up saw. Accepting SHALL move the booking to the To side's day, time and mechanic.

#### Scenario: Oliver Chen's change
- **WHEN** staff open Oliver Chen's request to move from Monday 5 October at 10:00 with Sam to 14:00 with Alex Morgan
- **THEN** the pop-up shows "Mon 5 Oct · 10:00 · Sam" and "Mon 5 Oct · 14:00 · Alex Morgan", and Accept accepts the change

#### Scenario: A request for another mechanic
- **WHEN** a booking with Sam asks to move to Alex and staff accept it from the pop-up
- **THEN** the booking moves to Alex, as the pop-up's To side said

### Requirement: Dropping a job on the customer's requested time accepts the change
When a job with a customer's change request waiting is saved onto exactly the requested day, start time and mechanic, the change SHALL be accepted, whatever the job's length: the booking is confirmed there, the request cleared and one hold kept, at the new time. In the Week view, or a column for everyone, a drop on exactly the requested day and start time SHALL send the mechanic the customer asked for. Saved anywhere else, the request SHALL stand, with both the job's own time and the requested time held.

#### Scenario: Dropped on the requested start
- **WHEN** a booking at 10:00 whose customer asked for 14:00 on another day is saved to that day at 14:00 to 15:30
- **THEN** it is confirmed at 14:00 to 15:30 and no request remains

#### Scenario: Dropped elsewhere
- **WHEN** the same booking is moved to 12:00 on its own day
- **THEN** it still reads Change requested, held at 12:00 and at the requested 14:00

#### Scenario: Dropped on the outline in the Week view, for another mechanic
- **WHEN** the customer asked to move from Alex Morgan to Jo Taylor and staff drop the job on the dashed outline in the Week view
- **THEN** the move is sent with Jo Taylor as the mechanic, so the change is accepted
