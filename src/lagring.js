// Lagring — allt bor i telefonen, under en enda nyckel i localStorage.
//
// Ingen server, inget konto, ingenting lämnar enheten förrän du själv trycker
// på exportknappen. Priset är att lagringen sitter i webbläsaren och kan
// försvinna om den töms, och att den är opålitlig när appen öppnas som lös fil
// (file://). Därför finns säkerhetskopiering till fil, som också är vägen att
// flytta ett register till en annan telefon.

const NYCKEL = 'fm-kompetensprov';
const VERSION = 1;

// Ett tomt lager byggs varje gång i stället för att klonas från en förlaga:
// structuredClone finns inte i äldre iOS-Safari, och appen ska starta även på
// en telefon som inte uppdaterats på ett par år.
const tomtLager = () => ({ version: VERSION, personer: [], omgangar: [], resultat: [] });

let data = null;

function nyttId() {
  // Tidsstämpel + slump: sorterbart, och kan inte krocka mellan två poster
  // som skapas i samma millisekund.
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** Läser hela lagret. Trasigt eller saknat innehåll ger ett tomt lager. */
export function las() {
  if (data) return data;
  try {
    const ratt = localStorage.getItem(NYCKEL);
    data = ratt ? JSON.parse(ratt) : tomtLager();
  } catch {
    data = tomtLager();
  }
  for (const falt of ['personer', 'omgangar', 'resultat']) {
    if (!Array.isArray(data[falt])) data[falt] = [];
  }
  data.version = VERSION;
  return data;
}

/** Skriver ner lagret. Returnerar false om utrymmet tagit slut eller nekats. */
export function spara() {
  try {
    localStorage.setItem(NYCKEL, JSON.stringify(las()));
    return true;
  } catch {
    return false;
  }
}

/** Sant när lagringen faktiskt går att skriva till — falskt på lös fil i
 *  vissa webbläsare, och då ska appen säga ifrån i stället för att tappa data
 *  under tystnad. */
export function lagringFungerar() {
  try {
    localStorage.setItem(NYCKEL + '-prov', '1');
    localStorage.removeItem(NYCKEL + '-prov');
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- personer

export function personer() {
  return las().personer.slice().sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
}

export function person(id) {
  return las().personer.find((p) => p.id === id) || null;
}

export function laggTillPerson(namn, forband = '') {
  const p = {
    id: nyttId(),
    namn: String(namn).trim(),
    forband: String(forband).trim(),
    skapad: new Date().toISOString(),
  };
  las().personer.push(p);
  spara();
  return p;
}

export function andraPerson(id, namn, forband) {
  const p = person(id);
  if (!p) return null;
  p.namn = String(namn).trim();
  p.forband = String(forband).trim();
  spara();
  return p;
}

/** Tar bort en person OCH alla resultat som hör till hen — annars blir det
 *  resultatrader utan ägare, och de skulle dyka upp tomma i exporten. */
export function raderaPerson(id) {
  const d = las();
  d.personer = d.personer.filter((p) => p.id !== id);
  d.resultat = d.resultat.filter((r) => r.personId !== id);
  for (const o of d.omgangar) o.deltagare = o.deltagare.filter((x) => x !== id);
  spara();
}

// --------------------------------------------------------------- omgångar

export function omgangar() {
  return las().omgangar.slice().sort((a, b) =>
    (b.datum + b.id).localeCompare(a.datum + a.id));
}

export function omgang(id) {
  return las().omgangar.find((o) => o.id === id) || null;
}

export function laggTillOmgang({ gren, datum, plats = '', instruktor = '', deltagare = [] }) {
  const o = {
    id: nyttId(),
    gren,
    datum: datum || new Date().toISOString().slice(0, 10),
    plats: plats.trim(),
    instruktor: instruktor.trim(),
    deltagare: deltagare.slice(),
    skapad: new Date().toISOString(),
  };
  las().omgangar.push(o);
  spara();
  return o;
}

export function andraOmgang(id, andringar) {
  const o = omgang(id);
  if (!o) return null;
  Object.assign(o, andringar);
  spara();
  return o;
}

export function raderaOmgang(id) {
  const d = las();
  d.omgangar = d.omgangar.filter((o) => o.id !== id);
  d.resultat = d.resultat.filter((r) => r.omgangId !== id);
  spara();
}

// --------------------------------------------------------------- resultat

/** Alla försök i en omgång, äldst först. */
export function resultat(omgangId) {
  return las().resultat.filter((r) => r.omgangId === omgangId)
    .sort((a, b) => a.forsok - b.forsok);
}

/** En skytts försök i en omgång, äldst först. */
export function resultatFor(omgangId, personId) {
  return resultat(omgangId).filter((r) => r.personId === personId);
}

/**
 * Det försök som pågår för en skytt: det senaste som ännu inte registrerats.
 * Finns inget sådant skapas ett nytt. Det är den här funktionen som gör att
 * tidssvepet och poängsvepet hittar tillbaka till samma rad — instruktören
 * knappar in tiderna på hela linjen först och poängen långt senare.
 */
export function pagaende(omgangId, personId, skapaOmSaknas = true) {
  const alla = resultatFor(omgangId, personId);
  const oppet = alla.find((r) => !r.registrerad);
  if (oppet) return oppet;
  if (!skapaOmSaknas) return null;
  const r = {
    id: nyttId(),
    omgangId,
    personId,
    forsok: alla.length + 1,
    tid: null,
    traffar: {},
    vapenhanteringUnderkand: false,
    registrerad: null,
  };
  las().resultat.push(r);
  spara();
  return r;
}

export function andraResultat(id, andringar) {
  const r = las().resultat.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, andringar);
  spara();
  return r;
}

/** Låser försöket. Efter det startar nästa tryck ett nytt försök i stället. */
export function registrera(id) {
  return andraResultat(id, { registrerad: new Date().toISOString() });
}

export function raderaResultat(id) {
  const d = las();
  d.resultat = d.resultat.filter((r) => r.id !== id);
  spara();
}

// ------------------------------------------------- säkerhetskopia och nollställning

export function sakerhetskopia() {
  return JSON.stringify({ ...las(), exporterad: new Date().toISOString() }, null, 1);
}

/**
 * Läser in en säkerhetskopia. Lägger till i stället för att skriva över:
 * poster med id som redan finns hoppas över, så att en inläsning två gånger
 * inte ger dubbletter och så att två telefoners listor kan slås ihop.
 */
export function lasInSakerhetskopia(text) {
  const inkommande = JSON.parse(text);
  if (!inkommande || typeof inkommande !== 'object') throw new Error('Filen ser inte ut som en säkerhetskopia.');
  const d = las();
  const rakning = { personer: 0, omgangar: 0, resultat: 0 };
  for (const falt of ['personer', 'omgangar', 'resultat']) {
    if (!Array.isArray(inkommande[falt])) continue;
    const fanns = new Set(d[falt].map((x) => x.id));
    for (const post of inkommande[falt]) {
      if (post && post.id && !fanns.has(post.id)) {
        d[falt].push(post);
        rakning[falt]++;
      }
    }
  }
  spara();
  return rakning;
}

export function raderaAllt() {
  data = tomtLager();
  try {
    localStorage.removeItem(NYCKEL);
  } catch {
    /* redan borta */
  }
  spara();
}
