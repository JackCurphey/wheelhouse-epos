## MODIFIED Requirements

### Requirement: Staff can open a job's menu, summary and overview from the diary
Right-clicking a job, a press and hold on a touch screen, or the Menu key or Shift+F10, SHALL open "Job actions" with Open job and View overview, or on a booking request "Accept or decline" (opening its request pop-up, Jack, 18 Oct) and View overview; holding the right mouse button SHALL open the overview straight away. Resting the mouse on a job for about 0.6 seconds (at once when motion is reduced) SHALL show its summary. The summary and View overview SHALL show the job, customer and bike, the notes, the work and parts, and the cost.

#### Scenario: View overview
- **WHEN** staff right-click Maya Patel's Trek Domane AL 3 (WH-1042, Standard service) and choose View overview
- **THEN** it shows "Maya Patel · Trek Domane AL 3", her note "My rear brake squeals and feels weak. The gears could use a tune-up too.", the work and parts on the order (Standard service, Shimano brake pads, Fit & adjust brakes) and their cost, £111.00, with the quote line she declined, Replace gear cable, struck through

#### Scenario: Nothing on the order yet
- **WHEN** staff view the overview of a job with nothing on its order
- **THEN** it says "No work or parts yet." and £0.00

#### Scenario: From the keyboard
- **WHEN** staff press Shift+F10 on a job, move with the arrow keys and press Escape
- **THEN** the menu opens on Open job, moves to View overview, closes, and focus returns to the job

#### Scenario: A booking request
- **WHEN** staff right-click Sam Reed's booking request and choose "Accept or decline"
- **THEN** its request pop-up opens, with Accept
