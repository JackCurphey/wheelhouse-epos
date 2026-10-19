# Design: the prices switch

`GET`/`PUT /api/workshop-settings` already carry `showPricesOnline` (boolean). The switch is the settings pages' own (`RowSwitch`: the label, On or Off in words, the track), as "Show who signed off to customers" is; switching saves at once, and a refusal shows ("Wheelhouse couldn’t save that…" or the server's words). It sits after the time kept free, before where confirming automatically will go.
