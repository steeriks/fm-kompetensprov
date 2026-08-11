"""Bakar ihop src/ till en enda självbärande dist/index.html.

    python3 bygg.py

Källan är uppdelad i moduler för att gå att läsa och testa; det som distribueras
är EN fil. Den filen är både det som GitHub Pages serverar och det som går att
mejla som bilaga — samma artefakt, så det aldrig uppstår tvivel om vilken
version någon kör.

Modulerna slås ihop i beroendeordning och import/export-raderna plockas bort.
`import * as X` blir ett objekt med modulens exporterade namn, så app.js kan
skrivas som vanlig modulkod utan att bygget behöver en bundler.
"""
import base64
import hashlib
import re
import shutil
from pathlib import Path

HAR = Path(__file__).parent
SRC = HAR / 'src'
DIST = HAR / 'dist'

# Beroendeordning: den som importeras måste komma före den som importerar.
MODULER = ['regler.js', 'lagring.js', 'export.js', 'app.js']
MEDFOLJANDE = ['sw.js', 'manifest.webmanifest', 'ikon-180.png', 'ikon-512.png']

EXPORTERAT = re.compile(r'^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)', re.M)
IMPORTRAD = re.compile(r'^import\s+.*?;\s*$', re.M)
NAMNRYMD = re.compile(r"^import\s+\*\s+as\s+(\w+)\s+from\s+'\./([\w.]+)';\s*$", re.M)


def modulnamn(kalla):
    """Namnen en modul exporterar, i den ordning de står."""
    return EXPORTERAT.findall(kalla)


def bygg_js():
    kallor = {namn: (SRC / namn).read_text(encoding='utf-8') for namn in MODULER}
    namnrymder = {}
    for kalla in kallor.values():
        for variabel, fil in NAMNRYMD.findall(kalla):
            namnrymder[fil] = variabel

    delar = []
    for namn in MODULER:
        kalla = kallor[namn]
        kropp = IMPORTRAD.sub('', kalla)
        kropp = re.sub(r'^export\s+', '', kropp, flags=re.M)
        delar.append(f'// ---- {namn} ' + '-' * (66 - len(namn)) + f'\n{kropp}')
        if namn in namnrymder:
            # `import * as lager` → ett objekt med modulens exporterade namn.
            namn_lista = ', '.join(modulnamn(kalla))
            delar.append(f'const {namnrymder[namn]} = {{ {namn_lista} }};\n')

    js = '\n'.join(delar)
    for rad in js.splitlines():
        if rad.startswith('import ') or rad.startswith('export '):
            raise SystemExit(f'Kvarvarande modulrad i bygget: {rad!r}')
    return js


def bygg_html(js):
    html = (SRC / 'index.html').read_text(encoding='utf-8')
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    ikon = base64.b64encode((SRC / 'ikon-180.png').read_bytes()).decode()

    html = html.replace(
        '<link rel="stylesheet" href="style.css">',
        f'<style>\n{css}\n</style>',
    )
    html = html.replace(
        '<script type="module" src="app.js"></script>',
        f'<script>\n{js}\n</script>',
    )
    # Favikonen bäddas in; hemskärmsikonen och manifestet måste vara riktiga
    # filer för att iOS ska ta dem, och lämnas därför som länkar. Öppnad som
    # lös fil ger de en tyst 404 utan att något går sönder.
    html = html.replace(
        '<link rel="icon" href="ikon-180.png">',
        f'<link rel="icon" href="data:image/png;base64,{ikon}">',
    )
    return html


def main():
    DIST.mkdir(exist_ok=True)
    js = bygg_js()
    html = bygg_html(js)
    (DIST / 'index.html').write_text(html, encoding='utf-8')
    for namn in MEDFOLJANDE:
        shutil.copy2(SRC / namn, DIST / namn)

    # Cachenamnet följer appens innehåll. Utan det ligger den gamla filen kvar
    # i telefonen efter en publicering, och ändringen syns inte förrän appen
    # avinstallerats — vilket är precis den sortens fel som tar en kväll att
    # förstå.
    fingeravtryck = hashlib.sha1(html.encode()).hexdigest()[:12]
    sw = (DIST / 'sw.js')
    sw.write_text(
        re.sub(r"const CACHE = '[^']*';",
               f"const CACHE = 'fm-kompetensprov-{fingeravtryck}';",
               sw.read_text(encoding='utf-8')),
        encoding='utf-8',
    )

    # En kontroll som är värd sitt underhåll: filen får inte hämta något
    # utifrån, för då fungerar den inte på en skjutbana utan täckning.
    yttre = re.findall(r'(?:src|href)="(https?://[^"]+)"', html)
    if yttre:
        raise SystemExit(f'Externa beroenden i bygget: {yttre}')

    kb = len(html.encode()) / 1024
    print(f'dist/index.html — {kb:.0f} kB, allt inbakat')
    print('dist/ innehåller även ' + ', '.join(MEDFOLJANDE))


if __name__ == '__main__':
    main()
