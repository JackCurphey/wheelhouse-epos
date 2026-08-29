# Wheelhouse Print Agent

Gives the Stockroom sticker-printing feature real printer access, from *any*
shop PC's browser to *any* other shop PC's printer - not just printers
attached to whichever machine you happen to be printing from. A browser
page can't enumerate or write to a system's printers (a deliberate,
unremovable browser restriction) and can't talk directly to a printer on a
different computer either, so this small background app runs on each shop
PC that has a printer attached, signs into the shop's normal account, and
relays print jobs through the shop's own server - the same server every
browser tab already talks to. It never runs inside Docker: Docker Desktop's
containers are Linux, with no access to Windows-installed printers at all.

Nothing here has any barcode or label-layout logic of its own -
`public/app.js` computes a plain list of mm-positioned rectangles and text
strings and hands them over via the server; `main.js` and `print-label.ps1`
just get that onto a named printer.

## Installing (on each PC with a printer attached)

1. Download the latest `Wheelhouse Print Agent Setup.exe` from the
   [Releases page](https://github.com/JackCurphey/wheelhouse-epos/releases)
   and run it. No admin rights needed - it installs to your own user
   profile, not system-wide.
   - Windows will likely show a "Windows protected your PC" SmartScreen
     warning on first run, since this isn't yet a code-signed app - click
     **More info → Run anyway**. Normal for a small unsigned tool, not a
     sign anything's wrong.
2. The app opens automatically after installing. Sign in with the shop's
   normal login (the same one used on the till).
3. That's it - this PC's printers now show up in the sticker-print modal's
   dropdown from *any* browser signed into the same shop, and the app
   starts itself automatically every time this PC does (no need to open it
   again, no Task Scheduler setup, nothing else to configure).

Closing the window doesn't stop it - it keeps running in the background
(look for the icon in the system tray). To actually stop it, right-click
the tray icon and choose **Quit** - this PC's printers stop showing up
elsewhere (sticker printing still works from any other signed-in PC, and
falls back to the browser's own print dialog if none are online at all).

## Requirements

- Windows, with each label printer already installed with a working driver
  (this uses each printer's own driver via .NET's printing API - it doesn't
  speak any printer's raw command language directly).

## Configuration

- `WHEELHOUSE_SERVER_URL` - which server to check in with. The packaged
  app always points at the real shop deployment
  (`https://epos.jackcurphey.com`); this env var is only for local
  development (see below).

## Local development

```powershell
cd print-agent
npm install
npm start
```

Runs the app straight from source via Electron, without building an
installer - useful for testing changes. Point it at a local dev server
instead of production with:

```powershell
$env:WHEELHOUSE_SERVER_URL = "http://localhost:8080"
npm start
```

To build the actual installer: `npm run dist` (uses `electron-builder`,
configured in `package.json`) - produces
`print-agent/dist/Wheelhouse Print Agent Setup <version>.exe`.

## Troubleshooting

- **A label prints at the wrong size or gets cropped**: custom paper sizes
  are a driver feature, not something every printer driver supports the
  same way. Dedicated label printer drivers (Dymo, Zebra, Brother QL, etc.)
  generally handle arbitrary small sizes fine; a standard office
  printer/driver may substitute its nearest supported stock size instead.
- **A device's printers aren't showing up in the app**: open the tray
  icon's window - it shows whether it's currently signed in, what it last
  detected, and how long since its last check-in (over ~25s and the server
  considers it offline).
- **"Signed out - session expired"**: sign in again - this happens if the
  shop's password changed or the session was otherwise revoked since this
  PC last signed in.
