// Regelverket — Försvarsmaktens kompetensprov, pistol och automatkarbin.
//
// Allt som skiljer proven åt ligger som DATA i PROV nedan, inte som kod:
// målytor, hur många träffar som räknas i varje målyta, och kravet på
// poängkvot. Ett nytt delmoment ska kunna läggas till här utan att en enda
// rad räknelogik rörs.

// Helfigur 2020. Skalan är inte fallande — A är ansiktet (5 p) och H hjälmen
// (1 p), medan X är bröstet (2 p). Zonerna delas i två målytor på pistol.
export const ZONPOANG = { A: 5, B: 4, C: 3, D: 3, X: 2, H: 1 };

export const PROV = {
  ak: {
    kod: 'ak',
    namn: 'Automatkarbin',
    delmoment: 'Delmoment 12 – Kompetensprov Bas',
    avstand: '50 m',
    mal: '1/1-figur',
    stallning: 'Liggande med stöd → knästående/sittande → stående',
    pkKrav: 1.0,
    maxForsok: 3,
    // De nio bästa träffarna räknas, oavsett var på figuren de sitter.
    grupper: [
      { id: 'alla', namn: 'Träffar', zoner: ['A', 'B', 'C', 'D', 'X', 'H'], antal: 9 },
    ],
  },
  pist: {
    kod: 'pist',
    namn: 'Pistol',
    delmoment: 'Delmoment 14 – Kompetensprov BAS (PILEN)',
    avstand: '10 m',
    mal: '1/1-figur',
    stallning: 'Stående grundställning — vändning, drag och omladdning',
    pkKrav: 2.0,
    maxForsok: 3,
    // Fyra träff i kroppen och två i huvudet. Bättringsskott får gå mot
    // samtliga zoner, men bara de bästa i varje målyta räknas in i kvoten.
    grupper: [
      { id: 'xbcd', namn: 'XBCD', zoner: ['X', 'B', 'C', 'D'], antal: 4 },
      { id: 'ah', namn: 'AH', zoner: ['A', 'H'], antal: 2 },
    ],
  },
};

export const ZONORDNING = ['A', 'B', 'C', 'D', 'X', 'H'];

/** Alla zoner som ingår i provet, i visningsordning. */
export function zonerFor(provKod) {
  const grupper = PROV[provKod].grupper;
  return ZONORDNING.filter((z) => grupper.some((g) => g.zoner.includes(z)));
}

/** Avrundning till två decimaler — samma tal som visas är det som bedöms. */
export function tvaDecimaler(n) {
  return Math.round(n * 100) / 100;
}

/** Gruppen en zon tillhör (XBCD eller AH på pistol, den enda på ak). */
export function gruppFor(provKod, zon) {
  return PROV[provKod].grupper.find((g) => g.zoner.includes(zon)) || null;
}

/** Antal träffar som lagts in i en målyta. */
export function antalIGrupp(grupp, traffar = {}) {
  return grupp.zoner.reduce((n, z) => n + (traffar[z] || 0), 0);
}

/**
 * Sant när målytan har sitt fulla antal träffar. Målytan tar emot exakt så
 * många träffar som räknas — nio på automatkarbin, fyra plus två på pistol.
 * Skjuter skytten bättringsskott är det de RÄKNANDE träffarna som knappas in,
 * inte alla hål i tavlan.
 */
export function arFull(provKod, zon, traffar = {}) {
  const g = gruppFor(provKod, zon);
  return g ? antalIGrupp(g, traffar) >= g.antal : false;
}

/**
 * Bedömer ett försök.
 *
 * traffar: { A: 2, C: 4, ... } — antal träffar per zon, som de knappats in.
 * tid: sekunder mellan startsignal och sista skott, eller null om den inte
 *      förts in ännu.
 *
 * Returnerar poäng, poängkvot, godkänt och en lista brister i klartext. Kvoten
 * jämförs mot kravet EFTER avrundning till två decimaler: det är talet som står
 * på skärmen och i protokollet, och en app som visar 1,00 och säger underkänt
 * vore obegriplig i fält.
 */
export function bedom(provKod, traffar = {}, tid = null, vapenhanteringUnderkand = false) {
  const prov = PROV[provKod];
  const brister = [];
  let poang = 0;

  const grupper = prov.grupper.map((g) => {
    // Träffarna som en lista poängvärden, bästa först. Formuläret släpper bara
    // in så många träffar som räknas, men avhuggningen står kvar som skydd:
    // en inläst säkerhetskopia från en äldre version kan bära fler.
    const varden = [];
    for (const zon of g.zoner) {
      for (let i = 0; i < (traffar[zon] || 0); i++) varden.push(ZONPOANG[zon]);
    }
    varden.sort((a, b) => b - a);
    const raknade = varden.slice(0, g.antal);
    const summa = raknade.reduce((a, b) => a + b, 0);
    poang += summa;
    if (varden.length < g.antal) {
      brister.push(
        prov.grupper.length > 1
          ? `${g.namn}: ${varden.length} av ${g.antal} träff`
          : `${varden.length} av ${g.antal} träff`,
      );
    }
    return {
      id: g.id, namn: g.namn, antal: varden.length, kravAntal: g.antal,
      poang: summa, over: Math.max(0, varden.length - g.antal),
    };
  });

  const pk = tid > 0 ? tvaDecimaler(poang / tid) : null;
  if (tid === null || tid === undefined || tid === '') brister.push('Tid saknas');
  else if (!(tid > 0)) brister.push('Ogiltig tid');
  else if (pk < prov.pkKrav) brister.push(`Poängkvot ${komma(pk)} — kravet är ${komma(prov.pkKrav)}`);
  if (vapenhanteringUnderkand) brister.push('Underkänd vapenhantering');

  return {
    poang,
    pk,
    grupper,
    brister,
    godkand: brister.length === 0,
    // Komplett = allt som behövs för en bedömning är infört. Ett försök kan
    // vara komplett och ändå underkänt; det är två olika frågor.
    komplett: tid > 0 && grupper.every((g) => g.antal >= g.kravAntal),
  };
}

/** 1.5 → "1,5" — svenskt decimaltecken överallt i gränssnitt och export. */
export function komma(n, decimaler = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toFixed(decimaler).replace('.', ',');
}

/** "4,23" eller "4.23" → 4.23. Tomt eller skräp ger null. */
export function taltolk(text) {
  if (text === null || text === undefined) return null;
  const rensad = String(text).trim().replace(',', '.');
  if (!rensad) return null;
  const n = Number(rensad);
  return Number.isFinite(n) ? n : null;
}
