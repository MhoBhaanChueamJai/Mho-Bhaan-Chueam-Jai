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
BOLT = (16 / 804, 1647 / 1748, 100 / 804, 1732 / 1748)
_clean = {}

def _box(im):
    w, h = im.size
    return round(w * BOLT[0]), round(h * BOLT[1]), round(w * BOLT[2]), round(h * BOLT[3])

def has_bolt(im):
    x0, y0, x1, y1 = _box(im)
    box = im.crop((x0, y0, x1, y1)).convert('L')
    return sum(1 for p in box.getdata() if p < 45) / ((x1 - x0) * (y1 - y0)) >= 0.5

def unbolt(im, key=None):
    # Chrome (โหมดอัตโนมัติ) วาดปุ่ม ⚡ สีเข้มมุมซ้ายล่างลงในภาพหน้าจอ (ไม่ใช่ของแอป) → ลบออก
    # ใช้พื้นจากเฟรมก่อนหน้าที่สะอาด (ถ้าขอบรอบกล่องตรงกัน) ไม่งั้นต่อพื้นจากขอบขวาของกล่อง
    x0, y0, x1, y1 = _box(im)
    if not has_bolt(im):
        if key: _clean[key] = im.copy()
        return
    ref = _clean.get(key)
    if ref is not None and ref.size == im.size:
        ring = lambda a: [a.getpixel((x, y)) for x in range(x0 - 4, x1 + 4, 3) for y in (y0 - 4, y1 + 3)] + [a.getpixel((x, y)) for y in range(y0, y1, 3) for x in (x1 + 3,)]
        d = sum(abs(a - b) for pa, pb in zip(ring(im), ring(ref)) for a, b in zip(pa, pb)) / (len(ring(im)) * 3)
        if d < 6:
            im.paste(ref.crop((x0, y0, x1, y1)), (x0, y0))
            return
    px = im.load()
    for y in range(y0, y1):
        c = px[x1 + 2, y]
        for x in range(x0, x1 + 2):
            px[x, y] = c

for cid in ids:
    for f in glob.glob(os.path.join(SITE, 'media', f'{cid}-f*.webp')): os.remove(f)
    def conv(rel):
        im = Image.open(os.path.join(work, rel)).convert('RGB')
        w = im.width
        unbolt(im, cid)
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
