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

test('tidssvepet går genom hela linjen utan omvägar', () => {
  klicka('+ Ny omgång');
  bockaIAlla();
  klicka('Starta omgången');
  assert.equal(rader().length, 3, 'vallistan visar alla tre');

  klicka('Nästa som saknar tid');
  const forsta = doc.querySelector('#rubrik').textContent;
  knappaTid('11,20');
  assert.match(doc.querySelector('.tidvisning').textContent, /11,20/);
  klicka('Spara & nästa skytt');

  const andra = doc.querySelector('#rubrik').textContent;
  assert.notEqual(andra, forsta, 'appen ska ha gått vidare till nästa skytt');
  knappaTid('9,80');
  klicka('Spara & nästa skytt');
  knappaTid('14,05');
  klicka('Spara & nästa skytt');

  // Alla har tid — appen ska säga till och lämna tillbaka till listan
  assert.match(doc.body.textContent, /Alla har en tid/);
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
    klicka('Nästa som saknar tid');
    knappaTid(tid);
    klicka('Spara och tillbaka');
  }

  klicka('POÄNG');
  klicka('Nästa som saknar poäng');
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

  klicka('Registrera resultat');
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
  klicka('Nästa som saknar tid');
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
  klicka('Nästa som saknar tid');
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
  klicka('Nästa som saknar tid');
  knappaTid('20,00');
  klicka('Poäng för');
  knappaZon('C', 4);
  knappaZon('H', 2);
  klicka('Registrera resultat');       // 14 p / 20 s = 0,70 → underkänd

  assert.match(doc.querySelector('#app').textContent, /underkänd/i);
  klicka('+ Nytt försök');
  assert.match(doc.querySelector('#underrubrik').textContent, /försök 2/);
  knappaTid('10,00');
  klicka('Poäng för');
  knappaZon('B', 4);
  knappaZon('A', 2);
  klicka('Registrera resultat');

  const alla = lagret().resultat.filter((r) => r.registrerad);
  assert.equal(alla.length, 2, 'båda försöken ska finnas kvar');
  assert.deepEqual(alla.map((r) => r.forsok).sort(), [1, 2]);
  assert.match(doc.querySelector('#app').textContent, /godkänd/i);
});

test('vapenhantering underkänner även en perfekt serie', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
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
  klicka('Nästa som saknar tid');
  knappaTid('24,50');
  klicka('Poäng för');
  assert.equal(doc.querySelectorAll('.zongrupp').length, 1, 'ak har bara en målyta');
  knappaZon('B', 5);
  knappaZon('C', 4);
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p');
  assert.equal(doc.querySelector('#pkvarde').textContent, '1,31');
});

test('att radera en skytt tar med sig resultaten', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
  knappaTid('10,00');
  klicka('Spara och tillbaka');
  assert.equal(lagret().resultat.length, 1);

  win.confirm = () => true;
  klicka('‹');               // pilen går från vallistan till startsidan
  klicka('Skyttar');
  klicka('Radera');
  assert.equal(lagret().personer.length, 2);
  assert.equal(lagret().resultat.length, 0, 'resultaten ska följa med personen');
});

test('pilen går till vallistan från en skytt, och till start från listan', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/);

  klicka('‹');
  assert.match(doc.querySelector('#underrubrik').textContent, /Delmoment/,
    'från tidsknappsatsen ska pilen gå till vallistan');
  klicka('‹');
  assert.match(doc.querySelector('#app').textContent, /Omgångar/,
    'från vallistan ska pilen gå till startsidan');
});

test('fler träffar än de som räknas går inte att knappa in', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
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
  klicka('Nästa som saknar tid');
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
  klicka('Nästa som saknar tid');
  knappaTid('30,00');
  klicka('Poäng för');

  knappaZon('B', 5);
  knappaZon('C', 4);                      // nu nio
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p');
  knappaZon('A', 1);
  assert.equal(doc.querySelector('#poangsumma').textContent, '32 p', 'den tionde ska studsa');
  assert.match(doc.body.textContent, /9 träffar inlagda/);
});
