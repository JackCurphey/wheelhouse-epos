## ADDED Requirements

### Requirement: On a tablet or phone the quote's answer stays pinned at the bottom

While a quote waits for the customer's answer on a tablet or phone, the booking page SHALL keep a bar pinned along the bottom holding the new total, "Your answers are final once sent." and the one send button, and the quote itself SHALL NOT repeat that line or button. On a computer they SHALL stay in the quote. Sending SHALL stay one click with no confirming pop-up.

#### Scenario: Maya opens her quote on her phone

- **WHEN** Maya opens her booking page on her phone and the quote for Shimano brake pads, Fit & adjust brakes and Replace gear cable waits for her answer
- **THEN** a bar along the bottom shows "New total £111.00", "Your answers are final once sent." and "Approve £111.00", and stays in view as she scrolls

#### Scenario: Unticking lines changes the bar

- **WHEN** Maya unticks Shimano brake pads, and Fit & adjust brakes goes with it
- **THEN** the bar's total becomes £65.00 and its button reads "Decline the extra work"

#### Scenario: One tap sends

- **WHEN** Maya taps the bar's button
- **THEN** her answers are sent at once, with no "Send your answers?" pop-up

#### Scenario: On a computer the button stays in the quote

- **WHEN** Maya opens the same quote on a computer
- **THEN** "Your answers are final once sent." and the button sit inside the quote, and no bar is pinned

#### Scenario: The bar covers nothing

- **WHEN** Maya scrolls to the bottom of her booking page on a 320-pixel-wide phone
- **THEN** the last thing on the page sits above the bar, not under it

#### Scenario: No bar once answered

- **WHEN** the quote has been answered or withdrawn
- **THEN** no bar is pinned
