"""Create an original illustrative inspection clip (Pillow + ffmpeg required).
No manufacturer imagery, real customers, or synthetic claims of a real inspection.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
media = root / 'public' / 'media'
media.mkdir(parents=True, exist_ok=True)
font_paths = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
font_path = next((p for p in font_paths if Path(p).exists()), None)
def font(size):
    return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default(size=size)

scenes = [
    ('01 / THE INSPECTION', 'A closer look at your brakes', 'This sample illustrates how a mechanic can explain findings.'),
    ('02 / THE FINDING', 'Front brake pads: proposed replacement', 'In this fictional scenario, we recommend replacing worn pads.'),
    ('03 / YOUR CHOICE', 'See the work. Choose what happens next.', 'Approve or decline each item below. No extra work without permission.'),
]
with tempfile.TemporaryDirectory() as task_tmp:
    tmp = Path(task_tmp)
    for i, (label, title, caption) in enumerate(scenes):
        img = Image.new('RGB', (1280, 720), '#163d32')
        d = ImageDraw.Draw(img)
        d.text((55, 36), 'WHEELHOUSE / ILLUSTRATIVE INSPECTION', font=font(20), fill='#c8ddc7')
        d.rounded_rectangle((930, 26, 1230, 68), 10, fill='#2c5543')
        d.text((947, 38), 'FICTIONAL DEMO FOOTAGE', font=font(16), fill='#e8f0df')
        # An original schematic wheel, fork, and brake pads, not a repair guide.
        cx, cy, radius = 640, 290, 150
        d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline='#a1b891',width=12)
        d.ellipse((cx-16,cy-16,cx+16,cy+16),fill='#b4c89d')
        for dx,dy in [(0,-140),(0,140),(-140,0),(140,0),(-99,-99),(99,-99),(-99,99),(99,99)]:
            d.line((cx,cy,cx+dx,cy+dy), fill='#4d755b', width=3)
        d.line((605,105,620,280),fill='#d5e0c5',width=13)
        d.line((675,105,660,280),fill='#d5e0c5',width=13)
        d.rounded_rectangle((562,158,603,200),8,fill='#d9915f' if i == 1 else '#a6bd92')
        d.rounded_rectangle((677,158,718,200),8,fill='#d9915f' if i == 1 else '#a6bd92')
        if i == 1:
            d.line((715,178,900,160),fill='#d9915f',width=2)
            d.text((910,148),'Proposed: £28',font=font(23),fill='#edbb90')
        d.text((55, 472), label, font=font(18), fill='#acd0a3')
        d.text((55, 510), title, font=font(34), fill='#f3f5eb')
        d.text((55, 572), caption, font=font(22), fill='#d2dfc7')
        d.text((55, 647), 'Animation for testing the customer experience. Replace with a mechanic’s video.',font=font(17),fill='#acbfa4')
        img.save(tmp / f'scene-{i}.png')
        if i == 0: img.save(media / 'inspection-poster.png')
    playlist = tmp / 'frames.txt'
    playlist.write_text(''.join(f"file '{tmp / f'scene-{i}.png'}'\nduration 6\n" for i in range(3)) + f"file '{tmp / 'scene-2.png'}'\n")
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(playlist),'-vf','fps=24','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-t','18',str(media/'inspection.mp4')],check=True)
(media/'inspection.vtt').write_text('''WEBVTT

00:00.000 --> 00:06.000
Illustrative inspection: a schematic of a bike wheel and brake pads.
A mechanic can explain findings before proposing work.

00:06.000 --> 00:12.000
In this fictional scenario, the front brake pads need replacing.
The proposed estimate is £28.

00:12.000 --> 00:18.000
Review the proposed work below the video.
Approve or decline each item before the shop proceeds.
''')
print('Created 18-second captioned inspection sample and poster.')
