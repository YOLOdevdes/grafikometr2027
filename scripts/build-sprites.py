#!/usr/bin/env python3
"""
Składa paski animacji z paczki Mucho Pixels „Character Animation Asset Pack”.

Wejście:  assets-src/mp-characters/mp_character_animation_asset_pack_v1.0/Exported PNGs
Wyjście:  public/sprites/<g><skin><outfit>_<anim>.png + public/sprites/manifest.json

Pliki wyjściowe są w .gitignore — licencja paczki zabrania redystrybucji assetów.
Użycie:  python3 scripts/build-sprites.py
"""
import glob
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src/mp-characters/mp_character_animation_asset_pack_v1.0/Exported PNGs')
OUT = os.path.join(ROOT, 'public/sprites')

# stan w aplikacji -> (animacja w paczce, wybór klatek)
ANIMS = {
    'idle': ('idle', None),
    'walk': ('walk', None),
    'tired': ('wait', None),
    'sleep': ('death', 'last'),
}
GENDERS = {'M': 'Male', 'F': 'Female'}


def frames(folder: str, anim: str) -> list[str]:
    fs = glob.glob(os.path.join(folder, f'*_{anim}_*.png'))
    return sorted(fs, key=lambda f: int(re.findall(r'_(\d+)\.png$', f)[0]))


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'Brak paczki w {SRC}')
    os.makedirs(OUT, exist_ok=True)

    looks = []
    for g, gdir in GENDERS.items():
        for skin in (1, 2, 3):
            for outfit in (1, 2, 3):
                folder = os.path.join(SRC, gdir, f'Character {skin}', f'Clothes {outfit}')
                if os.path.isdir(folder):
                    looks.append((f'{g}{skin}{outfit}', folder))

    # wspólny kadr dla wszystkich klatek, żeby postać nie „skakała” między stanami
    box = None
    for _, folder in looks:
        for anim, pick in ANIMS.values():
            fs = frames(folder, anim)
            for f in fs[-1:] if pick == 'last' else fs:
                b = Image.open(f).convert('RGBA').getbbox()
                if b:
                    box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    counts = {}
    for key, folder in looks:
        for state, (anim, pick) in ANIMS.items():
            fs = frames(folder, anim)
            if pick == 'last':
                fs = fs[-1:]
            strip = Image.new('RGBA', (w * len(fs), h), (0, 0, 0, 0))
            for i, f in enumerate(fs):
                strip.paste(Image.open(f).convert('RGBA').crop(box), (i * w, 0))
            strip.save(os.path.join(OUT, f'{key}_{state}.png'))
            counts[state] = len(fs)

    manifest = {
        'source': 'Mucho Pixels — Character Animation Asset Pack v1.0',
        'frame': {'w': w, 'h': h},
        'frames': counts,
        'looks': [k for k, _ in looks],
    }
    with open(os.path.join(OUT, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, indent=2)
    print(f'{len(looks)} wyglądów × {len(ANIMS)} stanów, klatka {w}×{h}px → {OUT}')


if __name__ == '__main__':
    main()
