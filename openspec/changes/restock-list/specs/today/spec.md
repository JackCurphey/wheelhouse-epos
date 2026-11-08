## ADDED Requirements

### Requirement: New on the restock list goes to Needs attention
When products have come onto the restock list since the Owner last opened it, the Owner's Needs attention SHALL show "[n] new products running low, selling fast or for customers" and "Since the restock list was last opened · [n] for jobs or online orders", with Open, which opens the restock list (`rs-today-restock`). Opening the list, or downloading from it, SHALL clear the line until something new comes onto it. Each person's "last opened" SHALL be their own. Only the Owner SHALL see the line, until roles.

#### Scenario: Two new since last time
- **WHEN** two products have come onto the restock list since Jack Lewis last opened it, one for job WH-1042
- **THEN** Needs attention shows "2 new products running low, selling fast or for customers" and "Since the restock list was last opened · 1 for jobs or online orders", with Open

#### Scenario: Opened
- **WHEN** Jack Lewis opens the restock list
- **THEN** the line goes from Today until another product comes onto the list

#### Scenario: Nothing new
- **WHEN** nothing has come onto the list since it was last opened
- **THEN** there is no restock line
