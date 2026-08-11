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
  klicka('Hem');
  klicka('Skyttar');
  klicka('Radera');
  assert.equal(lagret().personer.length, 2);
  assert.equal(lagret().resultat.length, 0, 'resultaten ska följa med personen');
});

test('hemknappen går hem från vilken vy som helst, och sparar tiden på vägen', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
  assert.match(doc.querySelector('#underrubrik').textContent, /Tid · försök 1/);
  knappaTid('7,50');

  klicka('Hem');
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

test('utfallet skrivs i klartext bredvid kvoten', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Nästa som saknar tid');
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

  klicka('Anvisning');
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
  klicka('Nästa som saknar tid');
  knappaTid('10,00');
  klicka('Spara och tillbaka');
  klicka('Hem');
  klicka('Skyttar');

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

test('svep vänster raderar en omgång — efter fråga', () => {
  klicka('+ Ny omgång');
  rader()[0].click();
  klicka('Starta omgången');
  klicka('Hem');
  assert.equal(rader().length, 1, 'omgången ligger på startsidan');

  const svep = (rad, fran, till, dy = 0) => {
    const hand = (typ, x, y) => rad.dispatchEvent(
      new win.MouseEvent(typ, { bubbles: true, clientX: x, clientY: y }));
    hand('pointerdown', fran, 100);
    hand('pointermove', till, 100 + dy);
    hand('pointerup', till, 100 + dy);
  };

  // Kort svep gör ingenting
  win.confirm = () => true;
  svep(rader()[0], 200, 170);
  assert.equal(lagret().omgangar.length, 1, 'ett kort svep ska inte radera');

  // Lodrätt drag är en skrollning, inte ett svep
  svep(rader()[0], 200, 100, 80);
  assert.equal(lagret().omgangar.length, 1, 'skrollning ska inte radera');

  // Nej på frågan lämnar omgången kvar
  let fragad = '';
  win.confirm = (text) => { fragad = text; return false; };
  svep(rader()[0], 200, 100);
  assert.match(fragad, /Radera omgången Pistol/);
  assert.equal(lagret().omgangar.length, 1);

  // Ja raderar
  win.confirm = () => true;
  svep(rader()[0], 200, 100);
  assert.equal(lagret().omgangar.length, 0);
  assert.match(doc.querySelector('#app').textContent, /Inga omgångar ännu/);
});
