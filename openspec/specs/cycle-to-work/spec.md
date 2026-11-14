# cycle-to-work Specification

## Purpose
Cycle to Work orders: the quote, the scheme provider's certificate, ordering, holding and handing over the bike. This file starts with the quote's PDF (message-attachments); the rest arrives when the cycle-to-work change is archived.

## Requirements

### Requirement: The quote goes with its emails as a PDF
The quote email SHALL carry the quote as a PDF named "Quote [quote number].pdf" (`cw-email`, "Attached: Quote [n]"). When the certificate changes the order to match, "Certificate received" SHALL carry the revised quote as a PDF named "Revised quote [quote number].pdf" when it goes by email (`cw-email-certificate-revised`, "Attached: Revised quote [n]"). The PDF SHALL show what the printed quote shows: the shop's name, address, phone and VAT number, "Cycle to Work quote", the quote number, "Given [date]" or "Revised [date]", "Valid until [date]", the customer and scheme provider, the items with prices, "Total (includes VAT)", the closing paragraph and "How to apply:".

#### Scenario: Emailing the quote
- **WHEN** staff press "Email to [Customer]" on the quote
- **THEN** the email queued carries "Quote [quote number].pdf", and the PDF holds the quote's lines and total

#### Scenario: The certificate changes the order to match
- **WHEN** the certificate is recorded with "Change the order to match" and the customer gets emails
- **THEN** "Certificate received" carries "Revised quote [quote number].pdf", saying "Revised [date]"

#### Scenario: The certificate matches the order
- **WHEN** the certificate is recorded and the order isn't changed
- **THEN** "Certificate received" carries no attachment

#### Scenario: No logo is invented
- **WHEN** the shop has no logo, or its logo is a kind the PDF can't hold
- **THEN** the PDF has no logo and no placeholder mark in its place
