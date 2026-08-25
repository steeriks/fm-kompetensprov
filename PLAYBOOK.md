# Playbook — FM kompetensprov

Handbok för den som ska ändra i appen — **läs den här filen först.** README beskriver hur
appen *används*; här står varför den ser ut som den gör och var fällorna ligger.

Tre saker att ta med sig innan något ändras: **bygg före du provar** (proven kör mot
`docs/`, inte `src/`), **ingenting får lämna telefonen** (tre spärrar håller det, se nedan),
och **förbehållet om att appen inte är utgiven av Försvarsmakten** ska stå kvar på alla fyra
ställena.

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

Tabellen har tre prov, inte två: `ak` (automatkarbin, 50 m, PK 1,0), `ak30` (samma
delmoment på 30 m — skjuts bara när ingen 50-metersbana finns att tillgå, och kravet är
då PK 1,3) och `pist`. De två automatkarbinsproven är samma övning på olika avstånd, så
rubrik, ställning, mätregler och genomförande står som konstanter (`AK_RUBRIK`,
`AK_STALLNING`, `AK_MATNING`, `AK_GENOMFORANDE`) ovanför `PROV` och delas av båda. Det är
med flit: texterna är citat, och ett citat som skrivs av på två ställen hinner bli olika.

**Anvisningstexterna är citat, inte appens egen prosa — rätta dem inte.** `anvisning` och
`BEDOMNING` är återgivna ur handboken, vilket vyn också säger i klartext. Fyra ställen ser
ut som språkfel och är kontrollerade mot handboken 2026-08-12; de står som de står:

| var | ser ut som fel | men |
|---|---|---|
| `pist` genomförande | *"4 träff **mot** XBCD"* men *"2 träff **i** AH"* | olika preposition, så står det |
| `ak` genomförande | *"skjut tre **skott**"* två gånger, sedan *"skjut tre **träff**"* | skott och träff är inte samma sak |
| `pist` genomförande | *"Inledningsvis, på signal: genomför skytten…"* | kolon plus omvänd ordföljd |
| `fakta` | ak har **Krav**, pist har **Träffkrav** | etiketterna följer respektive delmoment |

En språkgenomgång som "jämnar ut" dem gör appen otrogen mot källan. Ska något ändras här
är det handboken som avgör, inte språkkänslan — och då ska gällande utgåva kontrolleras
först.

**Målytan har ett urval, inte ett tak.** Både pistol och Ak tillåter bättringsskott efter
omladdning, och alla hål i tavlan knappas in — även de som inte räknas. Urvalet görs på ett
enda ställe: `bedom()` sorterar målytans träffar och tar `slice(0, g.antal)`, alltså de nio
bästa på Ak och de fyra plus två bästa på pistol. Handen som knappar behöver inte sortera
någonting, och lagret bär hela träffbilden.

`grupper[i].over` ur `bedom()` är antalet bättringsskott utöver de räknande. Räknaren i
målytans rubrik läser det: *4 av 4 — klart*, *(6 av 4) — de 4 bästa räknas*. Parentesen och
den röda färgen (`.raknare .over`) skiljer det inknappade antalet från det som räknas —
grönt betyder klart, och ett överskott ska inte se ut som ett kvitto.

**Urvalet görs på ETT ställe: `raknadeIGrupp()`.** Den ger målytans räknande träffar som
antal per zon — bästa poäng först, och vid lika poäng (C och D är båda 3 p) i zonordning, så
att samma försök ger samma protokoll varje gång. `bedom()` summerar poängen ur den, och
`underlag()` i `src/export.js` läser den genom `raknadeTraffar()`. Två skilda uträkningar av
"vilka träffar räknas" hade förr eller senare glidit isär, och då hade protokollet visat
träffar som poängen inte byggde på.

**Exporten bär bara de räknande träffarna.** Appen visar allt som knappats in — det är där
instruktören arbetar — men protokollet som lämnar telefonen visar de nio, eller fyra plus
två, träffar bedömningen vilar på. Zonkolumnerna summerar därmed till kravet, och den som
läser protokollet kan räkna efter poängen utan att känna till vilka bättringsskott som föll
bort. Det lagrade försöket (`resultat[i].traffar`) är orört och bär hela träffbilden.

**Fram till 1.1.0 var det tvärtom.** En spärr (`arFull()`) lät målytan ta emot exakt så många
träffar som räknades, och trycket studsade när den var full. Det tvingade instruktören att
välja ut de bästa träffarna i huvudet framme vid tavlan — precis det appen är till för att
slippa — och det stred mot anvisningstexten i appen, som hela tiden har sagt att de bästa
träffarna räknas. Spärren är borta, och med den `arFull()`, `gruppFor()` och `antalIGrupp()`.

Ett hårt tak finns alltså inte längre. I stället påpekar poängskärmen när en målyta fått mer
än dubbelt så många träffar som den räknar — 19 på Ak, 9 i XBCD, 5 i AH. Det är ett
rimlighetsmått mot feltryck, inte en regel, och därför står tröskeln i `uppdateraPoang()`
och inte i `PROV`. Ett feltryck rättas som förut: långt tryck nollar zonen.

**Numret sitter på tavlan, inte på personen.** Skyttens nummer är hens plats i
`omgang.deltagare` — flyttas hen numreras alla om. Numret följer med till rubriken, till
listan och till exportens `Nr`-kolumn, så att protokollet går att matcha mot banan.

**`person.fmid` är valfritt och kan saknas helt.** Fältet kom till efter version 1, så
poster som lades upp innan dess har det inte alls — läs det alltid som `p.fmid || ''`.
Lagringsversionen bumpades inte: ett fält som får vara tomt behöver ingen migrering.
I exporten står kolumnen `Fmid/Anstnr` **före** namnet, i alla fyra formaten.

**Exempelvärdena är formade `TreTre` plus löpnummer** — tre bokstäver ur förnamnet, tre ur
efternamnet och ett tvåsiffrigt löpnummer, `Cia Craf` → `CiaCra05`. Det gäller överallt där
ett Fmid visas som exempel: importrutan i `src/app.js`, README, användarinstruktionen och
testdatat. Formen är vald för att inte gå att förväxla med ett personnummer; ett kortare
efternamn skrivs ut så långt det räcker (`Ek, Cecilia` → `CecEk12`).

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
| `ny` | `ritaNy` | Prov, datum, plats, ibockning i skjutordning. Två utgångar: *Starta omgången* och *Spara utan att starta*. |
| `omgang` | `ritaOmgang` | Vallistan med lägesväljare — arbetsvyn. |
| `tid` | `ritaTid` | Sifferknappsats. Pilarna i rubriken stegar en tavla åt vardera hållet. |
| `poang` | `ritaPoang` | Zonknappar, summering, utfall. |
| `lagg-till` | `ritaLaggTill` | Fyller på en pågående omgång. |
| `anvisning` | `ritaAnvisning` | Regelverkets anvisning per prov. |
| `export` | `ritaExportval` | Fyra format plus förhandsgranskning. |
| `register` | `ritaRegister` | Skytteregistret. Långt tryck raderar, som på startsidan. |
| `import` | `ritaImport` | Klistra in ett skjutlag. `vy.retur` avgör om den fyller registret eller också omgången. |
| `installningar` | `ritaInstallningar` | Säkerhetskopia, nollställning, hjälp. |
| `dok` | `ritaDokument` | `anvandning.md` eller `hjalp.md`, renderad. |

**"Påbörjad" är inget fält, utan en fråga till lagret.** En omgång som sparats utan att
startas skiljer sig inte i data från en som just öppnats — båda saknar resultat. Därför
finns ingen status att hålla i synk: `ritaStart` frågar `lager.resultat(o.id).length` och
skriver *ej påbörjad* när svaret är noll. Ett `startad`-fält vore en andra sanning som
kunde hamna fel, och den enda som visste bättre vore ändå resultatlistan.

Följden är att en omgång kan sparas **utan deltagare** — det är meningen, linjen fylls på
med *+ Lägg till skytt* när gruppen står där. Vyer som svepen måste alltså tåla noll
deltagare: `nastaSkytt` ger `null` och huvudknappen säger vad som saknas i stället för
"alla har en tid".

**Importen är en vy, inte en modal — och bär därför sin egen väg tillbaka.** `+ Ny skytt`
öppnar en modal just för att den som håller på att bocka i deltagare inte ska tappa sin
halvfyllda omgång. Importen behöver mer plats än en modal ger (fält, granskning, filknapp),
så den är en riktig vy, och då måste omgången bäras med för hand: `vy.retur` håller hela
`ny`-vyn som den såg ut, och läggs tillbaka med `gaTill('ny', retur, true)`. Går man ut
utan att importera återställs den likadant. Samma fält får alltså inte lämnas oavspeglade —
`spegla()` måste köras innan man går härifrån.

`vy.retur` är också det som skiljer vyns två beteenden åt. Från registret hoppas kända namn
över; från en omgång bockas de i ändå, eftersom de ska stå på linjen även om de inte behöver
skapas. Räkningen på huvudknappen följer samma regel — se `uppdateraImportgranskning`.

**Kommatecknet är inte en avgränsare i `tolkaSkyttelista`.** Det ser ut som en förenkling
och är tvärtom det viktigaste beslutet i tolkaren: svenska listor skrivs *Efternamn,
Förnamn*, så en komma-CSV och en vanlig namnlista går inte att skilja åt automatiskt. Går
någon in och "förbättrar" det till att gissa separator blir "Ek, Anna" en skytt vid namn Ek
på förbandet Anna, och det tysta felet syns först i exporten. Semikolon och tabb, inget
annat — samma semikolon som appens CSV-export skriver.

Granskningen som `ritaImport` visar innan knappen trycks är inte pynt. En förlåtande tolkare
måste kunna granskas: den stryker rubrikrader, numrering och BOM, och det är rimligt bara
så länge användaren ser resultatet innan det skrivs. `granskaSkyttelista` rör därför inte
lagret, och `importeraSkyttar` är den enda som skriver.

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
- **Bygget lägger alla moduler i EN scope.** Två moduler får inte ha samma namn på toppnivå,
  hur privata de än ser ut i sin egen fil. `const VERSION` i `app.js` krockade med
  `lagring.js` egen `VERSION` och gav ett `SyntaxError` som välte hela appen i jsdom — men
  först i den *byggda* filen, aldrig när `src/` kördes som moduler. Appens utgåva heter
  därför `UTGAVA`.

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
python3 bygg.py     # måste köras först — proven kör mot docs/
npm test            # 120 prov: regler, export, import, hela flödet, spärrarna mot utgående trafik
```

**Bygg före du provar.** Det här är den enklaste fällan i arkivet och den värsta, eftersom
den inte ser ut som ett fel: ändrar du i `src/` och kör `npm test` utan att bygga först,
provas den *förra* byggda filen. Alla prov blir gröna, glatt och snabbt, och de säger
ingenting om det du nyss skrev. `npm run bygg` finns som genväg.

Flödesproven kör **den byggda filen** i jsdom, alltså samma artefakt som telefonen får. De
går igenom hela arbetsgången: tider på tre skyttar, poäng på samma tre, andra försök,
vapenhanteringsspärren, urvalet av de bästa träffarna, långt tryck som nollar, flyttläget,
raderingarna och att en färdig skytt inte får försök påhittade åt sig.

Exportproven skriver riktiga filer till en temporär katalog. XLSX kontrolleras genom att
öppnas med openpyxl (`~/.venvs/sra-ratta/bin/python`), PDF genom att renderas med
`qlmanage -t` — går den inte att rendera har något i strukturen gått sönder.

**Det proven inte täcker:** hur appen ser ut. jsdom renderar ingen CSS. Knappstorlekar,
radbrytning och om något är svårt att träffa med tummen i mörker måste ses på riktigt.

## Publicering

```bash
python3 bygg.py && npm test                       # bygg först, prova sedan
git commit -am "vad du gjorde" && git push        # det är hela publiceringen
cp docs/index.html ~/Desktop/"FM kompetensprov.html"   # den mejlbara filen
```

Kroken höjer versionen och bygger om i commiten, så bygget ovan är till för *proven* —
publiceringen sköter sitt eget bygge.

**Ett arkiv.** Källan och den byggda appen bor i `steeriks/fm-kompetensprov`, och Pages
serverar `main` + `/docs`. Att bygga och pusha *är* att publicera — det finns inget andra
arkiv att kopiera till och därmed inget som kan glida isär.

Så var det inte förut. Fram till 2026-08-12 låg källan privat i
`steeriks/fm-kompetensprov-kalla` medan ett skript kopierade `dist/` till ett publikt arkiv,
eftersom Pages kräver publikt arkiv på gratisplanen. När källan gjordes publik för granskning
föll hela skälet till uppdelningen bort. Det publika arkivet behöll namnet — det är det som
adressen sitter i — och källan flyttade in i det. `publicera.sh` finns inte längre.

Appen innehåller inga hemligheter och inga resultat lämnar telefonen, så det som är publikt
är programmet självt och hur det är gjort. Testdatats Fmid-värden är påhittade och skrivna i
`TreTre`-formen ovan, som inte liknar ett personnummer; det står som kommentar i
`test/export.test.mjs`.

`bygg.py` sätter `CACHE` i `docs/sw.js` till appens fingeravtryck, så en publicering slår
igenom av sig själv. Rör inte värdet i `src/sw.js` — det skrivs över vid varje bygge.

**Versionsnumret skrivs på ett enda ställe: `package.json`, och höjs av en krok.**
`.githooks/pre-commit` höjer rättningssiffran, kör `python3 bygg.py` och lägger
`package.json`, `docs/index.html` och `docs/sw.js` i commiten. Varje commit blir därmed en
egen utgåva, och `docs/` kan aldrig hamna efter `src/` i det som publiceras — kroken stänger
arkivets äldsta fälla. Aktivera den en gång per klon; kroken är versionerad, men var den
ligger är en lokal inställning:

```bash
git config core.hooksPath .githooks
```

Kroken avstår när en sammanslagning, ombasering, cherry-pick eller revert pågår — de skriver
om commits som redan har sitt nummer — och när ingenting är iscensatt, så en tom commit inte
blir en utgåvehöjning utan innehåll. `git commit --no-verify` hoppar över den helt. Större
steg än en rättningssiffra sätts för hand i `package.json`; kroken räknar vidare därifrån.

`bygg.py` bakar in numret i `<meta name="version">`, `app.js` läser taggen som `UTGAVA` och
visar den på tre ställen: `#utgava` i huvudets högerkant, `{{utgava}}` i `src/hjalp.md` (byts
i `ritaDokument()`, inte i bygget — texterna ska gå att läsa som de är i `src/`) och fotnoten
under Appinställningar. Samma regel som för `sw.js`: rör inte värdet i `src/index.html`, det
ska stå kvar på `utveckling`, vilket är sanningen för den som kör `npm run serve` mot `src/`.
Ett prov i `test/flode.test.mjs` jämför taggen i den byggda filen mot `package.json` och
kontrollerar alla tre ställena, så numret kan inte glida isär med det som visas.

**Kroken ersätter inte `python3 bygg.py` innan du provar.** Den bygger vid *commit*, inte vid
provkörning — proven läser fortfarande `docs/`, och en ändring i `src/` som inte byggts provas
mot den förra filen. Fällan nedan står kvar precis som förut.

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
