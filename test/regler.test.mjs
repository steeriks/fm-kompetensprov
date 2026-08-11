import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bedom, zonerFor, taltolk, komma, PROV } from '../src/regler.js';

// --- Automatkarbin: nio bästa träffarna av alla ---------------------------

test('ak: nio träff och kvot över 1,0 är godkänt', () => {
  // 9 × C (3 p) = 27 p på 20 s → 1,35
  const r = bedom('ak', { C: 9 }, 20);
  assert.equal(r.poang, 27);
  assert.equal(r.pk, 1.35);
  assert.equal(r.godkand, true);
  assert.deepEqual(r.brister, []);
});

test('ak: en tionde träff får bara räknas om den är bättre än den sämsta', () => {
  // 9 × C plus en H (1 p) — H är sämst och ska falla bort, poängen står still
  const utan = bedom('ak', { C: 9 }, 20).poang;
  const med = bedom('ak', { C: 9, H: 1 }, 20).poang;
  assert.equal(med, utan, 'den sämsta träffen ska falla bort');

  // Samma sak fast bättringen är bättre: 8 × C + 1 × H, sedan en A (5 p)
  const fore = bedom('ak', { C: 8, H: 1 }, 20).poang;      // 24 + 1 = 25
  const efter = bedom('ak', { C: 8, H: 1, A: 1 }, 20).poang; // A ersätter H → 29
  assert.equal(fore, 25);
  assert.equal(efter, 29);
});

test('ak: åtta träff är underkänt hur snabbt det än går', () => {
  const r = bedom('ak', { A: 8 }, 5);
  assert.equal(r.godkand, false);
  assert.equal(r.komplett, false);
  assert.deepEqual(r.brister, ['8 av 9 träff']);
});

test('ak: kvoten avrundas till två decimaler innan den jämförs', () => {
  // 27 p på 27,004 s = 0,99985… → visas som 1,00 och ska då vara godkänt
  const pa = bedom('ak', { C: 9 }, 27.004);
  assert.equal(pa.pk, 1);
  assert.equal(pa.godkand, true, 'det som visas som 1,00 ska godkännas');

  // 27 p på 27,1 s = 0,996 → 1,00? nej: 0,9963 avrundas till 1,00
  // Ta i stället ett fall som säkert hamnar under: 27 p på 28 s = 0,96
  const under = bedom('ak', { C: 9 }, 28);
  assert.equal(under.pk, 0.96);
  assert.equal(under.godkand, false);
  assert.deepEqual(under.brister, ['Poängkvot 0,96 — kravet är 1,00']);
});

// --- Pistol: fyra bästa i XBCD och två bästa i AH -------------------------

test('pist: fyra i kroppen och två i huvudet räknas var för sig', () => {
  // 4 × B (4 p) = 16 och 2 × A (5 p) = 10 → 26 p på 12 s = 2,17
  const r = bedom('pist', { B: 4, A: 2 }, 12);
  assert.equal(r.poang, 26);
  assert.equal(r.pk, 2.17);
  assert.equal(r.godkand, true);
});

test('pist: bättringsskott i kroppen väljer de fyra bästa', () => {
  // Sex kroppsträffar: 2 × B (4), 2 × C (3), 2 × X (2). De fyra bästa är
  // B+B+C+C = 14. Plus 2 × A = 10 → 24 p.
  const r = bedom('pist', { B: 2, C: 2, X: 2, A: 2 }, 12);
  assert.equal(r.poang, 24);
  const xbcd = r.grupper.find((g) => g.id === 'xbcd');
  assert.equal(xbcd.antal, 6, 'alla sex träffarna ska räknas som skjutna');
  assert.equal(xbcd.over, 2, 'två av dem är bättringsskott utanför de fyra bästa');
  assert.equal(xbcd.poang, 14);
});

test('pist: huvudträffar kan inte ersätta kroppsträffar', () => {
  // Sex träffar, men alla i AH: kroppen saknar sina fyra
  const r = bedom('pist', { A: 6 }, 10);
  assert.equal(r.godkand, false);
  assert.equal(r.komplett, false);
  // AH tar bara sina två bästa trots sex träffar → 10 p, och kroppen är tom.
  // Båda bristerna ska rapporteras, inte bara den första.
  assert.equal(r.grupper.find((g) => g.id === 'ah').poang, 10);
  assert.deepEqual(r.brister, [
    'XBCD: 0 av 4 träff',
    'Poängkvot 1,00 — kravet är 2,00',
  ]);
});

test('pist: kravet är 2,0 — precis på gränsen godkänns', () => {
  // 24 p på 12 s = exakt 2,00
  const pa = bedom('pist', { B: 2, C: 2, A: 2 }, 12);
  assert.equal(pa.poang, 24);
  assert.equal(pa.pk, 2);
  assert.equal(pa.godkand, true);

  // Samma träffbild en halv sekund långsammare → 1,92
  const under = bedom('pist', { B: 2, C: 2, A: 2 }, 12.5);
  assert.equal(under.pk, 1.92);
  assert.equal(under.godkand, false);
  assert.deepEqual(under.brister, ['Poängkvot 1,92 — kravet är 2,00']);
});

// --- Spärrar och ofullständiga försök ------------------------------------

test('vapenhantering slår ut ett annars godkänt försök', () => {
  const r = bedom('pist', { B: 4, A: 2 }, 12, true);
  assert.equal(r.godkand, false);
  assert.equal(r.komplett, true, 'försöket är komplett — men underkänt');
  assert.deepEqual(r.brister, ['Underkänd vapenhantering']);
});

test('utan tid går ingen kvot att räkna', () => {
  const r = bedom('ak', { C: 9 }, null);
  assert.equal(r.pk, null);
  assert.equal(r.poang, 27, 'poängen går att räkna ändå');
  assert.equal(r.godkand, false);
  assert.deepEqual(r.brister, ['Tid saknas']);
});

test('tiden noll är ogiltig, inte oändlig kvot', () => {
  const r = bedom('ak', { C: 9 }, 0);
  assert.equal(r.pk, null);
  assert.deepEqual(r.brister, ['Ogiltig tid']);
});

test('tomt försök ger noll poäng och alla brister', () => {
  const r = bedom('pist', {}, null);
  assert.equal(r.poang, 0);
  assert.deepEqual(r.brister, ['XBCD: 0 av 4 träff', 'AH: 0 av 2 träff', 'Tid saknas']);
});

// --- Småfunktioner --------------------------------------------------------

test('zonerFor ger provets zoner i visningsordning', () => {
  assert.deepEqual(zonerFor('ak'), ['A', 'B', 'C', 'D', 'X', 'H']);
  assert.deepEqual(zonerFor('pist'), ['A', 'B', 'C', 'D', 'X', 'H']);
});

test('taltolk klarar både komma och punkt', () => {
  assert.equal(taltolk('4,23'), 4.23);
  assert.equal(taltolk('4.23'), 4.23);
  assert.equal(taltolk(' 12 '), 12);
  assert.equal(taltolk(''), null);
  assert.equal(taltolk('abc'), null);
  assert.equal(taltolk(null), null);
});

test('komma skriver svenskt decimaltecken', () => {
  assert.equal(komma(1.5), '1,50');
  assert.equal(komma(2), '2,00');
  assert.equal(komma(1.234, 1), '1,2');
  assert.equal(komma(null), '');
});

test('provtabellen har kraven ur reglerna', () => {
  assert.equal(PROV.ak.pkKrav, 1.0);
  assert.equal(PROV.pist.pkKrav, 2.0);
  assert.equal(PROV.ak.maxForsok, 3);
  assert.equal(PROV.pist.maxForsok, 3);
  assert.equal(PROV.ak.grupper[0].antal, 9);
  assert.deepEqual(PROV.pist.grupper.map((g) => g.antal), [4, 2]);
});

// --- taket på antalet träffar --------------------------------------------

test('målytan är full när den har sina räknande träffar', async () => {
  const { arFull, gruppFor, antalIGrupp } = await import('../src/regler.js');
  // Pistol: fyra i kroppen, två i huvudet
  assert.equal(arFull('pist', 'B', { B: 3 }), false);
  assert.equal(arFull('pist', 'B', { B: 4 }), true);
  assert.equal(arFull('pist', 'C', { B: 2, C: 2 }), true, 'ytan räknas ihop, inte per zon');
  assert.equal(arFull('pist', 'A', { B: 4 }), false, 'huvudet är en egen målyta');
  assert.equal(arFull('pist', 'A', { A: 1, H: 1 }), true);
  // Automatkarbin: nio i en enda målyta
  assert.equal(arFull('ak', 'C', { C: 8 }), false);
  assert.equal(arFull('ak', 'C', { B: 5, C: 4 }), true);

  assert.equal(gruppFor('pist', 'X').id, 'xbcd');
  assert.equal(gruppFor('pist', 'H').id, 'ah');
  assert.equal(antalIGrupp(gruppFor('ak', 'A'), { A: 2, D: 3 }), 5);
});
