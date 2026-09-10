"""Static PDF/PNG proof using WeasyPrint; not a browser screenshot."""
from pathlib import Path
import json, logging, sys
# Xcode's Python does not inherit DYLD search paths; resolve installed libraries explicitly.
import cffi, os
_original_dlopen = cffi.FFI.dlopen
def _homebrew_dlopen(self, name, flags=0):
    candidate = '/opt/homebrew/lib/' + name if isinstance(name,str) else ''
    return _original_dlopen(self, candidate if os.path.isfile(candidate) else name, flags)
cffi.FFI.dlopen = _homebrew_dlopen
from weasyprint import HTML,CSS
import fitz
from PIL import Image,ImageDraw,ImageFont
logging.getLogger('weasyprint').setLevel(logging.ERROR)
p=Path(__file__).parent
screens=json.loads((p/'evidence/render-input.json').read_text())
(p/'evidence/screens').mkdir(exist_ok=True)
chosen=sys.argv[1:]
for s in screens:
 if chosen and s['id'] not in chosen: continue
 w,h=(390,844) if s['mobile'] else (1100,760)
 override=f'@page{{size:{w}px {h}px;margin:0}}html,body{{width:{w}px;height:{h}px;overflow:hidden}}.shell{{position:absolute;top:64px;left:0;width:1100px;height:696px}}.phone{{position:absolute;top:0;left:0;width:390px;height:844px;overflow:hidden}}.content{{overflow:hidden;height:696px}}'
 override+=' .shell{display:block}.sidebar{position:absolute;top:0;left:0;width:176px;height:696px}.content{position:absolute;left:176px;top:0;width:924px;min-width:0}.sidebar button{width:152px;flex-shrink:0}.heading>div{flex:1}.jobhead h1{white-space:nowrap}.split{display:flex;align-items:flex-start;gap:20px}.split>:first-child{flex:0 0 60%;width:60%;min-width:0}.split>:last-child{flex:0 0 37%;width:37%;min-width:0}.stack{display:block}.stack>*+*{margin-top:16px}.two{display:flex;gap:16px}.two>*{flex:1;min-width:0}.three{display:flex;gap:16px}.three>*{flex:1;min-width:0}.tabs button{flex:0 0 auto}.settings{display:flex;gap:20px}.settings>.subnav{flex:0 0 154px}.settings>.stack{flex:1;min-width:0}.actions button{flex:0 0 auto}.phone .actions button{display:block;width:100%}.phone .actions{display:block}.phone .actions>*+*{margin-top:10px}.row.between>div:first-child{flex:1}.phone .lineitem{break-inside:avoid}'
 override+=' .heading{display:block;position:relative}.heading>button{position:absolute;right:0;top:0}.split{display:block}.split>:first-child{float:left;width:60%}.split>:last-child{float:right;width:37%}.tabs{display:block;height:44px}.tabs button{display:inline-block;width:auto;margin-right:22px}.jobhead .row.between{display:block;position:relative}.jobhead .row.between>.badge{position:absolute;right:0;top:0}'
 override+=' .split{position:relative;min-height:480px}.split>:last-child{position:absolute;right:0;top:0;float:none}.rail{display:block}.rail>button,.rail>.badge{display:inline-block;width:auto;margin:0 6px 6px 0}'
 override+='''
 .settings{display:block;position:relative}
 .settings>.subnav{position:absolute;left:0;top:0;width:154px;display:block}
 .settings>.subnav button{display:block;width:154px;margin-bottom:5px}
 .settings>.stack{margin-left:174px;width:694px;margin-top:0}
 .field{display:block}
 .field input,.field select,.field textarea{display:block;width:100%;max-width:100%;margin-top:6px}
 .stack>.panel{width:100%}
 .row button{width:auto}
 .sidebar .bottom{width:152px}
 .two>.field{width:calc(50% - 8px)}
 /* WeasyPrint needs explicit block geometry for these interactive layouts. */
 .choice{display:block;position:relative;min-height:74px;padding:14px 68px 12px 46px}
 .choice>span:first-child{position:absolute;left:15px;top:23px}
 .choice>span:nth-child(2){display:block;margin:0}
 .choice .price{position:absolute;right:16px;top:22px}
 .choice strong,.choice small{display:block;line-height:1.28}
 .choice small{margin-top:5px}
 .choice.selected{padding:13px 67px 11px 45px}
 .calendar{display:block;font-size:0}
 .calendar>*{display:inline-block;width:14.285%;vertical-align:top;font-size:12px}
 .calendar button{min-height:38px;margin:0 0 5px}
 div[style*="grid-template-columns:repeat(7"]{display:block!important;font-size:0}
 div[style*="grid-template-columns:repeat(7"]>*{display:inline-block!important;width:14.285%!important;vertical-align:top;font-size:12px}
 div[style*="grid-template-columns:repeat(7"] button small{display:block;white-space:normal;font-size:10px;line-height:1.15}
 .upload input[type=file]{display:none}
 .phone main{display:block}
 .phone .panel{break-inside:avoid}
 '''
 document=HTML(string=s['html'].replace('</style>','</style><style>'+override+'</style>',1),base_url=str(p)).render()
 data=document.write_pdf()
 pdf=fitz.open(stream=data,filetype='pdf')
 pix=pdf[0].get_pixmap(matrix=fitz.Matrix(1.3333333,1.3333333))
 pix.save(str(p/'evidence/screens'/f"{s['id']}.png"))
 (p/'evidence/screens'/f"{s['id']}.pdf").write_bytes(data)
 print(s['id'],len(pdf),'pages',flush=True)
