"""Genererar appikonerna — en stiliserad helfigur på mörk botten.

Ren stdlib-PNG-skrivare, inga beroenden. Körs en gång vid behov:

    python3 gen_ikon.py

Skriver src/ikon-180.png (Apples hemskärmsikon) och src/ikon-512.png.
"""
import struct
import zlib
from pathlib import Path

BOTTEN = (11, 13, 12)      # samma svartgröna som appens bakgrund
FIGUR = (143, 191, 127)    # accentgrönt
ZONLINJE = (11, 13, 12)


def rita(size):
    """Returnerar en pixelmatris: mörk botten med en helfigur i mitten."""
    px = [[BOTTEN for _ in range(size)] for _ in range(size)]
    s = size / 100.0                      # allt anges i procent av kanten

    def rekt(x0, y0, x1, y1, farg):
        for y in range(max(0, int(y0 * s)), min(size, int(y1 * s))):
            for x in range(max(0, int(x0 * s)), min(size, int(x1 * s))):
                px[y][x] = farg

    def cirkel(cx, cy, r, farg):
        for y in range(max(0, int((cy - r) * s)), min(size, int((cy + r) * s) + 1)):
            for x in range(max(0, int((cx - r) * s)), min(size, int((cx + r) * s) + 1)):
                dx = (x / s) - cx
                dy = (y / s) - cy
                if dx * dx + dy * dy <= r * r:
                    px[y][x] = farg

    cirkel(50, 26, 13, FIGUR)             # huvud
    rekt(30, 41, 70, 84, FIGUR)           # bål
    rekt(30, 41, 70, 43, ZONLINJE)        # zonlinjer tvärs över bålen
    rekt(30, 56, 70, 58, ZONLINJE)
    rekt(30, 71, 70, 73, ZONLINJE)
    return px


def skriv_png(px, sokvag):
    size = len(px)
    rader = b''.join(
        b'\x00' + b''.join(struct.pack('3B', *px[y][x]) for x in range(size))
        for y in range(size)
    )

    def bit(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n'
           + bit(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + bit(b'IDAT', zlib.compress(rader, 9))
           + bit(b'IEND', b''))
    Path(sokvag).write_bytes(png)
    print(f'{sokvag} ({size}×{size}, {len(png)} byte)')


if __name__ == '__main__':
    har = Path(__file__).parent / 'src'
    for storlek, namn in ((180, 'ikon-180.png'), (512, 'ikon-512.png')):
        skriv_png(rita(storlek), har / namn)
