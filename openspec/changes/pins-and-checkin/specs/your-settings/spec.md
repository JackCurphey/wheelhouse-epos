# Spec Delta

## ADDED Requirements

### Requirement: Each person's Till PIN in Your settings
Your settings SHALL have a Till block (signing in 6; `your-settings`, `yourSettingsDialog`): with a PIN, "Till PIN", "••••", "Checks you in at the till and puts your name on sales and workshop work. Only you know it." and "Change PIN"; without one, "No PIN yet", "You need one to check in at the till. Wheelhouse picks it, and only you see it." and "Get your PIN".

#### Scenario: Changing a PIN
- **WHEN** Jo Taylor presses Change PIN
- **THEN** "Your new till PIN" shows four digits Wheelhouse picked, with Keep this PIN and Give me a different one

#### Scenario: No PIN yet
- **WHEN** Jo Taylor has no PIN and presses Get your PIN
- **THEN** "Your till PIN" shows four digits, with Keep this PIN, Give me a different one and Skip for now
