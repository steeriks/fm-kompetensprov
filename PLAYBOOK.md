# Playbook — FM kompetensprov

Handbok för den som ska ändra i appen. README beskriver hur den *används*; här står varför
den ser ut som den gör och var fällorna ligger.

Appen är ett **stöd för instruktören** vid genomförandet av kompetensproven — inte ett
officiellt system, och inte utgiven av Försvarsmakten. Det förbehållet ska finnas kvar i
README, i användarinstruktionen, i hjälptexten och i anvisningsvyn; det är fyra ställen
och de ska säga samma sak.

## Grundvalen

**Appen är en fil.** `src/` är uppdelad för att gå att läsa och testa, men det som
distribueras är `docs/index.html` med allt inbakat — CSS, JavaScript, favikon och
hjälptexten. Samma fil serveras av GitHub Pages och kan mejlas som bilaga.

**Ingenting går ut ur appen, och det kontrolleras på tre ställen.** Skälet är dubbelt:
appen ska fungera på en skjutbana utan täckning, och den bär namn, förband och Fmid på
anställd personal.

| var | vad |
|---|---|
| `bygg.py` → `kontrollera_inga_utgaende()` | stoppar bygget vid okänd adress (var som helst i filen, inte bara i `src=`/`href=`), protokollrelativ adress, nätverks-API vid namn, eller saknad/försvagad CSP |
| CSP-taggen i `src/index.html` | `connect-src 'none'` och `form-action 'none'` — webbläsaren stänger vägen även om koden försöker |
| `test/utgaende.test.mjs` | samma kontroller mot den byggda filen, så de gäller även om `bygg.py` ändras |

Adresser som får finnas står i `TILLATNA_URLER` i `bygg.py`, var och en med skälet
utskrivet: xlsx-formatets XML-namnrymder (identifierare, hämtas aldrig) och GitHub-länken i
hjälptexten (öppnas bara om användaren trycker).

Två fällor som redan kostat tid här, båda av samma sort — en kontroll som inte kan ge
utslag:

- Den **gamla** kontrollen läste bara `src="…"` och `href="…"` med dubbla citattecken i
  markup. Ett `fetch('https://…')` inne i skriptet gick rakt igenom, alltså precis det fall
  som varit allvarligt.
- CSP-kontrollen sökte först i **hela filen**. Kommentaren som förklarar taggen innehåller
  direktivens egna namn, så kontrollen var uppfylld även med taggen borttagen. Den läser nu
  direktiven ur själva taggen. HTML-kommentarer stryks före granskningen — de kör inte, och
  förklaringen måste få nämna `fetch` och `sendBeacon` utan att fälla sitt eget bygge.

**Reglerna är data, inte kod.** `PROV` i `src/regler.js` beskriver varje delmoment:
målytor, hur många träffar som räknas i varje målyta, kravet på poängkvot, hur många försök
som är tillåtna — och `anvisning` med avstånd, ställning, genomförande och mätregler i
klartext. `bedom()` känner inte till något prov, och `ritaAnvisning()` känner inte till
något innehåll; båda läser tabellen. Ett nytt delmoment läggs till genom att fylla på
`PROV`, inte genom att skriva om vare sig räkningen eller vyn. Det som är gemensamt för
delmomenten står i `BEDOMNING`.

**Målytan har ett tak, inte ett urval.** Både pistol och Ak tillåter bättringsskott efter
omladdning, men bara de räknande träffarna förs in: nio på Ak, fyra plus två på pistol.
`arFull()` avgör när en målyta är full, och knapptrycket studsar med en förklaring i
stället för att räkna upp. Ska en träff bytas mot en bättre nollas zonen med ett långt
tryck först.

Avhuggningen "de N bästa" står ändå kvar i `bedom()`. Den är inte längre ett urval utan ett
skydd: en säkerhetskopia från en äldre version kan bära fler träffar än taket, och då ska
poängen bli rätt i stället för för hög.

**Numret sitter på tavlan, inte på personen.** Skyttens nummer är hens plats i
`omgang.deltagare` — flyttas hen numreras alla om. Numret följer med till rubriken, till
listan och till exportens `Nr`-kolumn, så att protokollet går att matcha mot banan.

**`person.fmid` är valfritt och kan saknas helt.** Fältet kom till efter version 1, så
poster som lades upp innan dess har det inte alls — läs det alltid som `p.fmid || ''`.
Lagringsversionen bumpades inte: ett fält som får vara tomt behöver ingen migrering.
I exporten står kolumnen `Fmid/Anstnr` **före** namnet, i alla fyra formaten.

## Två svep, inte ett formulär

Hela gränssnittet är byggt kring att provet genomförs i två vändor: alla tiderna först,
alla poängen sedan. Därför har vallistan en **lägesväljare** i stället för ett formulär per
skytt, och därför finns `nastaSkytt()` — den letar upp nästa som saknar det som läget
handlar om, och varvar om från början när den nått slutet.

`nastaAnnan()` finns ovanpå den: när frågan är "vem står på tur EFTER mig" måste man själv
uteslutas, annars pekar knappen på skytten man redan står hos — hen saknar ju fortfarande
det man är där för att fylla i.

**Försök skapas bara med flit.** `oppnaSkytt()` skapar ett första försök åt den som aldrig
skjutit, men aldrig ett omtag: är skytten färdig säger appen ifrån. Vem som väntar på vad
avgörs på ETT ställe, `behoverLage()`, som både lägesväljarens räknare och `nastaSkytt()`
läser — annars börjar de två påstå olika saker, och svepet drar in färdiga skyttar och
hittar på försök åt dem.

`lagring.pagaende()` är gångjärnet: den ger skyttens *öppna* försök, det som ännu inte
registrerats. Tidssvepet skapar det, poängsvepet hittar tillbaka till samma post timmar
senare. Först `registrera()` låser posten.

**Listan landar där det finns något kvar att göra.** `lampligtLage()` väljer läge varje
gång man kommer tillbaka till vallistan: man står kvar i sitt läge så länge dess knapp bär
en siffra, annars byter listan till det andra. En avstickare till anvisningen eller
exporten ska inte kunna lämna en i ett tomt läge — och när tiderna är klara är poängen
nästa steg, utan att man behöver peta på växeln själv.

**Knapparna säger vad som ska göras.** I en ny omgång finns ingen föregående skytt att vara
"nästa" efter, så huvudknappen heter *Registrera tid för första skytt* tills första tiden är
inne. Under den står vem som står på tur, och när linjen är klar lämnar knappen över till
poängsteget av sig själv.

## Tiden knappas rakt av

`tolkadTid()` läser knappsatsens buffert. Utan komma är de två sista siffrorna hundradelar
(555 → 5,55), med komma gäller kommat. Skälet är att man läser av timern och knappar det
man ser, utan att leta efter kommatecknet med handskar på. Bufferten sparas som den
knappats — tolkningen sker vid visning och vid sparande, aldrig i lagret.

Knappsatsen ritas **inte** om per siffra; bara `.tidvisning` skrivs om. Att bygga upp
knapparna på nytt mitt under fingret ger flimmer och byter ut knappen mellan nedtryck och
släpp.

## Vyerna

Ingen router — `vy` är ett objekt med ett namn och det vyn handlar om, och `rita()` väljer
funktion. `gaTill(namn, extra, ersatt)` med `ersatt = true` byter ut historikposten i
stället för att stapla, så att telefonens bakåtgest inte vandrar baklänges genom hela
skjutlaget.

| Vy | Funktion | Vad den gör |
|---|---|---|
| `start` | `ritaStart` | Omgångarna. Långt tryck lägger fram soptunnan som raderar; raden säger med `data-hall-radera="typ:id"` vad den är. |
| `ny` | `ritaNy` | Prov, datum, plats, ibockning i skjutordning. |
| `omgang` | `ritaOmgang` | Vallistan med lägesväljare — arbetsvyn. |
| `tid` | `ritaTid` | Sifferknappsats. Pilarna i rubriken stegar en tavla åt vardera hållet. |
| `poang` | `ritaPoang` | Zonknappar, summering, utfall. |
| `lagg-till` | `ritaLaggTill` | Fyller på en pågående omgång. |
| `anvisning` | `ritaAnvisning` | Regelverkets anvisning per prov. |
| `export` | `ritaExportval` | Fyra format plus förhandsgranskning. |
| `register` | `ritaRegister` | Skytteregistret. Långt tryck raderar, som på startsidan. |
| `installningar` | `ritaInstallningar` | Säkerhetskopia, nollställning, hjälp. |
| `dok` | `ritaDokument` | `anvandning.md` eller `hjalp.md`, renderad. |

**Flyttläge** är ett tillstånd på vallistan (`vy.flyttlage`), inte en egen vy: ett långt
tryck slår på det, varje rad får ett handtag (☰) och draget börjar när man tar i handtaget.
Att hålla in och dra i samma rörelse var för hal gest i fält — det var första försöket, och
det fick bytas ut.

**Hemknappen** går alltid till startsidan och sparar en påbörjad tid på vägen. Vägen
tillbaka till vallistan finns som egen knapp i nederkant på de vyer som ligger inuti en
omgång; att navigera "uppåt" via historiken blev aldrig förutsägbart.

Den står kvar **även på startsidan**, där den inte leder någonstans. `ritaStart` gömde den
först, men `hidden` bet inte (se fällan nedan), så ikonen syntes ändå och hann bli en del
av bilden. När felet rättades försvann den — och skulle tillbaka. Rubrikraden ska se
likadan ut på varje skärm.

**Bottenradens höjd mäts** efter varje omritning och skrivs till `--bottenhojd`, som
sidans nedre marginal läser. Raden är olika hög i olika vyer, och en gissad marginal göms
antingen bakom knapparna eller slösar skärm.

## Fällor som redan kostat tid

- **Långtryck markerar text om man inte stoppar det.** Skytterader och zonknappar hålls in
  med flit, och iOS svarar med markering och kopieringsmeny mitt i draget. Både
  `user-select: none` och `-webkit-touch-callout: none` behövs; dragets start släpper
  dessutom en markering som redan hunnit uppstå.
- **`hidden` förlorar mot varje egen `display`-regel.** Webbläsarens inbyggda
  `[hidden] { display: none }` ligger i UA-lagret, och en klassregel med `display: flex`
  i det här arket vinner över den. Hemknappen och stegningspilarna sätter `display: flex`
  och göms med `hidden` — därför finns `[hidden] { display: none !important }` överst i
  `style.css`. Utan den står de kvar synliga i varje vy som gömt dem — vilket hemknappen
  gjorde på startsidan ända tills pilarna kom och tvingade fram rättningen.
- **`rita()` fick inte städa bort flash-meddelanden.** Nästan varje bekräftelse följs av en
  omritning, så meddelandet rensades av just den omritning det skulle överleva och syntes
  aldrig. Flashen tar bort sig själv efter sina sekunder i stället.
- **`structuredClone` finns inte i äldre iOS-Safari.** Den användes först för att skapa ett
  tomt lager och gjorde att `las()` kastade — vilket testerna maskerade genom att cachen då
  aldrig fylldes. Bygg tomma objekt med en funktion i stället.
- **Listan ritas om vid varje tryck.** Element som hämtats före ett klick är döda efter det.
  Gäller både kod och tester — hämta om.
- **`localStorage` läses en gång och hålls i minnet.** Ett test som lägger in data efter att
  appen startat ser den inte. Testerna sår därför via `beforeParse` i jsdom, innan skripten
  kör.
- **Proven ska trycka på knappar, inte på deras text.** Ett namnbyte välte tjugo prov som
  handlade om annat. Huvudknappen hämtas som element; orden provas för sig.

## Exporten

Fyra format ur samma underlag (`underlag()` i `src/export.js`), inga bibliotek:

- **Text** för mailet, **CSV** med BOM och semikolon så att svensk Excel öppnar den rätt.
- **XLSX** är en ZIP med XML. Posterna skrivs **okomprimerade (STORED)** — giltigt enligt
  formatet, och därmed behövs ingen deflate. CRC32 räknas i `crc32()`. `styles.xml` måste ha
  både `cellXfs` och `cellStyles`, annars klagar läsare på att standardstilen saknas.
- **PDF** byggs för hand: inbyggd Helvetica, `WinAnsiEncoding`, och byteoffsets i
  xref-tabellen. Texten kodas som WinAnsi-byte, inte UTF-8 — å ä ö ligger under 256, men
  tankstreck och avbrottstecken måste översättas uttryckligen (se `SARSKILDA`), annars blir
  de frågetecken. Kolumnbredderna kontrolleras mot sidbredden; summerar de för högt kastar
  `somPdf()` hellre än att skriva utanför pappret.

Utskriftsstilmallen i `style.css` är kvar med flit: `window.print()` ger "Spara som PDF" på
iOS och papper på banan, och är reserven om den handskrivna PDF:en någon gång skulle visa
sig spröd. Knappen finns på exportskärmen — inte under inställningar, där det inte finns
något resultat att skriva ut.

## Texterna i appen

Två markdown-filer: `src/anvandning.md` (hur appen används) och `src/hjalp.md`
(installation, data, buggar, licens). Båda är riktiga .md-filer, men bakas in i sidan av
`bygg.py` i var sin `<script type="text/markdown" data-fil="…">`. Att hämta dem vid
körning hade brutit löftet om noll externa anrop.

Vill du lägga till en text till: skapa filen, lägg en behållare med `data-fil` i
`index.html`, och en post i `DOKUMENT` i `app.js` med rubrik och vart knappen leder
tillbaka. Bygget hittar behållaren av sig självt.

Renderaren klarar rubriker, stycken, punktlistor, **fet**, *kursiv* och länkar — skriv
inte annat i filerna utan att utöka den, och skriv aldrig `</script`. Ett prov ser till att
ingen markdown läcker ut som asterisker på skärmen.

## Prov

```bash
python3 bygg.py     # måste köras först — flödesproven kör mot docs/
npm test            # 74 prov: regelmotor, export, hela flödet
```

Flödesproven kör **den byggda filen** i jsdom, alltså samma artefakt som telefonen får. De
går igenom hela arbetsgången: tider på tre skyttar, poäng på samma tre, andra försök,
vapenhanteringsspärren, taket på antalet träffar, långt tryck som nollar, flyttläget,
raderingarna och att en färdig skytt inte får försök påhittade åt sig.

Exportproven skriver riktiga filer till en temporär katalog. XLSX kontrolleras genom att
öppnas med openpyxl (`~/.venvs/sra-ratta/bin/python`), PDF genom att renderas med
`qlmanage -t` — går den inte att rendera har något i strukturen gått sönder.

**Det proven inte täcker:** hur appen ser ut. jsdom renderar ingen CSS. Knappstorlekar,
radbrytning och om något är svårt att träffa med tummen i mörker måste ses på riktigt.

## Publicering

```bash
python3 bygg.py
git commit -am "vad du gjorde" && git push        # det är hela publiceringen
cp docs/index.html ~/Desktop/"FM kompetensprov.html"   # den mejlbara filen
```

**Ett arkiv.** Källan och den byggda appen bor i `steeriks/fm-kompetensprov`, och Pages
serverar `main` + `/docs`. Att bygga och pusha *är* att publicera — det finns inget andra
arkiv att kopiera till och därmed inget som kan glida isär.

Så var det inte förut. Fram till 2026-08-12 låg källan privat i
`steeriks/fm-kompetensprov-kalla` medan ett skript kopierade `dist/` till ett publikt arkiv,
eftersom Pages kräver publikt arkiv på gratisplanen. När källan gjordes publik för granskning
föll hela skälet till uppdelningen bort. Det publika arkivet behöll namnet — det är det som
adressen sitter i — och källan flyttade in i det. `publicera.sh` finns inte längre.

Appen innehåller inga hemligheter och inga resultat lämnar telefonen, så det som är publikt
är programmet självt och hur det är gjort. Testdatats Fmid-värden är påhittade och har
avsiktligt felaktig kontrollsiffra; det står som kommentar i `test/export.test.mjs`.

`bygg.py` sätter `CACHE` i `docs/sw.js` till appens fingeravtryck, så en publicering slår
igenom av sig själv. Rör inte värdet i `src/sw.js` — det skrivs över vid varje bygge.

**Servicearbetaren frågar cachen först, nätet bara när filen saknas där.** Tidigare var det
tvärtom, och då hörde varje start med täckning av sig till GitHub Pages. Ingen användardata
följde med, men en utgående förbindelse per start avslöjar IP, tidpunkt och telefonmodell
för den som serverar filen — och det är inte gratis för en app som ska gå att använda utan
att lämna spår. Uppdateringar tappas inte: webbläsaren jämför `sw.js` mot serverns kopia på
egen hand, och eftersom cachenamnet bär appens fingeravtryck hämtar en ny version sina filer
i `install`-steget. Priset är att en ny version kan dröja en start extra.

Arbetaren släpper också bara igenom appens egen värd (`url.origin !== self.location.origin`
→ passera). En begäran till någon annan ska inte cachas som om den hörde hemma.

GitHub Pages ligger ofta en halv minut efter pushen. Jämför checksummor innan du drar
slutsatser om att en ändring inte kom med:

```bash
shasum docs/index.html <(curl -s https://steeriks.github.io/fm-kompetensprov/)
```
