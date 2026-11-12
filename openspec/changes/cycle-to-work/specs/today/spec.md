## ADDED Requirements

### Requirement: Today shows Cycle to Work orders that are stuck
Needs attention SHALL show "[Customer] · Cycle to Work quote, no certificate yet" with "Hold longer" and "Open the order" when a hold nears its end; "…hold ended [date] — choose" with "Hold longer" and "Release the bike"; and "[Provider] payment is [n] days late" with "Open the order". Until roles are built, only Owners see them.

#### Scenario: A late payment on Today
- **WHEN** a provider's payment is past its expected date
- **THEN** the Owner's Today shows "[Provider] payment is [n] days late"

### Requirement: Today shows a deposit to refund
Needs attention SHALL show "Deposit to refund · [Customer]" with "Refund the deposit" when a Cycle to Work deposit is due back.

#### Scenario: The certificate arrives with refund chosen
- **WHEN** the setting is "Refund the deposit" and the certificate is added
- **THEN** Today shows "Deposit to refund · Maya Patel"
