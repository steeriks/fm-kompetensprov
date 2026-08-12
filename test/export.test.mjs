import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { underlag, somText, somCsv, somXlsx, somPdf } from '../src/export.js';

const UT = process.env.EXPORT_UT || path.join(os.tmpdir(), 'fm-kompetensprov-prov');
fs.mkdirSync(UT, { recursive: true });

// p2 saknar fältet helt — så ser poster ut som lades upp innan Fmid/Anstnr
// fanns, och de ska exporteras utan att kolumnen tappar sin plats.
//
// Namnen är påhittade och Fmid-värdena är Fmid — inte personnummer. Fältet
// heter Fmid/Anstnr och ska aldrig bära ett personnummer, någonstans: varken
// i appen, i exempeltexterna eller här. Arkivet är publikt och appen hanterar
// uppgifter om anställd personal, så testdata ska gå att se på och avfärda
// direkt, utan att någon behöver räkna efter på en kontrollsiffra.
const personer = [
  { id: 'p1', namn: 'Andersson, Åsa', forband: '1. plut', fmid: 'AsAn07' },
  { id: 'p2', namn: 'Öberg, Björn', forband: '1. plut' },
  { id: 'p3', namn: 'Ek, Cecilia', forband: '2. plut', fmid: 'CeEk12' },
];
const omgang = {
  id: 'o1', gren: 'pist', datum: '2026-08-11',
  plats: 'Hätilä skjutbana', instruktor: 'S. Eriksson',
  deltagare: ['p1', 'p2', 'p3'],
};
const resultat = [
  // Godkänd på första försöket
  { id: 'r1', omgangId: 'o1', personId: 'p1', forsok: 1, tid: 11.2,
    traffar: { B: 4, A: 2 }, vapenhanteringUnderkand: false, registrerad: '2026-08-11T10:00:00Z' },
  // Underkänd, sedan godkänd
  { id: 'r2', omgangId: 'o1', personId: 'p2', forsok: 1, tid: 15.0,
    traffar: { C: 4, H: 2 }, vapenhanteringUnderkand: false, registrerad: '2026-08-11T10:05:00Z' },
  { id: 'r3', omgangId: 'o1', personId: 'p2', forsok: 2, tid: 10.5,
    traffar: { B: 2, C: 2, A: 2 }, vapenhanteringUnderkand: false, registrerad: '2026-08-11T10:20:00Z' },
  // p3 har inte skjutit
];

const u = underlag(omgang, personer, resultat);

test('underlaget räknar godkända per skytt, inte per försök', () => {
  assert.equal(u.antalSkyttar, 3);
  assert.equal(u.godkanda, 2, 'p2 blev godkänd på andra försöket');
  assert.equal(u.rader.length, 4, 'tre försök plus en ej skjuten');
  assert.equal(u.rader.at(-1).celler.at(-2), 'Ej skjuten');
  assert.deepEqual(u.rader.map((r) => r.nr), [1, 2, 2, 3],
    'numret är skjutordningen, och upprepas för varje försök');
  assert.deepEqual(u.kolumner.slice(0, 4), ['Nr', 'Fmid/Anstnr', 'Namn', 'Förband'],
    'Fmid/Anstnr står före namnet');
});

test('texten innehåller rubrik, försök och summering', () => {
  const t = somText(u);
  assert.match(t, /Pistol — Delmoment 14/);
  assert.match(t, /Hätilä skjutbana/);
  assert.match(t, /1\. AsAn07 · Andersson, Åsa \(1\. plut\)/,
    'fmid står före namnet även i textformen');
  assert.match(t, /2\. Öberg, Björn \(1\. plut\)/, 'utan fmid står namnet direkt');
  // Träffarna skrivs alltid i zonordning A B C D X H, inte i den ordning de
  // knappades in — protokollet ska se likadant ut varje gång.
  assert.match(t, /Försök 1: 11,20 s · A2 B4 · 26 p · PK 2,32 · GODKÄND/);
  // 4 × C (3 p) + 2 × H (1 p) = 14 p på 15,0 s → 0,93
  assert.match(t, /UNDERKÄND \(Poängkvot 0,93 — kravet är 2,00\)/);
  assert.match(t, /ej skjuten/);
  assert.match(t, /2 av 3 godkända\./);
});

test('csv:n har BOM, semikolon och tal med komma', () => {
  const c = somCsv(u);
  assert.ok(c.startsWith('﻿'), 'BOM krävs för att Excel ska läsa å ä ö');
  assert.match(c, /Nr;Fmid\/Anstnr;Namn;Förband;Försök;Tid \(s\)/);
  assert.match(c, /1;AsAn07;Andersson, Åsa;1\. plut;1;11,20/);
  assert.match(c, /2;;Öberg, Björn;1\. plut;1;15,00/, 'tomt fmid lämnar cellen tom');
  assert.ok(c.includes('\r\n'), 'radbrytning enligt csv-konvention');
});

test('xlsx är en zip med de delar Excel kräver', () => {
  const bytes = somXlsx(u);
  assert.equal(bytes[0], 0x50, 'PK-signatur');
  assert.equal(bytes[1], 0x4b);
  const text = Buffer.from(bytes).toString('latin1');
  for (const del of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/worksheets/sheet1.xml', 'xl/styles.xml', 'xl/_rels/workbook.xml.rels']) {
    assert.ok(text.includes(del), `saknar ${del}`);
  }
  assert.ok(text.includes('Hätilä') === false, 'text ska ligga UTF-8-kodad, inte latin1');
  fs.writeFileSync(path.join(UT, 'prov.xlsx'), bytes);
});

test('pdf har rubrik, xref och slutmarkör', () => {
  const bytes = somPdf(u);
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('/Type /Catalog'));
  assert.ok(text.includes('Helvetica'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  // xref-tabellens startpekare ska peka på ordet "xref"
  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref', 'startxref pekar fel');
  // Åsa och Öberg ska finnas som WinAnsi-byte, inte som frågetecken
  assert.ok(text.includes('Andersson, \xc5sa'), 'Å ska kodas som WinAnsi 0xC5');
  assert.ok(text.includes('\xd6berg'), 'Ö ska kodas som WinAnsi 0xD6');
  fs.writeFileSync(path.join(UT, 'prov.pdf'), bytes);
});

test('automatkarbin ger nio zonkolumner och rätt krav i huvudet', () => {
  const akOmgang = { ...omgang, gren: 'ak', id: 'o2' };
  const akResultat = [{
    id: 'r9', omgangId: 'o2', personId: 'p1', forsok: 1, tid: 24.5,
    traffar: { B: 5, C: 4, D: 2 }, vapenhanteringUnderkand: false,
    registrerad: '2026-08-11T11:00:00Z',
  }];
  const au = underlag(akOmgang, personer, akResultat);
  const t = somText(au);
  assert.match(t, /Automatkarbin — Delmoment 12/);
  assert.match(t, /Krav: poängkvot 1,00/);
  // 5×B(4) + 4×C(3) = 32, de nio bästa; D:na faller bort
  assert.match(t, /32 p · PK 1,31 · GODKÄND/);
  fs.writeFileSync(path.join(UT, 'prov-ak.pdf'), somPdf(au));
  fs.writeFileSync(path.join(UT, 'prov-ak.xlsx'), somXlsx(au));
});
