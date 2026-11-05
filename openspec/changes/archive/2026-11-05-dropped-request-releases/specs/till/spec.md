# Spec Delta

## ADDED Requirements

### Requirement: A till or browser that drops off never holds up the shops
When a client goes away before the server has read its whole request, the server SHALL let go of whatever that request was holding, undo anything it had started, and go on answering every other request, for every shop. It SHALL NOT record this as a fault or try to answer the client that has gone.

#### Scenario: A till loses its connection while syncing
- **WHEN** a till's sync, or a request from a signed-in member of staff, is lost as it arrives, many times over
- **THEN** every other till and member of staff, at every shop, is answered as normal, and the server's log has no error for the lost requests

#### Scenario: A Citrus Lime file is lost as it arrives
- **WHEN** the connection is lost while a shop is sending a Citrus Lime file
- **THEN** the shop can send a file again straight away, rather than being told another file is still going
