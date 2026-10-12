#!/usr/bin/env python3
"""
Tnie paczkę „assetpack-backgrounds” (parallax: desert / forest / moon / skies) na paski tła projektu.

Wejście:  assets-src/backgrounds/parallax/<kraina>/*.png
          (rozpakuj: unzip assets-src/assetpack-backgrounds.zip 'parallax/*' -d assets-src/backgrounds)
Wyjście:  public/lands/<kraina>-{back,mid,front}.png  — wysokość 2 × ROW_H (ostre na ekranach retina)
          src/ui/lands.gen.json                       — szerokości kafli i dystanse pętli parallax

Każda kraina ma 3 grupy warstw (daleko → blisko). Warstwy 3800 px to dwa kafle 1900 px,
a warstwy lasu 3800×2400 są w skali 2× — sprowadzamy wszystko do wspólnego płótna 1×.
Użycie:  python3 scripts/build-backgrounds.py [--preview plik.png]
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src/backgrounds/parallax')
OUT = os.path.join(ROOT, 'public/lands')
MANIFEST = os.path.join(ROOT, 'src/ui/lands.gen.json')

ROW_H = 118          # wysokość paska projektu (JourneyRow)
OUT_H = ROW_H * 2    # zapisujemy w 2×, CSS skaluje do ROW_H
TILE = 1900          # szerokość kafla na płótnie 1×
LOOP_S = 48          # czas pętli animacji (styles.css)
SPEED = (4, 14, 26)  # docelowe px/s w CSS: tło, środek, przód

# kraina: (płótno 1× wys., okno pionowe (góra, dół), warstwy w grupach daleko → blisko, skala 2× dla plików)
LANDS = {
    'desert': (1000, (150, 1000), [
        ['desert_sky', 'desert_cloud'],
        ['desert_mountain'],
        ['desert_dunemid', 'desert_dunefrontt'],
    ], set()),
    'forest': (1200, (400, 1200), [
        ['forest_sky', 'forest_mountain'],
        ['forest_back', 'forest_long'],
        ['forest_mid', 'forest_short'],
    ], {'forest_mountain', 'forest_back', 'forest_mid', 'forest_short'}),
    'moon': (1000, (60, 1000), [
        ['moon_sky', 'moon_earth', 'moon_back'],
        ['moon_mid'],
        ['moon_front', 'moon_floor'],
    ], set()),
    'skies': (1000, (250, 1000), [
        ['Sky_sky', 'Sky_back_mountain', 'sky_clouds'],
        ['sky_front_mountain', 'Sky_cloud_single'],
        ['sky_cloud_floor_2', 'sky_cloud_floor', 'Sky_front_cloud'],
    ], set()),
}


def load(land, name, halve):
    im = Image.open(os.path.join(SRC, land, name + '.png')).convert('RGBA')
    if name in halve:
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    return im


def group_strip(land, names, canvas_h, window, halve):
    layers = [load(land, n, halve) for n in names]
    width = max(TILE, *(l.width for l in layers))  # 1900 albo 3800 (dwa kafle)
    canvas = Image.new('RGBA', (width, canvas_h))
    for l in layers:
        for x in range(0, width, l.width):
            canvas.alpha_composite(l, (x, 0))
    top, bottom = window
    crop = canvas.crop((0, top, width, bottom))
    scale = OUT_H / (bottom - top)
    return crop.resize((round(width * scale), OUT_H), Image.LANCZOS)


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'Brak paczki w {SRC}')
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    previews = []
    for land, (canvas_h, window, groups, halve) in LANDS.items():
        layers = []
        for i, (names, kind) in enumerate(zip(groups, ('back', 'mid', 'front'))):
            strip = group_strip(land, names, canvas_h, window, halve)
            strip.save(os.path.join(OUT, f'{land}-{kind}.png'), optimize=True)
            w = strip.width / 2  # szerokość kafla w px CSS
            # dystans pętli = wielokrotność kafla najbliższa docelowej prędkości (żeby pętla się domykała)
            loops = max(0 if i == 0 else 1, round(SPEED[i] * LOOP_S / w))  # tło może stać
            layers.append({'src': f'/lands/{land}-{kind}.png', 'w': round(w, 2), 'dx': round(w * loops, 2)})
            if i == 0:
                manifest_bg = '#%02x%02x%02x' % strip.getpixel((2, 2))[:3]
            previews.append(strip)
        manifest[land] = {'bg': manifest_bg, 'layers': layers}
        print(land, [(l['w'], l['dx']) for l in layers])
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')

    if '--preview' in sys.argv:
        out = Image.new('RGBA', (1200, OUT_H * len(LANDS)))
        for n, land in enumerate(LANDS):
            for strip in previews[n * 3:n * 3 + 3]:
                for x in range(0, 1200, strip.width):
                    out.alpha_composite(strip, (x, n * OUT_H))
        out.save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
