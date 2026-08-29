<#
  Renders a plain list of mm-positioned rectangles and text strings (see
  print-agent/agent.js and public/app.js's buildStickerPrintJob) directly to
  a named Windows printer via .NET's printing API. No barcode or label-
  layout logic lives here - it's a dumb rendering executor, so the same
  already-verified Code128 encoder in the browser stays the only place that
  logic exists. Everything used (System.Drawing) ships with Windows
  already, so this adds no new dependency beyond the printer's own driver,
  which has to be installed for it to work in Windows at all regardless of
  this script - custom small paper sizes are a driver-dependent feature,
  well supported by dedicated label printer drivers (Dymo/Zebra/Brother QL
  etc.), which is the hardware this was built for.

  Invoked by agent.js as:
    powershell -ExecutionPolicy Bypass -File print-label.ps1 -DataFile <path to JSON>
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$DataFile
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName System.Drawing

  $json = Get-Content -Raw -Path $DataFile | ConvertFrom-Json

  # PrintPageEventArgs.Graphics defaults to 1/100" units (GraphicsUnit.Display),
  # same as PaperSize's width/height - converting every mm value through this
  # one factor keeps the page size and every drawn primitive in the same units.
  $mmToUnits = 100 / 25.4

  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = $json.printerName
  if (-not $doc.PrinterSettings.IsValid) {
    throw "Printer '$($json.printerName)' is not valid or not reachable"
  }

  $widthUnits = [int][math]::Round($json.widthMm * $mmToUnits)
  $heightUnits = [int][math]::Round($json.heightMm * $mmToUnits)
  $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Label', $widthUnits, $heightUnits)
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $false

  $pages = @($json.pages)
  $script:pageIndex = 0
  $blackBrush = [System.Drawing.Brushes]::Black

  # PrintPage fires synchronously as part of $doc.Print()'s call, on the
  # same thread - a plain scriptblock wired via add_PrintPage (rather than
  # Register-ObjectEvent, which is for genuinely async .NET events) is the
  # correct, commonly-used pattern for this specific event.
  $handler = {
    param($sender, $e)

    $page = $pages[$script:pageIndex]

    foreach ($r in $page.rects) {
      $x = [float]($r.xMm * $mmToUnits)
      $y = [float]($r.yMm * $mmToUnits)
      $w = [float]($r.wMm * $mmToUnits)
      $h = [float]($r.hMm * $mmToUnits)
      $e.Graphics.FillRectangle($blackBrush, $x, $y, $w, $h)
    }

    foreach ($t in $page.texts) {
      $style = if ($t.bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
      $font = New-Object System.Drawing.Font('Arial', [float]$t.sizePt, $style)
      $format = New-Object System.Drawing.StringFormat
      $format.Alignment = switch ($t.align) {
        'center' { [System.Drawing.StringAlignment]::Center }
        'right'  { [System.Drawing.StringAlignment]::Far }
        default  { [System.Drawing.StringAlignment]::Near }
      }
      $y = [float]($t.yMm * $mmToUnits)
      $bounds = New-Object System.Drawing.RectangleF(0, $y, [float]$widthUnits, 200)
      $e.Graphics.DrawString($t.text, $font, $blackBrush, $bounds, $format)
      $font.Dispose()
    }

    $script:pageIndex++
    $e.HasMorePages = $script:pageIndex -lt $pages.Count
  }

  $doc.add_PrintPage($handler)
  $doc.Print()
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
