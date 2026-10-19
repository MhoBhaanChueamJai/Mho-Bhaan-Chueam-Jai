# python3 post.py <workdir> <chapterId ...> — แปลงภาพจาก rec.cjs (frames/*.png) → public/tutorial/media/*.webp
# ใส่แถบสถานะ iPhone (สีตัวอักษรตามความสว่างด้านบนของภาพ) แล้วอัปเดต public/tutorial/chapters.json
import json, os, sys, glob
from PIL import Image, ImageStat
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '../../public/tutorial')
work, ids = sys.argv[1], sys.argv[2:]
out = json.load(open(os.path.join(work, 'out.json')))
site = json.load(open(os.path.join(SITE, 'chapters.json')))
bars = {k: Image.open(os.path.join(HERE, f'sb_{k}.png')).convert('RGBA') for k in ('light', 'dark')}
for cid in ids:
    for f in glob.glob(os.path.join(SITE, 'media', f'{cid}-f*.webp')): os.remove(f)
    def conv(rel):
        im = Image.open(os.path.join(work, rel)).convert('RGB')
        w = im.width
        top = ImageStat.Stat(im.crop((0, 0, w, int(w * 0.14))).convert('L')).mean[0]
        sb = bars['light' if top > 128 else 'dark']
        sb = sb.resize((w, round(sb.height * w / sb.width)), Image.LANCZOS)
        im.paste(sb, (0, 0), sb)
        name = 'media/' + os.path.basename(rel).replace('.png', '.webp')
        im.save(os.path.join(SITE, name), 'WEBP', quality=82, method=6)
        return name
    ch = out[cid]
    for st in ch['steps']:
        st['start'] = conv(st['start'])
        for a in st['actions']: a['frame'] = conv(a['frame'])
    ch['poster'] = ch['steps'][0]['start']
    site[cid] = ch
    print(cid, len(glob.glob(os.path.join(SITE, 'media', f'{cid}-f*.webp'))), 'frames')
json.dump(site, open(os.path.join(SITE, 'chapters.json'), 'w'), ensure_ascii=False, indent=1)
