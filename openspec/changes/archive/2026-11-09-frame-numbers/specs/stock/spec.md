## ADDED Requirements

### Requirement: A bike's page lists its frame numbers
A bike's page SHALL show "Bikes by frame number" with each frame in stock, "Frame [frame number]", In stock, "Booked in [date] from [Supplier]" (`st-product-bike`). Its history's received line SHALL read "Received · delivery from [Supplier]" with how many frame numbers came in, and open the delivery.

#### Scenario: A bike with two in stock
- **WHEN** staff open a bike with two frames booked in from [Supplier]
- **THEN** both frames are listed, each In stock, and the history says "Received · delivery from [Supplier]" and "2 frame numbers"

### Requirement: Stock says how many bikes by frame number
A bike's line on Stock SHALL read "[Category] · [n] bikes, each by frame number", [n] the frames in stock (`st-list`).

#### Scenario: Two bikes
- **WHEN** a bike has two frames in stock
- **THEN** its line on Stock reads "[Category] · 2 bikes, each by frame number"

### Requirement: A frame is ready to be sold
Each frame SHALL keep room for when it is sold, the customer it is sold to and the customer's bike it becomes, so the till can sell a bike by its frame and the warranty can start from the right bike.

#### Scenario: Nothing sold yet
- **WHEN** a frame is booked in
- **THEN** it is In stock, with no sale, customer or customer's bike
