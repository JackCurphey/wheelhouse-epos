## ADDED Requirements

### Requirement: Quote lines that go together are answered together
On the customer's quote, a labour line that goes with a part SHALL tick and untick with it (Jack, 1 Oct, decision 2), and the server SHALL refuse an answer that says yes to one and no to the other. An unticked Needed line SHALL show the mechanic's words on what happens without it, when the shop wrote some (decision 7).

#### Scenario: Unticking the part
- **WHEN** Maya unticks Shimano brake pads, which Fit and adjust brakes goes with
- **THEN** Fit and adjust brakes is unticked too, the total drops by both, and a screen reader hears "Fit and adjust brakes unticked too."

#### Scenario: What happens without it
- **WHEN** Maya unticks Shimano brake pads, whose without words are "The rear brake stays worn."
- **THEN** the card shows "We recommend this. The rear brake stays worn." under it

#### Scenario: A split answer
- **WHEN** an answer says yes to the pads and no to the fitting
- **THEN** it is refused and nothing is saved
