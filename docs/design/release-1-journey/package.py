"""Package editable atlas sources as one offline HTML file (stdlib only)."""
from pathlib import Path
import json
p=Path(__file__).parent
html=p.joinpath('template.html').read_text()
for token,file in [('__ATLAS_CSS__','atlas.css'),('__SCREEN_CSS__','screen.css'),('__SCREENS__','screens.js'),('__BRANCHES__','branches.js'),('__ATLAS_JS__','atlas.js')]:
    value=p.joinpath(file).read_text()
    if token=='__SCREEN_CSS__': value=json.dumps(value)
    html=html.replace(token,value)
html=html.replace('__QR__',p.joinpath('tag-qr.svg').read_text())
p.joinpath('Wheelhouse-Release-1-Journey-Atlas.html').write_text(html)
print(f'Packaged {len(html):,} characters')
