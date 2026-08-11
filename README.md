# FM kompetensprov — Ak och Pistol

Instruktörsverktyg för Försvarsmaktens kompetensprov i **pistol** (Delmoment 14,
Kompetensprov BAS "PILEN") och **automatkarbin** (Delmoment 12, Kompetensprov Bas).
En webbapp som körs i telefonen, fungerar utan täckning, och lagrar allt lokalt.

**Appen:** <https://steeriks.github.io/kompetensprov/>

## Så används den

Appen följer hur provet faktiskt går till. Skyttarna står uppställda på en linje och
instruktören skjuter en åt gången:

1. **Lägg upp en omgång** — prov, datum, plats, och bocka i deltagarna i skjutordning.
   Numret de får är samma nummer som skyttens tavla på banan, och följer med hela vägen
   ut i exporten.
2. **TID-läget:** knappa in tiden för en skytt, tryck *Spara & nästa skytt*, och appen
   hoppar direkt till nästa i ordningen. Hela linjen i ett svep. Siffrorna knappas rakt
   av som de står på timern — **555** blir 5,55 och **6667** blir 66,67 — men komma går
   också att använda.
   Under knappen står vem som är näste man, med tavelnummer. När sista skytten fått sin
   tid byter knappen till *Spara & börja med poängen*.
3. Gå fram till tavlorna. Appen står redan på första tavlan i **POÄNG-läget**; annars
   tar *Nästa som saknar poäng* dig dit.
4. **Knappa in träffarna** — en tryckning per träff på respektive zon. Poängen står under
   varje knapp och kvoten räknas medan du knappar. Håll in en knapp för att nolla den.
5. **Registrera resultat** låser försöket och går vidare till nästa skytt. Kvoten och
   godkänt/underkänt syns på skyttens rad i listan.
6. **Dela** ger hela omgången som text, PDF, Excel eller CSV, redo att mejla.

**Anvisningen** finns alltid till hands — på startsidan och som knapp mitt i en omgång, där
den öppnas på det prov som skjuts. Den innehåller avstånd, mål, ställning, träffkrav,
genomförandet steg för steg med instruktörens repliker, reglerna för tid och bättring,
bedömningskraven och zontabellen.

**⌂** längst upp till vänster går alltid tillbaka till startsidan; en påbörjad tid sparas
på vägen. Vägen tillbaka till vallistan finns i nederkant på de vyer som ligger
inuti en omgång.

**Efterhandsändringar i en omgång:** *+ Lägg till skytt* under listan tar in någon ur
registret eller registrerar en ny på plats, utan att du lämnar omgången — hen hamnar på
nästa lediga tavla. **Håll in en rad** för att lyfta skytten och dra hen till en annan
plats. Numret sitter på *tavlan*, inte på personen: den som hamnar på tredje raden får
nummer 3.

**Radera:** en enskild skytt raderas på sin rad under *Skyttar*, alla på en gång med
*Radera alla*. En omgång raderas genom att **svepa vänster** på den i listan. Allt frågar
först, och en raderad skytt tar sina resultat med sig.

En skytt kan skjuta om provet — *+ Nytt försök* på raden. Provet får skjutas tre gånger
innan kompletterande träning krävs, och appen räknar försöken.

## Regler appen känner till

Målet är **Helfigur 2020**: A 5, B 4, C 3, D 3, X 2, H 1 poäng.

| | Automatkarbin, Dm 12 Bas | Pistol, Dm 14 BAS (PILEN) |
|---|---|---|
| Avstånd | 50 m | 10 m |
| Träffar som räknas | 9 bästa | 4 bästa i XBCD + 2 bästa i AH |
| Poängkvot | minst 1,0 | minst 2,0 |

Poängkvoten är räknade poäng delat med tiden mellan startsignal och sista skott.

**Appen tar emot exakt så många träffar som räknas** — nio på automatkarbin, fyra plus
två på pistol. Har skytten skjutit bättringsskott är det de *räknande* träffarna du
knappar in, alltså de bästa. När en målyta är full dämpas dess knappar och fler tryck
studsar. Vill du byta ut en träff mot en bättre: håll in knappen för att nolla zonen
först.

Osäker eller felaktig vapenhantering underkänner provet, och kryssrutan för det finns
på poängskärmen.

**Kvoten avrundas till två decimaler innan den jämförs med kravet.** Det som visas är
det som bedöms — en app som visar 1,00 och säger underkänt vore obegriplig i fält.

## Var resultaten bor

I telefonen, ingen annanstans. Ingen server, inget konto, ingen inloggning. Ingenting
lämnar enheten förrän du själv trycker på *Dela*.

Priset är att lagringen sitter i webbläsaren: rensar du den försvinner listorna. Under
*Inställningar* finns **Spara kopia** och **Läs in kopia** — en JSON-fil som också är
vägen att flytta ett register till en annan telefon. Inläsning lägger till, den skriver
aldrig över.

**Installera den på hemskärmen** (Dela → Lägg till på hemskärmen). Då fungerar den utan
täckning, och lagringen är beständig.

> Appen går även att skicka som **en enda HTML-fil** och öppna direkt ur mailet. Då
> saknar den egen säker adress, och lagringen är opålitlig — Android kan neka den helt.
> Den vägen är bra för att visa appen eller köra ett enstaka tillfälle. Ska resultaten
> sparas: använd den installerade versionen.

## Utveckling

Ingen byggkedja, inga beroenden i appen — bara ren HTML, CSS och JavaScript.

```bash
npm run serve     # http://localhost:8390 mot src/
npm test          # regelmotor, export och hela flödet i jsdom
npm run bygg      # bakar ihop src/ till dist/index.html
```

`npm test` kräver `jsdom` (`npm install`), som bara används av testerna.

| Fil | Ansvar |
|---|---|
| `src/regler.js` | Provtabellen och all poängräkning. Nya delmoment läggs till som data. |
| `src/lagring.js` | localStorage, säkerhetskopia, radering. |
| `src/export.js` | Text, CSV, XLSX och PDF — skrivna för hand, utan bibliotek. |
| `src/app.js` | Vyer och flöde. |
| `bygg.py` | Slår ihop modulerna till `dist/index.html`. |
| `gen_ikon.py` | Genererar ikonerna, ren stdlib. |

`dist/index.html` är både det som publiceras och det som kan mejlas — samma fil, så det
aldrig råder tvivel om vilken version någon kör. `publicera.sh` kopierar `dist/` till det
publika repot som GitHub Pages serverar.

Se [PLAYBOOK.md](PLAYBOOK.md) för hur delarna hänger ihop och vad som är värt att veta
innan något ändras.
