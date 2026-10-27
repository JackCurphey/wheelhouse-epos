# Spec Delta

## MODIFIED Requirements

### Requirement: An order shows what has arrived and can be closed
An order's page SHALL show its supplier, when it was ordered, its status, each line's ordered and arrived counts with "All arrived", "[n] to come" or, once the order is closed, "[n] not coming", and the total cost the server gives. While an order is a draft, ordered or partly delivered, the Owner SHALL be able to close it after confirming. Closing an order nothing has arrived from cancels it. Closing a partly delivered order SHALL keep everything that arrived in stock, on the product's stock history and in each line's arrived count, and SHALL mark the rest as not coming: the closed order has nothing still to come and leaves the Orders list. Either way the order shows as "Closed".

#### Scenario: closing an order nothing has arrived from
- **WHEN** the Owner presses "Close the order" and then "Close the order" in the box
- **THEN** the order is cancelled and leaves the Orders list

#### Scenario: closing an order that has partly arrived
- **WHEN** an order for 3 Shimano brake pads B05S-RX has had 1 booked in, and the Owner presses "Close the order" and then "Close the order" in the box
- **THEN** the order shows "Closed", the line says "ordered 3 · arrived 1" and "2 not coming", the 1 that arrived stays in stock, and the order leaves the Orders list

#### Scenario: keeping it open
- **WHEN** the Owner presses "Close the order" and then "Keep it open"
- **THEN** nothing changes

## ADDED Requirements

### Requirement: A closed order can't be received against
Booking a delivery in SHALL refuse a line on a closed or cancelled order with "This purchase order is not awaiting delivery", adding nothing to stock. Receive a delivery SHALL leave a closed order out of what is still to come, and opened for a closed order it SHALL say "This order is all in.".

#### Scenario: booking in on a closed order
- **WHEN** someone books in a line of an order the Owner has closed
- **THEN** it is refused and stock is unchanged

### Requirement: Closing and booking in at the same moment
A close made while a delivery to the same order is being booked in SHALL wait for the booking, then close the order with what that booking brought in kept as arrived. A booking made while a close is being written SHALL wait for it, then be refused, adding nothing to stock.

#### Scenario: a close lands during a booking
- **WHEN** the Owner closes an ordered order while 1 of its 3 is being booked in
- **THEN** the order is closed with 1 arrived and 2 not coming, and the 1 stays in stock

#### Scenario: a booking lands during a close
- **WHEN** a delivery to an order is booked in while the Owner's close is being written
- **THEN** the booking is refused and stock is unchanged
