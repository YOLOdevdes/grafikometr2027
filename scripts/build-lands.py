#!/usr/bin/env python3
"""
Przygotowuje warstwy tła krainy z paczki ansimuz „SunnyLand Forest of Illusion”.

Wejście:  assets-src/forest/Forest of Illusion Files/Assets/Layers/{back,middle,tiles}.png
Wyjście:  public/lands/forest-{back,middle,ground}.png

Licencja paczki pozwala na użycie, modyfikację i redystrybucję (podanie autora mile widziane).
Użycie:  python3 scripts/build-lands.py [--preview plik.png]
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src/forest/Forest of Illusion Files/Assets/Layers')
OUT = os.path.join(ROOT, 'public/lands')

# kafel ziemi to lewy blok w tiles.png (kolumny 16–79)
GROUND_X = (16, 80)


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'Brak paczki w {SRC}')
    os.makedirs(OUT, exist_ok=True)

    back = Image.open(os.path.join(SRC, 'back.png')).convert('RGBA')
    middle = Image.open(os.path.join(SRC, 'middle.png')).convert('RGBA')
    tiles = Image.open(os.path.join(SRC, 'tiles.png')).convert('RGBA')

    ground = tiles.crop((GROUND_X[0], 0, GROUND_X[1], tiles.height))
    gbox = ground.getbbox()
    ground = ground.crop((0, gbox[1], ground.width, gbox[3]))

    back.save(os.path.join(OUT, 'forest-back.png'))
    middle.save(os.path.join(OUT, 'forest-middle.png'))
    ground.save(os.path.join(OUT, 'forest-ground.png'))
    print(f'back {back.size}, middle {middle.size}, ground {ground.size} → {OUT}')

    if '--preview' in sys.argv:
        # podgląd paska 600×118 z tymi samymi przesunięciami co w CSS (biomes.ts)
        h, ground_y, scene_y = 118, 94, -106
        strip = Image.new('RGBA', (600, h))
        for layer in (back, middle):
            for x in range(0, 600, layer.width):
                strip.alpha_composite(layer.crop((0, -scene_y, layer.width, -scene_y + h)), (x, 0))
        for x in range(0, 600, ground.width):
            strip.alpha_composite(ground.crop((0, 0, ground.width, h - ground_y)), (x, ground_y))
        strip.resize((1200, h * 2), Image.NEAREST).save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
