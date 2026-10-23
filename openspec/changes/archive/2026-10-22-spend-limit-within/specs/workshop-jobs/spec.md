## ADDED Requirements

### Requirement: Work within the customer's spending limit is agreed without a quote
When the customer set a spending limit and the whole bill with the extra work stays within it, staff SHALL be able to agree the work without sending a quote; it SHALL join the job and the customer SHALL be told (Workshop day 41–43). Over the limit, or with no limit, a quote SHALL be needed.

#### Scenario: Within £200
- **WHEN** Maya set £200, her service is £65 and staff add pads and fitting for £46
- **THEN** the work is agreed, joins the job, and Maya is sent "Work added within your limit"

#### Scenario: Over the limit
- **WHEN** Maya set £100 and the same work takes the whole bill to £111
- **THEN** it is refused with "That takes the whole bill to £111.00, over the £100 limit. Send a quote instead.", and nothing changes
