// FM kompetensprov — gränssnitt och flöde.
//
// Appen följer hur provet faktiskt går till: instruktören skjuter en skytt i
// taget och knappar in TIDERNA för hela linjen, går sedan fram till tavlorna
// och knappar in POÄNGEN för samma skyttar i samma ordning. Därför har
// vallistan två lägen i stället för ett formulär per skytt — och därför finns
// "Nästa som saknar …", som är hela svepet i en knapp.

import {
  PROV, BEDOMNING, ZONPOANG, ZONORDNING, bedom, komma, taltolk,
  gruppFor, antalIGrupp, arFull,
} from './regler.js';
import * as lager from './lagring.js';
import { underlag, somText, somCsv, somXlsx, somPdf, dela } from './export.js';

const app = document.getElementById('app');
const bottenrad = document.getElementById('bottenrad');
const rubrik = document.getElementById('rubrik');
const underrubrik = document.getElementById('underrubrik');
const hemKnapp = document.getElementById('hem');

// Vy, och vad vyn handlar om. Ingen router — appen är en enda skärm i taget
// och webbläsarens bakåtknapp hanteras med history.state.
let vy = { namn: 'start' };
let utkastTid = '';       // sifferknappsatsens buffert

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function vibrera(ms = 20) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function flash(text, sekunder = 2.5) {
  document.querySelectorAll('.flash').forEach((e) => e.remove());
  const d = document.createElement('div');
  d.className = 'flash';
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), sekunder * 1000);
}

/**
 * Byter vy. `ersatt` lägger den nya vyn i stället för den nuvarande i
 * historiken, i stället för ovanpå. Det används varje gång vi går tillbaka
 * till vallistan eller vidare till nästa skytt: annars växer stacken med en
 * post per knappsatsskärm, och bakåtknappen skulle vandra baklänges genom
 * hela skjutlaget i stället för att lämna listan.
 */
function gaTill(namn, extra = {}, ersatt = false) {
  vy = { namn, ...extra };
  utkastTid = '';
  if (ersatt) history.replaceState(vy, '');
  else history.pushState(vy, '');
  rita();
}

window.addEventListener('popstate', (e) => {
  vy = e.state || { namn: 'start' };
  rita();
});

// ------------------------------------------------------------------ start

function ritaStart() {
  const omgangar = lager.omgangar();
  rubrik.firstChild.textContent = 'FM kompetensprov';
  underrubrik.textContent = 'Pistol och automatkarbin';
  hemKnapp.hidden = true;

  const lista = omgangar.length ? omgangar.map((o) => {
    const prov = PROV[o.gren];
    const res = lager.resultat(o.id).filter((r) => r.registrerad);
    const godkanda = new Set(res
      .filter((r) => bedom(o.gren, r.traffar, r.tid, r.vapenhanteringUnderkand).godkand)
      .map((r) => r.personId)).size;
    return `<button class="skyttrad" data-oppna="${o.id}">
      <span class="namn">${esc(prov.namn)} · ${esc(o.datum)}</span>
      <span class="forband">${esc(o.plats || 'utan plats')}${o.instruktor ? ' · ' + esc(o.instruktor) : ''}</span>
      <span class="varden"><b>${godkanda}/${o.deltagare.length}</b><br>godkända</span>
    </button>`;
  }).join('') : '<p class="tom">Inga omgångar ännu.<br>Börja med att lägga upp en.</p>';

  app.innerHTML = `<h2>Omgångar</h2>${lista}`
    + (omgangar.length ? '<p class="dampad liten">Svep vänster på en omgång för att radera den.</p>' : '');
  bottenrad.innerHTML = `
    <button class="knapp primar" data-vy="ny">+ Ny omgång</button>
    <div class="knapprad">
      <button class="knapp liten" data-vy="anvisning">Anvisningar</button>
      <button class="knapp liten" data-vy="register">Skyttar</button>
      <button class="knapp liten" data-vy="installningar">Inställningar</button>
    </div>`;
}

// ------------------------------------------------------------- ny omgång

function ritaNy() {
  rubrik.firstChild.textContent = 'Ny omgång';
  underrubrik.textContent = 'Välj prov och deltagare';
  hemKnapp.hidden = false;

  const personer = lager.personer();
  const ordning = vy.valda || [];       // ibockningsordningen ÄR skjutordningen
  const valda = new Set(ordning);
  app.innerHTML = `
    <label class="falt">Prov
      <select id="gren">
        <option value="pist">Pistol — Delmoment 14, BAS (PILEN)</option>
        <option value="ak">Automatkarbin — Delmoment 12, Bas</option>
      </select>
    </label>
    <div class="knapprad">
      <label class="falt" style="flex:1">Datum
        <input type="date" id="datum" value="${new Date().toISOString().slice(0, 10)}">
      </label>
    </div>
    <!-- Inga platshållartexter och ingen autoifyllning: i mörker går grå
         exempeltext inte att skilja från något som redan står i rutan. -->
    <label class="falt">Plats<input type="text" id="plats" autocomplete="off"></label>
    <label class="falt">Instruktör<input type="text" id="instruktor" autocomplete="off"></label>

    <h2>Deltagare i skjutordning</h2>
    <p class="dampad liten">Numret följer ordningen du bockar i dem, och är samma
    nummer som skyttens tavla på banan.</p>
    ${personer.length ? personer.map((p) => `
      <button class="skyttrad ${valda.has(p.id) ? 'klar' : ''}" data-vaxla="${p.id}">
        <span class="namn">${valda.has(p.id)
          ? `<span class="nr">${ordning.indexOf(p.id) + 1}.</span> ` : ''}${esc(p.namn)}</span>
        <span class="forband">${esc(p.forband || '')}</span>
        <span class="chip ${valda.has(p.id) ? 'g' : ''}">${valda.has(p.id) ? '✓ med' : 'lägg till'}</span>
      </button>`).join('')
      : '<p class="tom">Inga skyttar i registret ännu.</p>'}
    <div class="knapprad"><button class="knapp liten" data-ny-skytt="1">+ Ny skytt</button></div>`;

  app.querySelector('#gren').value = vy.gren || 'pist';
  for (const falt of ['datum', 'plats', 'instruktor']) {
    if (vy[falt]) app.querySelector('#' + falt).value = vy[falt];
  }
  bottenrad.innerHTML =
    `<button class="knapp primar" data-starta="1" ${valda.size ? '' : 'disabled'}>
       Starta omgången${valda.size ? ` (${valda.size} skyttar)` : ''}</button>`;
}

/** Sparar det som skrivits in innan vyn ritas om — annars tappas texten när
 *  listan uppdateras av en ibockning. */
function spegla() {
  for (const falt of ['gren', 'datum', 'plats', 'instruktor']) {
    const el = app.querySelector('#' + falt);
    if (el) vy[falt] = el.value;
  }
}

// -------------------------------------------------------------- vallistan

function ritaOmgang() {
  const o = lager.omgang(vy.omgangId);
  if (!o) return gaTill('start');
  const prov = PROV[o.gren];
  const lage = vy.lage || 'tid';
  rubrik.firstChild.textContent = `${prov.namn} ${o.datum}`;
  underrubrik.textContent = `${prov.delmoment} · krav PK ${komma(prov.pkKrav)}`;
  hemKnapp.hidden = false;

  const rader = o.deltagare.map((id, i) => {
    const p = lager.person(id);
    if (!p) return '';
    const nr = i + 1;   // skjutordningen är också tavelnumret på banan
    const pagar = lager.pagaende(o.id, id, false);
    const klara = lager.resultatFor(o.id, id).filter((r) => r.registrerad);
    const senaste = klara[klara.length - 1];
    const b = pagar ? bedom(o.gren, pagar.traffar, pagar.tid, pagar.vapenhanteringUnderkand) : null;

    let varden = '<span class="dampad liten">—</span>';
    let chip = '<span class="chip">väntar</span>';
    if (pagar && pagar.tid !== null) {
      varden = `<b>${komma(pagar.tid)} s</b><br>${b.poang} p · PK ${b.pk === null ? '–' : komma(b.pk)}`;
      chip = `<span class="chip v">pågår</span>`;
    }
    if (senaste) {
      const sb = bedom(o.gren, senaste.traffar, senaste.tid, senaste.vapenhanteringUnderkand);
      if (!pagar) {
        varden = `<b>${komma(senaste.tid)} s</b><br>${sb.poang} p · PK ${komma(sb.pk)}`;
        chip = `<span class="chip ${sb.godkand ? 'g' : 'u'}">${sb.godkand ? 'godkänd' : 'underkänd'}</span>`;
      }
    }
    const oppen = vy.oppen === id;
    return `<button class="skyttrad ${senaste && !pagar ? 'klar' : ''}" data-skytt="${id}">
        <span class="namn"><span class="nr">${nr}.</span> ${esc(p.namn)}</span>
        <span class="forband">${esc(p.forband || '')}${klara.length ? ` · ${klara.length} försök` : ''}</span>
        <span class="varden">${varden}</span>
        ${chip}
      </button>
      ${klara.length ? `<div class="knapprad" style="margin-top:-0.35rem">
         <button class="knapp liten" data-historik="${id}">${oppen ? 'Dölj' : 'Visa'} försök</button>
         ${!pagar && klara.length < prov.maxForsok
           ? `<button class="knapp liten" data-nytt-forsok="${id}">+ Nytt försök</button>` : ''}
       </div>` : ''}
      ${oppen ? ritaHistorik(o, klara) : ''}`;
  }).join('');

  const utanTid = o.deltagare.filter((id) => {
    const r = lager.pagaende(o.id, id, false);
    return !r || r.tid === null;
  }).length;
  const utanPoang = o.deltagare.filter((id) => {
    const r = lager.pagaende(o.id, id, false);
    return r && r.tid !== null;
  }).length;

  app.innerHTML = (rader || '<p class="tom">Inga deltagare i omgången.</p>')
    + '<p class="dampad liten">Numret är skyttens tavla. Håll in en rad för att '
    + 'flytta skytten till en annan tavla.</p>'
    + '<div class="knapprad"><button class="knapp liten" data-lagg-till="1">'
    + '+ Lägg till skytt</button></div>';
  bottenrad.innerHTML = `
    <div class="lagesvaljare">
      <button data-lage="tid" aria-pressed="${lage === 'tid'}">TID${utanTid ? ` (${utanTid})` : ''}</button>
      <button data-lage="poang" aria-pressed="${lage === 'poang'}">POÄNG${utanPoang ? ` (${utanPoang})` : ''}</button>
    </div>
    <button class="knapp primar" data-nasta="${lage}">
      ${lage === 'tid' ? 'Nästa som saknar tid' : 'Nästa som saknar poäng'}</button>
    <div class="knapprad">
      <button class="knapp liten" data-vy="anvisning">Anvisning</button>
      <button class="knapp liten" data-export="1">Dela</button>
    </div>`;
}

function ritaHistorik(o, forsok) {
  return `<div class="historik">${forsok.map((r) => {
    const b = bedom(o.gren, r.traffar, r.tid, r.vapenhanteringUnderkand);
    const traffar = Object.entries(r.traffar).filter(([, n]) => n)
      .map(([z, n]) => `${z}${n}`).join(' ');
    return `<div class="forsokrad">
      <span>Försök ${r.forsok} · ${komma(r.tid)} s · ${esc(traffar || 'inga träffar')}</span>
      <span>${b.poang} p · <b>${komma(b.pk)}</b> ·
        <span class="${b.godkand ? 'chip g' : 'chip u'}">${b.godkand ? 'G' : 'U'}</span></span>
    </div>`;
  }).join('')}</div>`;
}

// ----------------------------------------------------------------- tiden

function ritaTid() {
  const o = lager.omgang(vy.omgangId);
  const p = lager.person(vy.personId);
  if (!o || !p) return gaTill('start');
  const r = lager.pagaende(o.id, p.id);
  if (!utkastTid && r.tid !== null) utkastTid = komma(r.tid);
  rubrik.firstChild.textContent = p.namn;
  underrubrik.textContent = `Tid · försök ${r.forsok} · ${PROV[o.gren].namn}`;
  hemKnapp.hidden = false;

  app.innerHTML = `
    <div class="tidvisning ${utkastTid ? '' : 'tom'}">${esc(utkastTid || '0,00')}<span class="enhet"> s</span></div>
    <p class="dampad liten" style="text-align:center">Tiden mäts mellan startsignal och sista skott.</p>
    <div class="knappsats">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-siffra="${n}">${n}</button>`).join('')}
      <button data-siffra=",">,</button>
      <button data-siffra="0">0</button>
      <button data-radera="1">⌫</button>
    </div>`;
  bottenrad.innerHTML = `
    <button class="knapp primar" data-spara-tid="nasta">Spara &amp; nästa skytt</button>
    <div class="knapprad">
      <button class="knapp liten" data-spara-tid="lista">Spara och tillbaka</button>
      <button class="knapp liten" data-till-poang="1">Poäng för ${esc(p.namn.split(' ')[0])}</button>
    </div>`;
}

function sparaTid() {
  const o = lager.omgang(vy.omgangId);
  const r = lager.pagaende(o.id, vy.personId);
  const tal = taltolk(utkastTid);
  if (utkastTid && (tal === null || tal <= 0)) {
    flash('Tiden ser inte ut som ett tal.');
    return false;
  }
  lager.andraResultat(r.id, { tid: tal });
  return true;
}

// ---------------------------------------------------------------- poängen

function ritaPoang() {
  const o = lager.omgang(vy.omgangId);
  const p = lager.person(vy.personId);
  if (!o || !p) return gaTill('start');
  const prov = PROV[o.gren];
  const r = lager.pagaende(o.id, p.id);
  rubrik.firstChild.textContent = p.namn;
  underrubrik.textContent = `Poäng · försök ${r.forsok} · ${prov.namn}`;
  hemKnapp.hidden = false;

  const grupper = prov.grupper.map((g) => `
    <div class="zongrupp" data-grupp="${g.id}">
      <h3><span>${esc(g.namn)}</span><span class="raknare"></span></h3>
      <div class="zoner">
        ${g.zoner.map((z) => `
          <button class="zonknapp" data-zon="${z}" data-poang="${ZONPOANG[z]}">
            <span class="bokstav">${z}</span>
            <span class="antal">${r.traffar[z] || 0}</span>
            <span class="poang">${(r.traffar[z] || 0) * ZONPOANG[z]} p</span>
          </button>`).join('')}
      </div>
    </div>`).join('');

  app.innerHTML = `
    ${r.tid === null ? '<div class="varningsruta">Ingen tid inlagd ännu — utan tid går ingen poängkvot att räkna.</div>' : ''}
    <p class="dampad liten">Tryck en gång per träff. Håll in en knapp för att nolla den.</p>
    ${grupper}
    <div class="summering">
      <span>Tid <b>${r.tid === null ? '–' : komma(r.tid) + ' s'}</b> · <span id="poangsumma">0 p</span></span>
      <span><span class="pk" id="pkvarde">–</span> <span class="utfall" id="utfall"></span></span>
    </div>
    <p class="brister" id="brister"></p>
    <label class="falt" style="display:flex;align-items:center;gap:0.6rem">
      <input type="checkbox" id="vapen" style="width:26px;height:26px;margin:0"
             ${r.vapenhanteringUnderkand ? 'checked' : ''}>
      <span>Underkänd — osäker eller felaktig vapenhantering</span>
    </label>`;
  bottenrad.innerHTML = `
    <button class="knapp primar" data-registrera="1">Registrera resultat</button>
    <div class="knapprad">
      <button class="knapp liten" data-till-tid="1">Ändra tiden</button>
      <button class="knapp liten" data-vy="omgang-ater">Tillbaka till listan</button>
    </div>`;
  uppdateraPoang();
}

/** Räknar om summering, kvot och brister utan att rita om knapparna — det ska
 *  gå att knappa fort utan att skärmen hoppar. */
function uppdateraPoang() {
  const o = lager.omgang(vy.omgangId);
  const r = lager.pagaende(o.id, vy.personId);
  const b = bedom(o.gren, r.traffar, r.tid, r.vapenhanteringUnderkand);

  for (const g of PROV[o.gren].grupper) {
    const ruta = app.querySelector(`[data-grupp="${g.id}"]`);
    const antal = antalIGrupp(g, r.traffar);
    const full = antal >= g.antal;
    const del = ruta.querySelector('.raknare');
    del.textContent = `${antal} av ${g.antal}${full ? ' — full' : ''}`;
    del.classList.toggle('klar', full);
    // Full målyta märks ut: knapparna dämpas så att det syns utan att läsa.
    ruta.classList.toggle('full', full);
  }
  app.querySelector('#poangsumma').textContent = `${b.poang} p`;
  // Ingen bedömning innan det finns något att bedöma: en tom serie med tid
  // inlagd skulle annars mötas av ett rött "Underkänd" redan innan första
  // träffen knappats in.
  const nagotInmatat = b.poang > 0 || r.vapenhanteringUnderkand;
  const visa = b.pk !== null && nagotInmatat;
  const pk = app.querySelector('#pkvarde');
  pk.textContent = visa ? komma(b.pk) : '–';
  pk.className = 'pk ' + (visa ? (b.godkand ? 'g' : 'u') : '');
  // Utfallet i klartext bredvid kvoten — grönt godkänt, rött underkänt. Färg
  // ensam duger inte som besked, och siffran säger inget om träffkraven eller
  // vapenhanteringen.
  const utfall = app.querySelector('#utfall');
  utfall.textContent = visa ? (b.godkand ? 'Godkänd' : 'Underkänd') : '';
  utfall.className = 'utfall ' + (visa ? (b.godkand ? 'g' : 'u') : '');
  app.querySelector('#brister').textContent = (b.godkand || !nagotInmatat) ? '' : b.brister.join(' · ');
}

function sattZon(knapp, antal) {
  const o = lager.omgang(vy.omgangId);
  const r = lager.pagaende(o.id, vy.personId);
  const zon = knapp.dataset.zon;
  const traffar = { ...r.traffar };
  if (antal > 0) traffar[zon] = antal; else delete traffar[zon];
  lager.andraResultat(r.id, { traffar });
  knapp.querySelector('.antal').textContent = antal;
  knapp.querySelector('.poang').textContent = antal * Number(knapp.dataset.poang) + ' p';
  knapp.classList.toggle('har', antal > 0);
  uppdateraPoang();
}

// --------------------------------------------- lägga till skytt i efterhand

function ritaLaggTill() {
  const o = lager.omgang(vy.omgangId);
  if (!o) return gaTill('start');
  rubrik.firstChild.textContent = 'Lägg till skytt';
  underrubrik.textContent = `${PROV[o.gren].namn} ${o.datum} · blir tavla ${o.deltagare.length + 1}`;
  hemKnapp.hidden = false;

  // Den som redan står på linjen ska inte gå att lägga till en gång till.
  const kvar = lager.personer().filter((p) => !o.deltagare.includes(p.id));
  app.innerHTML = kvar.length ? kvar.map((p) => `
    <button class="skyttrad" data-lagg-in="${p.id}">
      <span class="namn">${esc(p.namn)}</span>
      <span class="forband">${esc(p.forband || '')}</span>
      <span class="chip">lägg till</span>
    </button>`).join('')
    : '<p class="tom">Alla skyttar i registret är redan med.<br>Lägg upp en ny nedan.</p>';
  bottenrad.innerHTML = `
    <button class="knapp primar" data-ny-skytt="1">+ Ny skytt</button>
    <div class="knapprad">
      <button class="knapp liten" data-vy="omgang-ater">Tillbaka till listan</button>
    </div>`;
}

// ------------------------------------------------------------- anvisningar

function ritaAnvisning() {
  const gren = vy.gren || 'pist';
  const prov = PROV[gren];
  const a = prov.anvisning;
  rubrik.firstChild.textContent = 'Anvisning';
  underrubrik.textContent = `${prov.namn} · ${prov.delmoment}`;
  hemKnapp.hidden = false;

  app.innerHTML = `
    <div class="kort">
      <h3 class="anvisningsrubrik">${esc(a.rubrik)}</h3>
      <dl class="fakta">
        ${a.fakta.map(([namn, varde]) =>
          `<dt>${esc(namn)}</dt><dd>${esc(varde)}</dd>`).join('')}
      </dl>
    </div>

    <h2>Genomförande</h2>
    <ol class="steg">${a.genomforande.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

    <h2>Tid och bättring</h2>
    ${a.matning.map((s) => `<p class="dampad liten">${esc(s)}</p>`).join('')}

    <h2>Bedömningar och krav</h2>
    ${BEDOMNING.map((s) => `<p class="dampad liten">${esc(s)}</p>`).join('')}

    <h2>Poängzoner — Helfigur 2020</h2>
    <div class="kort">
      <dl class="fakta">
        ${ZONORDNING.map((z) =>
          `<dt>${z}</dt><dd>${ZONPOANG[z]} poäng</dd>`).join('')}
      </dl>
      <p class="dampad liten" style="margin-bottom:0">Poängkvot = räknade poäng delat med
      tiden. Kravet är ${komma(prov.pkKrav)} för ${esc(prov.namn.toLowerCase())}.</p>
    </div>`;

  bottenrad.innerHTML = `
    <div class="lagesvaljare">
      <button data-anvisning="pist" aria-pressed="${gren === 'pist'}">PISTOL</button>
      <button data-anvisning="ak" aria-pressed="${gren === 'ak'}">AUTOMATKARBIN</button>
    </div>
    ${vy.omgangId ? '<div class="knapprad"><button class="knapp liten" '
      + 'data-vy="omgang-ater">Tillbaka till listan</button></div>' : ''}`;
}

// ------------------------------------------------------------- skytteregister

function ritaRegister() {
  rubrik.firstChild.textContent = 'Skyttar';
  underrubrik.textContent = 'Registret ligger kvar mellan omgångar';
  hemKnapp.hidden = false;
  const personer = lager.personer();
  app.innerHTML = personer.length ? personer.map((p) => `
    <div class="kort">
      <div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:center">
        <div><b>${esc(p.namn)}</b><br><span class="dampad liten">${esc(p.forband || 'utan förband')}</span></div>
        <button class="knapp liten fara" data-radera-person="${p.id}">Radera</button>
      </div>
    </div>`).join('') : '<p class="tom">Inga skyttar ännu.</p>';
  bottenrad.innerHTML = `
    <button class="knapp primar" data-ny-skytt="1">+ Ny skytt</button>
    ${personer.length ? '<div class="knapprad"><button class="knapp liten fara" '
      + 'data-radera-alla-skyttar="1">Radera alla</button></div>' : ''}`;
}

function nySkytt() {
  const namn = prompt('Namn på skytten:');
  if (!namn || !namn.trim()) return null;
  const forband = prompt('Förband eller pluton (kan lämnas tomt):') || '';
  const p = lager.laggTillPerson(namn, forband);
  flash(`${p.namn} tillagd.`);
  return p;
}

// ------------------------------------------------------------- inställningar

function ritaInstallningar() {
  rubrik.firstChild.textContent = 'Inställningar';
  underrubrik.textContent = 'Säkerhetskopia och nollställning';
  hemKnapp.hidden = false;
  const d = lager.las();
  app.innerHTML = `
    ${lager.lagringFungerar() ? '' : `<div class="varningsruta">
      <b>Lagringen fungerar inte här.</b> Appen är troligen öppnad som lös fil.
      Det du knappar in ligger kvar så länge sidan är öppen, men försvinner när
      den stängs. Använd den installerade versionen om resultaten ska sparas.
    </div>`}
    <div class="kort">
      <b>I appen just nu</b><br>
      <span class="dampad liten">${d.personer.length} skyttar · ${d.omgangar.length} omgångar
      · ${d.resultat.filter((r) => r.registrerad).length} registrerade försök</span>
    </div>
    <h2>Säkerhetskopia</h2>
    <p class="dampad liten">En fil med allt. Läs in den på en annan telefon, eller
    som återställning. Inläsning lägger till — den skriver aldrig över det som finns.</p>
    <div class="knapprad">
      <button class="knapp liten" data-kopia="ut">Spara kopia</button>
      <button class="knapp liten" data-kopia="in">Läs in kopia</button>
    </div>
    <h2>Nollställ</h2>
    <div class="knapprad"><button class="knapp fara" data-radera-allt="1">Radera allt innehåll</button></div>
    <p class="dampad liten" style="margin-top:2rem">
      Poängzoner enligt Helfigur 2020: A 5, B 4, C 3, D 3, X 2, H 1.
      Krav enligt respektive delmoment — pistol PK 2,0, automatkarbin PK 1,0.
      Allt du knappar in stannar i telefonen tills du delar det själv.</p>
    <input type="file" id="kopiafil" accept="application/json,.json" hidden>`;
  bottenrad.innerHTML = '<button class="knapp liten" data-skriv-ut="1">Skriv ut / spara som PDF</button>';
}

// ---------------------------------------------------------------- exporten

async function exportera(format) {
  const o = lager.omgang(vy.omgangId);
  const u = underlag(o, lager.las().personer, lager.resultat(o.id));
  const text = somText(u);
  if (format === 'txt') return dela(`${u.filnamn}.txt`, text, 'txt', text);
  if (format === 'csv') return dela(`${u.filnamn}.csv`, somCsv(u), 'csv', text);
  if (format === 'xlsx') return dela(`${u.filnamn}.xlsx`, somXlsx(u), 'xlsx', text);
  if (format === 'pdf') return dela(`${u.filnamn}.pdf`, somPdf(u), 'pdf', text);
}

function ritaExportval() {
  const o = lager.omgang(vy.omgangId);
  const u = underlag(o, lager.las().personer, lager.resultat(o.id));
  rubrik.firstChild.textContent = 'Dela resultatet';
  underrubrik.textContent = `${u.godkanda} av ${u.antalSkyttar} godkända`;
  hemKnapp.hidden = false;
  app.innerHTML = `
    <p class="dampad liten">Delningsrutan öppnar Mail, Meddelanden eller det du väljer.
    Kan telefonen inte dela filer laddas de ned i stället.</p>
    <div class="knapprad"><button class="knapp" data-format="txt">Text i mailet</button></div>
    <div class="knapprad"><button class="knapp" data-format="pdf">PDF</button></div>
    <div class="knapprad"><button class="knapp" data-format="xlsx">Excel (xlsx)</button></div>
    <div class="knapprad"><button class="knapp" data-format="csv">CSV</button></div>
    <h2>Förhandsgranskning</h2>
    <div class="kort"><pre style="white-space:pre-wrap;margin:0;font-size:0.8rem">${esc(somText(u))}</pre></div>`;
  bottenrad.innerHTML = `
    <div class="knapprad">
      <button class="knapp liten" data-vy="omgang-ater">Tillbaka till listan</button>
      <button class="knapp liten" data-skriv-ut="1">Skriv ut</button>
    </div>`;
}

// -------------------------------------------------------------- rita om allt

function rita() {
  // Meddelandet städas INTE bort här. Nästan varje bekräftelse — "tavla 3",
  // "omgången raderad" — följs omedelbart av en omritning, och en flash som
  // rensades av sin egen omritning hann aldrig synas. Den tar bort sig själv
  // efter sina sekunder, och en ny ersätter alltid den gamla.
  if (vy.namn === 'start') ritaStart();
  else if (vy.namn === 'ny') ritaNy();
  else if (vy.namn === 'omgang') ritaOmgang();
  else if (vy.namn === 'tid') ritaTid();
  else if (vy.namn === 'poang') ritaPoang();
  else if (vy.namn === 'register') ritaRegister();
  else if (vy.namn === 'installningar') ritaInstallningar();
  else if (vy.namn === 'export') ritaExportval();
  else if (vy.namn === 'anvisning') ritaAnvisning();
  else if (vy.namn === 'lagg-till') ritaLaggTill();
  window.scrollTo(0, 0);
}

// ------------------------------------------------------- nästa i ordningen

function nastaSkytt(omgang, lage, efterId = null) {
  const ordning = omgang.deltagare;
  const start = efterId ? ordning.indexOf(efterId) + 1 : 0;
  const behover = (id) => {
    const r = lager.pagaende(omgang.id, id, false);
    if (lage === 'tid') return !r || r.tid === null;
    return r && r.tid !== null;          // har tid men är inte registrerad
  };
  // Sök framåt från den nyss avklarade, och varva sedan om från början —
  // instruktören ska aldrig behöva leta själv.
  for (let i = start; i < ordning.length; i++) if (behover(ordning[i])) return ordning[i];
  for (let i = 0; i < start && i < ordning.length; i++) if (behover(ordning[i])) return ordning[i];
  return null;
}

// ------------------------------------------------------------ händelser

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('[data-vy], [data-oppna], [data-vaxla], [data-ny-skytt], ' +
    '[data-starta], [data-skytt], [data-lage], [data-nasta], [data-siffra], [data-radera], ' +
    '[data-spara-tid], [data-till-poang], [data-till-tid], [data-registrera], [data-export], ' +
    '[data-format], [data-historik], [data-nytt-forsok], [data-radera-person], [data-kopia], ' +
    '[data-radera-allt], [data-radera-alla-skyttar], [data-skriv-ut], [data-anvisning], ' +
    '[data-lagg-till], [data-lagg-in], .zonknapp');
  if (!t) return;
  const d = t.dataset;

  // --- navigering ---
  if (d.vy === 'ny') return gaTill('ny', { valda: [] });
  if (d.vy === 'register') return gaTill('register');
  if (d.vy === 'anvisning') {
    // Öppnas anvisningen från en omgång ska den visa det prov som skjuts.
    const o = vy.omgangId ? lager.omgang(vy.omgangId) : null;
    return gaTill('anvisning', { gren: o ? o.gren : (vy.gren || 'pist'), omgangId: vy.omgangId });
  }
  if (d.anvisning) {
    vy.gren = d.anvisning;
    return rita();
  }
  if (d.vy === 'installningar') return gaTill('installningar');
  if (d.vy === 'omgang-ater') return gaTill('omgang', { omgangId: vy.omgangId, lage: 'poang' }, true);
  if (d.oppna) {
    if (t.dataset.spärrKlick) { delete t.dataset.spärrKlick; return; }
    return gaTill('omgang', { omgangId: d.oppna, lage: 'tid' });
  }

  // --- ny omgång ---
  if (d.vaxla) {
    spegla();
    const valda = new Set(vy.valda || []);
    valda.has(d.vaxla) ? valda.delete(d.vaxla) : valda.add(d.vaxla);
    vy.valda = [...valda];
    return rita();
  }
  if (d.nySkytt) {
    const p = nySkytt();
    if (!p) return;
    if (vy.namn === 'ny') {
      spegla();
      vy.valda = [...(vy.valda || []), p.id];
    }
    if (vy.namn === 'lagg-till') {
      // Registrerad mitt i en omgång ska hen självklart också hamna på linjen.
      const o = lager.omgang(vy.omgangId);
      lager.andraOmgang(o.id, { deltagare: [...o.deltagare, p.id] });
      flash(`${p.namn} är tavla ${o.deltagare.length}.`);
      return gaTill('omgang', { omgangId: o.id, lage: vy.lage }, true);
    }
    return rita();
  }
  if (d.starta) {
    spegla();
    const o = lager.laggTillOmgang({
      gren: vy.gren || 'pist', datum: vy.datum, plats: vy.plats || '',
      instruktor: vy.instruktor || '', deltagare: vy.valda || [],
    });
    return gaTill('omgang', { omgangId: o.id, lage: 'tid' }, true);
  }

  // --- vallistan ---
  if (d.lage) {
    vy.lage = d.lage;
    return rita();
  }
  if (d.skytt) {
    if (t.dataset.spärrKlick) { delete t.dataset.spärrKlick; return; }
    return gaTill(vy.lage === 'poang' ? 'poang' : 'tid',
      { omgangId: vy.omgangId, personId: d.skytt, lage: vy.lage });
  }
  if (d.historik) {
    vy.oppen = vy.oppen === d.historik ? null : d.historik;
    return rita();
  }
  if (d.laggTill) return gaTill('lagg-till', { omgangId: vy.omgangId, lage: vy.lage });
  if (d.laggIn) {
    const o = lager.omgang(vy.omgangId);
    lager.andraOmgang(o.id, { deltagare: [...o.deltagare, d.laggIn] });
    flash(`${lager.person(d.laggIn).namn} är tavla ${o.deltagare.length}.`);
    return gaTill('omgang', { omgangId: o.id, lage: vy.lage }, true);
  }
  if (d.nyttForsok) {
    lager.pagaende(vy.omgangId, d.nyttForsok);      // skapar nästa försök
    vy.lage = 'tid';
    return gaTill('tid', { omgangId: vy.omgangId, personId: d.nyttForsok, lage: 'tid' });
  }
  if (d.nasta) {
    const o = lager.omgang(vy.omgangId);
    const id = nastaSkytt(o, d.nasta);
    if (!id) {
      return flash(d.nasta === 'tid'
        ? 'Alla har en tid. Byt till POÄNG.'
        : 'Ingen väntar på poäng.');
    }
    return gaTill(d.nasta === 'tid' ? 'tid' : 'poang',
      { omgangId: vy.omgangId, personId: id, lage: d.nasta });
  }

  // --- sifferknappsatsen ---
  if (d.siffra) {
    vibrera(12);
    if (d.siffra === ',' && utkastTid.includes(',')) return;
    if (utkastTid.replace(',', '').length >= 6) return;
    utkastTid += d.siffra;
    return rita();
  }
  if (d.radera) {
    vibrera(12);
    utkastTid = utkastTid.slice(0, -1);
    return rita();
  }
  if (d.sparaTid) {
    if (!sparaTid()) return;
    const o = lager.omgang(vy.omgangId);
    if (d.sparaTid === 'nasta') {
      const id = nastaSkytt(o, 'tid', vy.personId);
      if (id) return gaTill('tid', { omgangId: o.id, personId: id, lage: 'tid' }, true);
      flash('Alla har en tid. Byt till POÄNG när ni gått fram.');
    }
    return gaTill('omgang', { omgangId: o.id, lage: 'tid' }, true);
  }
  if (d.tillPoang) {
    if (!sparaTid()) return;
    return gaTill('poang', { omgangId: vy.omgangId, personId: vy.personId, lage: 'poang' }, true);
  }
  if (d.tillTid) {
    return gaTill('tid', { omgangId: vy.omgangId, personId: vy.personId, lage: 'tid' }, true);
  }

  // --- zonknappar ---
  if (t.classList.contains('zonknapp')) {
    if (t.dataset.hollsIn === '1') { delete t.dataset.hollsIn; return; }
    const o = lager.omgang(vy.omgangId);
    const r = lager.pagaende(o.id, vy.personId);
    // Målytan tar bara emot så många träffar som räknas. Knappa in de bästa;
    // vill du byta ut en, håll in knappen och nolla den först.
    if (arFull(o.gren, t.dataset.zon, r.traffar)) {
      const g = gruppFor(o.gren, t.dataset.zon);
      vibrera(80);
      return flash(PROV[o.gren].grupper.length > 1
        ? `${g.namn} har sina ${g.antal} träffar. Håll in en knapp för att ändra.`
        : `${g.antal} träffar inlagda. Håll in en knapp för att ändra.`);
    }
    vibrera(15);
    const nu = Number(t.querySelector('.antal').textContent) || 0;
    return sattZon(t, nu + 1);
  }

  // --- registrera försöket ---
  if (d.registrera) {
    const o = lager.omgang(vy.omgangId);
    const r = lager.pagaende(o.id, vy.personId);
    if (r.tid === null && !r.vapenhanteringUnderkand) {
      return flash('Lägg in tiden först — utan den finns ingen poängkvot.');
    }
    lager.registrera(r.id);
    vibrera(30);
    const b = bedom(o.gren, r.traffar, r.tid, r.vapenhanteringUnderkand);
    flash(`${lager.person(vy.personId).namn}: ${b.godkand ? 'GODKÄND' : 'UNDERKÄND'}` +
      (b.pk === null ? '' : ` · PK ${komma(b.pk)}`));
    const id = nastaSkytt(o, 'poang', vy.personId);
    if (id) return gaTill('poang', { omgangId: o.id, personId: id, lage: 'poang' }, true);
    return gaTill('omgang', { omgangId: o.id, lage: 'poang' }, true);
  }

  // --- export ---
  if (d.export) return gaTill('export', { omgangId: vy.omgangId });
  if (d.format) {
    try {
      const utfall = await exportera(d.format);
      if (utfall === 'nedladdad') flash('Filen laddades ned.');
    } catch (fel) {
      flash('Det gick inte att skapa filen: ' + fel.message, 5);
    }
    return;
  }
  if (d.skrivUt) return window.print();

  // --- register och inställningar ---
  if (d.raderaPerson) {
    const p = lager.person(d.raderaPerson);
    if (confirm(`Radera ${p.namn} och alla resultat för hen?`)) {
      lager.raderaPerson(p.id);
      flash(`${p.namn} raderad.`);
      rita();
    }
    return;
  }
  if (d.raderaAllaSkyttar) {
    const antal = lager.personer().length;
    if (confirm(`Radera alla ${antal} skyttar och deras resultat?\n\n`
      + 'Omgångarna finns kvar, men blir tomma.')) {
      for (const p of lager.personer()) lager.raderaPerson(p.id);
      flash(`${antal} skyttar raderade.`);
      rita();
    }
    return;
  }
  if (d.kopia === 'ut') {
    const namn = `kompetensprov-kopia-${new Date().toISOString().slice(0, 10)}.json`;
    await dela(namn, lager.sakerhetskopia(), 'txt', 'Säkerhetskopia från FM kompetensprov');
    return;
  }
  if (d.kopia === 'in') return app.querySelector('#kopiafil').click();
  if (d.raderaAllt) {
    const svar = prompt('Det här raderar alla skyttar, omgångar och resultat.\n' +
      'Skriv RADERA för att bekräfta:');
    if (svar === 'RADERA') {
      lager.raderaAllt();
      flash('Allt innehåll raderat.');
      return gaTill('start');
    }
    if (svar !== null) flash('Ingenting raderades.');
    return;
  }
});

// Svep vänster på en omgång för att radera den. Bara vågräta svep räknas, så
// att listan fortfarande går att skrolla, och raden får inte öppnas av
// släppet — därför spärras nästa klick.
let svep = null;
document.addEventListener('pointerdown', (ev) => {
  const rad = ev.target.closest('.skyttrad[data-oppna]');
  if (!rad) return;
  svep = { rad, x: ev.clientX, y: ev.clientY };
});
document.addEventListener('pointermove', (ev) => {
  if (!svep) return;
  const dx = ev.clientX - svep.x;
  const dy = ev.clientY - svep.y;
  if (Math.abs(dy) > 30) { svep = null; return; }      // det här är en skrollning
  svep.rad.style.transform = dx < 0 ? `translateX(${Math.max(dx, -90)}px)` : '';
  svep.rad.classList.toggle('sveps', dx < -30);
});
document.addEventListener('pointerup', (ev) => {
  if (!svep) return;
  const { rad } = svep;
  const dx = ev.clientX - svep.x;
  svep = null;
  rad.style.transform = '';
  rad.classList.remove('sveps');
  if (dx > -60) return;                                 // för kort svep
  rad.dataset.spärrKlick = '1';
  const o = lager.omgang(rad.dataset.oppna);
  if (!o) return;
  const antal = lager.resultat(o.id).filter((r) => r.registrerad).length;
  vibrera(30);
  if (confirm(`Radera omgången ${PROV[o.gren].namn} ${o.datum}`
    + `${o.plats ? ' på ' + o.plats : ''}?\n\n`
    + `${antal} registrerade försök raderas med den.`)) {
    lager.raderaOmgang(o.id);
    flash('Omgången raderad.');
  }
  rita();
});

// ---------------------------------------------- flytta en skytt i ordningen
//
// Håll in en rad i vallistan för att lyfta skytten och dra hen till en annan
// plats. Numret sitter på PLATSEN, inte på personen: den som hamnar på tredje
// raden får nummer 3, för det är tavlan hen ska skjuta mot. Därför numreras
// raderna om medan draget pågår.

let drag = null;

function renumrera() {
  app.querySelectorAll('.skyttrad[data-skytt] .nr').forEach((el, i) => {
    el.textContent = `${i + 1}.`;
  });
}

function malIndex(y) {
  const rader = [...app.querySelectorAll('.skyttrad[data-skytt]')];
  for (let i = 0; i < rader.length; i++) {
    const r = rader[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return rader.length - 1;
}

document.addEventListener('pointerdown', (ev) => {
  const rad = ev.target.closest('.skyttrad[data-skytt]');
  if (!rad) return;
  const start = { rad, y: ev.clientY };
  drag = { ...start, aktiv: false, timer: setTimeout(() => {
    drag.aktiv = true;
    rad.classList.add('lyft');
    vibrera(40);
  }, 500) };
});

document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.aktiv) {
    // Rör sig fingret innan tiden gått ut är det en skrollning, inte ett drag.
    if (Math.abs(ev.clientY - drag.y) > 10) {
      clearTimeout(drag.timer);
      drag = null;
    }
    return;
  }
  ev.preventDefault();
  const rader = [...app.querySelectorAll('.skyttrad[data-skytt]')];
  const nu = rader.indexOf(drag.rad);
  const mal = malIndex(ev.clientY);
  if (mal !== nu && mal >= 0) {
    const referens = rader[mal];
    referens.parentNode.insertBefore(drag.rad, mal < nu ? referens : referens.nextSibling);
    renumrera();
    vibrera(10);
  }
});

document.addEventListener('pointerup', () => {
  if (!drag) return;
  clearTimeout(drag.timer);
  const { rad, aktiv } = drag;
  drag = null;
  rad.classList.remove('lyft');
  if (!aktiv) return;
  rad.dataset.spärrKlick = '1';         // släppet ska inte öppna skytten
  const ordning = [...app.querySelectorAll('.skyttrad[data-skytt]')]
    .map((el) => el.dataset.skytt);
  lager.andraOmgang(vy.omgangId, { deltagare: ordning });
  const namn = lager.person(rad.dataset.skytt).namn;
  flash(`${namn} är tavla ${ordning.indexOf(rad.dataset.skytt) + 1}.`);
  rita();
});

// Håll in en zonknapp för att nolla den — enda vägen tillbaka efter en
// feltryckning med handskar på.
let hallTimer = null;
document.addEventListener('pointerdown', (ev) => {
  const knapp = ev.target.closest('.zonknapp');
  if (!knapp) return;
  hallTimer = setTimeout(() => {
    knapp.dataset.hollsIn = '1';
    vibrera(40);
    sattZon(knapp, 0);
  }, 500);
});
for (const h of ['pointerup', 'pointercancel', 'pointerleave']) {
  document.addEventListener(h, () => clearTimeout(hallTimer));
}

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'vapen') {
    const o = lager.omgang(vy.omgangId);
    const r = lager.pagaende(o.id, vy.personId);
    lager.andraResultat(r.id, { vapenhanteringUnderkand: ev.target.checked });
    uppdateraPoang();
  }
  if (ev.target.id === 'kopiafil' && ev.target.files[0]) {
    const fil = ev.target.files[0];
    const lasare = new FileReader();
    lasare.onload = () => {
      try {
        const n = lager.lasInSakerhetskopia(lasare.result);
        flash(`Inläst: ${n.personer} skyttar, ${n.omgangar} omgångar, ${n.resultat} försök.`, 4);
        rita();
      } catch (fel) {
        flash('Filen gick inte att läsa: ' + fel.message, 5);
      }
    };
    lasare.readAsText(fil);
  }
});

// Hemknappen går alltid till startsidan — ett tryck, ingen gissning om var i
// historiken man befinner sig. Vägen tillbaka till vallistan finns i stället
// som en egen knapp i nederkant på varje vy som ligger inuti en omgång.
hemKnapp.addEventListener('click', () => {
  // En påbörjad tid sparas på vägen ut; annars försvinner det man knappat in
  // bara för att man tryckte fel knapp.
  if (vy.namn === 'tid') sparaTid();
  gaTill('start', {}, true);
});

// Servicearbetaren finns bara i den installerade versionen; som lös fil
// saknas den, och då ska appen starta ändå.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

history.replaceState(vy, '');
rita();
