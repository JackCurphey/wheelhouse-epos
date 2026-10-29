## ADDED Requirements

### Requirement: A customer downloads a copy of their data
A signed-in customer SHALL be able to download, straight away, one zip file of what the shop holds about them: their details, bikes, repairs, purchases, messages and what they agreed to, each as a spreadsheet (CSV). It SHALL hold only their own data, never another customer's or another shop's. A request that isn't signed in to that shop, or comes from another website, SHALL be refused.

#### Scenario: Maya downloads her data
- **WHEN** Maya Patel, signed in to North Street Cycles, presses "Download a copy of your data"
- **THEN** a zip downloads with her details, her Trek Domane AL 3, her repairs, her purchases, her messages with the shop and her answers on how she's contacted

#### Scenario: Someone else's data
- **WHEN** another customer of the same shop downloads their copy
- **THEN** nothing of Maya's is in it

#### Scenario: Not signed in
- **WHEN** the download is asked for without signing in, or signed in to another shop
- **THEN** it is refused and nothing is logged

### Requirement: Each copy is logged
Each copy downloaded from the account SHALL be recorded as a privacy request from the account, asked and done at the same moment, before the file is sent. A merge of two customers SHALL move the record with the customer, and its Undo SHALL move it back.

#### Scenario: The log
- **WHEN** Maya downloads her copy
- **THEN** a privacy request for a copy of her data, from her account, asked and done now, is recorded for North Street Cycles

### Requirement: The Your data card
The account SHALL show a "Your data" card under History (last on a phone) with "Download a copy of your data". Once the download starts, the account SHALL say "Your data is downloading as one file, [file name] — details, bikes, jobs, purchases, messages and what you agreed to." with "Not started? Download it again". If it fails, it SHALL say "The download didn’t start." with Try again.

#### Scenario: It downloads
- **WHEN** Maya presses "Download a copy of your data"
- **THEN** the green bar names the file and offers "Not started? Download it again"

#### Scenario: It fails
- **WHEN** the download can't be made
- **THEN** "The download didn’t start." shows with Try again
