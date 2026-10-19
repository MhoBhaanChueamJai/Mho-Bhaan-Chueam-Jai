import json,sys
from PIL import Image, ImageDraw
d=json.load(open('out.json'))
for cid in (sys.argv[1:] or d.keys()):
    ch=d[cid]; tiles=[]
    for st in ch['steps']:
        seq=[(st['start'],None)]+[(a['frame'],a) for a in st['actions']]
        prev=st['start']
        for i,(f,a) in enumerate(seq):
            src = prev if a else f
            im=Image.open(src).convert('RGB').resize((201,437)); dr=ImageDraw.Draw(im)
            if a:
                x,y=a['x']*2.01,a['y']*4.37; dr.ellipse((x-12,y-12,x+12,y+12),outline=(255,0,80),width=3)
                tiles.append((im,f"{st['n']}.{i} {a['kind']}"))
                im2=Image.open(f).convert('RGB').resize((201,437)); tiles.append((im2,f"{st['n']}.{i} after"))
                prev=f
            else: tiles.append((im,f"{st['n']} start"))
    cols=8; rows=(len(tiles)+cols-1)//cols
    o=Image.new('RGB',(cols*209,rows*457),'white'); dr=ImageDraw.Draw(o)
    for k,(im,lab) in enumerate(tiles):
        x,y=(k%cols)*209,(k//cols)*457; o.paste(im,(x,y+18)); dr.text((x+2,y+2),lab,fill=(0,0,0))
    o.save(f'rev_{cid}.jpg',quality=80)
