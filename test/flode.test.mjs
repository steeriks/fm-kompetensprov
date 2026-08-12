// Kör hela appen i jsdom mot den byggda filen — samma artefakt som telefonen
// får. Testar instruktörens verkliga arbetsgång: tiderna för hela linjen
// först, poängen efteråt.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const FIL = path.join(import.meta.dirname, '..', 'dist', 'index.html');
let dom, doc, win;

const PERSONER = [
  { id: 'p1', namn: 'Ek, Anna', forband: '1. plut', skapad: '' },
  { id: 'p2', namn: 'Berg, Bo', forband: '1. plut', skapad: '' },
  { id: 'p3', namn: 'Craf, Cia', forband: '2. plut', skapad: '' },
];

/**
 * Startar appen med ett register som redan finns — precis som en telefon som
 * använts förut. Datat måste ligga i localStorage INNAN skripten kör: appen
 * läser lagret en gång vid start och håller det i minnet därefter.
 */
function starta(personer = PERSONER) {
  dom = new JSDOM(fs.readFileSync(FIL, 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://exempel.test/',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.localStorage.setItem('fm-kompetensprov', JSON.stringify({
        version: 1, personer, omgangar: [], resultat: [],
      }));
    },
  });
  win = dom.window;
  doc = win.document;
}

/** Hittar en knapp på synlig text. Gränssnittet är på svenska och testet ska
 *  gå sönder om texten ändras till något obegripligt. */
function knapp(text, rot = doc) {
  const alla = [...rot.querySelectorAll('button')];
  const traff = alla.find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(text));
  if (!traff) {
    throw new Error(`Ingen knapp med texten "${text}". Fanns: ` +
      alla.map((b) => JSON.stringify(b.textContent.replace(/\s+/g, ' ').trim())).join(', '));
  }
  return traff;
}

function klicka(text, rot = doc) {
  knapp(text, rot).click();
}

/** Hemknappen bär en ritad ikon och alltså ingen text — den hämtas på id. */
function hem() {
  doc.querySelector('#hem').click();
}

/** Vallistans huvudknapp — "Registrera … för första skytt" i början av en
 *  omgång, "Nästa som saknar …" därefter. Proven bryr sig om vad den GÖR;
 *  orden provas för sig. */
function nastaIListan() {
  doc.querySelector('#bottenrad .knapp.primar').click();
}

function rader() {
  return [...doc.querySelectorAll('#app .skyttrad')];
}

/** Bockar i alla skyttar. Listan ritas om vid varje klick, så raderna måste
 *  hämtas på nytt mellan trycken — precis som ett finger gör på riktigt. */
function bockaIAlla() {
  for (let i = 0; i < rader().length; i++) {
    const rad = rader()[i];
    if (!rad.className.includes('klar')) rad.click();
  }
}

function lagret() {
  return JSON.parse(win.localStorage.getItem('fm-kompetensprov'));
}

/** Knappar in en tid på sifferknappsatsen, tecken för tecken. */
function knappaTid(text) {
  for (const tecken of text) klicka(tecken === ',' ? ',' : tecken, doc.querySelector('.knappsats'));
}

/** Håller in en rad tills soptunnan läggs fram. Ett dy skilt från noll är en
 *  skrollning, och ska inte ge någon soptunna. */
async function hall(rad, dy = 0) {
  const peka = (typ, y) => rad.dispatchEvent(
    new win.MouseEvent(typ, { bubbles: true, clientX: 50, clientY: y }));
  peka('pointerdown', 100);
  peka('pointermove', 100 + dy);
  await new Promise((r) => setTimeout(r, 600));
  peka('pointerup', 100 + dy);
}

/** Soptunnan som långtrycket lade fram, om någon ligger framme. */
function soptunna() {
  return doc.querySelector('[data-soptunna]');
}

/** Trycker n gånger på en zonknapp. */
function knappaZon(bokstav, antal) {
  const z = [...doc.querySelectorAll('.zonknapp')].find((b) => b.dataset.zon === bokstav);
  assert.ok(z, `zonknapp ${bokstav} saknas`);
  for (let i = 0; i < antal; i++) z.click();
  return z;
}

beforeEach(() => { starta(); });

test('startsidan visar att inget finns ännu', () => {
  assert.match(doc.querySelector('#app').textContent, /Inga omgångar ännu/);
  assert.ok(knapp('Ny omgång'));
});

test('en omgång läggs upp med valda deltagare i skjutordning', () => {
  klicka('+ Ny omgång');
  assert.equal(rader().length, 3, 'alla tre skyttarna ska gå att bocka i');
  doc.querySelector('#plats').value = 'Hätilä';
  doc.querySelector('#instruktor').value = 'S. Eriksson';
  rader()[0].click();   // Berg (sorteras på namn)
  rader()[1].click();   // Craf
  klicka('Starta omgången');

  const d = lagret();
  assert.equal(d.omgangar.length, 1);
  assert.equal(d.omgangar[0].deltagare.length, 2);
  assert.equal(d.omgangar[0].plats, 'Hätilä', 'texten ska överleva ibockningen');
  assert.equal(d.omgangar[0].instruktor, 'S. Eriksson');
  assert.equal(d.omgangar[0].gren, 'pist');
});

test('pilarna vid namnet stegar en tavla åt vardera hållet', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  nastaIListan();

  const bak = () => doc.querySelector('#stegabak');
  const fram = () => doc.querySelector('#stegafram');
  const tavla = () => doc.querySelector('#rubrik .nr').textContent;

  assert.equal(tavla(), '1.', 'tidfönstret öppnar på första tavlan');
  assert.equal(bak().hidden, false, 'pilarna hör hemma i tidfönstret');
  assert.ok(bak().disabled, 'bakåt från första tavlan finns ingenstans att gå');
  assert.ok(!fram().disabled);

  // Framåt, knappa in en tid, och tillbaka igen — tiden ska ha följt med
  fram().click();
  assert.equal(tavla(), '2.');
  knappaTid('9,80');
  bak().click();
  assert.equal(tavla(), '1.', 'stegningen går tillbaka en tavla');
  assert.equal(lagret().resultat.find((r) => r.tid === 9.8).tid, 9.8,
    'den påbörjade tiden sparas på vägen, som när hemknappen trycks');
  assert.equal(doc.querySelector('.tidvisning').textContent.trim(), '0,00 s',
    'och tavla 1 står kvar utan tid');

  // Hela vägen ut till sista tavlan, där framåtpilen slocknar
  fram().click();
  fram().click();
  assert.equal(tavla(), '3.');
  assert.ok(fram().disabled, 'sista tavlan har ingen nästa');
  assert.ok(!bak().disabled);

  hem();
  assert.equal(bak().hidden, true, 'pilarna syns inte utanför tidfönstret');
});

test('tidssvepet går genom hela linjen utan omvägar', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  assert.equal(rader().length, 3, 'vallistan visar alla tre');

  nastaIListan();
  const forsta = doc.querySelector('#rubrik').textContent;
  knappaTid('11,20');
  assert.match(doc.querySelector('.tidvisning').textContent, /11,20/);
  klicka('Spara & nästa skytt');

  const andra = doc.querySelector('#rubrik').textContent;
  assert.notEqual(andra, forsta, 'appen ska ha gått vidare till nästa skytt');
  knappaTid('9,80');
  klicka('Spara & nästa skytt');
  knappaTid('14,05');
  // Sista tiden: knappen leder vidare till poängsteget i stället
  klicka('Spara & börja med poängen');
  assert.match(doc.body.textContent, /Alla har en tid/);
  assert.match(doc.querySelector('#underrubrik').textContent, /Poäng · försök 1/);

  const tider = lagret().resultat.map((r) => r.tid).sort((a, b) => a - b);
  assert.deepEqual(tider, [9.8, 11.2, 14.05]);
  assert.equal(lagret().resultat.filter((r) => r.registrerad).length, 0,
    'inget får vara registrerat förrän poängen är inne');
});

test('poängsvepet börjar om från första skytten och räknar kvoten', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  // Tider på alla tre
  for (const tid of ['11,20', '9,80', '14,05']) {
    nastaIListan();
    knappaTid(tid);
    klicka('Spara och tillbaka');
  }

  klicka('POÄNG');
  nastaIListan();
  const forstaIPoang = doc.querySelector('#rubrik').textContent;
  assert.match(doc.querySelector('#underrubrik').textContent, /Poäng · försök 1/);

  // Pistol: fyra i kroppen, två i huvudet
  knappaZon('B', 4);
  knappaZon('A', 2);
  assert.equal(doc.querySelector('#poangsumma').textContent, '26 p');
  // 26 p på 11,20 s → 2,32
  assert.equal(doc.querySelector('#pkvarde').textContent, '2,32');
  assert.ok(doc.querySelector('#pkvarde').classList.contains('g'), 'godkänt ska visas grönt');
  assert.equal(doc.querySelector('#brister').textContent, '');

  klicka('Registrera');
  assert.match(doc.body.textContent, /GODKÄND/);
  assert.notEqual(doc.querySelector('#rubrik').textContent, forstaIPoang,
    'nästa skytt som väntar på poäng ska öppnas direkt');

  const klart = lagret().resultat.filter((r) => r.registrerad);
  assert.equal(klart.length, 1);
  assert.deepEqual(klart[0].traffar, { B: 4, A: 2 });
});

test('för få träffar i en målyta underkänns oavsett fart', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('5,00');
  klicka('Poäng för');            // knappen bär skyttens förnamn

  knappaZon('B', 4);              // kroppen full, huvudet tomt
  assert.match(doc.querySelector('#brister').textContent, /AH: 0 av 2 träff/);
  assert.ok(doc.querySelector('#pkvarde').classList.contains('u'));
  knappaZon('A', 2);
  assert.equal(doc.querySelector('#brister').textContent, '');
});

test('långt tryck nollar en zon', async () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('5,00');
  klicka('Poäng för');

  const b = knappaZon('B', 3);
  assert.equal(b.querySelector('.antal').textContent, '3');
  b.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(b.querySelector('.antal').textContent, '0');
  assert.equal(doc.querySelector('#poangsumma').textContent, '0 p');
});

test('andra försöket lägger sig bredvid det första, inte ovanpå', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('20,00');
  klicka('Poäng för');
  knappaZon('C', 4);
  knappaZon('H', 2);
  klicka('Registrera');       // 14 p / 20 s = 0,70 → underkänd

  assert.match(doc.querySelector('#app').textContent, /underkänd/i);
  klicka('+ Nytt försök');
  assert.match(doc.querySelector('#underrubrik').textContent, /försök 2/);
  knappaTid('10,00');
  klicka('Poäng för');
  knappaZon('B', 4);
  knappaZon('A', 2);
  klicka('Registrera');

  const alla = lagret().resultat.filter((r) => r.registrerad);
  assert.equal(alla.length, 2, 'båda försöken ska finnas kvar');
  assert.deepEqual(alla.map((r) => r.forsok).sort(), [1, 2]);
  assert.match(doc.querySelector('#app').textContent, /godkänd/i);
});

test('vapenhantering underkänner även en perfekt serie', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('8,00');
  klicka('Poäng för');
  knappaZon('B', 4);
  knappaZon('A', 2);
  assert.ok(doc.querySelector('#pkvarde').classList.contains('g'));

  const ruta = doc.querySelector('#vapen');
  ruta.checked = true;
  ruta.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.match(doc.querySelector('#brister').textContent, /vapenhantering/i);
  assert.ok(doc.querySelector('#pkvarde').classList.contains('u'));
});

test('automatkarbin har en enda målyta med nio träff', () => {
  klicka('+ Ny omgång');
  doc.querySelector('#gren').value = 'ak';
  rader()[0].click();
  klicka('Starta omgången');
  assert.match(doc.querySelector('#underrubrik').textContent, /Delmoment 12.*krav PK 1,00/);
  nastaIListan();
  knappaTid('24,50');
  klicka('Poäng för');
  assert.equal(doc.querySelectorAll('.zongrupp').length, 1, 'ak har bara en målyta');
  knappaZon('B', 5);
  knappaZon('C', 4);
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p');
  assert.equal(doc.querySelector('#pkvarde').textContent, '1,31');
});

test('en ny skytt läggs upp i en ruta där två av tre fält är valfria', async () => {
  klicka('Lägg till & hantera skyttar');
  klicka('+ Ny skytt');
  const ruta = doc.querySelector('.modal');
  assert.ok(ruta, 'rutan ska ligga ovanpå vyn, inte ersätta den');
  assert.equal(ruta.querySelector('#nyttForband').placeholder, 'valfritt');
  assert.equal(ruta.querySelector('#nyttFmid').placeholder, 'valfritt');
  assert.match(ruta.textContent, /Fmid\/Anstnr/, 'fältet heter som i exporten');

  // Utan namn finns ingen skytt att spara — rutan står kvar och pekar ut fältet
  knapp('Spara', ruta).click();
  assert.ok(doc.querySelector('.modal'), 'rutan får inte stängas utan namn');
  assert.ok(ruta.querySelector('#nyttNamn').classList.contains('saknas'));
  assert.equal(lagret().personer.length, 3, 'ingenting sparat');

  ruta.querySelector('#nyttNamn').value = 'Nord, Nils';
  ruta.querySelector('#nyttFmid').value = '19900101-5555';
  knapp('Spara', ruta).click();
  await new Promise((r) => setTimeout(r, 0));   // löftet löses ut på egen tur

  assert.equal(doc.querySelector('.modal'), null, 'rutan stängs när det sparats');
  const ny = lagret().personer.find((p) => p.namn === 'Nord, Nils');
  assert.ok(ny, 'skytten ska ligga i registret');
  assert.equal(ny.fmid, '19900101-5555');
  assert.equal(ny.forband, '', 'förbandet fick lämnas tomt');
  assert.match(doc.querySelector('#app').textContent, /Nord, Nils/);
  assert.match(doc.querySelector('#app').textContent, /19900101-5555/,
    'registret visar fmid under namnet');
});

test('avbryter man rutan för ny skytt händer ingenting', async () => {
  klicka('+ Ny omgång');
  doc.querySelector('#plats').value = 'Hätilä';
  klicka('+ Ny skytt');
  const ruta = doc.querySelector('.modal');
  ruta.querySelector('#nyttNamn').value = 'Nord, Nils';
  knapp('Avbryt', ruta).click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(doc.querySelector('.modal'), null);
  assert.equal(lagret().personer.length, 3, 'ingen skytt lades upp');
  assert.equal(doc.querySelector('#plats').value, 'Hätilä',
    'och vyn under rutan står orörd kvar');
});

test('att radera en skytt tar med sig resultaten', async () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('10,00');
  klicka('Spara och tillbaka');
  assert.equal(lagret().resultat.length, 1);

  win.confirm = () => true;
  hem();
  klicka('Lägg till & hantera skyttar');
  // Skyttarna raderas med samma gest som omgångarna: håll in, tryck soptunnan
  const rad = doc.querySelector('#app .personrad');
  assert.match(rad.textContent, /Berg/, 'registret är sorterat på namn');
  assert.equal(soptunna(), null, 'ingen soptunna ligger framme av sig själv');
  await hall(rad);
  assert.equal(lagret().personer.length, 3, 'långtrycket raderar inte i sig');
  soptunna().click();
  assert.equal(lagret().personer.length, 2);
  assert.equal(lagret().resultat.length, 0, 'resultaten ska följa med personen');
});

test('hemikonen går hem från vilken vy som helst, och sparar tiden på vägen', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/);
  knappaTid('7,50');

  hem();
  assert.match(doc.querySelector('#app').textContent, /Omgångar/,
    'hemknappen ska gå hela vägen hem, inte ett steg bakåt');
  assert.equal(lagret().resultat[0].tid, 7.5,
    'en påbörjad tid ska sparas i stället för att tappas');

  // Och tillbaka in i omgången — vägen till vallistan finns i nederkant.
  // Skytten har redan en tid, så raden får öppnas direkt i stället.
  klicka('Pistol');
  rader()[0].click();
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/);
  klicka('Spara och tillbaka');
  assert.match(doc.querySelector('#underrubrik').textContent, /Delmoment/,
    '"Spara och tillbaka" ska lämna till vallistan');
});

test('fler träffar än de som räknas går inte att knappa in', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('10,00');
  klicka('Poäng för');

  knappaZon('B', 4);                      // kroppen full
  knappaZon('C', 3);                      // ska studsa
  assert.match(doc.body.textContent, /XBCD har sina 4 träffar/,
    'appen ska säga varför trycket inte tog');
  assert.equal(doc.querySelector('#poangsumma').textContent, '16 p',
    'inga fler kroppsträffar får läggas in');
  assert.ok(doc.querySelector('[data-grupp="xbcd"]').classList.contains('full'));

  knappaZon('A', 2);                      // huvudet är en egen yta
  assert.equal(doc.querySelector('#poangsumma').textContent, '26 p');
  knappaZon('H', 1);
  assert.equal(doc.querySelector('#poangsumma').textContent, '26 p', 'även AH har sitt tak');

  const d = lagret().resultat[0];
  assert.deepEqual(d.traffar, { B: 4, A: 2 }, 'bara de räknande träffarna lagras');
});

test('en träff kan bytas ut: nolla zonen först', async () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('10,00');
  klicka('Poäng för');

  knappaZon('D', 4);                      // fyra svaga kroppsträffar
  assert.equal(doc.querySelector('#poangsumma').textContent, '12 p');
  const d = knappaZon('D', 0);
  d.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(doc.querySelector('#poangsumma').textContent, '0 p');
  knappaZon('B', 4);                      // och fyra bättre i stället
  assert.equal(doc.querySelector('#poangsumma').textContent, '16 p');
});

test('automatkarbin tar emot nio träffar, inte fler', () => {
  klicka('+ Ny omgång');
  doc.querySelector('#gren').value = 'ak';
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('30,00');
  klicka('Poäng för');

  knappaZon('B', 5);
  knappaZon('C', 4);                      // nu nio
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p');
  knappaZon('A', 1);
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p', 'den tionde ska studsa');
  assert.match(doc.body.textContent, /9 träffar inlagda/);
});

test('utfallet skrivs i klartext bredvid kvoten', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('10,00');
  klicka('Poäng för');

  const utfall = () => doc.querySelector('#utfall');
  assert.equal(utfall().textContent, '', 'utan träffar finns inget att säga ännu');

  knappaZon('B', 4);
  knappaZon('H', 2);                     // 16 + 2 = 18 p på 10 s → 1,80
  assert.equal(doc.querySelector('#pkvarde').textContent, '1,80');
  assert.equal(utfall().textContent, 'Underkänd');
  assert.ok(utfall().classList.contains('u'), 'underkänt ska vara rött');

  // Nolla huvudet och sätt två A i stället: 16 + 10 = 26 p → 2,60
  const h = knappaZon('H', 0);
  h.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
  return new Promise((klar) => setTimeout(() => {
    knappaZon('A', 2);
    assert.equal(doc.querySelector('#pkvarde').textContent, '2,60');
    assert.equal(utfall().textContent, 'Godkänd');
    assert.ok(utfall().classList.contains('g'), 'godkänt ska vara grönt');
    klar();
  }, 700));
});

test('platsfältet är tomt utan spår av tidigare text', () => {
  klicka('+ Ny omgång');
  const plats = doc.querySelector('#plats');
  assert.equal(plats.value, '', 'inget värde');
  assert.equal(plats.getAttribute('placeholder'), null,
    'ingen grå exempeltext — den ser ifylld ut i mörker');
  assert.equal(plats.getAttribute('autocomplete'), 'off',
    'webbläsaren ska inte heller fylla i åt oss');
});

/** Faktarutans dt/dd som ett uppslagsverk. */
function fakta() {
  const ut = {};
  doc.querySelectorAll('.fakta').forEach((dl) => {
    const barn = [...dl.children];
    for (let i = 0; i < barn.length - 1; i += 2) ut[barn[i].textContent.trim()] = barn[i + 1].textContent.trim();
  });
  return ut;
}

test('anvisningen finns för båda proven, med avstånd och genomförande', () => {
  klicka('Anvisningar');
  const text = () => doc.querySelector('#app').textContent.replace(/\s+/g, ' ');

  // Pistol visas först
  assert.match(doc.querySelector('#underrubrik').textContent, /Pistol · Delmoment 14/);
  assert.match(text(), /PILEN/);
  assert.equal(fakta()['Avstånd'], '10 m');
  assert.equal(fakta()['Mål'], '1/1-figur');
  assert.equal(fakta()['Träffkrav'], 'PK 2,0 (4 träff XBCD, 2 träff AH)');
  assert.equal(fakta()['Fokus'], 'Vändning, drag och omladdning');
  assert.equal(fakta()['A'], '5 poäng', 'zontabellen ska finnas i anvisningen');
  assert.equal(fakta()['H'], '1 poäng');
  assert.match(text(), /vänd med ryggen mot målet/);
  assert.match(text(), /genomför skytten omladdning/i);
  assert.match(text(), /Vid osäker eller felaktig vapenhantering/);
  assert.match(text(), /Övningen får skjutas tre gånger/);

  klicka('AUTOMATKARBIN');
  assert.match(doc.querySelector('#underrubrik').textContent, /Automatkarbin · Delmoment 12/);
  assert.equal(fakta()['Avstånd'], '50 m');
  assert.equal(fakta()['Krav'], '9 träff, poängkvot minst 1,0');
  assert.match(text(), /Vapnet laddat med sex patroner/);
  assert.match(text(), /valfri knästående\/sittande ställning/);
  assert.match(text(), /Grundställning/);
  assert.match(text(), /Kravet är 1,00 för automatkarbin/);
  assert.equal(doc.querySelectorAll('.steg li').length, 6, 'sex punkter i genomförandet');
});

test('anvisningen nås mitt i en omgång och visar rätt prov', () => {
  klicka('+ Ny omgång');
  doc.querySelector('#gren').value = 'ak';
  rader()[0].click();
  klicka('Starta omgången');

  klicka('Anvisning för genomförande');
  assert.match(doc.querySelector('#underrubrik').textContent, /Automatkarbin/,
    'anvisningen ska öppnas på det prov som skjuts');
  klicka('Tillbaka till listan');
  assert.match(doc.querySelector('#underrubrik').textContent, /Delmoment 12.*krav PK/,
    'och lämna tillbaka till vallistan, inte till startsidan');
});

test('skyttarna numreras i skjutordning, som tavlorna på banan', () => {
  klicka('+ Ny omgång');
  // Bocka i i en egen ordning: Craf först, sedan Berg
  rader().find((r) => r.textContent.includes('Craf')).click();
  rader().find((r) => r.textContent.includes('Berg')).click();
  // Listan står i bokstavsordning, men numret följer ibockningsordningen:
  // Craf bockades i först och är därför nummer 1.
  const valda = rader().filter((r) => r.className.includes('klar'));
  assert.match(valda[0].textContent.replace(/\s+/g, ' '), /2\. Berg/);
  assert.match(valda[1].textContent.replace(/\s+/g, ' '), /1\. Craf/);

  klicka('Starta omgången');
  const rad = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim());
  assert.match(rad[0], /^1\. Craf/, 'första ibockade skytten är nummer 1 på banan');
  assert.match(rad[1], /^2\. Berg/);
});

test('radera alla skyttar frågar först och tar med sig resultaten', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('10,00');
  klicka('Spara och tillbaka');
  hem();
  klicka('Lägg till & hantera skyttar');

  let fragad = '';
  win.confirm = (text) => { fragad = text; return false; };
  klicka('Radera alla');
  assert.match(fragad, /Radera alla 3 skyttar/, 'frågan ska säga hur många det gäller');
  assert.equal(lagret().personer.length, 3, 'nej betyder nej');

  win.confirm = () => true;
  klicka('Radera alla');
  assert.equal(lagret().personer.length, 0);
  assert.equal(lagret().resultat.length, 0, 'resultaten följer med');
  assert.equal(lagret().omgangar.length, 1, 'omgången finns kvar, men tom');
});

test('långtryck fram soptunnan, som raderar omgången — efter fråga', async () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  hem();
  assert.equal(rader().length, 1, 'omgången ligger på startsidan');

  win.confirm = () => true;
  assert.equal(soptunna(), null, 'ingen soptunna innan man hållit in');

  // Ett kort tryck öppnar omgången som vanligt
  rader()[0].click();
  assert.match(doc.querySelector('#underrubrik').textContent, /Delmoment 14/);
  hem();

  // Rör sig fingret är det en skrollning, inte ett långtryck
  await hall(rader()[0], 80);
  assert.equal(soptunna(), null, 'skrollning ska inte lägga fram soptunnan');

  // Långtrycket lägger fram soptunnan men raderar ingenting av sig självt,
  // och släppet får inte öppna omgången
  await hall(rader()[0]);
  assert.ok(soptunna(), 'soptunnan ligger i raden');
  assert.equal(lagret().omgangar.length, 1, 'långtrycket raderar inte i sig');
  rader()[0].click();
  assert.match(doc.querySelector('#underrubrik').textContent, /Pistol och automatkarbin/,
    'släppet ska inte öppna omgången');

  // Ett tryck någon annanstans ångrar
  await hall(rader()[0]);
  doc.querySelector('#app').click();
  assert.equal(soptunna(), null, 'soptunnan försvinner när man trycker bredvid');

  // Nej på frågan lämnar omgången kvar
  let fragad = '';
  win.confirm = (text) => { fragad = text; return false; };
  await hall(rader()[0]);
  soptunna().click();
  assert.match(fragad, /Radera omgången Pistol/);
  assert.equal(lagret().omgangar.length, 1);
  assert.equal(soptunna(), null, 'och soptunnan läggs undan igen');

  // Ja raderar
  win.confirm = () => true;
  await hall(rader()[0]);
  soptunna().click();
  assert.equal(lagret().omgangar.length, 0);
  assert.match(doc.querySelector('#app').textContent, /Inga omgångar ännu/);
});

test('skyttar går att lägga till i en pågående omgång', () => {
  klicka('+ Ny omgång');
  rader().find((r) => r.textContent.includes('Berg')).click();
  klicka('Starta omgången');
  assert.equal(rader().length, 1);

  klicka('+ Lägg till skytt');
  assert.match(doc.querySelector('#underrubrik').textContent, /blir tavla 2/);
  assert.equal(rader().length, 2, 'de två som inte redan är med ska erbjudas');
  rader().find((r) => r.textContent.includes('Craf')).click();

  const rad = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim());
  assert.match(rad[0], /^1\. Berg/);
  assert.match(rad[1], /^2\. Craf/, 'den tillagda hamnar sist, på nästa tavla');
  assert.equal(lagret().omgangar[0].deltagare.length, 2);
});

test('långt tryck slår på flyttläget, sedan dras det i handtaget', async () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  const fore = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim());
  assert.match(fore[0], /^1\. Berg/);
  assert.match(fore[2], /^3\. Ek/);
  assert.equal(doc.querySelector('[data-dra]'), null, 'inga handtag i vanligt läge');

  // jsdom mäter inga element — ge raderna höjd så att drop-läget går att räkna
  const höjd = 70;
  win.Element.prototype.getBoundingClientRect = function () {
    const syskon = [...(this.parentNode ? this.parentNode.children : [])];
    const i = Math.max(0, syskon.indexOf(this));
    return { top: i * höjd, bottom: (i + 1) * höjd, height: höjd, left: 0, right: 300, width: 300 };
  };
  const peka = (el, typ, y) => el.dispatchEvent(
    new win.MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 50, clientY: y }));

  // Håll in en rad: läget slås på, men ingenting flyttas av själva trycket
  peka(rader()[2], 'pointerdown', 3 * höjd + 10);
  await new Promise((r) => setTimeout(r, 600));
  peka(rader()[2], 'pointerup', 3 * höjd + 10);
  assert.equal(rader().length, 3);
  assert.equal(doc.querySelectorAll('[data-dra]').length, 3, 'alla rader får handtag');
  assert.match(doc.body.textContent, /Dra i ☰/);
  assert.deepEqual(rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim().slice(2, 8)),
    fore.map((t) => t.slice(0, 6)), 'ordningen är orörd tills man drar');

  // Dra Ek högst upp med handtaget
  const rad = rader()[2];
  const handtag = rad.querySelector('[data-dra]');
  peka(handtag, 'pointerdown', 3 * höjd + 10);
  assert.ok(rad.classList.contains('lyft'), 'draget börjar direkt i handtaget');
  peka(handtag, 'pointermove', 10);
  peka(handtag, 'pointerup', 10);

  const efter = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim());
  assert.match(efter[0], /1\. Ek/, 'den flyttade skytten får numret för sin nya tavla');
  assert.match(efter[1], /2\. Berg/);
  assert.match(efter[2], /3\. Craf/);
  assert.match(doc.body.textContent, /Ek, Anna är tavla 1/);
  assert.deepEqual(lagret().omgangar[0].deltagare.length, 3);

  klicka('Klar med ordningen');
  assert.equal(doc.querySelector('[data-dra]'), null, 'handtagen försvinner igen');
  rader()[0].click();
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/,
    'och raderna går att öppna som vanligt');
});

test('ett kort tryck öppnar skytten, det långa flyttar', async () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  const rad = rader()[0];
  rad.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10 }));
  rad.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 10 }));
  rad.click();
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/,
    'ett vanligt tryck ska fortfarande öppna skytten');
});

test('bekräftelsen syns kvar efter omritningen', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('+ Lägg till skytt');
  rader()[0].click();
  // Tillägget ritar om vallistan direkt — meddelandet måste överleva det
  assert.match(doc.querySelector('.flash').textContent, /är tavla 2/);
  assert.match(doc.querySelector('#underrubrik').textContent, /krav PK/,
    'och vi ska stå på vallistan igen');
});

test('tiden knappas rakt av — de två sista siffrorna är hundradelar', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  nastaIListan();
  const visas = () => doc.querySelector('.tidvisning').textContent.replace(/\s+/g, ' ').trim();

  knappaTid('5');
  assert.equal(visas(), '0,05 s', 'första siffran är hundradelar');
  knappaTid('5');
  assert.equal(visas(), '0,55 s');
  knappaTid('5');
  assert.equal(visas(), '5,55 s', '555 blir 5,55');
  klicka('Spara & nästa skytt');
  assert.equal(lagret().resultat[0].tid, 5.55);

  knappaTid('6667');
  assert.equal(visas(), '66,67 s', '6667 blir 66,67');
  klicka('Spara & nästa skytt');
  assert.equal(lagret().resultat[1].tid, 66.67);
});

test('komma går fortfarande att använda, och tar högst två decimaler', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  const visas = () => doc.querySelector('.tidvisning').textContent.replace(/\s+/g, ' ').trim();

  knappaTid('12,5');
  assert.equal(visas(), '12,5 s', 'skrivs som det knappas när kommat är med');
  knappaTid('0');
  assert.equal(visas(), '12,50 s');
  knappaTid('9');
  assert.equal(visas(), '12,50 s', 'en tredje decimal ska studsa');
  klicka('Spara och tillbaka');
  assert.equal(lagret().resultat[0].tid, 12.5);
});

test('backsteg fungerar i båda lägena', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  const visas = () => doc.querySelector('.tidvisning').textContent.replace(/\s+/g, ' ').trim();
  knappaTid('1234');
  assert.equal(visas(), '12,34 s');
  klicka('⌫', doc.querySelector('.knappsats'));
  assert.equal(visas(), '1,23 s', 'siffrorna skjuts tillbaka ett steg');
  klicka('⌫', doc.querySelector('.knappsats'));
  klicka('⌫', doc.querySelector('.knappsats'));
  klicka('⌫', doc.querySelector('.knappsats'));
  assert.equal(visas(), '0,00 s', 'tomt fält visar nollan dämpad');
});

test('inställningarna har ingen utskriftsknapp', () => {
  klicka('Appinställningar');
  const knappar = [...doc.querySelectorAll('#bottenrad button, #app button')]
    .map((b) => b.textContent.trim());
  assert.ok(!knappar.some((t) => /skriv ut/i.test(t)),
    'utskrift hör hemma på exportskärmen, inte här: ' + knappar.join(', '));
  assert.ok(knappar.some((t) => /Spara kopia/.test(t)), 'säkerhetskopian ska finnas kvar');
});

test('knappsatsen byggs inte om vid varje siffra', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  const knappsats = doc.querySelector('.knappsats');
  const femman = [...knappsats.querySelectorAll('button')].find((b) => b.textContent === '5');

  // Samma elementreferens ska fungera hela vägen — annars flimrar knappsatsen
  // under fingret och sparade referenser dör mitt i inmatningen.
  femman.click(); femman.click(); femman.click();
  assert.equal(doc.querySelector('.knappsats'), knappsats, 'knappsatsen ska vara kvar');
  assert.match(doc.querySelector('.tidvisning').textContent, /5,55/);
});

test('tidvyn säger vem som står på tur — och byter till poäng när linjen är klar', () => {
  klicka('+ Ny omgång');
  bockaIAlla();                       // Berg (1), Craf (2), Ek (3)
  klicka('Starta omgången');
  const ordning = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 8));

  nastaIListan();
  const nasta = () => doc.querySelector('.nastaskytt').textContent.replace(/\s+/g, ' ').trim();
  assert.match(nasta(), /^Nästa: 2\./, 'näste man ska stå under knappen');
  assert.ok(!nasta().includes('poäng'));
  knappaTid('550');
  klicka('Spara & nästa skytt');

  assert.match(nasta(), /^Nästa: 3\./);
  knappaTid('600');
  klicka('Spara & nästa skytt');

  // Sista skytten: nu är nästa steg poängen, från tavla 1
  assert.match(doc.querySelector('.knapp.primar').textContent, /börja med poängen/);
  assert.match(nasta(), /^Nästa: 1\..*— poäng$/,
    'sista tiden ska peka på första tavlan och på poängsteget');
  knappaTid('700');
  klicka('Spara & börja med poängen');

  assert.match(doc.querySelector('#underrubrik').textContent, /Poäng · försök 1/);
  assert.match(doc.querySelector('#rubrik').textContent, new RegExp(ordning[0].slice(3, 7)),
    'och öppna första skytten i ordningen');
  assert.match(doc.body.textContent, /Nu poängen, från första tavlan/);
  assert.equal(lagret().resultat.filter((r) => r.tid !== null).length, 3);
});

test('hemknappen är en ikon utan ram, och står kvar på startsidan', () => {
  assert.equal(doc.querySelector('#hem').hidden, false,
    'rubrikraden ska se likadan ut på varje skärm, startsidan inräknad');
  klicka('+ Ny omgång');
  const knapp = doc.querySelector('#hem');
  assert.equal(knapp.textContent.trim(), '', 'ingen text, bara ikonen');
  assert.ok(knapp.querySelector('svg'), 'huset är ritat, inte ett tecken');
  assert.equal(knapp.getAttribute('aria-label'), 'Till startsidan',
    'skärmläsare och långtryck ska ändå få veta vad den gör');
});

test('poängvyn säger vem som står på tur, och summerar när laget är klart', () => {
  klicka('+ Ny omgång');
  bockaIAlla();                        // Berg (1), Craf (2), Ek (3)
  klicka('Starta omgången');
  // Tidssvepet lämnar själv över till poängen efter sista skytten
  nastaIListan();
  for (const tid of ['1100', '1200', '1300']) {
    knappaTid(tid);
    klicka('Spara &');
  }
  assert.match(doc.querySelector('#underrubrik').textContent, /Poäng · försök 1/);
  const nasta = () => doc.querySelector('.nastaskytt').textContent.replace(/\s+/g, ' ').trim();

  assert.match(doc.querySelector('.knapp.primar').textContent, /Registrera & nästa skytt/);
  assert.match(nasta(), /^Nästa: 2\./, 'näste man ska stå under knappen');
  knappaZon('B', 4); knappaZon('A', 2);
  klicka('Registrera');

  assert.match(nasta(), /^Nästa: 3\./);
  knappaZon('B', 4); knappaZon('A', 2);
  klicka('Registrera');

  // Sista skytten
  assert.match(doc.querySelector('.knapp.primar').textContent, /Registrera sista resultatet/);
  assert.match(nasta(), /Sedan är omgången klar/);
  knappaZon('C', 4); knappaZon('H', 2);       // 14 p på 13 s → underkänd
  klicka('Registrera sista resultatet');

  assert.match(doc.querySelector('#underrubrik').textContent, /krav PK/,
    'sista registreringen lämnar tillbaka till vallistan');
  assert.match(doc.querySelector('.flash').textContent, /Omgången klar — 2 av 3 godkända/);
  assert.equal(lagret().resultat.filter((r) => r.registrerad).length, 3);
});

test('rubriken bär skyttens nummer och namn i tid- och poängvyn', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  const listan = rader().map((r) => r.textContent.replace(/\s+/g, ' ').trim());

  // Andra skytten i ordningen
  rader()[1].click();
  const rubrik = () => doc.querySelector('#rubriktext').textContent.replace(/\s+/g, ' ').trim();
  assert.match(rubrik(), /^2\. /, 'tavelnumret ska stå först i rubriken');
  assert.ok(listan[1].startsWith(rubrik()), 'och stämma med raden i listan: ' + listan[1]);
  assert.equal(doc.querySelector('#rubriktext .nr').textContent, '2.',
    'numret är en egen del, så det kan färgsättas');

  // Samma sak på poängvyn
  knappaTid('900');
  klicka('Poäng för');
  assert.match(doc.querySelector('#underrubrik').textContent, /Poäng · försök 1/);
  assert.match(rubrik(), /^2\. /);

  // Flyttas skytten byter rubriken nummer med tavlan
  klicka('Tillbaka till listan');
  assert.match(doc.querySelector('#rubriktext').textContent, /Pistol/,
    'listan har provets namn som rubrik, utan nummer');
  assert.equal(doc.querySelector('#rubriktext .nr'), null);
});

test('ett långt tryck markerar inte texten', async () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');

  // Regeln som hindrar markeringen från att ens uppstå
  const css = fs.readFileSync(FIL, 'utf8');
  const regel = css.slice(css.indexOf('.skyttrad {'), css.indexOf('.skyttrad.klar'));
  assert.match(regel, /-webkit-user-select: none/);
  assert.match(regel, /-webkit-touch-callout: none/);
  // Zonknappen hålls också in — och sifferknapparna trycks snabbt i följd
  for (const väljare of ['.zonknapp {', '.knappsats button {']) {
    const block = css.slice(css.indexOf(väljare), css.indexOf('}', css.indexOf(väljare)));
    assert.match(block, /-webkit-touch-callout: none/, väljare + ' saknar spärren');
  }

  // Och bältet: en markering som ändå hunnit uppstå släpps när draget börjar
  let slapptes = false;
  win.getSelection = () => ({ removeAllRanges: () => { slapptes = true; } });
  const rad = rader()[0];
  rad.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10 }));
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(slapptes, 'markeringen ska släppas när långtrycket slår till');
  rad.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 10 }));
});

test('en färdig skytt får inget nytt försök av ett tryck på raden', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  nastaIListan();
  knappaTid('1000');
  klicka('Poäng för');
  knappaZon('B', 4);
  knappaZon('A', 2);
  klicka('Registrera');
  assert.equal(lagret().resultat.length, 1);

  // Raden i vallistan: ett tryck ska inte starta försök 2
  rader()[0].click();
  assert.equal(lagret().resultat.length, 1, 'inget nytt försök får uppstå');
  assert.match(doc.querySelector('.flash').textContent, /är klar\. Tryck "\+ Nytt försök"/);
  assert.match(doc.querySelector('#underrubrik').textContent, /krav PK/, 'vi står kvar i listan');

  // Och lägesväljaren ska inte påstå att någon väntar
  const lagen = [...doc.querySelectorAll('.lagesvaljare button')].map((b) => b.textContent.trim());
  assert.deepEqual(lagen, ['TID', 'POÄNG'], 'ingen räknare när alla är klara: ' + lagen);

  // "Nästa som saknar tid" ska inte heller hitta på något
  klicka('TID');
  nastaIListan();
  assert.equal(lagret().resultat.length, 1);
  assert.match(doc.body.textContent, /Alla har en tid/);

  // Ett omtag startas med flit
  klicka('+ Nytt försök');
  assert.equal(lagret().resultat.length, 2);
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 2/);
});

test('knapparna säger vad som ska göras, inte bara "nästa"', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  const primar = () => doc.querySelector('#bottenrad .knapp.primar').textContent.trim();
  const smaknappar = () => [...doc.querySelectorAll('#bottenrad .knapp.liten')]
    .map((b) => b.textContent.trim());

  assert.equal(primar(), 'Registrera tid för första skytt',
    'en ny omgång har ingen "föregående" att vara nästa efter');
  assert.deepEqual(smaknappar(), ['Anvisning för genomförande', 'Dela resultat']);

  nastaIListan();
  knappaTid('1100');
  klicka('Spara och tillbaka');
  assert.equal(primar(), 'Nästa som saknar tid', 'därefter är det nästa som gäller');

  // Poängläget följer samma logik
  klicka('POÄNG');
  assert.equal(primar(), 'Registrera poäng för första skytt');
  nastaIListan();
  knappaZon('B', 4);
  knappaZon('A', 2);
  klicka('Registrera');
  // Tillbaka på listan: två skyttar saknar fortfarande TID, och listan ska
  // stå i det läge som har något kvar att göra.
  assert.match(doc.querySelector('#underrubrik').textContent, /krav PK|Poäng · försök/);
  if (!doc.querySelector('#bottenrad .knapp.primar').textContent.includes('Registrera &')) {
    assert.equal(primar(), 'Nästa som saknar tid');
  }
});

test('startsidans knappar heter vad de gör, två och två', () => {
  const namn = [...doc.querySelectorAll('#bottenrad .knapprad button')]
    .map((b) => b.textContent.trim());
  assert.deepEqual(namn, [
    'Så använder du appen', 'Anvisningar för genomförande',
    'Lägg till & hantera skyttar', 'Appinställningar',
  ]);
  assert.equal(doc.querySelectorAll('#bottenrad .knapprad').length, 2,
    'fyra på en rad blir oläsligt, fyra egna rader äter halva skärmen');
  assert.ok([...doc.querySelectorAll('#bottenrad .knapprad button')]
    .every((b) => b.className.includes('smal')),
    'alla ska bära den smala stilen som gör att de får plats');
});

test('sidans nedre marginal följer bottenradens höjd', () => {
  const css = fs.readFileSync(FIL, 'utf8');
  assert.match(css, /padding: 0\.9rem 0\.9rem calc\(var\(--bottenhojd, 7\.5rem\) \+ 1rem\)/,
    'marginalen ska läsa variabeln, med ett reservvärde om mätningen uteblir');
  // jsdom mäter inte layout (offsetHeight = 0), så variabeln ska lämnas orörd
  // och reservvärdet gälla — mätningen sker i den riktiga webbläsaren.
  assert.equal(doc.documentElement.style.getPropertyValue('--bottenhojd'), '',
    'utan verklig mätning ska ingen nolla skrivas in');
});

test('sammanfattningsrutan går att trycka på först när det finns omgångar', () => {
  klicka('Appinställningar');
  const ruta = () => doc.querySelector('#app .kort');
  assert.equal(ruta().tagName, 'DIV', 'utan omgångar ska den inte se klickbar ut');
  assert.match(ruta().textContent, /inga omgångar ännu/);

  hem();
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  hem();
  klicka('Appinställningar');
  assert.equal(ruta().tagName, 'BUTTON', 'med omgångar ska den bli en knapp');
  ruta().click();
  assert.match(doc.querySelector('#app').textContent, /Omgångar/,
    'och leda till listan över omgångar');
});

test('hjälpen finns i appen, med installation, data, buggar och licens', () => {
  klicka('Appinställningar');
  klicka('Installation, data och licens');
  const text = doc.querySelector('#app').textContent.replace(/\s+/g, ' ');

  assert.match(text, /Safari/, 'iOS-vägen');
  assert.match(text, /Lägg till på hemskärmen/);
  assert.match(text, /Chrome/, 'Android-vägen');
  assert.match(text, /Installera app/);
  assert.match(text, /sparas bara i den här telefonen/i, 'ansvarsfriskrivningen');
  assert.match(text, /du själv ansvarar för uppgifterna/i);
  assert.match(text, /Radera allt innehåll/);
  assert.match(text, /MIT-licens/);
  assert.match(text, /inte utgiven av Försvarsmakten/);
  assert.match(text, /stöd för instruktören/i, 'vad appen är ska stå först');

  const lank = doc.querySelector('#app a');
  assert.match(lank.getAttribute('href'), /github\.com\/steeriks\/fm-kompetensprov\/issues/);
  // noreferrer utöver noopener: trycker någon på länken ska GitHub inte få
  // veta varifrån den trycktes.
  assert.equal(lank.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(doc.querySelectorAll('#app .dokument h2').length >= 4, 'fyra avsnitt');

  klicka('Tillbaka till inställningar');
  assert.match(doc.querySelector('#app').textContent, /Säkerhetskopia/);
});

test('tillbaka till listan landar i det läge som har något kvar att göra', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  const lage = () => [...doc.querySelectorAll('.lagesvaljare button')]
    .find((b) => b.getAttribute('aria-pressed') === 'true').textContent.trim();

  assert.match(lage(), /^TID \(3\)/, 'en ny omgång börjar med tre som saknar tid');

  // En avstickare till anvisningen mitt i tidssvepet får inte byta läge
  klicka('Anvisning för genomförande');
  klicka('Tillbaka till listan');
  assert.match(lage(), /^TID \(3\)/, 'anvisningen ska lämna tillbaka till siffran');

  // Samma sak från exporten
  klicka('Dela resultat');
  klicka('Tillbaka till listan');
  assert.match(lage(), /^TID \(3\)/);

  // Även om man själv byter till det tomma läget innan avstickaren ska listan
  // komma tillbaka till det som har en siffra
  klicka('POÄNG');
  assert.equal(lage(), 'POÄNG', 'poängläget har inget att göra ännu');
  klicka('Anvisning för genomförande');
  klicka('Tillbaka till listan');
  assert.match(lage(), /^TID \(3\)/, 'tomt läge ska bytas mot det som väntar');

  // När alla fått tid vänder det: nu är det poängen som väntar
  nastaIListan();
  for (const tid of ['1100', '1200', '1300']) {
    knappaTid(tid);
    klicka('Spara &');
  }
  klicka('Tillbaka till listan');
  assert.match(lage(), /^POÄNG \(3\)/, 'tiderna är klara — nu väntar poängen');
  klicka('Anvisning för genomförande');
  klicka('Tillbaka till listan');
  assert.match(lage(), /^POÄNG \(3\)/);
});

test('användarinstruktionen nås från startsidan och beskriver arbetsgången', () => {
  klicka('Så använder du appen');
  const text = doc.querySelector('#app').textContent.replace(/\s+/g, ' ');

  assert.match(text, /Lägg till & hantera skyttar/, 'förberedelsen');
  assert.match(text, /i skjutordning/, 'omgången läggs upp');
  assert.match(text, /555.*5,55/, 'hur tiden knappas');
  assert.match(text, /Spara & nästa skytt/);
  assert.match(text, /Spara & börja med poängen/);
  assert.match(text, /Registrera & nästa skytt/);
  assert.match(text, /vapenhantering/i);
  assert.match(text, /Klar med ordningen/, 'ändringar under omgången');
  assert.match(text, /\+ Nytt försök/);
  assert.match(text, /Dela resultat/, 'delningen');
  assert.match(text, /PDF/);
  assert.match(text, /Spara kopia/, 'säkerhetskopian');
  assert.ok(doc.querySelectorAll('#app .dokument h2').length >= 5, 'flera avsnitt');
  assert.ok(!text.includes('*'), 'ingen markdown ska läcka ut som asterisker');
  assert.ok(doc.querySelector('#app .dokument i'), 'kursiv stil ska renderas');
  assert.ok(doc.querySelector('#app .dokument b'), 'fet stil ska renderas');

  klicka('Tillbaka till startsidan');
  assert.match(doc.querySelector('#app').textContent, /Omgångar/);
});

test('hjälpen och användarinstruktionen är två olika texter', () => {
  klicka('Så använder du appen');
  const instruktion = doc.querySelector('#app').textContent;
  assert.match(doc.querySelector('#rubriktext').textContent, /Så använder du appen/);

  klicka('Tillbaka till startsidan');
  klicka('Appinställningar');
  klicka('Installation, data och licens');
  const hjalp = doc.querySelector('#app').textContent;
  assert.match(doc.querySelector('#rubriktext').textContent, /Om appen/);
  assert.notEqual(instruktion, hjalp);
  assert.match(hjalp, /MIT-licens/);
  assert.ok(!instruktion.includes('MIT-licens'), 'instruktionen ska hålla sig till bruket');

  klicka('Tillbaka till inställningar');
  assert.match(doc.querySelector('#app').textContent, /Säkerhetskopia/);
});

test('skyttelistan har en genväg till ny omgång överst', () => {
  klicka('Lägg till & hantera skyttar');
  const forsta = doc.querySelector('#app button');
  assert.equal(forsta.textContent.trim(), '+ Ny omgång', 'genvägen ska ligga överst');

  forsta.click();
  assert.match(doc.querySelector('#rubriktext').textContent, /Ny omgång/);
  assert.equal(doc.querySelectorAll('#app .skyttrad').length, 3,
    'och leda till formuläret med skyttarna att bocka i');

  // Den ska finnas även när registret är tomt — det är då man behöver den minst,
  // men den får inte försvinna och flytta på allt annat.
  hem();
  klicka('Appinställningar');
  win.prompt = () => 'RADERA';
  klicka('Radera allt innehåll');
  klicka('Lägg till & hantera skyttar');
  assert.equal(doc.querySelector('#app button').textContent.trim(), '+ Ny omgång');
  assert.match(doc.querySelector('#app').textContent, /Inga skyttar ännu/);
});

test('förbehållet om att appen inte är officiell står på alla ställen', () => {
  const sagerDet = (text) => /inte.{0,30}(utgiven av Försvarsmakten|officiell)/i.test(text)
    || /stöd för instruktören/i.test(text);

  klicka('Så använder du appen');
  assert.ok(sagerDet(doc.querySelector('#app').textContent), 'användarinstruktionen');

  klicka('Tillbaka till startsidan');
  klicka('Anvisningar för genomförande');
  assert.ok(sagerDet(doc.querySelector('#app').textContent),
    'anvisningsvyn — där regelverket återges är det som viktigast');

  hem();
  klicka('Appinställningar');
  klicka('Installation, data och licens');
  assert.ok(sagerDet(doc.querySelector('#app').textContent), 'hjälptexten');
});

test('anvisningssidan heter Anvisningar och har vägen hem på båda proven', () => {
  klicka('Anvisningar för genomförande');
  const rubrik = () => doc.querySelector('#rubriktext').textContent.trim();
  const knappar = () => [...doc.querySelectorAll('#bottenrad button')].map((b) => b.textContent.trim());

  assert.equal(rubrik(), 'Anvisningar');
  assert.ok(knappar().includes('Tillbaka till startsidan'), 'pistolsidan: ' + knappar());
  assert.equal(doc.querySelector('#hem').hidden, false, 'ikonen i huvudet finns också');

  klicka('AUTOMATKARBIN');
  assert.equal(rubrik(), 'Anvisningar');
  assert.ok(knappar().includes('Tillbaka till startsidan'), 'ak-sidan: ' + knappar());

  klicka('Tillbaka till startsidan');
  assert.match(doc.querySelector('#app').textContent, /Omgångar/);
});

test('anvisningen mitt i en omgång erbjuder båda vägarna ut', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Anvisning för genomförande');
  const knappar = [...doc.querySelectorAll('#bottenrad button')].map((b) => b.textContent.trim());
  assert.ok(knappar.includes('Tillbaka till listan'), knappar.join(', '));
  assert.ok(knappar.includes('Tillbaka till startsidan'), knappar.join(', '));
});
