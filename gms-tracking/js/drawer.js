/* Line drawer — edit a media-plan line, see exactly how its client-facing
   number was derived, and manage its creatives. */

import { el, fill, money, money2, int, pct, dateAu, monthLabel, toast, selectOrNew } from './dom.js';
import { put, remove, where, newId, vocab, addVocab, fxMap } from './store.js';
import { grossUp, num, perAud } from './calc.js';

let host = null;

function mount() {
  if (host) return host;
  host = el('div');
  document.body.appendChild(host);
  return host;
}

export function closeDrawer() { if (host) fill(host); }

export function openLine(m, rerender) {
  const line = { ...m.line };
  const h = fill(mount());
  const refresh = () => { rerender(); openLine({ ...m, line: { ...line } }, rerender); };

  const save = (patch) => {
    Object.assign(line, patch);
    put('line', { id: line.id, ...patch });
    rerender();
  };

  h.appendChild(el('div', { class: 'scrim', onclick: closeDrawer }));
  h.appendChild(el('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Line item' },
    el('header', {},
      el('div', { style: { flex: 1 } },
        el('h3', {}, line.platform || 'Line item',
          line.placement ? el('span', { class: 'muted' }, ' · ' + line.placement) : null),
        el('p', {}, `${m.clientName} — ${m.campaignName}`,
          m.campaign.io_number ? ` · ${m.campaign.io_number}` : '')),
      el('button', { class: 'btn ghost', onclick: closeDrawer, 'aria-label': 'Close' }, '✕')),

    el('div', { class: 'content' },
      derivation(m),
      identity(line, save),
      commercials(line, save, m),
      monthly(m),
      creatives(line, refresh),
      el('div', { class: 'field' },
        el('label', {}, 'Note'),
        el('textarea', {
          rows: 3, value: line.note || '',
          onchange: (e) => save({ note: e.target.value }),
        }))),

    el('footer', {},
      el('button', { class: 'btn ghost', onclick: () => {
        if (!confirm('Delete this line and all of its spend and creatives?')) return;
        remove('line', line.id);
        for (const s of where('spend', (x) => x.line_id === line.id)) remove('spend', s.id);
        for (const c of where('creative', (x) => x.line_id === line.id)) remove('creative', c.id);
        for (const mm of where('line_month', (x) => x.line_id === line.id)) remove('line_month', mm.id);
        closeDrawer(); rerender(); toast('Line deleted');
      } }, 'Delete line'),
      el('button', { class: 'btn primary', onclick: closeDrawer }, 'Done'))));

  const esc = (e) => { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

/* ------------------------------------------------------------ derivation */

/** The whole point of the dashboard, spelled out so nobody has to trust it. */
function derivation(m) {
  const rows = [
    ['Internal spend', money2(m.spendCcy, m.ccy)],
    [`÷ FX (1 AUD = ${m.rate} ${m.ccy})`, money2(m.spendInternal)],
    [`÷ (1 − margin ${pct(m.margin, 1)})`, money2(m.clientProrata)],
  ];
  if (m.budgetClient > 0) {
    rows.push(['Capped at booked budget', money2(m.spendClient)]);
    if (m.overspend > 0.5) rows.push(['Over booked budget', money2(m.overspend)]);
  }
  rows.push(['Margin realised', m.effMargin == null ? '—' : pct(m.effMargin, 1)]);

  return el('div', {},
    el('div', { class: 'field' }, el('label', {}, 'How the client number is derived')),
    el('div', { class: 'calcbox' },
      el('dl', {}, ...rows.flatMap(([k, v]) => [
        el('dt', {}, k),
        el('dd', { style: /Over/.test(k) ? { color: 'var(--crit)' } : {} }, v),
      ])),
      el('div', { class: 'formula' },
        'client = internal ÷ FX ÷ (1 − margin)'),
      !m.billable
        ? el('div', { class: 'hint', style: { marginTop: '8px', color: 'var(--ink-3)' } },
          'Non-billable line — excluded from pacing, cost efficiency and the client export.')
        : null));
}

/* --------------------------------------------------------------- fields */

function identity(line, save) {
  const pick = (kind, key) => selectOrNew(line[key] || '', vocab(kind), (v) => {
    addVocab(kind, v); save({ [key]: v });
  }, { cls: '' });

  return el('div', {},
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Platform'), pick('platform', 'platform')),
      el('div', { class: 'field' }, el('label', {}, 'Objective'), pick('objective', 'objective'))),
    el('div', { class: 'row3' },
      el('div', { class: 'field' }, el('label', {}, 'Buy method'), pick('buy_method', 'buy_method')),
      el('div', { class: 'field' }, el('label', {}, 'Status'), pick('status', 'status')),
      el('div', { class: 'field' }, el('label', {}, 'Market'),
        el('input', { value: line.market || '', onchange: (e) => save({ market: e.target.value }) }))),
    el('div', { class: 'row2' },
      el('div', { class: 'field' }, el('label', {}, 'Campaign / placement'),
        el('input', { value: line.placement || '', onchange: (e) => save({ placement: e.target.value }) })),
      el('div', { class: 'field' }, el('label', {}, 'Supplier'),
        el('input', { value: line.supplier || '', onchange: (e) => save({ supplier: e.target.value }) }))));
}

function commercials(line, save, m) {
  const fx = fxMap();
  const ccys = Object.keys(fx);
  return el('div', {},
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Spend currency'),
        el('select', { onchange: (e) => save({ currency: e.target.value }) },
          ...ccys.map((c) => el('option', { value: c, selected: c === (line.currency || 'AUD') }, c))),
        el('div', { class: 'hint' }, `1 AUD = ${perAud(line.currency || 'AUD', fx, m.campaign)}`)),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — media'),
        el('input', {
          type: 'number', step: '0.01', value: line.rate_media ?? '',
          onchange: (e) => save({ rate_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Booked rate — GMS'),
        el('input', {
          type: 'number', step: '0.01', value: line.rate_gms ?? '',
          onchange: (e) => save({ rate_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }))),
    el('div', { class: 'row3' },
      el('div', { class: 'field' },
        el('label', {}, 'Margin %'),
        el('input', {
          type: 'number', step: '0.1', value: line.margin_pct == null ? '' : (line.margin_pct * 100).toFixed(2),
          onchange: (e) => save({ margin_pct: e.target.value === '' ? null : Number(e.target.value) / 100 }),
        }),
        el('div', { class: 'hint' }, 'Pulled from the media plan. Changing it changes every client-facing number on this line.')),
      el('div', { class: 'field' },
        el('label', {}, 'Net media cost (AUD)'),
        el('input', {
          type: 'number', step: '1', value: line.cost_media ?? '',
          onchange: (e) => save({ cost_media: e.target.value === '' ? null : Number(e.target.value) }),
        })),
      el('div', { class: 'field' },
        el('label', {}, 'Net GMS cost (AUD)'),
        el('input', {
          type: 'number', step: '1', value: line.cost_gms ?? '',
          onchange: (e) => save({ cost_gms: e.target.value === '' ? null : Number(e.target.value) }),
        }),
        el('div', { class: 'hint' }, line.cost_media != null && line.margin_pct
          ? `at margin: ${money(grossUp(line.cost_media, line.margin_pct))}` : ''))),
    el('div', { class: 'field' },
      el('label', {},
        el('input', {
          type: 'checkbox', checked: line.billable !== false, style: { width: 'auto', marginRight: '7px' },
          onchange: (e) => save({ billable: e.target.checked }),
        }), 'Billable — include in pacing, cost efficiency and the client report')));
}

function monthly(m) {
  const rows = where('line_month', (x) => x.line_id === m.line.id)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  if (!rows.length) return el('div');
  return el('div', { class: 'field' },
    el('label', {}, 'Booked by month — from the media plan'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'data' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Month'), el('th', { class: 'num' }, 'Units'),
          el('th', { class: 'num' }, 'Internal'), el('th', { class: 'num' }, 'Client'))),
        el('tbody', {}, ...rows.map((r) => el('tr', {},
          el('td', {}, monthLabel(r.ym)),
          el('td', { class: 'num' }, int(r.units)),
          el('td', { class: 'num' }, numInput(r, 'budget_media')),
          el('td', { class: 'num' }, numInput(r, 'budget_gms'))))))));
}

function numInput(row, key) {
  return el('input', {
    class: 'cellinput', type: 'number', step: '1', value: row[key] ?? '',
    onchange: (e) => put('line_month', {
      id: row.id, [key]: e.target.value === '' ? null : Number(e.target.value),
    }),
  });
}

/* ------------------------------------------------------------- creatives */

function creatives(line, refresh) {
  const list = where('creative', (c) => c.line_id === line.id);
  const spend = where('spend', (s) => s.line_id === line.id);
  const spendOf = (cid) => spend.filter((s) => s.creative_id === cid)
    .reduce((a, s) => a + num(s.spend_internal), 0);

  const body = el('tbody', {}, ...list.map((c) => el('tr', {},
    el('td', { class: 'wrap' }, el('input', {
      class: 'cellinput', style: { textAlign: 'left' }, value: c.name || '',
      onchange: (e) => put('creative', { id: c.id, name: e.target.value }),
    })),
    el('td', {}, el('input', {
      class: 'cellinput', type: 'date', value: c.live_from || '',
      onchange: (e) => put('creative', { id: c.id, live_from: e.target.value }),
    })),
    el('td', { class: 'num' }, money(spendOf(c.id), line.currency || 'AUD', 0)),
    el('td', {}, el('input', {
      class: 'cellinput', style: { textAlign: 'left' }, placeholder: 'preview link',
      value: c.preview_url || '',
      onchange: (e) => put('creative', { id: c.id, preview_url: e.target.value }),
    })),
    el('td', {}, el('button', {
      class: 'btn ghost sm', title: 'Remove creative',
      onclick: () => {
        if (!confirm('Remove this creative? Its spend rows stay on the line.')) return;
        for (const s of spend.filter((x) => x.creative_id === c.id)) {
          put('spend', { id: s.id, creative_id: null });
        }
        remove('creative', c.id); refresh();
      },
    }, '✕')))));

  return el('div', { class: 'field' },
    el('label', {}, `Creatives — optional (${list.length})`),
    list.length
      ? el('div', { class: 'tablewrap' }, el('table', { class: 'data' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Creative'), el('th', {}, 'Live from'),
          el('th', { class: 'num' }, 'Spend'), el('th', {}, 'Preview'), el('th', {}))),
        body))
      : el('div', { class: 'hint' }, 'No creatives on this line. Line-level spend is tracked either way — add creatives only when you want the breakdown.'),
    el('button', {
      class: 'btn sm', style: { marginTop: '8px' },
      onclick: () => {
        put('creative', {
          id: newId('cr'), line_id: line.id, name: 'New creative',
          live_from: '', status: 'Live',
        });
        refresh();
      },
    }, '+ Add creative'));
}
