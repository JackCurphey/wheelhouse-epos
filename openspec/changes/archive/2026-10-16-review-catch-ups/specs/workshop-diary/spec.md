## ADDED Requirements

### Requirement: A chosen Waiting card says how to open it
Once a card in "Waiting for you" is chosen on a computer or tablet, a note under the cards SHALL say "Double-click a card to open it.", or "Tap the card again to open it." when the card was chosen by a tap (drawn on diary; decision 14).

#### Scenario: Choosing with a mouse
- **WHEN** staff click Lena Fox's card
- **THEN** the note reads "Double-click a card to open it."

#### Scenario: Choosing with a tap
- **WHEN** staff tap Lena Fox's card
- **THEN** the note reads "Tap the card again to open it."

### Requirement: The diary is finger-sized on a touch screen
On a touch screen, the Week and Day buttons and a chosen Waiting card's Open button SHALL be at least 44 pixels tall, and the Waiting cards' words SHALL be larger, as drawn for the tablet.

#### Scenario: A tablet
- **WHEN** the diary is opened on a tablet
- **THEN** Week and Day are at least 44 pixels tall

### Requirement: A change request can open the full job
The change request pop-up SHALL offer "Open full job" beside Decline, which closes the pop-up and opens the job page (drawn on request-change).

#### Scenario: Opening Oliver Chen's job
- **WHEN** staff open Oliver Chen's change request and press "Open full job"
- **THEN** the request closes and the job page for his Full service opens
