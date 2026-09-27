"""Package editable screen-design sources as one offline HTML file (stdlib only)."""
from pathlib import Path
import json
p=Path(__file__).parent
html=p.joinpath('template.html').read_text()
for token,file in [('__DESIGNS_CSS__','designs.css'),('__SCREEN_CSS__','screen.css'),('__SCREENS__','screens.js'),('__BRANCHES__','branches.js'),('__DESIGNS_JS__','designs.js')]:
    value=p.joinpath(file).read_text()
    if token=='__SCREEN_CSS__': value=json.dumps(value)
    html=html.replace(token,value)
html=html.replace('__QR__',p.joinpath('tag-qr.svg').read_text())
html=html.replace('__BARS__',p.joinpath('tag-bars.svg').read_text())
p.joinpath('Wheelhouse-Release-1-Screen-Designs.html').write_text(html)
print(f'Packaged {len(html):,} characters')
