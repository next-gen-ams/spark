/* Media plan import — upload, review, then commit.

   Nothing is written until the user presses Import, and every row the parser
   chose to skip is shown with the reason. Silent imports are how bad numbers
   get into a client report. */

import { el, money, pct, int, dateAu, toast, monthLabel } from './dom.js';
import { parseWorkbook, commit, reparse } from './mediaplan.js';
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

  const blocked = sheet.missing.length > 0;
  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, 'Column mapping'),
        el('p', {}, blocked
          ? 'Point at the missing columns before importing — the sample values on the right tell you which is which.'
          : 'Every field found. Check anything marked “Inferred”, then import.')),
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
      el('ul', { class: 'warnlist', style: { marginTop: '14px' } },
        el('li', { class: 'ok' }, 'Subtotal, Total and Baidu-style breakdown / top-up rows are detected and skipped so money is not counted twice.'),
        el('li', { class: 'ok' }, 'Monthly booking columns are verified against each line’s own totals before they are trusted.'),
        el('li', {}, 'Production (BONUS) and GMS Internal lines are imported as non-billable — visible, but excluded from pacing and the client report.'))));
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

  const item = (k, v) => el('div', {},
    el('div', { class: 'k', style: { fontSize: '10.5px', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 620 } }, k),
    el('div', { style: { fontWeight: 600, marginTop: '2px' } }, v || '—'));

  return el('div', { class: 'panel' },
    el('header', {}, el('div', {},
      el('h3', {}, c.name || 'Untitled campaign'),
      el('p', {}, `${parsed.fileName} · sheet “${s.sheet}”`))),
    el('div', { class: 'body' },
      el('div', { style: { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' } },
        item('Advertiser', c.advertiser),
        item('IO number', c.io_number),
        item('Flight', c.start_date ? `${dateAu(c.start_date)} – ${dateAu(c.end_date)}` : null),
        item('Exchange rate', c.fx_rate ? `1 AUD = ${c.fx_rate} ${c.fx_ccy || ''}` : null),
        item('Account', c.am),
        item('Version', c.version)),
      el('div', { style: { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)' } },
        item('Billable lines', int(bill.length)),
        item('Net media cost', money(totMedia)),
        item('Net GMS cost', money(totGms)),
        item('Blended margin', totGms > 0 ? pct(1 - totMedia / totGms, 1) : '—')),
      s.warnings.length
        ? el('ul', { class: 'warnlist', style: { marginTop: '16px' } },
          ...s.warnings.map((w) => el('li', {}, w)))
        : el('ul', { class: 'warnlist', style: { marginTop: '16px' } },
          el('li', { class: 'ok' }, 'Parsed cleanly — monthly budgets add back up to the line totals.'))));
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
          el('div', { class: 'hint' }, 'China buys are topped up in CNY; the plan itself is quoted in AUD. This only affects how spend is typed — every derived figure is AUD.')))));
}

function rowTable(s, rerender) {
  const body = el('tbody');
  let group = '';
  for (const r of s.rows) {
    if (r.objective && r.objective !== group) {
      group = r.objective;
      body.appendChild(el('tr', { class: 'grp' }, el('td', { colspan: 10 }, group)));
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
      el('td', { class: 'num' }, int(r.booked_units)),
      el('td', { class: 'num' }, money(r.cost_media)),
      el('td', { class: 'num' }, money(r.cost_gms)),
      el('td', { class: 'num' }, r.margin_pct == null
        ? el('span', { class: 'muted' }, '—') : pct(r.margin_pct, 1)),
      el('td', { class: 'num' }, money(mMedia)),
      el('td', {}, r.months.length
        ? el('span', { class: 'muted', style: { fontSize: '11px' } },
          `${monthLabel(r.months[0].ym).split(' ')[0]}–${monthLabel(r.months.at(-1).ym).split(' ')[0]}`)
        : el('span', { class: 'muted' }, '—'))));
  }

  const on = s.rows.filter((r) => r.include).length;
  return el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, `Lines to import — ${on} of ${s.rows.length} ticked`),
        el('p', {}, 'Untick anything you do not want tracked. Greyed rows are non-billable.'))),
    el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {},
        el('th', {}, ''), el('th', {}, 'Platform'), el('th', {}, 'Line'), el('th', {}, 'Buy'),
        el('th', { class: 'num' }, 'Booked units'),
        el('th', { class: 'num' }, 'Net media'), el('th', { class: 'num' }, 'Net GMS'),
        el('th', { class: 'num' }, 'Margin'), el('th', { class: 'num' }, 'Monthly Σ'),
        el('th', {}, 'Months'))),
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
          if (!all('fx').some((f) => f.ccy === ccy)) put('fx', { id: ccy, ccy, per_aud: rate });
        }
        const res = commit(s, { clientId, spendCcy: target.spendCcy });
        parsed = null;
        toast(`Imported ${res.lines} lines and ${res.months} monthly budgets`);
        ctx.goTo('tracking');
      },
    }, `Import ${ticked} line${ticked === 1 ? '' : 's'}`));
}
