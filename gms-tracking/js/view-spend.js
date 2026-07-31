/* Spend entry. Three ways in, because nobody is going to click 400 cells:
   type it, paste a column, or round-trip a CSV.

   Storage is always daily rows — the monthly view just writes one row dated
   the last day of the month, so nothing is hidden and nothing double-counts. */

import { el, money, int, monthLabel, toast, download, dateAu } from './dom.js';
import { put, putMany, where, all, byId, fxMap } from './store.js';
import { monthBounds, num, grossUp, perAud } from './calc.js';

const spendId = (lineId, creativeId, date) => `${lineId}|${creativeId || '_'}|${date}`;

export function renderSpend(host, ctx) {
  const { rows, state, rerender } = ctx;

  if (!state.ym) {
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('strong', {}, 'Pick a month first'),
      el('div', {}, 'Spend is entered one period at a time — use the month arrows above.'))));
    return;
  }
  if (!rows.length) {
    host.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('strong', {}, 'No lines in this month'),
      el('div', {}, 'Import a media plan, or clear the filters.'))));
    return;
  }

  const bounds = monthBounds(state.ym);
  const mode = state.spendMode || 'month';
  const date = mode === 'day'
    ? (state.spendDate && state.spendDate.startsWith(state.ym) ? state.spendDate : bounds.end)
    : bounds.end;

  host.appendChild(el('div', { class: 'panel' },
    el('header', {},
      el('div', {},
        el('h3', {}, 'Enter internal spend'),
        el('p', {}, 'Everything else on the dashboard is derived from these numbers.')),
      el('div', { style: { flex: 1 } }),
      el('div', { class: 'seg' },
        el('button', {
          'aria-pressed': mode === 'month',
          onclick: () => { state.spendMode = 'month'; rerender(); },
        }, 'Monthly total'),
        el('button', {
          'aria-pressed': mode === 'day',
          onclick: () => { state.spendMode = 'day'; rerender(); },
        }, 'By day')),
      mode === 'day' ? el('input', {
        type: 'date', class: 'pill-sel', value: date, min: bounds.start, max: bounds.end,
        onchange: (e) => { state.spendDate = e.target.value; rerender(); },
      }) : null,
      el('button', { class: 'btn sm', onclick: () => csvTemplate(rows, state.ym, date) }, 'CSV template'),
      el('label', { class: 'btn sm' }, 'Upload CSV',
        el('input', {
          type: 'file', accept: '.csv,text/csv', style: { display: 'none' },
          onchange: (e) => importCsv(e.target.files[0], rerender),
        }))),
    el('div', { class: 'tablewrap' }, grid(rows, date, mode, state, rerender)),
    el('div', { class: 'body' }, pasteBox(rows, date, rerender))));
}

/* ------------------------------------------------------------------ grid */

function grid(rows, date, mode, state, rerender) {
  const bounds = monthBounds(state.ym);
  const fx = fxMap();

  const body = el('tbody');
  for (const m of rows) {
    const targets = spendTargets(m);
    for (const tgt of targets) {
      const existing = mode === 'month'
        ? monthRows(m.line.id, tgt.creativeId, bounds)
        : [byId('spend', spendId(m.line.id, tgt.creativeId, date))].filter(Boolean);

      const total = existing.reduce((a, s) => a + num(s.spend_internal), 0);
      const impT = existing.reduce((a, s) => a + num(s.imp), 0);
      const clkT = existing.reduce((a, s) => a + num(s.clicks), 0);
      const mixed = mode === 'month' && existing.length > 1;

      const write = (patch) => {
        const id = spendId(m.line.id, tgt.creativeId, date);
        put('spend', {
          id, line_id: m.line.id, creative_id: tgt.creativeId || null, date,
          ...patch,
        });
        rerender();
      };

      body.appendChild(el('tr', {},
        el('td', { class: 'wrap' }, m.clientName,
          el('div', { class: 'muted', style: { fontSize: '11px' } }, m.campaignName)),
        el('td', {}, m.line.platform || '—'),
        el('td', { class: 'wrap' }, tgt.label,
          tgt.creativeId ? el('span', { class: 'tag', style: { marginLeft: '6px' } }, 'creative') : null),
        el('td', {}, m.line.buy_method || '—'),
        el('td', { class: 'num' },
          mixed
            ? el('span', { title: `${existing.length} daily rows — switch to “By day” to edit` },
              money(total, m.ccy, 2))
            : el('input', {
              class: 'cellinput', type: 'number', step: '0.01', value: total || '',
              'data-k': 'spend', placeholder: '0',
              onchange: (e) => write({ spend_internal: Number(e.target.value) || 0 }),
            }),
          el('div', { class: 'muted', style: { fontSize: '11px' } }, m.ccy)),
        el('td', { class: 'num' }, mixed ? int(impT) : el('input', {
          class: 'cellinput', type: 'number', step: '1', value: impT || '', 'data-k': 'imp',
          onchange: (e) => write({ imp: Number(e.target.value) || null }),
        })),
        el('td', { class: 'num' }, mixed ? int(clkT) : el('input', {
          class: 'cellinput', type: 'number', step: '1', value: clkT || '', 'data-k': 'clicks',
          onchange: (e) => write({ clicks: Number(e.target.value) || null }),
        })),
        el('td', { class: 'num muted' }, money(total / perAud(m.ccy, fx, m.campaign))),
        el('td', { class: 'num' }, m.billable
          ? money(grossUp(total / perAud(m.ccy, fx, m.campaign), m.margin))
          : el('span', { class: 'muted' }, 'n/a'))));
    }
  }

  return el('table', { class: 'data' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Client'), el('th', {}, 'Platform'), el('th', {}, 'Line'),
      el('th', {}, 'Buy'),
      el('th', { class: 'num', title: 'Internal spend as paid to the media owner' },
        mode === 'month' ? `Spend · ${monthLabel(state.ym)}` : `Spend · ${dateAu(date)}`),
      el('th', { class: 'num' }, 'Impressions'), el('th', { class: 'num' }, 'Clicks'),
      el('th', { class: 'num' }, 'Internal AUD'), el('th', { class: 'num' }, 'Client AUD'))),
    body);
}

/** A line with creatives is entered per creative; otherwise at line level. */
function spendTargets(m) {
  const crs = where('creative', (c) => c.line_id === m.line.id);
  const label = m.line.placement || m.line.supplier || m.line.objective || 'Line';
  if (!crs.length) return [{ creativeId: null, label }];
  return crs.map((c) => ({ creativeId: c.id, label: c.name || 'Creative' }));
}

const monthRows = (lineId, creativeId, bounds) =>
  where('spend', (s) => s.line_id === lineId
    && (s.creative_id || null) === (creativeId || null)
    && s.date >= bounds.start && s.date <= bounds.end);

/* ----------------------------------------------------------------- paste */

function pasteBox(rows, date, rerender) {
  const ta = el('textarea', {
    rows: 3, placeholder: 'Paste a column of spend here — or spend⇥impressions⇥clicks — one line per row above, top to bottom.',
    style: { width: '100%', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-xs)', padding: '8px' },
  });

  return el('div', {},
    el('div', { class: 'field' }, el('label', {}, 'Paste from the media console')),
    ta,
    el('div', { style: { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' } },
      el('button', {
        class: 'btn primary sm',
        onclick: () => {
          const lines = ta.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (!lines.length) return toast('Nothing pasted', 'bad');
          const targets = rows.flatMap((m) => spendTargets(m).map((t) => ({ m, t })));
          if (lines.length > targets.length) {
            return toast(`${lines.length} pasted rows but only ${targets.length} lines in view`, 'bad');
          }
          const out = lines.map((l, i) => {
            const [sp, imp, clk] = l.split(/[\t,;]/).map((x) => Number(String(x).replace(/[^0-9.\-]/g, '')));
            const { m, t } = targets[i];
            return {
              id: spendId(m.line.id, t.creativeId, date),
              line_id: m.line.id, creative_id: t.creativeId || null, date,
              spend_internal: Number.isFinite(sp) ? sp : 0,
              imp: Number.isFinite(imp) ? imp : null,
              clicks: Number.isFinite(clk) ? clk : null,
            };
          });
          putMany('spend', out);
          ta.value = '';
          toast(`${out.length} rows updated`);
          rerender();
        },
      }, 'Apply to the rows above'),
      el('span', { class: 'muted', style: { fontSize: '11.5px' } },
        `Writes against ${dateAu(date)} · order must match the table.`)));
}

/* ------------------------------------------------------------------- csv */

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csvTemplate(rows, ym, date) {
  const head = ['line_id', 'creative_id', 'client', 'campaign', 'platform', 'line',
    'currency', 'date', 'spend_internal', 'imp', 'clicks'];
  const out = [head.join(',')];
  for (const m of rows) {
    for (const t of spendTargets(m)) {
      out.push([m.line.id, t.creativeId || '', m.clientName, m.campaignName,
        m.line.platform, t.label, m.ccy, date, '', '', ''].map(esc).join(','));
    }
  }
  download(`spend-template-${ym}.csv`, new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8' }));
}

async function importCsv(file, rerender) {
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return toast('CSV looks empty', 'bad');

  const head = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  const iLine = col('line_id'), iDate = col('date'), iSpend = col('spend_internal');
  if (iLine < 0 || iDate < 0 || iSpend < 0) {
    return toast('CSV needs at least line_id, date and spend_internal columns', 'bad');
  }
  const iCr = col('creative_id'), iImp = col('imp'), iClk = col('clicks');
  const known = new Set(all('line').map((l) => l.id));

  const out = []; let skipped = 0;
  for (const raw of lines.slice(1)) {
    const c = splitCsv(raw);
    const lineId = (c[iLine] || '').trim();
    const date = (c[iDate] || '').trim();
    if (!known.has(lineId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }
    const crId = iCr >= 0 ? (c[iCr] || '').trim() || null : null;
    out.push({
      id: spendId(lineId, crId, date), line_id: lineId, creative_id: crId, date,
      spend_internal: Number(c[iSpend]) || 0,
      imp: iImp >= 0 && c[iImp] !== '' ? Number(c[iImp]) : null,
      clicks: iClk >= 0 && c[iClk] !== '' ? Number(c[iClk]) : null,
    });
  }
  if (!out.length) return toast('No rows matched a known line_id', 'bad');
  putMany('spend', out);
  toast(`${out.length} spend rows imported${skipped ? ` · ${skipped} skipped` : ''}`);
  rerender();
}

function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
