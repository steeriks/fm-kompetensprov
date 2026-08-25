"""Bakar ihop src/ till en enda självbärande docs/index.html.

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
import json
import re
import shutil
from pathlib import Path

HAR = Path(__file__).parent
SRC = HAR / 'src'
DIST = HAR / 'docs'

# Beroendeordning: den som importeras måste komma före den som importerar.
MODULER = ['regler.js', 'lagring.js', 'export.js', 'app.js']
MEDFOLJANDE = ['sw.js', 'manifest.webmanifest', 'ikon-180.png', 'ikon-512.png']

EXPORTERAT = re.compile(r'^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)', re.M)
# [^;]* spänner över radbrytningar, så både `import { a } from '…';` och en
# importlista över flera rader plockas bort. Utan det stannade bygget på sin
# egen kontroll, vilket är precis vad kontrollen är till för.
IMPORTRAD = re.compile(r'^import\b[^;]*;\s*$', re.M)
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


def version():
    """Utgåvans nummer, skrivet på ett enda ställe: package.json."""
    return json.loads((HAR / 'package.json').read_text(encoding='utf-8'))['version']


def bygg_html(js):
    html = (SRC / 'index.html').read_text(encoding='utf-8')
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    ikon = base64.b64encode((SRC / 'ikon-180.png').read_bytes()).decode()
    # Varje markdown-behållare fylls med sin fil. </script> i texten skulle
    # stänga taggen i förtid — det finns inget sådant i dag, men bygget ska
    # säga ifrån om någon skriver det i en markdown-fil.
    for taggen, filnamn in re.findall(
            r'(<script type="text/markdown" id="[\w-]+" data-fil="([\w.]+)"></script>)', html):
        text = (SRC / filnamn).read_text(encoding='utf-8')
        if '</script' in text:
            raise SystemExit(f'{filnamn} innehåller </script och kan inte bäddas in')
        html = html.replace(taggen, taggen.replace('></script>', f'>\n{text}</script>'))

    # Versionen bakas in i metataggen. Appen läser den därifrån och visar den
    # under Inställningar, så att den som ringer om ett fel kan säga vilken
    # utgåva hen kör. src/ behåller sitt "utveckling".
    html = html.replace(
        '<meta name="version" content="utveckling">',
        f'<meta name="version" content="{version()}">',
    )
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


# Adresser som får stå i filen, med skälet. Allt annat stoppar bygget.
# Poängen med en lista med skäl i stället för ett tystare mönster: den som
# lägger till en rad här måste skriva ner varför, och den som läser kan
# ifrågasätta det.
TILLATNA_URLER = {
    # XML-namnrymder i xlsx-exporten. De är identifierare i filformatet —
    # varken webbläsaren eller Excel hämtar något från dem.
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'http://schemas.openxmlformats.org/package/2006/content-types',
    'http://schemas.openxmlformats.org/package/2006/relationships',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
    # Länk i hjälptexten. Öppnas bara om användaren trycker på den, i en ny
    # flik, och hämtas aldrig av appen själv.
    'https://github.com/steeriks/fm-kompetensprov/issues',
}

# API:er som skickar eller hämtar data över nätet. Inget av dem har något i
# appen att göra: allt som ska ut går via delningsrutan, som användaren själv
# öppnar. Står något av dem i den byggda filen har antingen ett beroende
# smugit sig in eller någon börjat ringa hem.
NATVERKS_API = [
    (r'\bfetch\s*\(', 'fetch()'),
    (r'\bXMLHttpRequest\b', 'XMLHttpRequest'),
    (r'\bWebSocket\b', 'WebSocket'),
    (r'\bEventSource\b', 'EventSource'),
    (r'\bsendBeacon\b', 'navigator.sendBeacon'),
    (r'\bimportScripts\s*\(', 'importScripts()'),
]

CSP_KRAV = ["connect-src 'none'", "form-action 'none'"]


def kontrollera_inga_utgaende(html):
    """Appen får inte hämta eller skicka något på egen hand.

    Den gamla kontrollen läste bara `src="…"` och `href="…"` med dubbla
    citattecken i markup. Ett `fetch('https://…')` inne i skriptet — alltså
    just det som skulle vara allvarligt — gick rakt igenom. Den här läser hela
    filen: adresser var de än står, och nätverks-API:erna vid namn.
    """
    fel = []

    # HTML-kommentarer räknas inte: de kör inte, och kommentaren som förklarar
    # CSP:n måste få nämna fetch och sendBeacon vid namn utan att stoppa sitt
    # eget bygge. (Den gjorde det, första gången kontrollen kördes.)
    granskad = re.sub(r'<!--.*?-->', '', html, flags=re.S)

    adresser = {u.rstrip('.,;\'"<)') for u in re.findall(r'https?://[^\s"\'<>)]+', granskad)}
    for adress in sorted(adresser - TILLATNA_URLER):
        fel.append(f'Okänd adress i bygget: {adress}')

    # Protokollrelativt (//värd) i ett attribut. Kravet på citattecken eller
    # likhetstecken före är vad som skiljer en riktig adress från varje
    # JS-kommentar i filen.
    for traff in re.findall(r'''(?:=|["'])//[a-z0-9][a-z0-9.-]*\.[a-z]{2,}[^\s"'<>]*''', granskad, re.I):
        fel.append(f'Protokollrelativ adress i bygget: {traff}')

    for monster, namn in NATVERKS_API:
        if re.search(monster, granskad):
            fel.append(f'Nätverks-API i bygget: {namn}')

    # CSP:n är en del av löftet och ska inte gå att tappa bort av misstag.
    #
    # Läs direktiven ur SJÄLVA TAGGEN, inte ur filen som helhet. Första
    # versionen sökte i hela texten, och eftersom kommentaren ovanför taggen
    # förklarar direktiven med deras egna namn var kontrollen uppfylld även
    # när taggen var borttagen — en kontroll som inte kunde ge utslag.
    tagg = re.search(
        r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"', html, re.I)
    if not tagg:
        fel.append('CSP-taggen saknas i index.html')
    else:
        for direktiv in CSP_KRAV:
            if direktiv not in tagg.group(1):
                fel.append(f'CSP saknar direktivet: {direktiv}')

    if fel:
        raise SystemExit('\n'.join(['Bygget stoppat:'] + [f'  - {f}' for f in fel]))


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

    kontrollera_inga_utgaende(html)

    kb = len(html.encode()) / 1024
    print(f'docs/index.html — version {version()}, {kb:.0f} kB, allt inbakat')
    print('docs/ innehåller även ' + ', '.join(MEDFOLJANDE))


if __name__ == '__main__':
    main()
