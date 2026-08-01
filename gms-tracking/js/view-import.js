/* Media plan import — upload, review, then commit.

   Nothing is written until the user presses Import, and every row the parser
   chose to skip is shown with the reason. Silent imports are how bad numbers
   get into a client report. */

import { el, money, pct, int, dateAu, toast, monthLabel } from './dom.js';
import { parseWorkbook, commit, reparse, WARN_NO_FLIGHT_DATES } from './mediaplan.js';
import { FIELDS, FIELD, colLetter } from './mediaplan-columns.js';
import { all, put, newId, fxMap } from './store.js';
import { facets } from './model.js';

let parsed = null;      // { fileName, sheets: [...] }
let picked = 0;
let target = { clientId: '', newClient: '', spendCcy: 'CNY' };
let showAllFields = false;

export function renderImport(host, ctx) {
  const { rerender } = ctx;
  if (!parsed) { host.appendChild(dropZone(rerender)); return; }

  const sheet = parsed.sheets[picked];
  host.appendChild(sheetPicker(rerender));
  host.appendChild(planSummary(sheet));
  host.appendChild(fillGaps(sheet, rerender));
  host.appendChild(mappingPanel(sheet, rerender));
  host.appendChild(destination(sheet, rerender));
  host.appendChild(rowTable(sheet, rerender));
  host.appendChild(actions(sheet, ctx));
}

/* --------------------------------------------------------------- mapping */

const SOURCE = {
  remembered: ['Remembered', 'good', 'This team mapped a column with this header before.'],
  header: ['From header', 'good', 'The column header matched a known name.'],
  inferred: ['Inferred', 'warn', 'The header was not recognised — this was worked out from the data itself.'],
  manual: ['You set this', '', 'Pinned by hand.'],
};

/**
 * Layer 2 of the import triage: show what each field resolved to, how, and let
 * the user re-point anything that went wrong. Layer 4 lives here too — a
 * required field with no column blocks the import outright.
 */
function mappingPanel(sheet, rerender) {
  const needsEye = FIELDS.filter((f) =>
    (f.required && !sheet.mapping[f.key]) || sheet.mapping[f.key]?.source === 'inferred');
  const blocked = sheet.missing.length > 0;

  /* When every field came straight off a recognised header there is nothing
     to decide, so this collapses to a single green line. Column mapping is
     plumbing; it should only surface when the plumbing needs you. */
  if (!blocked && !needsEye.length && !showAllFields) {
    return el('div', { class: 'panel' }, el('div', { class: 'body okrow' },
      el('span', { class: 'tag good' }, '✓'),
      el('div', { style: { flex: 1 } },
        el('b', {}, 'All columns recognised'),
        el('div', { class: 'muted', style: { fontSize: '11.5px' } },
          `${Object.keys(sheet.mapping).length} fields matched from this plan’s own headers.`)),
      el('button', { class: 'btn sm', onclick: () => { showAllFields = true; rerender(); } },
        'Check them')));
  }

  const shownFields = showAllFields
    ? FIELDS
    : FIELDS.filter((f) => f.required || f.derivable || !sheet.cols[f.key]
      || sheet.mapping[f.key]?.source !== 'header');

  const repoint = (key, col) => {
    const overrides = { ...sheet.overrides, [key]: col };
    const next = reparse(sheet, overrides);
    /* Keep whatever the user has already ticked or unticked. */
    const was = new Map(sheet.rows.map((r) => [r.excelRow, r.include]));
    for (const r of next.rows) if (was.has(r.excelRow)) r.include = was.get(r.excelRow);
    parsed.sheets[picked] = next;
    rerender();
  };

  const row = (f) => {
    const m = sheet.mapping[f.key];
    const p = m && sheet.profiles.find((x) => x.col === m.col);
    const bad = f.required && !m;
    const [label, kind, tip] = m ? (SOURCE[m.source] || ['Set', '', '']) : ['Not found', 'crit', ''];

    return el('tr', { class: bad ? 'nb' : '' },
      el('td', {},
        el('div', { style: { fontWeight: 600, color: bad ? 'var(--crit)' : 'inherit' } },
          f.label, f.required ? el('span', { style: { color: 'var(--crit)' } }, ' *') : null),
        f.help ? el('div', { class: 'muted', style: { fontSize: '11px' } }, f.help) : null),
      el('td', {}, el('span', { class: 'tag ' + kind, title: m?.why || tip }, label)),
      el('td', { class: 'wrap' },
        el('select', {
          class: 'pill-sel', style: { maxWidth: '100%', width: '100%' },
          onchange: (e) => repoint(f.key, e.target.value),
        },
        el('option', { value: '', selected: !m }, '— not in this plan —'),
        ...sheet.profiles.map((x) => el('option', {
          value: x.col, selected: m?.col === x.col,
        }, `${colLetter(x.col)}  ${x.header || '(no header)'}`)))),
      el('td', { class: 'wrap muted', style: { fontSize: '11px' } },
        p ? (p.samples.join(' · ') || '—') : '—'));
  };

  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, blocked
          ? `${sheet.missing.length === 1 ? 'A required column needs' : `${sheet.missing.length} required columns need`} pointing at`
          : 'Check these columns'),
        el('p', {}, blocked
          ? 'This plan uses wording we have not seen. The sample values on the right tell you which column is which — pick them and the rest follows.'
          : 'These were worked out from the numbers rather than the headers. Worth a glance before importing.')),
      el('div', { style: { flex: 1 } }),
      el('button', {
        class: 'btn sm',
        onclick: () => { showAllFields = !showAllFields; rerender(); },
      }, showAllFields ? 'Show only what needs attention' : `Show all ${FIELDS.length} fields`)),
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Field'), el('th', {}, 'How it was found'),
        el('th', { style: { minWidth: '220px' } }, 'Column in this plan'),
        el('th', {}, 'First values'))),
      el('tbody', {}, ...shownFields.map(row)))));
}

/* ------------------------------------------------------------------ drop */

function dropZone(rerender) {
  const input = el('input', {
    type: 'file', accept: '.xlsx,.xlsm', style: { display: 'none' },
    onchange: (e) => load(e.target.files[0], rerender),
  });
  const zone = el('div', { class: 'drop' },
    el('strong', {}, 'Drop a media plan here'),
    el('div', {}, 'GMS QUOTATION / IO workbook (.xlsx) — the INT_ version, so margin comes across.'),
    el('div', { style: { marginTop: '14px' } },
      el('button', { class: 'btn primary', onclick: () => input.click() }, 'Choose file'), input));

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('over');
    load(e.dataTransfer.files[0], rerender);
  });

  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, 'Import a media plan'),
        el('p', {}, 'Lines, monthly budgets, booked rates and margin are read straight off the plan.'))),
    el('div', { class: 'body' }, zone,
      el('div', { class: 'hint', style: { marginTop: '14px', textAlign: 'center' } },
        'Nothing is saved until you press Import. Subtotal rows, top-up rows and fee lines are '
        + 'handled for you — you will see exactly what was skipped and why.')));
}

async function load(file, rerender) {
  if (!file) return;
  try {
    await window.__loadExcel();
    const res = await parseWorkbook(await file.arrayBuffer(), file.name);
    if (!res.ok) { toast(res.error, 'bad'); return; }
    res.sheets.sort((a, b) => b.quality - a.quality);
    parsed = res;
    picked = 0;
    const f = facets();
    const guess = f.clients.find((c) => (res.sheets[0].campaign.advertiser || '')
      .toLowerCase().includes((c.name || '').toLowerCase()));
    target = { clientId: guess?.id || '', newClient: '', spendCcy: res.sheets[0].campaign.fx_ccy || 'CNY' };
    rerender();
  } catch (e) {
    toast('Could not read that workbook: ' + (e.message || e), 'bad');
  }
}

/* --------------------------------------------------------------- preview */

function sheetPicker(rerender) {
  if (parsed.sheets.length < 2) return el('div');
  return el('div', { class: 'panel' },
    el('header', {}, el('div', {},
      el('h3', {}, `${parsed.sheets.length} plan sheets in this workbook`),
      el('p', {}, 'The best-reconciling sheet is pre-selected. Older or partial versions usually fail the check.'))),
    el('div', { class: 'body sheetpick' }, ...parsed.sheets.map((s, i) =>
      el('button', {
        'aria-pressed': i === picked,
        onclick: () => { picked = i; rerender(); },
      },
      el('b', {}, s.sheet),
      el('span', {}, `${s.rows.filter((r) => r.include).length} lines · `,
        el('span', { style: { color: s.recon.ok ? 'var(--good)' : 'var(--crit)' } },
          s.recon.ok ? 'totals reconcile' : 'totals do not match'))))));
}

function planSummary(s) {
  const c = s.campaign;
  const inc = s.rows.filter((r) => r.include);
  const bill = inc.filter((r) => r.billable);
  const totMedia = bill.reduce((a, r) => a + (r.cost_media || 0), 0);
  const totGms = bill.reduce((a, r) => a + (r.cost_gms || 0), 0);

  /* A warning that has since been answered by hand is worse than no warning —
     it sits directly above the panel that answered it and contradicts it. */
  const live = s.warnings.filter((w) =>
    !(w === WARN_NO_FLIGHT_DATES && c.start_date && c.end_date));

  const item = (k, v) => el('div', {},
    el('div', { class: 'k', style: { fontSize: '10.5px', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 620 } }, k),
    el('div', { style: { fontWeight: 600, marginTop: '2px' } }, v || '—'));

  return el('div', { class: 'panel' },
    el('header', {}, el('div', {},
      el('h3', {}, c.name || 'Untitled campaign'),
      el('p', {}, `${parsed.fileName}${parsed.sheets.length > 1 ? ` · sheet “${s.sheet}”` : ''}`))),
    el('div', { class: 'body' },
      el('div', { style: { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' } },
        item('Advertiser', c.advertiser),
        item('IO number', c.io_number),
        item('Flight', c.start_date ? `${dateAu(c.start_date)} – ${dateAu(c.end_date)}` : null),
        item('Exchange rate', c.fx_rate ? `1 AUD = ${c.fx_rate} ${c.fx_ccy || ''}` : null),
        /* Name over address: a plan often writes a short form of the name while
           the address spells it out in full, and only the pair makes it obvious
           they are the same colleague. */
        item('Account', c.am
          ? el('span', {}, c.am, c.am_email
            ? el('div', {
              class: 'muted',
              style: { fontSize: '11px', fontWeight: 400, wordBreak: 'break-all' },
            }, c.am_email)
            : null)
          : null),
        item('Version', c.version)),
      el('div', { style: { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)' } },
        item('Billable lines', int(bill.length)),
        item('Net media cost', money(totMedia)),
        item('Net GMS cost', money(totGms)),
        item('Blended margin', totGms > 0 ? pct(1 - totMedia / totGms, 1) : '—')),
      live.length
        ? el('ul', { class: 'warnlist', style: { marginTop: '16px' } },
          ...live.map((w) => el('li', {}, w)))
        : el('ul', { class: 'warnlist', style: { marginTop: '16px' } },
          el('li', { class: 'ok' }, 'Parsed cleanly — monthly budgets add back up to the line totals.'))));
}

/* ------------------------------------------------------------- fill gaps */

/**
 * What the plan did not say, filled in by hand before anything is written.
 *
 * These used to be warnings and nothing else: the panel told you the flight
 * dates were missing and then imported the campaign anyway with the months
 * standing in for a flight. A campaign whose real dates are known to the person
 * doing the import is not a campaign that should be stored without them —
 * pacing, "days left" and every repace figure are computed off this flight.
 *
 * Only the fields the plan actually left blank appear; a plan that carries all
 * of them shows nothing at all.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fillGaps(s, rerender) {
  const c = s.campaign;
  const span = planSpan(s);
  const foreign = [...new Set(s.rows
    .filter((r) => r.include && r.plan_ccy && r.plan_ccy !== 'AUD')
    .map((r) => r.plan_ccy))];

  const needDates = !c.start_date || !c.end_date;
  /* A rate is worth confirming whenever the plan quotes in something other than
     AUD, even if the IO header did carry one — the header rate and the currency
     the lines are quoted in do not always agree. */
  const needFx = !c.fx_rate || foreign.length > 0;
  /* Not just a blank name: one of the reference plans carries a contact address
     with a space where a dot belongs — a typo in the workbook itself. It is the
     only contact stored against the campaign, so it is worth catching at the
     door rather than discovering it months later. */
  const needAm = !c.am || (c.am_email && !EMAIL.test(c.am_email));
  if (!needDates && !needFx && !needAm) return el('div');

  const rates = fxMap();
  const set = (patch) => { Object.assign(c, patch); rerender(); };

  const fields = [];

  if (needDates) {
    fields.push(field('Flight starts', el('input', {
      type: 'date', value: c.start_date || '',
      onchange: (e) => set({ start_date: e.target.value || null }),
    }), span ? `Plan months run ${dateAu(span.start)} – ${dateAu(span.end)}.` : ''));

    fields.push(field('Flight ends', el('input', {
      type: 'date', value: c.end_date || '',
      onchange: (e) => set({ end_date: e.target.value || null }),
    }), 'Pacing, “days left” and every suggested daily figure are measured against this.'));
  }

  if (needFx) {
    const ccy = c.fx_ccy || foreign[0] || 'CNY';
    fields.push(field('Exchange rate', el('div', { class: 'fxpair' },
      el('select', {
        onchange: (e) => set({ fx_ccy: e.target.value }),
      /* AUD is the base of every rate in this app, so "1 AUD = n AUD" is not a
         choice worth offering. */
      }, ...[...new Set([...foreign, ...Object.keys(rates)])].filter((k) => k !== 'AUD')
        .map((k) => el('option', { value: k, selected: k === ccy }, k))),
      el('input', {
        type: 'number', step: '0.0001', min: '0',
        placeholder: String(rates[ccy] ?? ''),
        value: c.fx_rate ?? '',
        onchange: (e) => set({
          fx_rate: e.target.value === '' ? null : Number(e.target.value),
          fx_ccy: c.fx_ccy || ccy,
        }),
      })),
    `1 AUD = this many ${ccy}. ${foreign.length
      ? `This plan quotes rows in ${foreign.join(' and ')}. `
      : ''}Left blank, the campaign falls back to the rate in Settings`
      + `${rates[ccy] ? ` (currently ${rates[ccy]})` : ''}.`));
  }

  if (needAm) {
    const badEmail = c.am_email && !EMAIL.test(c.am_email);
    fields.push(field('Account management', el('input', {
      type: 'text', placeholder: 'Who runs this account',
      value: c.am || '',
      onchange: (e) => set({ am: e.target.value.trim() }),
    }), 'Read off the IO header when the plan fills it in.'));

    fields.push(field('Contact email', el('input', {
      type: 'text', placeholder: 'name@gms.global',
      value: c.am_email || '',
      onchange: (e) => set({ am_email: e.target.value.trim() }),
    }), badEmail
      ? 'The address on the plan is not a valid one — worth fixing here and in the workbook.'
      : 'The only contact stored against this campaign.'));
  }

  return el('div', { class: 'panel' },
    el('header', {}, el('div', {},
      el('h3', {}, 'Fill in what the plan left out'),
      el('p', {}, 'These are saved with the campaign when you import. '
        + 'Anything left blank keeps the fallback described under it.'))),
    el('div', { class: 'body gapgrid' }, ...fields));
}

function field(label, control, hint) {
  return el('div', { class: 'field' },
    el('label', {}, label), control,
    hint ? el('div', { class: 'hint' }, hint) : null);
}

/** Earliest and latest month the plan actually books, as real dates. */
function planSpan(s) {
  const yms = s.rows.filter((r) => r.include).flatMap((r) => r.months.map((m) => m.ym)).sort();
  if (!yms.length) return null;
  const [ly, lm] = yms.at(-1).split('-').map(Number);
  return { start: `${yms[0]}-01`, end: `${yms.at(-1)}-${String(new Date(ly, lm, 0).getDate())}` };
}

function destination(s, rerender) {
  const f = facets();
  const ccys = Object.keys(fxMap());
  return el('div', { class: 'panel' },
    el('header', {}, el('div', {},
      el('h3', {}, 'Where this lands'),
      el('p', {}, 'Pick the client, and the currency your team will actually type spend in.'))),
    el('div', { class: 'body' },
      el('div', { class: 'row2' },
        el('div', { class: 'field' },
          el('label', {}, 'Client'),
          el('select', { onchange: (e) => { target.clientId = e.target.value; rerender(); } },
            el('option', { value: '' }, '— new client —'),
            ...f.clients.map((c) => el('option', { value: c.id, selected: c.id === target.clientId }, c.name))),
          target.clientId ? null : el('input', {
            placeholder: 'New client name',
            style: { marginTop: '7px' },
            value: target.newClient || s.campaign.advertiser || '',
            onchange: (e) => { target.newClient = e.target.value; },
          })),
        el('div', { class: 'field' },
          el('label', {}, 'Spend entry currency'),
          el('select', { onchange: (e) => { target.spendCcy = e.target.value; } },
            ...ccys.map((c) => el('option', { value: c, selected: c === target.spendCcy }, c))),
          /* Since v3 the currency is decided per line (China platforms → RMB,
             international-rep buys → AUD); this select is only the fallback,
             and the copy has to say so or it reads as though it overrides. */
          el('div', { class: 'hint' }, 'Fallback only. Lines decide for themselves — a China platform is typed in RMB, an international rep buy in AUD — and this covers lines with neither signal. Every derived figure is AUD.')))));
}

function rowTable(s, rerender) {
  const body = el('tbody');
  let group = '';
  for (const r of s.rows) {
    if (r.objective && r.objective !== group) {
      group = r.objective;
      body.appendChild(el('tr', { class: 'grp' }, el('td', { colspan: 8 }, group)));
    }
    const mMedia = r.months.reduce((a, m) => a + (m.budget_media || 0), 0);
    body.appendChild(el('tr', { class: r.billable ? '' : 'nb' },
      el('td', {}, el('input', {
        type: 'checkbox', checked: r.include,
        onchange: (e) => { r.include = e.target.checked; rerender(); },
      })),
      el('td', {}, r.platform || el('span', { class: 'muted' }, '—')),
      el('td', { class: 'wrap' }, r.placement || r.category,
        r.reason ? el('div', { class: 'muted', style: { fontSize: '11px' } }, r.reason) : null),
      el('td', {}, r.buy_method || '—'),
      el('td', { class: 'num' }, money(r.cost_media)),
      el('td', { class: 'num' }, money(r.cost_gms)),
      el('td', { class: 'num' }, r.margin_pct == null
        ? el('span', { class: 'muted' }, '—') : pct(r.margin_pct, 1)),
      el('td', {}, r.months.length
        ? el('span', { class: 'muted', style: { fontSize: '11px' } },
          `${monthLabel(r.months[0].ym).split(' ')[0]}–${monthLabel(r.months.at(-1).ym).split(' ')[0]}`)
        : el('span', { class: 'muted' }, '—'))));
  }

  const on = s.rows.filter((r) => r.include).length;
  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, `${on} lines will be imported`),
        el('p', {}, s.rows.length > on
          ? `${s.rows.length - on} row${s.rows.length - on > 1 ? 's were' : ' was'} skipped — the reason is on each one. Untick anything else you do not want.`
          : 'Untick anything you do not want tracked. Greyed rows are fee or production lines: tracked, but kept out of pacing and the client report.'))),
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {},
        el('th', {}, ''), el('th', {}, 'Platform'), el('th', {}, 'Line'), el('th', {}, 'Buy'),
        el('th', { class: 'num' }, 'Net media'), el('th', { class: 'num' }, 'Net GMS'),
        el('th', { class: 'num' }, 'Margin'), el('th', {}, 'Months'))),
      body)));
}

function actions(s, ctx) {
  const blocked = s.missing.length > 0;
  const ticked = s.rows.filter((r) => r.include).length;
  return el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '30px' } },
    blocked
      ? el('span', { class: 'tag crit' },
        `Missing: ${s.missing.map((k) => FIELD[k].label).join(', ')}`)
      : null,
    !blocked && !ticked ? el('span', { class: 'tag warn' }, 'No lines ticked') : null,
    el('button', { class: 'btn', onclick: () => { parsed = null; ctx.rerender(); } }, 'Cancel'),
    el('button', {
      class: 'btn primary',
      disabled: blocked || !ticked,
      title: blocked
        ? 'Map the required columns first — importing half a plan puts wrong numbers in front of a client.'
        : '',
      onclick: () => {
        if (s.missing.length) return;
        let clientId = target.clientId;
        if (!clientId) {
          const name = (target.newClient || s.campaign.advertiser || '').trim();
          if (!name) { toast('Give the client a name first', 'bad'); return; }
          const existing = all('client').find((c) => (c.name || '').toLowerCase() === name.toLowerCase());
          clientId = existing?.id || newId('cl');
          if (!existing) put('client', { id: clientId, name, active: true });
        }
        /* Carry any FX rates the plan carried into the app's own FX table. */
        for (const [ccy, rate] of Object.entries(s.fxTable || {})) {
          if (!all('fx').some((f) => f.ccy === ccy)) put('fx', { ccy, per_aud: rate });
        }
        const res = commit(s, { clientId, spendCcy: target.spendCcy });
        parsed = null;
        /* This toast is the only receipt the import leaves — hold it long
           enough to actually read the numbers. */
        toast(`Imported “${s.campaign.name || 'campaign'}” — ${res.lines} lines, ${res.months} monthly budgets`,
          'ok', 8000);
        ctx.goTo('tracking');
      },
    }, `Import ${ticked} line${ticked === 1 ? '' : 's'}`));
}
