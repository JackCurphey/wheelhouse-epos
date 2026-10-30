## MODIFIED Requirements

### Requirement: A customer downloads a copy of their data
A signed-in customer SHALL be able to download, straight away, one zip file of what the shop holds about them: their details, bikes, repairs, purchases, messages and what they agreed to, each as a spreadsheet (CSV). It SHALL hold only their own data, never another customer's or another shop's. A request that isn't signed in to that shop, or comes from another website, SHALL be refused.

#### Scenario: Maya downloads her data
- **WHEN** Maya Patel, signed in to North Street Cycles, presses "Download a copy of your data"
- **THEN** a zip downloads with her details, her Trek Domane AL 3, her repairs, her purchases, her messages with the shop and her answers on how she's contacted

#### Scenario: Someone else's data
- **WHEN** another customer of the same shop downloads their copy
- **THEN** nothing of Maya's is in it

#### Scenario: Too many at once
- **WHEN** Maya asks for another copy later the same day
- **THEN** it is refused, as "One copy a day" says

#### Scenario: Not signed in
- **WHEN** the download is asked for without signing in, or signed in to another shop
- **THEN** it is refused and nothing is logged

## ADDED Requirements

### Requirement: One copy a day
Each sign-in SHALL be able to download one copy of its data a day, the shop's day from midnight in its time zone, counted from the privacy requests log. A second that day SHALL be refused with "You’ve already downloaded a copy today. You can get another tomorrow." before anything is logged; two at the same moment SHALL let only one through. The account SHALL show the refusal in those words with no Try again, and "Not started? Download it again" SHALL save the same file without asking the shop.

#### Scenario: A second copy the same day
- **WHEN** Maya asks for another copy later the same day
- **THEN** it is refused with "You’ve already downloaded a copy today. You can get another tomorrow.", nothing is logged, and the account shows those words with no Try again

#### Scenario: The next day
- **WHEN** Maya asks again just after midnight in the shop's time zone
- **THEN** she gets a copy

#### Scenario: Two at once
- **WHEN** two requests from Maya's sign-in arrive at the same moment
- **THEN** one gets the copy and one is refused, and one copy is logged

#### Scenario: Download it again
- **WHEN** Maya presses "Not started? Download it again"
- **THEN** the same file saves again and the shop isn't asked, so it doesn't use up her day
