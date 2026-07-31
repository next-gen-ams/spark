/* Export dialog.
 *
 * Two things had to be explicit here, because getting either wrong is a real
 * incident rather than a nuisance:
 *
 *   1. WHICH audience — internal (margin visible) or a client report (margin
 *      never written). The choice is the first thing on the panel, not a menu
 *      item you might mis-click.
 *   2. WHICH client — a client report covers exactly one client. Ticking three
 *      produces three separate files, never one combined workbook, because a
 *      combined one is precisely the file you must never send.
 */

import { el, fill, money, monthLabel, toast } from './dom.js';
import { all } from './store.js';
import { monthsAvailable, buildRows, emptyFilters } from './model.js';
import { totals } from './calc.js';
import { exportWorkbook } from './exportxlsx.js';

let host = null;
const opts = {
  audience: 'internal',
  clients: new Set(),
  from: '', to: '',
  sheets: { summary: true, lines: true, creative: true, spendlog: true },
  includeNonBillable: true,
  platform: '',
};

export function closeExport() { if (host) fill(host); }

export function openExport(state) {
  const months = monthsAvailable();
  if (!months.length) { toast('Nothing to export yet', 'bad'); return; }
  if (!opts.from || !months.includes(opts.from)) opts.from = months[0];
  if (!opts.to || !months.includes(opts.to)) opts.to = months.at(-1);

  if (!host) { host = el('div'); document.body.appendChild(host); }
  draw(state, months);
}

function draw(state, months) {
  const clients = all('client').slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const isClient = opts.audience === 'client';
  const chosen = clients.filter((c) => opts.clients.has(c.id));
  const redraw = () => draw(state, months);

  /* What each file will actually contain, computed live — a count of zero is
     the most common cause of a confusing empty workbook. */
  const preview = (isClient ? (chosen.length ? chosen : []) : [null]).map((c) => {
    const rows = scopedRows(c?.id);
    return { client: c, rows: rows.length, t: totals(rows) };
  });

  const blocked = isClient && !chosen.length;
  const emptyOnes = preview.filter((p) => !p.rows);

  fill(host,
    el('div', { class: 'scrim', onclick: closeExport }),
    el('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Export' },
      el('header', {},
        el('div', { style: { flex: 1 } },
          el('h3', {}, 'Export to Excel'),
          el('p', {}, 'Files are stamped with today’s date, so versions never overwrite each other.')),
        el('button', { class: 'btn ghost', onclick: closeExport, 'aria-label': 'Close' }, '✕')),

      el('div', { class: 'content' },
        audiencePicker(redraw),
        isClient ? clientPicker(clients, redraw) : el('div'),
        rangePicker(months, redraw),
        sheetPicker(isClient, redraw),
        isClient ? el('div') : extras(redraw),
        filePreview(preview, isClient, blocked, emptyOnes)),

      el('footer', {},
        el('button', { class: 'btn ghost', onclick: closeExport }, 'Cancel'),
        el('button', {
          class: 'btn primary',
          disabled: blocked || preview.every((p) => !p.rows),
          onclick: async () => {
            closeExport();
            try {
              for (const p of preview) {
                if (!p.rows) continue;
                await exportWorkbook({
                  audience: opts.audience,
                  client: p.client,
                  rows: scopedRows(p.client?.id),
                  from: opts.from, to: opts.to,
                  sheets: opts.sheets,
                  includeNonBillable: !isClient && opts.includeNonBillable,
                });
              }
            } catch (e) { toast(e.message || String(e), 'bad'); }
          },
        }, downloadLabel(preview, isClient)))));

  const esc = (e) => { if (e.key === 'Escape') { closeExport(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

const downloadLabel = (preview, isClient) => {
  const n = preview.filter((p) => p.rows).length;
  if (!isClient) return 'Download .xlsx';
  return n > 1 ? `Download ${n} files` : 'Download .xlsx';
};

/* ------------------------------------------------------------------ scope */

/** Rows for the export: the whole plan range, not the month on screen. */
function scopedRows(clientId) {
  const f = { ...emptyFilters(), client: clientId || '', platform: opts.platform };
  const out = [];
  for (const ym of monthsAvailable()) {
    if (ym < opts.from || ym > opts.to) continue;
    for (const m of buildRows({ ym, filters: f })) out.push({ ...m, ym });
  }
  return out;
}

/* ----------------------------------------------------------------- pieces */

function audiencePicker(redraw) {
  const card = (id, title, sub, tone) => el('button', {
    class: 'audiencecard' + (opts.audience === id ? ' on' : '') + (tone ? ' ' + tone : ''),
    onclick: () => { opts.audience = id; redraw(); },
  },
  el('b', {}, title), el('span', {}, sub));

  return el('div', { class: 'field' },
    el('label', {}, 'Who is this for'),
    el('div', { class: 'audience' },
      card('internal', 'Internal workbook',
        'Everything — margin, internal media cost, both unit rates, the spend log.'),
      card('client', 'Client report',
        'One client per file. Margin, internal cost and non-billable lines are never written.', 'client')));
}

function clientPicker(clients, redraw) {
  if (!clients.length) return el('div', { class: 'hint' }, 'No clients yet.');
  return el('div', { class: 'field' },
    el('label', {}, `Client — one report per client (${opts.clients.size} selected)`),
    el('div', { class: 'checklist' }, ...clients.map((c) => el('label', {
      class: opts.clients.has(c.id) ? 'on' : '',
    },
    el('input', {
      type: 'checkbox', checked: opts.clients.has(c.id),
      onchange: (e) => {
        if (e.target.checked) opts.clients.add(c.id); else opts.clients.delete(c.id);
        redraw();
      },
    }),
    el('span', {}, c.name)))),
    el('div', { class: 'hint' },
      'Ticking more than one produces separate files — a client report never contains another client’s numbers.'));
}

function rangePicker(months, redraw) {
  const sel = (key) => el('select', {
    onchange: (e) => {
      opts[key] = e.target.value;
      if (opts.from > opts.to) { if (key === 'from') opts.to = opts.from; else opts.from = opts.to; }
      redraw();
    },
  }, ...months.map((m) => el('option', { value: m, selected: opts[key] === m }, monthLabel(m))));

  return el('div', { class: 'row2' },
    el('div', { class: 'field' }, el('label', {}, 'From'), sel('from')),
    el('div', { class: 'field' }, el('label', {}, 'To'), sel('to')));
}

const SHEETS = {
  summary: ['Summary by platform', 'Budget, spend, delivery — one row per platform.'],
  lines: ['Campaign performance', 'One row per media-plan line.'],
  creative: ['Creative breakdown', 'Only written when creatives carry spend.'],
  spendlog: ['Spend log', 'Every daily entry as typed. Internal only.'],
};

function sheetPicker(isClient, redraw) {
  const keys = Object.keys(SHEETS).filter((k) => !(isClient && k === 'spendlog'));
  return el('div', { class: 'field' },
    el('label', {}, 'Sheets'),
    el('div', { class: 'checklist' }, ...keys.map((k) => el('label', {
      class: opts.sheets[k] ? 'on' : '',
    },
    el('input', {
      type: 'checkbox', checked: !!opts.sheets[k],
      onchange: (e) => { opts.sheets[k] = e.target.checked; redraw(); },
    }),
    el('span', {}, el('b', {}, SHEETS[k][0]),
      el('i', {}, SHEETS[k][1]))))));
}

function extras(redraw) {
  const platforms = [...new Set(all('line').map((l) => l.platform).filter(Boolean))].sort();
  return el('div', { class: 'row2' },
    el('div', { class: 'field' },
      el('label', {}, 'Platform'),
      el('select', { onchange: (e) => { opts.platform = e.target.value; redraw(); } },
        el('option', { value: '' }, 'All platforms'),
        ...platforms.map((p) => el('option', { value: p, selected: opts.platform === p }, p)))),
    el('div', { class: 'field' },
      el('label', {}, 'Non-billable lines'),
      el('label', { style: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', textTransform: 'none', letterSpacing: 0, color: 'var(--ink)' } },
        el('input', {
          type: 'checkbox', checked: opts.includeNonBillable, style: { width: 'auto' },
          onchange: (e) => { opts.includeNonBillable = e.target.checked; redraw(); },
        }), 'Include fee & production lines')));
}

function filePreview(preview, isClient, blocked, emptyOnes) {
  if (blocked) {
    return el('div', { class: 'calcbox', style: { borderColor: 'var(--crit)' } },
      el('div', { style: { color: 'var(--crit)', fontWeight: 600 } }, 'Pick at least one client'),
      el('div', { class: 'hint' }, 'A client report is always scoped to one client.'));
  }
  const rows = preview.map((p) => {
    const name = p.client ? p.client.name : 'All clients';
    const side = isClient ? 'client' : 'internal';
    return el('div', { style: { display: 'flex', gap: '10px', padding: '5px 0', borderBottom: '1px dashed var(--line)' } },
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { style: { fontWeight: 600 } }, name),
        el('div', { class: 'muted', style: { fontSize: '11px', wordBreak: 'break-all' } },
          fileName(opts.audience, p.client, opts.from, opts.to))),
      el('div', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
        el('div', {}, `${p.rows} line${p.rows === 1 ? '' : 's'}`),
        el('div', { class: 'muted', style: { fontSize: '11px' } }, money(p.t[side].spend))));
  });

  return el('div', {},
    el('div', { class: 'field' }, el('label', {}, `Files to be created — ${preview.filter((p) => p.rows).length}`)),
    el('div', { class: 'calcbox' }, ...rows,
      emptyOnes.length
        ? el('div', { class: 'hint', style: { color: 'var(--warn)', marginTop: '8px' } },
          `${emptyOnes.length} of these has nothing in the selected months and will be skipped.`)
        : null));
}

/** Shared with the workbook writer so the on-screen preview cannot drift. */
export function fileName(audience, client, from, to) {
  const span = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
  const stamp = new Date().toISOString().slice(0, 10);
  return audience === 'client'
    ? `${client?.name || 'Client'} — Campaign Report — ${span} — ${stamp}.xlsx`
    : `GMS Tracking — INTERNAL — ${span} — ${stamp}.xlsx`;
}
