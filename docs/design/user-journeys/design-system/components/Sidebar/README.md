# Sidebar

The staff app's navigation, grouped by the rooms of the shop: Front desk, Workshop, Stockroom, Office. Only the rooms and pages a role may use are shown.

- `sidebar` ground, `sidebar-foreground` text; room names as `overline` labels at 70% opacity.
- The current page fills with `sidebar-active` and carries a 3px `highlight` bar on its left edge, plus `aria-current="page"`.
- Items are at least 34px tall (44px on phones), `radius-md`, with a stroke icon and a label.
- The site switcher sits above the rooms; the signed-in person and Sign out sit at the bottom.
- On a phone the sidebar opens as a sheet from the menu button in the top bar.
