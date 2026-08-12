// Härdningen, låst fast i tester.
//
// Appen hanterar namn, förband och Fmid på anställd personal. Löftet är att
// ingenting lämnar telefonen förrän instruktören själv trycker på exportknappen
// — och att det som lämnar den då gör det genom delningsrutan, som användaren
// ser och styr över.
//
// bygg.py kontrollerar samma sak och stoppar bygget. Att det står här också är
// avsiktligt: bygget går att köra med en ändrad bygg.py, och då ska testerna
// fortfarande säga ifrån. De läser den byggda filen, alltså exakt den artefakt
// som hamnar på telefonen och på GitHub Pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROT = path.join(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROT, 'dist', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROT, 'dist', 'sw.js'), 'utf8');

// HTML-kommentarer kör inte. Kommentaren som förklarar CSP:n nämner API:erna
// vid namn, och ska få göra det utan att fälla sina egna tester.
const kod = html.replace(/<!--[\s\S]*?-->/g, '');

test('den byggda filen har ingen väg att skicka data ut', () => {
  for (const [monster, namn] of [
    [/\bfetch\s*\(/, 'fetch()'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bEventSource\b/, 'EventSource'],
    [/\bsendBeacon\b/, 'navigator.sendBeacon'],
    [/\bimportScripts\s*\(/, 'importScripts()'],
  ]) {
    assert.ok(!monster.test(kod), `${namn} ska inte finnas i den byggda appen`);
  }
});

test('CSP:n stänger vägarna ut', () => {
  const tagg = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
  assert.ok(tagg, 'CSP-taggen ska finnas i den byggda filen');
  for (const direktiv of ["connect-src 'none'", "form-action 'none'",
    "object-src 'none'", "base-uri 'none'"]) {
    assert.ok(tagg[1].includes(direktiv), `CSP ska innehålla ${direktiv}`);
  }
});

test('inga okända adresser i den byggda filen', () => {
  // Namnrymderna är identifierare i xlsx-formatet, inte något som hämtas.
  // GitHub-länken står i hjälptexten och öppnas bara om användaren trycker.
  const tillatna = [
    /^http:\/\/schemas\.openxmlformats\.org\//,
    /^https:\/\/github\.com\/steeriks\/fm-kompetensprov\/issues$/,
  ];
  const adresser = [...new Set((kod.match(/https?:\/\/[^\s"'<>)]+/g) || [])
    .map((u) => u.replace(/[.,;'"<)]+$/, '')))];
  const okanda = adresser.filter((u) => !tillatna.some((m) => m.test(u)));
  assert.deepEqual(okanda, [], `okända adresser: ${okanda.join(', ')}`);
});

test('lagringen ligger i telefonen och ingen annanstans', () => {
  assert.ok(!/\bindexedDB\b/.test(kod), 'ingen IndexedDB');
  assert.ok(!/document\.cookie/.test(kod), 'inga kakor');
  assert.ok(/localStorage/.test(kod), 'localStorage är den lagring som ska användas');
});

test('servicearbetaren hämtar bara appens egna filer, cachen först', () => {
  assert.match(sw, /url\.origin !== self\.location\.origin/,
    'främmande värdar ska inte passera servicearbetaren');
  // Cachen först: annars hör varje start med täckning av sig till GitHub Pages.
  const forstaSvar = sw.slice(sw.indexOf('respondWith'));
  assert.ok(forstaSvar.indexOf('caches.match') < forstaSvar.indexOf('fetch('),
    'cachen ska frågas före nätet');
});
