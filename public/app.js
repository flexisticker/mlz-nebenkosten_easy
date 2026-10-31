'use strict';
// Vermieter-Portal – Oberfläche. Alle Daten liegen in der lokalen Datenbank des Servers (Ordner ./daten).

// ---------------------------------------------------------------------------
// Beispieldaten (frei erfunden). Echte Daten kommen nur über „Import“ in die lokale Datenbank.
// ---------------------------------------------------------------------------
const BEISPIEL = {
  version: 2,
  vermieter: { name: 'Max Mustermann', strasse: 'Musterstraße 1', ort: '12345 Musterstadt', telefon: '0123 456789', email: 'max@example.org', bank: 'Musterbank', iban: 'DE00 1234 5678 9012 3456 78' },
  mieter: { anrede: 'Frau', name: 'Erika Musterfrau', strasse: 'Beispielweg 5', ort: '12345 Musterstadt', wohnung: 'Wohnung 2, EG', flaeche: '45,00', email: 'erika@example.org', seit: '2021-04-01' },
  miete: { kalt: 380, nk: 150, kaltVor3Jahren: 380, letzteErhoehung: '' },
  aktuell: '2025',
  jahre: {
    '2025': {
      von: '2025-01-01', bis: '2025-12-31', vorausMonat: 150, monate: 12, datum: '',
      einleitung: 'nachfolgend erhalten Sie die Abrechnung der Betriebskosten für den oben genannten Zeitraum. Grundlage sind die Jahresabrechnung der Hausverwaltung und die Heiz- und Wasserkostenabrechnung. Die Beträge entsprechen dem Anteil Ihrer Wohnung.',
      schlusstext: 'Das Guthaben überweise ich Ihnen in den nächsten Tagen auf Ihr Konto. Die Abrechnungen der Hausverwaltung und die Heizkostenabrechnung können Sie gern bei mir einsehen.',
      positionen: [
        { u: true, name: 'Gebäudeversicherung', quelle: 'WEG-Abrechnung, Miteigentumsanteile', betrag: 140.00 },
        { u: true, name: 'Haftpflichtversicherung', quelle: 'WEG-Abrechnung, Miteigentumsanteile', betrag: 5.00 },
        { u: true, name: 'Hausmeister / Hausbetreuung', quelle: 'WEG-Abrechnung, Miteigentumsanteile', betrag: 240.00 },
        { u: true, name: 'Allgemeinstrom', quelle: 'WEG-Abrechnung, Miteigentumsanteile', betrag: 80.00 },
        { u: true, name: 'Heizung und Warmwasser', quelle: 'Heizkostenabrechnung, Verbrauch', betrag: 400.00 },
        { u: true, name: 'Wasser / Abwasser', quelle: 'Heizkostenabrechnung, Verbrauch', betrag: 400.00 },
        { u: true, name: 'abzgl. CO₂-Kostenanteil Vermieter', quelle: 'CO2KostAufG', betrag: -30.00 },
        { u: true, name: 'Grundsteuer B', quelle: 'Grundsteuerbescheid', betrag: 35.00 },
        { u: false, name: 'Verwaltergebühr', quelle: 'WEG-Abrechnung (nicht umlagefähig)', betrag: 370.00 },
        { u: false, name: 'Zuführung Rücklage', quelle: 'WEG-Abrechnung (nicht umlagefähig)', betrag: 300.00 },
      ],
    },
  },
};

const LEER_JAHR = jahr => ({
  von: `${jahr}-01-01`, bis: `${jahr}-12-31`, vorausMonat: 0, monate: 12, datum: '',
  einleitung: BEISPIEL.jahre['2025'].einleitung, schlusstext: '', positionen: [],
});

const DOK_KATEGORIEN = ['Abrechnung Hausverwaltung', 'Heiz- und Wasserkosten', 'Grundsteuer', 'Nebenkostenabrechnung an Mieter', 'Mietvertrag', 'Schriftverkehr', 'Sonstiges'];

// Füllt fehlende Felder auf. Damit funktionieren auch Sicherungen aus der alten Einzeldatei-App.
function normalisiere(d) {
  d = d && typeof d === 'object' ? d : {};
  d.version = 2;
  d.vermieter = { name: '', strasse: '', ort: '', telefon: '', email: '', bank: '', iban: '', ...d.vermieter };
  d.mieter = { anrede: 'Frau', name: '', strasse: '', ort: '', wohnung: '', flaeche: '', email: '', seit: '', ...d.mieter };
  d.jahre = d.jahre && typeof d.jahre === 'object' ? d.jahre : {};
  if (!Object.keys(d.jahre).length) d.jahre[String(new Date().getFullYear() - 1)] = LEER_JAHR(new Date().getFullYear() - 1);
  for (const [y, j] of Object.entries(d.jahre)) {
    d.jahre[y] = { ...LEER_JAHR(y), ...j };
    if (!Array.isArray(d.jahre[y].positionen)) d.jahre[y].positionen = [];
  }
  if (!d.jahre[d.aktuell]) d.aktuell = Object.keys(d.jahre).sort().pop();
  const letztesJahr = d.jahre[Object.keys(d.jahre).sort().pop()];
  d.miete = { kalt: 0, nk: zahl(letztesJahr.vorausMonat), kaltVor3Jahren: '', letzteErhoehung: '', ...d.miete };
  d.vertrag = {
    beginn: d.mieter.seit || '', raeume: '2 Zimmer, Küche, Bad, Flur', etage: '', keller: 'Kellerabteil', stellplatz: '',
    gemeinschaft: 'Waschküche, Trockenraum und Garten zur Mitbenutzung', heizung: 'Zentralheizung mit Warmwasserbereitung',
    schluessel: '2 Haus- und Wohnungsschlüssel, 1 Briefkastenschlüssel, 1 Kellerschlüssel', kaution: '', personen: '1',
    kleinreparaturen: true, energieausweis: true, sonstiges: '', ort: '', datum: '', ...d.vertrag,
  };
  d.brief = { art: 'miete', datum: '', neuKalt: '', kappung: 20, begruendungArt: 'vergleich', begruendung: '', neuNk: '', abNk: '', betreff: '', text: '', ...d.brief };
  d.verlauf = Array.isArray(d.verlauf) ? d.verlauf : [];
  return d;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
const $ = s => document.querySelector(s);
const zahl = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v ?? '').replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const rund = n => Math.round(n * 100) / 100;
const zahlText = n => (n === '' || n == null) ? '' : Number(zahl(n)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = n => zahlText(rund(n)) + ' €';
const prozent = n => n.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const heute = () => new Date().toISOString().slice(0, 10);
const datumDE = iso => iso ? iso.split('-').reverse().join('.') : '';
const ersterImMonat = (iso, plus) => { const d = new Date(iso + 'T12:00:00'); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + plus, 1)).toISOString().slice(0, 10); };
const letzterImMonat = (iso, plus) => { const d = new Date(iso + 'T12:00:00'); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + plus + 1, 0)).toISOString().slice(0, 10); };
const plusMonate = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const monatName = iso => new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const ortOhnePlz = ort => String(ort || '').replace(/^\d+\s*/, '');
const nachname = name => String(name || '').trim().split(/\s+/).slice(-1)[0];
const getP = pfad => pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), D);
const setP = (pfad, wert) => { const ks = pfad.split('.'); const letzter = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), D); o[letzter] = wert; };

function anrede() {
  const m = D.mieter;
  if (m.anrede === 'Frau') return `Sehr geehrte Frau ${nachname(m.name)},`;
  if (m.anrede === 'Herr') return `Sehr geehrter Herr ${nachname(m.name)},`;
  return m.name ? `Guten Tag ${m.name},` : 'Sehr geehrte Damen und Herren,';
}
const mieterBez = () => D.mieter.anrede === 'Herr' ? 'Mieter' : D.mieter.anrede === 'Frau' ? 'Mieterin' : 'Mieter/in';

// Eingabefeld. Der Pfad zeigt in die Daten, z. B. "mieter.name".
function feld(label, pfad, o = {}) {
  const w = getP(pfad);
  const typ = o.typ || 'text';
  const klasse = o.breit ? ' class="breit"' : '';
  const hinweis = o.hinweis ? `<div class="hint">${o.hinweis}</div>` : '';
  if (typ === 'bool') return `<div${klasse}><label class="check"><input type="checkbox" data-bind="${pfad}" data-typ="bool" ${w ? 'checked' : ''}> ${esc(label)}</label>${hinweis}</div>`;
  if (typ === 'textarea') return `<div${klasse}><label>${esc(label)}</label><textarea data-bind="${pfad}" ${o.hoch ? `style="min-height:${o.hoch}px"` : ''}>${esc(w)}</textarea>${hinweis}</div>`;
  if (typ === 'select') return `<div${klasse}><label>${esc(label)}</label><select data-bind="${pfad}" data-typ="${o.wert || 'text'}">${o.optionen.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(w) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${hinweis}</div>`;
  if (typ === 'geld') return `<div${klasse}><label>${esc(label)}</label><input class="num" inputmode="decimal" data-bind="${pfad}" data-typ="geld" value="${w === '' ? '' : zahlText(w)}" placeholder="${o.platzhalter || ''}">${hinweis}</div>`;
  if (typ === 'zahl') return `<div${klasse}><label>${esc(label)}</label><input class="num" inputmode="numeric" data-bind="${pfad}" data-typ="zahl" value="${esc(w)}">${hinweis}</div>`;
  return `<div${klasse}><label>${esc(label)}</label><input type="${typ}" data-bind="${pfad}" value="${esc(w)}" placeholder="${esc(o.platzhalter || '')}">${hinweis}</div>`;
}

// ---------------------------------------------------------------------------
// Laden und Speichern (Server)
// ---------------------------------------------------------------------------
let D = null;
let speicherTimer = null;

function status(text, istFehler) { const s = $('#speicherStatus'); s.textContent = text; s.className = istFehler ? 'fehler' : ''; }

async function laden() {
  const r = await fetch('/api/daten');
  if (!r.ok) throw new Error('Laden fehlgeschlagen');
  const d = await r.json();
  return Object.keys(d).length ? normalisiere(d) : null;
}

function speichern(sofort) {
  clearTimeout(speicherTimer);
  status('Speichert …');
  const los = async () => {
    try {
      const r = await fetch('/api/daten', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(D) });
      if (!r.ok) throw new Error();
      status('Gespeichert ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch { status('Nicht gespeichert! Läuft der Server?', true); }
  };
  if (sofort) return los();
  speicherTimer = setTimeout(los, 400);
}
window.addEventListener('beforeunload', () => { if (speicherTimer) { clearTimeout(speicherTimer); fetch('/api/daten', { method: 'PUT', body: JSON.stringify(D), keepalive: true, headers: { 'Content-Type': 'application/json' } }); } });

// ---------------------------------------------------------------------------
// Drucken
// ---------------------------------------------------------------------------
function drucken(html, titel) {
  $('#print').innerHTML = html;
  const alt = document.title;
  document.title = titel;
  window.print();
  document.title = alt;
}

function briefKopf(datum) {
  const v = D.vermieter, m = D.mieter;
  return `<div class="absender">${esc(v.name)} · ${esc(v.strasse)} · ${esc(v.ort)}</div>
    <div class="kopf">
      <div>${esc(m.name)}<br>${esc(m.strasse)}<br>${esc(m.ort)}</div>
      <div style="text-align:right">${esc(v.name)}<br>${esc(v.strasse)}<br>${esc(v.ort)}${v.telefon ? '<br>Tel. ' + esc(v.telefon) : ''}${v.email ? '<br>' + esc(v.email) : ''}<br><br>${esc(ortOhnePlz(v.ort))}, ${datumDE(datum || heute())}</div>
    </div>`;
}
const absaetze = text => String(text || '').split(/\n{2,}/).map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');

// ---------------------------------------------------------------------------
// Reiter
// ---------------------------------------------------------------------------
const TABS = {};
let tab = 'uebersicht';

function zeige(name) {
  tab = TABS[name] ? name : 'uebersicht';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('aktiv', b.dataset.tab === tab));
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  if (!D) { zeigeStart(); return; }
  $('#inhalt').innerHTML = TABS[tab].render();
  TABS[tab].danach?.();
  TABS[tab].update?.();
}

// ---------- Erster Start ----------
function zeigeStart() {
  $('#inhalt').innerHTML = `
    <div class="card leer">
      <h2>Willkommen im Vermieter-Portal</h2>
      <p>Die Datenbank ist noch leer. Wie möchtest du anfangen?</p>
      <div class="knoepfe" style="justify-content:center">
        <button class="primary" data-aktion="import">Meine Datensicherung (.json) importieren</button>
        <button data-aktion="beispiel">Mit Beispieldaten ausprobieren</button>
        <button data-aktion="leer">Leer beginnen</button>
      </div>
      <p class="hint">Deine Daten bleiben auf deinem Rechner im Ordner <code>daten</code>. Nichts davon landet auf GitHub.</p>
    </div>`;
}

// ---------- Übersicht ----------
TABS.uebersicht = {
  render() {
    const m = D.mieter, mi = D.miete;
    const jahre = Object.keys(D.jahre).sort();
    const letztes = jahre[jahre.length - 1];
    const r = rechne(letztes);
    const frist = letzterImMonat(D.jahre[letztes].bis, 12);
    const tageBis = Math.ceil((new Date(frist) - new Date(heute())) / 86400000);
    const hinweise = [];
    if (tageBis >= 0 && tageBis < 120) hinweise.push(`<div class="box ${tageBis < 30 ? 'warn' : 'info'}">Die Nebenkostenabrechnung ${letztes} muss bis zum <b>${datumDE(frist)}</b> bei der ${mieterBez()} sein (noch ${tageBis} Tage).</div>`);
    const naechste = naechsteErhoehungAb(heute());
    hinweise.push(`<div class="box info">Eine Mieterhöhung nach § 558 BGB, die du heute verschickst, könnte frühestens ab <b>${datumDE(naechste.ab)}</b> gelten.${naechste.grund ? ' ' + naechste.grund : ''}</div>`);
    return `
      <div class="kacheln" style="margin-bottom:16px">
        <div class="kachel"><div class="titel">${mieterBez()}</div><div class="wert">${esc(m.name || '–')}</div><div class="unter">${esc(m.wohnung)}${m.seit ? ' · seit ' + datumDE(m.seit) : ''}</div></div>
        <div class="kachel"><div class="titel">Miete pro Monat</div><div class="wert">${euro(zahl(mi.kalt) + zahl(mi.nk))}</div><div class="unter">${euro(zahl(mi.kalt))} kalt + ${euro(zahl(mi.nk))} Nebenkosten</div></div>
        <div class="kachel"><div class="titel">Nebenkosten ${letztes}</div><div class="wert">${r.diff >= 0 ? 'Guthaben' : 'Nachzahlung'} ${euro(Math.abs(r.diff))}</div><div class="unter">Kosten ${euro(r.kosten)} · Vorauszahlung ${euro(r.voraus)}</div></div>
        <div class="kachel"><div class="titel">Dokumente</div><div class="wert" id="dokAnzahl">…</div><div class="unter">im Archiv</div></div>
      </div>
      <div class="card"><h2>Hinweise</h2>${hinweise.join('')}</div>
      <div class="card"><h2>Verlauf</h2>${D.verlauf.length ? `<table><thead><tr><th>Datum</th><th>Was</th></tr></thead><tbody>${D.verlauf.slice().reverse().map(v => `<tr><td>${datumDE(v.datum)}</td><td>${esc(v.text)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Noch keine Einträge. Wenn du eine Mieterhöhung oder neue Vorauszahlung übernimmst, erscheint sie hier.</p>'}</div>`;
  },
  async danach() {
    try { const l = await (await fetch('/api/dokumente')).json(); $('#dokAnzahl').textContent = l.length; } catch { $('#dokAnzahl').textContent = '–'; }
  },
};

// ---------- Stammdaten ----------
TABS.stammdaten = {
  render() {
    return `
      <div class="card"><h2>Vermieter</h2><div class="grid">
        ${feld('Name', 'vermieter.name')}${feld('Straße', 'vermieter.strasse')}${feld('PLZ Ort', 'vermieter.ort')}
        ${feld('Telefon', 'vermieter.telefon')}${feld('E-Mail', 'vermieter.email', { typ: 'email' })}
        ${feld('Bank', 'vermieter.bank')}${feld('IBAN', 'vermieter.iban')}
      </div></div>
      <div class="card"><h2>Mieter/in und Wohnung</h2><div class="grid">
        ${feld('Anrede', 'mieter.anrede', { typ: 'select', optionen: [['Frau', 'Frau'], ['Herr', 'Herr'], ['', 'neutral']] })}
        ${feld('Name', 'mieter.name')}${feld('Straße', 'mieter.strasse')}${feld('PLZ Ort', 'mieter.ort')}
        ${feld('E-Mail', 'mieter.email', { typ: 'email' })}${feld('Mietbeginn', 'mieter.seit', { typ: 'date' })}
        ${feld('Wohnung', 'mieter.wohnung')}${feld('Wohnfläche m²', 'mieter.flaeche')}
      </div></div>
      <div class="card"><h2>Aktuelle Miete</h2><div class="grid">
        ${feld('Kaltmiete pro Monat (€)', 'miete.kalt', { typ: 'geld' })}
        ${feld('Nebenkosten-Vorauszahlung pro Monat (€)', 'miete.nk', { typ: 'geld' })}
        ${feld('Letzte Mieterhöhung gültig seit', 'miete.letzteErhoehung', { typ: 'date', hinweis: 'Leer lassen, wenn die Miete seit Mietbeginn gleich ist.' })}
        ${feld('Kaltmiete vor 3 Jahren (€)', 'miete.kaltVor3Jahren', { typ: 'geld', hinweis: 'Für die Kappungsgrenze. Leer = wie heute.' })}
      </div></div>`;
  },
};

// ---------- Nebenkosten ----------
function rechne(jahr = D.aktuell) {
  const j = D.jahre[jahr];
  const kosten = j.positionen.filter(p => p.u).reduce((s, p) => s + zahl(p.betrag), 0);
  const voraus = zahl(j.vorausMonat) * zahl(j.monate);
  return { kosten: rund(kosten), voraus: rund(voraus), diff: rund(voraus - kosten) };
}

TABS.nebenkosten = {
  render() {
    const y = D.aktuell, P = `jahre.${y}`;
    return `
      <div class="card">
        <div class="knoepfe" style="margin-top:0;align-items:center">
          <label style="margin:0">Jahr</label>
          <select id="jahrWahl" style="width:auto">${Object.keys(D.jahre).sort().map(k => `<option ${k === y ? 'selected' : ''}>${k}</option>`).join('')}</select>
          <button data-aktion="neuesJahr">Neues Jahr anlegen</button>
          <button class="danger" data-aktion="jahrLoeschen">Jahr löschen</button>
          <span style="flex:1"></span>
          <button data-aktion="nkMail">Per E-Mail ankündigen</button>
          <button class="primary" data-aktion="nkDruck">PDF erstellen / drucken</button>
        </div>
      </div>
      <div class="card"><h2>Abrechnung ${esc(y)}</h2><div class="grid">
        ${feld('Zeitraum von', P + '.von', { typ: 'date' })}${feld('Zeitraum bis', P + '.bis', { typ: 'date' })}
        ${feld('Vorauszahlung pro Monat (€)', P + '.vorausMonat', { typ: 'geld' })}${feld('Anzahl Monate', P + '.monate', { typ: 'zahl' })}
        ${feld('Datum der Abrechnung', P + '.datum', { typ: 'date' })}
      </div></div>
      <div class="card"><h2>Kostenpositionen</h2>
        <p class="hint">Trage deinen Anteil aus der Einzelabrechnung der Hausverwaltung ein. Nur Positionen mit Haken kommen auf die Abrechnung. Abzüge (z. B. CO₂-Anteil des Vermieters) mit Minus eintragen.</p>
        <div class="tablewrap"><table>
          <thead><tr><th>Umlegen</th><th>Position</th><th>Quelle / Schlüssel</th><th class="num">Betrag €</th><th></th></tr></thead>
          <tbody>${D.jahre[y].positionen.map((p, i) => `
            <tr class="${p.u ? '' : 'off'}">
              <td><input type="checkbox" data-bind="${P}.positionen.${i}.u" data-typ="bool" ${p.u ? 'checked' : ''} aria-label="umlegen"></td>
              <td><input data-bind="${P}.positionen.${i}.name" value="${esc(p.name)}"></td>
              <td><input data-bind="${P}.positionen.${i}.quelle" value="${esc(p.quelle)}"></td>
              <td style="width:130px"><input class="num" inputmode="decimal" data-bind="${P}.positionen.${i}.betrag" data-typ="geld" value="${zahlText(p.betrag)}"></td>
              <td><button class="danger" data-aktion="posLoeschen" data-i="${i}" title="Position löschen">✕</button></td>
            </tr>`).join('')}</tbody>
        </table></div>
        <div class="knoepfe"><button data-aktion="posNeu">+ Position hinzufügen</button></div>
      </div>
      <div class="card"><h2>Ergebnis</h2><div class="result" id="nkErgebnis"></div></div>
      <div class="card"><h2>Texte für die Abrechnung</h2><div class="grid">
        ${feld('Einleitung (nach der Anrede)', P + '.einleitung', { typ: 'textarea', breit: true })}
        ${feld('Schlusstext (unter dem Ergebnis)', P + '.schlusstext', { typ: 'textarea', breit: true })}
      </div></div>`;
  },
  update() {
    const r = rechne();
    const el = $('#nkErgebnis'); if (!el) return;
    el.innerHTML = `
      <span>Umlagefähige Kosten</span><span>${euro(r.kosten)}</span>
      <span>Vorauszahlungen</span><span>${euro(r.voraus)}</span>
      <span class="big">${r.diff >= 0 ? 'Guthaben ' : 'Nachzahlung '}${mieterBez()}</span><span class="big">${euro(Math.abs(r.diff))}</span>
      <span class="hint">Kosten pro Monat</span><span class="hint">${euro(r.kosten / 12)}</span>`;
  },
};

function nkDruckHtml() {
  const y = D.aktuell, j = D.jahre[y], r = rechne(), m = D.mieter, v = D.vermieter;
  const zeilen = j.positionen.filter(p => p.u).map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.quelle)}</td><td class="num">${euro(zahl(p.betrag))}</td></tr>`).join('');
  return `${briefKopf(j.datum)}
    <h3>Betriebskostenabrechnung ${esc(y)}</h3>
    <p>Mietobjekt: ${esc(m.strasse)}, ${esc(m.wohnung)}${m.flaeche ? ', ' + esc(m.flaeche) + ' m² Wohnfläche' : ''}<br>Abrechnungszeitraum: ${datumDE(j.von)} bis ${datumDE(j.bis)}</p>
    <p>${esc(anrede())}</p>
    ${absaetze(j.einleitung)}
    <table>
      <thead><tr><th>Kostenart</th><th>Grundlage / Verteilerschlüssel</th><th class="num">Ihr Anteil</th></tr></thead>
      <tbody>${zeilen}
        <tr class="sum"><td colspan="2">Summe Betriebskosten</td><td class="num">${euro(r.kosten)}</td></tr>
        <tr><td colspan="2">abzüglich Ihrer Vorauszahlungen (${zahl(j.monate)} × ${euro(zahl(j.vorausMonat))})</td><td class="num">${euro(r.voraus)}</td></tr>
      </tbody>
    </table>
    <p class="ergebnis">${r.diff >= 0 ? 'Ihr Guthaben' : 'Ihre Nachzahlung'}: ${euro(Math.abs(r.diff))}</p>
    ${absaetze(j.schlusstext)}
    <p style="margin-top:6mm">Mit freundlichen Grüßen</p>
    <p style="margin-top:10mm">${esc(v.name)}</p>`;
}

// ---------- Dokumente ----------
TABS.dokumente = {
  render() {
    const jahre = Object.keys(D.jahre).sort().reverse();
    return `
      <div class="card"><h2>Dokumente hochladen</h2>
        <div class="grid">
          <div><label>Jahr</label><select id="dokJahr">${jahre.map(y => `<option>${y}</option>`).join('')}<option value="">ohne Jahr</option></select></div>
          <div><label>Art</label><select id="dokKat">${DOK_KATEGORIEN.map(k => `<option>${k}</option>`).join('')}</select></div>
        </div>
        <div class="ablage" id="ablage" style="margin-top:12px">PDFs hierher ziehen oder <button data-aktion="dokWaehlen">Dateien auswählen</button>
          <input type="file" id="dokDatei" multiple accept="application/pdf,image/*" hidden></div>
        <p class="hint">Die Dateien werden im Ordner <code>daten/dokumente</code> auf deinem Rechner abgelegt.</p>
      </div>
      <div class="card"><h2>Archiv</h2><div id="dokListe">Lädt …</div></div>`;
  },
  async danach() {
    const ablage = $('#ablage');
    ablage.addEventListener('dragover', e => { e.preventDefault(); ablage.classList.add('ueber'); });
    ablage.addEventListener('dragleave', () => ablage.classList.remove('ueber'));
    ablage.addEventListener('drop', e => { e.preventDefault(); ablage.classList.remove('ueber'); hochladen(e.dataTransfer.files); });
    $('#dokDatei').addEventListener('change', e => { hochladen(e.target.files); e.target.value = ''; });
    await dokListe();
  },
};

async function hochladen(dateien) {
  const jahr = $('#dokJahr').value, kat = $('#dokKat').value;
  for (const f of dateien) {
    status(`Lädt ${f.name} hoch …`);
    const q = new URLSearchParams({ name: f.name, jahr, kategorie: kat });
    const r = await fetch('/api/dokumente?' + q, { method: 'POST', body: f });
    if (!r.ok) { status(`${f.name} konnte nicht hochgeladen werden`, true); alert(`${f.name} konnte nicht hochgeladen werden.`); continue; }
  }
  status('Hochgeladen');
  dokListe();
}

async function dokListe() {
  const ziel = $('#dokListe'); if (!ziel) return;
  let liste = [];
  try { liste = await (await fetch('/api/dokumente')).json(); } catch { ziel.textContent = 'Archiv konnte nicht geladen werden.'; return; }
  if (!liste.length) { ziel.innerHTML = '<p class="hint">Noch keine Dokumente.</p>'; return; }
  const gruppen = {};
  for (const d of liste) (gruppen[d.jahr || 'ohne Jahr'] ??= []).push(d);
  ziel.innerHTML = Object.keys(gruppen).sort().reverse().map(y => `
    <h3>${esc(y)}</h3>
    <div class="tablewrap"><table><thead><tr><th>Titel</th><th>Art</th><th class="num">Größe</th><th></th></tr></thead><tbody>
    ${gruppen[y].sort((a, b) => a.kategorie.localeCompare(b.kategorie)).map(d => `<tr>
      <td><a href="/api/dokumente/${d.id}" target="_blank" rel="noopener">${esc(d.titel)}</a></td>
      <td>${esc(d.kategorie)}</td>
      <td class="num">${(d.groesse / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 })} KB</td>
      <td style="white-space:nowrap"><a href="/api/dokumente/${d.id}?download"><button>Herunterladen</button></a>
        <button data-aktion="dokUmbenennen" data-id="${d.id}" data-titel="${esc(d.titel)}">Umbenennen</button>
        <button class="danger" data-aktion="dokLoeschen" data-id="${d.id}" data-titel="${esc(d.titel)}">✕</button></td>
    </tr>`).join('')}</tbody></table></div>`).join('');
}

// ---------- Mietvertrag ----------
TABS.vertrag = {
  render() {
    return `
      <div class="card"><h2>Mietvertrag</h2>
        <p class="hint">Namen, Adressen und Miete kommen aus den Stammdaten. Hier ergänzt du die Angaben zur Wohnung. Die Vorlage ist ein Muster ohne Gewähr und ersetzt keine Rechtsberatung. Lass sie vor der ersten Verwendung z. B. von Haus &amp; Grund prüfen.</p>
        <div class="grid">
          ${feld('Mietbeginn', 'vertrag.beginn', { typ: 'date' })}
          ${feld('Räume', 'vertrag.raeume')}${feld('Lage / Etage', 'vertrag.etage', { platzhalter: 'z. B. Erdgeschoss links' })}
          ${feld('Keller / Nebenräume', 'vertrag.keller')}${feld('Stellplatz / Garage', 'vertrag.stellplatz', { platzhalter: 'leer = keiner' })}
          ${feld('Zur Mitbenutzung', 'vertrag.gemeinschaft')}${feld('Heizung / Warmwasser', 'vertrag.heizung')}
          ${feld('Schlüssel', 'vertrag.schluessel', { breit: true })}
          ${feld('Kaution (€)', 'vertrag.kaution', { typ: 'geld', platzhalter: 'leer = 3 Kaltmieten', hinweis: 'Höchstens 3 Kaltmieten (§ 551 BGB).' })}
          ${feld('Anzahl Personen', 'vertrag.personen')}
          ${feld('Ort der Unterschrift', 'vertrag.ort', { platzhalter: ortOhnePlz(D.vermieter.ort) })}
          ${feld('Datum der Unterschrift', 'vertrag.datum', { typ: 'date' })}
          ${feld('Kleinreparaturklausel aufnehmen (bis 100 € je Fall, höchstens 8 % der Jahreskaltmiete)', 'vertrag.kleinreparaturen', { typ: 'bool', breit: true })}
          ${feld('Energieausweis wurde vorgelegt', 'vertrag.energieausweis', { typ: 'bool', breit: true })}
          ${feld('Sonstige Vereinbarungen', 'vertrag.sonstiges', { typ: 'textarea', breit: true })}
        </div>
        <div class="knoepfe"><button class="primary" data-aktion="vertragDruck">Mietvertrag drucken / als PDF speichern</button></div>
      </div>`;
  },
};

function vertragHtml() {
  const v = D.vermieter, m = D.mieter, t = D.vertrag, mi = D.miete;
  const kalt = zahl(mi.kalt), nk = zahl(mi.nk);
  const kaution = t.kaution === '' || t.kaution == null ? kalt * 3 : zahl(t.kaution);
  let n = 0;
  const par = (titel, inhalt) => `<div class="keinumbruch"><h4>§ ${++n} ${titel}</h4>${inhalt}</div>`;
  const mitvermietet = [t.keller, t.stellplatz].filter(Boolean).join(', ');
  return `<div class="vertrag">
    <div class="titelblatt">Mietvertrag über Wohnraum</div>
    <p>Zwischen<br><b>${esc(v.name)}</b>, ${esc(v.strasse)}, ${esc(v.ort)}<br>– nachfolgend „Vermieter“ –</p>
    <p>und<br><b>${esc(m.name)}</b><br>– nachfolgend „Mieter“ –</p>
    <p>wird folgender Mietvertrag geschlossen:</p>
    ${par('Mietsache', `<p>(1) Vermietet wird zu Wohnzwecken die Wohnung (${esc(m.wohnung)}${t.etage ? ', ' + esc(t.etage) : ''}) im Haus ${esc(m.strasse)}, ${esc(m.ort)}, bestehend aus ${esc(t.raeume)}. Die Wohnfläche beträgt ca. ${esc(m.flaeche)} m².</p>
      ${mitvermietet ? `<p>(2) Mitvermietet sind: ${esc(mitvermietet)}.</p>` : ''}
      ${t.gemeinschaft ? `<p>(${mitvermietet ? 3 : 2}) ${esc(t.gemeinschaft)}.</p>` : ''}
      <p>Die Wohnung gehört zu einer Wohnungseigentumsanlage. Die Hausordnung und die Beschlüsse der Eigentümergemeinschaft zum Gebrauch des gemeinschaftlichen Eigentums sind auch für den Mieter verbindlich, soweit sie ihm bekannt gegeben wurden.</p>
      <p>Die Wohnung wird von ${esc(t.personen || '1')} Person(en) bewohnt.</p>`)}
    ${par('Mietzeit und Kündigung', `<p>(1) Das Mietverhältnis beginnt am ${datumDE(t.beginn || m.seit) || '__________'} und läuft auf unbestimmte Zeit.</p>
      <p>(2) Die Kündigung richtet sich nach den gesetzlichen Vorschriften. Der Mieter kann mit einer Frist von drei Monaten kündigen. Für den Vermieter verlängert sich die Frist nach fünf und acht Jahren Mietdauer um jeweils drei Monate (§ 573c BGB). Die Kündigung muss schriftlich erfolgen (§ 568 BGB).</p>`)}
    ${par('Miete und Betriebskosten', `<table>
        <tr><td>Nettokaltmiete</td><td class="num">${euro(kalt)}</td></tr>
        <tr><td>Vorauszahlung auf die Betriebskosten einschließlich Heizung und Warmwasser</td><td class="num">${euro(nk)}</td></tr>
        <tr class="sum"><td>Monatliche Gesamtmiete</td><td class="num">${euro(kalt + nk)}</td></tr></table>
      <p>(2) Der Mieter trägt die Betriebskosten nach § 2 der Betriebskostenverordnung, insbesondere Grundsteuer, Wasser und Abwasser, Niederschlagswasser, Heizung und Warmwasser, Hausreinigung und Hausmeister, Gartenpflege, Allgemeinstrom, Sach- und Haftpflichtversicherungen, Müllbeseitigung, Schornsteinreinigung sowie Wartungs- und Prüfkosten.</p>
      <p>(3) Die Kosten werden so verteilt, wie sie in der Jahresabrechnung der Eigentümergemeinschaft auf die Wohnung entfallen (in der Regel nach Miteigentumsanteilen). Heiz- und Warmwasserkosten werden nach der Heizkostenverordnung überwiegend nach Verbrauch verteilt.</p>
      <p>(4) Über die Vorauszahlungen wird jährlich abgerechnet. Nach einer Abrechnung kann jede Partei die Vorauszahlung in Textform auf eine angemessene Höhe anpassen (§ 560 Abs. 4 BGB).</p>`)}
    ${par('Zahlung', `<p>Die Miete ist monatlich im Voraus, spätestens am dritten Werktag des Monats, kostenfrei auf folgendes Konto zu zahlen: ${esc(v.bank)}${v.bank ? ', ' : ''}IBAN ${esc(v.iban) || '______________________'}, Kontoinhaber ${esc(v.name)}. Für die Rechtzeitigkeit kommt es auf die Erteilung des Zahlungsauftrags an.</p>`)}
    ${par('Mietsicherheit (Kaution)', `<p>Der Mieter leistet eine Kaution von ${euro(kaution)}. Er darf sie in drei gleichen monatlichen Teilbeträgen zahlen; der erste Teilbetrag ist zu Beginn des Mietverhältnisses fällig. Der Vermieter legt die Kaution getrennt von seinem Vermögen bei einem Kreditinstitut zum üblichen Zinssatz für Spareinlagen mit dreimonatiger Kündigungsfrist an. Die Zinsen stehen dem Mieter zu (§ 551 BGB).</p>`)}
    ${par('Zustand, Obhut und Mängel', `<p>(1) Der Mieter hat die Wohnung besichtigt und übernimmt sie im Zustand bei Übergabe. Der Zustand wird in einem Übergabeprotokoll festgehalten.</p>
      <p>(2) Der Mieter behandelt die Wohnung pfleglich, lüftet und heizt ausreichend und zeigt Mängel unverzüglich an (§ 536c BGB).</p>
      ${t.heizung ? `<p>(3) Heizung und Warmwasser: ${esc(t.heizung)}.</p>` : ''}`)}
    ${t.kleinreparaturen ? par('Kleinreparaturen', `<p>Der Mieter trägt die Kosten kleiner Instandhaltungen an Teilen der Wohnung, die seinem häufigen Zugriff ausgesetzt sind (z. B. Installationsgegenstände für Wasser und Strom, Heiz- und Kocheinrichtungen, Fenster- und Türverschlüsse, Verschlussvorrichtungen von Fensterläden), soweit die Kosten im Einzelfall 100 € nicht übersteigen. Im Jahr trägt er höchstens 8 % der Jahresnettokaltmiete. Eine Pflicht, die Reparatur selbst zu beauftragen, besteht nicht.</p>`) : ''}
    ${par('Tierhaltung', `<p>Kleintiere (z. B. Zierfische, Wellensittiche, Hamster) darf der Mieter ohne Erlaubnis halten. Für andere Tiere, insbesondere Hunde und Katzen, ist die vorherige Zustimmung des Vermieters nötig. Sie wird nur aus sachlichem Grund verweigert.</p>`)}
    ${par('Untervermietung und bauliche Änderungen', `<p>Untervermietung und die Überlassung an Dritte sind nur mit Erlaubnis des Vermieters zulässig (§§ 540, 553 BGB). Bauliche Veränderungen bedürfen der vorherigen Zustimmung des Vermieters.</p>`)}
    ${par('Betreten der Wohnung', `<p>Der Vermieter darf die Wohnung aus berechtigtem Anlass (z. B. Ablesung, Reparatur, Besichtigung bei Verkauf oder Neuvermietung) nach rechtzeitiger Ankündigung zu üblichen Tageszeiten betreten.</p>`)}
    ${par('Schlüssel und Rückgabe', `<p>(1) Der Mieter erhält: ${esc(t.schluessel)}.</p>
      <p>(2) Bei Ende des Mietverhältnisses gibt der Mieter die Wohnung geräumt, besenrein und mit allen Schlüsseln zurück.</p>`)}
    ${t.sonstiges ? par('Sonstige Vereinbarungen', absaetze(t.sonstiges)) : ''}
    ${par('Schlussbestimmungen', `<p>${t.energieausweis ? 'Der Energieausweis wurde dem Mieter vor Vertragsschluss vorgelegt. ' : ''}Änderungen und Ergänzungen dieses Vertrags sollen schriftlich erfolgen. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam; es gelten dann die gesetzlichen Vorschriften. Jede Partei erhält eine Ausfertigung.</p>`)}
    <p style="margin-top:8mm">${esc(t.ort || ortOhnePlz(v.ort))}, den ${datumDE(t.datum) || '______________'}</p>
    <div class="unterschriften"><div>Vermieter: ${esc(v.name)}</div><div>Mieter: ${esc(m.name)}</div></div>
  </div>`;
}

// ---------- Mieterhöhung und Briefe ----------
function kaltVor3Jahren() {
  const v = D.miete.kaltVor3Jahren;
  return v === '' || v == null || zahl(v) === 0 ? zahl(D.miete.kalt) : zahl(v);
}

// Frühester Termin für eine Mieterhöhung nach § 558 BGB, wenn das Schreiben am Tag "zugang" ankommt.
function naechsteErhoehungAb(zugang) {
  let ab = ersterImMonat(zugang, 3);   // Beginn des dritten Monats nach Zugang (§ 558b Abs. 1 BGB)
  let grund = '';
  const basis = D.miete.letzteErhoehung || D.mieter.seit;
  if (basis) {
    const fruehestensVerlangen = plusMonate(basis, 12);  // Sperrfrist ein Jahr (§ 558 Abs. 1 S. 2)
    const fruehestensWirksam = plusMonate(basis, 15);
    if (fruehestensWirksam > ab) { ab = fruehestensWirksam; grund = `Die letzte Änderung (${datumDE(basis)}) ist noch keine 15 Monate her.`; }
    if (fruehestensVerlangen > zugang) grund = `Das Schreiben darf erst ab dem ${datumDE(fruehestensVerlangen)} verschickt werden (ein Jahr nach der letzten Änderung).`;
  }
  return { ab, grund };
}

function briefDaten() {
  const b = D.brief, mi = D.miete, m = D.mieter;
  const datum = b.datum || heute();
  const flaeche = zahl(m.flaeche);
  if (b.art === 'miete') {
    const alt = zahl(mi.kalt), neu = zahl(b.neuKalt) || alt;
    const { ab, grund } = naechsteErhoehungAb(datum);
    const grenze = rund(kaltVor3Jahren() * (1 + zahl(b.kappung) / 100));
    const fristEnde = letzterImMonat(datum, 2);
    const proQm = x => flaeche ? ` (${zahlText(x / flaeche)} €/m²)` : '';
    const begruendungen = {
      vergleich: 'Zur Begründung benenne ich die folgenden drei vergleichbaren Wohnungen, für die mindestens die verlangte Miete pro Quadratmeter gezahlt wird:',
      mietspiegel: 'Zur Begründung beziehe ich mich auf den Mietspiegel der Gemeinde:',
      gutachten: 'Zur Begründung füge ich das Gutachten eines öffentlich bestellten und vereidigten Sachverständigen bei:',
      datenbank: 'Zur Begründung beziehe ich mich auf die Mietdatenbank:',
    };
    const warnungen = [];
    if (neu <= alt) warnungen.push('Die neue Kaltmiete ist nicht höher als die aktuelle.');
    if (neu > grenze) warnungen.push(`Die Kappungsgrenze von ${b.kappung} % wird überschritten. Höchstens ${euro(grenze)} sind möglich (Basis ${euro(kaltVor3Jahren())} vor drei Jahren).`);
    if (grund && grund.startsWith('Das Schreiben')) warnungen.push(grund);
    if (!b.begruendung.trim()) warnungen.push('Die Begründung fehlt. Ohne Begründung ist das Mieterhöhungsverlangen unwirksam.');
    const betreff = 'Mieterhöhungsverlangen nach § 558 BGB';
    const text = [
      anrede(),
      `die Nettokaltmiete für die von Ihnen gemietete Wohnung (${m.wohnung}, ${m.strasse}, ${m.ort}) beträgt derzeit ${euro(alt)} monatlich${proQm(alt)}.`,
      `Ich bitte Sie, einer Erhöhung der Nettokaltmiete auf ${euro(neu)} monatlich${proQm(neu)} mit Wirkung ab dem ${datumDE(ab)} zuzustimmen. Das ist eine Erhöhung um ${euro(neu - alt)} (${prozent(alt ? (neu - alt) / alt * 100 : 0)}).`,
      `${begruendungen[b.begruendungArt] || ''}\n${b.begruendung.trim()}`.trim(),
      `Die neue Miete übersteigt die ortsübliche Vergleichsmiete nicht. Die Kappungsgrenze von ${b.kappung} % innerhalb von drei Jahren ist eingehalten. Die Miete ist seit mindestens 15 Monaten unverändert.`,
      `Die Vorauszahlung auf die Betriebskosten von ${euro(zahl(mi.nk))} bleibt gleich. Ab dem ${datumDE(ab)} beträgt Ihre monatliche Gesamtmiete damit ${euro(neu + zahl(mi.nk))}.`,
      `Bitte teilen Sie mir Ihre Zustimmung bis zum ${datumDE(fristEnde)} mit. Eine kurze schriftliche Bestätigung oder eine Antwort per E-Mail genügt. Bitte passen Sie danach Ihren Dauerauftrag an.`,
      `Mit freundlichen Grüßen\n${D.vermieter.name}`,
    ];
    return { betreff, text, warnungen, ab, neu, alt, zustimmung: true, datum };
  }
  if (b.art === 'voraus') {
    const jahre = Object.keys(D.jahre).sort();
    const y = jahre[jahre.length - 1], r = rechne(y);
    const altNk = zahl(mi.nk);
    const vorschlag = Math.ceil(r.kosten / 12 / 5) * 5;
    const neuNk = zahl(b.neuNk) || vorschlag;
    const ab = b.abNk || ersterImMonat(datum, 1);
    const warnungen = [];
    if (neuNk > r.kosten / 12 * 1.1) warnungen.push(`Die neue Vorauszahlung liegt deutlich über den tatsächlichen Kosten (${euro(r.kosten / 12)} pro Monat im Jahr ${y}). Die Anpassung muss angemessen sein.`);
    const betreff = 'Anpassung der Betriebskostenvorauszahlung nach § 560 Abs. 4 BGB';
    const text = [
      anrede(),
      `die Betriebskostenabrechnung für ${y} hat umlagefähige Kosten von ${euro(r.kosten)} ergeben, das sind ${euro(r.kosten / 12)} pro Monat.`,
      `Auf dieser Grundlage passe ich die monatliche Vorauszahlung auf die Betriebskosten nach § 560 Abs. 4 BGB von ${euro(altNk)} auf ${euro(neuNk)} an, erstmals für die Miete im ${monatName(ab)}.`,
      `Ihre monatliche Gesamtmiete beträgt ab dann ${euro(zahl(mi.kalt) + neuNk)} (Nettokaltmiete ${euro(zahl(mi.kalt))} und Vorauszahlung ${euro(neuNk)}). Bitte passen Sie Ihren Dauerauftrag entsprechend an.`,
      `Mit freundlichen Grüßen\n${D.vermieter.name}`,
    ];
    return { betreff, text, warnungen, ab, neuNk, altNk, vorschlag, jahr: y, datum };
  }
  const text = [anrede(), b.text.trim(), `Mit freundlichen Grüßen\n${D.vermieter.name}`].filter(Boolean);
  return { betreff: b.betreff || 'Mitteilung', text, warnungen: [], datum };
}

TABS.schreiben = {
  render() {
    const b = D.brief;
    const felder = {
      miete: `
        ${feld('Neue Kaltmiete pro Monat (€)', 'brief.neuKalt', { typ: 'geld', platzhalter: zahlText(D.miete.kalt) })}
        ${feld('Kappungsgrenze', 'brief.kappung', { typ: 'select', wert: 'zahl', optionen: [[20, '20 % in 3 Jahren'], [15, '15 % (Gemeinde mit angespanntem Wohnungsmarkt)']], hinweis: 'In Baden-Württemberg gilt in bestimmten Gemeinden 15 %. Das steht in der Kappungsgrenzenverordnung.' })}
        ${feld('Begründung über', 'brief.begruendungArt', { typ: 'select', optionen: [['vergleich', 'drei Vergleichswohnungen'], ['mietspiegel', 'Mietspiegel'], ['gutachten', 'Sachverständigengutachten'], ['datenbank', 'Mietdatenbank']] })}
        ${feld('Begründung', 'brief.begruendung', { typ: 'textarea', breit: true, hoch: 110, hinweis: 'Bei Vergleichswohnungen: Adresse, Lage im Haus, Größe und Miete pro m² von drei Wohnungen. Beim Mietspiegel: Name, Stand und Einordnung der Wohnung.' })}`,
      voraus: `
        ${feld('Neue Vorauszahlung pro Monat (€)', 'brief.neuNk', { typ: 'geld', platzhalter: 'Vorschlag aus der letzten Abrechnung' })}
        ${feld('Gilt ab', 'brief.abNk', { typ: 'date', hinweis: 'Leer = ab dem nächsten Monat.' })}`,
      frei: `
        ${feld('Betreff', 'brief.betreff', { breit: true })}
        ${feld('Text (Anrede und Gruß werden automatisch ergänzt)', 'brief.text', { typ: 'textarea', breit: true, hoch: 160 })}`,
    };
    return `
      <div class="card"><h2>Schreiben an die ${mieterBez()}</h2>
        <div class="grid">
          ${feld('Art des Schreibens', 'brief.art', { typ: 'select', optionen: [['miete', 'Mieterhöhung (Kaltmiete, § 558 BGB)'], ['voraus', 'Neue Nebenkosten-Vorauszahlung (§ 560 BGB)'], ['frei', 'Freies Schreiben']] })}
          ${feld('Datum (Zugang bei der ' + mieterBez() + ')', 'brief.datum', { typ: 'date', hinweis: 'Leer = heute. Bei E-Mail zählt der Tag, an dem sie ankommt.' })}
          ${felder[b.art] || ''}
        </div>
        <div class="box info">Mieterhöhung und Anpassung der Vorauszahlung brauchen nur die Textform. Eine E-Mail mit deinem Namen am Ende reicht also. Für einen sicheren Nachweis kannst du den Brief zusätzlich ausdrucken und einwerfen.</div>
      </div>
      <div class="card"><h2>Vorschau</h2>
        <div id="briefWarn"></div>
        <div class="vorschau" id="briefVorschau"></div>
        <div class="knoepfe">
          <button class="primary" data-aktion="briefMail">E-Mail öffnen</button>
          <button data-aktion="briefKopieren">Text kopieren</button>
          <button data-aktion="briefDruck">Drucken / als PDF speichern</button>
          <span style="flex:1"></span>
          <span id="briefUebernehmen"></span>
        </div>
        <p class="hint">Musterschreiben ohne Gewähr, keine Rechtsberatung.</p>
      </div>`;
  },
  update() {
    const bd = briefDaten();
    const w = $('#briefWarn'); if (!w) return;
    w.innerHTML = bd.warnungen.map(t => `<div class="box warn">${esc(t)}</div>`).join('') ||
      (bd.ab ? `<div class="box ok">Gilt ab ${datumDE(bd.ab)}.</div>` : '');
    $('#briefVorschau').textContent = `Betreff: ${bd.betreff}\n\n${bd.text.join('\n\n')}`;
    const u = $('#briefUebernehmen');
    if (D.brief.art === 'miete') u.innerHTML = `<button data-aktion="mieteUebernehmen">Zustimmung erhalten: neue Miete übernehmen</button>`;
    else if (D.brief.art === 'voraus') u.innerHTML = `<button data-aktion="nkUebernehmen">Neue Vorauszahlung übernehmen</button>`;
    else u.innerHTML = '';
  },
};

function briefDruckHtml() {
  const bd = briefDaten();
  const [anr, ...rest] = bd.text;
  const gruss = rest.pop();
  let html = `${briefKopf(bd.datum)}<h3>${esc(bd.betreff)}</h3>
    <p>Mietobjekt: ${esc(D.mieter.strasse)}, ${esc(D.mieter.wohnung)}</p>
    <p>${esc(anr)}</p>${rest.map(absaetze).join('')}
    <p style="margin-top:6mm">${esc(gruss.split('\n')[0])}</p><p style="margin-top:10mm">${esc(D.vermieter.name)}</p>`;
  if (bd.zustimmung) html += `<div class="abschnitt keinumbruch"><b>Zustimmungserklärung</b> (bitte zurück an ${esc(D.vermieter.name)}, ${esc(D.vermieter.strasse)}, ${esc(D.vermieter.ort)})
    <p style="margin-top:3mm">Ich stimme der Erhöhung der Nettokaltmiete für die Wohnung ${esc(D.mieter.wohnung)}, ${esc(D.mieter.strasse)}, auf ${euro(bd.neu)} monatlich ab dem ${datumDE(bd.ab)} zu.</p>
    <div class="unterschriften"><div>Ort, Datum</div><div>${esc(D.mieter.name)}</div></div></div>`;
  return html;
}

// ---------- Datensicherung ----------
TABS.sicherung = {
  render() {
    return `
      <div class="card"><h2>Datensicherung</h2>
        <p>Alle Eingaben stehen in der Datei <code>daten/portal.json</code>, die Dokumente in <code>daten/dokumente</code>. Der Server legt jeden Tag vor der ersten Änderung eine Kopie in <code>daten/sicherungen</code> an (die letzten 30 Tage).</p>
        <p>Am sichersten ist es, den ganzen Ordner <code>daten</code> regelmäßig auf einen USB-Stick oder ein NAS zu kopieren.</p>
        <div class="knoepfe">
          <button class="primary" data-aktion="export">Daten als Datei sichern (.json)</button>
          <button data-aktion="import">Sicherung importieren (.json)</button>
        </div>
        <p class="hint">Der Import versteht auch die Sicherungsdateien der alten Einzeldatei-Version (nebenkosten-daten-….json). Er ersetzt die aktuellen Daten, Dokumente bleiben erhalten.</p>
      </div>
      <div class="card"><h2>Neu beginnen</h2>
        <div class="knoepfe" style="margin-top:0"><button class="danger" data-aktion="beispiel">Beispieldaten laden (ersetzt alles)</button></div>
      </div>`;
  },
};

// ---------------------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------------------
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.bind || !D) return;
  const typ = el.dataset.typ;
  let wert = el.value;
  if (typ === 'bool') wert = el.checked;
  else if (typ === 'geld') wert = el.value.trim() === '' ? '' : zahl(el.value);
  else if (typ === 'zahl') wert = zahl(el.value);
  setP(el.dataset.bind, wert);
  if (typ === 'bool' && el.closest('tr')) el.closest('tr').className = wert ? '' : 'off';
  speichern();
  if (el.dataset.bind === 'brief.art') return zeige(tab);
  TABS[tab].update?.();
});

document.addEventListener('focusout', e => {
  if (e.target.dataset?.typ === 'geld' && e.target.value.trim() !== '') e.target.value = zahlText(zahl(e.target.value));
});

document.addEventListener('change', e => {
  if (e.target.id === 'jahrWahl') { D.aktuell = e.target.value; speichern(); zeige('nebenkosten'); }
});

$('#tabs').addEventListener('click', e => { if (e.target.dataset.tab) zeige(e.target.dataset.tab); });
window.addEventListener('hashchange', () => zeige(location.hash.slice(1)));

function mailto(an, betreff, text) {
  const link = `mailto:${encodeURIComponent(an || '')}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
  location.href = link;
}

const AKTIONEN = {
  import: () => $('#jsonDatei').click(),
  async beispiel() {
    if (D && !confirm('Alle aktuellen Daten durch Beispieldaten ersetzen?')) return;
    D = normalisiere(structuredClone(BEISPIEL)); await speichern(true); zeige('uebersicht');
  },
  async leer() { D = normalisiere({}); await speichern(true); zeige('stammdaten'); },
  export() {
    const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vermieter-portal-${heute()}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  neuesJahr() {
    const jahre = Object.keys(D.jahre).sort();
    const letztes = jahre[jahre.length - 1], neu = String(+letztes + 1);
    if (!confirm(`Abrechnung ${neu} anlegen? Positionen und Texte aus ${letztes} werden übernommen, die Beträge auf 0 gesetzt.`)) return;
    const alt = D.jahre[letztes];
    D.jahre[neu] = { ...structuredClone(alt), von: `${neu}-01-01`, bis: `${neu}-12-31`, datum: '', vorausMonat: zahl(D.miete.nk) || alt.vorausMonat, positionen: alt.positionen.map(p => ({ ...p, betrag: 0 })) };
    D.aktuell = neu; speichern(); zeige('nebenkosten');
  },
  jahrLoeschen() {
    if (Object.keys(D.jahre).length < 2) return alert('Das letzte verbleibende Jahr kann nicht gelöscht werden.');
    if (!confirm(`Abrechnung ${D.aktuell} wirklich löschen?`)) return;
    delete D.jahre[D.aktuell]; D.aktuell = Object.keys(D.jahre).sort().pop(); speichern(); zeige('nebenkosten');
  },
  posNeu() { D.jahre[D.aktuell].positionen.push({ u: true, name: '', quelle: '', betrag: 0 }); speichern(); zeige('nebenkosten'); },
  posLoeschen(el) {
    const p = D.jahre[D.aktuell].positionen[+el.dataset.i];
    if (!confirm(`Position „${p.name}“ löschen?`)) return;
    D.jahre[D.aktuell].positionen.splice(+el.dataset.i, 1); speichern(); zeige('nebenkosten');
  },
  nkDruck() { drucken(nkDruckHtml(), `Nebenkostenabrechnung ${D.aktuell} ${D.mieter.name}`); },
  nkMail() {
    const r = rechne(), y = D.aktuell;
    mailto(D.mieter.email, `Betriebskostenabrechnung ${y}`,
      `${anrede()}\n\nanbei erhalten Sie die Betriebskostenabrechnung für ${y}. Es ergibt sich ${r.diff >= 0 ? 'ein Guthaben' : 'eine Nachzahlung'} von ${euro(Math.abs(r.diff))}.\n\nDie Abrechnung finden Sie im Anhang.\n\nMit freundlichen Grüßen\n${D.vermieter.name}`);
    setTimeout(() => alert('Wichtig: Speichere die Abrechnung vorher mit „PDF erstellen“ als PDF und hänge sie an die E-Mail an.'), 300);
  },
  dokWaehlen: () => $('#dokDatei').click(),
  async dokLoeschen(el) {
    if (!confirm(`Dokument „${el.dataset.titel}“ endgültig löschen?`)) return;
    await fetch('/api/dokumente/' + el.dataset.id, { method: 'DELETE' }); dokListe();
  },
  async dokUmbenennen(el) {
    const titel = prompt('Neuer Titel:', el.dataset.titel); if (!titel) return;
    await fetch('/api/dokumente/' + el.dataset.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel }) }); dokListe();
  },
  vertragDruck() { drucken(vertragHtml(), `Mietvertrag ${D.mieter.name}`); },
  briefDruck() { const bd = briefDaten(); drucken(briefDruckHtml(), `${bd.betreff} ${D.mieter.name}`); },
  briefMail() {
    const bd = briefDaten();
    if (bd.warnungen.length && !confirm('Es gibt noch Hinweise (rot). Trotzdem E-Mail öffnen?')) return;
    mailto(D.mieter.email, bd.betreff, bd.text.join('\n\n'));
  },
  async briefKopieren() {
    const bd = briefDaten();
    try { await navigator.clipboard.writeText(`${bd.betreff}\n\n${bd.text.join('\n\n')}`); status('Text kopiert'); }
    catch { alert('Kopieren nicht möglich. Bitte den Text in der Vorschau markieren und kopieren.'); }
  },
  mieteUebernehmen() {
    const bd = briefDaten();
    if (!confirm(`Hat die ${mieterBez()} zugestimmt? Dann wird die Kaltmiete ab ${datumDE(bd.ab)} auf ${euro(bd.neu)} gesetzt.`)) return;
    D.verlauf.push({ datum: heute(), art: 'kaltmiete', ab: bd.ab, alt: bd.alt, neu: bd.neu, text: `Kaltmiete ab ${datumDE(bd.ab)}: ${euro(bd.alt)} → ${euro(bd.neu)}` });
    D.miete.kalt = bd.neu; D.miete.letzteErhoehung = bd.ab; D.brief.neuKalt = '';
    speichern(); zeige('schreiben'); status('Neue Miete übernommen');
  },
  nkUebernehmen() {
    const bd = briefDaten();
    if (!confirm(`Vorauszahlung ab ${datumDE(bd.ab)} auf ${euro(bd.neuNk)} setzen?`)) return;
    D.verlauf.push({ datum: heute(), art: 'vorauszahlung', ab: bd.ab, alt: bd.altNk, neu: bd.neuNk, text: `Nebenkosten-Vorauszahlung ab ${datumDE(bd.ab)}: ${euro(bd.altNk)} → ${euro(bd.neuNk)}` });
    D.miete.nk = bd.neuNk; D.brief.neuNk = ''; D.brief.abNk = '';
    speichern(); zeige('schreiben'); status('Neue Vorauszahlung übernommen');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-aktion]');
  if (el && AKTIONEN[el.dataset.aktion]) { e.preventDefault(); AKTIONEN[el.dataset.aktion](el); }
});

$('#jsonDatei').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let neu;
  try { neu = JSON.parse(await f.text()); if (!neu || typeof neu !== 'object' || !neu.jahre) throw new Error(); }
  catch { return alert('Die Datei konnte nicht gelesen werden. Ist es eine Sicherung des Nebenkosten-Programms?'); }
  if (D && !confirm('Die Sicherung ersetzt die aktuellen Daten. Fortfahren?')) return;
  const alteVersion = !neu.version;
  D = normalisiere(neu);
  if (alteVersion) {
    // Alte Version kannte keine Mietdaten: aus der letzten Abrechnung übernehmen.
    const jahre = Object.keys(D.jahre).sort();
    D.miete.nk = zahl(D.jahre[jahre[jahre.length - 1]].vorausMonat);
  }
  await speichern(true);
  zeige(alteVersion ? 'stammdaten' : 'uebersicht');
  if (alteVersion) alert('Import fertig. Bitte ergänze unter „Stammdaten“ noch die Kaltmiete, E-Mail-Adressen und den Mietbeginn.');
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
(async () => {
  try { D = await laden(); status(D ? 'Daten geladen' : ''); }
  catch { status('Server nicht erreichbar', true); $('#inhalt').innerHTML = '<div class="card">Der Server antwortet nicht. Läuft der Docker-Container?</div>'; return; }
  zeige(location.hash.slice(1) || 'uebersicht');
})();
