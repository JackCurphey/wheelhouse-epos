from pathlib import Path
import json,math,textwrap
from PIL import Image,ImageDraw,ImageFont
import fitz
p=Path(__file__).parent
screens=json.loads((p/'screen-index.json').read_text())
screen_title={s['id']:s['title'] for s in screens}
groups=[('book','01','Customer books'),('intake','02','Shop confirms & receives'),('quote','03','Inspect & agree the work'),('work','04','Carry out & hand over'),('edges','05','When plans change'),('setup','06','Get the shop ready')]
fontpath='/System/Library/Fonts/Supplemental/Arial.ttf'
boldpath='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def font(size,bold=False):return ImageFont.truetype(boldpath if bold else fontpath,size)
plain_pdf_font=fitz.Font(fontfile=fontpath)
bold_pdf_font=fitz.Font(fontfile=boldpath)
def register_fonts(page):
 page.insert_font(fontname='wheelhouse-regular',fontfile=fontpath)
 page.insert_font(fontname='wheelhouse-bold',fontfile=boldpath)
W=3400; cw=390;gap=28;left=40
H=300+sum(115+math.ceil(len([s for s in screens if s['group']==g])/8)*415+35 for g,_,_ in groups)+110
im=Image.new('RGB',(W,H),'#f6f5ef');d=ImageDraw.Draw(im)
d.text((40,30),'WHEELHOUSE  /  RELEASE 1  /  10 SEPTEMBER 2026',font=font(20,True),fill='#b8460f')
d.text((40,80),'Every handoff. Every screen. One workshop.',font=font(68,True),fill='#1c231f')
d.text((42,180),'84 proposed screens · customer, service desk, mechanic and manager · open the HTML atlas for navigation and screen notes',font=font(25),fill='#536056')
d.text((42,224),'Static layout reference rendered from the HTML with print-specific CSS. Browser rendering remains to be verified.',font=font(20),fill='#536056')
y=300
for gid,number,title in groups:
 d.line((40,y,W-40,y),fill='#c8d2c2',width=2)
 d.text((40,y+22),number,font=font(42),fill='#b8460f');d.text((125,y+24),title,font=font(36,True),fill='#1c231f')
 y+=100
 entries=[s for s in screens if s['group']==gid]
 for i,s in enumerate(entries):
  x=left+(i%8)*(cw+gap);cy=y+(i//8)*415
  d.rounded_rectangle((x,cy,x+cw,cy+400),radius=9,fill='white',outline='#c9d1c4',width=2)
  d.rectangle((x+2,cy+2,x+cw-2,cy+280),fill='#e4e9df')
  source=Image.open(p/'evidence/screens'/f"{s['id']}.png").convert('RGB')
  source.thumbnail((cw-4,276),Image.Resampling.LANCZOS)
  im.paste(source,(x+(cw-source.width)//2,cy+3))
  d.text((x+14,cy+294),s['number']+' / '+s['id'],font=font(13),fill='#b8460f')
  for j,line in enumerate(textwrap.wrap(s['title'],35)[:2]):d.text((x+14,cy+317+j*21),line,font=font(18,True),fill='#1c231f')
  d.text((x+14,cy+361),s['role']+' · '+s['pack'],font=font(12),fill='#536056')
  d.text((x+14,cy+381),'Next → '+s['next'],font=font(12),fill='#164f42')
 y+=math.ceil(len(entries)/8)*415+35
im.save(p/'Wheelhouse-Release-1-Journey-Board.png',optimize=True)

# Build the board PDF from the original vector screen PDFs. The PNG above is a
# convenient preview; the PDF remains crisp when the reviewer zooms into a card.
board=fitz.open()
pg=board.new_page(width=W*.72,height=H*.72)
register_fonts(pg)
paper=(.965,.961,.937); ink=(.11,.14,.12); muted=(.33,.38,.34)
orange=(.72,.275,.059); green=(.086,.31,.259); rule=(.78,.82,.76)
pg.draw_rect(pg.rect,color=None,fill=paper)
pg.insert_text((29,29),'WHEELHOUSE  /  RELEASE 1  /  10 SEPTEMBER 2026',fontsize=14,fontname='wheelhouse-bold',color=orange)
pg.insert_text((29,77),'Every handoff. Every screen. One workshop.',fontsize=47,fontname='wheelhouse-bold',color=ink)
pg.insert_text((30,130),'84 proposed screens · customer, service desk, mechanic and manager',fontsize=17,fontname='wheelhouse-regular',color=muted)
pg.insert_text((30,158),'Zoom into any card for a crisp vector screen. Use the screen review PDF for notes and bookmarks.',fontsize=13,fontname='wheelhouse-regular',color=muted)
y=216
for gid,number,title in groups:
 pg.draw_line((29,y),(W*.72-29,y),color=rule,width=.8)
 pg.insert_text((29,y+40),number,fontsize=29,fontname='wheelhouse-regular',color=orange)
 pg.insert_text((90,y+40),title,fontsize=24,fontname='wheelhouse-bold',color=ink)
 y+=72
 entries=[s for s in screens if s['group']==gid]
 for i,s in enumerate(entries):
  x=(left+(i%8)*(cw+gap))*.72; cy=y+(i//8)*299
  card=fitz.Rect(x,cy,x+cw*.72,cy+288)
  pg.draw_rect(card,color=rule,fill=(1,1,1),width=.7,radius=.025)
  stage=fitz.Rect(x+2,cy+2,x+cw*.72-2,cy+202)
  pg.draw_rect(stage,color=None,fill=(.894,.914,.875))
  source=fitz.open(p/'evidence/screens'/f"{s['id']}.pdf")
  sw,sh=(390,844) if s['mobile'] else (1100,760)
  scale=min(stage.width/sw,stage.height/sh)
  target=fitz.Rect(stage.x0+(stage.width-sw*scale)/2,stage.y0,stage.x0+(stage.width+sw*scale)/2,stage.y0+sh*scale)
  pg.show_pdf_page(target,source,0,keep_proportion=True)
  pg.insert_text((x+10,cy+218),s['number']+' / '+s['id'],fontsize=8.5,fontname='wheelhouse-regular',color=orange)
  title_lines=textwrap.wrap(s['title'],35)[:2]
  for j,line in enumerate(title_lines):
   pg.insert_text((x+10,cy+237+j*14),line,fontsize=11.5,fontname='wheelhouse-bold',color=ink)
  meta_y=cy+267 if len(title_lines)==1 else cy+278
  pg.insert_text((x+10,meta_y),s['role']+' · '+s['pack'],fontsize=7.5,fontname='wheelhouse-regular',color=muted)
 y+=math.ceil(len(entries)/8)*299+31
board.set_metadata({'title':'Wheelhouse Release 1 - Complete Journey Board','author':'Wheelhouse','subject':'Complete user journey and screen map'})
board.save(p/'Wheelhouse-Release-1-Journey-Board.pdf',garbage=4,deflate=True)

# Screen-by-screen review book with a proper cover, searchable notes and
# original vector screen PDFs. One screen per page prevents scale surprises.
book=fitz.open();toc=[[1,'Cover',1]]
cover=book.new_page(width=1200,height=1040)
register_fonts(cover)
cover.draw_rect(cover.rect,color=None,fill=paper)
cover.draw_rect(fitz.Rect(0,0,18,1040),color=None,fill=orange)
cover.insert_text((70,83),'WHEELHOUSE  /  RELEASE 1',fontsize=16,fontname='wheelhouse-bold',color=orange)
cover.insert_text((70,181),'The workshop journey',fontsize=51,fontname='wheelhouse-bold',color=ink)
cover.insert_text((70,241),'Every handoff. Every screen. One proposed build target.',fontsize=25,fontname='wheelhouse-regular',color=muted)
cover.draw_line((70,292),(1130,292),color=rule,width=1)
cover.insert_text((70,355),'84',fontsize=54,fontname='wheelhouse-bold',color=green)
cover.insert_text((170,337),'HIGH-FIDELITY SCREENS',fontsize=12,fontname='wheelhouse-bold',color=orange)
cover.insert_textbox(fitz.Rect(170,356,620,425),'Customer, service desk, mechanic and manager journeys—from the first booking request to physical collection.',fontsize=15,fontname='wheelhouse-regular',lineheight=1.35,color=ink)
cover.insert_text((70,500),'RELEASE 1 BOUNDARY',fontsize=12,fontname='wheelhouse-bold',color=orange)
cover.insert_textbox(fitz.Rect(70,525,555,685),'Booking, workshop jobs, itemised quotes and approval, email, SMS and WhatsApp, one Lightspeed connection, printed job cards and scannable bike tags.',fontsize=15,fontname='wheelhouse-regular',lineheight=1.4,color=ink)
cover.insert_text((625,500),'FOR STORE REVIEW',fontsize=12,fontname='wheelhouse-bold',color=orange)
cover.insert_textbox(fitz.Rect(625,525,1120,705),'Confirm the customer and staff workflows, then resolve the annotated choices around Lightspeed access, booking defaults, messaging providers and physical print hardware.',fontsize=15,fontname='wheelhouse-regular',lineheight=1.4,color=ink)
cover.draw_line((70,776),(1130,776),color=rule,width=1)
cover.insert_textbox(fitz.Rect(70,809,1130,930),'This document is a visual specification using fictional data. Connected-provider screens show intended states; they do not claim live API access, delivery or printing. Invoicing, online payments, refunds, customer import, reports, group capacity and recovery development are outside Release 1.',fontsize=13,fontname='wheelhouse-regular',lineheight=1.45,color=muted)
cover.insert_text((70,985),'10 September 2026  ·  Store review edition',fontsize=11,fontname='wheelhouse-regular',color=muted)
for gid,num,title in groups:
 toc.append([1,num+' / '+title,len(book)+1])
 for s in [x for x in screens if x['group']==gid]:
  page=book.new_page(width=1200,height=1040)
  register_fonts(page)
  page.draw_rect(page.rect,color=None,fill=paper)
  page.draw_rect(fitz.Rect(0,0,12,1040),color=None,fill=orange)
  page.insert_text((38,29),f"WHEELHOUSE  /  RELEASE 1  /  {num} · {title}",fontsize=10,fontname='wheelhouse-bold',color=orange)
  page.insert_text((38,66),f"{s['number']} / {s['title']}",fontsize=23,fontname='wheelhouse-bold',color=ink)
  page.insert_text((1162-bold_pdf_font.text_length(str(len(book)),fontsize=10),29),str(len(book)),fontsize=10,fontname='wheelhouse-bold',color=muted)
  viewport_label='PHONE VIEWPORT  ·  390 × 844' if s['mobile'] else 'DESKTOP VIEWPORT  ·  1,100 × 760'
  label_width=bold_pdf_font.text_length(viewport_label,fontsize=9)
  page.insert_text((1162-label_width,66),viewport_label,fontsize=9,fontname='wheelhouse-bold',color=muted)
  source=fitz.open(p/'evidence/screens'/f"{s['id']}.pdf")
  w,h=(390,844) if s['mobile'] else (1100,760)
  frame=fitz.Rect(38,88,1162,870)
  page.draw_rect(frame,color=rule,fill=(.894,.914,.875),width=.8,radius=.015)
  scale=min((frame.width-8)/w,(frame.height-8)/h)
  left=frame.x0+(frame.width-w*scale)/2;top=frame.y0+4
  page.show_pdf_page(fitz.Rect(left,top,left+w*scale,top+h*scale),source,0)
  page.draw_line((38,891),(1162,891),color=rule,width=.8)
  page.insert_text((38,918),'DESIGN INTENT',fontsize=9.5,fontname='wheelhouse-bold',color=orange)
  page.insert_textbox(fitz.Rect(150,904,1162,959),s['note'],fontsize=10.5,fontname='wheelhouse-regular',lineheight=1.25,color=(.25,.32,.27))
  page.insert_text((38,982),f"{s['role']}  ·  {s['pack']}",fontsize=10.5,fontname='wheelhouse-bold',color=green)
  next_label='NEXT  →  '+screen_title.get(s['next'],s['next'])
  next_width=bold_pdf_font.text_length(next_label,fontsize=10.5)
  page.insert_text((1162-next_width,982),next_label,fontsize=10.5,fontname='wheelhouse-bold',color=green)
  page.insert_text((38,1013),'Viewport specimen · Scrollable content and interactions continue in the HTML atlas · Fictional scenario',fontsize=8.5,fontname='wheelhouse-regular',color=muted)
  toc.append([2,s['number']+' / '+s['title'],len(book)])
book.set_toc(toc);book.set_metadata({'title':'Wheelhouse Release 1 - UX Screen Review','author':'Wheelhouse','subject':'Proposed user journey and high-fidelity screen specification'})
book.save(p/'Wheelhouse-Release-1-Screen-Review.pdf',garbage=4,deflate=True)
print({'board_pixels':[W,H],'review_pages':len(book)})
# Compact contact sheet for visual review.
thumb=im.copy();thumb.thumbnail((1400,4000));thumb.save(p/'evidence/board-contact-sheet.png')
