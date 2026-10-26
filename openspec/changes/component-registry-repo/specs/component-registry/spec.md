# Spec Delta

## Purpose

Where Wheelhouse's screen components and its look come from: a separate
repository, `react-repo`, that the app copies from through a pull
request that has to pass every test before it merges.

## ADDED Requirements

### Requirement: Moving the components changes nothing on any screen
The first release of the registry repository, `v1.0.0`, SHALL contain the 15 components the app's own `registry/` holds today, with the same names, dependencies and file contents, plus the tokens file with every value unchanged. Copying it into the app SHALL leave every installed component file unchanged.

#### Scenario: Syncing v1.0.0
- **WHEN** the app syncs registry `v1.0.0`
- **THEN** no file under `src/components/ui/` changes, and every screen looks and behaves as before

#### Scenario: A copied component differs
- **WHEN** a component in the registry repository differs from the app's `public/r/<name>.json` at the recorded commit
- **THEN** the registry's identity test fails naming that component

### Requirement: Every shadcn component is accounted for
Every component in shadcn's own list for style `new-york-v4` SHALL be labelled in the registry as added, covered by a Wheelhouse component, held for a named piece, or left out with a reason. The registry's checks SHALL fail when a component is unlabelled or a labelled one is no longer in shadcn's list.

#### Scenario: shadcn adds a component
- **WHEN** shadcn's list holds a component that `upstream/coverage.json` does not label
- **THEN** the coverage check fails with "Not yet sorted: <name>"

#### Scenario: A component is left out or held
- **WHEN** a component is left out or held (the one-time-code box, the dropdown list)
- **THEN** its label gives the reason and names the decision, drawing or built component behind it, so it can be overruled later

### Requirement: One tokens file sets the look
The colours, fonts, text sizes and corners SHALL come from one file in the registry repository, installed into the app as `src/styles/wheelhouse-tokens.css`. The app SHALL NOT edit that file or redefine its tokens in `theme.css`.

#### Scenario: Someone changes a colour in the app
- **WHEN** a colour in `src/styles/wheelhouse-tokens.css` is edited in the app
- **THEN** CI fails with "Installed component edited by hand"

#### Scenario: theme.css overrides a token
- **WHEN** `src/styles/theme.css` sets a token the tokens file sets
- **THEN** a test fails naming that token

#### Scenario: The old app's copy
- **WHEN** a value in `public/tokens.css` differs from the tokens file
- **THEN** `tests/design-sand.test.js` fails

### Requirement: A shop's colour can be set while the app runs
Setting `--accent`, `--accent-dark` or `--modal-bg` on the page's `<html>` element SHALL recolour everything that uses the shop colour, with no rebuild. Every registry component that uses the shop colour SHALL read those variables directly, so setting them on a wrapping element recolours the registry components inside it too.

#### Scenario: Ocean Blue on the page
- **WHEN** `--accent` is set to `#2f5f96` (Ocean Blue) on `<html>`
- **THEN** a button in its accent look, and anything coloured with shadcn's `bg-primary`, is `rgb(47, 95, 150)`

#### Scenario: Ocean Blue on one part of the page
- **WHEN** `--accent` is set to `#2f5f96` on an element around a button in its accent look
- **THEN** that button is `rgb(47, 95, 150)`

### Requirement: A component that breaks the look cannot be released
The registry's own checks SHALL fail, before any release, on a component that writes a colour out instead of using a token, uses a fixed text size that Larger text cannot raise, uses shadcn's colour names whose meaning differs in Wheelhouse, or depends on a component outside the Wheelhouse registry.

#### Scenario: A ported component keeps shadcn's dark overlay
- **WHEN** a registry component contains `bg-black/50`
- **THEN** the registry's tests fail naming the file and line

#### Scenario: A ported component depends on shadcn's own button
- **WHEN** a registry item lists `button` rather than `@wheelhouse/button` among the components it needs
- **THEN** the registry's tests fail naming the item

### Requirement: The money box keeps working in whole pence
The money box component SHALL turn what is typed into a whole number of pence and show pence as pounds and pence, unchanged by the move, and the registry SHALL test this.

#### Scenario: Typing a drawn price
- **WHEN** someone types `27.75` into the money box
- **THEN** the screen is given `2775` pence, and leaving the box shows `27.75`

#### Scenario: A half-typed amount
- **WHEN** someone types `1.234`
- **THEN** the box is marked invalid and the screen is not given a number

### Requirement: A registry change reaches the app only through a pull request with every test passing
A new registry release SHALL reach the app only as a pull request on its own branch that runs the app's full test workflow. Nothing SHALL fetch components while the app builds, starts or runs, and the sync job SHALL never merge or push to `main`.

#### Scenario: A new release
- **WHEN** the registry publishes a new version
- **THEN** within a day a pull request "Registry <version>" is opened in the app and the Tests workflow runs on its last commit

#### Scenario: A release that breaks a screen
- **WHEN** a release makes any app test fail
- **THEN** its pull request stays red and unmerged, and `main` and the hosted copy are unchanged

#### Scenario: The check never ran
- **WHEN** the sync pull request has no Tests result on its last commit
- **THEN** it cannot be merged

### Requirement: Hand edits to copied files are caught
The app's CI SHALL fail when a released registry file in `vendor/react-repo/` or an installed component differs from the hashes in `react-repo.lock.json`, or when a file in `src/components/ui/` did not come from the registry.

#### Scenario: A component edited in the app
- **WHEN** someone edits `src/components/ui/button.tsx` by hand
- **THEN** CI fails with "Installed component edited by hand: src/components/ui/button.tsx"

#### Scenario: A component made in the app
- **WHEN** a new file appears in `src/components/ui/` that the lock does not list
- **THEN** CI fails with "Not from the registry"

### Requirement: A sync installs only what the pinned release holds
When the app copies in a release, every component and every component it depends on SHALL come from that same release, and the copy SHALL NOT add or change any package the app depends on.

#### Scenario: A component that needs another
- **WHEN** the money box is installed from a release
- **THEN** the text box it is built on is installed from the same release first

#### Scenario: A component that needs a new package
- **WHEN** a release's component needs a package the app does not have
- **THEN** the sync stops naming the component and the package, and `package.json` is unchanged

### Requirement: A bad release can be undone and skipped
Reverting a merged sync pull request SHALL return the app to the previous release, and a version listed in `skipVersions` SHALL not be offered again.

#### Scenario: Skipping a version
- **WHEN** `v1.2.0` is in `skipVersions` and is the newest release
- **THEN** the sync job opens no pull request and says "v1.2.0 is in skipVersions"

### Requirement: The pop-up box keeps the browser's own behaviour
The Wheelhouse pop-up box SHALL stay built on the browser's own dialog: Escape closes it and tells the screen, focus stays inside while it is open, a tap outside closes it only when allowed, and destructive "Are you sure?" boxes ignore a tap outside.

#### Scenario: Escape
- **WHEN** a pop-up box is open and the person presses Escape
- **THEN** it closes and the screen is told it closed, so it can be opened again

#### Scenario: A stray tap on a destructive confirmation
- **WHEN** an "Are you sure?" box for a destructive action is open and the person taps outside it
- **THEN** it stays open

### Requirement: Components that need Radix wait for Jack
No component that needs Radix SHALL be published until Jack has answered whether Radix may be used. Components on the customer booking pages SHALL stay on the browser's own controls.

#### Scenario: Before Jack answers
- **WHEN** a release is built before Jack's answer is recorded
- **THEN** no published component imports `radix-ui` or `@radix-ui/*`

### Requirement: The dark look stays off
The tokens file SHALL keep the dark values marked unapproved, and nothing in the registry or the app SHALL switch the dark look on.

#### Scenario: Something tries to switch the dark look on
- **WHEN** any app file or installed component adds the `dark` class to the page
- **THEN** the app's tests fail naming the file, so every screen keeps the Soft sand light look
