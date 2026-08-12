// Tolkningen av en inklistrad skyttelista. Ren funktion, så den provas direkt
// mot källan — resten av importen (dubbletter, inläggning, granskningen i
// gränssnittet) provas mot den byggda filen i flode.test.mjs.
//
// Listan kommer från verkligheten: ur ett mail, ett meddelande eller ett
// kalkylark. Proven nedan är formerna den faktiskt dyker upp i.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tolkaSkyttelista } from '../src/lagring.js';

const namn = (text) => tolkaSkyttelista(text).poster.map((p) => p.namn);

test('en rad per skytt, bara namn', () => {
  const { poster, ogiltiga } = tolkaSkyttelista('Ek, Anna\nBerg, Bo\nCraf, Cia');
  assert.deepEqual(poster.map((p) => p.namn), ['Ek, Anna', 'Berg, Bo', 'Craf, Cia']);
  assert.deepEqual(poster.map((p) => p.forband), ['', '', '']);
  assert.deepEqual(ogiltiga, []);
});

test('kommatecknet tillhör namnet och delar inte raden', () => {
  // Det här är hela skälet till att komma inte är avgränsare: "Ek, Anna" är
  // ett namn, inte en skytt vid namn Ek på förbandet Anna.
  const { poster } = tolkaSkyttelista('Ek, Anna');
  assert.equal(poster.length, 1);
  assert.equal(poster[0].namn, 'Ek, Anna');
  assert.equal(poster[0].forband, '');
});

test('semikolon skiljer namn, förband och Fmid', () => {
  const { poster } = tolkaSkyttelista('Ek, Anna; 1. plut; 850101-1234');
  assert.deepEqual(poster[0], { namn: 'Ek, Anna', forband: '1. plut', fmid: '850101-1234', rad: 1 });
});

test('tabb duger lika bra — så klistras ett kalkylark in', () => {
  const { poster } = tolkaSkyttelista('Ek, Anna\t1. plut\t850101-1234');
  assert.equal(poster[0].forband, '1. plut');
  assert.equal(poster[0].fmid, '850101-1234');
});

test('tabb vinner över semikolon när båda står på raden', () => {
  // En kalkylarksrad där förbandet självt innehåller ett semikolon får inte
  // delas på fel tecken.
  const { poster } = tolkaSkyttelista('Ek, Anna\t1. plut; 2. grp');
  assert.equal(poster[0].forband, '1. plut; 2. grp');
});

test('numrering och streck i början av raden stryks', () => {
  assert.deepEqual(namn('1. Ek, Anna\n2) Berg, Bo\n- Craf, Cia\n• Dahl, Dan\n* Ek, Erik'),
    ['Ek, Anna', 'Berg, Bo', 'Craf, Cia', 'Dahl, Dan', 'Ek, Erik']);
});

test('en siffra som hör till namnet överlever', () => {
  // "3. komp" är inget listnummer utan början på namnet — strykningen kräver
  // mellanslag efter punkten, och här finns det ju. Provet står här för att
  // fånga dagen någon gör mönstret girigare.
  assert.deepEqual(namn('12345 Ek, Anna'), ['12345 Ek, Anna']);
});

test('tomma rader och tabbmellanrum hoppas över utan att bli fel', () => {
  const { poster, ogiltiga } = tolkaSkyttelista('\nEk, Anna\n\n   \nBerg, Bo\n\n');
  assert.deepEqual(poster.map((p) => p.namn), ['Ek, Anna', 'Berg, Bo']);
  assert.deepEqual(ogiltiga, []);
});

test('rubrikraden från ett kalkylark räknas inte som skytt', () => {
  const { poster } = tolkaSkyttelista('Namn;Förband;Fmid\nEk, Anna;1. plut;850101-1234');
  assert.equal(poster.length, 1);
  assert.equal(poster[0].namn, 'Ek, Anna');
});

test('men bara den första raden — någon kan faktiskt heta Namn', () => {
  const { poster } = tolkaSkyttelista('Ek, Anna\nNamn\nBerg, Bo');
  assert.deepEqual(poster.map((p) => p.namn), ['Ek, Anna', 'Namn', 'Berg, Bo']);
});

test('BOM och CRLF från en Excel-fil stör inte', () => {
  const { poster } = tolkaSkyttelista('﻿Ek, Anna;1. plut\r\nBerg, Bo;2. plut\r\n');
  assert.deepEqual(poster.map((p) => p.namn), ['Ek, Anna', 'Berg, Bo'],
    'BOM:en får inte sitta kvar osynligt först i namnet');
  assert.equal(poster[1].forband, '2. plut', 'vagnreturen får inte hänga kvar i fältet');
});

test('citerade celler avciteras, som Excel skriver dem', () => {
  const { poster } = tolkaSkyttelista('"Ek, Anna";"1. plut";"850101-1234"');
  assert.equal(poster[0].namn, 'Ek, Anna');
  assert.equal(poster[0].forband, '1. plut');

  const { poster: p2 } = tolkaSkyttelista('"Ek ""Anna"" Eriksson";1. plut');
  assert.equal(p2[0].namn, 'Ek "Anna" Eriksson', 'fördubblade citattecken blir ett');
});

test('en rad utan namn läses inte in, men rapporteras med radnummer', () => {
  const { poster, ogiltiga } = tolkaSkyttelista('Ek, Anna\n;1. plut;850101-1234\nBerg, Bo');
  assert.deepEqual(poster.map((p) => p.namn), ['Ek, Anna', 'Berg, Bo']);
  assert.equal(ogiltiga.length, 1);
  assert.equal(ogiltiga[0].rad, 2, 'radnumret ska peka i den inklistrade texten');
});

test('radnumret räknar tomma rader med, så det går att peka i texten', () => {
  const { poster } = tolkaSkyttelista('\n\nEk, Anna');
  assert.equal(poster[0].rad, 3);
});

test('en tom lista ger ingenting och inga fel', () => {
  assert.deepEqual(tolkaSkyttelista(''), { poster: [], ogiltiga: [] });
  assert.deepEqual(tolkaSkyttelista('\n  \n'), { poster: [], ogiltiga: [] });
});

test('överflödiga fält ignoreras i stället för att stoppa raden', () => {
  const { poster } = tolkaSkyttelista('Ek, Anna;1. plut;850101-1234;något extra');
  assert.equal(poster[0].fmid, '850101-1234');
});
