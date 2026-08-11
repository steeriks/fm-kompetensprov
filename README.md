# FM kompetensprov — Ak och Pistol

Instruktörsverktyg för Försvarsmaktens kompetensprov i **pistol** (Delmoment 14,
Kompetensprov BAS "PILEN") och **automatkarbin** (Delmoment 12, Kompetensprov Bas).
En webbapp som körs i telefonen, fungerar utan täckning och lagrar allt lokalt.

**Appen:** <https://steeriks.github.io/kompetensprov/>
— öppna i telefonen och välj *Lägg till på hemskärmen*.

Byggd för att användas i fält: **en hand, i mörker, utan täckning**. Stora knappar i
nederkant, inget systemtangentbord, ingen inloggning och ingenting som behöver nät.

## Så används den

Appen följer hur provet faktiskt går till. Skyttarna står uppställda på en linje,
instruktören skjuter en åt gången och tar tiderna; först när alla skjutit går gruppen fram
och poängen förs in. Två svep genom samma lista.

1. **Lägg upp en omgång** — prov, datum, plats, instruktör, och bocka i deltagarna i
   skjutordning. Numret de får är skyttens **tavelnummer** på banan och följer med hela
   vägen ut i exporten.
2. **TID-läget.** *Registrera tid för första skytt* öppnar tavla 1; därefter heter knappen
   *Nästa som saknar tid*. Siffrorna knappas rakt av som de står på timern — **555** blir
   5,55 och **6667** blir 66,67 — och komma går också att använda. *Spara & nästa skytt*
   hoppar direkt vidare, och vem som står på tur står under knappen.
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
- **⌂** längst upp till vänster går alltid hem, och sparar en påbörjad tid på vägen.
- **Listan står alltid där det finns något att göra.** Kommer du tillbaka från anvisningen
  eller exporten hamnar du i det läge vars knapp bär en siffra — och när alla fått tid
  byter den till POÄNG av sig själv.

### Radera

En enskild skytt raderas på sin rad under *Lägg till skyttar*, alla på en gång med
*Radera alla*. En omgång raderas genom att **svepa vänster** på den i listan. Allt frågar
först, och en raderad skytt tar sina resultat med sig.

## Regler appen känner till

Målet är **Helfigur 2020**: A 5, B 4, C 3, D 3, X 2, H 1 poäng.

| | Automatkarbin, Dm 12 Bas | Pistol, Dm 14 BAS (PILEN) |
|---|---|---|
| Avstånd | 50 m | 10 m |
| Träffar som räknas | 9 | 4 i XBCD + 2 i AH |
| Poängkvot | minst 1,0 | minst 2,0 |
| Försök | 3 | 3 |

Poängkvoten är räknade poäng delat med tiden mellan startsignal och sista skott.

**Appen tar emot exakt så många träffar som räknas.** Har skytten skjutit bättringsskott
är det de *räknande* träffarna du knappar in, alltså de bästa. När en målyta är full
dämpas dess knappar och fler tryck studsar; vill du byta ut en träff mot en bättre, håll
in knappen och nolla zonen först.

Osäker eller felaktig vapenhantering underkänner provet — kryssrutan finns på poängskärmen.

**Kvoten avrundas till två decimaler innan den jämförs med kravet.** Det som visas är det
som bedöms; en app som visar 1,00 och säger underkänt vore obegriplig i fält.

## Var uppgifterna finns

I telefonen, ingen annanstans. Ingen server, inget konto, ingen som kan se listorna.
Ingenting lämnar enheten förrän du själv trycker på *Dela resultat*.

Följden är att **du ansvarar för uppgifterna**: skyttarnas namn ligger kvar tills du
raderar dem. Under *Appinställningar* finns **Radera allt innehåll**, och **Spara kopia** /
**Läs in kopia** — en JSON-fil som också är vägen att flytta ett register till en annan
telefon. Inläsning lägger till, den skriver aldrig över.

Samma text, och hur appen installeras på iOS och Android, finns i appen under
*Appinställningar → Installation, data och licens*.

> Appen går även att skicka som **en enda HTML-fil** och öppna direkt ur mailet. Då saknar
> den egen säker adress och lagringen är opålitlig — Android kan neka den helt. Den vägen
> duger för att visa appen eller köra ett enstaka tillfälle. Ska resultaten sparas:
> använd den installerade versionen.

## Utveckling

Inga beroenden i appen — ren HTML, CSS och JavaScript, ingen CDN, inget ramverk.

```bash
npm install       # bara jsdom, och bara för testerna
npm run serve     # http://localhost:8390 mot src/
npm run bygg      # bakar ihop src/ till dist/index.html
npm test          # 64 prov: regelmotor, export och hela flödet i jsdom
```

Testerna kör mot `dist/`, så **bygg innan du provar**.

| Fil | Ansvar |
|---|---|
| `src/regler.js` | Provtabellen, poängräkning och anvisningstexterna — allt som skiljer proven åt ligger som data. |
| `src/lagring.js` | localStorage, säkerhetskopia, radering. |
| `src/export.js` | Text, CSV, XLSX och PDF — skrivna för hand, utan bibliotek. |
| `src/app.js` | Vyer, flöde och inmatning. |
| `src/anvandning.md` | Användarinstruktionen i appen; bakas in av bygget. |
| `src/hjalp.md` | Installation, data och licens; bakas in av bygget. |
| `bygg.py` | Slår ihop `src/` till en enda `dist/index.html`. |
| `gen_ikon.py` | Genererar ikonerna, ren stdlib. |
| `publicera.sh` | Kopierar `dist/` till det publika arkivet som GitHub Pages serverar. |

`dist/index.html` är både det som publiceras och det som kan mejlas — samma fil, så det
aldrig råder tvivel om vilken version någon kör.

Se **[PLAYBOOK.md](PLAYBOOK.md)** för hur delarna hänger ihop, vilka fällor som redan
kostat tid, och vad som gäller vid publicering.

## Licens

Fri att använda, kopiera och ändra under [MIT-licens](LICENSE).

Appen är ett hjälpmedel, **inte ett officiellt system**: den är inte utgiven av
Försvarsmakten, och kraven kommer ur handböckerna för respektive delmoment. Kontrollera
alltid mot gällande utgåva — det är instruktören som ansvarar för bedömningen, inte appen.

Buggar och önskemål: [issues i det publika
arkivet](https://github.com/steeriks/kompetensprov/issues).
