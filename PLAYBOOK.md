# Playbook — FM kompetensprov

Handbok för den som ska ändra i appen. README beskriver hur den *används*; här står
varför den ser ut som den gör och var fällorna ligger.

## Grundvalen

**Appen är en fil.** `src/` är uppdelad för att gå att läsa och testa, men det som
distribueras är `dist/index.html` med allt inbakat — CSS, JavaScript och favikonen. Samma
fil serveras av GitHub Pages och kan mejlas som bilaga. `bygg.py` vägrar bygga om något
externt smugit sig in (`src=`/`href=` mot `http`), för appen ska fungera på en skjutbana
utan täckning.

**Reglerna är data, inte kod.** `PROV` i `src/regler.js` beskriver varje delmoment:
målytor, hur många träffar som räknas i varje målyta, kravet på poängkvot, och hur många
försök som är tillåtna. `bedom()` känner inte till något prov — den läser tabellen. Ett
nytt delmoment läggs till genom att fylla på `PROV`, inte genom att skriva om räkningen.

**Målytan har ett tak, inte ett urval.** Både pistol och Ak tillåter bättringsskott efter
omladdning, men bara de räknande träffarna förs in: nio på Ak, fyra plus två på pistol.
`arFull()` i `regler.js` avgör när en målyta är full, och knapptrycket studsar med en
förklaring i stället för att räkna upp. Ska en träff bytas mot en bättre nollas zonen
med ett långt tryck först.

Avhuggningen "de N bästa" står ändå kvar i `bedom()`. Den är inte längre ett urval utan
ett skydd: en säkerhetskopia från en äldre version kan bära fler träffar än taket, och då
ska poängen ändå bli rätt i stället för för hög.

## Två svep, inte ett formulär

Hela gränssnittet är byggt kring att provet genomförs i två vändor: alla tiderna först,
alla poängen sedan. Det är därför vallistan har en **lägesväljare** i stället för ett
formulär per skytt, och därför `nastaSkytt()` finns — den letar upp nästa som saknar det
som läget handlar om, och varvar om från början när den nått slutet.

`lagring.pagaende()` är gångjärnet: den ger skyttens *öppna* försök, det som ännu inte
registrerats. Tidssvepet skapar det, poängsvepet hittar tillbaka till samma post
timmar senare. Först `registrera()` låser posten, och då startar nästa tryck ett nytt
försök i stället.

## Fällor som redan kostat tid

- **`structuredClone` finns inte i äldre iOS-Safari.** Den användes först för att skapa
  ett tomt lager och gjorde att `las()` kastade — vilket testerna maskerade genom att
  cachen då aldrig fylldes. Bygg tomma objekt med en funktion i stället.
- **Historiken blir djup om varje skärm pushas.** Att gå vidare till nästa skytt och att
  återvända till listan *ersätter* posten (`gaTill(…, true)`). Pilen i huvudet navigerar
  dessutom uttryckligen (`OVANFOR`) i stället för att lita på stacken, så den hamnar rätt
  oavsett hur man tagit sig dit.
- **Listan ritas om vid varje tryck.** Element som hämtats före ett klick är döda efter
  det. Gäller både kod och tester — hämta om.
- **`localStorage` läses en gång och hålls i minnet.** Ett test som lägger in data efter
  att appen startat ser den inte. Testerna sår därför via `beforeParse` i jsdom, innan
  skripten kör.

## Exporten

Fyra format ur samma underlag (`underlag()` i `src/export.js`), inga bibliotek:

- **Text** för mailet, **CSV** med BOM och semikolon så att svensk Excel öppnar den rätt.
- **XLSX** är en ZIP med XML. Posterna skrivs **okomprimerade (STORED)** — giltigt enligt
  formatet, och därmed behövs ingen deflate. CRC32 räknas i `crc32()`. `styles.xml` måste
  ha både `cellXfs` och `cellStyles`, annars klagar läsare på att standardstilen saknas.
- **PDF** byggs för hand: inbyggd Helvetica, `WinAnsiEncoding`, och byteoffsets i
  xref-tabellen. Texten kodas som WinAnsi-byte, inte UTF-8 — å ä ö ligger under 256, men
  tankstreck och avbrottstecken måste översättas uttryckligen (se `SARSKILDA`), annars
  blir de frågetecken. Kolumnbredderna kontrolleras mot sidbredden vid bygget; summerar
  de för högt kastar `somPdf()` hellre än att skriva utanför pappret.

Utskriftsstilmallen i `style.css` är kvar med flit: `window.print()` ger "Spara som PDF"
på iOS och papper på banan, och är reserven om den handskrivna PDF:en någon gång skulle
visa sig spröd.

## Prov

```bash
npm test            # 33 prov: regelmotor, export, hela flödet
python3 bygg.py     # måste köras innan flödesproven — de kör mot dist/
```

Flödesproven kör **den byggda filen** i jsdom, alltså samma artefakt som telefonen får.
De går igenom en hel omgång: tider på tre skyttar, poäng på samma tre, andra försök,
vapenhanteringsspärren, långt tryck som nollar, och att radera en skytt tar med sig
resultaten.

Exportproven skriver riktiga filer till en temporär katalog. XLSX kontrolleras genom att
öppnas med openpyxl (`~/.venvs/sra-ratta/bin/python`), PDF genom att renderas med
`qlmanage -t` — går den inte att rendera har något i strukturen gått sönder.

**Det proven inte täcker:** hur appen ser ut. jsdom renderar ingen CSS. Knappstorlekar,
radbrytning och om något är svårt att träffa med tummen i mörker måste ses på riktigt.

## Publicering

```bash
python3 bygg.py
./publicera.sh          # kopierar dist/ till det publika repot och pushar
```

Källan ligger privat i `steeriks/fm-kompetensprov`. Det som Pages serverar ligger i det
publika `steeriks/kompetensprov` — GitHub Pages kräver publikt repo på gratisplanen.
Appen innehåller inga hemligheter, och inga resultat lämnar telefonen, så det som blir
publikt är enbart programmet självt.

Höj `CACHE`-versionen i `src/sw.js` när något ändrats som måste slå igenom direkt;
servicearbetaren hämtar annars gärna den gamla filen ur cachen.
