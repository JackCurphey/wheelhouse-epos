## ADDED Requirements

### Requirement: The diary's legend is a box above Waiting for you

On a screen 1024px wide or more, the diary's legend SHALL be a box headed "Legend" at the top of the left-hand column, above "Waiting for you", listing each colour on its own line. On a narrower screen it SHALL sit under the toolbar. A person who has switched off "Show the diary legend" SHALL see no legend.

#### Scenario: on a computer
- **WHEN** Jo opens the diary on a computer
- **THEN** a box headed "Legend" lists the seven colours above "Waiting for you"

#### Scenario: switched off
- **WHEN** Jo has switched off "Show the diary legend"
- **THEN** the diary has no legend
