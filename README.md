# FM kompetensprov — Ak och Pistol

**Ett stöd för instruktören** vid genomförandet av Försvarsmaktens kompetensprov för
**pistol** (Delmoment 14, Kompetensprov BAS "PILEN") och **automatkarbin** (Delmoment 12,
Kompetensprov Bas, på 50 m eller — i undantagsfall — 30 m). En webbapp (PWA) som körs i telefonen, fungerar utan täckning och lagrar
allt lokalt.

> **Appen är inte utgiven av Försvarsmakten och är inget officiellt system.** Den är
> privat gjord som ett hjälpmedel: den håller ordning på skjutordningen, räknar
> poängkvoten och samlar resultaten. Kraven den räknar med är hämtade ur handböckerna för
> respektive delmoment och ska kontrolleras mot gällande utgåva. Bedömningen är
> instruktörens.

**Appen:** <https://steeriks.github.io/fm-kompetensprov/>
— öppna i telefonen och välj *Lägg till på hemskärmen*.

Byggd för att användas i fält: **en hand, i mörker, utan täckning**. Stora knappar i
nederkant, inget systemtangentbord, ingen inloggning och ingenting som behöver nät.

## Så används den

Appen följer hur provet faktiskt går till. Skyttarna står uppställda på en linje,
instruktören kommenderar och startar en skytt åt gången och registrerar tiderna; först när
alla skjutit går omgången fram och poängen registreras in. Två svep genom samma lista.

1. **Lägg upp en omgång** — prov, datum, plats, instruktör, och bocka i deltagarna i
   skjutordning. Numret de får är skyttens **tavelnummer** på banan och följer med hela
   vägen ut i exporten. *Starta omgången* går rakt in i den. *Spara utan att starta*
   lägger den på startsidan märkt **ej påbörjad** — omgången kan alltså förberedas kvällen
   innan, med eller utan skjutordning, och öppnas när gruppen står på plats.
2. **TID-läget.** *Registrera tid för första skytt* öppnar tavla 1; därefter heter knappen
   *Nästa som saknar tid*, och växeln visar inom parentes hur många som väntar. Siffrorna
   knappas rakt av som de står på timern — **555** blir 5,55 och **6667** blir 66,67 — och
   komma går också att använda. *Spara & nästa skytt* hoppar direkt vidare, och vem som
   står på tur står under knappen.
3. **Gå fram till tavlorna.** När sista tiden är inne heter knappen *Spara & börja med
   poängen* och lämnar över till tavla 1 i **POÄNG-läget**.
4. **Knappa in träffarna** — en tryckning per träff på respektive zon. Poängen står under
   varje knapp, summan och poängkvoten räknas medan du knappar, och utfallet skrivs ut i
   klartext: **Godkänd** i grönt, **Underkänd** i rött. Håll in en knapp för att nolla den.
5. **Registrera & nästa skytt** låser försöket och går vidare. På sista skytten heter den
   *Registrera sista resultatet*, och då summeras omgången: *"Omgången klar — 2 av 3
   godkända."*
6. **Dela resultat** ger hela omgången som text, PDF, Excel eller CSV, redo att mejla.

**Så använder du appen** på startsidan är en kortfattad användarinstruktion: arbetsgången,
ändringar under omgången, delning och säkerhetskopior.

**Anvisning för genomförande** finns både på startsidan och som knapp mitt i en omgång,
där den öppnas på det prov som skjuts: avstånd, mål, ställning, träffkrav, genomförandet
steg för steg med instruktörens repliker, reglerna för tid och bättring, bedömningskraven
och zontabellen.

### Under omgången

- **Fylla på:** *+ Lägg till skytt* under listan tar in någon ur registret eller
  registrerar en ny på plats, utan att du lämnar omgången. Hen hamnar på nästa lediga tavla.
- **Byta ordning:** håll in en rad, så får varje skytt ett handtag (**☰**). Dra i handtaget
  och tryck *Klar med ordningen*. Numret sitter på **tavlan**, inte på personen — den som
  hamnar på tredje raden får nummer 3.
- **Omtag:** provet får skjutas tre gånger. Ett nytt försök startas alltid med flit, med
  *+ Nytt försök* på raden; ett tryck på en färdig skytt gör ingenting.
- **Stega mellan skyttarna:** i TID-läget står en pil på var sida om namnet. De går en
  tavla fram eller tillbaka i skjutordningen — vägen tillbaka när fel skytt öppnats eller
  en tid ska rättas. Tiden du hunnit knappa sparas på vägen, och pilen slocknar vid
  linjens ände i stället för att gå runt.
- **⌂** längst upp till vänster går alltid hem, och sparar en påbörjad tid på vägen.
- **Listan står alltid där det finns något att göra.** Kommer du tillbaka från anvisningen
  eller exporten hamnar du i det läge vars knapp bär en siffra — och när alla fått tid
  byter den till POÄNG av sig själv.

### Skytteregistret

*+ Ny skytt* öppnar en ruta med tre fält: **namn**, **förband** och **Fmid/Anstnr**. Bara
namnet måste fyllas i — de andra två står grå med *valfritt* tills något skrivs in.
Fmid/Anstnr följer med till exporten och står där **före namnet**, i alla fyra formaten.

**Importera lista** tar hela skjutlaget på en gång. Klistra in listan eller läs in en fil,
en rad per skytt:

```
Ek, Anna
Berg, Bo; 1. plut
Craf, Cia; 2. plut; CiaCra05
```

Fälten skiljs med **semikolon eller tabb — aldrig med komma.** Svenska namnlistor skrivs
*Efternamn, Förnamn*, och en lista där varje rad har precis ett komma är långt vanligare än
en komma-CSV; att gissa mellan dem hade gjort "Ek, Anna" till en skytt vid namn Ek på
förbandet Anna. Numrering och streck i radens början stryks, rubrikraden från ett kalkylark
hoppas över, och BOM, CRLF och citerade celler från Excel hanteras.

Innan något skrivs visar appen vilka som blir nya, vilka som redan finns och vilka rader
den inte kunde tolka. Dubbletter känns igen på **Fmid när båda har det, annars på namnet** —
så två skyttar med samma namn men olika Fmid räknas som två personer, och samma lista kan
köras två gånger utan att registret blir dubbelt.

Knappen finns på två ställen och gör olika saker. Under *Lägg till & hantera skyttar* fyller
den registret. Under *+ Ny omgång* fyller den dessutom linjen: **ordningen i listan blir
skjutordningen**, och den som redan finns i registret bockas i utan att skapas på nytt.

### Radera

Skyttelistan har en genväg till *+ Ny omgång* överst — dit man ändå ska när registret är
påfyllt.

En enskild omgång eller skytt raderas med samma grepp: **håll in** raden tills en soptunna
läggs fram i den, och tryck sedan på soptunnan. Omgångarna ligger på startsidan, skyttarna
under *Lägg till & hantera skyttar*, där alla också går att ta bort på en gång med
*Radera alla*. Allt frågar först, och en raderad skytt tar sina resultat med sig.

## Regler appen känner till

Målet är **Helfigur 2020**: A 5, B 4, C 3, D 3, X 2, H 1 poäng.

| | Automatkarbin, Dm 12 Bas | Automatkarbin, Dm 12 Bas (30 m) | Pistol, Dm 14 BAS (PILEN) |
|---|---|---|---|
| Avstånd | 50 m | 30 m | 10 m |
| Träffar som räknas | 9 | 9 | 4 i XBCD + 2 i AH |
| Poängkvot | minst 1,0 | minst 1,3 | minst 2,0 |
| Försök | 3 | 3 | 3 |

**30 m är undantaget.** Automatkarbinens delmoment 12 skjuts på 50 m; finns ingen
50-metersbana att tillgå får det skjutas på 30 m i stället, och kravet på poängkvot är då
1,3. Genomförandet är detsamma. Provet väljs för sig när omgången läggs upp, så protokollet
visar vilket avstånd som gällde.

Poängkvoten är räknade poäng delat med tiden mellan startsignal och sista skott.

**Knappa in varje hål i tavlan — appen väljer ut de bästa.** Bättringsskotten knappas in
som alla andra träffar, och målytan har inget tak. Räknaren i målytans rubrik säger vad som
gäller: *4 av 4 — klart*, eller *(6 av 4) — de 4 bästa räknas*, där siffrorna inom röd
parentes är fler än de som räknas. Instruktören behöver alltså
inte sortera träffar i huvudet framme vid tavlan. Ett feltryck rättas som förut: håll in
zonknappen så nollas den, och knappa in rätt.

Blir antalet orimligt — mer än dubbelt så många träffar som målytan räknar — påpekar appen
det utan att spärra något, så att ett tryck för mycket upptäcks i stället för att följa med
in i protokollet.

**Exporten bär bara de träffar som räknas.** Bättringsskotten hör hemma i appen, där de
knappas in; protokollet som lämnar telefonen visar de nio — eller fyra plus två — träffar
bedömningen vilar på. Zonkolumnerna summerar därför till det antal som krävs, och poängen
går att räkna efter för hand.

Osäker eller felaktig vapenhantering underkänner provet — kryssrutan finns på poängskärmen.

**Kvoten avrundas till två decimaler innan den jämförs med kravet.** Det som visas är det
som bedöms; en app som visar 1,00 och säger underkänt vore obegriplig i fält.

## Var uppgifterna finns

I telefonen, ingen annanstans. Ingen server, inget konto, ingen som kan se listorna.
Ingenting lämnar enheten förrän du själv trycker på *Dela resultat*.

Appen kan inte skicka iväg något på egen hand: den saknar kod för det, och webbläsaren är
dessutom instruerad att stänga varje sådan väg. Den hör inte heller av sig till servern när
den startar — en gång installerad startar den ur telefonens eget minne.

Två saker att veta, eftersom de ligger utanför vad appen rår över:

- **Delningsrutan är din.** Trycker du *Dela resultat* och väljer Mail, iCloud eller en
  chattapp så går uppgifterna dit. Det är meningen med knappen — men det är där de lämnar
  telefonen, så välj mottagare med samma omsorg som du hade valt för en papperslista.
- **Enhetens säkerhetskopia tar med appens data.** Har du iCloud-säkerhetskopiering påslagen
  följer registret med dit, precis som för andra appar i telefonen.

Följden är att **du ansvarar för uppgifterna**: skyttarnas namn ligger kvar tills du
raderar dem. Under *Appinställningar* finns **Radera allt innehåll**, och **Spara kopia** /
**Läs in kopia** — en JSON-fil som också är vägen att flytta ett register till en annan
telefon. Inläsning lägger till, den skriver aldrig över.

Samma text, och hur appen installeras på iOS och Android, finns i appen under
*Appinställningar → Om appen*.

> Appen går även att skicka som **en enda HTML-fil** och öppna direkt ur mailet. Då saknar
> den egen säker adress och lagringen är opålitlig — Android kan neka den helt. Den vägen
> duger för att visa appen eller köra ett enstaka tillfälle. Ska resultaten sparas:
> använd den installerade versionen.

## Utveckling

Inga beroenden i appen — ren HTML, CSS och JavaScript, ingen CDN, inget ramverk.

```bash
npm install       # bara jsdom, och bara för testerna
npm run serve     # http://localhost:8390 mot src/
npm run bygg      # bakar ihop src/ till docs/index.html
npm test          # 120 prov: regelmotor, export, import och hela flödet i jsdom
```

Testerna kör mot `docs/`, så **bygg innan du provar**.

| Fil | Ansvar |
|---|---|
| `src/regler.js` | Provtabellen, poängräkning och anvisningstexterna — allt som skiljer proven åt ligger som data. |
| `src/lagring.js` | localStorage, säkerhetskopia, radering och tolkningen av en inklistrad skyttelista. |
| `src/export.js` | Text, CSV, XLSX och PDF — skrivna för hand, utan bibliotek. |
| `src/app.js` | Vyer, flöde och inmatning. |
| `src/anvandning.md` | Användarinstruktionen i appen; bakas in av bygget. |
| `src/hjalp.md` | *Om appen* — installation, data och licens; bakas in av bygget. |
| `bygg.py` | Slår ihop `src/` till en enda `docs/index.html` — den mapp GitHub Pages serverar. |
| `gen_ikon.py` | Genererar ikonerna, ren stdlib. |

`docs/index.html` är både det som publiceras och det som kan mejlas — samma fil, så det
aldrig råder tvivel om vilken version någon kör.

**Varje commit är en egen utgåva.** En git-krok i `.githooks/pre-commit` höjer
rättningssiffran i `package.json`, bygger om `docs/` och lägger med båda i commiten. Aktivera
den en gång efter en klon:

```bash
git config core.hooksPath .githooks
```

Numret bakas in i den byggda filen och visas på tre ställen i appen: längst upp till höger i
varje vy, i *Om appen* och under *Appinställningar* — så den som anmäler ett fel kan säga
vilken utgåva det gäller, och svaret pekar på en bestämd commit. Större steg än en
rättningssiffra sätts för hand i `package.json`; kroken räknar vidare därifrån.
`git commit --no-verify` hoppar över den.

Se **[PLAYBOOK.md](PLAYBOOK.md)** för hur delarna hänger ihop, vilka fällor som redan
kostat tid, och vad som gäller vid publicering.

## Licens

Fri att använda, kopiera och ändra under [MIT-licens](LICENSE).

Appen lämnas som den är, utan garantier. Se förbehållet överst: den är inte utgiven av
Försvarsmakten, och ansvaret för bedömningen ligger hos instruktören.

Buggar och önskemål: [issues i det publika
arkivet](https://github.com/steeriks/fm-kompetensprov/issues).
