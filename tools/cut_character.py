"""Cut one object out of a Polycam splat scan, as its own small .spz.

    python3 tools/cut_character.py scans/28_9_2026.ply NAME X Y Z RADIUS

X Y Z are in the radio's scene coordinates (upright, as the browser shows the scan);
the object is everything within RADIUS of that point. Writes scans/characters/NAME.spz,
turned upright like the room scans and centred on its own origin, and lists it in
scans/characters/characters.json.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np

SIZES = {'float': 'f4', 'float32': 'f4', 'double': 'f8', 'uchar': 'u1', 'uint8': 'u1', 'char': 'i1',
         'int8': 'i1', 'short': 'i2', 'int16': 'i2', 'ushort': 'u2', 'uint16': 'u2', 'int': 'i4',
         'int32': 'i4', 'uint': 'u4', 'uint32': 'u4'}


def read_ply(path):
    raw = path.read_bytes()
    end = raw.index(b'end_header\n') + len(b'end_header\n')
    header = raw[:end].decode('ascii', errors='replace')
    lines = header.splitlines()
    count = int(next(l for l in lines if l.startswith('element vertex')).split()[2])
    fields = [(l.split()[2], '<' + SIZES[l.split()[1]]) for l in lines if l.startswith('property')]
    rows = np.frombuffer(raw, dtype=np.dtype(fields), count=count, offset=end)
    return header, rows


def main():
    source, name, x, y, z, radius = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
    root = pathlib.Path(__file__).resolve().parent.parent
    header, rows = read_ply(pathlib.Path(source))
    # Polycam's file has Y pointing down; the radio turns it 180° about X, so the
    # browser's (x, y, z) is the file's (x, -y, -z).
    d2 = (rows['x'] - x) ** 2 + (rows['y'] + y) ** 2 + (rows['z'] + z) ** 2
    kept = rows[d2 < radius * radius].copy()
    if not len(kept):
        sys.exit(f'nothing within {radius} of ({x}, {y}, {z})')
    # Centre the object on the middle of its own blobs, so it floats and turns in place.
    middle = [float(np.median(kept[k])) for k in ('x', 'y', 'z')]
    for k, m in zip(('x', 'y', 'z'), middle):
        kept[k] -= m
    head = header.replace(next(l for l in header.splitlines() if l.startswith('element vertex')),
                          f'element vertex {len(kept)}')
    out = root / 'scans' / 'characters' / f'{name}.spz'
    out.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        ply = pathlib.Path(tmp) / f'{name}.ply'
        ply.write_bytes(head.encode('ascii') + kept.tobytes())
        subprocess.run(['npx', '-y', '@playcanvas/splat-transform', '-q', '-w', str(ply),
                        '-r', '180,0,0', '--spz-version', '3', str(out)], check=True)
    # Remember where it came from, for the gallery's captions.
    listing = out.parent / 'characters.json'
    items = json.loads(listing.read_text()) if listing.exists() else []
    items = [i for i in items if i['name'] != name] + [{
        'name': name, 'file': out.name, 'scan': pathlib.Path(source).stem,
        'from': [round(middle[0], 3), round(-middle[1], 3), round(-middle[2], 3)], 'radius': radius, 'splats': int(len(kept)),
    }]
    listing.write_text(json.dumps(items, indent=2) + '\n')
    print(f'{name}: {len(kept)} splats, {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
