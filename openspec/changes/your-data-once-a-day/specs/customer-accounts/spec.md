## MODIFIED Requirements

### Requirement: A customer downloads a copy of their data
A signed-in customer SHALL be able to download, straight away, one zip file of what the shop holds about them: their details, bikes, repairs, purchases, messages and what they agreed to, each as a spreadsheet (CSV). It SHALL hold only their own data, never another customer's or another shop's. A request that isn't signed in to that shop, or comes from another website, SHALL be refused. Each sign-in SHALL be able to download one copy a day, the shop's day from midnight in its time zone, counted from the log; a second that day SHALL be refused before anything is logged, and two at the same moment SHALL let only one through.

#### Scenario: Maya downloads her data
- **WHEN** Maya Patel, signed in to North Street Cycles, presses "Download a copy of your data"
- **THEN** a zip downloads with her details, her Trek Domane AL 3, her repairs, her purchases, her messages with the shop and her answers on how she's contacted

#### Scenario: Someone else's data
- **WHEN** another customer of the same shop downloads their copy
- **THEN** nothing of Maya's is in it

#### Scenario: Too many at once
- **WHEN** Maya asks for another copy later the same day
- **THEN** it is refused with "You’ve already downloaded a copy today. You can get another tomorrow." and nothing is logged

#### Scenario: The next day
- **WHEN** Maya asks again just after midnight in the shop's time zone
- **THEN** she gets a copy

#### Scenario: Not signed in
- **WHEN** the download is asked for without signing in, or signed in to another shop
- **THEN** it is refused and nothing is logged

### Requirement: The Your data card
The account SHALL show a "Your data" card under History (last on a phone) with "Download a copy of your data". Once the download starts, the account SHALL say "Your data is downloading as one file, [file name] — details, bikes, jobs, purchases, messages and what you agreed to." with "Not started? Download it again", which saves the same file again without asking the shop. If it fails, it SHALL say "The download didn’t start." with Try again. If the shop refuses it as already taken today, it SHALL say so in the shop's words, with no Try again.

#### Scenario: It downloads
- **WHEN** Maya presses "Download a copy of your data"
- **THEN** the green bar names the file and offers "Not started? Download it again"

#### Scenario: It fails
- **WHEN** the download can't be made
- **THEN** "The download didn’t start." shows with Try again

#### Scenario: Already taken today
- **WHEN** Maya presses it again the same day, after leaving the account
- **THEN** "You’ve already downloaded a copy today. You can get another tomorrow." shows, with no Try again
