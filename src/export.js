// Export — samma underlag i fyra former: text, CSV, XLSX och PDF.
//
// Inga bibliotek. Appen ska vara en enda fil utan en enda extern begäran, och
// då kan den inte luta sig mot en CDN. XLSX är en ZIP med XML som skrivs
// okomprimerad (STORED) — giltigt, och ingen deflate behöver implementeras.
// PDF:en byggs för hand med inbyggd Helvetica och WinAnsi, som täcker å ä ö.

import { PROV, bedom, komma, raknadeTraffar, ZONORDNING } from './regler.js';

// ------------------------------------------------------------- underlaget

/** Bygger tabellen som alla fyra formaten skriver ut. */
export function underlag(omgang, personer, resultat) {
  const prov = PROV[omgang.gren];
  const zoner = ZONORDNING;
  const kolumner = [
    // Numret är skyttens plats i skjutordningen — och därmed tavelnumret på
    // banan. Det är det man matchar mot när protokollet läses efteråt.
    // Fmid/Anstnr står före namnet: det är den identitet ett förband matchar
    // protokollet mot, och den är tom för den som inte fyllt i något.
    'Nr', 'Fmid/Anstnr', 'Namn', 'Förband', 'Försök', 'Tid (s)',
    ...zoner.map((z) => `${z} (${{ A: 5, B: 4, C: 3, D: 3, X: 2, H: 1 }[z]}p)`),
    'Poäng', 'PK', 'Utfall', 'Anmärkning',
  ];
  const rader = [];
  let godkanda = 0;
  for (const [index, id] of omgang.deltagare.entries()) {
    const p = personer.find((x) => x.id === id);
    if (!p) continue;
    const nr = index + 1;
    const forsok = resultat.filter((r) => r.personId === id && r.registrerad);
    if (!forsok.length) {
      rader.push({
        person: p, nr, forsok: null,
        celler: [nr, p.fmid || '', p.namn, p.forband, '', '',
          ...zoner.map(() => ''), '', '', 'Ej skjuten', ''],
      });
      continue;
    }
    // Godkänd på något av försöken räcker — provet får skjutas tre gånger.
    if (forsok.some((r) => bedom(omgang.gren, r.traffar, r.tid, r.vapenhanteringUnderkand).godkand)) {
      godkanda++;
    }
    for (const r of forsok) {
      const b = bedom(omgang.gren, r.traffar, r.tid, r.vapenhanteringUnderkand);
      // Protokollet visar de träffar bedömningen vilar på, inte varje hål i
      // tavlan. Bättringsskotten hör hemma i appen, där instruktören knappar;
      // det som lämnar telefonen ska gå att lägga bredvid poängen och summera
      // utan att någon behöver veta vilka träffar som föll bort.
      const traffar = raknadeTraffar(omgang.gren, r.traffar);
      rader.push({
        person: p, nr, forsok: r, bedomning: b, traffar,
        celler: [
          nr, p.fmid || '', p.namn, p.forband, r.forsok, r.tid === null ? '' : komma(r.tid),
          ...zoner.map((z) => traffar[z] || 0),
          b.poang, b.pk === null ? '' : komma(b.pk),
          b.godkand ? 'Godkänd' : 'Underkänd',
          b.godkand ? '' : b.brister.join('; '),
        ],
      });
    }
  }
  return {
    omgang, prov, kolumner, rader,
    antalSkyttar: omgang.deltagare.length,
    godkanda,
    rubrik: `${prov.namn} — ${prov.delmoment}`,
    filnamn: `kompetensprov-${prov.kod}-${omgang.datum}`,
  };
}

/**
 * Kort form av bristerna, för PDF-tabellens smala kolumn. Text och CSV får
 * den fullständiga formuleringen — där finns plats, och den ska gå att läsa
 * utan att kunna appens förkortningar.
 */
export function kortAnmarkning(bedomning) {
  if (!bedomning) return '';
  return bedomning.brister.map((b) => b
    .replace(/^Poängkvot (\S+) — kravet är (\S+)$/, 'PK $1 < $2')
    .replace(/^(\w+): (\d+) av (\d+) träff$/, '$1 $2/$3')
    .replace(/^(\d+) av (\d+) träff$/, '$1/$2 träff')
    .replace(/^Underkänd vapenhantering$/, 'Vapenhantering'),
  ).join('; ');
}

function huvudrader(u) {
  const o = u.omgang;
  return [
    u.rubrik,
    `${o.datum}${o.plats ? ' · ' + o.plats : ''}${o.instruktor ? ' · Instruktör: ' + o.instruktor : ''}`,
    `${u.prov.avstand}, ${u.prov.mal} · Krav: poängkvot ${komma(u.prov.pkKrav)}`,
  ];
}

// ------------------------------------------------------------------- text

export function somText(u) {
  const rader = [...huvudrader(u), ''];
  let nuvarande = null;
  for (const rad of u.rader) {
    if (rad.person.id !== nuvarande) {
      nuvarande = rad.person.id;
      rader.push(`${rad.nr}. ${rad.person.fmid ? rad.person.fmid + ' · ' : ''}${rad.person.namn}`
        + `${rad.person.forband ? ' (' + rad.person.forband + ')' : ''}`);
    }
    if (!rad.forsok) {
      rader.push('   Ej skjuten');
      continue;
    }
    const b = rad.bedomning;
    const traffar = ZONORDNING.filter((z) => rad.traffar[z])
      .map((z) => `${z}${rad.traffar[z]}`).join(' ');
    rader.push(
      `   Försök ${rad.forsok.forsok}: ${komma(rad.forsok.tid)} s · ${traffar || 'inga träffar'}` +
      ` · ${b.poang} p · PK ${komma(b.pk)} · ${b.godkand ? 'GODKÄND' : 'UNDERKÄND'}` +
      (b.godkand ? '' : ` (${b.brister.join('; ')})`),
    );
  }
  rader.push('', `${u.godkanda} av ${u.antalSkyttar} godkända.`);
  return rader.join('\n');
}

// -------------------------------------------------------------------- CSV

export function somCsv(u) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rader = [
    ...huvudrader(u).map((r) => cell(r)),
    '',
    u.kolumner.map(cell).join(';'),
    ...u.rader.map((rad) => rad.celler.map(cell).join(';')),
    '',
    cell(`${u.godkanda} av ${u.antalSkyttar} godkända`),
  ];
  // Semikolon och BOM: svensk Excel öppnar då filen rätt utan importdialog,
  // och å ä ö blir inte förvanskade.
  return '﻿' + rader.join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------- XLSX
//
// En xlsx är en ZIP med några XML-delar. Vi skriver posterna okomprimerade,
// vilket formatet tillåter — då slipper vi en deflate-implementation, och
// Excel bryr sig inte.

const CRC_TABELL = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELL[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(filer) {
  const kodare = new TextEncoder();
  const delar = [];
  const katalog = [];
  let offset = 0;
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  for (const fil of filer) {
    const namn = kodare.encode(fil.namn);
    const data = typeof fil.data === 'string' ? kodare.encode(fil.data) : fil.data;
    const crc = crc32(data);
    // Flagga 0x0800 = filnamnen är UTF-8. Tid/datum lämnas nollade; det är
    // giltigt och gör bygget deterministiskt.
    const huvud = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(namn.length), ...u16(0),
    ];
    delar.push(new Uint8Array(huvud), namn, data);
    katalog.push({ namn, crc, storlek: data.length, offset });
    offset += huvud.length + namn.length + data.length;
  }

  const katalogDelar = [];
  let katalogStorlek = 0;
  for (const post of katalog) {
    const huvud = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0), ...u32(post.crc), ...u32(post.storlek), ...u32(post.storlek),
      ...u16(post.namn.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(post.offset),
    ];
    katalogDelar.push(new Uint8Array(huvud), post.namn);
    katalogStorlek += huvud.length + post.namn.length;
  }
  const slut = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(katalog.length), ...u16(katalog.length),
    ...u32(katalogStorlek), ...u32(offset), ...u16(0),
  ]);

  const allt = [...delar, ...katalogDelar, slut];
  const total = allt.reduce((n, d) => n + d.length, 0);
  const ut = new Uint8Array(total);
  let p = 0;
  for (const d of allt) { ut.set(d, p); p += d.length; }
  return ut;
}

const xmlEsc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function kolumnBokstav(i) {
  let s = '';
  i += 1;
  while (i > 0) {
    const rest = (i - 1) % 26;
    s = String.fromCharCode(65 + rest) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export function somXlsx(u) {
  const arkRader = [];
  const skrivRad = (radnr, celler, fet = false) => {
    const c = celler.map((v, i) => {
      const ref = kolumnBokstav(i) + radnr;
      const stil = fet ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<c r="${ref}"${stil}><v>${v}</v></c>`;
      }
      if (v === '' || v === null || v === undefined) return `<c r="${ref}"${stil}/>`;
      return `<c r="${ref}"${stil} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    arkRader.push(`<row r="${radnr}">${c}</row>`);
  };

  let rad = 1;
  for (const text of huvudrader(u)) skrivRad(rad++, [text], true);
  rad++;
  skrivRad(rad++, u.kolumner, true);
  for (const r of u.rader) {
    // Tid och PK som text med komma vore obrukbart i kalkyl — skriv tal.
    const celler = r.celler.map((v) => {
      if (typeof v === 'string' && /^-?\d+,\d+$/.test(v)) return Number(v.replace(',', '.'));
      return v;
    });
    skrivRad(rad++, celler);
  }
  rad++;
  skrivRad(rad++, [`${u.godkanda} av ${u.antalSkyttar} godkända`], true);

  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const filer = [
    {
      namn: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      namn: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      namn: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Resultat" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      namn: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      namn: 'xl/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${ns}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    {
      namn: 'xl/worksheets/sheet1.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${ns}"><sheetData>${arkRader.join('')}</sheetData></worksheet>`,
    },
  ];
  return zip(filer);
}

// -------------------------------------------------------------------- PDF
//
// Ett minimalt PDF-dokument: inbyggd Helvetica (finns i alla läsare, ingen
// font behöver bäddas in) med WinAnsiEncoding, som täcker å ä ö.

const SIDBREDD = 595;   // A4 i punkter
const SIDHOJD = 842;
const MARGINAL = 36;

function winAnsi(text) {
  // WinAnsi ligger nära Latin-1 för det vi behöver. Tecken utanför byts mot
  // frågetecken hellre än att ge en trasig fil.
  const ut = [];
  const SARSKILDA = {
    0x2013: 0x96,   // – kort tankstreck
    0x2014: 0x97,   // — långt tankstreck
    0x2018: 0x91, 0x2019: 0x92,
    0x201c: 0x93, 0x201d: 0x94,
    0x2022: 0x95,   // punktlista
    0x2026: 0x85,   // … avbrott — utan den här raden blev kapad text "?"
  };
  for (const tecken of String(text)) {
    const k = tecken.codePointAt(0);
    if (SARSKILDA[k]) ut.push(SARSKILDA[k]);
    else if (k < 256) ut.push(k);
    else ut.push(0x3f);
  }
  return ut;
}

function pdfText(text) {
  const ut = [];
  for (const b of winAnsi(text)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) ut.push(0x5c);  // ( ) \
    ut.push(b);
  }
  return ut;
}

/** Ungefärlig textbredd i punkter — räcker för att kapa text som inte får
 *  plats i sin kolumn. Helvetica är ~0,5 em i snitt för gemener. */
function bredd(text, storlek) {
  return String(text).length * storlek * 0.52;
}

function kapa(text, storlek, maxbredd) {
  let s = String(text ?? '');
  if (bredd(s, storlek) <= maxbredd) return s;
  while (s.length > 1 && bredd(s + '…', storlek) > maxbredd) s = s.slice(0, -1);
  return s + '…';
}

export function somPdf(u) {
  // Kolumnbredderna måste summera till sidbredden minus båda marginalerna
  // (595 − 72 = 523 pt), annars hamnar sista kolumnen utanför pappret.
  // Fmid/Anstnr fick sina 64 pt ur anmärkningen, förbandet och två pt per
  // zonkolumn — de rymmer en siffra och behövde aldrig sina 18. Bredden är
  // tilltagen med marginal: ett id som kapas med "…" är värdelöst i just den
  // kolumn som ska peka ut en människa, och Fmid/Anstnr skrivs olika långt.
  const kol = [
    { rubrik: 'Nr', bredd: 16 },
    { rubrik: 'Fmid/Anstnr', bredd: 64 },
    { rubrik: 'Namn', bredd: 84 },
    { rubrik: 'Förband', bredd: 46 },
    { rubrik: 'F', bredd: 12 },
    { rubrik: 'Tid', bredd: 30 },
    ...ZONORDNING.map((z) => ({ rubrik: z, bredd: 16 })),
    { rubrik: 'Poäng', bredd: 30 },
    { rubrik: 'PK', bredd: 28 },
    { rubrik: 'Utfall', bredd: 46 },
    { rubrik: 'Anmärkning', bredd: 71 },
  ];
  const summa = kol.reduce((n, k) => n + k.bredd, 0);
  if (summa > SIDBREDD - 2 * MARGINAL) {
    throw new Error(`Kolumnerna är ${summa} pt breda, sidan rymmer ${SIDBREDD - 2 * MARGINAL}`);
  }

  const sidor = [];
  let strommar = [];
  let y = 0;

  const nySida = () => {
    strommar = [];
    sidor.push(strommar);
    y = SIDHOJD - MARGINAL;
  };
  const skriv = (text, x, storlek, fet) => {
    strommar.push(
      `BT /${fet ? 'F2' : 'F1'} ${storlek} Tf 1 0 0 1 ${x} ${y} Tm (` +
      String.fromCharCode(...pdfText(text)) + ') Tj ET',
    );
  };
  const rad = (celler, storlek, fet) => {
    let x = MARGINAL;
    celler.forEach((v, i) => {
      skriv(kapa(v, storlek, kol[i].bredd - 3), x, storlek, fet);
      x += kol[i].bredd;
    });
    y -= storlek + 4;
  };

  nySida();
  for (const text of huvudrader(u)) {
    skriv(text, MARGINAL, text === u.rubrik ? 14 : 9, text === u.rubrik);
    y -= (text === u.rubrik ? 14 : 9) + 6;
  }
  y -= 6;
  rad(kol.map((k) => k.rubrik), 8, true);
  y -= 2;

  for (const r of u.rader) {
    if (y < MARGINAL + 40) {
      nySida();
      rad(kol.map((k) => k.rubrik), 8, true);
      y -= 2;
    }
    // Nollor i zonkolumnerna görs tomma — en tabell full av nollor är svårare
    // att läsa än en gles. Sista kolumnen får den korta anmärkningen.
    const celler = r.celler.map((v) => (v === 0 ? '' : v));
    celler[celler.length - 1] = kortAnmarkning(r.bedomning);
    rad(celler, 8, false);
  }
  y -= 8;
  if (y < MARGINAL) nySida();
  skriv(`${u.godkanda} av ${u.antalSkyttar} godkända.`, MARGINAL, 9, true);

  // --- sätt ihop filen; xref kräver byteoffset för varje objekt ---
  const bitar = [];
  let langd = 0;
  const skrivBytes = (bytes) => { bitar.push(bytes); langd += bytes.length; };
  const skrivRad = (text) => skrivBytes(new Uint8Array(winAnsi(text + '\n')));

  const objekt = [];
  const sidObjektNr = (i) => 4 + i * 2;          // sida, sedan dess innehåll
  const antalSidor = sidor.length;
  const fontNr = 4 + antalSidor * 2;

  skrivRad('%PDF-1.4');
  const laggObjekt = (nr, kropp, strom) => {
    objekt[nr] = langd;
    skrivRad(`${nr} 0 obj`);
    skrivRad(kropp);
    if (strom !== undefined) {
      skrivRad('stream');
      skrivBytes(new Uint8Array(winAnsi(strom)));
      skrivRad('');
      skrivRad('endstream');
    }
    skrivRad('endobj');
  };

  laggObjekt(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const barn = sidor.map((_, i) => `${sidObjektNr(i)} 0 R`).join(' ');
  laggObjekt(2, `<< /Type /Pages /Kids [${barn}] /Count ${antalSidor} >>`);
  laggObjekt(3, '<< >>');   // platshållare så numreringen blir läsbar

  sidor.forEach((strom, i) => {
    const innehall = strom.join('\n');
    const bytes = winAnsi(innehall).length;
    laggObjekt(sidObjektNr(i),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SIDBREDD} ${SIDHOJD}] ` +
      `/Resources << /Font << /F1 ${fontNr} 0 R /F2 ${fontNr + 1} 0 R >> >> ` +
      `/Contents ${sidObjektNr(i) + 1} 0 R >>`);
    laggObjekt(sidObjektNr(i) + 1, `<< /Length ${bytes} >>`, innehall);
  });

  laggObjekt(fontNr, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  laggObjekt(fontNr + 1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const antalObjekt = fontNr + 2;
  const xrefPos = langd;
  skrivRad('xref');
  skrivRad(`0 ${antalObjekt}`);
  skrivRad('0000000000 65535 f ');
  for (let nr = 1; nr < antalObjekt; nr++) {
    skrivRad(String(objekt[nr] ?? 0).padStart(10, '0') + ' 00000 n ');
  }
  skrivRad('trailer');
  skrivRad(`<< /Size ${antalObjekt} /Root 1 0 R >>`);
  skrivRad('startxref');
  skrivRad(String(xrefPos));
  skrivRad('%%EOF');

  const ut = new Uint8Array(langd);
  let p = 0;
  for (const b of bitar) { ut.set(b, p); p += b.length; }
  return ut;
}

// --------------------------------------------------------- dela eller spara

const MIME = {
  txt: 'text/plain',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/**
 * Skickar filen till delningsrutan (som öppnar Mail på både iPhone och
 * Android). Går det inte laddas den ned i stället. Returnerar vad som hände,
 * så att gränssnittet kan säga det rakt ut.
 */
export async function dela(filnamn, innehall, format, text = '') {
  const blob = new Blob([innehall], { type: MIME[format] });
  const fil = new File([blob], filnamn, { type: MIME[format] });
  if (navigator.canShare && navigator.canShare({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil], title: filnamn, text });
      return 'delad';
    } catch (fel) {
      if (fel && fel.name === 'AbortError') return 'avbruten';
      // Faller igenom till nedladdning
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filnamn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'nedladdad';
}
